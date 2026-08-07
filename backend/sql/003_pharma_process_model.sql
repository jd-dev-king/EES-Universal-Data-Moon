BEGIN;

-- ============================================================
-- EES DATA PLATFORM
-- CANONICAL PHARMA PROCESS MODEL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.products (
    product_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    product_code VARCHAR(100) NOT NULL UNIQUE,

    product_name VARCHAR(200) NOT NULL,

    dosage_form VARCHAR(100),

    strength VARCHAR(100),

    unit_of_measure VARCHAR(50),

    description TEXT,

    active BOOLEAN NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);


-- ============================================================
-- MATERIALS
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.materials (
    material_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    material_code VARCHAR(100) NOT NULL UNIQUE,

    material_name VARCHAR(200) NOT NULL,

    material_type VARCHAR(50) NOT NULL,

    unit_of_measure VARCHAR(50) NOT NULL,

    specification_reference VARCHAR(150),

    supplier_name VARCHAR(200),

    lot_controlled BOOLEAN NOT NULL
        DEFAULT TRUE,

    active BOOLEAN NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT pharma_material_type_check
        CHECK (
            material_type IN (
                'api',
                'excipient',
                'packaging',
                'cleaning',
                'processing-aid',
                'other'
            )
        )
);


-- ============================================================
-- EQUIPMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.equipment (
    equipment_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    equipment_code VARCHAR(100) NOT NULL UNIQUE,

    equipment_name VARCHAR(200) NOT NULL,

    equipment_type VARCHAR(100) NOT NULL,

    area VARCHAR(100),

    manufacturer VARCHAR(150),

    model VARCHAR(150),

    serial_number VARCHAR(150),

    status VARCHAR(50) NOT NULL
        DEFAULT 'available',

    last_calibration_at TIMESTAMPTZ,

    next_calibration_due TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT pharma_equipment_status_check
        CHECK (
            status IN (
                'available',
                'running',
                'cleaning',
                'maintenance',
                'calibration',
                'out-of-service'
            )
        )
);


-- ============================================================
-- PRODUCTION ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.production_orders (
    production_order_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    po_number VARCHAR(100) NOT NULL UNIQUE,

    product_id UUID NOT NULL
        REFERENCES pharma.products(product_id),

    planned_quantity NUMERIC(18,4) NOT NULL,

    unit_of_measure VARCHAR(50) NOT NULL,

    planned_start_at TIMESTAMPTZ,

    planned_end_at TIMESTAMPTZ,

    status VARCHAR(50) NOT NULL
        DEFAULT 'planned',

    source_system VARCHAR(100)
        DEFAULT 'pharma-process-twin',

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT pharma_production_order_status_check
        CHECK (
            status IN (
                'planned',
                'released',
                'in-progress',
                'completed',
                'cancelled',
                'on-hold'
            )
        )
);


CREATE INDEX IF NOT EXISTS
    idx_pharma_production_orders_product
ON pharma.production_orders(product_id);


-- ============================================================
-- BATCHES
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.batches (
    batch_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    batch_number VARCHAR(100) NOT NULL UNIQUE,

    production_order_id UUID NOT NULL
        REFERENCES pharma.production_orders(
            production_order_id
        ),

    product_id UUID NOT NULL
        REFERENCES pharma.products(product_id),

    target_quantity NUMERIC(18,4) NOT NULL,

    actual_quantity NUMERIC(18,4),

    unit_of_measure VARCHAR(50) NOT NULL,

    status VARCHAR(50) NOT NULL
        DEFAULT 'created',

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    released_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT pharma_batch_status_check
        CHECK (
            status IN (
                'created',
                'weighing',
                'mixing',
                'processing',
                'holding',
                'packaging',
                'quality-review',
                'released',
                'rejected',
                'on-hold',
                'completed'
            )
        )
);


CREATE INDEX IF NOT EXISTS
    idx_pharma_batches_production_order
ON pharma.batches(production_order_id);

CREATE INDEX IF NOT EXISTS
    idx_pharma_batches_product
ON pharma.batches(product_id);

CREATE INDEX IF NOT EXISTS
    idx_pharma_batches_status
ON pharma.batches(status);


-- ============================================================
-- BATCH MATERIALS
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.batch_materials (
    batch_material_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    batch_id UUID NOT NULL
        REFERENCES pharma.batches(batch_id)
        ON DELETE CASCADE,

    material_id UUID NOT NULL
        REFERENCES pharma.materials(material_id),

    material_lot VARCHAR(100),

    required_quantity NUMERIC(18,4) NOT NULL,

    actual_quantity NUMERIC(18,4),

    unit_of_measure VARCHAR(50) NOT NULL,

    weighing_status VARCHAR(50) NOT NULL
        DEFAULT 'pending',

    weighed_at TIMESTAMPTZ,

    verified_by VARCHAR(150),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT pharma_batch_material_status_check
        CHECK (
            weighing_status IN (
                'pending',
                'weighed',
                'verified',
                'rejected'
            )
        )
);


