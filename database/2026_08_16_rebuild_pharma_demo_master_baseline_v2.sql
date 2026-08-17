BEGIN;

-- =====================================================================
-- EES PHARMA DEMO MASTER BASELINE V2
-- =====================================================================
-- Rebuilds the CURRENT approved demo baseline after the earlier reset
-- captured an obsolete state.
--
-- Baseline rules:
--   * USP Water is automatic utility feed -- NO water bulk tank.
--   * PPG and Glycerin begin with 18,000 kg available.
--   * HFCS bulk tank is present at 18,000 kg.
--   * TANK-X is an overage Sucrose tank at 18,000 kg.
--   * CW-Staging contains a lean one-batch starter inventory.
--   * Alcohol and flavors stage in CWH-Staging and remain Hazardous.
--   * Approved emergency alternates and R&D/Natural candidates are restored.
--   * Warehouse values below are the reset TARGET, separate from staging.
-- =====================================================================

-- ---------------------------------------------------------------------
-- LOCATIONS
-- ---------------------------------------------------------------------
INSERT INTO supply.inventory_locations(
    location_code, location_name, location_type, status
)
VALUES
    ('WH-API-A01','API Warehouse A01','warehouse','available'),
    ('WH-EXC-B01','Excipient Warehouse B01','warehouse','available'),
    ('WH-RND-R01','R&D Development Material Storage','warehouse','available')
ON CONFLICT(location_code) DO UPDATE SET
    location_name=EXCLUDED.location_name,
    location_type=EXCLUDED.location_type,
    status='available',
    updated_at=now();

-- ---------------------------------------------------------------------
-- MATERIAL MASTER
-- ---------------------------------------------------------------------
WITH desired(material_code,material_name,material_type,uom,reorder_point,reorder_quantity) AS (
    VALUES
      -- Approved production formulation materials
      ('9PHQ9Y1OLM','Prednisolone','api','kg',152.5,610.0),
      ('3K9958V90M','Alcohol','excipient','kg',10.0,80.0),
      ('XF417D3PSL','Anhydrous Citric Acid','excipient','kg',14.2,85.2),
      ('8SKN0B0MIM','Benzoic Acid','excipient','kg',34.3,205.8),
      ('7FLD91C86K','Edetate Disodium','excipient','kg',20.0,120.0),
      ('SB8ZUX40TY','Saccharin Sodium','excipient','kg',37.0,222.0),
      ('BUC5I9595W','Cherry','excipient','kg',17.8,106.8),
      ('FLV-STRAWBERRY-001','Strawberry','excipient','kg',17.8,106.8),
      ('FLV-GRAPE-001','Grape','excipient','kg',17.8,106.8),
      ('FLV-BERRY-001','Berry','excipient','kg',17.8,106.8),
      ('H3R47K3TBD','FD&C Blue No. 1','excipient','kg',1.2,6.0),
      ('WZB9127XOA','FD&C Red No. 40','excipient','kg',1.2,6.0),
      ('DYE-RED33-001','FD&C Red No. 33','excipient','kg',1.2,6.0),
      ('DYE-YELLOW5-001','FD&C Yellow No. 5','excipient','kg',1.2,6.0),

      -- Bulk recipe materials. Water stays in the formula/MES master but
      -- is supplied automatically by USP utility; there is no water tank.
      ('059QF0KO0R','USP Purified Water','processing-aid','kg',0,0),
      ('PDC6A3C0OX','Glycerin','excipient','kg',920,5520),
      ('6DC9Q167V3','Propylene Glycol','excipient','kg',750,4500),
      ('C151H8M554','Sucrose','excipient','kg',2175,13050),
      ('HFCS-001','High Fructose Corn Syrup','excipient','kg',1000,18000),

      -- Approved emergency alternatives
      ('ALT-PSP-001','Prednisolone Sodium Phosphate','api','kg',50,300),
      ('ALT-ETH-001','Ethyl Alcohol','excipient','kg',10,80),
      ('ALT-MSP-001','Monobasic Sodium Phosphate','excipient','kg',10,100),
      ('ALT-SBEN-001','Sodium Benzoate','excipient','kg',20,160),
      ('ALT-EDTA-001','EDTA','excipient','kg',10,100),
      ('ALT-SUCR-001','Sucralose','excipient','kg',20,160),
      ('ART-CHERRY-001','ART Cherry','excipient','kg',10,80),
      ('ART-GRAPE-001','ART Grape','excipient','kg',10,80),
      ('ART-STRAWBERRY-001','ART Strawberry','excipient','kg',10,80),
      ('ART-BERRY-001','ART Berry','excipient','kg',10,80),

      -- R&D candidates - not automatically approved for production
      ('RND-PRED-FINE-001','Prednisolone Fine','api','kg',5,50),
      ('RND-ETHANOL5-001','Ethanol 5%','excipient','kg',5,50),
      ('RND-SODIUM-SUCRALOSE-001','Sodium Sucralose','excipient','kg',5,50),
      ('RND-SODIUM-CITRATE-001','Sodium Citrate','excipient','kg',5,50),
      ('RND-CITRIC-001','Citric Acid','excipient','kg',5,50),
      ('RND-SODIUM-PHOSPHATE-001','Sodium Phosphate','excipient','kg',5,50),
      ('NAT-CHERRY-001','Natural Cherry','excipient','kg',5,25),
      ('NAT-GRAPE-001','Natural Grape','excipient','kg',5,25),
      ('NAT-STRAWBERRY-001','Natural Strawberry','excipient','kg',5,25),
      ('NAT-BERRY-001','Natural Berry','excipient','kg',5,25)
)
INSERT INTO supply.material_catalog(
    material_code, material_name, material_type, unit_of_measure,
    reorder_point, reorder_quantity, active, updated_at
)
SELECT
    material_code,material_name,material_type,uom,
    reorder_point,reorder_quantity,true,now()
