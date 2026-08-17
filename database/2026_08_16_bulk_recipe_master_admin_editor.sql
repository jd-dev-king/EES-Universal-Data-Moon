BEGIN;

-- Governed production batch bulk recipe.
-- This table is intentionally NOT part of demo reset cleanup.
-- Data Moon Admin can maintain it through Edit Table without writing SQL.
CREATE TABLE IF NOT EXISTS public.demo_bulk_recipe_master (
    material_name varchar(120) PRIMARY KEY,
    material_code varchar(100) NOT NULL,
    sequence_no integer NOT NULL,
    required_quantity_kg numeric(18,4) NOT NULL CHECK (required_quantity_kg > 0),
    source_type varchar(40) NOT NULL CHECK (source_type IN ('UTILITY','TANK')),
    source_code varchar(100) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.demo_bulk_recipe_master(
    material_name,
    material_code,
    sequence_no,
    required_quantity_kg,
    source_type,
    source_code,
    active,
    updated_at
)
VALUES
    ('Water','059QF0KO0R',1,4000.0000,'UTILITY','USP-WATER-AUTO',true,now()),
    ('Glycerin','PDC6A3C0OX',2,920.0000,'TANK','GLY-101',true,now()),
    ('Propylene Glycol','6DC9Q167V3',3,750.0000,'TANK','PG-101',true,now()),
    ('Sucrose','C151H8M554',4,2175.0000,'TANK','SUC-101',true,now())
ON CONFLICT(material_name) DO UPDATE SET
    material_code=EXCLUDED.material_code,
    sequence_no=EXCLUDED.sequence_no,
    required_quantity_kg=EXCLUDED.required_quantity_kg,
    source_type=EXCLUDED.source_type,
    source_code=EXCLUDED.source_code,
    active=EXCLUDED.active,
    updated_at=now();

-- Ensure obsolete physical water tanks do not return.
DELETE FROM public.demo_bulk_tank_baseline
WHERE tank_code IN ('PW-101','WATER-101','USP-WATER-101');

DELETE FROM public.bulk_tanks
WHERE tank_code IN ('PW-101','WATER-101','USP-WATER-101');

COMMIT;

SELECT *
FROM public.demo_bulk_recipe_master
ORDER BY sequence_no;
