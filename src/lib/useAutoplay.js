import { useEffect, useState } from "react";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// True while a slideshow may advance on its own: its element is on screen,
// the tab is visible and the visitor hasn't asked for reduced motion.
// Keeps timers (and the image downloads they trigger) from running for
// content nobody can see.
export function useAutoplay(ref) {
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(REDUCE_MOTION).matches);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    const query = window.matchMedia?.(REDUCE_MOTION);
    const onMotion = () => setReducedMotion(query.matches);
    query?.addEventListener?.("change", onMotion);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      query?.removeEventListener?.("change", onMotion);
    };
  }, []);

  return inView && tabVisible && !reducedMotion;
}