FROM desired
ON CONFLICT(material_code) DO UPDATE SET
    material_name=EXCLUDED.material_name,
    material_type=EXCLUDED.material_type,
    unit_of_measure=EXCLUDED.unit_of_measure,
    reorder_point=EXCLUDED.reorder_point,
    reorder_quantity=EXCLUDED.reorder_quantity,
    active=true,
    updated_at=now();

-- ---------------------------------------------------------------------
-- WAREHOUSE RESET TARGET
-- ---------------------------------------------------------------------
-- Quantities intentionally support realistic campaigns while retaining
-- distinct lots for FEFO, multi-lot weighing, shortage/substitution testing.
WITH desired(
    material_code,lot_number,qty,uom,location_code,expiry_date
) AS (
    VALUES
      ('9PHQ9Y1OLM','PRD-26A0708-01',305.0000,'kg','WH-API-A01',DATE '2028-07-08'),
      ('9PHQ9Y1OLM','PRD-26A0708-02',305.0000,'kg','WH-API-A01',DATE '2028-07-08'),
      ('3K9958V90M','ALC-26A0709-01',40.0000,'kg','WH-EXC-B01',DATE '2028-07-09'),
      ('3K9958V90M','ALC-26A0709-02',40.0000,'kg','WH-EXC-B01',DATE '2028-07-09'),
      ('XF417D3PSL','CIT-26A0709-01',42.6000,'kg','WH-EXC-B01',DATE '2029-07-09'),
      ('XF417D3PSL','CIT-26A0709-02',28.4000,'kg','WH-EXC-B01',DATE '2029-07-09'),
      ('8SKN0B0MIM','BEN-26A0709-01',102.9000,'kg','WH-EXC-B01',DATE '2029-07-09'),
      ('8SKN0B0MIM','BEN-26A0709-02',68.6000,'kg','WH-EXC-B01',DATE '2029-07-09'),
      ('7FLD91C86K','EDT-26A0709-01',60.0000,'kg','WH-EXC-B01',DATE '2029-07-09'),
      ('7FLD91C86K','EDT-26A0709-02',40.0000,'kg','WH-EXC-B01',DATE '2029-07-09'),
      ('SB8ZUX40TY','SAC-26A0709-01',111.0000,'kg','WH-EXC-B01',DATE '2029-07-09'),
      ('SB8ZUX40TY','SAC-26A0709-02',74.0000,'kg','WH-EXC-B01',DATE '2029-07-09'),

      ('BUC5I9595W','CHR-26A0710-01',53.4000,'kg','WH-EXC-B01',DATE '2027-07-10'),
      ('BUC5I9595W','CHR-26A0710-02',35.6000,'kg','WH-EXC-B01',DATE '2027-07-10'),
      ('FLV-STRAWBERRY-001','STR-26A0812-01',53.4000,'kg','WH-EXC-B01',DATE '2027-08-12'),
      ('FLV-STRAWBERRY-001','STR-26A0812-02',35.6000,'kg','WH-EXC-B01',DATE '2027-08-12'),
      ('FLV-GRAPE-001','GRP-26A0812-01',53.4000,'kg','WH-EXC-B01',DATE '2027-08-12'),
      ('FLV-GRAPE-001','GRP-26A0812-02',35.6000,'kg','WH-EXC-B01',DATE '2027-08-12'),
      ('FLV-BERRY-001','BRY-26A0812-01',53.4000,'kg','WH-EXC-B01',DATE '2027-08-12'),
      ('FLV-BERRY-001','BRY-26A0812-02',35.6000,'kg','WH-EXC-B01',DATE '2027-08-12'),

      ('H3R47K3TBD','BLU-26A0710-01',2.4000,'kg','WH-EXC-B01',DATE '2029-07-10'),
      ('H3R47K3TBD','BLU-26A0710-02',1.2000,'kg','WH-EXC-B01',DATE '2029-07-10'),
      ('WZB9127XOA','RED-26A0710-01',2.4000,'kg','WH-EXC-B01',DATE '2029-07-10'),
      ('WZB9127XOA','RED-26A0710-02',1.2000,'kg','WH-EXC-B01',DATE '2029-07-10'),
      ('DYE-RED33-001','R33-26A0812-01',2.4000,'kg','WH-EXC-B01',DATE '2028-08-12'),
      ('DYE-RED33-001','R33-26A0812-02',1.2000,'kg','WH-EXC-B01',DATE '2028-08-12'),
      ('DYE-YELLOW5-001','Y05-26A0812-01',2.4000,'kg','WH-EXC-B01',DATE '2028-08-12'),
      ('DYE-YELLOW5-001','Y05-26A0812-02',1.2000,'kg','WH-EXC-B01',DATE '2028-08-12'),

      -- Approved substitutes
      ('ALT-PSP-001','PSP-26A0816-01',300.0000,'kg','WH-API-A01',DATE '2028-08-16'),
      ('ALT-ETH-001','ETH-26A0816-01',80.0000,'kg','WH-EXC-B01',DATE '2028-08-16'),
      ('ALT-MSP-001','MSP-26A0816-01',100.0000,'kg','WH-EXC-B01',DATE '2029-08-16'),
      ('ALT-SBEN-001','SBN-26A0816-01',160.0000,'kg','WH-EXC-B01',DATE '2029-08-16'),
      ('ALT-EDTA-001','EDA-26A0816-01',100.0000,'kg','WH-EXC-B01',DATE '2029-08-16'),
      ('ALT-SUCR-001','SCL-26A0816-01',160.0000,'kg','WH-EXC-B01',DATE '2029-08-16'),
      ('ART-CHERRY-001','ACH-26A0816-01',80.0000,'kg','WH-EXC-B01',DATE '2027-08-16'),
      ('ART-GRAPE-001','AGR-26A0816-01',80.0000,'kg','WH-EXC-B01',DATE '2027-08-16'),
      ('ART-STRAWBERRY-001','AST-26A0816-01',80.0000,'kg','WH-EXC-B01',DATE '2027-08-16'),
      ('ART-BERRY-001','ABR-26A0816-01',80.0000,'kg','WH-EXC-B01',DATE '2027-08-16'),

      -- R&D development inventory
      ('RND-PRED-FINE-001','RPF-26A0816-01',50.0000,'kg','WH-RND-R01',DATE '2028-08-16'),
      ('RND-ETHANOL5-001','ET5-26A0816-01',50.0000,'kg','WH-RND-R01',DATE '2028-08-16'),
      ('RND-SODIUM-SUCRALOSE-001','SSU-26A0816-01',50.0000,'kg','WH-RND-R01',DATE '2029-08-16'),
      ('RND-SODIUM-CITRATE-001','SCI-26A0816-01',50.0000,'kg','WH-RND-R01',DATE '2029-08-16'),
      ('RND-CITRIC-001','RCA-26A0816-01',50.0000,'kg','WH-RND-R01',DATE '2029-08-16'),
      ('RND-SODIUM-PHOSPHATE-001','SPO-26A0816-01',50.0000,'kg','WH-RND-R01',DATE '2029-08-16'),
      ('NAT-CHERRY-001','NCH-26A0816-01',25.0000,'kg','WH-RND-R01',DATE '2027-08-16'),
      ('NAT-GRAPE-001','NGR-26A0816-01',25.0000,'kg','WH-RND-R01',DATE '2027-08-16'),
      ('NAT-STRAWBERRY-001','NST-26A0816-01',25.0000,'kg','WH-RND-R01',DATE '2027-08-16'),
      ('NAT-BERRY-001','NBR-26A0816-01',25.0000,'kg','WH-RND-R01',DATE '2027-08-16')
)
INSERT INTO supply.material_lots(
    supply_material_id,
    internal_lot_number,
    received_quantity,
    available_quantity,
    reserved_quantity,
    unit_of_measure,
    status,
    received_at,
    expiry_date,
    location_id,
    updated_at
)
SELECT
    mc.supply_material_id,
    d.lot_number,
    d.qty,
    d.qty,
    0,
    d.uom,
    'available',
    now(),
    d.expiry_date,
    il.location_id,
    now()
