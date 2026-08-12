import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .connections.router import router as connections_router
from .queries.router import router as queries_router
from .imports.router import router as imports_router
from .ai.router import router as ai_router
from .registry.router import router as registry_router
from .public_data.router import router as public_data_router
from .admin.router import router as admin_router
from .documents.router import router as documents_router
from .ingest.router import router as ingest_router


BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE)



app = FastAPI(
    title="EES Universal Data Moon API",
    version="1.0.0",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:1420,"
        "http://127.0.0.1:1420,"
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:4173,"
        "http://127.0.0.1:4173,"
        "https://jd-dev-king.github.io,"
        "https://ees-jdl.com,"
        "https://www.ees-jdl.com,"
        "https://portfolio.jeremiahlupton.com"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(connections_router)
app.include_router(queries_router)
app.include_router(imports_router)
app.include_router(ai_router)
app.include_router(registry_router)
app.include_router(public_data_router)
app.include_router(admin_router)
app.include_router(documents_router)
app.include_router(ingest_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "Universal Data Moon API",
        "version": "1.0.0",
    }
