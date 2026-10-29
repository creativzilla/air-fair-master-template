// Marks one editable section for the dashboard's visual editor. Outside the
// visual editor it renders its children unchanged (no extra element).
// doc: "page:<slug>" or "global:site"; k: the section key.
import React from "react";
import { isVisualMode } from "../../lib/visualMode.js";

export default function VeSection({ doc, k, children }) {
  if (!children) return null;
  if (!isVisualMode()) return children;
  return <div data-ve-doc={doc} data-ve-k={k} style={{ display: "contents" }}>{children}</div>;
}

// The `show(key, Section)` helper pages use, with the visual-editor tag.
export function sectionRenderer(page, slug) {
  return (key, Section, extra = {}) => page.visible(key) && <VeSection doc={`page:${slug}`} k={key}><Section fields={page.section(key)} {...extra} /></VeSection>;
}