FROM desired d
JOIN supply.material_catalog mc ON mc.material_code=d.material_code
JOIN supply.inventory_locations il ON il.location_code=d.location_code
ON CONFLICT(internal_lot_number) DO UPDATE SET
    supply_material_id=EXCLUDED.supply_material_id,
    received_quantity=EXCLUDED.received_quantity,
    available_quantity=EXCLUDED.available_quantity,
    reserved_quantity=0,
    unit_of_measure=EXCLUDED.unit_of_measure,
    status='available',
    expiry_date=EXCLUDED.expiry_date,
    location_id=EXCLUDED.location_id,
    updated_at=now();

-- ---------------------------------------------------------------------
-- ALTERNATE QUALIFICATION MASTER
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.material_alternative_qualifications (
    candidate_code varchar(100) PRIMARY KEY,
    candidate_name varchar(200) NOT NULL,
    target_material_code varchar(100) NOT NULL,
    approval_status varchar(80) NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.material_alternative_qualifications
    ADD COLUMN IF NOT EXISTS candidate_name varchar(200),
    ADD COLUMN IF NOT EXISTS target_material_code varchar(100),
    ADD COLUMN IF NOT EXISTS approval_status varchar(80),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.material_alternative_qualifications(
    candidate_code,candidate_name,target_material_code,approval_status,updated_at
)
VALUES
  ('ALT-PSP-001','Prednisolone Sodium Phosphate','9PHQ9Y1OLM','Approved',now()),
  ('ALT-ETH-001','Ethyl Alcohol','3K9958V90M','Approved',now()),
  ('ALT-MSP-001','Monobasic Sodium Phosphate','XF417D3PSL','Approved',now()),
  ('ALT-SBEN-001','Sodium Benzoate','8SKN0B0MIM','Approved',now()),
  ('ALT-EDTA-001','EDTA','7FLD91C86K','Approved',now()),
  ('ALT-SUCR-001','Sucralose','SB8ZUX40TY','Approved',now()),
  ('ART-CHERRY-001','ART Cherry','BUC5I9595W','Approved',now()),
  ('ART-GRAPE-001','ART Grape','FLV-GRAPE-001','Approved',now()),
  ('ART-STRAWBERRY-001','ART Strawberry','FLV-STRAWBERRY-001','Approved',now()),
  ('ART-BERRY-001','ART Berry','FLV-BERRY-001','Approved',now()),

  ('RND-PRED-FINE-001','Prednisolone Fine','9PHQ9Y1OLM','R&D Required',now()),
  ('RND-ETHANOL5-001','Ethanol 5%','3K9958V90M','R&D Required',now()),
  ('RND-SODIUM-SUCRALOSE-001','Sodium Sucralose','SB8ZUX40TY','R&D Required',now()),
  ('RND-SODIUM-CITRATE-001','Sodium Citrate','XF417D3PSL','R&D Required',now()),
  ('RND-CITRIC-001','Citric Acid','XF417D3PSL','R&D Required',now()),
  ('RND-SODIUM-PHOSPHATE-001','Sodium Phosphate','XF417D3PSL','R&D Required',now()),
  ('NAT-CHERRY-001','Natural Cherry','BUC5I9595W','R&D Required',now()),
  ('NAT-GRAPE-001','Natural Grape','FLV-GRAPE-001','R&D Required',now()),
  ('NAT-STRAWBERRY-001','Natural Strawberry','FLV-STRAWBERRY-001','R&D Required',now()),
  ('NAT-BERRY-001','Natural Berry','FLV-BERRY-001','R&D Required',now())
ON CONFLICT(candidate_code) DO UPDATE SET
    candidate_name=EXCLUDED.candidate_name,
    target_material_code=EXCLUDED.target_material_code,
    approval_status=EXCLUDED.approval_status,
    updated_at=now();

-- ---------------------------------------------------------------------
-- HAZARD LABEL MASTER
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.material_hazard_labels (
    material_code varchar(100) PRIMARY KEY,
    hazard_class varchar(40) NOT NULL,
    label_text varchar(200) NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.material_hazard_labels(material_code,hazard_class,label_text,updated_at)
VALUES
  ('3K9958V90M','Hazardous','HAZARDOUS · Alcohol',now()),
  ('BUC5I9595W','Hazardous','HAZARDOUS · Flavor',now()),
  ('FLV-STRAWBERRY-001','Hazardous','HAZARDOUS · Flavor',now()),
  ('FLV-GRAPE-001','Hazardous','HAZARDOUS · Flavor',now()),
  ('FLV-BERRY-001','Hazardous','HAZARDOUS · Flavor',now()),
  ('ALT-ETH-001','Hazardous','HAZARDOUS · Alcohol Substitute',now()),
  ('ART-CHERRY-001','Hazardous','HAZARDOUS · Flavor',now()),
  ('ART-GRAPE-001','Hazardous','HAZARDOUS · Flavor',now()),
  ('ART-STRAWBERRY-001','Hazardous','HAZARDOUS · Flavor',now()),
  ('ART-BERRY-001','Hazardous','HAZARDOUS · Flavor',now()),
  ('RND-ETHANOL5-001','Hazardous','R&D HAZARDOUS · Ethanol',now()),
  ('NAT-CHERRY-001','Hazardous','R&D HAZARDOUS · Natural Flavor',now()),
  ('NAT-GRAPE-001','Hazardous','R&D HAZARDOUS · Natural Flavor',now()),
  ('NAT-STRAWBERRY-001','Hazardous','R&D HAZARDOUS · Natural Flavor',now()),
  ('NAT-BERRY-001','Hazardous','R&D HAZARDOUS · Natural Flavor',now())
ON CONFLICT(material_code) DO UPDATE SET
    hazard_class=EXCLUDED.hazard_class,
    label_text=EXCLUDED.label_text,
    updated_at=now();

-- ---------------------------------------------------------------------
-- LEAN CHEM WEIGH STAGING
-- ---------------------------------------------------------------------
DELETE FROM public.material_positions
WHERE location_code IN ('CW-STAGE-01','CW-HAZ-01');

INSERT INTO public.material_positions(
    container_id,material_code,material_name,lot_number,quantity,unit,
    location_code,status,hazard_class,campaign_id,po_number,pr_number,updated_at
)
VALUES
  ('BASE-STG-PRD-01','9PHQ9Y1OLM','Prednisolone','PRD-26A0708-01',152.5000,'kg','CW-STAGE-01','Available','General',NULL,NULL,NULL,now()),
  ('BASE-STG-CIT-01','XF417D3PSL','Anhydrous Citric Acid','CIT-26A0709-01',14.2000,'kg','CW-STAGE-01','Available','General',NULL,NULL,NULL,now()),
  ('BASE-STG-BEN-01','8SKN0B0MIM','Benzoic Acid','BEN-26A0709-01',34.3000,'kg','CW-STAGE-01','Available','General',NULL,NULL,NULL,now()),
  ('BASE-STG-EDT-01','7FLD91C86K','Edetate Disodium','EDT-26A0709-01',20.0000,'kg','CW-STAGE-01','Available','General',NULL,NULL,NULL,now()),
  ('BASE-STG-SAC-01','SB8ZUX40TY','Saccharin Sodium','SAC-26A0709-01',37.0000,'kg','CW-STAGE-01','Available','General',NULL,NULL,NULL,now()),
  ('BASE-STG-BLU-01','H3R47K3TBD','FD&C Blue No. 1','BLU-26A0710-01',1.2000,'kg','CW-STAGE-01','Available','General',NULL,NULL,NULL,now()),
  ('BASE-STG-RED-01','WZB9127XOA','FD&C Red No. 40','RED-26A0710-01',1.2000,'kg','CW-STAGE-01','Available','General',NULL,NULL,NULL,now()),
  ('BASE-STG-R33-01','DYE-RED33-001','FD&C Red No. 33','R33-26A0812-01',1.2000,'kg','CW-STAGE-01','Available','General',NULL,NULL,NULL,now()),
  ('BASE-STG-Y05-01','DYE-YELLOW5-001','FD&C Yellow No. 5','Y05-26A0812-01',1.2000,'kg','CW-STAGE-01','Available','General',NULL,NULL,NULL,now()),

  ('BASE-HAZ-ALC-01','3K9958V90M','Alcohol','ALC-26A0709-01',10.0000,'kg','CW-HAZ-01','Available','Hazardous',NULL,NULL,NULL,now()),
  ('BASE-HAZ-CHR-01','BUC5I9595W','Cherry','CHR-26A0710-01',17.8000,'kg','CW-HAZ-01','Available','Hazardous',NULL,NULL,NULL,now()),
  ('BASE-HAZ-STR-01','FLV-STRAWBERRY-001','Strawberry','STR-26A0812-01',17.8000,'kg','CW-HAZ-01','Available','Hazardous',NULL,NULL,NULL,now()),
  ('BASE-HAZ-GRP-01','FLV-GRAPE-001','Grape','GRP-26A0812-01',17.8000,'kg','CW-HAZ-01','Available','Hazardous',NULL,NULL,NULL,now()),
  ('BASE-HAZ-BRY-01','FLV-BERRY-001','Berry','BRY-26A0812-01',17.8000,'kg','CW-HAZ-01','Available','Hazardous',NULL,NULL,NULL,now());

-- ---------------------------------------------------------------------
-- BULK MASTER
-- ---------------------------------------------------------------------
-- Remove obsolete water tank. USP Purified Water is an automatic utility.
DELETE FROM public.bulk_tanks
WHERE tank_code IN ('PW-101','WATER-101','USP-WATER-101')
   OR lower(material_name) IN ('purified water','usp purified water');

-- PPG and Glycerin start with 18,000 kg available after every global reset.
INSERT INTO public.bulk_tanks(
    tank_code,material_code,material_name,capacity_kg,quantity_kg,
    qa_status,lot_number,temperature_c,status
)
VALUES
  ('PG-101','PG','Propylene Glycol',25000,18000,'Released','PG-26A0816-01',22,'Available'),
  ('GLY-101','GLY','Glycerin',25000,18000,'Released','GLY-26A0816-01',22,'Available'),
  ('SUC-101','SUC','Sucrose',20000,12000,'Released','SUC-26A0709-01',22,'Available'),
  ('HFCS-101','HFCS','High Fructose Corn Syrup',25000,18000,'Released','HFCS-26A0816-01',22,'Available'),
  ('TANK-X','SUC','Sucrose',25000,18000,'Released','SUC-X-26A0816-01',22,'Available')
ON CONFLICT(tank_code) DO UPDATE SET
    material_code=EXCLUDED.material_code,
    material_name=EXCLUDED.material_name,
    capacity_kg=EXCLUDED.capacity_kg,
    quantity_kg=EXCLUDED.quantity_kg,
    qa_status=EXCLUDED.qa_status,
    lot_number=EXCLUDED.lot_number,
    temperature_c=EXCLUDED.temperature_c,
    status=EXCLUDED.status;

-- ---------------------------------------------------------------------
-- REBUILD RESET BASELINES FROM THE CURRENT MASTER STATE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demo_supply_lot_baseline (
    internal_lot_number varchar(150) PRIMARY KEY,
    material_code varchar(100) NOT NULL,
    available_quantity numeric(18,4) NOT NULL,
    reserved_quantity numeric(18,4) NOT NULL DEFAULT 0,
    status varchar(40) NOT NULL
);

TRUNCATE public.demo_supply_lot_baseline;

INSERT INTO public.demo_supply_lot_baseline(
    internal_lot_number,material_code,available_quantity,reserved_quantity,status
)
SELECT
    ml.internal_lot_number,
    mc.material_code,
    ml.available_quantity,
    ml.reserved_quantity,
    ml.status
FROM supply.material_lots ml
JOIN supply.material_catalog mc
  ON mc.supply_material_id=ml.supply_material_id
WHERE mc.active=true;

CREATE TABLE IF NOT EXISTS public.demo_staging_baseline (
    container_id varchar(160) PRIMARY KEY,
    material_code varchar(100) NOT NULL,
    material_name varchar(200) NOT NULL,
    lot_number varchar(150) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    unit varchar(50) NOT NULL,
    location_code varchar(100) NOT NULL,
    hazard_class varchar(40) NOT NULL
);

TRUNCATE public.demo_staging_baseline;

INSERT INTO public.demo_staging_baseline(
    container_id,material_code,material_name,lot_number,quantity,unit,
    location_code,hazard_class
)
SELECT
    container_id,material_code,material_name,lot_number,quantity,unit,
    location_code,hazard_class
FROM public.material_positions
WHERE location_code IN ('CW-STAGE-01','CW-HAZ-01');

CREATE TABLE IF NOT EXISTS public.demo_bulk_tank_baseline (
    tank_code varchar(100) PRIMARY KEY,
    quantity_kg numeric(18,4) NOT NULL,
    qa_status varchar(60) NOT NULL,
    lot_number varchar(150),
    temperature_c numeric(10,3),
    status varchar(60) NOT NULL
);

TRUNCATE public.demo_bulk_tank_baseline;

INSERT INTO public.demo_bulk_tank_baseline(
    tank_code,quantity_kg,qa_status,lot_number,temperature_c,status
)
SELECT
    tank_code,quantity_kg,qa_status,lot_number,temperature_c,status
FROM public.bulk_tanks;

COMMIT;

-- =====================================================================
-- VERIFICATION
-- =====================================================================
SELECT 'Warehouse baseline lots' AS item, count(*)::text AS value
FROM public.demo_supply_lot_baseline
UNION ALL
SELECT 'CW staging baseline positions',count(*)::text
FROM public.demo_staging_baseline
UNION ALL
SELECT 'Bulk baseline tanks',count(*)::text
FROM public.demo_bulk_tank_baseline
UNION ALL
SELECT 'R&D / Natural materials',
       count(*)::text
FROM supply.material_catalog
WHERE material_code LIKE 'RND-%'
   OR material_code LIKE 'NAT-%'
UNION ALL
SELECT 'Hazard labels',count(*)::text
FROM public.material_hazard_labels;

SELECT
    tank_code,material_name,capacity_kg,quantity_kg,qa_status,lot_number,status
FROM public.bulk_tanks
ORDER BY tank_code;

SELECT
    location_code,material_name,lot_number,quantity,unit,hazard_class
FROM public.material_positions
WHERE location_code IN ('CW-STAGE-01','CW-HAZ-01')
ORDER BY location_code,material_name;
