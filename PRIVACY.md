# Privacy Policy

**Effective Date:** September 3, 2026  
**Product:** Locapi (Desktop API Client)  
**Author:** Jswnh  

At **Locapi**, privacy and developer data ownership are fundamental design principles. Locapi is built from the ground up as a **local-first, offline-capable desktop application**.

---

## 1. Local-First Data Storage
* **Where data lives:** All collections, folders, API requests, request/response history, environment variables, settings, and cookies are stored **exclusively on your local machine** in an embedded SQLite database (`locapi.db` located in your local operating system user data folder).
* **No forced cloud accounts:** Locapi does not require account creation, logins, or cloud synchronization to use any of its features.
* **Full data ownership:** You have 100% ownership and physical control over your database, exported files, and credentials.

---

## 2. Zero Telemetry & Zero Analytics
* **No tracking:** Locapi does not include telemetry, user tracking, event logging, crash reporting to third parties, or behavioral analytics.
* **No advertising:** There are no ad networks, tracking pixels, or third-party marketing SDKs included in the codebase.

---

## 3. Network Communication
* Locapi only sends outbound network requests (HTTP/REST, GraphQL, SOAP, WebSocket, Socket.IO, MQTT, and gRPC) **when you explicitly command it to do so** (e.g., clicking "Send" or "Connect").
* Network traffic is routed directly between your computer and the destination servers or brokers that you specify.
* Locapi does not proxy your requests through any intermediate proprietary servers or inspection relays.

---

## 4. Sensitive Data & Secrets
* API keys, Bearer tokens, Basic Authentication credentials, and environment variables are stored in your local database.
* When exporting collections or workspaces, ensure you review sensitive environment values before sharing export files with third parties.

---

## 5. Third-Party Services
* Locapi connects only to the API endpoints and network hosts defined in your requests. It is recommended to review the privacy policies of any third-party APIs or remote services you test using Locapi.

---

## 6. Contact
If you have questions, feedback, or concerns regarding Locapi's privacy practices, feel free to reach out via GitHub or email at `hulomjosuan@gmail.com`.
