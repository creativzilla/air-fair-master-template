// Team: one place for everyone who works in the dashboard. Each person is a
// sign-in account (profiles: name, email, role, active) with its team record
// (employees: job title, staff module access, tasks), created automatically.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Check, CircleCheck, ListChecks, Plus, Send, SlidersHorizontal, UserCog, UserPlus } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { T, fontBody, Badge, Button, LabeledInput, LabeledSelect, Modal, Notice, PageTitle, Spinner, formatDateTime, inputStyle } from "./ui.jsx";
import { callAdminUsers, listProfiles, updateProfile } from "./api.js";
import { ROLE_INFO } from "./UsersAdmin.jsx";
import { ROLE_DEFAULTS, ROLE_SECTIONS, SECTIONS, defaultsMap, effectiveSections } from "./access.js";

const initials = name => String(name || "?").split(/[\s@.]+/).filter(Boolean).map(p => p[0]).join("").slice(0, 2).toUpperCase();

function InviteModal({ onClose, onInvited, viewerIsAdmin }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    setBusy(true); setError("");
    try {
      await callAdminUsers("invite", { email, fullName, role, redirectTo: `${window.location.origin}/dashboard` });
      // The account's team record is created by the database; add the job title to it.
      if (title.trim()) await supabase.from("employees").update({ role: title.trim() }).eq("email", email.trim().toLowerCase());
      onInvited(email);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Invite a team member" onClose={onClose} footer={<><Button tone="outline" onClick={onClose}>Cancel</Button><Button icon={Send} busy={busy} onClick={send}>Send invite</Button></>}>
      <div className="flex flex-col gap-4">
        <LabeledInput label="Email" type="email" value={email} onChange={setEmail} />
        <LabeledInput label="Full name" value={fullName} onChange={setFullName} />
        <LabeledInput label="Job title (optional)" value={title} onChange={setTitle} placeholder="e.g. Visa Consultant" />
        <LabeledSelect label="Role" value={role} onChange={setRole} hint={ROLE_INFO[role]} options={[{ value: "staff", label: "Staff" }, { value: "editor", label: "Editor" }, ...(viewerIsAdmin ? [{ value: "admin", label: "Admin" }] : [])]} />
        <p className="text-xs" style={{ color: T.muted, ...fontBody }}>They get an email with a link to set their password and open the dashboard.</p>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}

function Tasks({ member, tasks, setTasks, stageTasks, setStageTasks, stages }) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [pickerStage, setPickerStage] = useState(stages[0]);
  const [checked, setChecked] = useState([]);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const mine = tasks.filter(t => t.employeeId === member.id);
  const templates = stageTasks.filter(t => t.stage === pickerStage);
  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    const title = newTaskTitle.trim(), due = newTaskDue || null;
    setNewTaskTitle(""); setNewTaskDue("");
    const { data, error } = await supabase.from("employee_tasks").insert({ employee_id: member.id, title, due_date: due, is_done: false }).select().single();
    if (error) { console.error("Failed to add task:", error); return; }
    setTasks(prev => [...prev, { id: data.id, employeeId: data.employee_id, contactId: data.contact_id, title: data.title, due: data.due_date || "No due date", done: data.is_done }]);
  };
  const toggleTask = task => {
    const done = !task.done;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done } : t));
    supabase.from("employee_tasks").update({ is_done: done }).eq("id", task.id).then(({ error }) => { if (error) console.error("Failed to update task:", error); });
  };
  const addTemplate = async () => {
    if (!newTemplateTitle.trim()) return;
    const title = newTemplateTitle.trim(); setNewTemplateTitle("");
    const { data, error } = await supabase.from("stage_task_templates").insert({ stage: pickerStage, title }).select().single();
    if (error) { console.error("Failed to add task template:", error); return; }
    setStageTasks(prev => [...prev, { id: data.id, stage: data.stage, title: data.title }]);
  };
  const addSelected = async () => {
    if (!checked.length) return;
    const rows = stageTasks.filter(t => checked.includes(t.id)).map(t => ({ employee_id: member.id, title: t.title, is_done: false }));
    setChecked([]);
    const { data, error } = await supabase.from("employee_tasks").insert(rows).select();
    if (error) { console.error("Failed to add template tasks:", error); return; }
    setTasks(prev => [...prev, ...data.map(r => ({ id: r.id, employeeId: r.employee_id, contactId: r.contact_id, title: r.title, due: r.due_date || "TBD", done: r.is_done }))]);
  };
  const field = { border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg };
  return <div className="flex flex-col gap-4">
    <span className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>Tasks</span>
    <div className="flex flex-col gap-2">
      {mine.map(t => <div key={t.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ border: `1px solid ${T.border}` }}>
        <button onClick={() => toggleTask(t)} className="mt-0.5 shrink-0" aria-label={t.done ? "Mark not done" : "Mark done"}><div className="w-4 h-4 rounded flex items-center justify-center" style={{ border: `1.5px solid ${t.done ? T.accent : T.border}`, backgroundColor: t.done ? T.accent : "transparent" }}>{t.done && <Check size={11} color="#fff" />}</div></button>
        <div className="flex-1 min-w-0"><div className="text-sm" style={{ color: t.done ? T.muted : T.ink, textDecoration: t.done ? "line-through" : "none", ...fontBody }}>{t.title}</div><div className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>Due {t.due}</div></div>
      </div>)}
      {!mine.length && <div className="text-xs text-center py-4" style={{ color: T.muted, ...fontBody }}>No tasks assigned yet.</div>}
    </div>
    <div className="pt-4 flex flex-col gap-3" style={{ borderTop: `1px solid ${T.border}` }}>
      <label className="text-xs font-medium" style={{ color: T.ink, ...fontBody }}>Add pipeline task</label>
      <div className="flex gap-1.5 flex-wrap">{stages.map(stage => <button key={stage} onClick={() => { setPickerStage(stage); setChecked([]); }} className="px-2.5 py-1 rounded-full text-xs" style={{ ...fontBody, backgroundColor: pickerStage === stage ? T.ink : T.bg, color: pickerStage === stage ? "#fff" : T.muted, border: `1px solid ${pickerStage === stage ? T.ink : T.border}` }}>{stage}</button>)}</div>
      <div className="flex flex-col gap-1.5">
        {templates.map(t => <label key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}><input type="checkbox" checked={checked.includes(t.id)} onChange={() => setChecked(p => p.includes(t.id) ? p.filter(x => x !== t.id) : [...p, t.id])} className="w-4 h-4 shrink-0" style={{ accentColor: T.accent }} /><span className="text-sm flex-1" style={{ color: T.ink, ...fontBody }}>{t.title}</span></label>)}
        {!templates.length && <div className="text-xs px-3 py-2" style={{ color: T.muted, ...fontBody }}>No tasks defined for this stage yet — add one below.</div>}
      </div>
      <div className="flex gap-2"><input value={newTemplateTitle} onChange={e => setNewTemplateTitle(e.target.value)} placeholder={`New task for "${pickerStage}"`} className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none" style={field} /><button onClick={addTemplate} aria-label="Add stage task" className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: T.surface, color: T.ink, border: `1px solid ${T.border}` }}><Plus size={14} /></button></div>
      <Button icon={ListChecks} disabled={!checked.length} onClick={addSelected}>{checked.length ? `Add ${checked.length} task${checked.length > 1 ? "s" : ""}` : "Add selected tasks"}</Button>
    </div>
    <div className="pt-4 flex flex-col gap-2" style={{ borderTop: `1px solid ${T.border}` }}>
      <label className="text-xs" style={{ color: T.muted, ...fontBody }}>Or assign a one-off task</label>
      <div className="flex gap-2 flex-wrap"><input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Task description" className="flex-1 min-w-[160px] rounded-lg px-3 py-2 text-sm outline-none" style={field} /><input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} aria-label="Due date" className="w-40 rounded-lg px-3 py-2 text-sm outline-none" style={field} /><Button tone="outline" onClick={addTask}>Assign</Button></div>
    </div>
  </div>;
}

