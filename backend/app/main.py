import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .connections.router import router as connections_router
from .queries.router import router as queries_router
from .imports.router import router as imports_router

from .ai.router import router as ai_router
from .registry.router import (
    router as registry_router,
)
from .public_data.router import router as public_data_router


app = FastAPI(
    title="EES Universal Data Moon API",
    version="1.0.0",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:1420,http://127.0.0.1:1420,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "https://jd-dev-king.github.io"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(connections_router)
app.include_router(queries_router)
app.include_router(imports_router)
app.include_router(ai_router)
app.include_router(registry_router)
app.include_router(public_data_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "Universal Data Moon API",
        "version": "1.0.0",
    }