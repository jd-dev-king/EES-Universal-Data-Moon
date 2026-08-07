BEGIN;

-- ============================================================
-- EES DATA PLATFORM
-- PHARMA ANALYTICS LAYER
--
-- Source of truth:
--   pharma.*
--
-- Analytical consumer:
--   Manufacturing Analytics
--
-- Purpose:
--   Provide stable KPI and dashboard-ready views over
--   canonical Pharma process data.
-- ============================================================


-- ============================================================
-- 1. BATCH KPIs
-- ============================================================

CREATE OR REPLACE VIEW analytics.batch_kpis AS

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

    CASE
        WHEN b.target_quantity > 0
        THEN ROUND(
            (
                COALESCE(
                    b.actual_quantity,
                    0
                )
                / b.target_quantity
            ) * 100,
            2
        )
        ELSE NULL
    END AS batch_yield_pct,

    b.started_at,
    b.completed_at,
    b.released_at,

    CASE
        WHEN
            b.started_at IS NOT NULL
            AND b.completed_at IS NOT NULL
        THEN ROUND(
            EXTRACT(
                EPOCH FROM (
                    b.completed_at
                    - b.started_at
                )
            ) / 60.0,
            2
        )
        ELSE NULL
    END AS cycle_time_minutes,

    COUNT(
        DISTINCT pr.process_run_id
    ) AS process_runs,

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
            WHEN d.status NOT IN (
                'closed',
                'cancelled'
            )
            THEN d.deviation_id
        END
    ) AS open_deviations,

    COUNT(
        DISTINCT qr.quality_result_id
    ) AS quality_tests,

    COUNT(
        DISTINCT CASE
            WHEN qr.disposition = 'pass'
            THEN qr.quality_result_id
        END
    ) AS quality_passes,

    COUNT(
        DISTINCT CASE
            WHEN qr.disposition = 'fail'
            THEN qr.quality_result_id
        END
    ) AS quality_failures

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


COMMENT ON VIEW analytics.batch_kpis IS
'Batch-level KPI view for Manufacturing Analytics.';


-- ============================================================
-- 2. PROCESS PERFORMANCE
-- ============================================================

CREATE OR REPLACE VIEW analytics.process_performance AS

SELECT
    b.batch_id,
    b.batch_number,

    ps.sequence_number,
    ps.step_code,
    ps.step_name,
    ps.step_type,

    pr.process_run_id,
    pr.run_number,
    pr.status AS run_status,

    e.equipment_code,
    e.equipment_name,
    e.equipment_type,

    ps.target_duration_seconds,

    pr.actual_duration_seconds,

    CASE
        WHEN
            ps.target_duration_seconds > 0
            AND pr.actual_duration_seconds IS NOT NULL
        THEN ROUND(
            (
                pr.actual_duration_seconds::NUMERIC
                / ps.target_duration_seconds
            ) * 100,
            2
        )
        ELSE NULL
    END AS duration_vs_target_pct,

    CASE
        WHEN
            pr.actual_duration_seconds IS NOT NULL
            AND ps.target_duration_seconds IS NOT NULL
        THEN
            pr.actual_duration_seconds
            - ps.target_duration_seconds
        ELSE NULL
    END AS duration_variance_seconds,

    pr.started_at,
    pr.completed_at,
    pr.operator_name

FROM pharma.process_runs pr

JOIN pharma.batches b
    ON b.batch_id =
       pr.batch_id

JOIN pharma.process_steps ps
    ON ps.process_step_id =
       pr.process_step_id

LEFT JOIN pharma.equipment e
    ON e.equipment_id =
       pr.equipment_id;


COMMENT ON VIEW analytics.process_performance IS
'Process-step timing and equipment performance by batch.';


-- ============================================================
-- 3. CPP PERFORMANCE
-- ============================================================

CREATE OR REPLACE VIEW analytics.cpp_performance AS

SELECT
    b.batch_id,
    b.batch_number,

    ps.step_name,

    pr.process_run_id,

    e.equipment_code,

    pp.parameter_name,
    pp.parameter_type,

    pp.target_value,
    pp.actual_value,

    pp.lower_limit,
    pp.upper_limit,

    pp.unit_of_measure,

    pp.within_spec,

    CASE
        WHEN pp.within_spec = TRUE
        THEN 'in-spec'

        WHEN pp.within_spec = FALSE
        THEN 'out-of-spec'

        ELSE 'unknown'
    END AS conformance_status,

    CASE
        WHEN
            pp.actual_value IS NOT NULL
            AND pp.target_value IS NOT NULL
        THEN
            pp.actual_value
            - pp.target_value
        ELSE NULL
    END AS deviation_from_target,

    pp.recorded_at

FROM pharma.process_parameters pp

