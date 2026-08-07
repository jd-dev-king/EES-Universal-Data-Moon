BEGIN;

-- ============================================================
-- EES DATA PLATFORM
-- SUPPLY → PHARMA MATERIAL ORCHESTRATION
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- SUPPLIERS
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.suppliers (
    supplier_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    supplier_code VARCHAR(100) NOT NULL UNIQUE,

    supplier_name VARCHAR(200) NOT NULL,

    status VARCHAR(30) NOT NULL
        DEFAULT 'active',

    contact_name VARCHAR(150),

    contact_email VARCHAR(200),

    contact_phone VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_supplier_status_check
        CHECK (
            status IN (
                'active',
                'inactive',
                'blocked'
            )
        )
);


-- ============================================================
-- MATERIAL CATALOG
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.material_catalog (
    supply_material_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    material_code VARCHAR(100) NOT NULL UNIQUE,

    material_name VARCHAR(200) NOT NULL,

    material_type VARCHAR(50) NOT NULL,

    unit_of_measure VARCHAR(50) NOT NULL,

    preferred_supplier_id UUID
        REFERENCES supply.suppliers(
            supplier_id
        ),

    reorder_point NUMERIC(18,4),

    reorder_quantity NUMERIC(18,4),

    active BOOLEAN NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_material_type_check
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
-- INVENTORY LOCATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.inventory_locations (
    location_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    location_code VARCHAR(100) NOT NULL UNIQUE,

    location_name VARCHAR(200) NOT NULL,

    location_type VARCHAR(50) NOT NULL,

    status VARCHAR(30) NOT NULL
        DEFAULT 'available',

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_location_type_check
        CHECK (
            location_type IN (
                'warehouse',
                'staging',
                'weighing',
                'quarantine',
                'production',
                'shipping'
            )
        ),

    CONSTRAINT supply_location_status_check
        CHECK (
            status IN (
                'available',
                'occupied',
                'cleaning',
                'blocked',
                'out-of-service'
            )
        )
);


-- ============================================================
-- MATERIAL LOTS
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.material_lots (
    material_lot_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    supply_material_id UUID NOT NULL
        REFERENCES supply.material_catalog(
            supply_material_id
        ),

    supplier_id UUID
        REFERENCES supply.suppliers(
            supplier_id
        ),

    supplier_lot_number VARCHAR(150),

    internal_lot_number VARCHAR(150) NOT NULL UNIQUE,

    received_quantity NUMERIC(18,4) NOT NULL,

    available_quantity NUMERIC(18,4) NOT NULL,

    reserved_quantity NUMERIC(18,4) NOT NULL
        DEFAULT 0,

    unit_of_measure VARCHAR(50) NOT NULL,

    status VARCHAR(40) NOT NULL
        DEFAULT 'available',

    received_at TIMESTAMPTZ,

    expiry_date DATE,

    location_id UUID
        REFERENCES supply.inventory_locations(
            location_id
        ),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_material_lot_status_check
        CHECK (
            status IN (
                'available',
                'reserved',
                'quarantine',
                'released',
                'expired',
                'depleted',
                'blocked'
            )
        ),

    CONSTRAINT supply_material_lot_qty_check
        CHECK (
            received_quantity >= 0
            AND available_quantity >= 0
            AND reserved_quantity >= 0
        )
);


CREATE INDEX IF NOT EXISTS
    idx_supply_material_lots_material
ON supply.material_lots(
    supply_material_id
);


CREATE INDEX IF NOT EXISTS
    idx_supply_material_lots_status
ON supply.material_lots(
    status
);


-- ============================================================
-- PURCHASE ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.purchase_orders (
    purchase_order_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    po_number VARCHAR(100) NOT NULL UNIQUE,

    supplier_id UUID NOT NULL
        REFERENCES supply.suppliers(
            supplier_id
        ),

    status VARCHAR(40) NOT NULL
        DEFAULT 'draft',

    ordered_at TIMESTAMPTZ,

    expected_at TIMESTAMPTZ,

    received_at TIMESTAMPTZ,

    source_system VARCHAR(100)
        DEFAULT 'supply-nexus',

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_purchase_order_status_check
        CHECK (
            status IN (
                'draft',
                'approved',
                'ordered',
                'partially-received',
                'received',
                'cancelled'
            )
        )
);


-- ============================================================
-- PURCHASE ORDER LINES
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.purchase_order_lines (
    purchase_order_line_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    purchase_order_id UUID NOT NULL
        REFERENCES supply.purchase_orders(
            purchase_order_id
        )
        ON DELETE CASCADE,

    supply_material_id UUID NOT NULL
        REFERENCES supply.material_catalog(
            supply_material_id
        ),

    ordered_quantity NUMERIC(18,4) NOT NULL,

    received_quantity NUMERIC(18,4) NOT NULL
        DEFAULT 0,

    unit_of_measure VARCHAR(50) NOT NULL,

    status VARCHAR(40) NOT NULL
        DEFAULT 'open',

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_purchase_order_line_status_check
        CHECK (
            status IN (
                'open',
                'partially-received',
                'received',
                'cancelled'
            )
        )
);


-- ============================================================
-- RECEIPTS
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.receipts (
    receipt_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    purchase_order_id UUID
        REFERENCES supply.purchase_orders(
            purchase_order_id
        ),

    purchase_order_line_id UUID
        REFERENCES supply.purchase_order_lines(
            purchase_order_line_id
        ),

    material_lot_id UUID
        REFERENCES supply.material_lots(
            material_lot_id
        ),

    received_quantity NUMERIC(18,4) NOT NULL,

    received_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    received_by VARCHAR(150),

    status VARCHAR(40) NOT NULL
        DEFAULT 'received',

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_receipt_status_check
        CHECK (
            status IN (
                'received',
                'quarantine',
                'released',
                'rejected'
            )
        )
);


-- ============================================================
-- MATERIAL REQUESTS
-- Pharma requests material through Supply Nexus
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.material_requests (
    material_request_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    request_number VARCHAR(100) NOT NULL UNIQUE,

    requesting_system VARCHAR(150) NOT NULL
        DEFAULT 'pharma-process-twin',

    pharma_production_order_id UUID
        REFERENCES pharma.production_orders(
            production_order_id
        ),

    pharma_batch_id UUID
        REFERENCES pharma.batches(
            batch_id
        ),

    status VARCHAR(50) NOT NULL
        DEFAULT 'requested',

    requested_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    fulfilled_at TIMESTAMPTZ,

    correlation_id UUID NOT NULL
        DEFAULT gen_random_uuid(),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_material_request_status_check
        CHECK (
            status IN (
                'requested',
                'reviewing',
                'partially-reserved',
                'reserved',
                'picking',
                'weighing',
                'issued',
                'shortage',
                'cancelled'
            )
        )
);


CREATE INDEX IF NOT EXISTS
    idx_supply_material_requests_batch
ON supply.material_requests(
    pharma_batch_id
);


CREATE INDEX IF NOT EXISTS
    idx_supply_material_requests_correlation
ON supply.material_requests(
    correlation_id
);


-- ============================================================
-- MATERIAL REQUEST LINES
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.material_request_lines (
    material_request_line_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    material_request_id UUID NOT NULL
        REFERENCES supply.material_requests(
            material_request_id
        )
        ON DELETE CASCADE,

    supply_material_id UUID NOT NULL
        REFERENCES supply.material_catalog(
            supply_material_id
        ),

    pharma_batch_material_id UUID
        REFERENCES pharma.batch_materials(
            batch_material_id
        ),

    requested_quantity NUMERIC(18,4) NOT NULL,

    reserved_quantity NUMERIC(18,4) NOT NULL
        DEFAULT 0,

    issued_quantity NUMERIC(18,4) NOT NULL
        DEFAULT 0,

    unit_of_measure VARCHAR(50) NOT NULL,

    status VARCHAR(40) NOT NULL
        DEFAULT 'requested',

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_material_request_line_status_check
        CHECK (
            status IN (
                'requested',
                'reserved',
                'partially-reserved',
                'shortage',
                'picked',
                'weighed',
                'issued',
                'cancelled'
            )
        )
);


-- ============================================================
-- MATERIAL RESERVATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.material_reservations (
    reservation_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    material_request_line_id UUID NOT NULL
        REFERENCES supply.material_request_lines(
            material_request_line_id
        )
        ON DELETE CASCADE,

    material_lot_id UUID NOT NULL
        REFERENCES supply.material_lots(
            material_lot_id
        ),

    reserved_quantity NUMERIC(18,4) NOT NULL,

    unit_of_measure VARCHAR(50) NOT NULL,

    status VARCHAR(40) NOT NULL
        DEFAULT 'reserved',

    reserved_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    released_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_reservation_status_check
        CHECK (
            status IN (
                'reserved',
                'picked',
                'weighed',
                'issued',
                'released',
                'cancelled'
            )
        )
);


CREATE INDEX IF NOT EXISTS
    idx_supply_reservations_request_line
ON supply.material_reservations(
    material_request_line_id
);


CREATE INDEX IF NOT EXISTS
    idx_supply_reservations_lot
ON supply.material_reservations(
    material_lot_id
);


-- ============================================================
-- PICKING TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.picking_transactions (
    picking_transaction_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    reservation_id UUID NOT NULL
        REFERENCES supply.material_reservations(
            reservation_id
        ),

    from_location_id UUID
        REFERENCES supply.inventory_locations(
            location_id
        ),

    to_location_id UUID
        REFERENCES supply.inventory_locations(
            location_id
        ),

    picked_quantity NUMERIC(18,4) NOT NULL,

    picked_by VARCHAR(150),

    picked_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    status VARCHAR(30) NOT NULL
        DEFAULT 'picked',

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_picking_status_check
        CHECK (
            status IN (
                'picked',
                'cancelled',
                'returned'
            )
        )
);


-- ============================================================
-- WEIGHING TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.weighing_transactions (
    weighing_transaction_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    reservation_id UUID NOT NULL
        REFERENCES supply.material_reservations(
            reservation_id
        ),

    material_lot_id UUID NOT NULL
        REFERENCES supply.material_lots(
            material_lot_id
        ),

    pharma_batch_id UUID
        REFERENCES pharma.batches(
            batch_id
        ),

    pharma_batch_material_id UUID
        REFERENCES pharma.batch_materials(
            batch_material_id
        ),

    target_quantity NUMERIC(18,4) NOT NULL,

    actual_quantity NUMERIC(18,4),

    unit_of_measure VARCHAR(50) NOT NULL,

    tare_confirmed BOOLEAN NOT NULL
        DEFAULT FALSE,

    weighed_by VARCHAR(150),

    verified_by VARCHAR(150),

    weighed_at TIMESTAMPTZ,

    status VARCHAR(40) NOT NULL
        DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT supply_weighing_status_check
        CHECK (
            status IN (
                'pending',
                'ready',
                'weighed',
                'verified',
                'rejected'
            )
        ),

    CONSTRAINT supply_weighing_requires_tare
        CHECK (
            status IN (
                'pending',
                'ready'
            )
            OR tare_confirmed = TRUE
        )
);


CREATE INDEX IF NOT EXISTS
    idx_supply_weighing_batch
ON supply.weighing_transactions(
    pharma_batch_id
);


-- ============================================================
-- MATERIAL ISSUES TO PHARMA
-- ============================================================

CREATE TABLE IF NOT EXISTS supply.material_issues (
    material_issue_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    material_request_id UUID NOT NULL
        REFERENCES supply.material_requests(
            material_request_id
        ),

    material_request_line_id UUID NOT NULL
        REFERENCES supply.material_request_lines(
            material_request_line_id
        ),

    reservation_id UUID NOT NULL
        REFERENCES supply.material_reservations(
            reservation_id
        ),

    material_lot_id UUID NOT NULL
        REFERENCES supply.material_lots(
            material_lot_id
        ),

    pharma_batch_id UUID NOT NULL
        REFERENCES pharma.batches(
            batch_id
        ),

    pharma_batch_material_id UUID NOT NULL
        REFERENCES pharma.batch_materials(
            batch_material_id
        ),

    issued_quantity NUMERIC(18,4) NOT NULL,

    unit_of_measure VARCHAR(50) NOT NULL,

    issued_by VARCHAR(150),

    issued_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    correlation_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS
    idx_supply_material_issues_batch
ON supply.material_issues(
    pharma_batch_id
);


-- ============================================================
-- PHARMA CROSS-DOMAIN REFERENCES
-- ============================================================

ALTER TABLE pharma.batch_materials
    ADD COLUMN IF NOT EXISTS
        supply_material_id UUID;

ALTER TABLE pharma.batch_materials
    ADD COLUMN IF NOT EXISTS
        supply_material_lot_id UUID;

ALTER TABLE pharma.batch_materials
    ADD COLUMN IF NOT EXISTS
        supply_reservation_id UUID;

ALTER TABLE pharma.batch_materials
    ADD COLUMN IF NOT EXISTS
        supply_material_issue_id UUID;


DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'fk_pharma_batch_material_supply_material'
    ) THEN

        ALTER TABLE pharma.batch_materials
            ADD CONSTRAINT
                fk_pharma_batch_material_supply_material
            FOREIGN KEY (
                supply_material_id
            )
            REFERENCES supply.material_catalog(
                supply_material_id
            );

    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'fk_pharma_batch_material_supply_lot'
    ) THEN

        ALTER TABLE pharma.batch_materials
            ADD CONSTRAINT
                fk_pharma_batch_material_supply_lot
            FOREIGN KEY (
                supply_material_lot_id
            )
            REFERENCES supply.material_lots(
                material_lot_id
            );

    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'fk_pharma_batch_material_supply_reservation'
    ) THEN

        ALTER TABLE pharma.batch_materials
            ADD CONSTRAINT
                fk_pharma_batch_material_supply_reservation
            FOREIGN KEY (
                supply_reservation_id
            )
            REFERENCES supply.material_reservations(
                reservation_id
            );

    END IF;