// Which dashboard sections a person can open. Starts on the role's defaults;
// ticking or unticking switches to custom access. Sections the role does not
// permit are shown but cannot be granted.
function AccessList({ person, onChange, busy, defaults, locked }) {
  const member = person.member;
  const permitted = ROLE_SECTIONS[person.role] || [];
  const open = effectiveSections(person.role, member, defaults);
  const custom = !!member.customAccess;
  const groups = [...new Set(SECTIONS.map(x => x.group))];
  const toggle = key => {
    const base = custom ? { ...defaultsMap(person.role, defaults), ...member.allowedModules } : defaultsMap(person.role, defaults);
    onChange({ customAccess: true, allowedModules: { ...base, [key]: !open.has(key) } });
  };
  const first = (person.full_name || person.email).split(/[\s@]/)[0];
  return <div className="rounded-lg p-3 flex flex-col gap-3" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}>
    <div className="flex items-start justify-between gap-2 flex-wrap">
      <div>
        <div className="flex items-center gap-1.5"><UserCog size={13} style={{ color: T.muted }} /><span className="text-xs font-medium" style={{ color: T.ink, ...fontBody }}>Dashboard access</span></div>
        <p className="text-[11px] mt-0.5" style={{ color: T.muted, ...fontBody }}>
          {person.role === "none" ? "This account sees nothing until it has a role." : custom
            ? `Custom access for ${first}. Only ticked sections appear in their menu.`
            : `${first} uses the ${person.role} defaults. Tick or untick to customize.`}
        </p>
      </div>
      {custom && !locked && <button type="button" disabled={busy} onClick={() => onChange({ customAccess: false, allowedModules: member.allowedModules })}
        className="text-xs underline shrink-0" style={{ color: T.muted, ...fontBody }}>Reset to {person.role} defaults</button>}
    </div>
    {groups.map(g => <div key={g}>
      <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: T.muted, ...fontBody }}>{g}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5">
        {SECTIONS.filter(x => x.group === g).map(x => {
          const allowedByRole = permitted.includes(x.key);
          const isDefault = (defaults[person.role] || []).includes(x.key);
          return <label key={x.key} className={`flex items-center gap-1.5 text-xs ${allowedByRole ? "cursor-pointer" : ""}`}
            style={{ color: allowedByRole ? T.ink : T.muted, ...fontBody }} title={allowedByRole ? (x.note || undefined) : `Not available for the ${person.role} role. To grant it, make them an admin and untick what they shouldn't see.`}>
            <input type="checkbox" checked={open.has(x.key)} disabled={!allowedByRole || busy || locked} onChange={() => toggle(x.key)} style={{ accentColor: T.accent }} />
            <span className={allowedByRole ? "" : "line-through"}>{x.label}</span>
            {allowedByRole && !custom && isDefault && <span className="text-[10px]" style={{ color: T.muted }}>default</span>}
          </label>;
        })}
      </div>
    </div>)}
    <p className="text-[10px]" style={{ color: T.muted, ...fontBody }}>{locked ? "Only an admin can change an admin's access. " : ""}Ticking a section lets this person use it fully, on any role. Publishing or deleting website content and changes to admin accounts still need an admin. Email Inbox also needs Clients. At least one admin always keeps Team.</p>
  </div>;
}

