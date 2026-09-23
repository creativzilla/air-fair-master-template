import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Mail } from "lucide-react";
import { TopBars, Footer, ChatWidget, fallbackSettings } from "./Website.jsx";
import { StoryCard } from "./NewsPage.jsx";
import { allArticles } from "../lib/news.js";
import { articleContent } from "../lib/newsArticleContent.js";
import { fetchSiteSettings } from "../lib/content.js";
import "./NewsArticlePage.css";

export default function NewsArticlePage() {
  const { slug } = useParams();
  const story = allArticles.find(item => item.slug === slug);
  const content = articleContent[slug];
  const [settings, setSettings] = useState(fallbackSettings);
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => { let active = true; fetchSiteSettings().then(value => { if (active && value) setSettings({ ...fallbackSettings, ...value }); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { document.title = `${story?.title || "Article not found"} | Air Fair`; window.scrollTo(0, 0); setCopyStatus(""); }, [slug, story]);
  async function copyLink() { try { await navigator.clipboard.writeText(window.location.href); setCopyStatus("Link copied"); } catch { setCopyStatus("Copy the address from your browser to share this story."); } }
  if (!story || !content) return <div className="travel-site"><TopBars settings={settings} /><main className="section-shell news-article-missing"><h1>Article not found</h1><a href="/news">Back to news and current events</a></main><Footer settings={settings} /></div>;
  return <div className="travel-site"><TopBars settings={settings} /><main className="section-shell news-article-page">
    <nav className="news-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/news">News &amp; Current Events</a><span>/</span><span aria-current="page">{story.title}</span></nav>
    <div className="news-article-layout"><article className="news-article-body">
      <header><h1>{story.title}</h1><p className="news-article-deck">{story.description}</p>{story.date && <time dateTime={story.dateTime}>{story.date}</time>}</header>
      <figure><img src={story.image} alt="" width="900" height="580" /><figcaption>Illustrative destination imagery from the Air Fair journal.</figcaption></figure>
      <p>{content.intro}</p>
      <section id="overview"><h2>{content.heading}</h2><p>{content.body}</p></section>
      <section id="travelers"><h2>What this means for travelers</h2><p>{content.takeaway}</p></section>
      <section id="takeaways"><h2>Key takeaways</h2><ul>{content.points.map(point => <li key={point}><CheckCircle2 size={17} aria-hidden="true" />{point}</li>)}</ul></section>
      <section id="ahead"><h2>Looking ahead</h2><p>{content.outlook}</p></section>
      <div className="news-article-end"><div><h3>Source &amp; further reading</h3><p>{story.source}</p><a href={story.href} target="_blank" rel="noopener noreferrer">Visit source website <ArrowRight size={14} /></a></div><div><h3>Share this article</h3><div className="news-share"><button type="button" onClick={copyLink}><Copy size={15} /> Copy link</button><a href={`mailto:?subject=${encodeURIComponent(story.title)}&body=${encodeURIComponent(window.location.href)}`}><Mail size={15} /> Email</a></div><p role="status">{copyStatus}</p><a href="/news"><ArrowLeft size={14} /> Back to all news</a></div></div>
    </article><aside className="news-article-sidebar"><nav aria-label="In this article"><h2>In this article</h2><a href="#overview">{content.heading}</a><a href="#travelers">What this means for travelers</a><a href="#takeaways">Key takeaways</a><a href="#ahead">Looking ahead</a><hr /><h2>Explore more</h2><a href="/news">News &amp; Events <ArrowRight size={14} /></a><a href="/travel-tours">Travel packages <ArrowRight size={14} /></a><a href="/visa-assistance/international-tourist-visa">Visa assistance <ArrowRight size={14} /></a></nav><div className="news-article-help"><img src="/airfair_logo_colored.png" alt="Air Fair" /><h2>Plan your next journey</h2><p>Get guidance on travel, visa assistance, and your next adventure.</p><a href="/#contact">Book a consultation <ArrowRight size={15} /></a></div></aside></div>
    <section className="news-article-related"><div><h2>More stories you may like</h2><a href="/news">View all news <ArrowRight size={15} /></a></div><div className="news-latest-grid">{allArticles.filter(item => item.slug !== slug).slice(0, 4).map(item => <StoryCard key={item.slug} story={item} />)}</div></section>
  </main><Footer settings={settings} /><ChatWidget code={settings.chat_widget_code} /></div>;
}