END $$;


-- ============================================================
-- MATERIAL AVAILABILITY VIEW
-- ============================================================

CREATE OR REPLACE VIEW supply.material_availability AS

SELECT
    mc.supply_material_id,
    mc.material_code,
    mc.material_name,
    mc.material_type,
    mc.unit_of_measure,

    COUNT(
        ml.material_lot_id
    ) AS lot_count,

    COALESCE(
        SUM(
            ml.available_quantity
        ),
        0
    ) AS available_quantity,

    COALESCE(
        SUM(
            ml.reserved_quantity
        ),
        0
    ) AS reserved_quantity,

    mc.reorder_point,
    mc.reorder_quantity,

    CASE
        WHEN COALESCE(
            SUM(
                ml.available_quantity
            ),
            0
        ) <= COALESCE(
            mc.reorder_point,
            0
        )
        THEN TRUE
        ELSE FALSE
    END AS reorder_required

FROM supply.material_catalog mc

LEFT JOIN supply.material_lots ml
    ON ml.supply_material_id =
       mc.supply_material_id
    AND ml.status IN (
        'available',
        'reserved',
        'released'
    )

GROUP BY
    mc.supply_material_id,
    mc.material_code,
    mc.material_name,
    mc.material_type,
    mc.unit_of_measure,
    mc.reorder_point,
    mc.reorder_quantity;


