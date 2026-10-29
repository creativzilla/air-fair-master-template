// Visual editor: the dashboard (Pages → Visual editor) shows the real website
// in an iframe at ?preview=1&visual=1. In that mode each editable section is
// tagged, hover/click picks a section, and unsaved edits stream in from the
// dashboard. Nothing changes for normal visitors.
export const VE = {
  ready: "af-ve:ready",       // site → dashboard: loaded (or content reloaded); send drafts
  select: "af-ve:select",     // site → dashboard: { doc, k } clicked (doc null = the page itself)
  draft: "af-ve:draft",       // dashboard → site: { kind, slug, content } unsaved draft to show
  highlight: "af-ve:highlight", // dashboard → site: { doc, k } currently edited section
  scrollTo: "af-ve:scroll",   // dashboard → site: { doc, k } bring a section into view
  labels: "af-ve:labels",     // dashboard → site: { "page:home|hero": "Hero", ... }
};

let visual;
export function isVisualMode() {
  if (visual !== undefined) return visual;
  if (typeof window === "undefined") return (visual = false);
  try {
    visual = window.parent !== window && new URLSearchParams(window.location.search).get("visual") === "1";
  } catch {
    visual = false;
  }
  return visual;
}

// Same-origin messaging only, in both directions.
export function postToEditor(message) {
  try { window.parent.postMessage(message, window.location.origin); } catch { /* parent gone */ }
}
export const fromEditor = event => event.origin === window.location.origin && event.source === window.parent;
