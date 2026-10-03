import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { TopBars, Footer, ChatWidget, colors, fallbackSettings, useSeo } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";

// Shown for any address that doesn't exist (also prerendered to dist/404.html,
// which the host serves with a 404 status). Kept out of search results.
const LINKS = [
  { href: "/philippine-immigration-services", label: "Philippine Immigration Services" },
  { href: "/visa-assistance/international-tourist-visa", label: "International Tourist Visa" },
  { href: "/travel-tours", label: "Travel & Tours Packages" },
  { href: "/news", label: "News & Current Events" },
];

export default function NotFoundPage() {
  const [settings, setSettings] = useState(fallbackSettings);
  useEffect(() => {
    let active = true;
    fetchSiteSettings().then(value => { if (active && value) setSettings({ ...fallbackSettings, ...value }); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useSeo({ title: "Page not found | {businessName}", description: "The page you are looking for doesn't exist or has moved.", noindex: true }, settings);

  return (
    <div className="travel-site">
      <TopBars settings={settings} />
      <main id="main-content" className="section-shell" style={{ padding: "96px 24px 110px", textAlign: "center" }}>
        <p style={{ color: colors.green, fontWeight: 700, letterSpacing: ".08em", fontSize: 13, margin: "0 0 10px" }}>ERROR 404</p>
        <h1 style={{ color: colors.ink, fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, lineHeight: 1.2, margin: "0 0 14px" }}>Page not found</h1>
        <p style={{ color: colors.text, fontSize: 16, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 28px" }}>
          Sorry, we couldn't find that page. It may have moved, or the link may be out of date.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
          <a className="green-button" href="/">Back to home <ArrowRight size={15} /></a>
          <a className="outline-green-button" href="/#contact">Contact us</a>
        </div>
        <nav aria-label="Popular pages">
          <h2 style={{ color: colors.ink, fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Popular pages</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", gap: "10px 24px", justifyContent: "center", flexWrap: "wrap" }}>
            {LINKS.map(link => <li key={link.href}><a href={link.href} style={{ color: colors.greenDark, fontWeight: 600, fontSize: 15 }}>{link.label}</a></li>)}
          </ul>
        </nav>
      </main>
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
