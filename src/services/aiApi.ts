const API_BASE_URL =
  "http://127.0.0.1:8000";

export interface AiStatusResponse {
  success: boolean;

  provider:
    | "openai"
    | "ollama";

  configured: boolean;

  model?: string | null;

  message?: string | null;
}

export interface AiGenerateSqlRequest {
  prompt: string;

  database_name?: string | null;

  schema_context?: string | null;

  current_sql?: string | null;
}

export interface AiGenerateSqlResponse {
  success: boolean;

  sql?: string | null;

  explanation?: string | null;

  warning?: string | null;

  model?: string | null;

  message?: string | null;
}

export async function loadAiStatus(): Promise<
  AiStatusResponse
> {
  const response =
    await fetch(
      `${API_BASE_URL}/ai/status`,
    );

  if (!response.ok) {
    throw new Error(
      `AI status service returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}

export async function generateAiSql(
  request: AiGenerateSqlRequest,
): Promise<AiGenerateSqlResponse> {
  const response =
    await fetch(
      `${API_BASE_URL}/ai/generate-sql`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          request,
        ),
      },
    );

  if (!response.ok) {
    throw new Error(
      `AI SQL service returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}