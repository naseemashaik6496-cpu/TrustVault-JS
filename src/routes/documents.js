const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const logAction = require("../services/audit");

const router = express.Router();

const uploadDir = path.join(__dirname, "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// AUTHENTICATION
function authenticate(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
        ? header.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({
            message: "Login required"
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);

        if (!req.user.id || !req.user.companyId) {
            return res.status(401).json({
                message: "Invalid authentication token"
            });
        }

        next();
    } catch {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

// FILE UPLOAD SETTINGS
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, crypto.randomUUID() + ext);
    }
});

const allowedExtensions = new Set([
    ".pdf", ".txt", ".png", ".jpg",
    ".jpeg", ".doc", ".docx"
]);

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedExtensions.has(ext)) {
            cb(null, true);
        } else {
            cb(new Error("File type not allowed"));
        }
    }
});

// UPLOAD DOCUMENT
router.post("/upload", authenticate, (req, res) => {
    upload.single("document")(req, res, async (error) => {
        if (error) {
            return res.status(400).json({
                message: error.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                message: "Please select a document to upload"
            });
        }

        try {
            const category =
                typeof req.body.category === "string"
                    ? req.body.category.trim().slice(0, 100) || "General"
                    : "General";

            const [result] = await pool.execute(
                `INSERT INTO documents
                (user_id, company_id, original_name, stored_name,
                 category, mime_type, file_size)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.user.id,
                    req.user.companyId,
                    path.basename(req.file.originalname),
                    req.file.filename,
                    category,
                    req.file.mimetype,
                    req.file.size
                ]
            );

            await logAction(
                req.user.id,
                req.user.companyId,
                "UPLOAD",
                result.insertId,
                `Uploaded document: ${path.basename(req.file.originalname)}`
            );

            return res.status(201).json({
                message: "Document uploaded successfully",
                documentId: result.insertId
            });
        } catch (error) {
            fs.unlink(req.file.path, () => {});

            console.error("Upload error:", error.message);

            return res.status(500).json({
                message: "Could not save document details"
            });
        }
    });
});

// LIST OWNED AND SHARED DOCUMENTS
router.get("/", authenticate, async (req, res) => {
    try {
        const [documents] = await pool.execute(
            `SELECT
                d.id,
                d.original_name,
                d.category,
                d.mime_type,
                d.file_size,
                d.uploaded_at,
                (d.user_id = ?) AS is_owner,
                dp.permission AS shared_permission
             FROM documents d
             LEFT JOIN document_permissions dp
                ON dp.document_id = d.id
                AND dp.shared_with_user_id = ?
                AND dp.company_id = ?
             WHERE d.company_id = ?
               AND (
                    d.user_id = ?
                    OR dp.shared_with_user_id = ?
               )
             ORDER BY d.uploaded_at DESC`,
            [
                req.user.id,
                req.user.id,
                req.user.companyId,
                req.user.companyId,
                req.user.id,
                req.user.id
            ]
        );

        return res.json(documents);
    } catch (error) {
        console.error("List error:", error.message);

        return res.status(500).json({
            message: "Could not retrieve documents"
        });
    }
});

// SEARCH DOCUMENTS
router.get("/search", authenticate, async (req, res) => {
    try {
        const query = String(req.query.q || "").trim();

        if (!query) {
            return res.status(400).json({
                message: "Enter a filename or category to search"
            });
        }

        const term = `%${query}%`;

        const [documents] = await pool.execute(
            `SELECT DISTINCT
                d.id,
                d.original_name,
                d.category,
                d.mime_type,
                d.file_size,
                d.uploaded_at
             FROM documents d
             LEFT JOIN document_permissions dp
                ON dp.document_id = d.id
                AND dp.shared_with_user_id = ?
                AND dp.company_id = ?
             WHERE d.company_id = ?
               AND (
                    d.user_id = ?
                    OR dp.shared_with_user_id = ?
               )
               AND (
                    d.original_name LIKE ?
                    OR d.category LIKE ?
               )
             ORDER BY d.uploaded_at DESC`,
            [
                req.user.id,
                req.user.companyId,
                req.user.companyId,
                req.user.id,
                req.user.id,
                term,
                term
            ]
        );

        return res.json(documents);
    } catch (error) {
        console.error("Search error:", error.message);

        return res.status(500).json({
            message: "Search failed"
        });
    }
});

// DOWNLOAD DOCUMENT
router.get("/:id/download", authenticate, async (req, res) => {
    try {
        const documentId = Number(req.params.id);

        if (!Number.isInteger(documentId) || documentId < 1) {
            return res.status(400).json({
                message: "Invalid document ID"
            });
        }

        const [rows] = await pool.execute(
            `SELECT d.original_name, d.stored_name
             FROM documents d
             LEFT JOIN document_permissions dp
                ON dp.document_id = d.id
                AND dp.shared_with_user_id = ?
                AND dp.company_id = ?
             WHERE d.id = ?
               AND d.company_id = ?
               AND (
                    d.user_id = ?
                    OR dp.permission IN ('VIEW', 'EDIT')
               )`,
            [
                req.user.id,
                req.user.companyId,
                documentId,
                req.user.companyId,
                req.user.id
            ]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Document not found or access denied"
            });
        }

        const filePath = path.join(uploadDir, rows[0].stored_name);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                message: "File is missing from storage"
            });
        }

        await logAction(
            req.user.id,
            req.user.companyId,
            "DOWNLOAD",
            documentId,
            `Downloaded document: ${rows[0].original_name}`
        );

        return res.download(filePath, rows[0].original_name);
    } catch (error) {
        console.error("Download error:", error.message);

        return res.status(500).json({
            message: "Download failed"
        });
    }
});

// SHARE DOCUMENT
router.post("/:id/share", authenticate, async (req, res) => {
    try {
        const documentId = Number(req.params.id);
        const { username, permission = "VIEW" } = req.body;

        if (!Number.isInteger(documentId) || documentId < 1) {
            return res.status(400).json({
                message: "Invalid document ID"
            });
        }

        if (typeof username !== "string" || !username.trim()) {
            return res.status(400).json({
                message: "Enter a username"
            });
        }

        if (!["VIEW", "EDIT"].includes(permission)) {
            return res.status(400).json({
                message: "Permission must be VIEW or EDIT"
            });
        }

        const [documents] = await pool.execute(
            `SELECT id FROM documents
             WHERE id = ? AND user_id = ? AND company_id = ?`,
            [
                documentId,
                req.user.id,
                req.user.companyId
            ]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                message: "Document not found or you are not the owner"
            });
        }

        // Only share with a user in the same company.
        const [users] = await pool.execute(
            `SELECT id FROM users
             WHERE username = ? AND company_id = ?`,
            [
                username.trim(),
                req.user.companyId
            ]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "User not found in your company"
            });
        }

        if (Number(users[0].id) === Number(req.user.id)) {
            return res.status(400).json({
                message: "You already own this document"
            });
        }

        await pool.execute(
            `INSERT INTO document_permissions
             (document_id, owner_id, shared_with_user_id,
              company_id, permission)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                owner_id = VALUES(owner_id),
                company_id = VALUES(company_id),
                permission = VALUES(permission)`,
            [
                documentId,
                req.user.id,
                users[0].id,
                req.user.companyId,
                permission
            ]
        );

        await logAction(
            req.user.id,
            req.user.companyId,
            "SHARE",
            documentId,
            `Shared with ${username.trim()} using ${permission} permission`
        );

        return res.status(201).json({
            message: "Document shared successfully",
            documentId,
            sharedWith: username.trim(),
            permission
        });
    } catch (error) {
        console.error("Share error:", error.message);

        return res.status(500).json({
            message: "Could not share document"
        });
    }
});

// UPDATE DOCUMENT
router.put("/:id", authenticate, async (req, res) => {
    try {
        const documentId = Number(req.params.id);
        const { original_name, category } = req.body;

        if (!Number.isInteger(documentId) || documentId < 1) {
            return res.status(400).json({
                message: "Invalid document ID"
            });
        }

        if (
            (original_name !== undefined &&
                (typeof original_name !== "string" ||
                 !original_name.trim())) ||
            (category !== undefined &&
                (typeof category !== "string" ||
                 !category.trim()))
        ) {
            return res.status(400).json({
                message: "Name and category must be non-empty text"
            });
        }

        if (original_name === undefined && category === undefined) {
            return res.status(400).json({
                message: "Provide a name or category to update"
            });
        }

        const [documents] = await pool.execute(
            `SELECT d.id
             FROM documents d
             LEFT JOIN document_permissions dp
                ON dp.document_id = d.id
                AND dp.shared_with_user_id = ?
                AND dp.company_id = ?
             WHERE d.id = ?
               AND d.company_id = ?
               AND (
                    d.user_id = ?
                    OR dp.permission = 'EDIT'
               )`,
            [
                req.user.id,
                req.user.companyId,
                documentId,
                req.user.companyId,
                req.user.id
            ]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                message: "Document not found or edit access denied"
            });
        }

        const updates = [];
        const values = [];

        if (original_name !== undefined) {
            updates.push("original_name = ?");
            values.push(original_name.trim().slice(0, 255));
        }

        if (category !== undefined) {
            updates.push("category = ?");
            values.push(category.trim().slice(0, 100));
        }

        values.push(documentId, req.user.companyId);

        await pool.execute(
            `UPDATE documents
             SET ${updates.join(", ")}
             WHERE id = ? AND company_id = ?`,
            values
        );

        await logAction(
            req.user.id,
            req.user.companyId,
            "UPDATE",
            documentId,
            "Updated document details"
        );

        return res.json({
            message: "Document updated successfully"
        });
    } catch (error) {
        console.error("Update error:", error.message);

        return res.status(500).json({
            message: "Could not update document"
        });
    }
});

// DELETE DOCUMENT (OWNER ONLY)
router.delete("/:id", authenticate, async (req, res) => {
    try {
        const documentId = Number(req.params.id);

        if (!Number.isInteger(documentId) || documentId < 1) {
            return res.status(400).json({
                message: "Invalid document ID"
            });
        }

        const [rows] = await pool.execute(
            `SELECT stored_name, original_name
             FROM documents
             WHERE id = ? AND user_id = ? AND company_id = ?`,
            [
                documentId,
                req.user.id,
                req.user.companyId
            ]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Document not found"
            });
        }

        await logAction(
            req.user.id,
            req.user.companyId,
            "DELETE",
            documentId,
            `Deleted document: ${rows[0].original_name}`
        );

        await pool.execute(
            `DELETE FROM documents
             WHERE id = ? AND user_id = ? AND company_id = ?`,
            [
                documentId,
                req.user.id,
                req.user.companyId
            ]
        );

        const filePath = path.join(uploadDir, rows[0].stored_name);

        fs.unlink(filePath, (error) => {
            if (error && error.code !== "ENOENT") {
                console.error("File cleanup error:", error.message);
            }
        });

        return res.json({
            message: "Document deleted successfully"
        });
    } catch (error) {
        console.error("Delete error:", error.message);

        return res.status(500).json({
            message: "Could not delete document"
        });
    }
});

module.exports = router;