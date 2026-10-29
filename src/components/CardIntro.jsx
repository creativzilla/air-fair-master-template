// The homepage service card that links to this page, shown in full at the top
// of the page it opens. Its title and text are edited once, in
// Pages → Home → Service categories, so the card and this intro always match.
import React from "react";
import { usePage } from "../lib/cms.js";
import { getIcon } from "./immigration/icons.js";

const pathOf = href => String(href || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";

export default function CardIntro({ path }) {
  const home = usePage("home");
  const items = home.section("categories").items || [];
  const card = items.find(item => pathOf(item.href) === pathOf(path));
  if (!card || !(card.title || card.description)) return null;
  const Icon = getIcon(card.icon);
  return (
    <section className={`card-intro card-intro--${card.theme || "green"}`} aria-label={card.title}>
      <div className="section-shell card-intro-inner">
        <div className="card-intro-icon"><Icon size={26} strokeWidth={1.8} /></div>
        <div>
          {card.title && <h2>{card.title}</h2>}
          {card.description && <p>{card.description}</p>}
        </div>
      </div>
    </section>
  );
}