-- ============================================================
-- PHARMA MATERIAL FULFILLMENT VIEW
-- ============================================================

CREATE OR REPLACE VIEW supply.pharma_material_fulfillment AS

SELECT
    mr.material_request_id,
    mr.request_number,
    mr.correlation_id,

    po.po_number,

    b.batch_id,
    b.batch_number,

    p.product_code,
    p.product_name,

    mc.material_code,
    mc.material_name,

    mrl.requested_quantity,
    mrl.reserved_quantity,
    mrl.issued_quantity,
    mrl.unit_of_measure,

    mrl.status AS line_status,

    mr.status AS request_status

FROM supply.material_requests mr

LEFT JOIN pharma.production_orders po
    ON po.production_order_id =
       mr.pharma_production_order_id

LEFT JOIN pharma.batches b
    ON b.batch_id =
       mr.pharma_batch_id

LEFT JOIN pharma.products p
    ON p.product_id =
       b.product_id

JOIN supply.material_request_lines mrl
    ON mrl.material_request_id =
       mr.material_request_id

JOIN supply.material_catalog mc
    ON mc.supply_material_id =
       mrl.supply_material_id;


COMMENT ON VIEW
    supply.pharma_material_fulfillment
IS
'Cross-domain Supply Nexus to Pharma Process Twin material request, reservation, and issue status.';


-- ============================================================
-- CROSS-DOMAIN DATA LINEAGE
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

    'Supply Nexus',

    'supply.material_issues',

    'Pharma Process Twin',

    'pharma.batch_materials',

    'material-issue',

    'Supply Nexus issues reserved and weighed material lots into Pharma batch material records.'

WHERE NOT EXISTS (
    SELECT 1
    FROM integration.data_lineage
    WHERE
        source_system =
            'Supply Nexus'
        AND source_dataset =
            'supply.material_issues'
        AND target_system =
            'Pharma Process Twin'
        AND target_dataset =
            'pharma.batch_materials'
);


COMMIT;