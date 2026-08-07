BEGIN;

-- ============================================================
-- EES DATA PLATFORM
-- Canonical Domain Schemas
-- ============================================================


-- ------------------------------------------------------------
-- PHARMA
-- Source of truth for pharmaceutical process operations,
-- batches, materials, equipment, quality, deviations,
-- packaging, and process execution.
-- ------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS pharma;

COMMENT ON SCHEMA pharma IS
'Canonical pharmaceutical manufacturing process data for the EES Universe.';


-- ------------------------------------------------------------
-- SUPPLY
-- Materials, inventory, purchasing, warehouse operations,
-- weighing, production-order fulfillment, and logistics.
-- ------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS supply;

COMMENT ON SCHEMA supply IS
'Canonical supply, warehouse, material, and production logistics data for the EES Universe.';


-- ------------------------------------------------------------
-- POWER GRID
-- Generation, consumption, telemetry, diagnostics,
-- forecasting, and facility energy data.
-- ------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS power_grid;

COMMENT ON SCHEMA power_grid IS
'Canonical power, energy, telemetry, and diagnostics data for the EES Universe.';


-- ------------------------------------------------------------
-- RC CONTROLS
-- Control-system inputs, outputs, state, alarms,
-- commands, control parameters, and control history.
-- ------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS rc_controls;

COMMENT ON SCHEMA rc_controls IS
'Canonical control-system state, commands, parameters, alarms, and history for EES RC Controls.';


-- ------------------------------------------------------------
-- ANALYTICS
-- Derived KPIs and cross-domain analytical products.
--
-- IMPORTANT:
-- This schema should generally contain derived information,
-- not authoritative transactional process records.
-- ------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS analytics;

COMMENT ON SCHEMA analytics IS
'Derived KPIs, analytics, asset health, anomaly results, and cross-domain intelligence for the EES Universe.';


-- ------------------------------------------------------------
-- INTEGRATION
-- Shared event, lineage, synchronization, and integration
-- records connecting EES systems.
-- ------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS integration;

COMMENT ON SCHEMA integration IS
'Cross-system events, synchronization state, lineage, and integration metadata for the EES Universe.';


-- ============================================================
-- PLATFORM METADATA
-- ============================================================

CREATE TABLE IF NOT EXISTS integration.platform_schema_registry (
    schema_name VARCHAR(100) PRIMARY KEY,

    domain_name VARCHAR(150) NOT NULL,

    role VARCHAR(150) NOT NULL,

    description TEXT,

    authoritative BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);


INSERT INTO integration.platform_schema_registry (
    schema_name,
    domain_name,
    role,
    description,
    authoritative
)
VALUES

(
    'pharma',
    'pharmaceutical-manufacturing',
    'process-system-of-record',
    'Canonical pharmaceutical process, batch, quality, equipment, and manufacturing data.',
    TRUE
),

(
    'supply',
    'supply-chain',
    'supply-system-of-record',
    'Canonical material, purchasing, inventory, warehouse, and logistics data.',
    TRUE
),

(
    'power_grid',
    'energy',
    'energy-system-of-record',
    'Canonical EES power generation, consumption, telemetry, forecasting, and diagnostics data.',
    TRUE
),

(
    'rc_controls',
    'controls',
    'control-system-of-record',
    'Canonical control state, commands, alarms, parameters, and controller history.',
    TRUE
),

(
    'analytics',
    'analytics',
    'derived-analytics',
    'Derived KPIs, asset health, anomaly detection, trends, and cross-domain analytical products.',
    FALSE
),

(
    'integration',
    'integration',
    'platform-integration',
    'Shared event, lineage, synchronization, and integration services.',
    FALSE
)

ON CONFLICT (schema_name)
DO UPDATE SET

    domain_name =
        EXCLUDED.domain_name,

    role =
        EXCLUDED.role,

    description =
        EXCLUDED.description,

    authoritative =
        EXCLUDED.authoritative,

    updated_at =
        NOW();


-- ============================================================
-- INTEGRATION EVENT FOUNDATION
-- ============================================================
--
-- We are creating only the shared foundation here.
-- Individual Pharma/Supply/Power/Controls tables come later.
-- ============================================================


CREATE TABLE IF NOT EXISTS integration.system_events (
    event_id UUID PRIMARY KEY,

    source_system VARCHAR(150) NOT NULL,

    event_type VARCHAR(150) NOT NULL,

    domain VARCHAR(100) NOT NULL,

    entity_type VARCHAR(100),

    entity_id VARCHAR(200),

    event_timestamp TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    payload JSONB NOT NULL
        DEFAULT '{}'::JSONB,

    correlation_id UUID,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
    idx_system_events_source
ON integration.system_events (
    source_system
);


CREATE INDEX IF NOT EXISTS
    idx_system_events_type
ON integration.system_events (
    event_type
);


CREATE INDEX IF NOT EXISTS
    idx_system_events_timestamp
ON integration.system_events (
    event_timestamp DESC
);


CREATE INDEX IF NOT EXISTS
    idx_system_events_correlation
ON integration.system_events (
    correlation_id
);


-- ============================================================
-- DATA LINEAGE FOUNDATION
-- ============================================================


CREATE TABLE IF NOT EXISTS integration.data_lineage (
    lineage_id UUID PRIMARY KEY,

    source_system VARCHAR(150) NOT NULL,

    source_dataset VARCHAR(250) NOT NULL,

    target_system VARCHAR(150) NOT NULL,

    target_dataset VARCHAR(250) NOT NULL,

    transformation_type VARCHAR(100),

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
    idx_data_lineage_source
ON integration.data_lineage (
    source_system,
    source_dataset
);


CREATE INDEX IF NOT EXISTS
    idx_data_lineage_target
ON integration.data_lineage (
    target_system,
    target_dataset
);


-- ============================================================
-- SYNCHRONIZATION FOUNDATION
-- ============================================================


CREATE TABLE IF NOT EXISTS integration.system_sync_state (
    sync_id UUID PRIMARY KEY,

    system_key VARCHAR(150) NOT NULL,

    dataset_key VARCHAR(250),

    sync_direction VARCHAR(30) NOT NULL,

    last_success_at TIMESTAMPTZ,

    last_attempt_at TIMESTAMPTZ,

    last_status VARCHAR(30) NOT NULL
        DEFAULT 'never',

    records_processed BIGINT NOT NULL
        DEFAULT 0,

    last_error TEXT,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT system_sync_direction_check
        CHECK (
            sync_direction IN (
                'inbound',
                'outbound',
                'bidirectional'
            )
        ),

    CONSTRAINT system_sync_status_check
        CHECK (
            last_status IN (
                'never',
                'success',
                'failed',
                'partial',
                'running'
            )
        )
);


CREATE INDEX IF NOT EXISTS
    idx_system_sync_system
ON integration.system_sync_state (
    system_key
);


COMMIT;