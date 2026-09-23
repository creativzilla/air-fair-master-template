import { useEffect, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { TopBars, Footer, ChatWidget, fallbackSettings } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { stories, guides } from "../lib/news.js";
import "../components/NewsEvents.css";
import "./NewsPage.css";

const categories = ["All updates", "Travel & Events", "Immigration", "Tourism News"];
const matches = (story, category) => category === "All updates" || story.category === category || (category === "Immigration" && story.category === "Policy Updates");

export function StoryCard({ story }) {
  return <article className="af-news-card"><a className="af-news-link" href={`/news/${story.slug}`} aria-label={story.title}>
    <div className="af-news-cover"><img src={story.image} alt="" width="900" height="580" loading="lazy" /></div>
    <div className="af-news-content"><span className="af-news-category">{story.category}</span><h3>{story.title}</h3><p>{story.description}</p><span className="af-news-read">Learn more <ArrowRight size={14} aria-hidden="true" /></span></div>
  </a></article>;
}

export default function NewsPage() {
  const [category, setCategory] = useState("All updates");
  const [settings, setSettings] = useState(fallbackSettings);
  useEffect(() => {
    document.title = "News & Current Events | Air Fair";
    window.scrollTo(0, 0);
    let active = true;
    fetchSiteSettings().then(value => { if (active && value) setSettings({ ...fallbackSettings, ...value }); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const featured = stories.slice(0, 3).filter(story => matches(story, category));
  const latest = [...guides, stories[3]].filter(story => matches(story, category));
  return <div className="travel-site"><TopBars settings={settings} />
    <main className="news-journal">
      <div className="section-shell">
        <nav className="news-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">News &amp; Current Events</span></nav>
        <header className="news-journal-heading"><h1>Stories worth exploring.</h1><p>Travel, tourism, and immigration updates to help you go further.</p></header>
        <div className="news-filters" role="group" aria-label="Filter stories by category">{categories.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div aria-live="polite" aria-atomic="true" className="news-result-count">{featured.length + latest.length} stories and resources{category !== "All updates" ? ` in ${category}` : ""}</div>
        <section aria-label="Featured stories" className={`news-featured-grid ${category === "All updates" ? "news-featured-all" : ""}`}>{featured.map(story => <StoryCard key={story.href} story={story} />)}</section>
        <section className="news-latest" aria-labelledby="news-latest-title"><h2 id="news-latest-title">More stories &amp; travel resources</h2><div className="news-latest-grid">{latest.map(story => <StoryCard key={story.href} story={story} />)}</div></section>
        <p className="af-news-note">Curated news and travel resources. Read each article for details and source links.</p>
        <section className="news-contact"><Mail size={44} aria-hidden="true" /><div><h2>Stay informed, travel with confidence.</h2><p>Have a question about your next journey? Our team is here to help.</p></div><a href="/#contact">Talk to our team <ArrowRight size={17} aria-hidden="true" /></a></section>
      </div>
    </main>
    <Footer settings={settings} /><ChatWidget code={settings.chat_widget_code} />
  </div>;
}
