import {
  useEffect,
  useState,
} from "react";

import type {
  DatabaseCatalogResponse,
} from "../../services/api";

import {
  generateAiSql,
  loadAiStatus,
  type AiGenerateSqlResponse,
  type AiStatusResponse,
} from "../../services/aiApi";

import "./AiAssistant.css";

interface AiAssistantProps {
  open: boolean;

  catalog:
    DatabaseCatalogResponse | null;

  databaseName: string | null;

  currentSql: string;

  onClose: () => void;

  onApplySql: (
    sql: string,
  ) => void;
}

export default function AiAssistant({
  open,
  catalog,
  databaseName,
  currentSql,
  onClose,
  onApplySql,
}: AiAssistantProps) {
  const [
    prompt,
    setPrompt,
  ] = useState("");

  const [
    status,
    setStatus,
  ] =
    useState<AiStatusResponse | null>(
      null,
    );

  const [
    result,
    setResult,
  ] =
    useState<AiGenerateSqlResponse | null>(
      null,
    );

  const [
    loadingStatus,
    setLoadingStatus,
  ] = useState(false);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    void refreshStatus();
  }, [
    open,
  ]);

  if (!open) {
    return null;
  }

  async function refreshStatus() {
    try {
      setLoadingStatus(
        true,
      );

      setError(
        null,
      );

      const response =
        await loadAiStatus();

      setStatus(
        response,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load AI status.",
      );
    } finally {
      setLoadingStatus(
        false,
      );
    }
  }

  async function handleGenerate() {
    if (
      !prompt.trim()
    ) {
      setError(
        "Enter a request for Universal AI.",
      );

      return;
    }

    if (
      !status?.configured
    ) {
      setError(
        "AI provider is not configured.",
      );

      return;
    }

    try {
      setGenerating(
        true,
      );

      setError(
        null,
      );

      setResult(
        null,
      );

      const response =
        await generateAiSql({
          prompt:
            prompt.trim(),

          database_name:
            databaseName,

          schema_context:
            buildSchemaContext(
              catalog,
            ),

          current_sql:
            currentSql.trim()
              ? currentSql
              : null,
        });

      if (!response.success) {
        setError(
          response.message ??
            "Universal AI could not generate SQL.",
        );

        return;
      }

      setResult(
        response,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate SQL.",
      );
    } finally {
      setGenerating(
        false,
      );
    }
  }

  function handleClear() {
    setPrompt("");
    setResult(null);
    setError(null);
  }

  return (
    <aside className="ai-assistant">
      <div className="ai-assistant-header">
        <div>
          <span>
            UNIVERSAL AI
          </span>

          <strong>
            SQL Assistant
          </strong>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          aria-label="Close AI assistant"
        >
          ×
        </button>
      </div>

      <div className="ai-assistant-status">
        <div>
          <span
            className={`ai-status-dot ${
              status?.configured
                ? "online"
                : "offline"
            }`}
          />

          <strong>
            {loadingStatus
              ? "Checking AI..."
              : status?.configured
                ? "AI Ready"
                : "AI Offline"}
          </strong>
        </div>

        <span>
          {status?.model ??
            "No model"}
        </span>
      </div>

      <div className="ai-assistant-body">
        <section className="ai-section">
          <div className="ai-section-title">
            Ask Universal AI
          </div>

          <textarea
            value={
              prompt
            }
            placeholder="Example: Show the 10 machines with the highest average cycle time."
            onChange={(
              event,
            ) =>
              setPrompt(
                event.target
                  .value,
              )
            }
          />

          <div className="ai-prompt-actions">
            <button
              type="button"
              onClick={
                handleClear
              }
              disabled={
                generating
              }
            >
              Clear
            </button>

            <button
              type="button"
              className="ai-primary-action"
              onClick={
                handleGenerate
              }
              disabled={
                generating ||
                !status?.configured
              }
            >
              {generating
                ? "Generating..."
                : "Generate SQL"}
            </button>
          </div>
        </section>

        <section className="ai-context-card">
          <div>
            <span>
              Database
            </span>

            <strong>
              {databaseName ??
                "No database"}
            </strong>
          </div>

          <div>
            <span>
              Schemas
            </span>

            <strong>
              {catalog?.schemas
                .length ?? 0}
            </strong>
          </div>

          <div>
            <span>
              Current SQL
            </span>

            <strong>
              {currentSql.trim()
                ? "Included"
                : "None"}
            </strong>
          </div>
        </section>

        {error && (
          <div className="ai-error">
            {error}
          </div>
        )}

        {result?.warning && (
          <div className="ai-warning">
            <strong>
              Review Required
            </strong>

            <span>
              {
                result.warning
              }
            </span>
          </div>
        )}

        {result?.sql && (
          <section className="ai-section">
            <div className="ai-result-heading">
              <div className="ai-section-title">
                Generated SQL
              </div>

              <span>
                {result.model}
              </span>
            </div>

            <pre className="ai-sql-preview">
              <code>
                {
                  result.sql
                }
              </code>
            </pre>

            <button
              type="button"
              className="ai-apply-button"
              onClick={() =>
                onApplySql(
                  result.sql ?? "",
                )
              }
            >
              Apply to Editor
            </button>
          </section>
        )}

        {result?.explanation && (
          <section className="ai-section">
            <div className="ai-section-title">
              Explanation
            </div>

            <div className="ai-explanation">
              {
                result.explanation
              }
            </div>
          </section>
        )}

        <div className="ai-safety-note">
          Universal AI can generate
          and explain SQL, but it
          cannot execute database
          commands. Review generated
          SQL before using Run.
        </div>
      </div>
    </aside>
  );
}

function buildSchemaContext(
  catalog:
    DatabaseCatalogResponse | null,
): string {
  if (
    !catalog?.schemas.length
  ) {
    return (
      "No PostgreSQL schema metadata is currently available."
    );
  }

  return catalog.schemas
    .map(
      (schema) => {
        const tables =
          schema.tables.length
            ? schema.tables.join(
                ", ",
              )
            : "none";

        const views =
          schema.views.length
            ? schema.views.join(
                ", ",
              )
            : "none";

        return [
          `Schema: ${schema.name}`,
          `Tables: ${tables}`,
          `Views: ${views}`,
        ].join("\n");
      },
    )
    .join("\n\n");
}