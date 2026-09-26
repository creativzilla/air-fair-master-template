// Add or edit a CRM lead (contacts row) from Pipeline or Clients: walk-in,
// phone and referral clients no longer need a website form to exist.
import React, { useMemo, useState } from "react";
import { CalendarDays, FileText, FolderOpen, Inbox, Trash2 } from "lucide-react";
import { T, fontBody, Badge, Button, Drawer, FieldLabel, LabeledInput, LabeledSelect, LabeledTextarea, Notice, formatDateTime, inputStyle } from "./ui.jsx";
import { supabase } from "../lib/supabase.js";

// Same categories website forms use when they create leads automatically.
export const LEAD_CATEGORIES = ["Immigration Processing", "Visa", "Tour Package", "General"];

const digits = v => String(v || "").replace(/\D/g, "");

export function mapContactRow(r) {
  return {
    id: r.id, submissionId: r.submission_id, name: r.name, email: r.email, phone: r.phone, category: r.category,
    status: r.status, amount: r.amount ? Number(r.amount) : null, assignedEmployeeId: r.assigned_employee_id,
    source: r.source ?? null, notes: r.notes ?? null, createdAt: r.created_at,
  };
}

function friendly(err) {
  const msg = err?.message || String(err);
  if (err?.code === "23503" && /client_documents/.test(msg)) return "This client still has documents. Delete their documents first (Documents tab), then delete the lead.";
  if (err?.code === "23503") return "This lead is still linked to other records. Push the latest database update (npx supabase@2.118.0 db push) so bookings and tasks are unlinked automatically.";
  if (/source|notes/.test(msg) && /column/.test(msg)) return "Source and notes need the latest database update (npx supabase@2.118.0 db push).";
  if (/row-level security|permission/i.test(msg)) return "You don't have permission to do that.";
  return msg;
}

