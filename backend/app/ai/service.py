import json
import os

from dotenv import load_dotenv
from openai import OpenAI

from .schemas import (
    AiGenerateSqlRequest,
    AiGenerateSqlResponse,
    AiStatusResponse,
)


load_dotenv()


DEFAULT_MODEL = "gpt-5-mini"


def get_ai_model() -> str:
    return (
        os.getenv(
            "EES_AI_MODEL"
        )
        or DEFAULT_MODEL
    )


def get_ai_status() -> AiStatusResponse:
    api_key = os.getenv(
        "OPENAI_API_KEY"
    )

    configured = bool(
        api_key
        and api_key.strip()
    )

    return AiStatusResponse(
        success=True,
        provider="openai",
        configured=configured,
        model=get_ai_model(),
        message=(
            "OpenAI is configured."
            if configured
            else (
                "OPENAI_API_KEY "
                "is not configured."
            )
        ),
    )


def generate_sql(
    request: AiGenerateSqlRequest,
) -> AiGenerateSqlResponse:
    api_key = os.getenv(
        "OPENAI_API_KEY"
    )

    if not api_key:
        return AiGenerateSqlResponse(
            success=False,
            message=(
                "OPENAI_API_KEY "
                "is not configured."
            ),
        )

    if not request.prompt.strip():
        return AiGenerateSqlResponse(
            success=False,
            message=(
                "AI prompt cannot be empty."
            ),
        )

    client = OpenAI(
        api_key=api_key,
    )

    model = get_ai_model()

    schema_context = (
        request.schema_context
        or "No schema metadata supplied."
    )

    database_name = (
        request.database_name
        or "Unknown database"
    )

    current_sql = (
        request.current_sql
        or "No existing SQL."
    )

    instructions = """
You are the SQL assistant inside
EES Universal Data Moon.

You generate PostgreSQL only.

Rules:
- Use only schemas, tables, views,
  and columns supplied in the
  database context.
- Never invent database objects.
- Prefer schema-qualified names.
- Quote PostgreSQL identifiers
  with double quotes when useful.
- Never execute SQL.
- Never claim SQL was executed.
- Do not generate shell commands.
- Do not generate connection
  strings or credentials.
- For destructive SQL such as
  DELETE, DROP, TRUNCATE,
  ALTER DROP, or UPDATE without
  a restrictive WHERE clause,
  clearly set a warning.
- Keep explanations concise.
"""

    user_input = f"""
Database:
{database_name}

Database context:
{schema_context}

Current SQL:
{current_sql}

User request:
{request.prompt}

Return a PostgreSQL query and
a concise explanation.
"""

    try:
        response = (
            client.responses.create(
                model=model,

                instructions=(
                    instructions
                ),

                input=user_input,

                text={
                    "format": {
                        "type": (
                            "json_schema"
                        ),

                        "name": (
                            "ees_sql_response"
                        ),

                        "strict": True,

                        "schema": {
                            "type": (
                                "object"
                            ),

                            "properties": {
                                "sql": {
                                    "type": (
                                        "string"
                                    ),
                                },

                                "explanation": {
                                    "type": (
                                        "string"
                                    ),
                                },

                                "warning": {
                                    "type": [
                                        "string",
                                        "null",
                                    ],
                                },
                            },

                            "required": [
                                "sql",
                                "explanation",
                                "warning",
                            ],

                            "additionalProperties": (
                                False
                            ),
                        },
                    },
                },
            )
        )

        output_text = (
            response.output_text
        )

        payload = json.loads(
            output_text
        )

        return AiGenerateSqlResponse(
            success=True,

            sql=payload[
                "sql"
            ],

            explanation=payload[
                "explanation"
            ],

            warning=payload.get(
                "warning"
            ),

            model=model,
        )

    except Exception as exc:
        return AiGenerateSqlResponse(
            success=False,

            model=model,

            message=str(exc),
        )