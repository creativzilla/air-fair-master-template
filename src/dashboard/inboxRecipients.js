// Final Compose/Reply recipients, computed exactly like queue_inbox_message
// (and the send payload): lower-cased, first occurrence kept, never repeating
// To; BCC never repeats CC. The automatic sender copy comes first.
export const EMAIL = /^[^\s<>,;@]+@[^\s<>,;@]+\.[^\s<>,;@]+$/;
export const MAX_COPIES = 20;
export const normalizeEmail = value => String(value || "").trim().toLowerCase();

const unique = (list, exclude) => {
  const seen = new Set(exclude), out = [];
  for (const value of list) { const a = normalizeEmail(value); if (a && !seen.has(a)) { seen.add(a); out.push(a); } }
  return out;
};

export function finalRecipients({ to, mode, senderEmail, cc = [], bcc = [] }) {
  const toAddress = normalizeEmail(to);
  const auto = mode !== "off" && senderEmail ? normalizeEmail(senderEmail) : "";
  const ccList = unique([...(mode === "cc" && auto ? [auto] : []), ...cc], [toAddress]);
  const bccList = unique([...(mode === "bcc" && auto ? [auto] : []), ...bcc], [toAddress, ...ccList]);
  const isAuto = (a, field) => a === auto && mode === field;
  return {
    to: toAddress, cc: ccList, bcc: bccList,
    ccChips: ccList.map(address => ({ address, auto: isAuto(address, "cc") })),
    bccChips: bccList.map(address => ({ address, auto: isAuto(address, "bcc") })),
  };
}

// Why a manually entered address can't be added, or "" when it can.
export function recipientProblem(value, current) {
  const a = normalizeEmail(value);
  if (!EMAIL.test(a)) return "Enter a valid email address.";
  if (a === current.to) return "That address is already in To.";
  if (current.cc.includes(a) || current.bcc.includes(a)) return "That address is already a recipient.";
  return "";
}

// Reply All: the other people on a message, minus the client (To), Airfair's
// own sending/receiving addresses and the replying user (whose copy is
// handled by the sender-copy policy). Deduplicated by finalRecipients later.
export function replyAllCc(message, { to, self } = {}) {
  if (!message) return [];
  const own = a => a.endsWith("@reply.airfairtravel.com") || a === "no-reply@airfairtravel.com";
  const list = [message.to_email, message.cc_email].join(",").split(",").map(normalizeEmail)
    .filter(a => EMAIL.test(a) && !own(a) && a !== normalizeEmail(to) && a !== normalizeEmail(self));
  return [...new Set(list)];
}

// Same limits as queue_inbox_message (server re-checks sizes/types in storage).
export const MAX_FILES = 5;
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const BLOCKED_EXT = new Set(("adp app asp bas bat cer chm cmd com cpl crt csh der exe fxp gadget hlp hta inf ins isp its js jse ksh lib lnk mad maf " +
  "mag mam maq mar mas mat mau mav maw mda mdb mde mdt mdw mdz msc msh msi msp mst ops pcd pif plg prf prg ps1 reg scf scr sct shb shs sys tmp url " +
  "vb vbe vbs vps vsmacros vss vst vsw vxd ws wsc wsf wsh xnk").split(" "));
export function attachmentProblem(files, adding) {
  const all = [...files, ...adding];
  if (all.length > MAX_FILES) return `Attach up to ${MAX_FILES} files.`;
  const blocked = adding.find(f => BLOCKED_EXT.has((f.name.match(/\.([A-Za-z0-9]+)$/)?.[1] || "").toLowerCase()));
  if (blocked) return `${blocked.name}: this file type can't be emailed.`;
  if (all.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) return "Attachments are limited to 10 MB in total.";
  return "";
}
export const formatBytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;

// Gmail-style list time: time today, "Oct 2" this year, else a short date.
export function rowTime(value, now = new Date()) {
  if (!value) return "";
  const d = new Date(value);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { year: "2-digit", month: "numeric", day: "numeric" });
}

// From: only active mailboxes the user may send from (the server re-checks).
// Replies default to the mailbox that received the conversation.
export function pickFromMailbox(mailboxes, preferred) {
  const sendable = (mailboxes || []).filter(b => b.can_send && b.status === "active");
  return { sendable, initial: (sendable.find(b => b.id === preferred) || sendable.find(b => b.is_default) || sendable[0])?.id || "" };
}
