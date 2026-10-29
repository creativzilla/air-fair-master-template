import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Mail } from "lucide-react";
import { TopBars, Footer, ChatWidget, PageLoading, fallbackSettings, useSeo } from "./Website.jsx";
import { StoryCard } from "./NewsPage.jsx";
import { useGlobalContent, useLabels, useNews, usePage } from "../lib/cms.js";
import { imageSrc } from "../lib/cmsAdapters.js";
import { optimizedSrc } from "../lib/optimizedImages.js";
import { absoluteUrl } from "../lib/seo.js";
import { fetchSiteSettings } from "../lib/content.js";
import "./NewsArticlePage.css";

export default function NewsArticlePage() {
  const { slug } = useParams();
  const { allArticles, articleContent, ready } = useNews();
  const labels = useLabels();
  const logo = useGlobalContent().logo || {};
  const t = usePage("news").section("article");
  const story = allArticles.find(item => item.slug === slug);
  const content = articleContent[slug];
  const [settings, setSettings] = useState(fallbackSettings);
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => { let active = true; fetchSiteSettings().then(value => { if (active && value) setSettings({ ...fallbackSettings, ...value }); }).catch(() => {}); return () => { active = false; }; }, []);
  useSeo({ title: `${story?.title || t.notFound} | Air Fair`, description: story?.description, image: story?.image, type: story ? "article" : undefined }, settings);
  useEffect(() => { window.scrollTo(0, 0); setCopyStatus(""); }, [slug]);
  // Prerendering has no window; use the page's public address there.
  const pageUrl = typeof window !== "undefined" ? window.location.href : absoluteUrl(`/news/${slug}`);
  async function copyLink() { try { await navigator.clipboard.writeText(window.location.href); setCopyStatus("Link copied"); } catch { setCopyStatus("Copy the address from your browser to share this story."); } }
  if (!story || !content) {
    if (!ready) return <div className="travel-site" aria-busy="true"><TopBars settings={settings} /><main id="main-content"><PageLoading /></main><Footer settings={settings} /></div>;
    return <div className="travel-site"><TopBars settings={settings} /><main id="main-content" className="section-shell news-article-missing"><h1>{t.notFound}</h1><a href="/news">Back to news and current events</a></main><Footer settings={settings} /></div>;
  }
  return <div className="travel-site"><TopBars settings={settings} /><main id="main-content" className="section-shell news-article-page">
    <nav className="news-breadcrumb" aria-label="Breadcrumb"><a href="/">{labels.breadcrumbHome}</a><span>/</span><a href="/news">{labels.breadcrumbNews}</a><span>/</span><span aria-current="page">{story.title}</span></nav>
    <div className="news-article-layout"><article className="news-article-body">
      <header><h1>{story.title}</h1><p className="news-article-deck">{story.description}</p>{story.date && <time dateTime={story.dateTime}>{story.date}</time>}</header>
      <figure><img src={optimizedSrc(story.image)} alt="" width="900" height="580" /><figcaption>{t.figcaption}</figcaption></figure>
      <p>{content.intro}</p>
      <section id="overview"><h2>{content.heading}</h2><p>{content.body}</p></section>
      <section id="travelers"><h2>{t.travelersHeading}</h2><p>{content.takeaway}</p></section>
      <section id="takeaways"><h2>{t.takeawaysHeading}</h2><ul>{(content.points || []).map(point => <li key={point}><CheckCircle2 size={17} aria-hidden="true" />{point}</li>)}</ul></section>
      <section id="ahead"><h2>{t.aheadHeading}</h2><p>{content.outlook}</p></section>
      <div className="news-article-end"><div><h3>{t.sourceHeading}</h3><p>{story.source}</p><a href={story.href} target="_blank" rel="noopener noreferrer">{t.sourceLinkLabel} <ArrowRight size={14} /></a></div><div><h3>{t.shareHeading}</h3><div className="news-share"><button type="button" onClick={copyLink}><Copy size={15} /> Copy link</button><a href={`mailto:?subject=${encodeURIComponent(story.title)}&body=${encodeURIComponent(pageUrl)}`}><Mail size={15} /> Email</a></div><p role="status">{copyStatus}</p><a href="/news"><ArrowLeft size={14} /> {t.backLabel}</a></div></div>
    </article><aside className="news-article-sidebar"><nav aria-label="In this article"><h2>{t.tocHeading}</h2><a href="#overview">{content.heading}</a><a href="#travelers">{t.travelersHeading}</a><a href="#takeaways">{t.takeawaysHeading}</a><a href="#ahead">{t.aheadHeading}</a><hr /><h2>{t.exploreHeading}</h2>{(t.exploreLinks || []).map(item => <a key={item.href} href={item.href}>{item.label} <ArrowRight size={14} /></a>)}</nav><div className="news-article-help"><img src={imageSrc(logo)} alt="Air Fair" /><h2>{t.help?.heading}</h2><p>{t.help?.body}</p><a href={t.help?.cta?.href}>{t.help?.cta?.label} <ArrowRight size={15} /></a></div></aside></div>
    <section className="news-article-related"><div><h2>{t.relatedHeading}</h2><a href="/news">View all news <ArrowRight size={15} /></a></div><div className="news-latest-grid">{allArticles.filter(item => item.slug !== slug).slice(0, 4).map(item => <StoryCard key={item.slug} story={item} />)}</div></section>
  </main><Footer settings={settings} /><ChatWidget code={settings.chat_widget_code} /></div>;
}
