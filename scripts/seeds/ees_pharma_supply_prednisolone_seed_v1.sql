-- ============================================================
-- EES DATA PLATFORM
-- Pharma Process + Supply Nexus Linked Demonstration Seed
-- Version: 2026-08-12
--
-- Purpose:
--   Populate the existing pharma and supply schemas with linked,
--   realistic demonstration data centered on:
--     Prednisolone Oral Solution 15 mg / 5 mL
--
-- IMPORTANT:
--   This is SYNTHETIC DEMONSTRATION DATA for the EES digital-twin
--   environment. Excipient quantities, suppliers, lot numbers,
--   operators, equipment details, process parameters, QC results,
--   and transaction history below are mock data and are NOT an
--   authoritative drug formulation or manufacturing instruction.
--
-- Design:
--   - UNII values are used as the shared material_code in both
--     supply.material_catalog and pharma.materials.
--   - 13 formulation materials are seeded.
--   - 2 inventory lots are created per material (26 lots total).
--   - 3 linked production orders / batches are created.
--   - Supply requests, reservations, picking, weighing, and issues
--     link to pharma.batch_materials.
--   - Process, packaging, QC, equipment, and deviation history is
--     added so Data Moon and operational UIs have meaningful data.
--
-- Safe to rerun:
--   Master records use ON CONFLICT.
--   Transaction records use NOT EXISTS guards based on stable
--   business identifiers and relationships.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. SUPPLIERS
-- ------------------------------------------------------------
INSERT INTO supply.suppliers
    (supplier_code, supplier_name, status, contact_name, contact_email, contact_phone)
VALUES
    ('SUP-API-001', 'Northstar Pharmaceutical Ingredients', 'active',
     'Avery Morgan', 'quality@northstar-demo.example', '555-0101'),
    ('SUP-EXC-001', 'Keystone Excipients Group', 'active',
     'Jordan Ellis', 'service@keystone-demo.example', '555-0102'),
    ('SUP-FLV-001', 'Orchard Flavor & Color Systems', 'active',
     'Taylor Reed', 'orders@orchard-demo.example', '555-0103'),
    ('SUP-PUR-001', 'PureFlow Process Materials', 'active',
     'Casey Bennett', 'supply@pureflow-demo.example', '555-0104')
ON CONFLICT (supplier_code) DO UPDATE SET
    supplier_name = EXCLUDED.supplier_name,
    status = EXCLUDED.status,
    contact_name = EXCLUDED.contact_name,
    contact_email = EXCLUDED.contact_email,
    contact_phone = EXCLUDED.contact_phone,
    updated_at = now();

-- ------------------------------------------------------------
-- 2. INVENTORY LOCATIONS
-- ------------------------------------------------------------
INSERT INTO supply.inventory_locations
    (location_code, location_name, location_type, status)
VALUES
    ('WH-API-A01', 'API Controlled Storage A01', 'warehouse', 'occupied'),
    ('WH-EXC-B01', 'Excipient Warehouse B01', 'warehouse', 'occupied'),
    ('WH-QUAR-Q01', 'Incoming Material Quarantine Q01', 'quarantine', 'available'),
    ('WH-STAGE-S01', 'Production Staging S01', 'staging', 'available'),
    ('WH-WEIGH-W01', 'Dispensing / Weighing Room W01', 'weighing', 'available'),
    ('PROD-MIX-P01', 'Pharma Production Mix Suite P01', 'production', 'available')
ON CONFLICT (location_code) DO UPDATE SET
    location_name = EXCLUDED.location_name,
    location_type = EXCLUDED.location_type,
    status = EXCLUDED.status,
    updated_at = now();

-- ------------------------------------------------------------
-- 3. MATERIAL MASTER - SUPPLY
--    UNII is the canonical material_code.
-- ------------------------------------------------------------
WITH supplier_ids AS (
    SELECT supplier_code, supplier_id
    FROM supply.suppliers
)
INSERT INTO supply.material_catalog
    (material_code, material_name, material_type, unit_of_measure,
     preferred_supplier_id, reorder_point, reorder_quantity, active)
