from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.request import Request, urlopen


@dataclass
class EesIngestClient:
    base_url: str
    api_key: str
    system_key: str | None = None
    system_id: str | None = None
    timeout: float = 5.0

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        request = Request(
            f"{self.base_url.rstrip('/')}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-EES-Ingest-Key": self.api_key,
            },
            method="POST",
        )
        with urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def _identity(self) -> dict[str, Any]:
        result: dict[str, Any] = {}
        if self.system_key:
            result["system_key"] = self.system_key
        if self.system_id:
            result["system_id"] = self.system_id
        return result

    def telemetry(self, *, metric: str, value: Any, **fields: Any) -> dict[str, Any]:
        return self._post(
            "/api/ingest/telemetry",
            {**self._identity(), "metric": metric, "value": value, **fields},
        )

    def alert(self, *, severity: str, message: str, **fields: Any) -> dict[str, Any]:
        return self._post(
            "/api/ingest/alerts",
            {
                **self._identity(),
                "severity": severity,
                "message": message,
                **fields,
            },
        )

    def diagnostic(
        self,
        *,
        diagnostic_type: str,
        payload: dict[str, Any] | None = None,
        **fields: Any,
    ) -> dict[str, Any]:
        return self._post(
            "/api/ingest/diagnostics",
            {
                **self._identity(),
                "diagnostic_type": diagnostic_type,
                "payload": payload or {},
                **fields,
            },
        )

    def snapshot(self, *, state: dict[str, Any], **fields: Any) -> dict[str, Any]:
        return self._post(
            "/api/ingest/snapshots",
            {**self._identity(), "state": state, **fields},
        )

    def log(self, *, level: str, message: str, **fields: Any) -> dict[str, Any]:
        return self._post(
            "/api/ingest/logs",
            {
                **self._identity(),
                "level": level,
                "message": message,
                **fields,
            },
        )

    def batch(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        return self._post(
            "/api/ingest/batch",
            {**self._identity(), "events": events},
        )