JOIN pharma.process_runs pr
    ON pr.process_run_id =
       pp.process_run_id

JOIN pharma.batches b
    ON b.batch_id =
       pr.batch_id

JOIN pharma.process_steps ps
    ON ps.process_step_id =
       pr.process_step_id

LEFT JOIN pharma.equipment e
    ON e.equipment_id =
       pr.equipment_id;


COMMENT ON VIEW analytics.cpp_performance IS
'Critical process parameter performance and conformance status.';


-- ============================================================
-- 4. QUALITY PERFORMANCE
-- ============================================================

CREATE OR REPLACE VIEW analytics.quality_performance AS

SELECT
    b.batch_id,
    b.batch_number,

    qr.quality_result_id,

    qr.test_name,
    qr.test_method,
    qr.sample_id,

    qr.result_numeric,
    qr.result_text,

    qr.lower_spec_limit,
    qr.upper_spec_limit,

    qr.unit_of_measure,

    qr.disposition,

    CASE
        WHEN qr.disposition = 'pass'
        THEN TRUE

        WHEN qr.disposition = 'fail'
        THEN FALSE

        ELSE NULL
    END AS passed,

    qr.tested_at,
    qr.analyst_name

FROM pharma.quality_results qr

JOIN pharma.batches b
    ON b.batch_id =
       qr.batch_id;


COMMENT ON VIEW analytics.quality_performance IS
'Batch-level quality test results for analytics and KPI dashboards.';


-- ============================================================
-- 5. DEVIATION SUMMARY
-- ============================================================

CREATE OR REPLACE VIEW analytics.deviation_summary AS

SELECT
    b.batch_id,
    b.batch_number,

    d.deviation_id,
    d.deviation_number,

    d.severity,
    d.category,

    d.description,

    d.status,

    d.opened_at,
    d.closed_at,

    CASE
        WHEN
            d.opened_at IS NOT NULL
            AND d.closed_at IS NOT NULL
        THEN ROUND(
            EXTRACT(
                EPOCH FROM (
                    d.closed_at
                    - d.opened_at
                )
            ) / 60.0,
            2
        )
        ELSE NULL
    END AS resolution_minutes,

    d.root_cause,
    d.corrective_action,

    e.equipment_code,

    ps.step_name

FROM pharma.deviations d

LEFT JOIN pharma.batches b
    ON b.batch_id =
       d.batch_id

LEFT JOIN pharma.equipment e
    ON e.equipment_id =
       d.equipment_id

LEFT JOIN pharma.process_runs pr
    ON pr.process_run_id =
       d.process_run_id

LEFT JOIN pharma.process_steps ps
    ON ps.process_step_id =
       pr.process_step_id;


COMMENT ON VIEW analytics.deviation_summary IS
'Deviation, severity, resolution time, root-cause, and process context.';


-- ============================================================
-- 6. PACKAGING PERFORMANCE
-- ============================================================

CREATE OR REPLACE VIEW analytics.packaging_performance AS

SELECT
    b.batch_id,
    b.batch_number,

    pr.packaging_record_id,

    pr.packaging_line,
    pr.package_type,

    pr.target_units,
    pr.produced_units,
    pr.rejected_units,

    CASE
        WHEN pr.target_units > 0
        THEN ROUND(
            (
                pr.produced_units::NUMERIC
                / pr.target_units
            ) * 100,
            2
        )
        ELSE NULL
    END AS packaging_yield_pct,

    CASE
        WHEN
            (
                COALESCE(
                    pr.produced_units,
                    0
                )
                +
                COALESCE(
                    pr.rejected_units,
                    0
                )
            ) > 0
        THEN ROUND(
            (
                pr.rejected_units::NUMERIC
                /
                (
                    pr.produced_units
                    + pr.rejected_units
                )
            ) * 100,
            2
        )
        ELSE NULL
    END AS reject_rate_pct,

    pr.status,

    pr.started_at,
    pr.completed_at,

    e.equipment_code,
    e.equipment_name

FROM pharma.packaging_records pr

JOIN pharma.batches b
    ON b.batch_id =
       pr.batch_id

LEFT JOIN pharma.equipment e
    ON e.equipment_id =
       pr.equipment_id;


COMMENT ON VIEW analytics.packaging_performance IS
'Packaging output, yield, reject rate, and equipment context.';


-- ============================================================
-- 7. MATERIAL PERFORMANCE
-- ============================================================

CREATE OR REPLACE VIEW analytics.material_performance AS