SELECT *
FROM (
    VALUES
      ('9PHQ9Y1OLM','Prednisolone','api','kg',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-API-001'),1.0000,5.0000,true),
      ('3K9958V90M','Alcohol','excipient','L',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-EXC-001'),25.0000,100.0000,true),
      ('XF417D3PSL','Anhydrous Citric Acid','excipient','kg',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-EXC-001'),5.0000,25.0000,true),
      ('8SKN0B0MIM','Benzoic Acid','excipient','kg',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-EXC-001'),3.0000,15.0000,true),
      ('BUC5I9595W','Cherry','excipient','L',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-FLV-001'),5.0000,20.0000,true),
      ('7FLD91C86K','Edetate Disodium','excipient','kg',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-EXC-001'),1.0000,5.0000,true),
      ('H3R47K3TBD','FD&C Blue No. 1','excipient','kg',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-FLV-001'),0.1000,0.5000,true),
      ('WZB9127XOA','FD&C Red No. 40','excipient','kg',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-FLV-001'),0.2500,1.0000,true),
      ('PDC6A3C0OX','Glycerin','excipient','L',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-EXC-001'),50.0000,200.0000,true),
      ('6DC9Q167V3','Propylene Glycol','excipient','L',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-EXC-001'),25.0000,100.0000,true),
      ('SB8ZUX40TY','Saccharin Sodium','excipient','kg',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-EXC-001'),1.0000,5.0000,true),
      ('C151H8M554','Sucrose','excipient','kg',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-EXC-001'),200.0000,750.0000,true),
      ('059QF0KO0R','Water','excipient','L',
       (SELECT supplier_id FROM supplier_ids WHERE supplier_code='SUP-PUR-001'),500.0000,2000.0000,true)
) AS v(material_code, material_name, material_type, unit_of_measure,
       preferred_supplier_id, reorder_point, reorder_quantity, active)
ON CONFLICT (material_code) DO UPDATE SET
    material_name = EXCLUDED.material_name,
    material_type = EXCLUDED.material_type,
    unit_of_measure = EXCLUDED.unit_of_measure,
    preferred_supplier_id = EXCLUDED.preferred_supplier_id,
    reorder_point = EXCLUDED.reorder_point,
    reorder_quantity = EXCLUDED.reorder_quantity,
    active = EXCLUDED.active,
    updated_at = now();

-- ------------------------------------------------------------
-- 4. MATERIAL MASTER - PHARMA
-- ------------------------------------------------------------
INSERT INTO pharma.materials
    (material_code, material_name, material_type, unit_of_measure,
     specification_reference, supplier_name, lot_controlled, active)
VALUES
    ('9PHQ9Y1OLM','Prednisolone','api','kg',
     'UNII 9PHQ9Y1OLM | Active Ingredient / Active Moiety',
     'Northstar Pharmaceutical Ingredients',true,true),
    ('3K9958V90M','Alcohol','excipient','L',
     'UNII 3K9958V90M | Co-solvent',
     'Keystone Excipients Group',true,true),
    ('XF417D3PSL','Anhydrous Citric Acid','excipient','kg',
     'UNII XF417D3PSL | Buffer / Tart Taste',
     'Keystone Excipients Group',true,true),
    ('8SKN0B0MIM','Benzoic Acid','excipient','kg',
     'UNII 8SKN0B0MIM | Preservative',
     'Keystone Excipients Group',true,true),
    ('BUC5I9595W','Cherry','excipient','L',
     'UNII BUC5I9595W | Flavor',
     'Orchard Flavor & Color Systems',true,true),
    ('7FLD91C86K','Edetate Disodium','excipient','kg',
     'UNII 7FLD91C86K | Stabilizer',
     'Keystone Excipients Group',true,true),
    ('H3R47K3TBD','FD&C Blue No. 1','excipient','kg',
     'UNII H3R47K3TBD | Dye',
     'Orchard Flavor & Color Systems',true,true),
    ('WZB9127XOA','FD&C Red No. 40','excipient','kg',
     'UNII WZB9127XOA | Dye',
     'Orchard Flavor & Color Systems',true,true),
    ('PDC6A3C0OX','Glycerin','excipient','L',
     'UNII PDC6A3C0OX | Co-solvent',
     'Keystone Excipients Group',true,true),
    ('6DC9Q167V3','Propylene Glycol','excipient','L',
     'UNII 6DC9Q167V3 | Co-solvent',
     'Keystone Excipients Group',true,true),
    ('SB8ZUX40TY','Saccharin Sodium','excipient','kg',
     'UNII SB8ZUX40TY | Sweetener',
     'Keystone Excipients Group',true,true),
    ('C151H8M554','Sucrose','excipient','kg',
     'UNII C151H8M554 | Sweetener / Body Agent',
     'Keystone Excipients Group',true,true),
    ('059QF0KO0R','Water','excipient','L',
     'UNII 059QF0KO0R | Vehicle',
     'PureFlow Process Materials',true,true)
ON CONFLICT (material_code) DO UPDATE SET
    material_name = EXCLUDED.material_name,
    material_type = EXCLUDED.material_type,
    unit_of_measure = EXCLUDED.unit_of_measure,
    specification_reference = EXCLUDED.specification_reference,
    supplier_name = EXCLUDED.supplier_name,
    lot_controlled = EXCLUDED.lot_controlled,
    active = EXCLUDED.active,
    updated_at = now();

-- ------------------------------------------------------------
-- 5. PURCHASE ORDERS
-- ------------------------------------------------------------
WITH s AS (
    SELECT supplier_code, supplier_id FROM supply.suppliers
)
INSERT INTO supply.purchase_orders
    (po_number, supplier_id, status, ordered_at, expected_at, received_at, source_system)
SELECT *
FROM (
    VALUES
      ('SUP-PO-260701-API',
       (SELECT supplier_id FROM s WHERE supplier_code='SUP-API-001'),
       'received',
       TIMESTAMPTZ '2026-07-01 09:00:00-04',
       TIMESTAMPTZ '2026-07-08 12:00:00-04',
       TIMESTAMPTZ '2026-07-08 10:15:00-04',
       'supply-nexus'),
      ('SUP-PO-260702-EXC',
       (SELECT supplier_id FROM s WHERE supplier_code='SUP-EXC-001'),
       'received',
       TIMESTAMPTZ '2026-07-02 09:30:00-04',
       TIMESTAMPTZ '2026-07-09 12:00:00-04',
       TIMESTAMPTZ '2026-07-09 11:20:00-04',
       'supply-nexus'),
      ('SUP-PO-260703-FLV',
       (SELECT supplier_id FROM s WHERE supplier_code='SUP-FLV-001'),
       'received',
       TIMESTAMPTZ '2026-07-03 10:00:00-04',
       TIMESTAMPTZ '2026-07-10 12:00:00-04',
       TIMESTAMPTZ '2026-07-10 09:40:00-04',
       'supply-nexus'),
      ('SUP-PO-260704-PUR',
       (SELECT supplier_id FROM s WHERE supplier_code='SUP-PUR-001'),
       'received',
       TIMESTAMPTZ '2026-07-04 11:00:00-04',
       TIMESTAMPTZ '2026-07-11 12:00:00-04',
       TIMESTAMPTZ '2026-07-11 08:55:00-04',
       'supply-nexus')
) AS v(po_number, supplier_id, status, ordered_at, expected_at, received_at, source_system)
ON CONFLICT (po_number) DO UPDATE SET
    supplier_id = EXCLUDED.supplier_id,
    status = EXCLUDED.status,
    ordered_at = EXCLUDED.ordered_at,
    expected_at = EXCLUDED.expected_at,
    received_at = EXCLUDED.received_at,
    source_system = EXCLUDED.source_system,
    updated_at = now();

-- ------------------------------------------------------------
-- 6. PURCHASE ORDER LINES
-- ------------------------------------------------------------
WITH m AS (
    SELECT material_code, supply_material_id, preferred_supplier_id
    FROM supply.material_catalog
),
p AS (
    SELECT purchase_order_id, supplier_id
    FROM supply.purchase_orders
    WHERE po_number LIKE 'SUP-PO-2607%'
)
INSERT INTO supply.purchase_order_lines
    (purchase_order_id, supply_material_id, ordered_quantity,
     received_quantity, unit_of_measure, status)
SELECT
    p.purchase_order_id,
    m.supply_material_id,
    CASE m.material_code
      WHEN '9PHQ9Y1OLM' THEN 10.0000
      WHEN '3K9958V90M' THEN 200.0000
      WHEN 'XF417D3PSL' THEN 50.0000
      WHEN '8SKN0B0MIM' THEN 30.0000
      WHEN 'BUC5I9595W' THEN 40.0000
      WHEN '7FLD91C86K' THEN 10.0000
      WHEN 'H3R47K3TBD' THEN 1.0000
      WHEN 'WZB9127XOA' THEN 2.0000
      WHEN 'PDC6A3C0OX' THEN 400.0000
      WHEN '6DC9Q167V3' THEN 200.0000
      WHEN 'SB8ZUX40TY' THEN 10.0000
      WHEN 'C151H8M554' THEN 1500.0000
      WHEN '059QF0KO0R' THEN 5000.0000
    END,
    CASE m.material_code
      WHEN '9PHQ9Y1OLM' THEN 10.0000
      WHEN '3K9958V90M' THEN 200.0000
      WHEN 'XF417D3PSL' THEN 50.0000
      WHEN '8SKN0B0MIM' THEN 30.0000
      WHEN 'BUC5I9595W' THEN 40.0000
      WHEN '7FLD91C86K' THEN 10.0000
      WHEN 'H3R47K3TBD' THEN 1.0000
      WHEN 'WZB9127XOA' THEN 2.0000
      WHEN 'PDC6A3C0OX' THEN 400.0000
      WHEN '6DC9Q167V3' THEN 200.0000
      WHEN 'SB8ZUX40TY' THEN 10.0000
      WHEN 'C151H8M554' THEN 1500.0000
      WHEN '059QF0KO0R' THEN 5000.0000
    END,
    mcat.unit_of_measure,
    'received'
FROM m
JOIN p ON p.supplier_id = m.preferred_supplier_id
JOIN supply.material_catalog mcat ON mcat.supply_material_id = m.supply_material_id
WHERE NOT EXISTS (
    SELECT 1
    FROM supply.purchase_order_lines pol
    WHERE pol.purchase_order_id = p.purchase_order_id
      AND pol.supply_material_id = m.supply_material_id
);

-- ------------------------------------------------------------
-- 7. TWO MATERIAL LOTS PER MATERIAL
-- ------------------------------------------------------------
WITH
m AS (
    SELECT mc.supply_material_id, mc.material_code, mc.unit_of_measure,
           mc.preferred_supplier_id
    FROM supply.material_catalog mc
    WHERE mc.material_code IN (
      '9PHQ9Y1OLM','3K9958V90M','XF417D3PSL','8SKN0B0MIM','BUC5I9595W',
      '7FLD91C86K','H3R47K3TBD','WZB9127XOA','PDC6A3C0OX','6DC9Q167V3',
      'SB8ZUX40TY','C151H8M554','059QF0KO0R'
    )
),
loc AS (
    SELECT location_code, location_id
    FROM supply.inventory_locations
),
lot_seed AS (
    SELECT * FROM (VALUES
      ('9PHQ9Y1OLM','PRD-26A0708-01','NS-PRD-0708-A',5.0000,4.4000,'kg',DATE '2028-07-08',1),
      ('9PHQ9Y1OLM','PRD-26A0708-02','NS-PRD-0708-B',5.0000,5.0000,'kg',DATE '2028-07-08',2),

      ('3K9958V90M','ALC-26A0709-01','KEY-ALC-0709-A',100.0000,90.0000,'L',DATE '2028-07-09',1),
      ('3K9958V90M','ALC-26A0709-02','KEY-ALC-0709-B',100.0000,100.0000,'L',DATE '2028-07-09',2),

      ('XF417D3PSL','CIT-26A0709-01','KEY-CIT-0709-A',25.0000,24.7000,'kg',DATE '2029-07-09',1),
      ('XF417D3PSL','CIT-26A0709-02','KEY-CIT-0709-B',25.0000,25.0000,'kg',DATE '2029-07-09',2),

      ('8SKN0B0MIM','BEN-26A0709-01','KEY-BEN-0709-A',15.0000,14.8000,'kg',DATE '2029-07-09',1),
      ('8SKN0B0MIM','BEN-26A0709-02','KEY-BEN-0709-B',15.0000,15.0000,'kg',DATE '2029-07-09',2),

      ('BUC5I9595W','CHR-26A0710-01','ORC-CHR-0710-A',20.0000,19.5000,'L',DATE '2027-07-10',1),
      ('BUC5I9595W','CHR-26A0710-02','ORC-CHR-0710-B',20.0000,20.0000,'L',DATE '2027-07-10',2),

      ('7FLD91C86K','EDT-26A0709-01','KEY-EDT-0709-A',5.0000,4.9000,'kg',DATE '2029-07-09',1),
      ('7FLD91C86K','EDT-26A0709-02','KEY-EDT-0709-B',5.0000,5.0000,'kg',DATE '2029-07-09',2),

      ('H3R47K3TBD','BLU-26A0710-01','ORC-BLU-0710-A',0.5000,0.4900,'kg',DATE '2029-07-10',1),
      ('H3R47K3TBD','BLU-26A0710-02','ORC-BLU-0710-B',0.5000,0.5000,'kg',DATE '2029-07-10',2),

      ('WZB9127XOA','RED-26A0710-01','ORC-RED-0710-A',1.0000,0.9800,'kg',DATE '2029-07-10',1),
      ('WZB9127XOA','RED-26A0710-02','ORC-RED-0710-B',1.0000,1.0000,'kg',DATE '2029-07-10',2),

      ('PDC6A3C0OX','GLY-26A0709-01','KEY-GLY-0709-A',200.0000,180.0000,'L',DATE '2028-07-09',1),
      ('PDC6A3C0OX','GLY-26A0709-02','KEY-GLY-0709-B',200.0000,200.0000,'L',DATE '2028-07-09',2),

      ('6DC9Q167V3','PG-26A0709-01','KEY-PG-0709-A',100.0000,90.0000,'L',DATE '2028-07-09',1),
      ('6DC9Q167V3','PG-26A0709-02','KEY-PG-0709-B',100.0000,100.0000,'L',DATE '2028-07-09',2),

      ('SB8ZUX40TY','SAC-26A0709-01','KEY-SAC-0709-A',5.0000,4.9000,'kg',DATE '2029-07-09',1),
      ('SB8ZUX40TY','SAC-26A0709-02','KEY-SAC-0709-B',5.0000,5.0000,'kg',DATE '2029-07-09',2),

      ('C151H8M554','SUC-26A0709-01','KEY-SUC-0709-A',750.0000,660.0000,'kg',DATE '2028-07-09',1),
      ('C151H8M554','SUC-26A0709-02','KEY-SUC-0709-B',750.0000,750.0000,'kg',DATE '2028-07-09',2),

      ('059QF0KO0R','WAT-26A0711-01','PUR-WAT-0711-A',2500.0000,2380.0000,'L',DATE '2027-07-11',1),
      ('059QF0KO0R','WAT-26A0711-02','PUR-WAT-0711-B',2500.0000,2500.0000,'L',DATE '2027-07-11',2)
    ) AS v(material_code, internal_lot_number, supplier_lot_number,
           received_quantity, available_quantity, unit_of_measure, expiry_date, lot_seq)
)
INSERT INTO supply.material_lots
    (supply_material_id, supplier_id, supplier_lot_number,
     internal_lot_number, received_quantity, available_quantity,
     reserved_quantity, unit_of_measure, status, received_at,
     expiry_date, location_id)
SELECT
    m.supply_material_id,
    m.preferred_supplier_id,
    l.supplier_lot_number,
    l.internal_lot_number,
    l.received_quantity,
    l.available_quantity,
    0,
    l.unit_of_measure,
    'released',
    TIMESTAMPTZ '2026-07-11 13:00:00-04' - ((2-l.lot_seq) * INTERVAL '1 day'),
    l.expiry_date,
    CASE WHEN m.material_code='9PHQ9Y1OLM'
         THEN (SELECT location_id FROM loc WHERE location_code='WH-API-A01')
         ELSE (SELECT location_id FROM loc WHERE location_code='WH-EXC-B01')
    END
FROM lot_seed l
JOIN m USING (material_code)
ON CONFLICT (internal_lot_number) DO UPDATE SET
    supplier_lot_number = EXCLUDED.supplier_lot_number,
    received_quantity = EXCLUDED.received_quantity,
    available_quantity = EXCLUDED.available_quantity,
    unit_of_measure = EXCLUDED.unit_of_measure,
    status = EXCLUDED.status,
    expiry_date = EXCLUDED.expiry_date,
    location_id = EXCLUDED.location_id,
    updated_at = now();

-- ------------------------------------------------------------
-- 8. RECEIPTS - ONE PER LOT, LINKED TO ITS MATERIAL PO LINE
-- ------------------------------------------------------------
INSERT INTO supply.receipts
    (purchase_order_id, purchase_order_line_id, material_lot_id,
     received_quantity, received_at, received_by, status)
SELECT
    pol.purchase_order_id,
    pol.purchase_order_line_id,
    ml.material_lot_id,
    ml.received_quantity,
    COALESCE(ml.received_at, now()),
    'Morgan Lee',
    'released'
FROM supply.material_lots ml
JOIN supply.material_catalog mc
  ON mc.supply_material_id = ml.supply_material_id
JOIN supply.purchase_order_lines pol
  ON pol.supply_material_id = mc.supply_material_id
JOIN supply.purchase_orders po
  ON po.purchase_order_id = pol.purchase_order_id
 AND po.supplier_id = mc.preferred_supplier_id
WHERE ml.internal_lot_number LIKE '%-26A07%'
  AND NOT EXISTS (
      SELECT 1 FROM supply.receipts r
      WHERE r.material_lot_id = ml.material_lot_id
  );

-- ------------------------------------------------------------
-- 9. PHARMA PRODUCT
-- ------------------------------------------------------------
INSERT INTO pharma.products
    (product_code, product_name, dosage_form, strength,
     unit_of_measure, description, active)
VALUES
    ('PRED-OS-15MG-5ML',
     'Prednisolone Oral Solution',
     'Oral Solution',
     '15 mg / 5 mL',
     'L',
     'EES demonstration product for linked Supply Nexus and Pharma Process workflows. Synthetic formulation quantities are used for simulation.',
     true)
ON CONFLICT (product_code) DO UPDATE SET
    product_name = EXCLUDED.product_name,
    dosage_form = EXCLUDED.dosage_form,
    strength = EXCLUDED.strength,
    unit_of_measure = EXCLUDED.unit_of_measure,
    description = EXCLUDED.description,
    active = EXCLUDED.active,
    updated_at = now();

-- ------------------------------------------------------------
-- 10. PHARMA PRODUCTION ORDERS
-- ------------------------------------------------------------
WITH p AS (
  SELECT product_id FROM pharma.products WHERE product_code='PRED-OS-15MG-5ML'
)
INSERT INTO pharma.production_orders
    (po_number, product_id, planned_quantity, unit_of_measure,
     planned_start_at, planned_end_at, status, source_system)
SELECT *
FROM (
  VALUES
    ('PH-PO-260801', (SELECT product_id FROM p), 100.0000, 'L',
     TIMESTAMPTZ '2026-08-01 07:00:00-04', TIMESTAMPTZ '2026-08-02 18:00:00-04',
     'completed', 'pharma-process-twin'),
    ('PH-PO-260812', (SELECT product_id FROM p), 100.0000, 'L',
     TIMESTAMPTZ '2026-08-12 07:00:00-04', TIMESTAMPTZ '2026-08-13 18:00:00-04',
     'in-progress', 'pharma-process-twin'),
    ('PH-PO-260819', (SELECT product_id FROM p), 100.0000, 'L',
     TIMESTAMPTZ '2026-08-19 07:00:00-04', TIMESTAMPTZ '2026-08-20 18:00:00-04',
     'released', 'pharma-process-twin')
) AS v(po_number, product_id, planned_quantity, unit_of_measure,
       planned_start_at, planned_end_at, status, source_system)
ON CONFLICT (po_number) DO UPDATE SET
    product_id = EXCLUDED.product_id,
    planned_quantity = EXCLUDED.planned_quantity,
    unit_of_measure = EXCLUDED.unit_of_measure,
    planned_start_at = EXCLUDED.planned_start_at,
    planned_end_at = EXCLUDED.planned_end_at,
    status = EXCLUDED.status,
    source_system = EXCLUDED.source_system,
    updated_at = now();

-- ------------------------------------------------------------
-- 11. PHARMA BATCHES
-- ------------------------------------------------------------
INSERT INTO pharma.batches
    (batch_number, production_order_id, product_id, target_quantity,
     actual_quantity, unit_of_measure, status, started_at,
     completed_at, released_at)
SELECT
    v.batch_number,
    po.production_order_id,
    po.product_id,
    100.0000,
    v.actual_quantity,
    'L',
    v.status,
    v.started_at,
    v.completed_at,
    v.released_at
FROM (
    VALUES
      ('PRED-OS-260801','PH-PO-260801',99.6000,'released',
       TIMESTAMPTZ '2026-08-01 07:12:00-04',
       TIMESTAMPTZ '2026-08-02 15:42:00-04',
       TIMESTAMPTZ '2026-08-03 10:30:00-04'),
      ('PRED-OS-260812','PH-PO-260812',99.2000,'quality-review',
       TIMESTAMPTZ '2026-08-12 07:08:00-04',
       TIMESTAMPTZ '2026-08-12 17:45:00-04',
       NULL::timestamptz),
      ('PRED-OS-260819','PH-PO-260819',NULL::numeric,'weighing',
       TIMESTAMPTZ '2026-08-19 07:00:00-04',
       NULL::timestamptz,
       NULL::timestamptz)
) AS v(batch_number, po_number, actual_quantity, status,
       started_at, completed_at, released_at)
JOIN pharma.production_orders po ON po.po_number=v.po_number
ON CONFLICT (batch_number) DO UPDATE SET
    production_order_id = EXCLUDED.production_order_id,
    product_id = EXCLUDED.product_id,
    target_quantity = EXCLUDED.target_quantity,
    actual_quantity = EXCLUDED.actual_quantity,
    unit_of_measure = EXCLUDED.unit_of_measure,
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at,
    released_at = EXCLUDED.released_at,
    updated_at = now();

-- ------------------------------------------------------------
-- 12. FORMULA REQUIREMENTS FOR EACH BATCH
--     Synthetic demonstration quantities for 100 L target batch.
-- ------------------------------------------------------------
WITH formula AS (
    SELECT * FROM (VALUES
      ('9PHQ9Y1OLM',0.3000::numeric,'kg'),
      ('3K9958V90M',5.0000::numeric,'L'),
      ('XF417D3PSL',0.1500::numeric,'kg'),
      ('8SKN0B0MIM',0.1000::numeric,'kg'),
      ('BUC5I9595W',0.2500::numeric,'L'),
      ('7FLD91C86K',0.0500::numeric,'kg'),
      ('H3R47K3TBD',0.0050::numeric,'kg'),
      ('WZB9127XOA',0.0100::numeric,'kg'),
      ('PDC6A3C0OX',10.0000::numeric,'L'),
      ('6DC9Q167V3',5.0000::numeric,'L'),
      ('SB8ZUX40TY',0.0500::numeric,'kg'),
      ('C151H8M554',45.0000::numeric,'kg'),
      ('059QF0KO0R',60.0000::numeric,'L')
    ) AS v(material_code, required_quantity, unit_of_measure)
),
batch_set AS (
    SELECT batch_id, batch_number
    FROM pharma.batches
    WHERE batch_number IN ('PRED-OS-260801','PRED-OS-260812','PRED-OS-260819')
),
lot_choice AS (
    SELECT DISTINCT ON (mc.material_code)
       mc.material_code, mc.supply_material_id, ml.material_lot_id,
       ml.internal_lot_number
    FROM supply.material_catalog mc
    JOIN supply.material_lots ml ON ml.supply_material_id=mc.supply_material_id
    WHERE ml.status='released'
    ORDER BY mc.material_code, ml.expiry_date, ml.internal_lot_number
)
INSERT INTO pharma.batch_materials
    (batch_id, material_id, material_lot, required_quantity,
     actual_quantity, unit_of_measure, weighing_status,
     weighed_at, verified_by, supply_material_id, supply_material_lot_id)
SELECT
    b.batch_id,
    pm.material_id,
    lc.internal_lot_number,
    f.required_quantity,
    CASE
      WHEN b.batch_number='PRED-OS-260801' THEN
        ROUND(f.required_quantity * 0.9985,4)
      WHEN b.batch_number='PRED-OS-260812' THEN
        ROUND(f.required_quantity * 1.0008,4)
      ELSE NULL
    END,
    f.unit_of_measure,
    CASE
      WHEN b.batch_number IN ('PRED-OS-260801','PRED-OS-260812') THEN 'verified'
      ELSE 'pending'
    END,
    CASE
      WHEN b.batch_number='PRED-OS-260801' THEN TIMESTAMPTZ '2026-08-01 08:30:00-04'
      WHEN b.batch_number='PRED-OS-260812' THEN TIMESTAMPTZ '2026-08-12 08:25:00-04'
      ELSE NULL
    END,
    CASE
      WHEN b.batch_number IN ('PRED-OS-260801','PRED-OS-260812') THEN 'Riley Chen'
      ELSE NULL
    END,
    lc.supply_material_id,
    lc.material_lot_id
FROM batch_set b
CROSS JOIN formula f
JOIN pharma.materials pm ON pm.material_code=f.material_code
JOIN lot_choice lc ON lc.material_code=f.material_code
WHERE NOT EXISTS (
    SELECT 1
    FROM pharma.batch_materials bm
    WHERE bm.batch_id=b.batch_id
      AND bm.material_id=pm.material_id
);

-- ------------------------------------------------------------
-- 13. SUPPLY MATERIAL REQUESTS - ONE PER BATCH
-- ------------------------------------------------------------
INSERT INTO supply.material_requests
    (request_number, requesting_system, pharma_production_order_id,
     pharma_batch_id, status, requested_at, fulfilled_at, correlation_id)
SELECT
    v.request_number,
    'pharma-process-twin',
    po.production_order_id,
    b.batch_id,
    v.status,
    v.requested_at,
    v.fulfilled_at,
    v.correlation_id
FROM (
    VALUES
      ('MR-PRED-260801','PRED-OS-260801','issued',
       TIMESTAMPTZ '2026-07-31 14:00:00-04',
       TIMESTAMPTZ '2026-08-01 09:10:00-04',
       '11111111-1111-4111-8111-111111111111'::uuid),
      ('MR-PRED-260812','PRED-OS-260812','issued',
       TIMESTAMPTZ '2026-08-11 14:00:00-04',
       TIMESTAMPTZ '2026-08-12 09:05:00-04',
       '22222222-2222-4222-8222-222222222222'::uuid),
      ('MR-PRED-260819','PRED-OS-260819','reserved',
       TIMESTAMPTZ '2026-08-18 13:30:00-04',
       NULL::timestamptz,
       '33333333-3333-4333-8333-333333333333'::uuid)
) AS v(request_number,batch_number,status,requested_at,fulfilled_at,correlation_id)
JOIN pharma.batches b ON b.batch_number=v.batch_number
JOIN pharma.production_orders po ON po.production_order_id=b.production_order_id
ON CONFLICT (request_number) DO UPDATE SET
    requesting_system = EXCLUDED.requesting_system,
    pharma_production_order_id = EXCLUDED.pharma_production_order_id,
    pharma_batch_id = EXCLUDED.pharma_batch_id,
    status = EXCLUDED.status,
    requested_at = EXCLUDED.requested_at,
    fulfilled_at = EXCLUDED.fulfilled_at,
    correlation_id = EXCLUDED.correlation_id,
    updated_at = now();

-- ------------------------------------------------------------
-- 14. MATERIAL REQUEST LINES
-- ------------------------------------------------------------
INSERT INTO supply.material_request_lines
    (material_request_id, supply_material_id, pharma_batch_material_id,
     requested_quantity, reserved_quantity, issued_quantity,
     unit_of_measure, status)
SELECT
    mr.material_request_id,
    bm.supply_material_id,
    bm.batch_material_id,
    bm.required_quantity,
    bm.required_quantity,
    CASE WHEN mr.status='issued'
         THEN COALESCE(bm.actual_quantity,bm.required_quantity)
         ELSE 0 END,
    bm.unit_of_measure,
    CASE WHEN mr.status='issued' THEN 'issued' ELSE 'reserved' END
FROM supply.material_requests mr
JOIN pharma.batches b ON b.batch_id=mr.pharma_batch_id
JOIN pharma.batch_materials bm ON bm.batch_id=b.batch_id
WHERE mr.request_number IN ('MR-PRED-260801','MR-PRED-260812','MR-PRED-260819')
  AND NOT EXISTS (
    SELECT 1
    FROM supply.material_request_lines mrl
    WHERE mrl.material_request_id=mr.material_request_id
      AND mrl.pharma_batch_material_id=bm.batch_material_id
  );

-- ------------------------------------------------------------
-- 15. MATERIAL RESERVATIONS
-- ------------------------------------------------------------
INSERT INTO supply.material_reservations
    (material_request_line_id, material_lot_id, reserved_quantity,
     unit_of_measure, status, reserved_at, released_at)
SELECT
    mrl.material_request_line_id,
    bm.supply_material_lot_id,
    mrl.requested_quantity,
    mrl.unit_of_measure,
    CASE WHEN mr.status='issued' THEN 'issued' ELSE 'reserved' END,
    mr.requested_at + INTERVAL '30 minutes',
    CASE WHEN mr.status='issued' THEN mr.fulfilled_at ELSE NULL END
FROM supply.material_request_lines mrl
JOIN supply.material_requests mr
  ON mr.material_request_id=mrl.material_request_id
JOIN pharma.batch_materials bm
  ON bm.batch_material_id=mrl.pharma_batch_material_id
WHERE mr.request_number IN ('MR-PRED-260801','MR-PRED-260812','MR-PRED-260819')
  AND NOT EXISTS (
    SELECT 1
    FROM supply.material_reservations r
    WHERE r.material_request_line_id=mrl.material_request_line_id
  );

-- Back-link reservation into pharma.batch_materials.
UPDATE pharma.batch_materials bm
SET supply_reservation_id = r.reservation_id,
    updated_at = now()
FROM supply.material_request_lines mrl
JOIN supply.material_reservations r
  ON r.material_request_line_id=mrl.material_request_line_id
WHERE mrl.pharma_batch_material_id=bm.batch_material_id
  AND bm.supply_reservation_id IS DISTINCT FROM r.reservation_id;

-- ------------------------------------------------------------
-- 16. PICKING TRANSACTIONS FOR ISSUED BATCHES
-- ------------------------------------------------------------
INSERT INTO supply.picking_transactions
    (reservation_id, from_location_id, to_location_id,
     picked_quantity, picked_by, picked_at, status)
SELECT
    r.reservation_id,
    ml.location_id,
    (SELECT location_id FROM supply.inventory_locations WHERE location_code='WH-WEIGH-W01'),
    r.reserved_quantity,
    'Jamie Patel',
    mr.requested_at + INTERVAL '45 minutes',
    'picked'
FROM supply.material_reservations r
JOIN supply.material_request_lines mrl
  ON mrl.material_request_line_id=r.material_request_line_id
JOIN supply.material_requests mr
  ON mr.material_request_id=mrl.material_request_id
JOIN supply.material_lots ml
  ON ml.material_lot_id=r.material_lot_id
WHERE mr.status='issued'
  AND mr.request_number IN ('MR-PRED-260801','MR-PRED-260812')
  AND NOT EXISTS (
    SELECT 1
    FROM supply.picking_transactions pt
    WHERE pt.reservation_id=r.reservation_id
  );

-- ------------------------------------------------------------
-- 17. WEIGHING TRANSACTIONS
--     Completed/verified records require tare_confirmed=true.
-- ------------------------------------------------------------
INSERT INTO supply.weighing_transactions
    (reservation_id, material_lot_id, pharma_batch_id,
     pharma_batch_material_id, target_quantity, actual_quantity,
     unit_of_measure, tare_confirmed, weighed_by, verified_by,
     weighed_at, status)
SELECT
    r.reservation_id,
    r.material_lot_id,
    b.batch_id,
    bm.batch_material_id,
    bm.required_quantity,
    bm.actual_quantity,
    bm.unit_of_measure,
    CASE WHEN mr.status='issued' THEN true ELSE false END,
    CASE WHEN mr.status='issued' THEN 'Sam Rivera' ELSE NULL END,
    CASE WHEN mr.status='issued' THEN 'Riley Chen' ELSE NULL END,
    CASE
      WHEN mr.request_number='MR-PRED-260801' THEN TIMESTAMPTZ '2026-08-01 08:30:00-04'
      WHEN mr.request_number='MR-PRED-260812' THEN TIMESTAMPTZ '2026-08-12 08:25:00-04'
      ELSE NULL
    END,
    CASE WHEN mr.status='issued' THEN 'verified' ELSE 'pending' END
FROM supply.material_reservations r
JOIN supply.material_request_lines mrl
  ON mrl.material_request_line_id=r.material_request_line_id
JOIN supply.material_requests mr
  ON mr.material_request_id=mrl.material_request_id
JOIN pharma.batch_materials bm
  ON bm.batch_material_id=mrl.pharma_batch_material_id
JOIN pharma.batches b ON b.batch_id=bm.batch_id
WHERE mr.request_number IN ('MR-PRED-260801','MR-PRED-260812','MR-PRED-260819')
  AND NOT EXISTS (
    SELECT 1 FROM supply.weighing_transactions wt
    WHERE wt.reservation_id=r.reservation_id
  );

-- ------------------------------------------------------------
-- 18. MATERIAL ISSUES FOR FIRST TWO BATCHES
-- ------------------------------------------------------------
INSERT INTO supply.material_issues
    (material_request_id, material_request_line_id, reservation_id,
     material_lot_id, pharma_batch_id, pharma_batch_material_id,
     issued_quantity, unit_of_measure, issued_by, issued_at,
     correlation_id)
SELECT
    mr.material_request_id,
    mrl.material_request_line_id,
    r.reservation_id,
    r.material_lot_id,
    bm.batch_id,
    bm.batch_material_id,
    COALESCE(bm.actual_quantity,bm.required_quantity),
    bm.unit_of_measure,
    'Alex Thompson',
    mr.fulfilled_at,
    mr.correlation_id
FROM supply.material_requests mr
JOIN supply.material_request_lines mrl
  ON mrl.material_request_id=mr.material_request_id
JOIN supply.material_reservations r
  ON r.material_request_line_id=mrl.material_request_line_id
JOIN pharma.batch_materials bm
  ON bm.batch_material_id=mrl.pharma_batch_material_id
WHERE mr.status='issued'
  AND mr.request_number IN ('MR-PRED-260801','MR-PRED-260812')
  AND NOT EXISTS (
    SELECT 1
    FROM supply.material_issues mi
    WHERE mi.material_request_line_id=mrl.material_request_line_id
  );

-- Back-link Supply issue into Pharma batch material.
UPDATE pharma.batch_materials bm
SET supply_material_issue_id = mi.material_issue_id,
    updated_at = now()
FROM supply.material_issues mi
WHERE mi.pharma_batch_material_id=bm.batch_material_id
  AND bm.supply_material_issue_id IS DISTINCT FROM mi.material_issue_id;

-- ------------------------------------------------------------
-- 19. EQUIPMENT
-- ------------------------------------------------------------
INSERT INTO pharma.equipment
    (equipment_code, equipment_name, equipment_type, area,
     manufacturer, model, serial_number, status,
     last_calibration_at, next_calibration_due)
VALUES
    ('SCALE-101','Dispensing Scale 101','precision-scale','Dispensing',
     'Mettler-Toledo Demo','IND570','EES-SCL-101','available',
     TIMESTAMPTZ '2026-07-15 09:00:00-04',TIMESTAMPTZ '2027-01-15 09:00:00-05'),
    ('MIX-201','Main Solution Mix Tank 201','mixing-vessel','Compounding',
     'EES Process Systems','MX-1000','EES-MIX-201','available',
     TIMESTAMPTZ '2026-06-20 10:00:00-04',TIMESTAMPTZ '2026-12-20 10:00:00-05'),
    ('HOLD-301','Intermediate Hold Tank 301','hold-vessel','Compounding',
     'EES Process Systems','HT-1200','EES-HLD-301','available',
     TIMESTAMPTZ '2026-06-22 10:00:00-04',TIMESTAMPTZ '2026-12-22 10:00:00-05'),
    ('FILL-401','Oral Liquid Filling Line 401','filling-line','Packaging',
     'PackTech Demo','FL-120','EES-FIL-401','available',
     TIMESTAMPTZ '2026-07-01 08:00:00-04',TIMESTAMPTZ '2027-01-01 08:00:00-05'),
    ('PH-501','In-Process pH Meter 501','analytical-instrument','Quality',
     'Metrohm Demo','PH-7','EES-PH-501','available',
     TIMESTAMPTZ '2026-08-10 07:00:00-04',TIMESTAMPTZ '2026-09-10 07:00:00-04')
ON CONFLICT (equipment_code) DO UPDATE SET
    equipment_name = EXCLUDED.equipment_name,
    equipment_type = EXCLUDED.equipment_type,
    area = EXCLUDED.area,
    manufacturer = EXCLUDED.manufacturer,
    model = EXCLUDED.model,
    serial_number = EXCLUDED.serial_number,
    status = EXCLUDED.status,
    last_calibration_at = EXCLUDED.last_calibration_at,
    next_calibration_due = EXCLUDED.next_calibration_due,
    updated_at = now();

-- ------------------------------------------------------------
-- 20. PROCESS STEPS
-- ------------------------------------------------------------
WITH p AS (
    SELECT product_id FROM pharma.products WHERE product_code='PRED-OS-15MG-5ML'
)
INSERT INTO pharma.process_steps
    (product_id, step_code, step_name, sequence_number, step_type,
     target_duration_seconds, instructions)
SELECT
    (SELECT product_id FROM p), *
FROM (VALUES
    ('DISPENSE','Material Dispensing & Verification',10,'dispensing',3600,
     'Verify material identity, lot, quantity, and tare confirmation.'),
    ('PREMIX','Color / Flavor Premix',20,'premix',1800,
     'Prepare demonstration premix under controlled agitation.'),
    ('MAIN-MIX','Main Solution Compounding',30,'mixing',5400,
     'Charge components and execute controlled mixing sequence.'),
    ('HOLD','Intermediate Hold',40,'holding',3600,
     'Transfer to assigned clean hold vessel and maintain status.'),
    ('FILL-PACK','Filling & Packaging',50,'packaging',7200,
     'Fill demonstration bottles, inspect, and record rejects.'),
    ('QC-REVIEW','Quality Review & Disposition',60,'quality',3600,
     'Review analytical results, deviations, and batch documentation.')
) AS v(step_code,step_name,sequence_number,step_type,target_duration_seconds,instructions)
ON CONFLICT (product_id, step_code) DO UPDATE SET
    step_name = EXCLUDED.step_name,
    sequence_number = EXCLUDED.sequence_number,
    step_type = EXCLUDED.step_type,
    target_duration_seconds = EXCLUDED.target_duration_seconds,
    instructions = EXCLUDED.instructions,
    updated_at = now();

-- ------------------------------------------------------------
-- 21. PROCESS RUNS
-- ------------------------------------------------------------
WITH step_map AS (
    SELECT step_code, process_step_id
    FROM pharma.process_steps ps
    JOIN pharma.products p ON p.product_id=ps.product_id
    WHERE p.product_code='PRED-OS-15MG-5ML'
),
eq AS (
    SELECT equipment_code, equipment_id FROM pharma.equipment
),
run_seed AS (
    SELECT * FROM (VALUES
      ('PRED-OS-260801','DISPENSE','SCALE-101','completed',TIMESTAMPTZ '2026-08-01 07:30:00-04',TIMESTAMPTZ '2026-08-01 08:35:00-04',3900,'Sam Rivera','All materials verified.'),
      ('PRED-OS-260801','PREMIX','MIX-201','completed',TIMESTAMPTZ '2026-08-01 09:00:00-04',TIMESTAMPTZ '2026-08-01 09:28:00-04',1680,'Taylor Brooks','Premix complete.'),
      ('PRED-OS-260801','MAIN-MIX','MIX-201','completed',TIMESTAMPTZ '2026-08-01 09:40:00-04',TIMESTAMPTZ '2026-08-01 11:12:00-04',5520,'Taylor Brooks','Main mix complete.'),
      ('PRED-OS-260801','HOLD','HOLD-301','completed',TIMESTAMPTZ '2026-08-01 11:25:00-04',TIMESTAMPTZ '2026-08-01 12:20:00-04',3300,'Jordan Miles','Transferred to hold tank.'),
      ('PRED-OS-260801','FILL-PACK','FILL-401','completed',TIMESTAMPTZ '2026-08-02 08:00:00-04',TIMESTAMPTZ '2026-08-02 10:05:00-04',7500,'Chris Nolan','Packaging completed.'),
      ('PRED-OS-260801','QC-REVIEW','PH-501','completed',TIMESTAMPTZ '2026-08-02 13:00:00-04',TIMESTAMPTZ '2026-08-02 14:10:00-04',4200,'Dana Lewis','Batch acceptable for release.'),

      ('PRED-OS-260812','DISPENSE','SCALE-101','completed',TIMESTAMPTZ '2026-08-12 07:25:00-04',TIMESTAMPTZ '2026-08-12 08:30:00-04',3900,'Sam Rivera','All materials verified.'),
      ('PRED-OS-260812','PREMIX','MIX-201','completed',TIMESTAMPTZ '2026-08-12 08:50:00-04',TIMESTAMPTZ '2026-08-12 09:22:00-04',1920,'Taylor Brooks','Premix completed with extended agitation.'),
      ('PRED-OS-260812','MAIN-MIX','MIX-201','completed',TIMESTAMPTZ '2026-08-12 09:35:00-04',TIMESTAMPTZ '2026-08-12 11:18:00-04',6180,'Taylor Brooks','One mixing-speed excursion recorded.'),
      ('PRED-OS-260812','HOLD','HOLD-301','completed',TIMESTAMPTZ '2026-08-12 11:30:00-04',TIMESTAMPTZ '2026-08-12 12:25:00-04',3300,'Jordan Miles','Hold completed.'),
      ('PRED-OS-260812','FILL-PACK','FILL-401','completed',TIMESTAMPTZ '2026-08-12 13:15:00-04',TIMESTAMPTZ '2026-08-12 15:30:00-04',8100,'Chris Nolan','Packaging completed; reject count elevated.'),
      ('PRED-OS-260812','QC-REVIEW','PH-501','running',TIMESTAMPTZ '2026-08-12 16:00:00-04',NULL::timestamptz,NULL::int,'Dana Lewis','Quality review in progress.'),

      ('PRED-OS-260819','DISPENSE','SCALE-101','pending',NULL::timestamptz,NULL::timestamptz,NULL::int,NULL::text,'Materials reserved; awaiting dispensing.')
    ) AS v(batch_number,step_code,equipment_code,status,started_at,completed_at,actual_duration_seconds,operator_name,notes)
)
INSERT INTO pharma.process_runs
    (batch_id, process_step_id, equipment_id, run_number, status,
     started_at, completed_at, actual_duration_seconds, operator_name, notes)
SELECT
    b.batch_id,
    sm.process_step_id,
    eq.equipment_id,
    1,
    rs.status,
    rs.started_at,
    rs.completed_at,
    rs.actual_duration_seconds,
    rs.operator_name,
    rs.notes
FROM run_seed rs
JOIN pharma.batches b ON b.batch_number=rs.batch_number
JOIN step_map sm ON sm.step_code=rs.step_code
LEFT JOIN eq ON eq.equipment_code=rs.equipment_code
WHERE NOT EXISTS (
    SELECT 1 FROM pharma.process_runs pr
    WHERE pr.batch_id=b.batch_id
      AND pr.process_step_id=sm.process_step_id
      AND pr.run_number=1
);

-- ------------------------------------------------------------
-- 22. PROCESS PARAMETERS
-- ------------------------------------------------------------
WITH runs AS (
    SELECT pr.process_run_id, b.batch_number, ps.step_code
    FROM pharma.process_runs pr
    JOIN pharma.batches b ON b.batch_id=pr.batch_id
    JOIN pharma.process_steps ps ON ps.process_step_id=pr.process_step_id
)
INSERT INTO pharma.process_parameters
    (process_run_id, parameter_name, parameter_type, target_value,
     actual_value, lower_limit, upper_limit, unit_of_measure,
     within_spec, recorded_at)
SELECT
    r.process_run_id,
    v.parameter_name,
    'CPP',
    v.target_value,
    v.actual_value,
    v.lower_limit,
    v.upper_limit,
    v.unit_of_measure,
    v.within_spec,
    v.recorded_at
FROM (
    VALUES
      ('PRED-OS-260801','MAIN-MIX','Mixing Speed',350.0,348.0,330.0,370.0,'rpm',true,TIMESTAMPTZ '2026-08-01 10:15:00-04'),
      ('PRED-OS-260801','MAIN-MIX','Product Temperature',22.0,22.4,20.0,25.0,'C',true,TIMESTAMPTZ '2026-08-01 10:20:00-04'),
      ('PRED-OS-260801','MAIN-MIX','pH',3.8,3.82,3.5,4.1,'pH',true,TIMESTAMPTZ '2026-08-01 11:00:00-04'),
      ('PRED-OS-260801','HOLD','Hold Temperature',22.0,22.1,20.0,25.0,'C',true,TIMESTAMPTZ '2026-08-01 12:00:00-04'),

      ('PRED-OS-260812','MAIN-MIX','Mixing Speed',350.0,382.0,330.0,370.0,'rpm',false,TIMESTAMPTZ '2026-08-12 10:05:00-04'),
      ('PRED-OS-260812','MAIN-MIX','Product Temperature',22.0,23.2,20.0,25.0,'C',true,TIMESTAMPTZ '2026-08-12 10:15:00-04'),
      ('PRED-OS-260812','MAIN-MIX','pH',3.8,3.95,3.5,4.1,'pH',true,TIMESTAMPTZ '2026-08-12 11:05:00-04'),
      ('PRED-OS-260812','HOLD','Hold Temperature',22.0,22.7,20.0,25.0,'C',true,TIMESTAMPTZ '2026-08-12 12:00:00-04')
) AS v(batch_number,step_code,parameter_name,target_value,actual_value,lower_limit,upper_limit,unit_of_measure,within_spec,recorded_at)
JOIN runs r
  ON r.batch_number=v.batch_number AND r.step_code=v.step_code
WHERE NOT EXISTS (
    SELECT 1 FROM pharma.process_parameters pp
    WHERE pp.process_run_id=r.process_run_id
      AND pp.parameter_name=v.parameter_name
      AND pp.recorded_at=v.recorded_at
);

-- ------------------------------------------------------------
-- 23. PACKAGING RECORDS
-- ------------------------------------------------------------
WITH eq AS (
    SELECT equipment_id FROM pharma.equipment WHERE equipment_code='FILL-401'
)
INSERT INTO pharma.packaging_records
    (batch_id, equipment_id, packaging_line, package_type,
     target_units, produced_units, rejected_units, status,
     started_at, completed_at)
SELECT
    b.batch_id, (SELECT equipment_id FROM eq),
    'PKG-01','100 mL bottle',
    v.target_units,v.produced_units,v.rejected_units,v.status,
    v.started_at,v.completed_at
FROM (
    VALUES
      ('PRED-OS-260801',1000::bigint,996::bigint,4::bigint,'completed',
       TIMESTAMPTZ '2026-08-02 08:00:00-04',TIMESTAMPTZ '2026-08-02 10:05:00-04'),
      ('PRED-OS-260812',1000::bigint,992::bigint,8::bigint,'completed',
       TIMESTAMPTZ '2026-08-12 13:15:00-04',TIMESTAMPTZ '2026-08-12 15:30:00-04'),
      ('PRED-OS-260819',1000::bigint,NULL::bigint,0::bigint,'pending',
       NULL::timestamptz,NULL::timestamptz)
) AS v(batch_number,target_units,produced_units,rejected_units,status,started_at,completed_at)
JOIN pharma.batches b ON b.batch_number=v.batch_number
WHERE NOT EXISTS (
    SELECT 1 FROM pharma.packaging_records pr
    WHERE pr.batch_id=b.batch_id
      AND COALESCE(pr.packaging_line,'')='PKG-01'
);

-- ------------------------------------------------------------
-- 24. QUALITY RESULTS
-- ------------------------------------------------------------
INSERT INTO pharma.quality_results
    (batch_id, test_name, test_method, sample_id,
     result_numeric, result_text, lower_spec_limit, upper_spec_limit,
     unit_of_measure, disposition, tested_at, analyst_name)
SELECT
    b.batch_id,
    v.test_name,
    v.test_method,
    v.sample_id,
    v.result_numeric,
    v.result_text,
    v.lower_spec_limit,
    v.upper_spec_limit,
    v.unit_of_measure,
    v.disposition,
    v.tested_at,
    v.analyst_name
FROM (
    VALUES
      ('PRED-OS-260801','Assay','HPLC-Demo','QC-260801-A',99.4::numeric,NULL::text,95.0::numeric,105.0::numeric,'% label claim','pass',TIMESTAMPTZ '2026-08-02 12:15:00-04','Dana Lewis'),
      ('PRED-OS-260801','pH','USP-Demo-pH','QC-260801-PH',3.82::numeric,NULL::text,3.5::numeric,4.1::numeric,'pH','pass',TIMESTAMPTZ '2026-08-02 12:20:00-04','Dana Lewis'),
      ('PRED-OS-260801','Appearance','Visual','QC-260801-V',NULL::numeric,'Clear red-cherry solution; no visible particulates.',NULL::numeric,NULL::numeric,NULL::text,'pass',TIMESTAMPTZ '2026-08-02 12:25:00-04','Dana Lewis'),

      ('PRED-OS-260812','Assay','HPLC-Demo','QC-260812-A',101.2::numeric,NULL::text,95.0::numeric,105.0::numeric,'% label claim','pass',TIMESTAMPTZ '2026-08-12 16:20:00-04','Dana Lewis'),
      ('PRED-OS-260812','pH','USP-Demo-pH','QC-260812-PH',3.95::numeric,NULL::text,3.5::numeric,4.1::numeric,'pH','pass',TIMESTAMPTZ '2026-08-12 16:25:00-04','Dana Lewis'),
      ('PRED-OS-260812','Appearance','Visual','QC-260812-V',NULL::numeric,'Initial sample showed slight foam; repeat visual review acceptable.',NULL::numeric,NULL::numeric,NULL::text,'retest',TIMESTAMPTZ '2026-08-12 16:30:00-04','Dana Lewis'),
      ('PRED-OS-260812','Appearance Retest','Visual','QC-260812-VR',NULL::numeric,'Clear red-cherry solution after deaeration hold.',NULL::numeric,NULL::numeric,NULL::text,'pass',TIMESTAMPTZ '2026-08-12 17:10:00-04','Dana Lewis'),

      ('PRED-OS-260819','Assay','HPLC-Demo','QC-260819-A',NULL::numeric,'Pending sample',95.0::numeric,105.0::numeric,'% label claim','pending',NULL::timestamptz,NULL::text)
) AS v(batch_number,test_name,test_method,sample_id,result_numeric,result_text,lower_spec_limit,upper_spec_limit,unit_of_measure,disposition,tested_at,analyst_name)
JOIN pharma.batches b ON b.batch_number=v.batch_number
WHERE NOT EXISTS (
    SELECT 1 FROM pharma.quality_results qr
    WHERE qr.batch_id=b.batch_id
      AND qr.test_name=v.test_name
      AND COALESCE(qr.sample_id,'')=COALESCE(v.sample_id,'')
);

-- ------------------------------------------------------------
-- 25. DEVIATIONS
-- ------------------------------------------------------------
WITH mix_run AS (
    SELECT pr.process_run_id, b.batch_number
    FROM pharma.process_runs pr
    JOIN pharma.batches b ON b.batch_id=pr.batch_id
    JOIN pharma.process_steps ps ON ps.process_step_id=pr.process_step_id
    WHERE ps.step_code='MAIN-MIX'
),
fill_eq AS (
    SELECT equipment_id FROM pharma.equipment WHERE equipment_code='FILL-401'
)
INSERT INTO pharma.deviations
    (deviation_number, batch_id, process_run_id, equipment_id,
     severity, category, description, status, opened_at, closed_at,
     root_cause, corrective_action)
SELECT
    v.deviation_number,
    b.batch_id,
    CASE WHEN v.step_code='MAIN-MIX' THEN mr.process_run_id ELSE NULL END,
    CASE WHEN v.category='Packaging' THEN (SELECT equipment_id FROM fill_eq) ELSE NULL END,
    v.severity,
    v.category,
    v.description,
    v.status,
    v.opened_at,
    v.closed_at,
    v.root_cause,
    v.corrective_action
FROM (
    VALUES
      ('DEV-260801-001','PRED-OS-260801',NULL::text,'minor','Documentation',
       'Second-person verification timestamp entered 8 minutes late; material identity and quantity were unaffected.',
       'closed',TIMESTAMPTZ '2026-08-01 08:40:00-04',TIMESTAMPTZ '2026-08-01 13:20:00-04',
       'Operator completed physical verification before documenting the electronic timestamp.',
       'Refresher coaching completed; no product impact identified.'),
      ('DEV-260812-001','PRED-OS-260812','MAIN-MIX','major','Process',
       'Mixing speed briefly exceeded the demonstration upper limit during main compounding.',
       'investigating',TIMESTAMPTZ '2026-08-12 10:06:00-04',NULL::timestamptz,
       'Preliminary review indicates controller setpoint overshoot following manual speed adjustment.',
       'Engineering review and batch impact assessment in progress.'),
      ('DEV-260812-002','PRED-OS-260812',NULL::text,'minor','Packaging',
       'Packaging reject count exceeded the normal demonstration baseline due to cap-torque rejects.',
       'capa',TIMESTAMPTZ '2026-08-12 14:45:00-04',NULL::timestamptz,
       'Capper torque drift observed during the middle of the run.',
       'Line setup check and torque verification frequency increased for next run.')
) AS v(deviation_number,batch_number,step_code,severity,category,description,status,opened_at,closed_at,root_cause,corrective_action)
JOIN pharma.batches b ON b.batch_number=v.batch_number
LEFT JOIN mix_run mr
  ON mr.batch_number=v.batch_number AND v.step_code='MAIN-MIX'
ON CONFLICT (deviation_number) DO UPDATE SET
    batch_id = EXCLUDED.batch_id,
    process_run_id = EXCLUDED.process_run_id,
    equipment_id = EXCLUDED.equipment_id,
    severity = EXCLUDED.severity,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    opened_at = EXCLUDED.opened_at,
    closed_at = EXCLUDED.closed_at,
    root_cause = EXCLUDED.root_cause,
    corrective_action = EXCLUDED.corrective_action,
    updated_at = now();

-- ------------------------------------------------------------
-- 26. REFLECT RESERVATION / ISSUE STATE IN LOT BALANCES
--     Only adjusts the 26 seeded lots and recomputes from seeded
--     transaction records so reruns remain stable.
-- ------------------------------------------------------------
WITH reservation_totals AS (
    SELECT
        material_lot_id,
        SUM(reserved_quantity) FILTER (WHERE status='reserved') AS open_reserved
    FROM supply.material_reservations
    GROUP BY material_lot_id
),
issue_totals AS (
    SELECT
        material_lot_id,
        SUM(issued_quantity) AS issued
    FROM supply.material_issues
    GROUP BY material_lot_id
),
calc AS (
    SELECT
        ml.material_lot_id,
        ml.received_quantity,
        COALESCE(rt.open_reserved,0) AS open_reserved,
        COALESCE(it.issued,0) AS issued
    FROM supply.material_lots ml
    LEFT JOIN reservation_totals rt
      ON rt.material_lot_id=ml.material_lot_id
    LEFT JOIN issue_totals it
      ON it.material_lot_id=ml.material_lot_id
    WHERE ml.internal_lot_number LIKE '%-26A07%'
)
UPDATE supply.material_lots ml
SET reserved_quantity = calc.open_reserved,
    available_quantity = GREATEST(calc.received_quantity - calc.issued - calc.open_reserved,0),
    status = CASE
               WHEN calc.received_quantity - calc.issued - calc.open_reserved <= 0 THEN 'depleted'
               WHEN calc.open_reserved > 0 THEN 'reserved'
               ELSE 'released'
             END,
    updated_at = now()
FROM calc
WHERE ml.material_lot_id=calc.material_lot_id;

COMMIT;

-- ============================================================
-- VALIDATION QUERIES
-- ============================================================

-- Master / transaction counts
SELECT 'pharma.products' AS object_name, COUNT(*) AS row_count FROM pharma.products
UNION ALL SELECT 'pharma.materials', COUNT(*) FROM pharma.materials
UNION ALL SELECT 'pharma.production_orders', COUNT(*) FROM pharma.production_orders
UNION ALL SELECT 'pharma.batches', COUNT(*) FROM pharma.batches
UNION ALL SELECT 'pharma.batch_materials', COUNT(*) FROM pharma.batch_materials
UNION ALL SELECT 'pharma.process_runs', COUNT(*) FROM pharma.process_runs
UNION ALL SELECT 'pharma.process_parameters', COUNT(*) FROM pharma.process_parameters
UNION ALL SELECT 'pharma.packaging_records', COUNT(*) FROM pharma.packaging_records
UNION ALL SELECT 'pharma.quality_results', COUNT(*) FROM pharma.quality_results
UNION ALL SELECT 'pharma.deviations', COUNT(*) FROM pharma.deviations
UNION ALL SELECT 'supply.suppliers', COUNT(*) FROM supply.suppliers
UNION ALL SELECT 'supply.material_catalog', COUNT(*) FROM supply.material_catalog
UNION ALL SELECT 'supply.material_lots', COUNT(*) FROM supply.material_lots
UNION ALL SELECT 'supply.material_requests', COUNT(*) FROM supply.material_requests
UNION ALL SELECT 'supply.material_request_lines', COUNT(*) FROM supply.material_request_lines
UNION ALL SELECT 'supply.material_reservations', COUNT(*) FROM supply.material_reservations
UNION ALL SELECT 'supply.picking_transactions', COUNT(*) FROM supply.picking_transactions
UNION ALL SELECT 'supply.weighing_transactions', COUNT(*) FROM supply.weighing_transactions
UNION ALL SELECT 'supply.material_issues', COUNT(*) FROM supply.material_issues
ORDER BY object_name;

-- Confirm two lots per formulation material
SELECT
    mc.material_code,
    mc.material_name,
    COUNT(ml.material_lot_id) AS lot_count,
    SUM(ml.available_quantity) AS available_quantity,
    SUM(ml.reserved_quantity) AS reserved_quantity,
    mc.unit_of_measure
FROM supply.material_catalog mc
LEFT JOIN supply.material_lots ml
  ON ml.supply_material_id=mc.supply_material_id
WHERE mc.material_code IN (
  '9PHQ9Y1OLM','3K9958V90M','XF417D3PSL','8SKN0B0MIM','BUC5I9595W',
  '7FLD91C86K','H3R47K3TBD','WZB9127XOA','PDC6A3C0OX','6DC9Q167V3',
  'SB8ZUX40TY','C151H8M554','059QF0KO0R'
)
GROUP BY mc.material_code, mc.material_name, mc.unit_of_measure
ORDER BY mc.material_name;

-- End-to-end traceability: Supply -> Pharma
SELECT
    b.batch_number,
    po.po_number AS pharma_po,
    pm.material_code,
    pm.material_name,
    bm.material_lot,
    bm.required_quantity,
    bm.actual_quantity,
    bm.unit_of_measure,
    bm.weighing_status,
    mr.request_number,
    r.status AS reservation_status,
    wt.status AS weighing_status_supply,
    wt.tare_confirmed,
    mi.material_issue_id IS NOT NULL AS issued_to_pharma
FROM pharma.batch_materials bm
JOIN pharma.batches b ON b.batch_id=bm.batch_id
JOIN pharma.production_orders po ON po.production_order_id=b.production_order_id
JOIN pharma.materials pm ON pm.material_id=bm.material_id
LEFT JOIN supply.material_request_lines mrl
  ON mrl.pharma_batch_material_id=bm.batch_material_id
LEFT JOIN supply.material_requests mr
  ON mr.material_request_id=mrl.material_request_id
LEFT JOIN supply.material_reservations r
  ON r.material_request_line_id=mrl.material_request_line_id
LEFT JOIN supply.weighing_transactions wt
  ON wt.pharma_batch_material_id=bm.batch_material_id
LEFT JOIN supply.material_issues mi
  ON mi.pharma_batch_material_id=bm.batch_material_id
WHERE b.batch_number IN ('PRED-OS-260801','PRED-OS-260812','PRED-OS-260819')
ORDER BY b.batch_number, pm.material_name;

-- Batch summary
SELECT *
FROM pharma.batch_process_summary
WHERE batch_number IN ('PRED-OS-260801','PRED-OS-260812','PRED-OS-260819')
ORDER BY batch_number;

-- Supply fulfillment view
SELECT *
FROM supply.pharma_material_fulfillment
WHERE batch_number IN ('PRED-OS-260801','PRED-OS-260812','PRED-OS-260819')
ORDER BY batch_number, material_name;