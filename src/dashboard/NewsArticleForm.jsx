// Layout for the News article editor: the same fields and values as the
// generic content editor, arranged into titled sections with short related
// fields side by side (one column on phones). Adds a slug suggestion from the
// title, a category picker (with "create new"), and a calendar date picker
// that fills both the machine date and the display date.
import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Plus, X } from "lucide-react";
import { T, fontBody, FieldLabel, LabeledInput, Panel, inputStyle } from "./ui.jsx";
import { ContentField } from "./ContentEditor.jsx";

const TOP_LEVEL_KEYS = ["category", "type", "date", "dateTime", "title", "description", "source", "initials", "href", "image", "logo", "article"];
const ARTICLE_KEYS = ["intro", "heading", "body", "takeaway", "points", "outlook"];
const HIDDEN_KEYS = new Set(["slug", "formKey", "_doc", "seo"]);
export const DEFAULT_NEWS_CATEGORIES = ["Travel & Events", "Immigration", "Tourism News", "Policy Updates"];

const LABELS = {
  type: "Where it appears", title: "Title", description: "Description", source: "Source name", initials: "Source initials",
  href: "Source link", image: "Image", logo: "Logo", intro: "Intro", heading: "Heading", body: "Body",
  takeaway: "Takeaway", points: "Key points", outlook: "Outlook",
};

