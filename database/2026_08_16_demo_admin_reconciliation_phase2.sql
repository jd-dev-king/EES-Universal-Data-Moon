BEGIN;

ALTER TABLE public.demo_reset_requests
    ADD COLUMN IF NOT EXISTS admin_note text,
    ADD COLUMN IF NOT EXISTS reviewed_by varchar(160),
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.demo_admin_actions (
    action_id varchar(80) PRIMARY KEY,
    action_type varchar(100) NOT NULL,
    performed_by varchar(160) NOT NULL,
    admin_note text,
    details text,
    performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_demo_admin_actions_performed_at
    ON public.demo_admin_actions(performed_at DESC);

CREATE TABLE IF NOT EXISTS public.demo_po_pool_control (
    pool_key varchar(60) PRIMARY KEY,
    next_po_number integer NOT NULL,
    generation integer NOT NULL DEFAULT 1,
    reset_by varchar(160),
    reset_at timestamptz,
    admin_note text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.demo_po_pool_control(pool_key,next_po_number,generation)
VALUES('PHARMA_DEMO',260743,1)
ON CONFLICT(pool_key) DO NOTHING;

COMMIT;

SELECT request_id,session_id,status,admin_note,reviewed_by,reviewed_at
FROM public.demo_reset_requests
ORDER BY requested_at DESC;

SELECT * FROM public.demo_po_pool_control;
