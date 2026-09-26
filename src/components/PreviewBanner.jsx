import React from "react";
import { useLocation } from "react-router-dom";
import { useCms } from "../lib/cms.js";

// Only rendered for signed-in editors who opened a page with ?preview=1.
// Public visitors never see it (they can't load drafts).
export default function PreviewBanner() {
  const { source } = useCms();
  const { pathname } = useLocation();
  if (source !== "preview" || pathname.startsWith("/dashboard")) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed", left: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 1000,
        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 999,
        background: "#102B57", color: "#fff", font: "600 13px/1.2 system-ui, sans-serif",
        boxShadow: "0 8px 24px rgba(16, 43, 87, 0.25)",
      }}
    >
      <span>Preview — showing unpublished drafts</span>
      <a href="?preview=0" style={{ color: "#FFCB19", textDecoration: "underline" }}>Exit preview</a>
    </div>
  );
}
