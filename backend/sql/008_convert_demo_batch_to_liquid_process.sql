BEGIN;

-- ============================================================
-- EES DATA PLATFORM
-- CONVERT DEMO PHARMA BATCH FROM TABLET TO LIQUID PROCESS
--
-- Preserves:
--   PPO-2026-0001
--   BATCH-2026-0001
--   MR-2026-0001
--
-- Converts the canonical demo process to a liquid plant model.
-- ============================================================


DO $$
DECLARE
    v_product_id UUID;
    v_batch_id UUID;

    v_mix_run_id UUID;
    v_hold_run_id UUID;
    v_pack_run_id UUID;

BEGIN

    -- ========================================================
    -- 1. RESOLVE PRODUCT + BATCH
    -- ========================================================

    SELECT
        b.batch_id,
        b.product_id
    INTO
        v_batch_id,
        v_product_id
    FROM pharma.batches b
    WHERE
        b.batch_number =
            'BATCH-2026-0001'
    LIMIT 1;


    IF v_batch_id IS NULL THEN
        RAISE EXCEPTION
            'BATCH-2026-0001 does not exist.';
    END IF;


    -- ========================================================
    -- 2. CONVERT PRODUCT TO LIQUID DOSAGE FORM
    -- ========================================================

    UPDATE pharma.products
    SET
        product_code =
            'EES-LIQ-100',

        product_name =
            'EES Demonstration Oral Liquid',

        dosage_form =
            'Oral Solution',

        strength =
            '100 mg / 5 mL',

        unit_of_measure =
            'L',

        description =
            'Canonical EES liquid pharmaceutical demonstration product used across Supply Nexus, Pharma Process Twin, and Manufacturing Analytics.',

        updated_at =
            NOW()

    WHERE
        product_id =
            v_product_id;


    -- ========================================================
    -- 3. CONVERT PRODUCTION ORDER TO LIQUID VOLUME
    -- ========================================================

    UPDATE pharma.production_orders
    SET
        planned_quantity =
            1000.0000,

        unit_of_measure =
            'L',

        updated_at =
            NOW()

    WHERE
        production_order_id = (
            SELECT production_order_id
            FROM pharma.batches
            WHERE batch_id =
                v_batch_id
        );


    -- ========================================================
    -- 4. CONVERT BATCH TO LIQUID VOLUME
    -- ========================================================

    UPDATE pharma.batches
    SET
        target_quantity =
            1000.0000,

        actual_quantity =
            995.0000,

        unit_of_measure =
            'L',

        updated_at =
            NOW()

    WHERE
        batch_id =
            v_batch_id;


    -- ========================================================
    -- 5. UPDATE PROCESS STEP NAMES / INSTRUCTIONS
    -- ========================================================

    UPDATE pharma.process_steps
    SET
        step_name =
            'Liquid Batch Mixing',

        step_type =
            'mixing',

        target_duration_seconds =
            1800,

        instructions =
            'Charge verified ingredients, mix liquid batch at approved agitation speed, temperature, pH, and viscosity conditions.',

        updated_at =
            NOW()

    WHERE
        product_id =
            v_product_id
        AND step_code =
            'MIX-001';


    UPDATE pharma.process_steps
    SET
        step_name =
            'Liquid Intermediate Hold',

        step_type =
            'holding',

        target_duration_seconds =
            900,

        instructions =
            'Transfer finished bulk liquid to validated hold tank and maintain approved hold temperature and time.',

        updated_at =
            NOW()

    WHERE
        product_id =
            v_product_id
        AND step_code =
            'HOLD-001';


    UPDATE pharma.process_steps
    SET
        step_name =
            'Bottle Filling and Packaging',

        step_type =
            'packaging',

        target_duration_seconds =
            2400,

        instructions =
            'Fill liquid product into bottles, verify fill volume, cap, label, inspect, and record rejected units.',

        updated_at =
            NOW()

    WHERE
        product_id =
            v_product_id
        AND step_code =
            'PKG-001';


    -- ========================================================
    -- 6. RESOLVE PROCESS RUNS
    -- ========================================================

    SELECT pr.process_run_id
    INTO v_mix_run_id
    FROM pharma.process_runs pr
    JOIN pharma.process_steps ps
        ON ps.process_step_id =
           pr.process_step_id
    WHERE
        pr.batch_id =
            v_batch_id
        AND ps.step_code =
            'MIX-001'
    LIMIT 1;


    SELECT pr.process_run_id
    INTO v_hold_run_id
    FROM pharma.process_runs pr
    JOIN pharma.process_steps ps
        ON ps.process_step_id =
           pr.process_step_id
    WHERE
        pr.batch_id =
            v_batch_id
        AND ps.step_code =
            'HOLD-001'
    LIMIT 1;


    SELECT pr.process_run_id
    INTO v_pack_run_id
    FROM pharma.process_runs pr
    JOIN pharma.process_steps ps
        ON ps.process_step_id =
           pr.process_step_id
    WHERE
        pr.batch_id =
            v_batch_id
        AND ps.step_code =
            'PKG-001'
    LIMIT 1;


    -- ========================================================
    -- 7. REBUILD LIQUID MIXING CPPs
    -- ========================================================

    DELETE FROM pharma.process_parameters
    WHERE
        process_run_id =
            v_mix_run_id;


    INSERT INTO pharma.process_parameters (
        process_run_id,
        parameter_name,
        parameter_type,
        target_value,
        actual_value,
        lower_limit,
        upper_limit,
        unit_of_measure,
        within_spec,
        recorded_at
    )
    VALUES

    (
        v_mix_run_id,
        'Mixing Speed',
        'CPP',
        120.000000,
        122.000000,
        110.000000,
        130.000000,
        'rpm',
        TRUE,
        NOW() - INTERVAL '45 minutes'
    ),

    (
        v_mix_run_id,
        'Product Temperature',
        'CPP',
        25.000000,
        25.800000,
        20.000000,
        30.000000,
        'C',
        TRUE,
        NOW() - INTERVAL '40 minutes'
    ),

    (
        v_mix_run_id,
        'pH',
        'CPP',
        6.500000,
        6.620000,
        6.200000,
        6.800000,
        'pH',
        TRUE,
        NOW() - INTERVAL '35 minutes'
    ),

    (
        v_mix_run_id,
        'Viscosity',
        'CPP',
        250.000000,
        285.000000,
        220.000000,
        280.000000,
        'cP',
        FALSE,
        NOW() - INTERVAL '30 minutes'
    ),

    (
        v_mix_run_id,
        'Mixing Duration',
        'CPP',
        1800.000000,
        1920.000000,
        1650.000000,
        2100.000000,
        'seconds',
        TRUE,
        NOW() - INTERVAL '18 minutes'
    );


    -- ========================================================
    -- 8. REBUILD LIQUID HOLD PARAMETERS
    -- ========================================================

    DELETE FROM pharma.process_parameters
    WHERE
        process_run_id =
            v_hold_run_id;


    INSERT INTO pharma.process_parameters (
        process_run_id,
        parameter_name,
        parameter_type,
        target_value,
        actual_value,
        lower_limit,
        upper_limit,
        unit_of_measure,
        within_spec,
        recorded_at
    )
    VALUES

    (
        v_hold_run_id,
        'Hold Temperature',
        'CPP',
        22.000000,
        22.400000,
        18.000000,
        25.000000,
        'C',
        TRUE,
        NOW() - INTERVAL '10 minutes'
    ),

    (
        v_hold_run_id,
        'Hold Duration',
        'CPP',
        900.000000,
        900.000000,
        600.000000,
        1800.000000,
        'seconds',
        TRUE,
        NOW() - INTERVAL '3 minutes'
    );


    -- ========================================================
    -- 9. UPDATE CONTROLLED DEVIATION
    --
    -- Previous tablet-oriented torque deviation becomes
    -- a liquid-process viscosity excursion.
    -- ========================================================

    UPDATE pharma.deviations
    SET
        category =
            'process-parameter',

        description =
            'Bulk liquid viscosity reached 285 cP against an upper process limit of 280 cP during mixing.',

        root_cause =
            'Temporary concentration increase during ingredient incorporation produced a short viscosity excursion.',

        corrective_action =
            'Operator adjusted agitation and verified temperature, pH, and final bulk homogeneity before transfer.',

        updated_at =
            NOW()

    WHERE
        deviation_number =
            'DEV-2026-0001';


    -- ========================================================
    -- 10. CONVERT PACKAGING TO LIQUID BOTTLE FILLING
    -- ========================================================

    UPDATE pharma.packaging_records
    SET
        packaging_line =
            'LIQ-FILL-001',

        package_type =
            '100 mL Bottle',

        target_units =
            10000,

        produced_units =
            9950,

        rejected_units =
            50,

        status =
            'completed',

        updated_at =
            NOW()

    WHERE
        batch_id =
            v_batch_id;


    -- ========================================================
    -- 11. REBUILD LIQUID QC TESTS
    -- ========================================================

    DELETE FROM pharma.quality_results
    WHERE
        batch_id =
            v_batch_id;


    INSERT INTO pharma.quality_results (
        batch_id,
        test_name,
        test_method,
        sample_id,
        result_numeric,
        lower_spec_limit,
        upper_spec_limit,
        unit_of_measure,
        disposition,
        tested_at,
        analyst_name
    )
    VALUES

    (
        v_batch_id,
        'Assay',
        'HPLC-ASSAY-001',
        'QC-B2026-001-A',
        99.200000,
        95.000000,
        105.000000,
        '%',
        'pass',
        NOW(),
        'QC Analyst 01'
    ),

    (
        v_batch_id,
        'pH',
        'PH-001',
        'QC-B2026-001-B',
        6.620000,
        6.200000,
        6.800000,
        'pH',
        'pass',
        NOW(),
        'QC Analyst 01'
    ),

    (
        v_batch_id,
        'Viscosity',
        'VISC-001',
        'QC-B2026-001-C',
        274.000000,
        220.000000,
        280.000000,
        'cP',
        'pass',
        NOW(),
        'QC Analyst 02'
    ),

    (
        v_batch_id,
        'Specific Gravity',
        'SG-001',
        'QC-B2026-001-D',
        1.040000,
        1.020000,
        1.060000,
        'g/mL',
        'pass',
        NOW(),
        'QC Analyst 02'
    ),

    (
        v_batch_id,
        'Fill Volume',
        'FILL-001',
        'QC-B2026-001-E',
        100.100000,
        98.000000,
        102.000000,
        'mL',
        'pass',
        NOW(),
        'QC Analyst 02'
    );


    -- ========================================================
    -- 12. UPDATE EVENT PAYLOADS
    -- ========================================================

    UPDATE integration.system_events
    SET
        payload =
            jsonb_set(
                payload,
                '{dosage_form}',
                '"Oral Solution"'::JSONB,
                TRUE
            )
    WHERE
        correlation_id = (
            SELECT correlation_id
            FROM supply.material_requests
            WHERE request_number =
                'MR-2026-0001'
        )
        AND domain =
            'pharma';


    UPDATE integration.system_events
    SET
        payload =
            payload
            ||
            jsonb_build_object(
                'bulk_target_liters',
                    1000,
                'bulk_actual_liters',
                    995
            )
    WHERE
        correlation_id = (
            SELECT correlation_id
            FROM supply.material_requests
            WHERE request_number =
                'MR-2026-0001'
        )
        AND event_type =
            'batch.released';


    -- ========================================================
    -- 13. UPDATE PACKAGING EVENT
    -- ========================================================

    UPDATE integration.system_events
    SET
        payload =
            jsonb_build_object(
                'packaging_line',
                    'LIQ-FILL-001',

                'package_type',
                    '100 mL Bottle',

                'target_units',
                    10000,

                'produced_units',
                    9950,

                'rejected_units',
                    50
            )
    WHERE
        correlation_id = (
            SELECT correlation_id
            FROM supply.material_requests
            WHERE request_number =
                'MR-2026-0001'
        )
        AND event_type =
            'batch.packaging.completed';


    -- ========================================================
    -- 14. UPDATE MIXING EVENT
    -- ========================================================

    UPDATE integration.system_events
    SET
        payload =
            jsonb_build_object(
                'equipment',
                    'MIX-001',

                'duration_seconds',
                    1920,

                'deviation',
                    'DEV-2026-0001',

                'excursion_parameter',
                    'Viscosity',

                'actual_viscosity_cp',
                    285,

                'upper_limit_cp',
                    280,

                'critical_parameters_in_spec',
                    FALSE
            )
    WHERE
        correlation_id = (
            SELECT correlation_id
            FROM supply.material_requests
            WHERE request_number =
                'MR-2026-0001'
        )
        AND event_type =
            'batch.mixing.completed';


    RAISE NOTICE
        'Converted BATCH-2026-0001 to canonical liquid Pharma process.';

END $$;


COMMIT;