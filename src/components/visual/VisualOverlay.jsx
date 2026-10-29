// Runs only inside the dashboard's visual editor (?visual=1 in an iframe).
// Outlines the section under the pointer, reports clicks to the dashboard
// instead of following links, shows the section being edited, and applies the
// unsaved drafts the dashboard sends.
import React, { useEffect, useState } from "react";
import { applyVisualDraft, useCms } from "../../lib/cms.js";
import { VE, fromEditor, postToEditor } from "../../lib/visualMode.js";

const idOf = el => (el ? `${el.dataset.veDoc}|${el.dataset.veK}` : null);
const findSection = (doc, k) => document.querySelector(`[data-ve-doc="${CSS.escape(doc || "")}"][data-ve-k="${CSS.escape(k || "")}"]`);
const humanize = k => String(k || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());

// A display:contents wrapper has no box of its own: use its children's.
function boxOf(el) {
  if (!el) return null;
  const parts = getComputedStyle(el).display === "contents" ? [...el.children] : [el];
  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  for (const part of parts) {
    const r = part.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    top = Math.min(top, r.top); left = Math.min(left, r.left); right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
  }
  return top === Infinity ? null : { top, left, width: right - left, height: bottom - top };
}

function Box({ box, label, solid }) {
  if (!box) return null;
  const color = "#4B9B13";
  return (
    <div style={{ position: "fixed", top: box.top, left: box.left, width: box.width, height: box.height, pointerEvents: "none", zIndex: 2147483646,
      outline: `2px ${solid ? "solid" : "dashed"} ${color}`, outlineOffset: -2, background: solid ? "rgba(75,155,19,.06)" : "rgba(75,155,19,.04)" }}>
      <span style={{ position: "absolute", top: Math.max(0, -box.top) + 6, left: 6, background: color, color: "#fff", font: "600 12px/1 system-ui, sans-serif",
        padding: "6px 9px", borderRadius: 6, boxShadow: "0 2px 8px rgba(0,0,0,.2)", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

export default function VisualOverlay() {
  const { source, status } = useCms();
  const [hoverEl, setHoverEl] = useState(null);
  const [selected, setSelected] = useState(null);
  const [labels, setLabels] = useState({});
  const [, setTick] = useState(0);

  // (Re)announce whenever the content store reloads, so the dashboard resends
  // unsaved drafts on top of what was just loaded.
  useEffect(() => { postToEditor({ type: VE.ready, path: window.location.pathname }); }, [source, status]);

  useEffect(() => {
    const sectionAt = node => node?.closest?.("[data-ve-k]") || null;
    const onMove = e => setHoverEl(sectionAt(e.target) || document.querySelector("main"));
    const onLeave = () => setHoverEl(null);
    const onClick = e => {
      e.preventDefault();
      e.stopPropagation();
      const el = sectionAt(e.target);
      postToEditor({ type: VE.select, doc: el?.dataset.veDoc || null, k: el?.dataset.veK || null });
    };
    const block = e => e.preventDefault();
    const onMessage = e => {
      if (!fromEditor(e)) return;
      const m = e.data || {};
      if (m.type === VE.draft && m.kind && m.slug && m.content) applyVisualDraft(m.kind, m.slug, m.content);
      if (m.type === VE.highlight) setSelected(m.doc || m.k ? { doc: m.doc, k: m.k } : null);
      if (m.type === VE.labels) setLabels(m.labels || {});
      if (m.type === VE.scrollTo) {
        const el = findSection(m.doc, m.k);
        const first = el && [...el.children].find(c => c.getBoundingClientRect().height > 0);
        first?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    const tick = () => setTick(n => n + 1);
    document.addEventListener("mousemove", onMove, true);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", block, true);
    window.addEventListener("message", onMessage);
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    const timer = setInterval(tick, 500); // content can change size (images, live drafts)
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", block, true);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("scroll", tick, true);
      window.removeEventListener("resize", tick);
      clearInterval(timer);
    };
  }, []);

  const label = el => (el?.dataset?.veK ? labels[idOf(el)] || humanize(el.dataset.veK) : "Edit this page");
  const selectedEl = selected && findSection(selected.doc, selected.k);
  const hoverIsSelected = hoverEl && selectedEl && hoverEl === selectedEl;
  return <>
    {selectedEl && <Box box={boxOf(selectedEl)} label={`Editing: ${label(selectedEl)}`} solid />}
    {hoverEl && !hoverIsSelected && <Box box={boxOf(hoverEl)} label={`${label(hoverEl)} · click to edit`} />}
  </>;
}