// Team → Role defaults: the sections each role gets unless a person is customized.
function RoleDefaults({ defaults, onSaved, onClose, viewerIsAdmin }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(["admin", "editor", "staff"].map(r => [r, [...(defaults[r] || [])]])));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const toggle = (role, key) => setDraft(d => ({ ...d, [role]: d[role].includes(key) ? d[role].filter(k => k !== key) : [...d[role], key] }));
  const save = async role => {
    setBusy(role); setError(""); setSaved("");
    const { error: err } = await supabase.from("role_access_defaults").update({ sections: draft[role] }).eq("role", role);
    setBusy("");
    if (err) { setError(/keep access to Team/.test(err.message) ? "At least one active admin must keep access to Team." : err.message); return; }
    setSaved(`${role[0].toUpperCase()}${role.slice(1)} defaults saved.`); onSaved();
  };
  const groups = [...new Set(SECTIONS.map(x => x.group))];
  return <div className="rounded-xl p-5 flex flex-col gap-4" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h3 className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>Role defaults</h3>
        <p className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>Sections each role gets by default. People with custom access keep their own list. Any section can be given to any role.</p>
      </div>
      <Button small tone="outline" onClick={onClose}>Close</Button>
    </div>
    {error && <Notice tone="danger">{error}</Notice>}
    {saved && <Notice tone="success">{saved}</Notice>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {["admin", "editor", "staff"].map(role => {
        const permitted = ROLE_SECTIONS[role];
        const changed = [...draft[role]].sort().join() !== [...(defaults[role] || [])].sort().join();
        return <div key={role} className="rounded-lg p-3 flex flex-col gap-3" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}>
          <div className="flex items-center justify-between"><Badge status={role} /><span className="text-[10px]" style={{ color: T.muted, ...fontBody }}>{draft[role].length} sections</span></div>
          {groups.map(g => <div key={g}>
            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: T.muted, ...fontBody }}>{g}</p>
            <div className="flex flex-col gap-1">
              {SECTIONS.filter(x => x.group === g).map(x => {
                const ok = permitted.includes(x.key);
                return <label key={x.key} className={`flex items-center gap-1.5 text-xs ${ok ? "cursor-pointer" : ""}`} style={{ color: ok ? T.ink : T.muted, ...fontBody }}
                  title={ok ? x.note : `The ${role} role can't use ${x.label}`}>
                  <input type="checkbox" checked={draft[role].includes(x.key)} disabled={!ok || !!busy || (role === "admin" && !viewerIsAdmin)} onChange={() => toggle(role, x.key)} style={{ accentColor: T.accent }} />
                  <span className={ok ? "" : "line-through"}>{x.label}</span>
                </label>;
              })}
            </div>
          </div>)}
          <Button small busy={busy === role} disabled={!changed || (role === "admin" && !viewerIsAdmin)} onClick={() => save(role)}>Save {role} defaults</Button>
        </div>;
      })}
    </div>
  </div>;
}

