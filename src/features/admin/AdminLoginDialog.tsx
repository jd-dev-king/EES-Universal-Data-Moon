import { FormEvent, useState } from "react";
import { adminLogin } from "../../services/adminApi";
import "./AdminLoginDialog.css";

export default function AdminLoginDialog({ open, onClose, onAuthenticated }: { open: boolean; onClose: () => void; onAuthenticated: (username: string) => void; }) {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (!open) return null;
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(null); try { const result = await adminLogin(username, password); onAuthenticated(result.username ?? username); setPassword(""); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "Admin sign-in failed."); } finally { setBusy(false); } }
  return <div className="admin-login-backdrop"><form className="admin-login-dialog" onSubmit={submit}><div className="admin-login-heading"><div><small>EES UNIVERSAL DATA MOON</small><h2>Administrator Sign In</h2></div><button type="button" onClick={onClose}>×</button></div><p>Authenticate to the Data Moon API for controlled production database administration. PostgreSQL credentials remain server-side.</p><label>Admin Username<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} /></label><label>Admin Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} /></label>{error && <div className="admin-login-error">{error}</div>}<div className="admin-login-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</button></div></form></div>;
}
