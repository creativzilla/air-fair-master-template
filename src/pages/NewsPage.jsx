import { useEffect, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { TopBars, Footer, ChatWidget, fallbackSettings, useSeo } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { useLabels, useNews, usePage } from "../lib/cms.js";
import { optimizedSrc } from "../lib/optimizedImages.js";
import "../components/NewsEvents.css";
import "./NewsPage.css";

const matches = (story, category, allLabel) => category === allLabel || story.category === category || (category === "Immigration" && story.category === "Policy Updates");

export function StoryCard({ story, ctaLabel = "Learn more" }) {
  return <article className="af-news-card"><a className="af-news-link" href={`/news/${story.slug}`}>
    <div className="af-news-cover"><img src={optimizedSrc(story.image)} alt="" width="900" height="580" loading="lazy" decoding="async" /></div>
    <div className="af-news-content"><span className="af-news-category">{story.category}</span><h3>{story.title}</h3><p>{story.description}</p><span className="af-news-read">{ctaLabel} <ArrowRight size={14} aria-hidden="true" /></span></div>
  </a></article>;
}

export default function NewsPage() {
  const page = usePage("news");
  const labels = useLabels();
  const { stories, guides } = useNews();
  const categories = page.section("filters").categories || [];
  const allLabel = categories[0] || "All updates";
  const [category, setCategory] = useState(allLabel);
  const [settings, setSettings] = useState(fallbackSettings);
  useSeo(page.seo, settings);
  useEffect(() => {
    window.scrollTo(0, 0);
    let active = true;
    fetchSiteSettings().then(value => { if (active && value) setSettings({ ...fallbackSettings, ...value }); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const hero = page.section("hero");
  const latestSection = page.section("latest");
  const contact = page.section("contact");
  const featured = stories.slice(0, 3).filter(story => matches(story, category, allLabel));
  const latest = [...guides, ...stories.slice(3, 4)].filter(story => matches(story, category, allLabel));
  return <div className="travel-site" aria-busy={page.loading || undefined}><TopBars settings={settings} />
    <main id="main-content" className="news-journal">
      <div className="section-shell">
        <nav className="news-breadcrumb" aria-label="Breadcrumb"><a href="/">{labels.breadcrumbHome}</a><span>/</span><span aria-current="page">{labels.breadcrumbNews}</span></nav>
        {page.visible("hero") && <header className="news-journal-heading"><h1>{hero.heading}</h1><p>{hero.body}</p></header>}
        {page.visible("filters") && <div className="news-filters" role="group" aria-label="Filter stories by category">{categories.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>}
        <div aria-live="polite" aria-atomic="true" className="news-result-count">{featured.length + latest.length} stories and resources{category !== allLabel ? ` in ${category}` : ""}</div>
        <section aria-label="Featured stories" className={`news-featured-grid ${category === allLabel ? "news-featured-all" : ""}`}>{featured.map(story => <StoryCard key={story.href} story={story} />)}</section>
        {page.visible("latest") && <section className="news-latest" aria-labelledby="news-latest-title"><h2 id="news-latest-title">{latestSection.heading}</h2><div className="news-latest-grid">{latest.map(story => <StoryCard key={story.href} story={story} />)}</div></section>}
        {page.visible("latest") && <p className="af-news-note">{latestSection.note}</p>}
        {page.visible("contact") && <section className="news-contact"><Mail size={44} aria-hidden="true" /><div><h2>{contact.heading}</h2><p>{contact.body}</p></div><a href={contact.cta?.href}>{contact.cta?.label} <ArrowRight size={17} aria-hidden="true" /></a></section>}
      </div>
    </main>
    <Footer settings={settings} /><ChatWidget code={settings.chat_widget_code} />
  </div>;
}
