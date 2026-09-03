# Locapi (Beta) 🚀

> **Modern, Lightweight, Local-First Desktop API Client & Multi-Protocol Testing Tool**

<p align="center">
  <a href="https://github.com/jswnh/locapi/releases/latest/download/Locapi-Setup-1.0.0.exe">
    <img src="https://img.shields.io/badge/Download%20Setup%20(Windows)-Locapi%20v1.0.0--beta-0275E2?style=for-the-badge&logo=windows&logoColor=white" alt="Download Locapi for Windows" />
  </a>
  &nbsp;
  <a href="https://github.com/jswnh/locapi/releases">
    <img src="https://img.shields.io/badge/All%20Releases-GitHub-238636?style=for-the-badge&logo=github&logoColor=white" alt="All Releases" />
  </a>
</p>

Locapi is an offline-capable, privacy-focused desktop API development environment designed for modern engineers. It frees developers from bloated web apps, mandatory cloud accounts, and telemetry tracking—delivering a blazing-fast native experience backed by an embedded SQLite database.

---

## 📥 Download & Installation

Get the latest installer for Windows:

| Platform | Format | Architecture | Download |
| :--- | :--- | :---: | :--- |
| **Windows 10 / 11** | **NSIS Installer (`.exe`)** | `x64` | [**⬇️ Download Locapi Setup 1.0.0.exe**](https://github.com/jswnh/locapi/releases/latest/download/Locapi-Setup-1.0.0.exe) |
| **Windows 10 / 11** | **Standalone / Portable** | `x64` | [**📦 View Latest Release Assets**](https://github.com/jswnh/locapi/releases/latest) |

> [!TIP]
> **Locally Built Executable:**  
> If you built the project on your machine, your installer is generated in [`dist/Locapi Setup 1.0.0.exe`](file:///C:/Users/Josuan/Desktop/locapi/dist/Locapi%20Setup%201.0.0.exe) and the standalone unpacked app in [`dist/win-unpacked/Locapi.exe`](file:///C:/Users/Josuan/Desktop/locapi/dist/win-unpacked/Locapi.exe).

---

> [!IMPORTANT]
> **Beta Release Notice (v1.0.0-beta)**  
> Locapi is currently in active **Beta**. While core engines (REST, WebSocket, Socket.IO, MQTT, gRPC, Cookie Jar, and Import/Export) are fully functional and production-tested, we are actively collecting developer feedback and polishing workflows. If you encounter any issues or have feature requests, please report them!

---

## ✨ Key Features

### 🌐 Comprehensive Multi-Protocol Support
* **REST & HTTP**: Native CORS-free Node execution, query parameter manager, Bearer/Basic/API-Key authentication, multi-part `formData` file uploads, URL-encoded bodies, and raw JSON payloads.
* **GraphQL**: Built-in GraphQL editor with query and variables packaging, syntax highlighting, and JSON response formatting.
* **SOAP**: First-class XML request formatting, XML header support, and automated response beautification via `fast-xml-parser`.
* **WebSocket**: Real-time bidirectional frame streaming, connection header configuration, live timeline (inbound/outbound), and frame counters.
* **Socket.IO**: Custom namespaces, auth objects, dynamic event emitter, and `socket.onAny` catch-all streaming listener.
* **MQTT**: Multi-broker connections (`mqtt://`, `mqtts://`, `ws://`, `wss://`, `tcp://`), QoS 0/1/2 subscriptions, retain flags, and live packet inspection.
* **gRPC**: Dynamic `.proto` file loader via `@grpc/proto-loader`, service and method introspection, custom metadata headers, and unary RPC execution.

---

### 🔒 Local-First & Zero Telemetry
* **Embedded SQLite Database**: All workspaces, collections, nested folders, history, environments, and cookies are stored locally in `locapi.db`.
* **Zero Tracking**: No user tracking, no analytics, no third-party telemetry, and no forced cloud logins. Your API keys and secrets never leave your device.

---

### 📦 Universal Import & Export
* **Postman Collections (v2 / v2.1)**: Import collections with full multi-level folder trees, headers, query params, auth, and payloads (including `x-www-form-urlencoded` and `formData`).
* **OpenAPI 3.0 & Swagger 2.0**: Import API specifications with automatic tag-to-folder mapping, parameter resolution, and schema extraction.
* **cURL Command Import**: Paste raw `curl` commands anywhere in the app to immediately generate an active request tab.
* **Locapi Backups**: Export and import complete workspaces or single collections in standardized JSON format.

---

### 🍪 Intelligent Cookie Jar & Environments
* **Automatic Cookie Tracking**: Parses `Set-Cookie` response headers and stores cookies in a persistent SQLite cookie store.
* **Automatic Cookie Injection**: Matches domains and paths to automatically inject relevant cookies into outbound requests.
* **Environment Variables**: Dynamic `{{variable}}` substitution across URLs, headers, queries, and bodies with real-time autocompletion and preview.

---

### ⚡ Performance & Ergonomics
* **Zero-Lag Panel Resizing**: GPU-accelerated panel dragging with state synchronization on layout change.
* **3-State Sidebar**: Switch seamlessly between Expanded, Minimalist Compact, and Hover/Floating drawer modes.
* **Offline-Ready**: Full capabilities available with zero internet access when developing against localhost or private networks.

---

## 🛠️ Tech Stack

* **Shell**: [Nextron](https://github.com/saltyshiomix/nextron) (Next.js + Electron)
* **Frontend**: Next.js 16 (Pages Router / Turbopack), React 19, TypeScript
* **Styling & UI**: Tailwind CSS, Radix UI primitives, Lucide Icons, Sonner
* **Database & Persistence**: [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) (WAL mode), Zustand
* **Engines**: Node `fetch`, `ws`, `socket.io-client`, `mqtt`, `@grpc/grpc-js`, `@grpc/proto-loader`, `fast-xml-parser`

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v20 or higher recommended)
* [pnpm](https://pnpm.io/) (v9 or higher)

### Installation
```bash
# Clone the repository
git clone https://github.com/jswnh/locapi.git
cd locapi

# Install dependencies using pnpm
pnpm install
```

### Development Mode
```bash
pnpm dev
```
Nextron will start the Next.js Turbopack dev server and launch the desktop Electron window with hot module reloading.

### Production Build
```bash
pnpm build
```
This runs TypeScript validation, static site generation, webpack main process compilation, and packages the desktop installer into the `dist/` directory:
* **Unpacked Binary**: `dist/win-unpacked/Locapi.exe`
* **Windows NSIS Installer**: `dist/Locapi Setup 1.0.0.exe`

---

## 📋 Privacy Policy
Locapi is committed to complete developer privacy and local-first data ownership. See [`PRIVACY.md`](./PRIVACY.md) for full details.

---

## 📄 License
This project is licensed under an OSI-approved open source license. See [`LICENSE`](./LICENSE) for details.

---

## 👤 Author
Developed and maintained by **Jswnh** ([hulomjosuan@gmail.com](mailto:hulomjosuan@gmail.com)).
Contributions, feedback, and issue reports are welcome!
