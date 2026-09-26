// Schema-from-content editor: renders an editing form for any CMS document
// by looking at the shape of its content. Field order follows the content
// (which mirrors the page order), and list items can be added, removed and
// reordered using the shape of existing items as a template.
import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ImageOff, Plus, Trash2 } from "lucide-react";
import { T, fontBody, FieldLabel, ImagePickerButton, inputStyle } from "./ui.jsx";
import { ICONS, getIcon } from "../components/immigration/icons.js";

const isPlainObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
const isImage = v => isPlainObject(v) && "src" in v && ("alt" in v || "mediaId" in v);
const isLink = v => isPlainObject(v) && "href" in v && "label" in v && Object.keys(v).length <= 2;

const LABELS = {
  seo: "SEO", cta: "Button", ctaLabel: "Button text", ctaHref: "Button link", href: "Link", url: "Link",
  primaryCta: "Main button", secondaryCta: "Second button", faqs: "FAQs", heroImage: "Hero image",
  aboutParagraphs: "About paragraphs", viewAll: "\"View all\" link", showOnHome: "Show on homepage",
  showOnHub: "Show on the services page", homeIcon: "Icon on homepage", hubIcon: "Icon on services page",
  flagCode: "Flag (2-letter country code)", flag: "Flag (2-letter country code)", hubTitle: "Card title",
  hubDescription: "Card description", hubCta: "Card button text", titleHighlight: "Highlighted part of the title",
  eyebrow: "Small label above the title", heroPrimaryCta: "Hero button text", heroSecondaryCta: "Hero second button text",
  whyChooseAirfair: "\"Why choose Airfair\" block", hideHelpCta: "Hide the \"Need more help?\" banner",
  eligibilityStyle: "Eligibility style", aboutEyebrow: "Small label above About", packageHighlights: "Package highlights",
  whatsIncluded: "What's included", aboutDetails: "Package details list", relatedCard: "Related card",
  relatedServices: "Related cards", heroBadge: "Hero badge", visaType: "Visa type", countryCode: "Country code",
  imageAlt: "Alt text", alt: "Alt text", src: "Image URL", dateTime: "Date (machine-readable, YYYY-MM-DD)",
  initials: "Source initials", serviceCategory: "Service", clientName: "Client name", photo: "Photo",
  successTitle: "Success heading", successMessage: "Success message", submitLabel: "Submit button text",
  privacyNote: "Privacy note", featured: "Featured", title: "Title", description: "Description",
};

const LONG_TEXT = /(description|body|paragraph|answer|quote|intro|takeaway|outlook|message|blurb|subtext|paragraphs|note)$/i;
const ICON_KEY = /(^icon$|Icon$)/;
const THEMES = ["green", "amber", "blue", "teal"];

export function humanize(key) {
  if (LABELS[key]) return LABELS[key];
  const words = String(key).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function emptyLike(sample) {
  if (Array.isArray(sample)) return [];
  if (isImage(sample)) return { src: "", alt: "", mediaId: null };
  if (isPlainObject(sample)) return Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, emptyLike(v)]));
  if (typeof sample === "number") return 0;
  if (typeof sample === "boolean") return false;
  if (sample === null) return null;
  return "";
}

// Finds an example element for the array at `path` (keys only, no indices)
// across sample documents, so empty lists can still get new items.
function findArraySample(samples, path) {
  const walk = (value, keys) => {
    if (keys.length === 0) return Array.isArray(value) && value.length ? value[0] : undefined;
    if (Array.isArray(value)) {
      for (const item of value) { const found = walk(item, keys); if (found !== undefined) return found; }
      return undefined;
    }
    if (isPlainObject(value)) return walk(value[keys[0]], keys.slice(1));
    return undefined;
  };
  for (const sample of samples) { const found = walk(sample, path); if (found !== undefined) return found; }
  return undefined;
}

function itemTitle(item, index) {
  if (typeof item === "string") return item || `Item ${index + 1}`;
  if (isImage(item)) return item.alt || item.src?.split("/").pop() || `Image ${index + 1}`;
  if (isPlainObject(item)) {
    for (const key of ["title", "label", "question", "name", "heading", "headline", "clientName", "text", "tag"]) {
      if (typeof item[key] === "string" && item[key]) return item[key] + (key === "headline" && item.highlight ? item.highlight : "");
    }
    const first = Object.values(item).find(v => typeof v === "string" && v);
    if (first) return first;
  }
  return `Item ${index + 1}`;
}

const textInputClass = "w-full rounded-lg px-3 py-2 text-sm outline-none";

