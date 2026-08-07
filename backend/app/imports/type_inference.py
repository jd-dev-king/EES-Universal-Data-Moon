from datetime import datetime
from typing import Iterable


def normalize_identifier(value: str) -> str:
    normalized = value.strip().lower()

    normalized = "".join(
        character if character.isalnum() or character == "_"
        else "_"
        for character in normalized
    )

    while "__" in normalized:
        normalized = normalized.replace("__", "_")

    normalized = normalized.strip("_")

    if not normalized:
        return "column"

    if normalized[0].isdigit():
        normalized = f"col_{normalized}"

    return normalized


def infer_postgres_type(
    values: Iterable[str | None],
) -> tuple[str, bool]:
    values_list = list(values)

    cleaned = [
        value.strip()
        for value in values_list
        if value is not None and value.strip() != ""
    ]

    nullable = len(cleaned) != len(values_list)

    if not cleaned:
        return "TEXT", True

    if all(_is_boolean(value) for value in cleaned):
        return "BOOLEAN", nullable

    if all(_is_integer(value) for value in cleaned):
        return "BIGINT", nullable

    if all(_is_float(value) for value in cleaned):
        return "DOUBLE PRECISION", nullable

    if all(_is_timestamp(value) for value in cleaned):
        return "TIMESTAMPTZ", nullable

    return "TEXT", nullable


def _is_boolean(value: str) -> bool:
    return value.lower() in {
        "true",
        "false",
        "yes",
        "no",
        "1",
        "0",
    }


def _is_integer(value: str) -> bool:
    try:
        int(value)
        return True
    except ValueError:
        return False


def _is_float(value: str) -> bool:
    try:
        float(value)
        return True
    except ValueError:
        return False


def _is_timestamp(value: str) -> bool:
    try:
        datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
        return True
    except ValueError:
        return False