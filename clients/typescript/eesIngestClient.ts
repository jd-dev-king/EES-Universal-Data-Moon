export type EesEventType =
  | "telemetry"
  | "alert"
  | "diagnostic"
  | "snapshot"
  | "log"
  | "ai_interaction";

export interface EesBatchEvent {
  type: EesEventType;
  data: Record<string, unknown>;
}

export interface EesIngestClientOptions {
  baseUrl: string;
  apiKey: string;
  systemKey?: string;
  systemId?: string;
}

export class EesIngestClient {
  constructor(private readonly options: EesIngestClientOptions) {}

  private identity() {
    return {
      ...(this.options.systemKey
        ? { system_key: this.options.systemKey }
        : {}),
      ...(this.options.systemId
        ? { system_id: this.options.systemId }
        : {}),
    };
  }

  private async post(path: string, body: Record<string, unknown>) {
    const response = await fetch(
      `${this.options.baseUrl.replace(/\/$/, "")}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EES-Ingest-Key": this.options.apiKey,
        },
        body: JSON.stringify(body),
      },
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        payload?.detail ??
          `EES ingest returned HTTP ${response.status}.`,
      );
    }

    return payload;
  }

  telemetry(metric: string, value: unknown, fields: Record<string, unknown> = {}) {
    return this.post("/api/ingest/telemetry", {
      ...this.identity(),
      metric,
      value,
      ...fields,
    });
  }

  alert(severity: string, message: string, fields: Record<string, unknown> = {}) {
    return this.post("/api/ingest/alerts", {
      ...this.identity(),
      severity,
      message,
      ...fields,
    });
  }

  diagnostic(
    diagnosticType: string,
    payload: Record<string, unknown> = {},
    fields: Record<string, unknown> = {},
  ) {
    return this.post("/api/ingest/diagnostics", {
      ...this.identity(),
      diagnostic_type: diagnosticType,
      payload,
      ...fields,
    });
  }

  snapshot(state: Record<string, unknown>, fields: Record<string, unknown> = {}) {
    return this.post("/api/ingest/snapshots", {
      ...this.identity(),
      state,
      ...fields,
    });
  }

  log(level: string, message: string, fields: Record<string, unknown> = {}) {
    return this.post("/api/ingest/logs", {
      ...this.identity(),
      level,
      message,
      ...fields,
    });
  }

  batch(events: EesBatchEvent[]) {
    return this.post("/api/ingest/batch", {
      ...this.identity(),
      events,
    });
  }
}
