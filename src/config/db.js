
const mysql = require("mysql2/promise");
const fs = require("fs");
require("dotenv").config();

let sslConfig;

if (process.env.DB_SSL === "true") {
    let ca;

    if (process.env.DB_SSL_CA_BASE64) {
        ca = Buffer.from(
            process.env.DB_SSL_CA_BASE64,
            "base64"
        ).toString("utf8");
    } else if (process.env.DB_SSL_CA) {
        ca = process.env.DB_SSL_CA.replace(/\\n/g, "\n");
    } else {
        ca = fs.readFileSync(
            process.env.DB_SSL_CA_PATH ||
            "C:\\Users\\HP\\Downloads\\ca.pem",
            "utf8"
        );
    }

    sslConfig = {
        ca: ca,
        rejectUnauthorized: true
    };
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "trustvault",
    ssl: sslConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