SELECT
    b.batch_id,
    b.batch_number,

    m.material_code,
    m.material_name,

    bm.required_quantity,
    bm.actual_quantity,
    bm.unit_of_measure,

    CASE
        WHEN bm.required_quantity > 0
        THEN ROUND(
            (
                COALESCE(
                    bm.actual_quantity,
                    0
                )
                / bm.required_quantity
            ) * 100,
            2
        )
        ELSE NULL
    END AS fulfillment_pct,

    bm.weighing_status,

    ml.internal_lot_number,

    mr.request_number,

    mrl.status
        AS supply_line_status,

    bm.weighed_at

FROM pharma.batch_materials bm

JOIN pharma.batches b
    ON b.batch_id =
       bm.batch_id

JOIN pharma.materials m
    ON m.material_id =
       bm.material_id

LEFT JOIN supply.material_lots ml
    ON ml.material_lot_id =
       bm.supply_material_lot_id

LEFT JOIN supply.material_request_lines mrl
    ON mrl.pharma_batch_material_id =
       bm.batch_material_id

LEFT JOIN supply.material_requests mr
    ON mr.material_request_id =
       mrl.material_request_id;


COMMENT ON VIEW analytics.material_performance IS
'Supply-to-Pharma material fulfillment and weighing performance.';


-- ============================================================
-- 8. EQUIPMENT PERFORMANCE
-- ============================================================

CREATE OR REPLACE VIEW analytics.equipment_performance AS

SELECT
    e.equipment_id,
    e.equipment_code,
    e.equipment_name,
    e.equipment_type,
    e.area,

    e.status AS equipment_status,

    COUNT(
        pr.process_run_id
    ) AS total_runs,

    COUNT(
        CASE
            WHEN pr.status = 'completed'
            THEN 1
        END
    ) AS completed_runs,

    COUNT(
        CASE
            WHEN pr.status = 'failed'
            THEN 1
        END
    ) AS failed_runs,

    COALESCE(
        SUM(
            pr.actual_duration_seconds
        ),
        0
    ) AS total_runtime_seconds,

    ROUND(
        COALESCE(
            AVG(
                pr.actual_duration_seconds
            ),
            0
        ),
        2
    ) AS average_run_seconds,

    COUNT(
        DISTINCT d.deviation_id
    ) AS deviation_count,

    e.last_calibration_at,
    e.next_calibration_due

FROM pharma.equipment e

LEFT JOIN pharma.process_runs pr
    ON pr.equipment_id =
       e.equipment_id

LEFT JOIN pharma.deviations d
    ON d.equipment_id =
       e.equipment_id

GROUP BY
    e.equipment_id,
    e.equipment_code,
    e.equipment_name,
    e.equipment_type,
    e.area,
    e.status,
    e.last_calibration_at,
    e.next_calibration_due;


COMMENT ON VIEW analytics.equipment_performance IS
'Equipment runtime, run status, deviation count, and calibration context.';


-- ============================================================
-- 9. PRODUCTION DASHBOARD
--
-- One row per batch.
-- Intended as the first Manufacturing Analytics dashboard feed.
-- ============================================================

CREATE OR REPLACE VIEW analytics.production_dashboard AS

WITH cpp AS (

    SELECT
        batch_id,

        COUNT(*) AS cpp_count,

        COUNT(
            CASE
                WHEN within_spec = TRUE
                THEN 1
            END
        ) AS cpp_in_spec,

        COUNT(
            CASE
                WHEN within_spec = FALSE
                THEN 1
            END
        ) AS cpp_out_of_spec

    FROM analytics.cpp_performance

    GROUP BY
        batch_id
),

quality AS (

    SELECT
        batch_id,

        COUNT(*) AS quality_test_count,

        COUNT(
            CASE
                WHEN disposition = 'pass'
                THEN 1
            END
        ) AS quality_pass_count,

        COUNT(
            CASE
                WHEN disposition = 'fail'
                THEN 1
            END
        ) AS quality_fail_count

    FROM analytics.quality_performance

    GROUP BY
        batch_id
),

packaging AS (

    SELECT
        batch_id,

        SUM(
            target_units
        ) AS target_units,

        SUM(
            produced_units
        ) AS produced_units,

        SUM(
            rejected_units
        ) AS rejected_units

    FROM pharma.packaging_records

    GROUP BY
        batch_id
),

materials AS (

    SELECT
        batch_id,

        COUNT(*) AS material_count,

        COUNT(
            CASE
                WHEN weighing_status = 'verified'
                THEN 1
            END
        ) AS verified_material_count

    FROM pharma.batch_materials

    GROUP BY
        batch_id
)

