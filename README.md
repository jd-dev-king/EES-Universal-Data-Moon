# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)


## v1.0.0 — EES Data Integration Layer

The v1 release adds a governed enterprise catalog/query gateway for connected EES applications.

```text
GET  /api/health
GET  /api/catalog/schemas
GET  /api/catalog/schemas/{schema}/tables
GET  /api/catalog/{schema}/{table}/columns
GET  /api/catalog/{schema}/{table}/count
GET  /api/catalog/{schema}/{table}/sample?limit=25
POST /api/query
```

The `/api/query` endpoint is read-only. PostgreSQL credentials remain on the Data Moon backend; connected browser applications do not receive database passwords.

Initial consumers are EES Pharma Data Nexus and Serverless SQL Studio.
