-- EES Data Moon / Pharma-Supply Prednisolone lot genealogy patch
-- Idempotent correction for demo genealogy.
-- PRED-OS-260801 remains on -01; PRED-OS-260812 is assigned -02;
-- PRED-OS-260819 remains on its existing FEFO/reserved lot.

BEGIN;

WITH target AS (
    SELECT
        bm.batch_material_id,
        ml.material_lot_id,
        ml.internal_lot_number
    FROM pharma.batch_materials bm
    JOIN pharma.batches b
      ON b.batch_id = bm.batch_id
    JOIN pharma.materials pm
      ON pm.material_id = bm.material_id
    JOIN supply.material_catalog mc
      ON mc.material_code = pm.material_code
    JOIN LATERAL (
        SELECT ml2.material_lot_id, ml2.internal_lot_number
        FROM supply.material_lots ml2
        WHERE ml2.supply_material_id = mc.supply_material_id
          AND ml2.internal_lot_number LIKE '%-02'
        ORDER BY ml2.internal_lot_number
        LIMIT 1
    ) ml ON true
    WHERE b.batch_number = 'PRED-OS-260812'
)
UPDATE pharma.batch_materials bm
SET supply_material_lot_id = target.material_lot_id,
    material_lot = target.internal_lot_number,
    updated_at = now()
FROM target
WHERE bm.batch_material_id = target.batch_material_id
  AND (
      bm.supply_material_lot_id IS DISTINCT FROM target.material_lot_id
      OR bm.material_lot IS DISTINCT FROM target.internal_lot_number
  );

COMMIT;

-- Validation: the middle batch should show -02 while the surrounding batches
-- retain their own assigned/FEFO lots.
SELECT
    b.batch_number,
    m.material_code,
    m.material_name,
    bm.material_lot,
    bm.weighing_status
FROM pharma.batch_materials bm
JOIN pharma.batches b ON b.batch_id = bm.batch_id
JOIN pharma.materials m ON m.material_id = bm.material_id
WHERE b.batch_number LIKE 'PRED-OS-%'
ORDER BY m.material_name, b.batch_number;
