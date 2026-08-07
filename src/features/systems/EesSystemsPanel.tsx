import {
  useMemo,
  useState,
} from "react";

import type {
  EesDataset,
  EesSystem,
  RegistryOverview,
} from "../../services/registryApi";

import "./EesSystemsPanel.css";

interface EesSystemsPanelProps {
  systems: EesSystem[];

  datasets: EesDataset[];

  overview:
    RegistryOverview | null;

  loading: boolean;

  error: string | null;

  onRefresh: () => void;

  onOpenDatabase: (
    system: EesSystem,
  ) => void;
}

export default function EesSystemsPanel({
  systems,
  datasets,
  overview,
  loading,
  error,
  onRefresh,
  onOpenDatabase,
}: EesSystemsPanelProps) {
  const [
    selectedSystemId,
    setSelectedSystemId,
  ] =
    useState<string | null>(
      null,
    );

  const selectedSystem =
    useMemo(
      () =>
        systems.find(
          (system) =>
            system.system_id ===
            selectedSystemId,
        ) ?? null,
      [
        systems,
        selectedSystemId,
      ],
    );

  const selectedDatasets =
    useMemo(
      () =>
        selectedSystem
          ? datasets.filter(
              (dataset) =>
                dataset.system_id ===
                selectedSystem.system_id,
            )
          : [],
      [
        datasets,
        selectedSystem,
      ],
    );

  function handleSystemClick(
    system: EesSystem,
  ) {
    setSelectedSystemId(
      (current) =>
        current ===
        system.system_id
          ? null
          : system.system_id,
    );
  }

  return (
    <div className="ees-systems-panel">
      <div className="ees-systems-header">
        <div>
          <span>
            EES UNIVERSE
          </span>

          <strong>
            Data Platform Systems
          </strong>

          <p>
            Registered data,
            intelligence, and
            analytical systems across
            the EES Universe.
          </p>
        </div>

        <button
          type="button"
          onClick={
            onRefresh
          }
          disabled={
            loading
          }
        >
          {loading
            ? "Refreshing..."
            : "Refresh Registry"}
        </button>
      </div>

      {overview && (
        <div className="ees-registry-summary">
          <SummaryCard
            label="Systems"
            value={
              overview.systems
            }
          />

          <SummaryCard
            label="Active Systems"
            value={
              overview.active_systems
            }
          />

          <SummaryCard
            label="Datasets"
            value={
              overview.datasets
            }
          />

          <SummaryCard
            label="Active Datasets"
            value={
              overview.active_datasets
            }
          />

          <SummaryCard
            label="Relationships"
            value={
              overview.relationships
            }
          />
        </div>
      )}

      {error && (
        <div className="ees-systems-error">
          {error}
        </div>
      )}

      <div className="ees-systems-content">
        <section className="ees-system-grid">
          {loading &&
          systems.length ===
            0 ? (
            <div className="ees-system-empty">
              Loading EES systems...
            </div>
          ) : systems.length ===
            0 ? (
            <div className="ees-system-empty">
              No EES systems are
              registered.
            </div>
          ) : (
            systems.map(
              (system) => {
                const systemDatasets =
                  datasets.filter(
                    (dataset) =>
                      dataset.system_id ===
                      system.system_id,
                  );

                const selected =
                  selectedSystemId ===
                  system.system_id;

                return (
                  <button
                    key={
                      system.system_id
                    }
                    type="button"
                    className={`ees-system-card ${
                      selected
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      handleSystemClick(
                        system,
                      )
                    }
                  >
                    <div className="ees-system-card-top">
                      <SystemIcon
                        system={
                          system
                        }
                      />

                      <span
                        className={`ees-system-status ${system.status}`}
                      >
                        {
                          system.status
                        }
                      </span>
                    </div>

                    <strong className="ees-system-name">
                      {
                        system.system_name
                      }
                    </strong>

                    <span className="ees-system-type">
                      {
                        system.system_type
                      }
                    </span>

                    <p>
                      {system.description ??
                        "No description available."}
                    </p>

                    <div className="ees-system-meta">
                      <span>
                        Domain
                        <strong>
                          {
                            system.domain
                          }
                        </strong>
                      </span>

                      <span>
                        Role
                        <strong>
                          {system.data_role ??
                            "—"}
                        </strong>
                      </span>

                      <span>
                        Database
                        <strong>
                          {system.primary_database ??
                            "—"}
                        </strong>
                      </span>

                      <span>
                        Datasets
                        <strong>
                          {
                            systemDatasets.length
                          }
                        </strong>
                      </span>
                    </div>
                  </button>
                );
              },
            )
          )}
        </section>

        {selectedSystem && (
          <aside className="ees-system-detail">
            <div className="ees-system-detail-header">
              <div>
                <span>
                  REGISTERED SYSTEM
                </span>

                <strong>
                  {
                    selectedSystem.system_name
                  }
                </strong>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedSystemId(
                    null,
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="ees-system-detail-body">
              <section className="ees-detail-section">
                <div className="ees-detail-section-title">
                  Platform Identity
                </div>

                <DetailRow
                  label="System Key"
                  value={
                    selectedSystem.system_key
                  }
                />

                <DetailRow
                  label="Domain"
                  value={
                    selectedSystem.domain
                  }
                />

                <DetailRow
                  label="System Type"
                  value={
                    selectedSystem.system_type
                  }
                />

                <DetailRow
                  label="Data Role"
                  value={
                    selectedSystem.data_role ??
                    "Not assigned"
                  }
                />

                <DetailRow
                  label="Status"
                  value={
                    selectedSystem.status
                  }
                />
              </section>

              <section className="ees-detail-section">
                <div className="ees-detail-section-title">
                  Data Source
                </div>

                <DetailRow
                  label="Primary Database"
                  value={
                    selectedSystem.primary_database ??
                    "Not configured"
                  }
                />

                <DetailRow
                  label="API"
                  value={
                    selectedSystem.api_base_url ??
                    "Not configured"
                  }
                />

                <DetailRow
                  label="Datasets"
                  value={String(
                    selectedDatasets.length,
                  )}
                />

                {selectedSystem.primary_database && (
                  <button
                    type="button"
                    className="ees-open-db-button"
                    onClick={() =>
                      onOpenDatabase(
                        selectedSystem,
                      )
                    }
                  >
                    Open Database Connection
                  </button>
                )}
              </section>

              <section className="ees-detail-section">
                <div className="ees-detail-section-title">
                  Registered Datasets
                </div>

                {selectedDatasets.length ===
                0 ? (
                  <div className="ees-no-datasets">
                    No datasets
                    registered for this
                    system yet.
                  </div>
                ) : (
                  <div className="ees-dataset-list">
                    {selectedDatasets.map(
                      (
                        dataset,
                      ) => (
                        <div
                          key={
                            dataset.dataset_id
                          }
                          className="ees-dataset-card"
                        >
                          <div className="ees-dataset-card-heading">
                            <strong>
                              {
                                dataset.dataset_name
                              }
                            </strong>

                            <span>
                              {
                                dataset.object_type
                              }
                            </span>
                          </div>

                          <code>
                            {dataset.database_name ??
                              "—"}
                            .
                            {dataset.schema_name ??
                              "—"}
                            .
                            {dataset.object_name ??
                              "—"}
                          </code>

                          <div className="ees-dataset-meta">
                            <span>
                              {
                                dataset.source_type
                              }
                            </span>

                            <span>
                              {
                                dataset.classification
                              }
                            </span>

                            <span>
                              {
                                dataset.refresh_mode
                              }
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </section>

              {selectedSystem.repository_url && (
                <section className="ees-detail-section">
                  <div className="ees-detail-section-title">
                    Source
                  </div>

                  <div className="ees-system-repository">
                    {
                      selectedSystem.repository_url
                    }
                  </div>
                </section>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="ees-summary-card">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="ees-detail-row">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function SystemIcon({
  system,
}: {
  system: EesSystem;
}) {
  const key =
    system.system_key;

  let icon = "◈";

  if (
    key.includes(
      "data-moon",
    )
  ) {
    icon = "◐";
  } else if (
    key.includes(
      "pharma",
    )
  ) {
    icon = "✦";
  } else if (
    key.includes(
      "serverless",
    )
  ) {
    icon = "⌁";
  } else if (
    key.includes(
      "manufacturing",
    )
  ) {
    icon = "⚙";
  }

  return (
    <span className="ees-system-icon">
      {icon}
    </span>
  );
}