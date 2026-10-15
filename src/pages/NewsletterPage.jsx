import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { TopBars, Footer, ChatWidget, colors, fallbackSettings, useSeo } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { campaignUnsubscribe, newsletterLinkAction } from "../lib/formSubmit.js";

// Landing page for the links in the newsletter confirmation email:
//   /newsletter/confirm?token=...      double opt-in confirmation
//   /newsletter/unsubscribe?token=...  unsubscribe
//   /newsletter/unsubscribe?c=...      unsubscribe link in a bulk (campaign) email
// Not indexed; not prerendered.
const COPY = {
  confirm: {
    action: "newsletter_confirm",
    working: "Confirming your subscription...",
    done: { confirmed: "You're subscribed. Thank you for confirming!", already_confirmed: "Your subscription is already confirmed." },
    title: "Newsletter subscription",
  },
  unsubscribe: {
    action: "newsletter_unsubscribe",
    working: "Unsubscribing...",
    done: { unsubscribed: "You've been unsubscribed. You won't receive our marketing emails anymore." },
    title: "Unsubscribe",
  },
};

export default function NewsletterPage() {
  const { mode } = useParams();
  const [params] = useSearchParams();
  const copy = COPY[mode] || null;
  const [settings, setSettings] = useState(fallbackSettings);
  const [state, setState] = useState({ phase: "working", message: "" });
  useSeo({ title: `${copy?.title || "Newsletter"} | {businessName}`, noindex: true }, settings);

  useEffect(() => {
    let active = true;
    fetchSiteSettings().then(value => { if (active && value) setSettings({ ...fallbackSettings, ...value }); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const token = params.get("token"), campaignToken = params.get("c");
    if (!copy || !(token || (mode === "unsubscribe" && campaignToken))) { setState({ phase: "error", message: "This link is not valid." }); return undefined; }
    (token ? newsletterLinkAction(copy.action, token) : campaignUnsubscribe(campaignToken)).then(result => {
      if (!active) return;
      setState(result.ok
        ? { phase: "done", message: copy.done[result.status] || Object.values(copy.done)[0] }
        : { phase: "error", message: result.error });
    });
    return () => { active = false; };
  }, [mode]);

  return (
    <div className="travel-site">
      <TopBars settings={settings} />
      <main id="main-content" className="section-shell" style={{ padding: "96px 24px 110px", textAlign: "center" }}>
        <h1 style={{ color: colors.ink, fontSize: "clamp(26px, 4.5vw, 36px)", fontWeight: 800, lineHeight: 1.2, margin: "0 0 14px" }}>{copy?.title || "Newsletter"}</h1>
        <p role="status" style={{ color: state.phase === "error" ? "#b42318" : colors.text, fontSize: 16, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 28px" }}>
          {state.phase === "working" ? copy?.working : state.message}
        </p>
        <a className="green-button" href="/">Back to home</a>
      </main>
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