CREATE INDEX IF NOT EXISTS
    idx_pharma_batch_materials_batch
ON pharma.batch_materials(batch_id);


-- ============================================================
-- PROCESS STEPS
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.process_steps (
    process_step_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL
        REFERENCES pharma.products(product_id),

    step_code VARCHAR(100) NOT NULL,

    step_name VARCHAR(200) NOT NULL,

    sequence_number INTEGER NOT NULL,

    step_type VARCHAR(100) NOT NULL,

    target_duration_seconds INTEGER,

    instructions TEXT,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT pharma_process_step_unique
        UNIQUE (
            product_id,
            step_code
        )
);


CREATE INDEX IF NOT EXISTS
    idx_pharma_process_steps_product
ON pharma.process_steps(product_id);


-- ============================================================
-- PROCESS RUNS
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.process_runs (
    process_run_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    batch_id UUID NOT NULL
        REFERENCES pharma.batches(batch_id)
        ON DELETE CASCADE,

    process_step_id UUID NOT NULL
        REFERENCES pharma.process_steps(
            process_step_id
        ),

    equipment_id UUID
        REFERENCES pharma.equipment(
            equipment_id
        ),

    run_number INTEGER NOT NULL
        DEFAULT 1,

    status VARCHAR(50) NOT NULL
        DEFAULT 'pending',

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    actual_duration_seconds INTEGER,

    operator_name VARCHAR(150),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT pharma_process_run_status_check
        CHECK (
            status IN (
                'pending',
                'running',
                'completed',
                'failed',
                'paused',
                'cancelled'
            )
        )
);


CREATE INDEX IF NOT EXISTS
    idx_pharma_process_runs_batch
ON pharma.process_runs(batch_id);

CREATE INDEX IF NOT EXISTS
    idx_pharma_process_runs_equipment
ON pharma.process_runs(equipment_id);


