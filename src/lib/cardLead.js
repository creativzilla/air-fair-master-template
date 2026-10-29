// The homepage service card's short text, used as the first sentence of the
// banner text on the page the card opens. Edited once, in Pages → Home →
// Service categories, so the card and that page always match.
import { usePage } from "./cms.js";

const pathOf = href => String(href || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";

export function useCardLead(path, text) {
  const home = usePage("home");
  const card = (home.section("categories").items || []).find(item => pathOf(item.href) === pathOf(path));
  const lead = String(card?.description || "").trim();
  const rest = String(text || "").trim();
  if (!lead || rest.startsWith(lead)) return text;
  return rest ? `${lead} ${rest}` : lead;
}