export const slugify = text => String(text || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export function uniqueSlug(base, taken) {
  if (!base) return "";
  let slug = base;
  let i = 2;
  while (taken.has(slug)) slug = `${base}-${i++}`;
  return slug;
}

// "2026-09-14" -> "September 14, 2026"
export function displayDateFor(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Section({ title, children }) {
  return (
    <Panel className="p-6">
      <h3 className="text-base font-semibold mb-5" style={{ color: T.ink, ...fontBody }}>{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6">{children}</div>
    </Panel>
  );
}

const Full = ({ children }) => <div className="sm:col-span-2 min-w-0">{children}</div>;
const Half = ({ children }) => <div className="min-w-0">{children}</div>;
const smallButton = { backgroundColor: T.accentSoft, color: T.accent, ...fontBody };

export function CategoryField({ value, options, onChange }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const add = () => { const v = name.trim(); if (!v) return; onChange(v); setCreating(false); setName(""); };
  return (
    <div>
      <FieldLabel>Category</FieldLabel>
      {creating ? (
        <div className="flex gap-2">
          <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") setCreating(false); }}
            placeholder="New category name" className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          <button type="button" onClick={add} className="px-3 rounded-lg" style={smallButton} aria-label="Add category"><Check size={15} /></button>
          <button type="button" onClick={() => setCreating(false)} className="px-3 rounded-lg" style={{ ...inputStyle, color: T.muted }} aria-label="Cancel"><X size={15} /></button>
        </div>
      ) : (
        <select value={value || ""} onChange={e => (e.target.value === "__new__" ? setCreating(true) : onChange(e.target.value))}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>
          {options.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="__new__">+ Create new category…</option>
        </select>
      )}
    </div>
  );
}

export default function NewsArticleForm({ doc, draft, setDraft, meta, setMeta, slugInput, samples, siblings = [], slugEditable = true }) {
  const set = (key, value) => setDraft({ ...draft, [key]: value });
  const isImageKey = key => key === "image" || key === "logo";
  const field = key => <ContentField name={key} label={LABELS[key]} value={isImageKey(key) ? draft[key] ?? null : draft[key]} samples={samples} onChange={value => set(key, value)} />;

  const article = draft.article;
  const setArticle = (key, value) => setDraft({ ...draft, article: { ...(article || {}), [key]: value } });
  const articleField = key => <ContentField name={key} label={LABELS[key]} value={article?.[key]} samples={samples} path={["article", key]} onChange={value => setArticle(key, value)} />;
  const extraArticleKeys = article ? Object.keys(article).filter(k => !ARTICLE_KEYS.includes(k)) : [];
  const extraKeys = Object.keys(draft).filter(k => !TOP_LEVEL_KEYS.includes(k) && !HIDDEN_KEYS.has(k));

  // ---- URL slug suggested from the title -----------------------------------
  const takenSlugs = useMemo(() => new Set(siblings.filter(d => d.id !== doc?.id).map(d => d.slug)), [siblings, doc?.id]);
  const suggestedSlug = uniqueSlug(slugify(draft.title), takenSlugs);
  const isPublished = !!doc?.published_version_id;
  // Follow the title automatically until the article is published or someone types a slug.
  const [slugTouched, setSlugTouched] = useState(() => isPublished || (!!meta.slug && meta.slug !== uniqueSlug(slugify(draft.title), takenSlugs)));
  const onTitleChange = title => {
    const next = { ...draft, title };
    setDraft(next);
    const patch = {};
    if (!slugTouched && slugEditable && !isPublished) patch.slug = uniqueSlug(slugify(title), takenSlugs);
    if (!meta.title || meta.title === draft.title) patch.title = title;
    if (Object.keys(patch).length) setMeta({ ...meta, ...patch });
  };

  // ---- Categories -------------------------------------------------------
  const categoryOptions = useMemo(() => {
    const all = [...DEFAULT_NEWS_CATEGORIES, ...siblings.map(d => d.draft?.category), draft.category].filter(Boolean);
    return [...new Set(all)];
  }, [siblings, draft.category]);

  // ---- Defaults for new (never published) articles: today's date, a category.
  // Published items are left untouched (e.g. travel guides have no date by design).
  useEffect(() => {
    if (isPublished) return;
    const patch = {};
    if (!draft.category) patch.category = DEFAULT_NEWS_CATEGORIES[0];
    if (!draft.dateTime && !draft.date) { const iso = todayISO(); patch.dateTime = iso; patch.date = displayDateFor(iso); }
    if (Object.keys(patch).length) setDraft({ ...draft, ...patch });
    // Only when an item without these values is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  const fullDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.dateTime || "");
  const pickDate = iso => setDraft({ ...draft, dateTime: iso, date: iso ? displayDateFor(iso) : draft.date });

  return (
    <div className="flex flex-col gap-6">
      <Section title="Basic details">
        <Half><LabeledInput label="Name in dashboard lists" value={meta.title} onChange={title => setMeta({ ...meta, title })} /></Half>
        <Half>
          <div onInput={() => setSlugTouched(true)}>{slugInput}</div>
          {slugEditable && !isPublished && suggestedSlug && suggestedSlug !== meta.slug && (
            <button type="button" onClick={() => { setMeta({ ...meta, slug: suggestedSlug }); setSlugTouched(false); }} className="mt-2 text-xs px-2.5 py-1.5 rounded-md" style={smallButton}>
              Use suggestion: {suggestedSlug}
            </button>
          )}
        </Half>
        <Half><CategoryField value={draft.category} options={categoryOptions} onChange={category => set("category", category)} /></Half>
        <Half><LabeledInput label="Order in lists" type="number" value={meta.sort_order} onChange={sort_order => setMeta({ ...meta, sort_order })} /></Half>
      </Section>

      <Section title="Content">
        <Full>{field("type")}</Full>
        <Half>
          <FieldLabel hint="Picking a date fills in the display date too.">Date</FieldLabel>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <CalendarDays size={15} style={{ color: T.muted, position: "absolute", left: 10, top: 11, pointerEvents: "none" }} />
              <input type="date" value={fullDate ? draft.dateTime : ""} onChange={e => pickDate(e.target.value)} aria-label="Date"
                className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={inputStyle} />
            </div>
            <button type="button" onClick={() => pickDate(todayISO())} className="px-3 rounded-lg text-xs shrink-0" style={smallButton}>Today</button>
          </div>
          {!fullDate && draft.dateTime && <p className="text-[11px] mt-1" style={{ color: T.muted, ...fontBody }}>Currently saved as “{draft.dateTime}” (month only). Pick a day to set an exact date.</p>}
        </Half>
        <Half>
          <LabeledInput label="Display date" hint="Shown on the card and article. Edit the wording if you like (e.g. “September 2026”)." value={draft.date} onChange={date => set("date", date)} />
        </Half>
        <Full><ContentField name="title" label={LABELS.title} value={draft.title} samples={samples} onChange={onTitleChange} /></Full>
        <Full>{field("description")}</Full>
      </Section>

      <Section title="Source & media">
        <Half>{field("source")}</Half>
        <Half>{field("initials")}</Half>
        <Full>{field("href")}</Full>
        <Half>{field("image")}</Half>
        <Half>{field("logo")}</Half>
      </Section>

      <Section title="Article">
        {article ? (<>
          {ARTICLE_KEYS.map(key => <Full key={key}>{articleField(key)}</Full>)}
          {extraArticleKeys.map(key => <Full key={key}>{articleField(key)}</Full>)}
        </>) : (
          <Full>
            <p className="text-sm mb-3" style={{ color: T.muted, ...fontBody }}>This item has no article page text yet.</p>
            <button type="button" onClick={() => set("article", { intro: "", heading: "", body: "", takeaway: "", points: [], outlook: "" })} className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5" style={smallButton}><Plus size={13} /> Add article text</button>
          </Full>
        )}
      </Section>

      {extraKeys.length > 0 && (
        <Section title="Other fields">
          {extraKeys.map(key => <Full key={key}>{field(key)}</Full>)}
        </Section>
      )}
    </div>
  );
}
