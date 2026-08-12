from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _enabled() -> bool:
    settings = get_settings()
    return bool(
        settings.data_moon_enabled
        and settings.data_moon_api_url.strip()
        and settings.data_moon_ingest_api_key.strip()
    )


def publish_batch(events: list[dict[str, Any]]) -> bool:
    """Publish events to Data Moon without failing the Power Grid simulation."""
    if not events or not _enabled():
        return False

    settings = get_settings()
    url = settings.data_moon_api_url.rstrip("/") + "/api/ingest/batch"

    try:
        response = httpx.post(
            url,
            headers={
                "Content-Type": "application/json",
                "X-EES-Ingest-Key": settings.data_moon_ingest_api_key,
            },
            json={
                "system_key": settings.data_moon_system_key,
                "events": events,
            },
            timeout=settings.data_moon_timeout_seconds,
        )
        response.raise_for_status()
        return True
    except Exception as exc:
        # Data Moon is observability/integration infrastructure. It must not
        # stop the Power Grid simulation or roll back PostgreSQL telemetry.
        logger.warning("Data Moon publish skipped/failed: %s", exc)
        return False