export default function LeadDrawer({ lead, contacts, stages, employees, bookings, role, onClose, onSaved, onDeleted, goTo, onOpenDocuments }) {
  const isNew = !lead;
  const [form, setForm] = useState({
    name: lead?.name || "", email: lead?.email || "", phone: lead?.phone || "",
    category: lead?.category || LEAD_CATEGORIES[0], status: lead?.status || stages[0] || "New Lead",
    amount: lead?.amount ?? "", assignedEmployeeId: lead?.assignedEmployeeId || "",
    source: lead?.source || "", notes: lead?.notes || "",
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const set = patch => setForm(prev => ({ ...prev, ...patch }));

  const duplicates = useMemo(() => {
    const email = form.email.trim().toLowerCase();
    const phone = digits(form.phone);
    return contacts.filter(c => c.id !== lead?.id && ((email && (c.email || "").toLowerCase() === email) || (phone.length >= 7 && digits(c.phone) === phone)));
  }, [contacts, form.email, form.phone, lead?.id]);

  const categoryOptions = [...new Set([...LEAD_CATEGORIES, ...contacts.map(c => c.category).filter(Boolean), form.category])];
  const sourceSuggestions = [...new Set(contacts.map(c => c.source).filter(Boolean))];
  const leadBookings = lead ? bookings.filter(b => b.contactId === lead.id) : [];

  const save = async () => {
    setError("");
    if (!form.name.trim()) { setError("Enter the client's name."); return; }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError("Enter a valid email address or leave it empty."); return; }
    const row = {
      name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null,
      category: form.category, status: form.status, amount: form.amount === "" ? null : Number(form.amount) || null,
      assigned_employee_id: form.assignedEmployeeId || null,
    };
    // Only send source/notes when used, so saving works even before the
    // migration that adds these columns is pushed.
    if (form.source.trim() || lead?.source) row.source = form.source.trim() || null;
    if (form.notes.trim() || lead?.notes) row.notes = form.notes.trim() || null;
    setBusy("save");
    const query = isNew ? supabase.from("contacts").insert(row) : supabase.from("contacts").update(row).eq("id", lead.id);
    const { data, error: err } = await query.select().single();
    setBusy("");
    if (err) { setError(friendly(err)); return; }
    onSaved(mapContactRow(data), isNew);
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${lead.name}? Their bookings and tasks are kept but unlinked. This can't be undone.`)) return;
    setBusy("delete"); setError("");
    const { error: err } = await supabase.from("contacts").delete().eq("id", lead.id);
    setBusy("");
    if (err) { setError(friendly(err)); return; }
    onDeleted(lead.id);
  };

  return (
    <Drawer title={isNew ? "New lead" : lead.name} onClose={onClose} footer={<>
      {!isNew && role === "admin" && <Button tone="danger" icon={Trash2} busy={busy === "delete"} onClick={remove}>Delete</Button>}
      <Button tone="outline" onClick={onClose}>Cancel</Button>
      <Button busy={busy === "save"} onClick={save}>{isNew ? "Add lead" : "Save changes"}</Button>
    </>}>
      <div className="flex flex-col gap-5">
        {!isNew && (
          <div className="flex gap-2 flex-wrap">
            <Button tone="soft" small icon={FolderOpen} onClick={() => onOpenDocuments(lead.id)}>Documents</Button>
            {lead.submissionId && <Button tone="outline" small icon={Inbox} onClick={() => goTo("forms")}>From a website form</Button>}
            <Button tone="outline" small icon={CalendarDays} onClick={() => goTo("bookings")}>Calendar</Button>
          </div>
        )}
        <LabeledInput label="Full name" value={form.name} onChange={name => set({ name })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledInput label="Email" type="email" value={form.email} onChange={email => set({ email })} />
          <LabeledInput label="Phone / WhatsApp" type="tel" value={form.phone} onChange={phone => set({ phone })} />
        </div>
        {duplicates.length > 0 && <Notice tone="warn">Possible duplicate: {duplicates.map(d => d.name).join(", ")} already {duplicates.length === 1 ? "has" : "have"} this {duplicates.some(d => (d.email || "").toLowerCase() === form.email.trim().toLowerCase() && form.email.trim()) ? "email" : "phone number"}.</Notice>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledSelect label="Category" value={form.category} onChange={category => set({ category })} options={categoryOptions.map(c => ({ value: c, label: c }))} />
          <LabeledSelect label="Stage" value={form.status} onChange={status => set({ status })} options={[...new Set([...stages, form.status])].map(s => ({ value: s, label: s }))} />
          <LabeledInput label="Amount" type="number" value={form.amount} onChange={amount => set({ amount })} />
          <LabeledSelect label="Assigned to" value={form.assignedEmployeeId || ""} onChange={assignedEmployeeId => set({ assignedEmployeeId })} options={[{ value: "", label: "Unassigned" }, ...employees.map(e => ({ value: e.id, label: e.name }))]} />
        </div>
        <div>
          <FieldLabel hint="Where this client came from, e.g. walk-in, phone call, referral.">Source</FieldLabel>
          <input list="lead-source-options" value={form.source} onChange={e => set({ source: e.target.value })} placeholder="Type or pick a source" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          <datalist id="lead-source-options">{sourceSuggestions.map(s => <option key={s} value={s} />)}</datalist>
        </div>
        <LabeledTextarea label="Notes" rows={4} value={form.notes} onChange={notes => set({ notes })} placeholder="Visible to your team only" />
        {!isNew && leadBookings.length > 0 && (
          <div>
            <FieldLabel>Bookings</FieldLabel>
            <div className="flex flex-col gap-1.5">{leadBookings.map(b => <div key={b.id} className="flex items-center justify-between gap-3 text-sm rounded-lg px-3 py-2" style={{ backgroundColor: T.bg, border: `1px solid ${T.border}`, color: T.ink, ...fontBody }}><span className="truncate">{b.purpose || "Meeting"}</span><span className="flex items-center gap-2 shrink-0 text-xs" style={{ color: T.muted }}>{b.date}{b.time ? ` · ${b.time}` : ""} <Badge status={b.status} /></span></div>)}</div>
          </div>
        )}
        {!isNew && lead.createdAt && <p className="text-xs flex items-center gap-1.5" style={{ color: T.muted, ...fontBody }}><FileText size={12} /> Added {formatDateTime(lead.createdAt)}</p>}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Drawer>
  );
}
