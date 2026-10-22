
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
        next();
    } catch {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

router.get("/", authenticate, async (req, res) => {
    try {
        const [logs] = await pool.execute(
            `SELECT id, action, document_id, details, created_at
             FROM audit_logs
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 100`,
            [req.user.id]
        );

        return res.json(logs);
    } catch (error) {
        console.error("Audit history error:", error.message);

        return res.status(500).json({
            message: "Could not retrieve audit history"
        });
    }
});

module.exports = router;
