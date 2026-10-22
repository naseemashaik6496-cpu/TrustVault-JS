
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./src/config/db");
const authRoutes = require("./src/routes/auth");
const documentRoutes = require("./src/routes/documents");
const auditRoutes = require("./src/routes/audit");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/audit", auditRoutes);
app.get("/api/auth/test", (req, res) => {
    res.send("Auth route is working!");
});
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/health", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS ok");

        res.json({
            status: "ok",
            database: rows[0].ok === 1
        });
    } catch (error) {
        console.error("Database connection error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Database connection failed. Check your local .env settings."
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`TrustVault server running at http://localhost:${PORT}`);
});
