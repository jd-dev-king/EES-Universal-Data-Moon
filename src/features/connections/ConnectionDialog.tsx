import {
  useEffect,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import { testPostgresConnection } from "../../services/api";
import "./ConnectionDialog.css";

import type { DatabaseConnectionForm } from "./types";

interface ConnectionDialogProps {
  open: boolean;
  onClose: () => void;

  onConnect: (
    connection: DatabaseConnectionForm,
  ) => void;

  initialConnection?: DatabaseConnectionForm | null;
}

const initialForm: DatabaseConnectionForm = {
  type: "postgresql",
  method: "host",

  name: "",

  host: "localhost",
  port: "5432",
  database: "",
  username: "",
  password: "",

  connectionUrl: "",

  sslMode: "prefer",
};

export default function ConnectionDialog({
  open,
  onClose,
  onConnect,
  initialConnection,
}: ConnectionDialogProps) {
  const [form, setForm] =
    useState<DatabaseConnectionForm>(initialForm);

  const [showPassword, setShowPassword] = useState(false);

  const [status, setStatus] = useState("Not tested");

  const [statusType, setStatusType] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");

  const [testing, setTesting] = useState(false);

  const [connectionVerified, setConnectionVerified] =
    useState(false);

  useEffect(() => {
  if (!open) {
    return;
  }

  if (initialConnection) {
    setForm({
      ...initialConnection,
      password: "",
    });

    setStatus("Not tested");
    setStatusType("idle");
    setTesting(false);
    setConnectionVerified(false);
    setShowPassword(false);
  }
}, [
  open,
  initialConnection,
]);
  
  function handleConnect() {
  if (!connectionVerified) {
    return;
  }

  onConnect({ ...form });
}
  if (!open) {
    return null;
  }

  function updateField<K extends keyof DatabaseConnectionForm>(
    key: K,
    value: DatabaseConnectionForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setStatus("Not tested");
    setStatusType("idle");
    setConnectionVerified(false);
  }

  function handleClose() {
    setStatus("Not tested");
    setStatusType("idle");
    setTesting(false);
    setConnectionVerified(false);
    setShowPassword(false);

    onClose();
  }

  const portNumber = Number(form.port);

  const hostModeValid =
    form.name.trim() !== "" &&
    form.host.trim() !== "" &&
    form.port.trim() !== "" &&
    Number.isInteger(portNumber) &&
    portNumber > 0 &&
    portNumber <= 65535 &&
    form.database.trim() !== "" &&
    form.username.trim() !== "";

  const urlModeValid =
    form.name.trim() !== "" &&
    (form.connectionUrl.trim().startsWith("postgresql://") ||
      form.connectionUrl.trim().startsWith("postgres://"));

  const formValid =
    form.method === "host"
      ? hostModeValid
      : urlModeValid;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (testing) {
  return;
}

if (!formValid) {
  setStatusType("error");
  setConnectionVerified(false);

  if (form.method === "host") {
    if (!form.name.trim()) {
      setStatus("Connection name is required.");
      return;
    }

    if (!form.host.trim()) {
      setStatus("Host is required.");
      return;
    }

    if (
      !form.port.trim() ||
      !Number.isInteger(portNumber) ||
      portNumber <= 0 ||
      portNumber > 65535
    ) {
      setStatus("Enter a valid PostgreSQL port.");
      return;
    }

    if (!form.database.trim()) {
      setStatus("Database name is required.");
      return;
    }

    if (!form.username.trim()) {
      setStatus("Username is required.");
      return;
    }
  } else {
    if (!form.name.trim()) {
      setStatus("Connection name is required.");
      return;
    }

    if (!urlModeValid) {
      setStatus(
        "Enter a valid PostgreSQL connection URL.",
      );
      return;
    }
  }

  return;
}

    try {
      setTesting(true);
      setStatusType("testing");
      setConnectionVerified(false);
      setStatus("Testing PostgreSQL connection...");

      const result = await testPostgresConnection(form);

      if (result.success) {
        setStatusType("success");
        setConnectionVerified(true);

        const details = [
          result.message,
          result.database
            ? `Database: ${result.database}`
            : null,
          result.server_version
            ? `PostgreSQL ${result.server_version}`
            : null,
        ]
          .filter(Boolean)
          .join(" • ");

        setStatus(details);
      } else {
        setStatusType("error");
        setConnectionVerified(false);
        setStatus(result.message);
      }
    } catch (error) {
      setStatusType("error");
      setConnectionVerified(false);

      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to reach the connection service.",
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div
      className="connection-overlay"
      onMouseDown={handleClose}
    >
      <div
        className="connection-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="connection-header">
            <div>
              <span className="connection-eyebrow">
                DATABASE CONNECTION
              </span>

              <h2 id="connection-dialog-title">
                New Connection
              </h2>
            </div>

            <button
              type="button"
              className="dialog-close"
              onClick={handleClose}
              aria-label="Close connection dialog"
            >
              ×
            </button>
          </div>

          <div className="connection-body">
            <label className="field">
              <span>Database Type</span>

              <select
                value={form.type}
                onChange={(event) =>
                  updateField(
                    "type",
                    event.target
                      .value as DatabaseConnectionForm["type"],
                  )
                }
              >
                <option value="postgresql">
                  PostgreSQL
                </option>
              </select>
            </label>

            <div className="method-selector">
              <span className="method-label">
                Connection Method
              </span>

              <div className="method-options">
                <label>
                  <input
                    type="radio"
                    name="connection-method"
                    checked={form.method === "host"}
                    onChange={() =>
                      updateField("method", "host")
                    }
                  />

                  Host &amp; Port
                </label>

                <label>
                  <input
                    type="radio"
                    name="connection-method"
                    checked={form.method === "url"}
                    onChange={() =>
                      updateField("method", "url")
                    }
                  />

                  Connection URL
                </label>
              </div>
            </div>

            <label className="field">
              <span>Connection Name</span>

              <input
                type="text"
                value={form.name}
                placeholder="Power Grid Sun"
                autoFocus
                onChange={(event) =>
                  updateField("name", event.target.value)
                }
              />
            </label>

            <div className="section-divider">
              CONNECTION
            </div>

            {form.method === "host" ? (
              <>
                <div className="field-row">
                  <label className="field">
                    <span>Host</span>

                    <input
                      type="text"
                      value={form.host}
                      placeholder="localhost"
                      onChange={(event) =>
                        updateField(
                          "host",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label className="field field-port">
                    <span>Port</span>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.port}
                      placeholder="5432"
                      onChange={(event) =>
                        updateField(
                          "port",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Database</span>

                  <input
                    type="text"
                    value={form.database}
                    placeholder="power_grid"
                    onChange={(event) =>
                      updateField(
                        "database",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="field">
                  <span>Username</span>

                  <input
                    type="text"
                    value={form.username}
                    placeholder="postgres"
                    autoComplete="username"
                    onChange={(event) =>
                      updateField(
                        "username",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="field">
                  <span>Password</span>

                  <div className="password-field">
                    <input
                      type={
                        showPassword ? "text" : "password"
                      }
                      value={form.password}
                      autoComplete="current-password"
                      onChange={(event) =>
                        updateField(
                          "password",
                          event.target.value,
                        )
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (current) => !current,
                        )
                      }
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span>SSL Mode</span>

                  <select
                    value={form.sslMode}
                    onChange={(event) =>
                      updateField(
                        "sslMode",
                        event.target
                          .value as DatabaseConnectionForm["sslMode"],
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
              </>
            ) : (
              <label className="field">
                <span>PostgreSQL Connection URL</span>

                <textarea
                  rows={4}
                  value={form.connectionUrl}
                  placeholder="postgresql://user:password@host:5432/database"
                  spellCheck={false}
                  onChange={(event) =>
                    updateField(
                      "connectionUrl",
                      event.target.value,
                    )
                  }
                />

                <small>
                  Credentials are currently kept only in
                  memory.
                </small>
              </label>
            )}

            <div
              className={`connection-status ${statusType}`}
            >
              <span className="status-indicator" />

              <span>{status}</span>
            </div>
          </div>

          <div className="connection-footer">
            <button
              type="button"
              className="secondary-action"
              onClick={handleClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="secondary-action"
              disabled={testing}
            >
              {testing
                ? "Testing..."
                : "Test Connection"}
            </button>

            <button
              type="button"
              className="primary-action"
              disabled={!connectionVerified}
              onClick={handleConnect}
        >
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}