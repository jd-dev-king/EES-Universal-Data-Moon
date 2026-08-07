BEGIN;

-- ============================================================
-- EES DATA PLATFORM
-- FIRST CROSS-DOMAIN SUPPLY → PHARMA TRANSACTION
--
-- Demonstration identifiers:
--
-- Product:
--   EES-TAB-100
--
-- Pharma Production Order:
--   PPO-2026-0001
--
-- Batch:
--   BATCH-2026-0001
--
-- Supply Material Request:
--   MR-2026-0001
--
-- Purpose:
--   Establish one coherent transaction that can be traced
--   through Supply Nexus, Pharma Process Twin, Data Moon,
--   Manufacturing Analytics, and later the EES Data Graph.
-- ============================================================


DO $$
DECLARE
    -- --------------------------------------------------------
    -- Shared IDs
    -- --------------------------------------------------------

    v_product_id UUID;

    v_api_material_id UUID;
    v_excipient_material_id UUID;

    v_supply_api_material_id UUID;
    v_supply_excipient_material_id UUID;

    v_supplier_id UUID;

    v_warehouse_location_id UUID;
    v_weighing_location_id UUID;
    v_production_location_id UUID;

    v_api_lot_id UUID;
    v_excipient_lot_id UUID;

    v_production_order_id UUID;
    v_batch_id UUID;

    v_batch_api_material_id UUID;
    v_batch_excipient_material_id UUID;

    v_material_request_id UUID;
    v_correlation_id UUID;

    v_api_request_line_id UUID;
    v_excipient_request_line_id UUID;

    v_api_reservation_id UUID;
    v_excipient_reservation_id UUID;

    v_api_issue_id UUID;
    v_excipient_issue_id UUID;

