# TrustVault Security Threat Model

## Overview
TrustVault is a document management application that handles user accounts, uploaded documents, document sharing, and audit records. This document identifies potential threats and mitigation measures.

## Potential Threats and Mitigations

### 1. Unauthorized Access
**Threat:** An unauthenticated user attempts to access protected resources.

**Mitigation:** Authentication middleware and JWT-based authentication protect restricted API routes.

### 2. Password Exposure
**Threat:** User passwords could be exposed if stored as plain text.

**Mitigation:** Passwords are hashed using bcrypt before storage.

### 3. Unauthorized Document Access
**Threat:** A user attempts to view, download, modify, or delete another user's documents.

**Mitigation:** Document ownership and permission checks are used to restrict access.

### 4. Cross-Company Data Exposure
**Threat:** Users from one company attempt to access another company's documents.

**Mitigation:** Company-based access checks are applied to document operations.

### 5. Malicious File Uploads
**Threat:** An attacker uploads a harmful or unexpected file.

**Mitigation:** File type and size validation should be enforced, and uploaded files should not be executed as application code. These controls must be verified in the implementation.

### 6. Credential and Secret Leakage
**Threat:** Database credentials or JWT secrets are exposed in source control.

**Mitigation:** Environment variables are used for configuration, and `.env` files and database backups are excluded from Git.

### 7. Unauthorized Sharing
**Threat:** A user attempts to share a document they do not own or grant excessive permissions.

**Mitigation:** Ownership checks and permission validation should be enforced when granting or revoking access.

### 8. Missing Audit Evidence
**Threat:** Suspicious document activity goes undetected.

**Mitigation:** Audit logging records relevant actions, including document operations and access attempts.

## Limitations and Further Improvements
- Validate file types and sizes consistently.
- Apply rate limiting to authentication endpoints.
- Use HTTPS for deployed traffic.
- Review authorization checks and test cross-company access.
- Avoid exposing sensitive information in application logs.
- Regularly review dependencies for known vulnerabilities.

## Disclaimer
This threat model describes intended security controls and potential improvements. Each mitigation should be verified through testing before it is considered fully effective.
