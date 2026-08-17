import { useEffect, useState } from "react";
import {
  getDemoAdminOverview,
  getDemoResetRequests,
  getDemoResetHistory,
  getDemoSessions,
  getDemoBaselineStatus,
  restoreDemoInventoryBaseline,
  resetDemoPoPool,
  reviewDemoResetRequest,
  type DemoAdminOverview,
  type DemoBaselineStatus,
  type DemoResetRequest,
  type DemoSessionRow,
} from "../../services/adminApi";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminDemoControlPanel({ open, onClose }: Props) {
  const [overview, setOverview] = useState<DemoAdminOverview | null>(null);
  const [requests, setRequests] = useState<DemoResetRequest[]>([]);
  const [history, setHistory] = useState<DemoResetRequest[]>([]);
  const [sessions, setSessions] = useState<DemoSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<DemoBaselineStatus | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [globalAdminNote, setGlobalAdminNote] = useState("");
  const [inventoryConfirm, setInventoryConfirm] = useState("");
  const [poPoolConfirm, setPoPoolConfirm] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage(null);
    try {
      const [o, r, h, s, b] = await Promise.all([
        getDemoAdminOverview(),
        getDemoResetRequests(),
        getDemoResetHistory(),
        getDemoSessions(),
        getDemoBaselineStatus(),
      ]);
      setOverview(o);
      setRequests(r.rows ?? []);
      setHistory(h.rows ?? []);
      setSessions(s.rows ?? []);
      setBaseline(b);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load demo administration data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  async function changeStatus(requestId: string, status: string) {
    try {
      await reviewDemoResetRequest(requestId, status, adminNotes[requestId] || undefined);
      setMessage(`Reset request ${requestId} marked ${status}.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update reset request.");
    }
  }

  async function restoreInventory() {
    try {
      const result = await restoreDemoInventoryBaseline(inventoryConfirm, globalAdminNote || undefined);
      setMessage(result.message ?? "Demo inventory baseline restored.");
      setInventoryConfirm("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to restore inventory baseline.");
    }
  }

  async function resetPoPool() {
    try {
      const result = await resetDemoPoPool(poPoolConfirm, globalAdminNote || undefined);
      setMessage(result.message ?? "Demo PO pool reset.");
      setPoPoolConfirm("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset PO pool.");
    }
  }

  if (!open) return null;

  return (
    <div className="admin-demo-overlay" role="dialog" aria-modal="true" aria-label="Demo administration">
      <div className="admin-demo-panel">
        <div className="admin-demo-header">
          <div>
            <span className="admin-demo-eyebrow">DATA MOON ADMIN</span>
            <h2>Demo Session Control Center</h2>
            <p>Review session reset requests without modifying shared inventory or PO numbering until an administrator explicitly performs reconciliation.</p>
          </div>
          <div className="admin-demo-header-actions">
            <button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="admin-demo-metrics">
          <div><span>Sessions</span><strong>{overview?.sessions ?? 0}</strong></div>
          <div><span>Active Sessions</span><strong>{overview?.active_sessions ?? 0}</strong></div>
          <div><span>Reset Requests</span><strong>{overview?.reset_requests ?? 0}</strong></div>
          <div><span>Pending Review</span><strong>{overview?.pending_reset_requests ?? 0}</strong></div>
        </div>

        {message && <div className="admin-demo-message">{message}</div>}

        <section className="admin-demo-section">
          <div className="admin-demo-section-heading">
            <div><span>RESET GOVERNANCE</span><h3>Reset Request Queue</h3></div>
          </div>
          <div className="admin-demo-table-wrap">
            <table className="admin-demo-table">
              <thead><tr><th>Request</th><th>Session</th><th>Operator</th><th>Reason</th><th>Status</th><th>Admin Note</th><th>Requested</th><th>Actions</th></tr></thead>
              <tbody>
                {requests.length ? requests.map((item) => (
                  <tr key={item.request_id}>
                    <td>{item.request_id}</td>
                    <td>{item.session_id || "—"}</td>
                    <td>{item.operator}</td>
                    <td>{item.reason}</td>
                    <td>{item.status}</td>
                    <td>
                      <textarea
                        className="admin-demo-note"
                        value={adminNotes[item.request_id] ?? item.admin_note ?? ""}
                        onChange={(event) => setAdminNotes((current) => ({ ...current, [item.request_id]: event.target.value }))}
                        placeholder="Admin review / reconciliation note"
                      />
                      {item.reviewed_by && <small>Reviewed by {item.reviewed_by}{item.reviewed_at ? ` · ${item.reviewed_at}` : ""}</small>}
                    </td>
                    <td>{item.requested_at}</td>
                    <td className="admin-demo-row-actions">
                      <button type="button" disabled={item.status === "Completed" || item.status === "Rejected"} onClick={() => void changeStatus(item.request_id, "Approved")}>Approve</button>
                      <button type="button" disabled={item.status !== "Approved"} onClick={() => void changeStatus(item.request_id, "Completed")}>Complete</button>
                      <button type="button" disabled={item.status === "Completed" || item.status === "Rejected"} onClick={() => void changeStatus(item.request_id, "Rejected")}>Reject</button>
                    </td>
                  </tr>
                )) : <tr><td colSpan={8}>No reset requests are waiting.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-demo-section">
          <div className="admin-demo-section-heading"><div><span>AUDIT HISTORY</span><h3>Completed / Rejected Reset Requests</h3></div></div>
          <div className="admin-demo-table-wrap">
            <table className="admin-demo-table">
              <thead><tr><th>Request</th><th>Session</th><th>Status</th><th>Admin Note</th><th>Reviewed By</th><th>Completed</th></tr></thead>
              <tbody>
                {history.length ? history.map((item) => (
                  <tr key={item.request_id}>
                    <td>{item.request_id}</td>
                    <td>{item.session_id || "—"}</td>
                    <td>{item.status}</td>
                    <td>{item.admin_note || "—"}</td>
                    <td>{item.reviewed_by || "—"}</td>
                    <td>{item.completed_at || item.reviewed_at || "—"}</td>
                  </tr>
                )) : <tr><td colSpan={6}>No completed or rejected reset requests yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-demo-section">
          <div className="admin-demo-section-heading"><div><span>CONCURRENCY</span><h3>Demo Sessions</h3></div></div>
          <div className="admin-demo-table-wrap">
            <table className="admin-demo-table">
              <thead><tr><th>Session</th><th>Status</th><th>Active Entities</th><th>Entities</th><th>Last Seen</th></tr></thead>
              <tbody>
                {sessions.length ? sessions.map((item) => (
                  <tr key={item.session_id}><td>{item.session_id}</td><td>{item.status}</td><td>{item.active_entities}</td><td>{item.entities || "—"}</td><td>{item.last_seen_at}</td></tr>
                )) : <tr><td colSpan={5}>No registered browser demo sessions yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-demo-section">
          <div className="admin-demo-section-heading">
            <div><span>GLOBAL RECONCILIATION</span><h3>Baseline & Demo PO Administration</h3></div>
          </div>
          <div className="admin-demo-reconciliation">
            <div className="admin-demo-safety">
              <strong>{baseline?.safe_for_global_reconciliation ? "Safe for global reconciliation" : "Global reconciliation locked"}</strong>
              <span>Active demo sessions: {baseline?.active_sessions ?? 0}</span>
              <span>Supply baseline: {baseline?.supply_baseline_rows ?? 0} lots</span>
              <span>Staging baseline: {baseline?.staging_baseline_rows ?? 0} positions</span>
              <span>Bulk baseline: {baseline?.bulk_baseline_rows ?? 0} tanks</span>
              <span>PO pool: PO-{String(baseline?.po_pool_next ?? 0).padStart(6,"0")} · generation {baseline?.po_pool_generation ?? "—"}</span>
            </div>

            <label className="admin-demo-field">
              <span>Global Admin Note</span>
              <textarea value={globalAdminNote} onChange={(event) => setGlobalAdminNote(event.target.value)} placeholder="Reason / reconciliation record for audit history" />
            </label>

            <div className="admin-demo-operation-grid">
              <div className="admin-demo-operation">
                <strong>Restore Inventory Baseline</strong>
                <p>Restores shared Supply lot quantities, lean Chem Weigh staging, and Bulk tank baseline. Blocked while any demo session is active.</p>
                <input value={inventoryConfirm} onChange={(event) => setInventoryConfirm(event.target.value)} placeholder='Type RESTORE INVENTORY' />
                <button type="button" disabled={!baseline?.safe_for_global_reconciliation || inventoryConfirm !== "RESTORE INVENTORY"} onClick={() => void restoreInventory()}>Restore Inventory Baseline</button>
              </div>

              <div className="admin-demo-operation">
                <strong>Reset Demo PO Pool</strong>
                <p>Resets the Data Moon-owned demo allocator to PO-260743 and clears transient Pharma Process Twin public workflow records. Shared pharma.* and supply.* genealogy remains preserved.</p>
                <input value={poPoolConfirm} onChange={(event) => setPoPoolConfirm(event.target.value)} placeholder='Type RESET PO POOL' />
                <button type="button" disabled={!baseline?.safe_for_global_reconciliation || poPoolConfirm !== "RESET PO POOL"} onClick={() => void resetPoPool()}>Reset Demo PO Pool</button>
              </div>
            </div>
          </div>
        </section>

        <div className="admin-demo-footer-note">Global actions are admin-only, audited, and blocked whenever another demo session is active. Historical Pharma/Supply genealogy is preserved.</div>
      </div>
    </div>
  );
}
