import type {
  AppSettings,
} from "../../services/settingsStore";

interface SettingsPanelProps {
  settings: AppSettings;

  onChange: (
    settings: AppSettings,
  ) => void;

  onReset: () => void;
}

export default function SettingsPanel({
  settings,
  onChange,
  onReset,
}: SettingsPanelProps) {
  function updateSetting<
    K extends keyof AppSettings,
  >(
    key: K,
    value: AppSettings[K],
  ) {
    onChange({
      ...settings,
      [key]: value,
    });
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <div>
          <span>
            UNIVERSAL DATA MOON
          </span>

          <strong>
            Settings
          </strong>
        </div>

        <button
          type="button"
          onClick={onReset}
        >
          Reset Defaults
        </button>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <div className="settings-section-heading">
            <span>DATABASE</span>

            <p>
              PostgreSQL connection defaults.
            </p>
          </div>

          <div className="settings-card">
            <label className="settings-row">
              <div>
                <strong>
                  Default SSL Mode
                </strong>

                <span>
                  Default security mode for new connections.
                </span>
              </div>

              <select
                value={
                  settings.defaultSslMode
                }
                onChange={(event) =>
                  updateSetting(
                    "defaultSslMode",
                    event.target
                      .value as AppSettings["defaultSslMode"],
                  )
                }
              >
                <option value="disable">
                  Disable
                </option>

                <option value="allow">
                  Allow
                </option>

                <option value="prefer">
                  Prefer
                </option>

                <option value="require">
                  Require
                </option>

                <option value="verify-ca">
                  Verify CA
                </option>

                <option value="verify-full">
                  Verify Full
                </option>
              </select>
            </label>

            <label className="settings-row">
              <div>
                <strong>
                  Connection Timeout
                </strong>

                <span>
                  Maximum connection wait time.
                </span>
              </div>

              <div className="settings-number">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={
                    settings.connectionTimeoutSeconds
                  }
                  onChange={(event) =>
                    updateSetting(
                      "connectionTimeoutSeconds",
                      Math.max(
                        1,
                        Number(
                          event.target.value,
                        ) || 1,
                      ),
                    )
                  }
                />

                <span>sec</span>
              </div>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading">
            <span>QUERY EDITOR</span>

            <p>
              SQL editor and result behavior.
            </p>
          </div>

          <div className="settings-card">
            <label className="settings-row">
              <div>
                <strong>
                  Result Row Limit
                </strong>

                <span>
                  Maximum rows returned to the desktop grid.
                </span>
              </div>

              <input
                className="settings-input-small"
                type="number"
                min="10"
                max="10000"
                value={
                  settings.resultRowLimit
                }
                onChange={(event) =>
                  updateSetting(
                    "resultRowLimit",
                    Math.max(
                      10,
                      Number(
                        event.target.value,
                      ) || 10,
                    ),
                  )
                }
              />
            </label>

            <label className="settings-row">
              <div>
                <strong>
                  SQL Auto-complete
                </strong>

                <span>
                  Suggest SQL keywords, schemas, tables, and columns.
                </span>
              </div>

              <input
                type="checkbox"
                checked={
                  settings.autocompleteEnabled
                }
                onChange={(event) =>
                  updateSetting(
                    "autocompleteEnabled",
                    event.target.checked,
                  )
                }
              />
            </label>

            <label className="settings-row">
              <div>
                <strong>
                  Auto-format SQL
                </strong>

                <span>
                  Automatically format queries before execution.
                </span>
              </div>

              <input
                type="checkbox"
                checked={
                  settings.autoFormatEnabled
                }
                onChange={(event) =>
                  updateSetting(
                    "autoFormatEnabled",
                    event.target.checked,
                  )
                }
              />
            </label>

            <label className="settings-row">
              <div>
                <strong>
                  Confirm Destructive SQL
                </strong>

                <span>
                  Require confirmation before DELETE, DROP, TRUNCATE, or destructive schema changes.
                </span>
              </div>

              <input
                type="checkbox"
                checked={
                  settings.confirmDestructiveSql
                }
                onChange={(event) =>
                  updateSetting(
                    "confirmDestructiveSql",
                    event.target.checked,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading">
            <span>HISTORY</span>

            <p>
              Local query execution history.
            </p>
          </div>

          <div className="settings-card">
            <label className="settings-row">
              <div>
                <strong>
                  Maximum History Entries
                </strong>

                <span>
                  Oldest entries are removed automatically.
                </span>
              </div>

              <input
                className="settings-input-small"
                type="number"
                min="10"
                max="2000"
                value={
                  settings.maxHistoryEntries
                }
                onChange={(event) =>
                  updateSetting(
                    "maxHistoryEntries",
                    Math.max(
                      10,
                      Number(
                        event.target.value,
                      ) || 10,
                    ),
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading">
            <span>SECURITY</span>

            <p>
              Credential and SQL safety settings.
            </p>
          </div>

          <div className="settings-card">
            <label className="settings-row settings-disabled">
              <div>
                <strong>
                  Save Passwords Securely
                </strong>

                <span>
                  Native credential storage will be enabled in Phase 1G-B.
                </span>
              </div>

              <input
                type="checkbox"
                checked={
                  settings.securePasswordStorageEnabled
                }
                disabled
                readOnly
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}