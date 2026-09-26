import { ArrowRight } from "lucide-react";
import "./NewsEvents.css";

import { useNews } from "../lib/cms.js";

export default function NewsEvents({ fields = {} }) {
  const { stories } = useNews();
  return (
    <section id="news" className="af-news" aria-labelledby="af-news-title">
      <div className="section-shell">
        <header className="af-news-heading">
          <div className="section-title">

            <h2 id="af-news-title">{fields.heading}</h2>
            <p>{fields.body}</p>
          </div>
          <a className="af-news-read" href={fields.viewAll?.href}>{fields.viewAll?.label} <ArrowRight size={16} aria-hidden="true" /></a>
        </header>
        <div className="af-news-grid">
          {stories.map(story => (
            <article key={story.href} className="af-news-card">
              <a href={`/news/${story.slug}`} className="af-news-link" aria-label={story.title}>
                <div className="af-news-cover"><img src={story.image} alt="" loading="lazy" width="900" height="490" /></div>
                <div className="af-news-content">
                  <span className="af-news-category">{story.category}</span>
                  <h3>{story.title}</h3>
                  <p>{story.description}</p>
                  <span className="af-news-read">{fields.cardCtaLabel} <ArrowRight size={14} aria-hidden="true" /></span>
                </div>
              </a>
            </article>
          ))}
        </div>
        <p className="af-news-note">{fields.note}</p>
      </div>
    </section>
  );
}
