
const pool = require("../config/db");

async function logAction(userId, action, documentId = null, details = "") {
    try {
        await pool.execute(
            `INSERT INTO audit_logs
             (user_id, action, document_id, details)
             VALUES (?, ?, ?, ?)`,
            [userId, action, documentId, details]
        );
    } catch (error) {
        console.error("Audit logging error:", error.message);
    }
}

module.exports = logAction;
