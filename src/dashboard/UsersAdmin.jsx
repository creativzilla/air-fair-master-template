import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CircleCheck, Send, UserPlus } from "lucide-react";
import { T, fontBody, Badge, Button, EmptyState, LabeledInput, LabeledSelect, Modal, Notice, PageTitle, Panel, Spinner, formatDateTime, inputStyle } from "./ui.jsx";
import { callAdminUsers, listProfiles, updateProfile } from "./api.js";

export const ROLE_INFO = {
  admin: "Everything, including publishing, deleting, settings and users.",
  editor: "Edits website content and forms as drafts (no publishing or deleting), and works leads.",
  staff: "Works leads only: submissions, pipeline, clients, calendar.",
  none: "Can sign in but sees nothing.",
};

function InviteModal({ onClose, onInvited }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    setBusy(true); setError("");
    try {
      await callAdminUsers("invite", { email, fullName, role, redirectTo: `${window.location.origin}/dashboard` });
      onInvited(email);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Invite a user" onClose={onClose} footer={<><Button tone="outline" onClick={onClose}>Cancel</Button><Button icon={Send} busy={busy} onClick={send}>Send invite</Button></>}>
      <div className="flex flex-col gap-4">
        <LabeledInput label="Email" type="email" value={email} onChange={setEmail} />
        <LabeledInput label="Full name" value={fullName} onChange={setFullName} />
        <LabeledSelect label="Role" value={role} onChange={setRole} hint={ROLE_INFO[role]} options={[{ value: "staff", label: "Staff" }, { value: "editor", label: "Editor" }, { value: "admin", label: "Admin" }]} />
        <p className="text-xs" style={{ color: T.muted, ...fontBody }}>They get an email with a link to set their password and open the dashboard.</p>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}

export default function UsersAdmin({ me }) {
  const [profiles, setProfiles] = useState(null);
  const [authUsers, setAuthUsers] = useState(null);
  const [fnError, setFnError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(null);
  const [inviting, setInviting] = useState(false);

  const reload = useCallback(async () => {
    try { setProfiles(await listProfiles()); } catch (err) { setError(err.message); setProfiles([]); }
    try { const { users } = await callAdminUsers("list"); setAuthUsers(Object.fromEntries(users.map(u => [u.id, u]))); setFnError(""); }
    catch (err) { setAuthUsers({}); setFnError(err.message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const activeAdmins = useMemo(() => (profiles || []).filter(p => p.role === "admin" && p.is_active).length, [profiles]);

  const changeRole = async (profile, role) => {
    if (profile.id === me.id) return;
    if (profile.role === "admin" && role !== "admin" && activeAdmins <= 1) { setError("Keep at least one active admin."); return; }
    setBusy(profile.id); setError(""); setMessage("");
    try { const updated = await updateProfile(profile.id, { role }); setProfiles(prev => prev.map(p => (p.id === updated.id ? updated : p))); setMessage(`${profile.email} is now ${role}.`); }
    catch (err) { setError(err.message); } finally { setBusy(null); }
  };

  const setActive = async (profile, active) => {
    if (!active && !window.confirm(`Deactivate ${profile.email}? They are signed out and can no longer sign in.`)) return;
    setBusy(profile.id); setError(""); setMessage("");
    try { await callAdminUsers(active ? "reactivate" : "deactivate", { userId: profile.id }); await reload(); setMessage(`${profile.email} ${active ? "reactivated" : "deactivated"}.`); }
    catch (err) { setError(err.message); } finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Users" subtitle="Who can sign in to this dashboard and what they can do." actions={<Button icon={UserPlus} disabled={!!fnError} title={fnError ? "The admin-users function is not reachable" : undefined} onClick={() => setInviting(true)}>Invite user</Button>} />
      <Panel className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {["admin", "editor", "staff"].map(role => <div key={role}><Badge status={role} /><p className="text-xs mt-1.5" style={{ color: T.muted, ...fontBody }}>{ROLE_INFO[role]}</p></div>)}
      </Panel>
      {fnError && <Notice tone="warn">Inviting and deactivating users needs the <b>admin-users</b> function to be deployed ({fnError}). Changing roles still works.</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
      {profiles === null ? <Spinner /> : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["User", "Role", "Status", "Last sign-in", ""].map(h => <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide" style={{ color: T.muted, ...fontBody, letterSpacing: "0.05em" }}>{h}</th>)}</tr></thead>
            <tbody>
              {profiles.map((p, i) => {
                const auth = authUsers?.[p.id];
                const self = p.id === me.id;
                return (
                  <tr key={p.id} style={{ borderBottom: i < profiles.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <td className="px-5 py-3"><div style={{ color: T.ink, ...fontBody }}>{p.full_name || p.email}{self && <span className="text-xs ml-1.5" style={{ color: T.muted }}>(you)</span>}</div>{p.full_name && <div className="text-xs" style={{ color: T.muted, ...fontBody }}>{p.email}</div>}</td>
                    <td className="px-5 py-3">
                      <select value={p.role} disabled={self || busy === p.id} onChange={e => changeRole(p, e.target.value)} className="rounded-lg px-2 py-1.5 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }} title={self ? "You can't change your own role" : ROLE_INFO[p.role]}>
                        {["admin", "editor", "staff", "none"].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3">{p.is_active ? (auth && !auth.last_sign_in_at && auth.invited_at ? <Badge status="Pending" label="Invited" /> : <Badge status="Published" label="Active" />) : <Badge status="Deactivated" />}</td>
                    <td className="px-5 py-3 whitespace-nowrap" style={{ color: T.muted, ...fontBody }}>{auth?.last_sign_in_at ? formatDateTime(auth.last_sign_in_at) : "—"}</td>
                    <td className="px-5 py-3 text-right">{!self && (p.is_active
                      ? <Button tone="outline" small icon={Ban} busy={busy === p.id} disabled={!!fnError} onClick={() => setActive(p, false)}>Deactivate</Button>
                      : <Button tone="soft" small icon={CircleCheck} busy={busy === p.id} disabled={!!fnError} onClick={() => setActive(p, true)}>Reactivate</Button>)}</td>
                  </tr>
                );
              })}
              {profiles.length === 0 && <tr><td colSpan={5}><EmptyState>No users.</EmptyState></td></tr>}
            </tbody>
          </table>
        </Panel>
      )}
      {inviting && <InviteModal onClose={() => setInviting(false)} onInvited={async email => { setInviting(false); setMessage(`Invite sent to ${email}.`); await reload(); }} />}
    </div>
  );
}
