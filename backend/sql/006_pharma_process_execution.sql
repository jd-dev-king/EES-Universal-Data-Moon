BEGIN;

-- ============================================================
-- EES DATA PLATFORM
-- PHARMA PROCESS EXECUTION
--
-- Continues:
--   PPO-2026-0001
--   BATCH-2026-0001
--
-- Purpose:
--   Execute the first canonical Pharma batch through:
--   mixing → hold → packaging → QC → release
--
--   This also creates process parameters, equipment usage,
--   a controlled deviation, quality results, and event history.
-- ============================================================


DO $$
DECLARE
    v_product_id UUID;
    v_batch_id UUID;

    v_mixer_id UUID;
    v_hold_tank_id UUID;
    v_packaging_line_id UUID;

    v_mix_step_id UUID;
    v_hold_step_id UUID;
    v_pack_step_id UUID;

    v_mix_run_id UUID;
    v_hold_run_id UUID;
    v_pack_run_id UUID;

    v_deviation_id UUID;

    v_correlation_id UUID;

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


    SELECT
        correlation_id
    INTO
        v_correlation_id
    FROM supply.material_requests
    WHERE
        request_number =
            'MR-2026-0001'
    LIMIT 1;

    IF v_correlation_id IS NULL THEN
        v_correlation_id =
            gen_random_uuid();
    END IF;


    -- ========================================================
    -- 2. EQUIPMENT MASTER
    -- ========================================================

    INSERT INTO pharma.equipment (
        equipment_code,
        equipment_name,
        equipment_type,
        area,
        manufacturer,
        model,
        serial_number,
        status,
        last_calibration_at,
        next_calibration_due
    )
    VALUES (
        'MIX-001',
        'High Shear Mixer 01',
        'mixer',
        'Manufacturing Suite A',
        'EES Process Systems',
        'HSM-500',
        'MIX-001-SN',
        'available',
        NOW() - INTERVAL '30 days',
        NOW() + INTERVAL '335 days'
    )
    ON CONFLICT (equipment_code)
    DO UPDATE SET
        status = 'available',
        updated_at = NOW()
    RETURNING equipment_id
    INTO v_mixer_id;


    INSERT INTO pharma.equipment (
        equipment_code,
        equipment_name,
        equipment_type,
        area,
        manufacturer,
        model,
        serial_number,
        status,
        last_calibration_at,
        next_calibration_due
    )
    VALUES (
        'HOLD-001',
        'Intermediate Hold Tank 01',
        'hold-tank',
        'Manufacturing Suite A',
        'EES Process Systems',
        'HT-1000',
        'HOLD-001-SN',
        'available',
        NOW() - INTERVAL '20 days',
        NOW() + INTERVAL '345 days'
    )
    ON CONFLICT (equipment_code)
    DO UPDATE SET
        status = 'available',
        updated_at = NOW()
    RETURNING equipment_id
    INTO v_hold_tank_id;


    INSERT INTO pharma.equipment (
        equipment_code,
        equipment_name,
        equipment_type,
        area,
        manufacturer,
        model,
        serial_number,
        status,
        last_calibration_at,
        next_calibration_due
    )
    VALUES (
        'PKG-001',
        'Tablet Packaging Line 01',
        'packaging-line',
        'Packaging Suite A',
        'EES Packaging Systems',
        'PKG-250',
        'PKG-001-SN',
        'available',
        NOW() - INTERVAL '15 days',
        NOW() + INTERVAL '350 days'
    )
    ON CONFLICT (equipment_code)
    DO UPDATE SET
        status = 'available',
        updated_at = NOW()
    RETURNING equipment_id
    INTO v_packaging_line_id;


    -- ========================================================
    -- 3. PROCESS STEPS
    -- ========================================================

    INSERT INTO pharma.process_steps (
        product_id,
        step_code,
        step_name,
        sequence_number,
        step_type,
        target_duration_seconds,
        instructions
    )
    VALUES (
        v_product_id,
        'MIX-001',
        'Primary Mixing',
        10,
        'mixing',
        1800,
        'Mix verified materials at approved speed and temperature.'
    )
    ON CONFLICT (
        product_id,
        step_code
    )
    DO UPDATE SET
        step_name =
            EXCLUDED.step_name,
        sequence_number =
            EXCLUDED.sequence_number,
        target_duration_seconds =
            EXCLUDED.target_duration_seconds,
        instructions =
            EXCLUDED.instructions,
        updated_at =
            NOW()
    RETURNING process_step_id
    INTO v_mix_step_id;


    INSERT INTO pharma.process_steps (
        product_id,
        step_code,
        step_name,
        sequence_number,
        step_type,
        target_duration_seconds,
        instructions
    )
    VALUES (
        v_product_id,
        'HOLD-001',
        'Intermediate Hold',
        20,
        'holding',
        900,
        'Transfer mixed material to validated hold tank prior to packaging.'
    )
    ON CONFLICT (
        product_id,
        step_code
    )
    DO UPDATE SET
        step_name =
            EXCLUDED.step_name,
        sequence_number =
            EXCLUDED.sequence_number,
        target_duration_seconds =
            EXCLUDED.target_duration_seconds,
        instructions =
            EXCLUDED.instructions,
        updated_at =
            NOW()
    RETURNING process_step_id
    INTO v_hold_step_id;


    INSERT INTO pharma.process_steps (
        product_id,
        step_code,
        step_name,
        sequence_number,
        step_type,
        target_duration_seconds,
        instructions
    )
    VALUES (
        v_product_id,
        'PKG-001',
        'Primary Packaging',
        30,
        'packaging',
        2400,
        'Package finished tablets and record produced and rejected units.'
    )
    ON CONFLICT (
        product_id,
        step_code
    )
    DO UPDATE SET
        step_name =
            EXCLUDED.step_name,
        sequence_number =
            EXCLUDED.sequence_number,
        target_duration_seconds =
            EXCLUDED.target_duration_seconds,
        instructions =
            EXCLUDED.instructions,
        updated_at =
            NOW()
    RETURNING process_step_id
    INTO v_pack_step_id;


    -- ========================================================
    -- 4. MIXING PROCESS RUN
    -- ========================================================

    SELECT process_run_id
    INTO v_mix_run_id
    FROM pharma.process_runs
    WHERE
        batch_id = v_batch_id
        AND process_step_id = v_mix_step_id
        AND run_number = 1
    LIMIT 1;

    IF v_mix_run_id IS NULL THEN

        INSERT INTO pharma.process_runs (
            batch_id,
            process_step_id,
            equipment_id,
            run_number,
            status,
            started_at,
            completed_at,
            actual_duration_seconds,
            operator_name,
            notes
        )
        VALUES (
            v_batch_id,
            v_mix_step_id,
            v_mixer_id,
            1,
            'completed',
            NOW() - INTERVAL '50 minutes',
            NOW() - INTERVAL '18 minutes',
            1920,
            'Pharma Operator 01',
            'Primary mixing completed successfully.'
        )
        RETURNING process_run_id
        INTO v_mix_run_id;

    ELSE

        UPDATE pharma.process_runs
        SET
            equipment_id =
                v_mixer_id,
            status =
                'completed',
            actual_duration_seconds =
                1920,
            operator_name =
                'Pharma Operator 01',
            notes =
                'Primary mixing completed successfully.',
            updated_at =
                NOW()
        WHERE
            process_run_id =
                v_mix_run_id;

    END IF;


    -- ========================================================
    -- 5. MIXING CPPs
    -- ========================================================

    DELETE FROM pharma.process_parameters
    WHERE process_run_id =
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
        'Mixing Torque',
        'CPP',
        65.000000,
        71.500000,
        50.000000,
        70.000000,
        'Nm',
        FALSE,
        NOW() - INTERVAL '35 minutes'
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
    -- 6. CONTROLLED DEVIATION
    --
    -- Mixing torque briefly exceeded upper limit.
    -- Minor deviation; batch continues after evaluation.
    -- ========================================================

    SELECT deviation_id
    INTO v_deviation_id
    FROM pharma.deviations
    WHERE
        deviation_number =
            'DEV-2026-0001'
    LIMIT 1;


    IF v_deviation_id IS NULL THEN

        INSERT INTO pharma.deviations (
            deviation_number,
            batch_id,
            process_run_id,
            equipment_id,
            severity,
            category,
            description,
            status,
            opened_at,
            closed_at,
            root_cause,
            corrective_action
        )
        VALUES (
            'DEV-2026-0001',
            v_batch_id,
            v_mix_run_id,
            v_mixer_id,
            'minor',
            'process-parameter',
            'Mixing torque reached 71.5 Nm against an upper process limit of 70 Nm.',
            'closed',
            NOW() - INTERVAL '35 minutes',
            NOW() - INTERVAL '20 minutes',
            'Temporary viscosity increase during material incorporation.',
            'Operator reduced loading rate and verified temperature and final blend condition.'
        )
        RETURNING deviation_id
        INTO v_deviation_id;

    END IF;


    -- ========================================================
    -- 7. MIXING COMPLETED EVENT
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_events
        WHERE
            correlation_id =
                v_correlation_id
            AND event_type =
                'batch.mixing.completed'
    ) THEN

        INSERT INTO integration.system_events (
            event_id,
            source_system,
            event_type,
            domain,
            entity_type,
            entity_id,
            payload,
            correlation_id
        )
        VALUES (
            gen_random_uuid(),
            'pharma-process-twin',
            'batch.mixing.completed',
            'pharma',
            'batch',
            'BATCH-2026-0001',
            jsonb_build_object(
                'equipment',
                    'MIX-001',
                'duration_seconds',
                    1920,
                'deviation',
                    'DEV-2026-0001',
                'critical_parameters_in_spec',
                    FALSE
            ),
            v_correlation_id
        );

    END IF;


    -- ========================================================
    -- 8. HOLD PROCESS RUN
    -- ========================================================

    SELECT process_run_id
    INTO v_hold_run_id
    FROM pharma.process_runs
    WHERE
        batch_id =
            v_batch_id
        AND process_step_id =
            v_hold_step_id
        AND run_number =
            1
    LIMIT 1;


    IF v_hold_run_id IS NULL THEN

        INSERT INTO pharma.process_runs (
            batch_id,
            process_step_id,
            equipment_id,
            run_number,
            status,
            started_at,
            completed_at,
            actual_duration_seconds,
            operator_name,
            notes
        )
        VALUES (
            v_batch_id,
            v_hold_step_id,
            v_hold_tank_id,
            1,
            'completed',
            NOW() - INTERVAL '18 minutes',
            NOW() - INTERVAL '3 minutes',
            900,
            'Pharma Operator 01',
            'Material transferred to validated hold tank.'
        )
        RETURNING process_run_id
        INTO v_hold_run_id;

    END IF;


    DELETE FROM pharma.process_parameters
    WHERE process_run_id =
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
    -- 9. HOLD COMPLETED EVENT
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_events
        WHERE
            correlation_id =
                v_correlation_id
            AND event_type =
                'batch.hold.completed'
    ) THEN

        INSERT INTO integration.system_events (
            event_id,
            source_system,
            event_type,
            domain,
            entity_type,
            entity_id,
            payload,
            correlation_id
        )
        VALUES (
            gen_random_uuid(),
            'pharma-process-twin',
            'batch.hold.completed',
            'pharma',
            'batch',
            'BATCH-2026-0001',
            jsonb_build_object(
                'hold_tank',
                    'HOLD-001',
                'duration_seconds',
                    900
            ),
            v_correlation_id
        );

    END IF;


    -- ========================================================
    -- 10. PACKAGING RUN
    -- ========================================================

    SELECT process_run_id
    INTO v_pack_run_id
    FROM pharma.process_runs
    WHERE
        batch_id =
            v_batch_id
        AND process_step_id =
            v_pack_step_id
        AND run_number =
            1
    LIMIT 1;


    IF v_pack_run_id IS NULL THEN

        INSERT INTO pharma.process_runs (
            batch_id,
            process_step_id,
            equipment_id,
            run_number,
            status,
            started_at,
            completed_at,
            actual_duration_seconds,
            operator_name,
            notes
        )
        VALUES (
            v_batch_id,
            v_pack_step_id,
            v_packaging_line_id,
            1,
            'completed',
            NOW() - INTERVAL '3 minutes',
            NOW(),
            180,
            'Packaging Operator 01',
            'Demonstration packaging run completed.'
        )
        RETURNING process_run_id
        INTO v_pack_run_id;

    END IF;


    -- ========================================================
    -- 11. PACKAGING RECORD
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM pharma.packaging_records
        WHERE batch_id =
            v_batch_id
    ) THEN

        INSERT INTO pharma.packaging_records (
            batch_id,
            equipment_id,
            packaging_line,
            package_type,
            target_units,
            produced_units,
            rejected_units,
            status,
            started_at,
            completed_at
        )
        VALUES (
            v_batch_id,
            v_packaging_line_id,
            'PKG-001',
            'Bottle - 100 tablets',
            10000,
            9950,
            50,
            'completed',
            NOW() - INTERVAL '3 minutes',
            NOW()
        );

    ELSE

        UPDATE pharma.packaging_records
        SET
            equipment_id =
                v_packaging_line_id,
            target_units =
                10000,
            produced_units =
                9950,
            rejected_units =
                50,
            status =
                'completed',
            completed_at =
                NOW(),
            updated_at =
                NOW()
        WHERE
            batch_id =
                v_batch_id;

    END IF;


    -- ========================================================
    -- 12. PACKAGING COMPLETED EVENT
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_events
        WHERE
            correlation_id =
                v_correlation_id
            AND event_type =
                'batch.packaging.completed'
    ) THEN

        INSERT INTO integration.system_events (
            event_id,
            source_system,
            event_type,
            domain,
            entity_type,
            entity_id,
            payload,
            correlation_id
        )
        VALUES (
            gen_random_uuid(),
            'pharma-process-twin',
            'batch.packaging.completed',
            'pharma',
            'batch',
            'BATCH-2026-0001',
            jsonb_build_object(
                'packaging_line',
                    'PKG-001',
                'target_units',
                    10000,
                'produced_units',
                    9950,
                'rejected_units',
                    50
            ),
            v_correlation_id
        );

    END IF;


    -- ========================================================
    -- 13. QUALITY RESULTS
    -- ========================================================

    DELETE FROM pharma.quality_results
    WHERE batch_id =
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
        'Content Uniformity',
        'CU-001',
        'QC-B2026-001-B',
        98.700000,
        90.000000,
        110.000000,
        '%',
        'pass',
        NOW(),
        'QC Analyst 01'
    ),

    (
        v_batch_id,
        'Dissolution',
        'DISS-001',
        'QC-B2026-001-C',
        92.500000,
        80.000000,
        100.000000,
        '%',
        'pass',
        NOW(),
        'QC Analyst 02'
    ),

    (
        v_batch_id,
        'Tablet Weight',
        'WT-001',
        'QC-B2026-001-D',
        499.800000,
        475.000000,
        525.000000,
        'mg',
        'pass',
        NOW(),
        'QC Analyst 02'
    );


    -- ========================================================
    -- 14. QUALITY COMPLETED EVENT
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_events
        WHERE
            correlation_id =
                v_correlation_id
            AND event_type =
                'batch.quality.completed'
    ) THEN

        INSERT INTO integration.system_events (
            event_id,
            source_system,
            event_type,
            domain,
            entity_type,
            entity_id,
            payload,
            correlation_id
        )
        VALUES (
            gen_random_uuid(),
            'pharma-process-twin',
            'batch.quality.completed',
            'pharma',
            'batch',
            'BATCH-2026-0001',
            jsonb_build_object(
                'tests_completed',
                    4,
                'tests_failed',
                    0,
                'disposition',
                    'pass'
            ),
            v_correlation_id
        );

    END IF;


    -- ========================================================
    -- 15. FINAL BATCH RELEASE
    -- ========================================================

    UPDATE pharma.batches
    SET
        status =
            'released',
        actual_quantity =
            9950,
        completed_at =
            NOW(),
        released_at =
            NOW(),
        updated_at =
            NOW()
    WHERE
        batch_id =
            v_batch_id;


    UPDATE pharma.production_orders
    SET
        status =
            'completed',
        updated_at =
            NOW()
    WHERE
        production_order_id = (
            SELECT
                production_order_id
            FROM pharma.batches
            WHERE
                batch_id =
                    v_batch_id
        );


    -- ========================================================
    -- 16. RELEASE EVENT
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_events
        WHERE
            correlation_id =
                v_correlation_id
            AND event_type =
                'batch.released'
    ) THEN

        INSERT INTO integration.system_events (
            event_id,
            source_system,
            event_type,
            domain,
            entity_type,
            entity_id,
            payload,
            correlation_id
        )
        VALUES (
            gen_random_uuid(),
            'pharma-process-twin',
            'batch.released',
            'pharma',
            'batch',
            'BATCH-2026-0001',
            jsonb_build_object(
                'released_quantity',
                    9950,
                'target_quantity',
                    10000,
                'quality_status',
                    'pass',
                'deviation_count',
                    1
            ),
            v_correlation_id
        );

    END IF;


    -- ========================================================
    -- 17. SYNC / ANALYTICS MARKER
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_sync_state
        WHERE
            system_key =
                'pharma-process-twin'
            AND dataset_key =
                'pharma.batch_process_summary'
    ) THEN

        INSERT INTO integration.system_sync_state (
            sync_id,
            system_key,
            dataset_key,
            sync_direction,
            last_success_at,
            last_attempt_at,
            last_status,
            records_processed,
            updated_at
        )
        VALUES (
            gen_random_uuid(),
            'pharma-process-twin',
            'pharma.batch_process_summary',
            'outbound',
            NOW(),
            NOW(),
            'success',
            1,
            NOW()
        );

    ELSE

        UPDATE integration.system_sync_state
        SET
            last_success_at =
                NOW(),
            last_attempt_at =
                NOW(),
            last_status =
                'success',
            records_processed =
                1,
            last_error =
                NULL,
            updated_at =
                NOW()
        WHERE
            system_key =
                'pharma-process-twin'
            AND dataset_key =
                'pharma.batch_process_summary';

    END IF;


    RAISE NOTICE
        'Pharma process execution complete for BATCH-2026-0001';

END $$;


COMMIT;