CREATE SCHEMA IF NOT EXISTS ees_registry;

CREATE TABLE IF NOT EXISTS ees_registry.systems (
    system_id UUID PRIMARY KEY,
    system_name VARCHAR(150) NOT NULL UNIQUE,
    system_key VARCHAR(100) NOT NULL UNIQUE,

    domain VARCHAR(100) NOT NULL,
    system_type VARCHAR(100) NOT NULL,

    description TEXT,

    status VARCHAR(30) NOT NULL
        DEFAULT 'active',

    data_role VARCHAR(100),

    primary_database VARCHAR(150),

    api_base_url TEXT,

    repository_url TEXT,

    owner_name VARCHAR(150),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT systems_status_check
        CHECK (
            status IN (
                'active',
                'development',
                'offline',
                'archived'
            )
        )
);


CREATE TABLE IF NOT EXISTS ees_registry.datasets (
    dataset_id UUID PRIMARY KEY,

    system_id UUID NOT NULL
        REFERENCES ees_registry.systems(system_id)
        ON DELETE CASCADE,

    dataset_name VARCHAR(150) NOT NULL,

    dataset_key VARCHAR(150) NOT NULL,

    domain VARCHAR(100) NOT NULL,

    database_name VARCHAR(150),

    schema_name VARCHAR(150),

    object_name VARCHAR(150),

    object_type VARCHAR(50),

    source_type VARCHAR(50) NOT NULL,

    classification VARCHAR(50)
        DEFAULT 'operational',

    refresh_mode VARCHAR(50)
        DEFAULT 'manual',

    description TEXT,

    is_active BOOLEAN NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT dataset_system_key_unique
        UNIQUE (
            system_id,
            dataset_key
        ),

    CONSTRAINT dataset_object_type_check
        CHECK (
            object_type IS NULL
            OR object_type IN (
                'table',
                'view',
                'materialized_view',
                'file',
                'stream',
                'api'
            )
        ),

    CONSTRAINT dataset_source_type_check
        CHECK (
            source_type IN (
                'postgresql',
                'csv',
                'parquet',
                'duckdb',
                'api',
                'stream',
                'nosql'
            )
        ),

    CONSTRAINT dataset_refresh_mode_check
        CHECK (
            refresh_mode IN (
                'realtime',
                'scheduled',
                'event',
                'manual',
                'static'
            )
        )
);


CREATE TABLE IF NOT EXISTS ees_registry.dataset_relationships (
    relationship_id UUID PRIMARY KEY,

    source_dataset_id UUID NOT NULL
        REFERENCES ees_registry.datasets(dataset_id)
        ON DELETE CASCADE,

    target_dataset_id UUID NOT NULL
        REFERENCES ees_registry.datasets(dataset_id)
        ON DELETE CASCADE,

    relationship_type VARCHAR(100) NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT relationship_unique
        UNIQUE (
            source_dataset_id,
            target_dataset_id,
            relationship_type
        ),

    CONSTRAINT no_self_relationship
        CHECK (
            source_dataset_id
            <> target_dataset_id
        )
);


CREATE INDEX IF NOT EXISTS
    idx_ees_datasets_system
ON ees_registry.datasets(system_id);


CREATE INDEX IF NOT EXISTS
    idx_ees_datasets_domain
ON ees_registry.datasets(domain);


CREATE INDEX IF NOT EXISTS
    idx_ees_datasets_database
ON ees_registry.datasets(database_name);


CREATE INDEX IF NOT EXISTS
    idx_ees_relationship_source
ON ees_registry.dataset_relationships(
    source_dataset_id
);


CREATE INDEX IF NOT EXISTS
    idx_ees_relationship_target
ON ees_registry.dataset_relationships(
    target_dataset_id
);