BEGIN;

UPDATE public.bulk_tanks
SET
    capacity_kg = 25000,
    quantity_kg = 18000,
    qa_status = 'Released',
    lot_number = 'PG-26A0816-01',
    temperature_c = 22,
    status = 'Available'
WHERE tank_code = 'PG-101';

UPDATE public.bulk_tanks
SET
    capacity_kg = 25000,
    quantity_kg = 18000,
    qa_status = 'Released',
    lot_number = 'GLY-26A0816-01',
    temperature_c = 22,
    status = 'Available'
WHERE tank_code = 'GLY-101';

-- Rebuild the bulk reset snapshot so future global resets restore the
-- corrected starting quantities instead of zero.
TRUNCATE public.demo_bulk_tank_baseline;

INSERT INTO public.demo_bulk_tank_baseline(
    tank_code,
    quantity_kg,
    qa_status,
    lot_number,
    temperature_c,
    status
)
SELECT
    tank_code,
    quantity_kg,
    qa_status,
    lot_number,
    temperature_c,
    status
FROM public.bulk_tanks;

COMMIT;

SELECT
    tank_code,
    material_name,
    capacity_kg,
    quantity_kg,
    qa_status,
    lot_number,
    status
FROM public.bulk_tanks
ORDER BY tank_code;
