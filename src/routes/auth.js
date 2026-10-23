
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

// User Registration
router.post("/register", async (req, res) => {
    let connection;

    try {
        const { name, username, email, password } = req.body;

        if (!name || !username || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters"
            });
        }

        const [existing] = await pool.execute(
            "SELECT id FROM users WHERE username = ? OR email = ?",
            [username.trim(), email.trim()]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                message: "Username or email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Create a separate company for this new registration.
        const companyName =
            "TrustVault Workspace - " + username.trim();

        const [companyResult] = await connection.execute(
            "INSERT INTO companies (name) VALUES (?)",
            [companyName]
        );

        const companyId = companyResult.insertId;

        // Register the user under the newly created company.
        await connection.execute(
            `INSERT INTO users
                (name, username, email, password, company_id)
             VALUES (?, ?, ?, ?, ?)`,
            [
                name.trim(),
                username.trim(),
                email.trim(),
                hashedPassword,
                companyId
            ]
        );

        await connection.commit();

        res.status(201).json({
            message: "Registration successful. You can now log in."
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Registration error:", error.message);

        res.status(500).json({
            message: "Registration failed"
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// User Login
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        const [users] = await pool.execute(
            `SELECT id, name, username, email, password, role, company_id
             FROM users
             WHERE username = ? OR email = ?`,
            [username.trim(), username.trim()]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid username/email or password"
            });
        }

        const user = users[0];

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                message: "Invalid username/email or password"
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is not configured");

            return res.status(500).json({
                message: "Server authentication configuration error"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                companyId: user.company_id
            },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role,
                companyId: user.company_id
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            message: "Login failed"
        });
    }
});

module.exports = router;