SELECT
    bk.batch_id,
    bk.batch_number,

    bk.po_number,

    bk.product_code,
    bk.product_name,

    bk.batch_status,

    bk.target_quantity,
    bk.actual_quantity,

    bk.batch_yield_pct,

    bk.cycle_time_minutes,

    bk.process_runs,
    bk.completed_process_runs,

    bk.deviation_count,
    bk.open_deviations,

    COALESCE(
        cpp.cpp_count,
        0
    ) AS cpp_count,

    COALESCE(
        cpp.cpp_in_spec,
        0
    ) AS cpp_in_spec,

    COALESCE(
        cpp.cpp_out_of_spec,
        0
    ) AS cpp_out_of_spec,

    CASE
        WHEN
            COALESCE(
                cpp.cpp_count,
                0
            ) > 0
        THEN ROUND(
            (
                cpp.cpp_in_spec::NUMERIC
                / cpp.cpp_count
            ) * 100,
            2
        )
        ELSE NULL
    END AS cpp_conformance_pct,

    COALESCE(
        quality.quality_test_count,
        0
    ) AS quality_test_count,

    COALESCE(
        quality.quality_pass_count,
        0
    ) AS quality_pass_count,

    COALESCE(
        quality.quality_fail_count,
        0
    ) AS quality_fail_count,

    CASE
        WHEN
            COALESCE(
                quality.quality_test_count,
                0
            ) > 0
        THEN ROUND(
            (
                quality.quality_pass_count::NUMERIC
                /
                quality.quality_test_count
            ) * 100,
            2
        )
        ELSE NULL
    END AS quality_pass_rate_pct,

    COALESCE(
        packaging.target_units,
        0
    ) AS packaging_target_units,

    COALESCE(
        packaging.produced_units,
        0
    ) AS packaging_produced_units,

    COALESCE(
        packaging.rejected_units,
        0
    ) AS packaging_rejected_units,

    CASE
        WHEN
            (
                COALESCE(
                    packaging.produced_units,
                    0
                )
                +
                COALESCE(
                    packaging.rejected_units,
                    0
                )
            ) > 0
        THEN ROUND(
            (
                packaging.rejected_units::NUMERIC
                /
                (
                    packaging.produced_units
                    +
                    packaging.rejected_units
                )
            ) * 100,
            2
        )
        ELSE NULL
    END AS packaging_reject_rate_pct,

    COALESCE(
        materials.material_count,
        0
    ) AS material_count,

    COALESCE(
        materials.verified_material_count,
        0
    ) AS verified_material_count,

    CASE
        WHEN
            COALESCE(
                materials.material_count,
                0
            ) > 0
        THEN ROUND(
            (
                materials.verified_material_count::NUMERIC
                /
                materials.material_count
            ) * 100,
            2
        )
        ELSE NULL
    END AS material_fulfillment_pct,

    bk.started_at,
    bk.completed_at,
    bk.released_at

FROM analytics.batch_kpis bk

LEFT JOIN cpp
    ON cpp.batch_id =
       bk.batch_id

LEFT JOIN quality
    ON quality.batch_id =
       bk.batch_id

LEFT JOIN packaging
    ON packaging.batch_id =
       bk.batch_id

LEFT JOIN materials
    ON materials.batch_id =
       bk.batch_id;


COMMENT ON VIEW analytics.production_dashboard IS
'Primary Pharma KPI feed for Manufacturing Analytics.';


-- ============================================================
-- 10. PROCESS HEALTH
--
-- Simple status classification suitable for dashboard badges.
-- ============================================================

CREATE OR REPLACE VIEW analytics.process_health AS

SELECT
    pd.*,

    CASE
        WHEN
            pd.open_deviations > 0
        THEN 'attention'

        WHEN
            pd.quality_fail_count > 0
        THEN 'critical'

        WHEN
            pd.cpp_out_of_spec > 0
        THEN 'warning'

        WHEN
            pd.batch_status = 'released'
        THEN 'healthy'

        ELSE 'in-process'
    END AS process_health_status

FROM analytics.production_dashboard pd;


COMMENT ON VIEW analytics.process_health IS
'Batch process-health classification derived from quality, CPP, deviation, and lifecycle status.';


-- ============================================================
-- 11. DATA LINEAGE
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

    'pharma.process_parameters',

    'Manufacturing Analytics',

    'analytics.cpp_performance',

    'analytics-view',

    'Critical process parameters transformed into dashboard-ready conformance analytics.'

WHERE NOT EXISTS (
    SELECT 1
    FROM integration.data_lineage
    WHERE
        source_system =
            'Pharma Process Twin'
        AND source_dataset =
            'pharma.process_parameters'
        AND target_system =
            'Manufacturing Analytics'
        AND target_dataset =
            'analytics.cpp_performance'
);


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

    'analytics.production_dashboard',

    'analytics-view',

    'Canonical Pharma batch, quality, packaging, material, deviation, and CPP data consolidated into the primary Manufacturing Analytics dashboard feed.'

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
            'analytics.production_dashboard'
);


COMMIT;