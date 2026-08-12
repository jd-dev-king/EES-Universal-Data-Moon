# EES Universal Data Moon

EES Universal Data Moon is the governed data, document, telemetry, analytics, and system-registry layer for the EES Universe.

It combines PostgreSQL-backed structured data with MongoDB-backed operational documents and a FastAPI gateway, presented through a React/TypeScript workspace.

## Current capabilities

- EES Systems registry and System Lens navigation
- PostgreSQL catalog, query, import, and governed data access
- MongoDB Documents workspace
- MongoDB document create, edit, and delete administration
- MongoDB aggregation pipeline execution
- Saved charts and operational dashboards
- System-aware dashboard filtering and deep linking
- Universal ingest gateway for EES applications
- Registry-validated telemetry ingestion
- Batch ingestion for telemetry, alerts, diagnostics, snapshots, logs, and AI interactions
- AI workspace integration
- Power Grid Sun live integration through the Universal Ingest Gateway
- Desktop-ready Tauri shell plus React/Vite frontend

## Architecture

```text
EES Applications
      |
      |  X-EES-Ingest-Key
      v
Universal Ingest Gateway
      |
      +---- Registry validation ------> PostgreSQL
      |
      +---- telemetry ----------------> MongoDB telemetry_events
      +---- alerts -------------------> MongoDB alert_events
      +---- diagnostics --------------> MongoDB diagnostic_payloads
      +---- snapshots ----------------> MongoDB simulation_snapshots
      +---- logs ---------------------> MongoDB application_logs
      +---- AI interactions ----------> MongoDB ai_interactions
                                            |
                                            v
                                  Documents / Charts /
                                  Dashboards / System Lens
```

## Technology

Frontend: React, TypeScript, Vite, Monaco Editor, Tauri.

Backend: Python, FastAPI, PostgreSQL/psycopg, MongoDB/PyMongo, OpenAI integration.

Deployment model: local desktop/development, GitHub repository and Pages portfolio surface, with backend/database services deployable separately.

## Local development

Create environment files from `.env.example` and keep real secrets out of source control.

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
source .venv/bin/activate
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Validate:

```bash
curl http://127.0.0.1:8000/api/ingest/health
curl http://127.0.0.1:8000/api/documents/health
```

## Security

Never commit database passwords, OpenAI keys, MongoDB credentials, or `EES_INGEST_API_KEY`. Use local `.env` files and deployment-platform secret variables.

The ingest API key is a machine-to-machine secret and must not be exposed in browser-side JavaScript.

## Release

Recommended first integrated release: **v1.0.0 — Universal Data Integration & Operations Layer**.

See `CHANGELOG.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`, and `FINALIZATION-CHECKLIST.md`.