function TextField({ name, value, onChange }) {
  const long = LONG_TEXT.test(name) || (value || "").length > 80;
  if (long) return <textarea rows={Math.min(8, Math.max(3, Math.ceil((value || "").length / 90)))} value={value ?? ""} onChange={e => onChange(e.target.value)} className={textInputClass} style={inputStyle} />;
  return <input value={value ?? ""} onChange={e => onChange(e.target.value)} className={textInputClass} style={inputStyle} placeholder={/(href|url|link)$/i.test(name) ? "/page, #section or https://…" : undefined} />;
}

function IconField({ value, onChange }) {
  const Icon = getIcon(value);
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: T.accentSoft, color: T.accent }}><Icon size={16} /></span>
      <select value={value || ""} onChange={e => onChange(e.target.value)} className={textInputClass} style={{ ...inputStyle, backgroundColor: "#fff" }}>
        {!ICONS[value] && <option value={value || ""}>{value || "Choose an icon"}</option>}
        {Object.keys(ICONS).sort().map(key => <option key={key} value={key}>{key}</option>)}
      </select>
    </div>
  );
}

function ImageField({ value, onChange }) {
  const image = value || { src: "", alt: "", mediaId: null };
  return (
    <div className="flex items-start gap-3">
      {image.src ? <img src={image.src} alt="" className="w-24 h-16 object-cover rounded-lg shrink-0" style={{ border: `1px solid ${T.border}` }} />
        : <span className="w-24 h-16 rounded-lg shrink-0 flex items-center justify-center" style={{ border: `1.5px dashed ${T.border}`, color: T.muted }}><ImageOff size={16} /></span>}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="flex gap-2 flex-wrap items-center">
          <ImagePickerButton label={image.src ? "Replace" : "Choose image"} onPicked={(url, media) => onChange({ ...image, src: url, mediaId: media?.id || null, alt: image.alt || media?.alt_text || "" })} />
          {image.src && <button type="button" className="text-xs underline" style={{ color: T.muted, ...fontBody }} onClick={() => onChange({ ...image, src: "", mediaId: null })}>Remove</button>}
        </div>
        {"alt" in image && <input value={image.alt ?? ""} onChange={e => onChange({ ...image, alt: e.target.value })} placeholder="Alt text (describe the image)" className="w-full rounded-lg px-3 py-1.5 text-xs outline-none" style={inputStyle} />}
      </div>
    </div>
  );
}

function LinkField({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <input value={value.label ?? ""} onChange={e => onChange({ ...value, label: e.target.value })} placeholder="Text" className={textInputClass} style={inputStyle} />
      <input value={value.href ?? ""} onChange={e => onChange({ ...value, href: e.target.value })} placeholder="/page, #section or https://…" className={textInputClass} style={inputStyle} />
    </div>
  );
}

function ItemControls({ index, count, onMove, onRemove }) {
  const btn = "p-1 rounded";
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index, -1)} aria-label="Move up" style={{ color: index === 0 ? T.border : T.muted }}><ArrowUp size={14} /></button>
      <button type="button" className={btn} disabled={index === count - 1} onClick={() => onMove(index, 1)} aria-label="Move down" style={{ color: index === count - 1 ? T.border : T.muted }}><ArrowDown size={14} /></button>
      <button type="button" className={btn} onClick={() => onRemove(index)} aria-label="Remove" style={{ color: T.danger }}><Trash2 size={14} /></button>
    </div>
  );
}