export default function Team({ me, employees, setEmployees, tasks, setTasks, stageTasks, setStageTasks, stages, onReload, roleDefaults = ROLE_DEFAULTS, onRoleDefaultsChanged }) {
  const [profiles, setProfiles] = useState(null);
  const [authUsers, setAuthUsers] = useState(null);
  const [fnError, setFnError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState({ name: "", title: "" });
  const [showDefaults, setShowDefaults] = useState(false);

  const reload = useCallback(async () => {
    try { setProfiles(await listProfiles()); } catch (err) { setError(err.message); setProfiles([]); }
    try { const { users } = await callAdminUsers("list"); setAuthUsers(Object.fromEntries(users.map(u => [u.id, u]))); setFnError(""); }
    catch (err) { setAuthUsers({}); setFnError(err.message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  // A team record created after the dashboard loaded (e.g. a new invite): reload once.
  const missing = (profiles || []).some(p => !employees.some(e => e.userId === p.id));
  useEffect(() => { if (missing) onReload?.(); }, [missing]);

  // One row per account, joined with its team record.
  const people = useMemo(() => (profiles || []).map(p => ({ ...p, member: employees.find(e => e.userId === p.id) || null }))
    .sort((a, b) => (b.is_active - a.is_active) || (a.full_name || a.email).localeCompare(b.full_name || b.email)), [profiles, employees]);
  const active = people.find(p => p.id === activeId) || people[0] || null;
  useEffect(() => { if (active) setDraft({ name: active.full_name || "", title: active.member?.role || "" }); }, [active?.id, active?.full_name, active?.member?.role]);
  const activeAdmins = people.filter(p => p.role === "admin" && p.is_active).length;
  const status = p => !p.is_active ? <Badge status="Deactivated" /> : authUsers?.[p.id] && !authUsers[p.id].last_sign_in_at && authUsers[p.id].invited_at ? <Badge status="Pending" label="Invited" /> : <Badge status="Published" label="Active" />;

  const run = async (key, fn, done) => {
    setBusy(key); setError(""); setMessage("");
    try { await fn(); if (done) setMessage(done); } catch (err) { setError(err.message); } finally { setBusy(null); }
  };
  const changeRole = (p, role) => {
    if (p.id === me.id) return;
    if (p.role === "admin" && role !== "admin" && activeAdmins <= 1) { setError("Keep at least one active admin."); return; }
    run(`role-${p.id}`, async () => { const updated = await updateProfile(p.id, { role }); setProfiles(prev => prev.map(x => x.id === updated.id ? updated : x)); }, `${p.full_name || p.email} is now ${role}.`);
  };
  const setActive = (p, on) => {
    if (!on && !window.confirm(`Deactivate ${p.full_name || p.email}? They are signed out and can no longer sign in. Their tasks and leads stay assigned.`)) return;
    run(`active-${p.id}`, async () => { await callAdminUsers(on ? "reactivate" : "deactivate", { userId: p.id }); await reload(); }, `${p.full_name || p.email} ${on ? "reactivated" : "deactivated"}.`);
  };
  const saveDetails = p => run(`save-${p.id}`, async () => {
    if ((draft.name.trim() || "") !== (p.full_name || "")) {
      const updated = await updateProfile(p.id, { full_name: draft.name.trim() });
      setProfiles(prev => prev.map(x => x.id === updated.id ? updated : x));
    }
    if (p.member && draft.title.trim() !== (p.member.role || "")) {
      const { error: err } = await supabase.from("employees").update({ role: draft.title.trim() }).eq("id", p.member.id);
      if (err) throw err;
    }
    setEmployees(prev => prev.map(e => e.userId === p.id ? { ...e, name: draft.name.trim() || p.email, role: draft.title.trim() } : e));
  }, "Saved.");
  const saveAccess = (p, next) => run(`access-${p.id}`, async () => {
    const { error: err } = await supabase.from("employees").update({ custom_access: next.customAccess, allowed_modules: next.allowedModules }).eq("id", p.member.id);
    if (err) throw new Error(/keep access to Team/.test(err.message) ? "At least one active admin must keep access to Team." : /Only an admin/.test(err.message) ? err.message : `Could not update access: ${err.message}`);
    setEmployees(prev => prev.map(e => e.id === p.member.id ? { ...e, ...next } : e));
  });

  const viewerIsAdmin = me.role === "admin";
  const adminLocked = p => p.role === "admin" && !viewerIsAdmin;
  const dirty = active && (draft.name.trim() !== (active.full_name || "") || (active.member && draft.title.trim() !== (active.member.role || "")));
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Team" subtitle="Everyone who signs in to the dashboard: their role, what they can see, and their tasks."
        actions={<div className="flex gap-2 flex-wrap">
          <Button tone="outline" icon={SlidersHorizontal} onClick={() => setShowDefaults(v => !v)}>Role defaults</Button>
          <Button icon={UserPlus} disabled={!!fnError} title={fnError ? "The admin-users function is not reachable" : undefined} onClick={() => setInviting(true)}>Invite team member</Button>
        </div>} />
      {showDefaults && <RoleDefaults key={JSON.stringify(roleDefaults)} defaults={roleDefaults} viewerIsAdmin={me.role === "admin"} onClose={() => setShowDefaults(false)} onSaved={() => onRoleDefaultsChanged?.()} />}
      {fnError && <Notice tone="warn">Inviting and deactivating needs the <b>admin-users</b> function ({fnError}). Roles, access and tasks still work.</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
      {profiles === null ? <Spinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 rounded-xl overflow-hidden self-start" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
            {people.map((p, i) => {
              const open = tasks.filter(t => t.employeeId === p.member?.id && !t.done).length;
              return <button key={p.id} onClick={() => setActiveId(p.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ borderBottom: i < people.length - 1 ? `1px solid ${T.border}` : "none", backgroundColor: active?.id === p.id ? T.accentSoft : "transparent", opacity: p.is_active ? 1 : 0.6 }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}>{initials(p.full_name || p.email)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{p.full_name || p.email}{p.id === me.id && <span className="text-xs ml-1.5" style={{ color: T.muted }}>(you)</span>}</div>
                  <div className="text-xs truncate" style={{ color: T.muted, ...fontBody }}>{[p.member?.role, p.full_name ? p.email : null].filter(Boolean).join(" · ") || p.email}</div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0"><Badge status={p.role} />{open > 0 && <span className="text-[10px] px-1.5 rounded-full" style={{ backgroundColor: T.warnSoft, color: T.warn, ...fontBody }}>{open} task{open > 1 ? "s" : ""}</span>}</div>
              </button>;
            })}
          </div>
          {active && <div className="lg:col-span-3 rounded-xl p-5 flex flex-col gap-5" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-base font-medium break-words" style={{ color: T.ink, ...fontBody }}>{active.full_name || active.email}</div>
                <div className="text-xs break-all" style={{ color: T.muted, ...fontBody }}>{active.email}</div>
                <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: T.muted, ...fontBody }}>{status(active)}<span>Last sign-in: {authUsers?.[active.id]?.last_sign_in_at ? formatDateTime(authUsers[active.id].last_sign_in_at) : "—"}</span></div>
              </div>
              {active.id !== me.id && !adminLocked(active) && (active.is_active
                ? <Button tone="outline" small icon={Ban} busy={busy === `active-${active.id}`} disabled={!!fnError} onClick={() => setActive(active, false)}>Deactivate</Button>
                : <Button tone="soft" small icon={CircleCheck} busy={busy === `active-${active.id}`} disabled={!!fnError} onClick={() => setActive(active, true)}>Reactivate</Button>)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LabeledInput label="Full name" value={draft.name} onChange={name => setDraft(d => ({ ...d, name }))} />
              <LabeledInput label="Job title" value={draft.title} onChange={title => setDraft(d => ({ ...d, title }))} placeholder="e.g. Visa Consultant" />
              <div>
                <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Role</label>
                <select value={active.role} disabled={active.id === me.id || busy === `role-${active.id}` || adminLocked(active)} onChange={e => changeRole(active, e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }} title={active.id === me.id ? "You can't change your own role" : undefined}>
                  {["admin", "editor", "staff", "none"].map(r => <option key={r} value={r} disabled={r === "admin" && !viewerIsAdmin}>{r}</option>)}
                </select>
                <p className="text-xs mt-1" style={{ color: T.muted, ...fontBody }}>{ROLE_INFO[active.role]}</p>
              </div>
              <div className="flex items-end"><Button busy={busy === `save-${active.id}`} disabled={!dirty} onClick={() => saveDetails(active)}>Save name and title</Button></div>
            </div>
            {active.member && <AccessList person={active} defaults={roleDefaults} locked={adminLocked(active)} busy={busy === `access-${active.id}`} onChange={next => saveAccess(active, next)} />}
            {active.member ? <Tasks key={active.member.id} member={active.member} tasks={tasks} setTasks={setTasks} stageTasks={stageTasks} setStageTasks={setStageTasks} stages={stages} />
              : <Notice tone="warn">This account's team record is not loaded yet. <button className="underline" onClick={onReload}>Refresh</button></Notice>}
          </div>}
        </div>
      )}
      {inviting && <InviteModal viewerIsAdmin={me.role === "admin"} onClose={() => setInviting(false)} onInvited={async email => { setInviting(false); setMessage(`Invite sent to ${email}.`); await reload(); await onReload?.(); }} />}
    </div>
  );
}
