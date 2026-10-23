const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

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
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

// GET AUDIT LOGS FOR THE SIGNED-IN USER'S COMPANY
router.get("/", authenticate, async (req, res) => {
    try {
        const [logs] = await pool.execute(
            `SELECT
                a.id,
                a.action,
                a.document_id,
                a.details,
                a.created_at,
                u.username
             FROM audit_logs a
             JOIN users u ON u.id = a.user_id
             WHERE a.company_id = ?
               AND a.user_id = ?
             ORDER BY a.created_at DESC
             LIMIT 100`,
            [
                req.user.companyId,
                req.user.id
            ]
        );

        return res.json(logs);
    } catch (error) {
        console.error("Audit log error:", error.message);

        return res.status(500).json({
            message: "Could not retrieve audit logs"
        });
    }
});

module.exports = router;