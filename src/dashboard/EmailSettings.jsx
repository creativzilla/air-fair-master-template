// Form Emails > Inboxes & sending: where website form notifications go, test mode, the on/off
// switch, and a log of recent emails with retry. Admin only (RLS enforces it).
import React, { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { T, fontBody, Badge, Button, FieldLabel, LabeledInput, LabeledSelect, Notice, Panel, ToggleRow, formatDateTime } from "./ui.jsx";
import { supabase } from "../lib/supabase.js";

const SENDER = "Air Fair Travel & Immigration <no-reply@airfairtravel.com>";
const EMAIL = /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/;
const SERVICE_INBOXES = [
  ["inbox_general", "Website contact form"],
  ["inbox_immigration", "Immigration assessments"],
  ["inbox_visa", "Visa inquiries"],
  ["inbox_travel", "Travel package inquiries"],
];
const STATUS_LABEL = { pending: "Queued", sending: "Sending", retry: "Will retry", sent: "Sent", failed: "Failed", skipped: "Not sent" };
const STATUS_BADGE = { pending: "Pending", sending: "Pending", retry: "Pending", sent: "Confirmed", failed: "Cancelled", skipped: "Cancelled" };
const KIND_LABEL = { staff_notification: "Staff", client_confirmation: "Client", newsletter_confirmation: "Newsletter", test_email: "Test" };

const COPY_MODES = [
  { value: "cc", label: "CC: visible copy to the sending staff member" },
  { value: "bcc", label: "BCC: hidden copy to the sending staff member" },
  { value: "off", label: "Off: no automatic sender copy" },
];

const clean = value => (value || "").trim().toLowerCase() || null;

export default function EmailSettings() {
  const [form, setForm] = useState(null);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const loadLog = async () => {
    const { data } = await supabase.from("email_outbox")
      .select("id,created_at,kind,service_type,form_id,to_email,subject,status,attempts,last_error,sent_at")
      .order("created_at", { ascending: false }).limit(40);
    setLog(data || []);
  };

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.from("email_settings").select("*").eq("id", 1).maybeSingle();
      if (err || !data) {
        setError(/email_settings/.test(err?.message || "") || !data
          ? "Email settings aren't set up yet. Push the latest database update (npx supabase@2.118.0 db push)."
          : err.message);
        setForm(false);
        return;
      }
      setForm(data);
      loadLog();
    })();
  }, []);

  if (form === null) return <Panel className="p-6"><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Loading email settings...</p></Panel>;
  if (form === false) return <Panel className="p-6"><Notice tone="warn">{error}</Notice></Panel>;

  const set = patch => { setForm(prev => ({ ...prev, ...patch })); setNotice(""); setError(""); };

  const save = async () => {
    const patch = {
      staff_inbox: clean(form.staff_inbox),
      test_redirect_to: clean(form.test_redirect_to),
      ...Object.fromEntries(SERVICE_INBOXES.map(([key]) => [key, clean(form[key])])),
      sending_enabled: !!form.sending_enabled,
      // Only once the sender-copy migration has added the column.
      ...("inbox_sender_copy" in form ? { inbox_sender_copy: COPY_MODES.some(o => o.value === form.inbox_sender_copy) ? form.inbox_sender_copy : "cc" } : {}),
    };
    const bad = Object.entries(patch).find(([key, value]) => !["sending_enabled", "inbox_sender_copy"].includes(key) && value && !EMAIL.test(value));
    if (bad) { setError(`"${bad[1]}" isn't a valid email address.`); return; }
    if (patch.sending_enabled && !patch.staff_inbox) { setError("Enter the monitored staff inbox before turning sending on."); return; }
    setBusy("save");
    const { data, error: err } = await supabase.from("email_settings").update(patch).eq("id", 1).select().single();
    setBusy("");
    if (err) { setError(err.message); return; }
    setForm(data);
    setNotice("Saved.");
  };

  const retry = async () => {
    setBusy("retry"); setError(""); setNotice("");
    const { data, error: err } = await supabase.functions.invoke("form-submit", { body: { action: "process_outbox", retry_failed: true } });
    setBusy("");
    if (err) {
      let message = err.message;
      try { message = (await err.context?.json?.())?.error || message; } catch { /* keep message */ }
      setError(/not found|404|Failed to send/i.test(message) ? "The form-submit Edge Function isn't deployed yet." : message);
      return;
    }
    setNotice(`Sent ${data.sent}, will retry ${data.retry}, failed ${data.failed}.`);
    loadLog();
  };

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-6 max-w-xl">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: T.ink, ...fontBody }}>Website form emails</h3>
            <p className="text-xs" style={{ color: T.muted, ...fontBody }}>
              Each contact, immigration, visa and travel inquiry sends a notification to your team and an auto-reply to the client (edit it under "Client auto-replies").
              Newsletter signups get a separate confirm-your-subscription email. Sender: {SENDER}.
            </p>
          </div>

          <LabeledInput label="Monitored staff inbox" value={form.staff_inbox} onChange={staff_inbox => set({ staff_inbox })}
            placeholder="The Google Workspace inbox your team checks"
            hint="Receives every notification (unless a service below has its own inbox). Clients' replies also go here." />

          <div>
            <FieldLabel hint="Optional. Leave empty to use the main inbox.">Separate inbox per service</FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SERVICE_INBOXES.map(([key, label]) => (
                <LabeledInput key={key} label={label} value={form[key]} onChange={value => set({ [key]: value })} placeholder={form.staff_inbox || "Main inbox"} />
              ))}
            </div>
          </div>

          <LabeledInput label="Test mode: send everything to" value={form.test_redirect_to} onChange={test_redirect_to => set({ test_redirect_to })}
            placeholder="Leave empty for normal sending"
            hint="While set, every email (staff and client) goes only to this address, marked [TEST]. Use it to try the forms without emailing clients." />

          {"inbox_sender_copy" in form && <div className="flex flex-col gap-2">
            <LabeledSelect label="Email Inbox: copy to the sender" value={form.inbox_sender_copy || "cc"}
              onChange={inbox_sender_copy => set({ inbox_sender_copy })} options={COPY_MODES} />
            <p className="text-xs" style={{ color: T.muted, ...fontBody }}>
              Applies only to emails staff send or reply to from the Email Inbox; the copy goes to the sender's own account email.
              Website form auto-replies and staff notifications are not affected. Replies still return to the dashboard conversation.
            </p>
            {(form.inbox_sender_copy || "cc") === "cc" && <Notice tone="warn">CC shows the staff member's email address to the client, and the client's Reply All will include it. Choose BCC to keep it hidden.</Notice>}
          </div>}

          <ToggleRow label="Send emails" checked={form.sending_enabled} onChange={sending_enabled => set({ sending_enabled })} />
          {form.test_redirect_to && <Notice tone="warn">Test mode is on: clients won't receive emails.</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
          {notice && <Notice tone="success">{notice}</Notice>}
          <div><Button icon={Save} busy={busy === "save"} onClick={save}>Save email settings</Button></div>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>Recent emails</h3>
            <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Failed sends retry automatically every 5 minutes (up to 5 attempts). "Retry failed now" also retries ones that gave up.</p>
          </div>
          <div className="flex gap-2">
            <Button tone="outline" small icon={RefreshCw} onClick={loadLog}>Refresh</Button>
            <Button small busy={busy === "retry"} onClick={retry}>Retry failed now</Button>
          </div>
        </div>
        {log.length === 0 ? <p className="text-sm" style={{ color: T.muted, ...fontBody }}>No emails yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ ...fontBody, color: T.ink }}>
              <thead><tr style={{ color: T.muted }}>{["When", "Type", "Form", "To", "Status", "Details"].map(h => <th key={h} className="text-left font-medium py-2 pr-3">{h}</th>)}</tr></thead>
              <tbody>{log.map(row => (
                <tr key={row.id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                  <td className="py-2 pr-3">{KIND_LABEL[row.kind] || row.kind}</td>
                  <td className="py-2 pr-3">{row.form_id}</td>
                  <td className="py-2 pr-3">{row.to_email}</td>
                  <td className="py-2 pr-3"><Badge status={STATUS_BADGE[row.status]} label={STATUS_LABEL[row.status] || row.status} />{row.attempts > 1 ? <span style={{ color: T.muted }}> ({row.attempts} tries)</span> : null}</td>
                  <td className="py-2 pr-3" style={{ color: row.status === "failed" ? T.danger : T.muted }}>{row.last_error || row.subject}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