BEGIN

    -- ========================================================
    -- 1. PHARMA PRODUCT
    -- ========================================================

    INSERT INTO pharma.products (
        product_code,
        product_name,
        dosage_form,
        strength,
        unit_of_measure,
        description,
        active
    )
    VALUES (
        'EES-TAB-100',
        'EES Demonstration Tablet',
        'Tablet',
        '100 mg',
        'tablet',
        'Canonical EES demonstration product used for the first Supply-to-Pharma cross-domain transaction.',
        TRUE
    )
    ON CONFLICT (product_code)
    DO UPDATE SET
        product_name =
            EXCLUDED.product_name,

        dosage_form =
            EXCLUDED.dosage_form,

        strength =
            EXCLUDED.strength,

        unit_of_measure =
            EXCLUDED.unit_of_measure,

        description =
            EXCLUDED.description,

        active =
            TRUE,

        updated_at =
            NOW()
    RETURNING product_id
    INTO v_product_id;


    -- ========================================================
    -- 2. PHARMA MATERIAL MASTER
    -- ========================================================

    INSERT INTO pharma.materials (
        material_code,
        material_name,
        material_type,
        unit_of_measure,
        specification_reference,
        supplier_name,
        lot_controlled,
        active
    )
    VALUES (
        'API-100',
        'Active Ingredient 100',
        'api',
        'kg',
        'SPEC-API-100',
        'EES Pharma Supplier',
        TRUE,
        TRUE
    )
    ON CONFLICT (material_code)
    DO UPDATE SET
        material_name =
            EXCLUDED.material_name,

        specification_reference =
            EXCLUDED.specification_reference,

        supplier_name =
            EXCLUDED.supplier_name,

        active =
            TRUE,

        updated_at =
            NOW()
    RETURNING material_id
    INTO v_api_material_id;


    INSERT INTO pharma.materials (
        material_code,
        material_name,
        material_type,
        unit_of_measure,
        specification_reference,
        supplier_name,
        lot_controlled,
        active
    )
    VALUES (
        'EXC-200',
        'Microcrystalline Cellulose',
        'excipient',
        'kg',
        'SPEC-EXC-200',
        'EES Pharma Supplier',
        TRUE,
        TRUE
    )
    ON CONFLICT (material_code)
    DO UPDATE SET
        material_name =
            EXCLUDED.material_name,

        specification_reference =
            EXCLUDED.specification_reference,

        supplier_name =
            EXCLUDED.supplier_name,

        active =
            TRUE,

        updated_at =
            NOW()
    RETURNING material_id
    INTO v_excipient_material_id;


    -- ========================================================
    -- 3. SUPPLIER
    -- ========================================================

    INSERT INTO supply.suppliers (
        supplier_code,
        supplier_name,
        status,
        contact_name,
        contact_email
    )
    VALUES (
        'SUP-EES-001',
        'EES Pharma Supplier',
        'active',
        'Supply Operations',
        'supply@example.invalid'
    )
    ON CONFLICT (supplier_code)
    DO UPDATE SET
        supplier_name =
            EXCLUDED.supplier_name,

        status =
            'active',

        updated_at =
            NOW()
    RETURNING supplier_id
    INTO v_supplier_id;


    -- ========================================================
    -- 4. SUPPLY MATERIAL CATALOG
    -- ========================================================

    INSERT INTO supply.material_catalog (
        material_code,
        material_name,
        material_type,
        unit_of_measure,
        preferred_supplier_id,
        reorder_point,
        reorder_quantity,
        active
    )
    VALUES (
        'API-100',
        'Active Ingredient 100',
        'api',
        'kg',
        v_supplier_id,
        10.0000,
        50.0000,
        TRUE
    )
    ON CONFLICT (material_code)
    DO UPDATE SET
        material_name =
            EXCLUDED.material_name,

        preferred_supplier_id =
            EXCLUDED.preferred_supplier_id,

        reorder_point =
            EXCLUDED.reorder_point,

        reorder_quantity =
            EXCLUDED.reorder_quantity,

        active =
            TRUE,

        updated_at =
            NOW()
    RETURNING supply_material_id
    INTO v_supply_api_material_id;


    INSERT INTO supply.material_catalog (
        material_code,
        material_name,
        material_type,
        unit_of_measure,
        preferred_supplier_id,
        reorder_point,
        reorder_quantity,
        active
    )
    VALUES (
        'EXC-200',
        'Microcrystalline Cellulose',
        'excipient',
        'kg',
        v_supplier_id,
        25.0000,
        100.0000,
        TRUE
    )
    ON CONFLICT (material_code)
    DO UPDATE SET
        material_name =
            EXCLUDED.material_name,

        preferred_supplier_id =
            EXCLUDED.preferred_supplier_id,

        reorder_point =
            EXCLUDED.reorder_point,

        reorder_quantity =
            EXCLUDED.reorder_quantity,

        active =
            TRUE,

        updated_at =
            NOW()
    RETURNING supply_material_id
    INTO v_supply_excipient_material_id;


    -- ========================================================
    -- 5. SUPPLY LOCATIONS
    -- ========================================================

    INSERT INTO supply.inventory_locations (
        location_code,
        location_name,
        location_type,
        status
    )
    VALUES (
        'WH-A01',
        'Warehouse A - Raw Materials',
        'warehouse',
        'available'
    )
    ON CONFLICT (location_code)
    DO UPDATE SET
        location_name =
            EXCLUDED.location_name,

        status =
            'available',

        updated_at =
            NOW()
    RETURNING location_id
    INTO v_warehouse_location_id;


    INSERT INTO supply.inventory_locations (
        location_code,
        location_name,
        location_type,
        status
    )
    VALUES (
        'WEIGH-01',
        'Dispensing and Weighing Station 01',
        'weighing',
        'available'
    )
    ON CONFLICT (location_code)
    DO UPDATE SET
        location_name =
            EXCLUDED.location_name,

        status =
            'available',

        updated_at =
            NOW()
    RETURNING location_id
    INTO v_weighing_location_id;


    INSERT INTO supply.inventory_locations (
        location_code,
        location_name,
        location_type,
        status
    )
    VALUES (
        'PROD-STAGE-01',
        'Pharma Production Staging',
        'production',
        'available'
    )
    ON CONFLICT (location_code)
    DO UPDATE SET
        location_name =
            EXCLUDED.location_name,

        status =
            'available',

        updated_at =
            NOW()
    RETURNING location_id
    INTO v_production_location_id;


    -- ========================================================
    -- 6. AVAILABLE MATERIAL LOTS
    -- ========================================================

    INSERT INTO supply.material_lots (
        supply_material_id,
        supplier_id,
        supplier_lot_number,
        internal_lot_number,
        received_quantity,
        available_quantity,
        reserved_quantity,
        unit_of_measure,
        status,
        received_at,
        expiry_date,
        location_id
    )
    VALUES (
        v_supply_api_material_id,
        v_supplier_id,
        'SUPLOT-API-2026-001',
        'LOT-API-2026-001',
        50.0000,
        50.0000,
        0.0000,
        'kg',
        'available',
        NOW() - INTERVAL '7 days',
        CURRENT_DATE + INTERVAL '18 months',
        v_warehouse_location_id
    )
    ON CONFLICT (internal_lot_number)
    DO UPDATE SET
        supply_material_id =
            EXCLUDED.supply_material_id,

        supplier_id =
            EXCLUDED.supplier_id,

        location_id =
            EXCLUDED.location_id,

        updated_at =
            NOW()
    RETURNING material_lot_id
    INTO v_api_lot_id;


    INSERT INTO supply.material_lots (
        supply_material_id,
        supplier_id,
        supplier_lot_number,
        internal_lot_number,
        received_quantity,
        available_quantity,
        reserved_quantity,
        unit_of_measure,
        status,
        received_at,
        expiry_date,
        location_id
    )
    VALUES (
        v_supply_excipient_material_id,
        v_supplier_id,
        'SUPLOT-EXC-2026-001',
        'LOT-EXC-2026-001',
        200.0000,
        200.0000,
        0.0000,
        'kg',
        'available',
        NOW() - INTERVAL '5 days',
        CURRENT_DATE + INTERVAL '24 months',
        v_warehouse_location_id
    )
    ON CONFLICT (internal_lot_number)
    DO UPDATE SET
        supply_material_id =
            EXCLUDED.supply_material_id,

        supplier_id =
            EXCLUDED.supplier_id,

        location_id =
            EXCLUDED.location_id,

        updated_at =
            NOW()
    RETURNING material_lot_id
    INTO v_excipient_lot_id;


    -- ========================================================
    -- 7. PHARMA PRODUCTION ORDER
    -- ========================================================

    INSERT INTO pharma.production_orders (
        po_number,
        product_id,
        planned_quantity,
        unit_of_measure,
        planned_start_at,
        planned_end_at,
        status,
        source_system
    )
    VALUES (
        'PPO-2026-0001',
        v_product_id,
        10000,
        'tablet',
        NOW(),
        NOW() + INTERVAL '8 hours',
        'released',
        'pharma-process-twin'
    )
    ON CONFLICT (po_number)
    DO UPDATE SET
        product_id =
            EXCLUDED.product_id,

        planned_quantity =
            EXCLUDED.planned_quantity,

        status =
            'released',

        updated_at =
            NOW()
    RETURNING production_order_id
    INTO v_production_order_id;


    -- ========================================================
    -- 8. PHARMA BATCH
    -- ========================================================

    INSERT INTO pharma.batches (
        batch_number,
        production_order_id,
        product_id,
        target_quantity,
        unit_of_measure,
        status,
        started_at
    )
    VALUES (
        'BATCH-2026-0001',
        v_production_order_id,
        v_product_id,
        10000,
        'tablet',
        'weighing',
        NOW()
    )
    ON CONFLICT (batch_number)
    DO UPDATE SET
        production_order_id =
            EXCLUDED.production_order_id,

        product_id =
            EXCLUDED.product_id,

        target_quantity =
            EXCLUDED.target_quantity,

        status =
            'weighing',

        started_at =
            COALESCE(
                pharma.batches.started_at,
                NOW()
            ),

        updated_at =
            NOW()
    RETURNING batch_id
    INTO v_batch_id;


    -- ========================================================
    -- 9. PHARMA BATCH MATERIAL REQUIREMENTS
    -- ========================================================

    SELECT batch_material_id
    INTO v_batch_api_material_id
    FROM pharma.batch_materials
    WHERE
        batch_id = v_batch_id
        AND material_id = v_api_material_id
    LIMIT 1;


    IF v_batch_api_material_id IS NULL THEN

        INSERT INTO pharma.batch_materials (
            batch_id,
            material_id,
            required_quantity,
            unit_of_measure,
            weighing_status,
            supply_material_id
        )
        VALUES (
            v_batch_id,
            v_api_material_id,
            10.0000,
            'kg',
            'pending',
            v_supply_api_material_id
        )
        RETURNING batch_material_id
        INTO v_batch_api_material_id;

    ELSE

        UPDATE pharma.batch_materials
        SET
            required_quantity = 10.0000,
            supply_material_id =
                v_supply_api_material_id,
            updated_at =
                NOW()
        WHERE
            batch_material_id =
                v_batch_api_material_id;

    END IF;


    SELECT batch_material_id
    INTO v_batch_excipient_material_id
    FROM pharma.batch_materials
    WHERE
        batch_id = v_batch_id
        AND material_id = v_excipient_material_id
    LIMIT 1;


    IF v_batch_excipient_material_id IS NULL THEN

        INSERT INTO pharma.batch_materials (
            batch_id,
            material_id,
            required_quantity,
            unit_of_measure,
            weighing_status,
            supply_material_id
        )
        VALUES (
            v_batch_id,
            v_excipient_material_id,
            40.0000,
            'kg',
            'pending',
            v_supply_excipient_material_id
        )
        RETURNING batch_material_id
        INTO v_batch_excipient_material_id;

    ELSE

        UPDATE pharma.batch_materials
        SET
            required_quantity = 40.0000,
            supply_material_id =
                v_supply_excipient_material_id,
            updated_at =
                NOW()
        WHERE
            batch_material_id =
                v_batch_excipient_material_id;

    END IF;


    -- ========================================================
    -- 10. MATERIAL REQUEST
    -- ========================================================

    SELECT
        material_request_id,
        correlation_id
    INTO
        v_material_request_id,
        v_correlation_id
    FROM supply.material_requests
    WHERE
        request_number =
            'MR-2026-0001'
    LIMIT 1;


    IF v_material_request_id IS NULL THEN

        v_correlation_id =
            gen_random_uuid();

        INSERT INTO supply.material_requests (
            request_number,
            requesting_system,
            pharma_production_order_id,
            pharma_batch_id,
            status,
            requested_at,
            correlation_id
        )
        VALUES (
            'MR-2026-0001',
            'pharma-process-twin',
            v_production_order_id,
            v_batch_id,
            'requested',
            NOW(),
            v_correlation_id
        )
        RETURNING
            material_request_id
        INTO
            v_material_request_id;

    END IF;


    -- ========================================================
    -- 11. REQUEST LINES
    -- ========================================================

    SELECT material_request_line_id
    INTO v_api_request_line_id
    FROM supply.material_request_lines
    WHERE
        material_request_id =
            v_material_request_id
        AND supply_material_id =
            v_supply_api_material_id
    LIMIT 1;


    IF v_api_request_line_id IS NULL THEN

        INSERT INTO supply.material_request_lines (
            material_request_id,
            supply_material_id,
            pharma_batch_material_id,
            requested_quantity,
            reserved_quantity,
            issued_quantity,
            unit_of_measure,
            status
        )
        VALUES (
            v_material_request_id,
            v_supply_api_material_id,
            v_batch_api_material_id,
            10.0000,
            0,
            0,
            'kg',
            'requested'
        )
        RETURNING material_request_line_id
        INTO v_api_request_line_id;

    END IF;


    SELECT material_request_line_id
    INTO v_excipient_request_line_id
    FROM supply.material_request_lines
    WHERE
        material_request_id =
            v_material_request_id
        AND supply_material_id =
            v_supply_excipient_material_id
    LIMIT 1;


    IF v_excipient_request_line_id IS NULL THEN

        INSERT INTO supply.material_request_lines (
            material_request_id,
            supply_material_id,
            pharma_batch_material_id,
            requested_quantity,
            reserved_quantity,
            issued_quantity,
            unit_of_measure,
            status
        )
        VALUES (
            v_material_request_id,
            v_supply_excipient_material_id,
            v_batch_excipient_material_id,
            40.0000,
            0,
            0,
            'kg',
            'requested'
        )
        RETURNING material_request_line_id
        INTO v_excipient_request_line_id;

    END IF;


    -- ========================================================
    -- 12. MATERIAL REQUESTED EVENT
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_events
        WHERE
            correlation_id =
                v_correlation_id
            AND event_type =
                'material.requested'
    ) THEN

        INSERT INTO integration.system_events (
            event_id,
            source_system,
            event_type,
            domain,
            entity_type,
            entity_id,
            event_timestamp,
            payload,
            correlation_id
        )
        VALUES (
            gen_random_uuid(),
            'pharma-process-twin',
            'material.requested',
            'pharma',
            'batch',
            'BATCH-2026-0001',
            NOW(),
            jsonb_build_object(
                'production_order',
                    'PPO-2026-0001',

                'batch_number',
                    'BATCH-2026-0001',

                'material_request',
                    'MR-2026-0001'
            ),
            v_correlation_id
        );

    END IF;


    -- ========================================================
    -- 13. INVENTORY RESERVATION
    -- ========================================================

    IF (
        SELECT available_quantity
        FROM supply.material_lots
        WHERE material_lot_id =
            v_api_lot_id
    ) < 10.0000 THEN

        RAISE EXCEPTION
            'Insufficient API inventory for transaction';

    END IF;


    IF (
        SELECT available_quantity
        FROM supply.material_lots
        WHERE material_lot_id =
            v_excipient_lot_id
    ) < 40.0000 THEN

        RAISE EXCEPTION
            'Insufficient excipient inventory for transaction';

    END IF;


    SELECT reservation_id
    INTO v_api_reservation_id
    FROM supply.material_reservations
    WHERE
        material_request_line_id =
            v_api_request_line_id
    LIMIT 1;


    IF v_api_reservation_id IS NULL THEN

        INSERT INTO supply.material_reservations (
            material_request_line_id,
            material_lot_id,
            reserved_quantity,
            unit_of_measure,
            status
        )
        VALUES (
            v_api_request_line_id,
            v_api_lot_id,
            10.0000,
            'kg',
            'reserved'
        )
        RETURNING reservation_id
        INTO v_api_reservation_id;


        UPDATE supply.material_lots
        SET
            available_quantity =
                available_quantity
                - 10.0000,

            reserved_quantity =
                reserved_quantity
                + 10.0000,

            status =
                'reserved',

            updated_at =
                NOW()
        WHERE
            material_lot_id =
                v_api_lot_id;

    END IF;


    SELECT reservation_id
    INTO v_excipient_reservation_id
    FROM supply.material_reservations
    WHERE
        material_request_line_id =
            v_excipient_request_line_id
    LIMIT 1;


    IF v_excipient_reservation_id IS NULL THEN

        INSERT INTO supply.material_reservations (
            material_request_line_id,
            material_lot_id,
            reserved_quantity,
            unit_of_measure,
            status
        )
        VALUES (
            v_excipient_request_line_id,
            v_excipient_lot_id,
            40.0000,
            'kg',
            'reserved'
        )
        RETURNING reservation_id
        INTO v_excipient_reservation_id;


        UPDATE supply.material_lots
        SET
            available_quantity =
                available_quantity
                - 40.0000,

            reserved_quantity =
                reserved_quantity
                + 40.0000,

            status =
                'reserved',

            updated_at =
                NOW()
        WHERE
            material_lot_id =
                v_excipient_lot_id;

    END IF;


    UPDATE supply.material_request_lines
    SET
        reserved_quantity =
            requested_quantity,

        status =
            'reserved',

        updated_at =
            NOW()
    WHERE
        material_request_id =
            v_material_request_id;


    UPDATE supply.material_requests
    SET
        status =
            'reserved',

        updated_at =
            NOW()
    WHERE
        material_request_id =
            v_material_request_id;


    -- ========================================================
    -- 14. MATERIAL RESERVED EVENT
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_events
        WHERE
            correlation_id =
                v_correlation_id
            AND event_type =
                'material.reserved'
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
            'supply-nexus',
            'material.reserved',
            'supply',
            'material_request',
            'MR-2026-0001',
            jsonb_build_object(
                'api_lot',
                    'LOT-API-2026-001',

                'api_quantity_kg',
                    10,

                'excipient_lot',
                    'LOT-EXC-2026-001',

                'excipient_quantity_kg',
                    40
            ),
            v_correlation_id
        );

    END IF;


    -- ========================================================
    -- 15. PICKING
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM supply.picking_transactions
        WHERE reservation_id =
            v_api_reservation_id
    ) THEN

        INSERT INTO supply.picking_transactions (
            reservation_id,
            from_location_id,
            to_location_id,
            picked_quantity,
            picked_by,
            picked_at,
            status
        )
        VALUES (
            v_api_reservation_id,
            v_warehouse_location_id,
            v_weighing_location_id,
            10.0000,
            'Supply Operator 01',
            NOW(),
            'picked'
        );

    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM supply.picking_transactions
        WHERE reservation_id =
            v_excipient_reservation_id
    ) THEN

        INSERT INTO supply.picking_transactions (
            reservation_id,
            from_location_id,
            to_location_id,
            picked_quantity,
            picked_by,
            picked_at,
            status
        )
        VALUES (
            v_excipient_reservation_id,
            v_warehouse_location_id,
            v_weighing_location_id,
            40.0000,
            'Supply Operator 01',
            NOW(),
            'picked'
        );

    END IF;


    UPDATE supply.material_reservations
    SET
        status =
            'picked',

        updated_at =
            NOW()
    WHERE reservation_id IN (
        v_api_reservation_id,
        v_excipient_reservation_id
    );


    UPDATE supply.material_request_lines
    SET
        status =
            'picked',

        updated_at =
            NOW()
    WHERE
        material_request_id =
            v_material_request_id;


    UPDATE supply.material_requests
    SET
        status =
            'picking',

        updated_at =
            NOW()
    WHERE
        material_request_id =
            v_material_request_id;


    -- ========================================================
    -- 16. MATERIAL PICKED EVENT
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_events
        WHERE
            correlation_id =
                v_correlation_id
            AND event_type =
                'material.picked'
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
            'supply-nexus',
            'material.picked',
            'supply',
            'material_request',
            'MR-2026-0001',
            jsonb_build_object(
                'from_location',
                    'WH-A01',

                'to_location',
                    'WEIGH-01'
            ),
            v_correlation_id
        );

    END IF;


    -- ========================================================
    -- 17. TARE-CONFIRMED WEIGHING
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM supply.weighing_transactions
        WHERE reservation_id =
            v_api_reservation_id
    ) THEN

        INSERT INTO supply.weighing_transactions (
            reservation_id,
            material_lot_id,
            pharma_batch_id,
            pharma_batch_material_id,
            target_quantity,
            actual_quantity,
            unit_of_measure,
            tare_confirmed,
            weighed_by,
            verified_by,
            weighed_at,
            status
        )
        VALUES (
            v_api_reservation_id,
            v_api_lot_id,
            v_batch_id,
            v_batch_api_material_id,
            10.0000,
            10.0000,
            'kg',
            TRUE,
            'Supply Operator 01',
            'Verifier 01',
            NOW(),
            'verified'
        );

    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM supply.weighing_transactions
        WHERE reservation_id =
            v_excipient_reservation_id
    ) THEN

        INSERT INTO supply.weighing_transactions (
            reservation_id,
            material_lot_id,
            pharma_batch_id,
            pharma_batch_material_id,
            target_quantity,
            actual_quantity,
            unit_of_measure,
            tare_confirmed,
            weighed_by,
            verified_by,
            weighed_at,
            status
        )
        VALUES (
            v_excipient_reservation_id,
            v_excipient_lot_id,
            v_batch_id,
            v_batch_excipient_material_id,
            40.0000,
            40.0000,
            'kg',
            TRUE,
            'Supply Operator 01',
            'Verifier 01',
            NOW(),
            'verified'
        );

    END IF;


    UPDATE supply.material_reservations
    SET
        status =
            'weighed',

        updated_at =
            NOW()
    WHERE reservation_id IN (
        v_api_reservation_id,
        v_excipient_reservation_id
    );


    UPDATE supply.material_request_lines
    SET
        status =
            'weighed',

        updated_at =
            NOW()
    WHERE
        material_request_id =
            v_material_request_id;


    UPDATE supply.material_requests
    SET
        status =
            'weighing',

        updated_at =
            NOW()
    WHERE
        material_request_id =
            v_material_request_id;


    -- ========================================================
    -- 18. MATERIAL WEIGHED EVENT
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_events
        WHERE
            correlation_id =
                v_correlation_id
            AND event_type =
                'material.weighed'
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
            'supply-nexus',
            'material.weighed',
            'supply',
            'batch',
            'BATCH-2026-0001',
            jsonb_build_object(
                'tare_confirmed',
                    TRUE,

                'weighing_station',
                    'WEIGH-01'
            ),
            v_correlation_id
        );

    END IF;


    -- ========================================================
    -- 19. MATERIAL ISSUE TO PHARMA
    -- ========================================================

    SELECT material_issue_id
    INTO v_api_issue_id
    FROM supply.material_issues
    WHERE
        reservation_id =
            v_api_reservation_id
    LIMIT 1;


    IF v_api_issue_id IS NULL THEN

        INSERT INTO supply.material_issues (
            material_request_id,
            material_request_line_id,
            reservation_id,
            material_lot_id,
            pharma_batch_id,
            pharma_batch_material_id,
            issued_quantity,
            unit_of_measure,
            issued_by,
            issued_at,
            correlation_id
        )
        VALUES (
            v_material_request_id,
            v_api_request_line_id,
            v_api_reservation_id,
            v_api_lot_id,
            v_batch_id,
            v_batch_api_material_id,
            10.0000,
            'kg',
            'Supply Operator 01',
            NOW(),
            v_correlation_id
        )
        RETURNING material_issue_id
        INTO v_api_issue_id;


        UPDATE supply.material_lots
        SET
            reserved_quantity =
                GREATEST(
                    reserved_quantity
                    - 10.0000,
                    0
                ),

            status =
                CASE
                    WHEN
                        available_quantity <= 0
                        AND
                        reserved_quantity
                        - 10.0000 <= 0
                    THEN 'depleted'
                    ELSE 'available'
                END,

            updated_at =
                NOW()
        WHERE
            material_lot_id =
                v_api_lot_id;

    END IF;


    SELECT material_issue_id
    INTO v_excipient_issue_id
    FROM supply.material_issues
    WHERE
        reservation_id =
            v_excipient_reservation_id
    LIMIT 1;


    IF v_excipient_issue_id IS NULL THEN

        INSERT INTO supply.material_issues (
            material_request_id,
            material_request_line_id,
            reservation_id,
            material_lot_id,
            pharma_batch_id,
            pharma_batch_material_id,
            issued_quantity,
            unit_of_measure,
            issued_by,
            issued_at,
            correlation_id
        )
        VALUES (
            v_material_request_id,
            v_excipient_request_line_id,
            v_excipient_reservation_id,
            v_excipient_lot_id,
            v_batch_id,
            v_batch_excipient_material_id,
            40.0000,
            'kg',
            'Supply Operator 01',
            NOW(),
            v_correlation_id
        )
        RETURNING material_issue_id
        INTO v_excipient_issue_id;


        UPDATE supply.material_lots
        SET
            reserved_quantity =
                GREATEST(
                    reserved_quantity
                    - 40.0000,
                    0
                ),

            status =
                CASE
                    WHEN
                        available_quantity <= 0
                        AND
                        reserved_quantity
                        - 40.0000 <= 0
                    THEN 'depleted'
                    ELSE 'available'
                END,

            updated_at =
                NOW()
        WHERE
            material_lot_id =
                v_excipient_lot_id;

    END IF;


    -- ========================================================
    -- 20. UPDATE PHARMA BATCH MATERIALS
    -- ========================================================

    UPDATE pharma.batch_materials
    SET
        actual_quantity =
            10.0000,

        weighing_status =
            'verified',

        weighed_at =
            NOW(),

        verified_by =
            'Verifier 01',

        supply_material_id =
            v_supply_api_material_id,

        supply_material_lot_id =
            v_api_lot_id,

        supply_reservation_id =
            v_api_reservation_id,

        supply_material_issue_id =
            v_api_issue_id,

        updated_at =
            NOW()
    WHERE
        batch_material_id =
            v_batch_api_material_id;


    UPDATE pharma.batch_materials
    SET
        actual_quantity =
            40.0000,

        weighing_status =
            'verified',

        weighed_at =
            NOW(),

        verified_by =
            'Verifier 01',

        supply_material_id =
            v_supply_excipient_material_id,

        supply_material_lot_id =
            v_excipient_lot_id,

        supply_reservation_id =
            v_excipient_reservation_id,

        supply_material_issue_id =
            v_excipient_issue_id,

        updated_at =
            NOW()
    WHERE
        batch_material_id =
            v_batch_excipient_material_id;


    -- ========================================================
    -- 21. COMPLETE SUPPLY REQUEST
    -- ========================================================

    UPDATE supply.material_request_lines
    SET
        issued_quantity =
            requested_quantity,

        status =
            'issued',

        updated_at =
            NOW()
    WHERE
        material_request_id =
            v_material_request_id;


    UPDATE supply.material_reservations
    SET
        status =
            'issued',

        released_at =
            NOW(),

        updated_at =
            NOW()
    WHERE reservation_id IN (
        v_api_reservation_id,
        v_excipient_reservation_id
    );


    UPDATE supply.material_requests
    SET
        status =
            'issued',

        fulfilled_at =
            NOW(),

        updated_at =
            NOW()
    WHERE
        material_request_id =
            v_material_request_id;


    -- ========================================================
    -- 22. MATERIAL ISSUED EVENT
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_events
        WHERE
            correlation_id =
                v_correlation_id
            AND event_type =
                'material.issued'
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
            'supply-nexus',
            'material.issued',
            'supply',
            'batch',
            'BATCH-2026-0001',
            jsonb_build_object(
                'material_request',
                    'MR-2026-0001',

                'destination',
                    'pharma',

                'api_lot',
                    'LOT-API-2026-001',

                'excipient_lot',
                    'LOT-EXC-2026-001'
            ),
            v_correlation_id
        );

    END IF;


    -- ========================================================
    -- 23. AUTHORIZE PHARMA MIXING
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM pharma.batch_materials
        WHERE
            batch_id =
                v_batch_id
            AND weighing_status
                <> 'verified'
    ) THEN

        UPDATE pharma.batches
        SET
            status =
                'mixing',

            updated_at =
                NOW()
        WHERE
            batch_id =
                v_batch_id;

    END IF;


    -- ========================================================
    -- 24. PHARMA MATERIALS READY EVENT
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_events
        WHERE
            correlation_id =
                v_correlation_id
            AND event_type =
                'batch.materials.ready'
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
            'batch.materials.ready',
            'pharma',
            'batch',
            'BATCH-2026-0001',
            jsonb_build_object(
                'batch_status',
                    'mixing',

                'materials_verified',
                    TRUE
            ),
            v_correlation_id
        );

    END IF;


    -- ========================================================
    -- 25. SYNC STATE
    -- ========================================================

    IF NOT EXISTS (
        SELECT 1
        FROM integration.system_sync_state
        WHERE
            system_key =
                'supply-nexus'
            AND dataset_key =
                'supply.material_issues'
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
            'supply-nexus',
            'supply.material_issues',
            'outbound',
            NOW(),
            NOW(),
            'success',
            2,
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
                2,

            last_error =
                NULL,

            updated_at =
                NOW()
        WHERE
            system_key =
                'supply-nexus'
            AND dataset_key =
                'supply.material_issues';

    END IF;


    RAISE NOTICE
        'EES transaction complete: PPO-2026-0001 / BATCH-2026-0001 / MR-2026-0001';

END $$;


COMMIT;