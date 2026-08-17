BEGIN;

-- Universal Data Moon owns the shared demo-session governance tables.
-- Preserve the earlier prototype reset queue if it is present.
DO $$
BEGIN
    IF to_regclass('public.demo_reset_requests') IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='public'
             AND table_name='demo_reset_requests'
             AND column_name='reset_request_id'
       )
       AND to_regclass('public.demo_reset_requests_legacy_20260816') IS NULL
    THEN
        ALTER TABLE public.demo_reset_requests
            RENAME TO demo_reset_requests_legacy_20260816;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.demo_sessions (
    session_id varchar(120) PRIMARY KEY,
    status varchar(40) NOT NULL DEFAULT 'Active',
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.demo_session_entities (
    session_id varchar(120) NOT NULL
        REFERENCES public.demo_sessions(session_id) ON DELETE CASCADE,
    entity_type varchar(60) NOT NULL,
    entity_id varchar(160) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(session_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS ix_demo_session_entities_active
    ON public.demo_session_entities(session_id, active, entity_type);

CREATE TABLE IF NOT EXISTS public.demo_reset_requests (
    request_id varchar(80) PRIMARY KEY,
    session_id varchar(120) NOT NULL
        REFERENCES public.demo_sessions(session_id),
    reset_scope varchar(30) NOT NULL DEFAULT 'SESSION',
    operator varchar(120) NOT NULL,
    reason varchar(300) NOT NULL,
    status varchar(80) NOT NULL DEFAULT 'Requested',
    requested_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_demo_reset_requests_session
    ON public.demo_reset_requests(session_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS ix_demo_reset_requests_status
    ON public.demo_reset_requests(status, requested_at DESC);

COMMIT;

SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name LIKE 'demo_%'
ORDER BY table_name;