function ArrayField({ name, value, onChange, path, ctx }) {
  const items = value || [];
  const sample = items[0] !== undefined ? items[0] : findArraySample(ctx.samples, path);
  const [open, setOpen] = useState({});
  const move = (index, dir) => {
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(index + dir, 0, moved);
    onChange(next);
  };
  const remove = index => onChange(items.filter((_, i) => i !== index));
  const add = () => { onChange([...items, sample === undefined ? "" : emptyLike(sample)]); setOpen(prev => ({ ...prev, [items.length]: true })); };
  const simple = sample === undefined || typeof sample === "string";

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => simple ? (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1 min-w-0"><TextField name={name} value={item} onChange={v => onChange(items.map((it, i) => (i === index ? v : it)))} /></div>
          <ItemControls index={index} count={items.length} onMove={move} onRemove={remove} />
        </div>
      ) : (
        <div key={index} className="rounded-lg" style={{ border: `1px solid ${T.border}`, backgroundColor: "#fff" }}>
          <div className="flex items-center gap-2 px-3 py-2">
            <button type="button" className="flex items-center gap-1.5 flex-1 min-w-0 text-left" onClick={() => setOpen(prev => ({ ...prev, [index]: !prev[index] }))}>
              {open[index] ? <ChevronDown size={14} style={{ color: T.muted }} /> : <ChevronRight size={14} style={{ color: T.muted }} />}
              <span className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{itemTitle(item, index)}</span>
            </button>
            <ItemControls index={index} count={items.length} onMove={move} onRemove={remove} />
          </div>
          {open[index] && <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${T.border}` }}>
            <ValueField name={name} value={item} onChange={v => onChange(items.map((it, i) => (i === index ? v : it)))} path={path} ctx={ctx} inList />
          </div>}
        </div>
      ))}
      <button type="button" onClick={add} className="self-start text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1" style={{ backgroundColor: T.bg, color: T.ink, border: `1px dashed ${T.border}`, ...fontBody }}><Plus size={12} /> Add {humanize(name).replace(/s$/, "").toLowerCase() || "item"}</button>
    </div>
  );
}

function ObjectFields({ value, onChange, path, ctx }) {
  const entries = Object.entries(value).filter(([key]) => !ctx.hidden.has(key));
  const hint = typeof value.note === "string" ? value.note : null;
  return (
    <div className="flex flex-col gap-3.5">
      {hint && <p className="text-xs" style={{ color: T.muted, ...fontBody }}>{hint}</p>}
      {entries.filter(([key]) => key !== "note").map(([key, v]) => (
        <Field key={key} name={key} value={v} path={[...path, key]} ctx={ctx} onChange={next => onChange({ ...value, [key]: next })} />
      ))}
    </div>
  );
}

function ValueField({ name, value, onChange, path, ctx, inList }) {
  if (isImage(value) || (value === null && /(image|photo|logo|poster)$/i.test(name))) return <ImageField value={value} onChange={onChange} />;
  if (isLink(value)) return <LinkField value={value} onChange={onChange} />;
  if (Array.isArray(value)) return <ArrayField name={name} value={value} onChange={onChange} path={path} ctx={ctx} />;
  if (isPlainObject(value)) return inList ? <ObjectFields value={value} onChange={onChange} path={path} ctx={ctx} /> : (
    <div className="rounded-lg px-3 py-3" style={{ backgroundColor: T.bg, border: `1px solid ${T.border}` }}><ObjectFields value={value} onChange={onChange} path={path} ctx={ctx} /></div>
  );
  if (typeof value === "boolean") return <label className="flex items-center gap-2 text-sm" style={{ color: T.ink, ...fontBody }}><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} style={{ accentColor: T.accent }} /> {value ? "Yes" : "No"}</label>;
  if (typeof value === "number") return <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className={textInputClass} style={inputStyle} />;
  if (ICON_KEY.test(name)) return <IconField value={value} onChange={onChange} />;
  if (name === "theme") return <select value={value || ""} onChange={e => onChange(e.target.value)} className={textInputClass} style={{ ...inputStyle, backgroundColor: "#fff" }}>{THEMES.map(t => <option key={t} value={t}>{t}</option>)}</select>;
  if (name === "eligibilityStyle") return <select value={value || ""} onChange={e => onChange(e.target.value)} className={textInputClass} style={{ ...inputStyle, backgroundColor: "#fff" }}><option value="">Cards with icons</option><option value="checklist">Checklist</option></select>;
  if (value === null) return <span className="text-xs" style={{ color: T.muted, ...fontBody }}>Not set</span>;
  return <TextField name={name} value={value} onChange={onChange} />;
}

function Field({ name, value, onChange, path, ctx }) {
  if (typeof value === "boolean") {
    return <label className="flex items-center gap-2.5 text-sm" style={{ color: T.ink, ...fontBody }}><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} style={{ accentColor: T.accent }} />{humanize(name)}</label>;
  }
  return (
    <div>
      <FieldLabel>{humanize(name)}</FieldLabel>
      <ValueField name={name} value={value} onChange={onChange} path={path} ctx={ctx} />
    </div>
  );
}

// value: the object to edit; samples: other documents' content of the same
// kind (templates for new list items); hiddenKeys: keys not to show.
export default function ContentEditor({ value, onChange, samples = [], hiddenKeys = [], path = [] }) {
  const ctx = useMemo(() => ({ samples, hidden: new Set(["mediaId", ...hiddenKeys]) }), [samples, hiddenKeys]);
  if (!isPlainObject(value)) return null;
  return <ObjectFields value={value} onChange={onChange} path={path} ctx={ctx} />;
}
