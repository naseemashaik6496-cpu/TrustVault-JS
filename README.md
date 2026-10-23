# TrustVault – Secure Document Management System

## Overview
TrustVault is a secure document management web application that allows users to upload, store, download, manage, and share documents with controlled permissions. It includes user authentication, company-based access isolation, and audit logging.

## Features
- User registration and login
- Secure document upload and download
- Document management
- Document sharing with view or edit permissions
- Company-based data isolation
- Audit logs for tracking document activities
- Responsive dashboard interface

## Technology Stack
- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Authentication:** JSON Web Tokens (JWT)
- **Password Security:** bcrypt
- **Deployment:** Render
- **Cloud Database:** Aiven

## Live Demo
https://trustvault-js.onrender.com

## Repository
https://github.com/naseemashaik6496-cpu/TrustVault-JS

## Local Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/naseemashaik6496-cpu/TrustVault-JS.git
   ```

2. Open the project directory:

   ```bash
   cd TrustVault-JS
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file using the environment variables required by the application. Configure your database connection and JWT secret. Never commit real credentials or secrets.

5. Start the application:

   ```bash
   npm start
   ```

6. Open `http://localhost:3000` in your browser.

## Security Notes
- Passwords are hashed before storage.
- Protected routes require authentication.
- Document permissions control shared access.
- Audit logs record relevant document activities.
- Database credentials and JWT secrets must be stored in environment variables.

## Project Status
The application is deployed, and core features have been tested. Additional testing and documentation may be required for the final challenge submission.

## Author
Shaik Naseema