-- ============================================================
-- PROCESS PARAMETERS
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.process_parameters (
    process_parameter_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    process_run_id UUID NOT NULL
        REFERENCES pharma.process_runs(
            process_run_id
        )
        ON DELETE CASCADE,

    parameter_name VARCHAR(150) NOT NULL,

    parameter_type VARCHAR(100),

    target_value NUMERIC(18,6),

    actual_value NUMERIC(18,6),

    lower_limit NUMERIC(18,6),

    upper_limit NUMERIC(18,6),

    unit_of_measure VARCHAR(50),

    within_spec BOOLEAN,

    recorded_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
    idx_pharma_process_parameters_run
ON pharma.process_parameters(process_run_id);

CREATE INDEX IF NOT EXISTS
    idx_pharma_process_parameters_name
ON pharma.process_parameters(parameter_name);


-- ============================================================
-- QUALITY RESULTS
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.quality_results (
    quality_result_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    batch_id UUID NOT NULL
        REFERENCES pharma.batches(batch_id)
        ON DELETE CASCADE,

    test_name VARCHAR(150) NOT NULL,

    test_method VARCHAR(150),

    sample_id VARCHAR(100),

    result_numeric NUMERIC(18,6),

    result_text TEXT,

    lower_spec_limit NUMERIC(18,6),

    upper_spec_limit NUMERIC(18,6),

    unit_of_measure VARCHAR(50),

    disposition VARCHAR(50) NOT NULL
        DEFAULT 'pending',

    tested_at TIMESTAMPTZ,

    analyst_name VARCHAR(150),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT pharma_quality_disposition_check
        CHECK (
            disposition IN (
                'pending',
                'pass',
                'fail',
                'invalid',
                'retest'
            )
        )
);


CREATE INDEX IF NOT EXISTS
    idx_pharma_quality_results_batch
ON pharma.quality_results(batch_id);

CREATE INDEX IF NOT EXISTS
    idx_pharma_quality_results_disposition
ON pharma.quality_results(disposition);


-- ============================================================
-- DEVIATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.deviations (
    deviation_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    deviation_number VARCHAR(100) NOT NULL UNIQUE,

    batch_id UUID
        REFERENCES pharma.batches(batch_id),

    process_run_id UUID
        REFERENCES pharma.process_runs(
            process_run_id
        ),

    equipment_id UUID
        REFERENCES pharma.equipment(
            equipment_id
        ),

    severity VARCHAR(50) NOT NULL,

    category VARCHAR(100),

    description TEXT NOT NULL,

    status VARCHAR(50) NOT NULL
        DEFAULT 'open',

    opened_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    closed_at TIMESTAMPTZ,

    root_cause TEXT,

    corrective_action TEXT,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT pharma_deviation_severity_check
        CHECK (
            severity IN (
                'minor',
                'major',
                'critical'
            )
        ),

    CONSTRAINT pharma_deviation_status_check
        CHECK (
            status IN (
                'open',
                'investigating',
                'capa',
                'closed',
                'cancelled'
            )
        )
);


CREATE INDEX IF NOT EXISTS
    idx_pharma_deviations_batch
ON pharma.deviations(batch_id);

CREATE INDEX IF NOT EXISTS
    idx_pharma_deviations_status
ON pharma.deviations(status);


-- ============================================================
-- PACKAGING RECORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS pharma.packaging_records (
    packaging_record_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    batch_id UUID NOT NULL
        REFERENCES pharma.batches(batch_id)
        ON DELETE CASCADE,

    equipment_id UUID
        REFERENCES pharma.equipment(
            equipment_id
        ),

    packaging_line VARCHAR(100),

    package_type VARCHAR(100),

    target_units BIGINT,

    produced_units BIGINT,

    rejected_units BIGINT NOT NULL
        DEFAULT 0,

    status VARCHAR(50) NOT NULL
        DEFAULT 'pending',

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT pharma_packaging_status_check
        CHECK (
            status IN (
                'pending',
                'running',
                'completed',
                'paused',
                'failed'
            )
        )
);


CREATE INDEX IF NOT EXISTS
    idx_pharma_packaging_batch
ON pharma.packaging_records(batch_id);


-- ============================================================
-- OPERATIONAL EVENT VIEW
-- ============================================================

CREATE OR REPLACE VIEW pharma.batch_process_summary AS

SELECT
    b.batch_id,
    b.batch_number,

    po.po_number,

    p.product_code,
    p.product_name,

    b.status AS batch_status,

    b.target_quantity,
    b.actual_quantity,
    b.unit_of_measure,

    b.started_at,
    b.completed_at,
    b.released_at,

    COUNT(
        DISTINCT pr.process_run_id
    ) AS process_run_count,

    COUNT(
        DISTINCT CASE
            WHEN pr.status = 'completed'
            THEN pr.process_run_id
        END
    ) AS completed_process_runs,

    COUNT(
        DISTINCT d.deviation_id
    ) AS deviation_count,

    COUNT(
        DISTINCT CASE
            WHEN qr.disposition = 'fail'
            THEN qr.quality_result_id
        END
    ) AS failed_quality_tests

FROM pharma.batches b

JOIN pharma.production_orders po
    ON po.production_order_id =
       b.production_order_id

JOIN pharma.products p
    ON p.product_id =
       b.product_id

LEFT JOIN pharma.process_runs pr
    ON pr.batch_id =
       b.batch_id

LEFT JOIN pharma.deviations d
    ON d.batch_id =
       b.batch_id

LEFT JOIN pharma.quality_results qr
    ON qr.batch_id =
       b.batch_id

GROUP BY
    b.batch_id,
    b.batch_number,
    po.po_number,
    p.product_code,
    p.product_name,
    b.status,
    b.target_quantity,
    b.actual_quantity,
    b.unit_of_measure,
    b.started_at,
    b.completed_at,
    b.released_at;


COMMENT ON VIEW pharma.batch_process_summary IS
'Batch-level operational summary used by Pharma Data Nexus and Manufacturing Analytics.';


-- ============================================================
-- DATA LINEAGE REGISTRATION
-- ============================================================

INSERT INTO integration.data_lineage (
    lineage_id,
    source_system,
    source_dataset,
    target_system,
    target_dataset,
    transformation_type,
    description
)
SELECT
    gen_random_uuid(),

    'Pharma Process Twin',

    'pharma.batches',

    'Manufacturing Analytics',

    'pharma.batch_process_summary',

    'aggregation',

    'Batch and process execution data summarized for manufacturing KPI and chart consumption.'

WHERE NOT EXISTS (
    SELECT 1
    FROM integration.data_lineage
    WHERE
        source_system =
            'Pharma Process Twin'
        AND source_dataset =
            'pharma.batches'
        AND target_system =
            'Manufacturing Analytics'
        AND target_dataset =
            'pharma.batch_process_summary'
);


COMMIT;