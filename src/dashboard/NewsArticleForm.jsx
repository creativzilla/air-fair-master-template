// Layout for the News article editor: the same fields and values as the
// generic content editor, arranged into titled sections with short related
// fields side by side (one column on phones).
import React from "react";
import { T, fontBody, LabeledInput, Panel } from "./ui.jsx";
import { ContentField } from "./ContentEditor.jsx";

const TOP_LEVEL_KEYS = ["category", "type", "date", "dateTime", "title", "description", "source", "initials", "href", "image", "logo", "article"];
const ARTICLE_KEYS = ["intro", "heading", "body", "takeaway", "points", "outlook"];
const HIDDEN_KEYS = new Set(["slug", "formKey", "_doc", "seo"]);

const LABELS = {
  type: "Where it appears", date: "Display date", dateTime: "Date (YYYY-MM-DD)", title: "Title", description: "Description",
  category: "Category", source: "Source name", initials: "Source initials", href: "Source link", image: "Image", logo: "Logo",
  intro: "Intro", heading: "Heading", body: "Body", takeaway: "Takeaway", points: "Key points", outlook: "Outlook",
};

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

export default function NewsArticleForm({ draft, setDraft, meta, setMeta, slugInput, samples }) {
  const set = (key, value) => setDraft({ ...draft, [key]: value });
  const isImageKey = key => key === "image" || key === "logo";
  const field = key => <ContentField name={key} label={LABELS[key]} value={isImageKey(key) ? draft[key] ?? null : draft[key]} samples={samples} onChange={value => set(key, value)} />;

  const article = draft.article;
  const setArticle = (key, value) => setDraft({ ...draft, article: { ...(article || {}), [key]: value } });
  const articleField = key => <ContentField name={key} label={LABELS[key]} value={article?.[key]} samples={samples} path={["article", key]} onChange={value => setArticle(key, value)} />;
  const extraArticleKeys = article ? Object.keys(article).filter(k => !ARTICLE_KEYS.includes(k)) : [];
  const extraKeys = Object.keys(draft).filter(k => !TOP_LEVEL_KEYS.includes(k) && !HIDDEN_KEYS.has(k));

  return (
    <div className="flex flex-col gap-6">
      <Section title="Basic details">
        <Half><LabeledInput label="Name in dashboard lists" value={meta.title} onChange={title => setMeta({ ...meta, title })} /></Half>
        <Half>{slugInput}</Half>
        <Half>{field("category")}</Half>
        <Half><LabeledInput label="Order in lists" type="number" value={meta.sort_order} onChange={sort_order => setMeta({ ...meta, sort_order })} /></Half>
      </Section>

      <Section title="Content">
        <Full>{field("type")}</Full>
        <Half>{field("date")}</Half>
        <Half>{field("dateTime")}</Half>
        <Full>{field("title")}</Full>
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
            <button type="button" onClick={() => set("article", { intro: "", heading: "", body: "", takeaway: "", points: [], outlook: "" })} className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}>Add article text</button>
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
