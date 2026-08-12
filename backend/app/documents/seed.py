from datetime import (
    datetime,
    timezone,
)

from .service import (
    database,
    ensure_indexes,
)


def now():
    return datetime.now(
        timezone.utc
    )


def seed_documents():
    db = database()

    seed_data = {
        "telemetry_events": [
            {
                "system_key":
                    "ees_power_grid_sun",

                "asset_id":
                    "MAIN-SWGR-01",

                "metric":
                    "voltage",

                "value":
                    479.6,

                "unit":
                    "V",

                "timestamp":
                    now(),

                "tags": {
                    "facility":
                        "pharma-main",

                    "source":
                        "digital-twin",
                },
            },
            {
                "system_key":
                    "ees_rc_controls",

                "asset_id":
                    "RC-CTRL-01",

                "metric":
                    "temperature",

                "value":
                    31.8,

                "unit":
                    "C",

                "timestamp":
                    now(),

                "tags": {
                    "state":
                        "normal"
                },
            },
        ],

        "simulation_snapshots": [
            {
                "system_key":
                    "ees_power_grid_sun",

                "scenario":
                    "normal-load",

                "state": {
                    "voltage_v":
                        480.0,

                    "frequency_hz":
                        60.0,

                    "power_factor":
                        0.97,

                    "load_kw":
                        842.4,
                },

                "created_at":
                    now(),
            }
        ],

        "alert_events": [
            {
                "system_key":
                    "ees_power_grid_sun",

                "severity":
                    "warning",

                "code":
                    "PF_LOW",

                "message":
                    "Power factor below target.",

                "acknowledged":
                    False,

                "timestamp":
                    now(),
            }
        ],

        "diagnostic_payloads": [
            {
                "system_key":
                    "ees_rc_controls",

                "asset_id":
                    "RC-CTRL-01",

                "diagnostic_type":
                    "power-grid-request",

                "payload": {
                    "fault":
                        "none",

                    "voltage":
                        480,

                    "load_watts":
                        12850,

                    "power_factor":
                        0.96,
                },

                "created_at":
                    now(),
            }
        ],

        "ai_interactions": [
            {
                "system_key":
                    "smart-assistant-ai",

                "session_id":
                    "demo-session",

                "role":
                    "assistant",

                "content":
                    (
                        "EES Data Platform "
                        "status is nominal."
                    ),

                "context": {
                    "source":
                        "ees-universe",

                    "mode":
                        "demo",
                },

                "timestamp":
                    now(),
            }
        ],

        "application_logs": [
            {
                "service":
                    "ees-universal-data-moon",

                "level":
                    "INFO",

                "event":
                    "document-engine-started",

                "message":
                    (
                        "MongoDB document "
                        "engine initialized."
                    ),

                "metadata": {
                    "database":
                        "ees_documents"
                },

                "timestamp":
                    now(),
            }
        ],
    }

    for (
        collection_name,
        documents,
    ) in seed_data.items():

        collection = db[
            collection_name
        ]

        if (
            collection.count_documents(
                {}
            )
            == 0
        ):
            collection.insert_many(
                documents
            )

    ensure_indexes()

    print(
        "EES MongoDB seed complete."
    )


if __name__ == "__main__":
    seed_documents()