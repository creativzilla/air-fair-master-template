// Invitations only land on the dashboard at an explicitly trusted origin.
// Keep this independent of CORS: allowing browser requests is not permission
// to deliver authentication tokens to that origin.
export function invitationRedirect(requested: unknown, siteUrl: string, extraOrigins = ""): string {
  const site = new URL(siteUrl);
  const safeOrigin = (url: URL) => !url.username && !url.password &&
    (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  if (!safeOrigin(site)) throw new Error("Invalid authentication site URL");
  const allowed = new Set([site.origin]);
  for (const value of extraOrigins.split(",").map(v => v.trim()).filter(Boolean)) {
    const url = new URL(value);
    if (!safeOrigin(url) || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid authentication redirect origin");
    allowed.add(url.origin);
  }
  if (requested === undefined || requested === null || requested === "") return `${site.origin}/dashboard`;
  if (typeof requested !== "string") throw new Error("Invalid invitation redirect");
  const url = new URL(requested);
  if (!safeOrigin(url) || !allowed.has(url.origin) || url.pathname !== "/dashboard" || url.search || url.hash) {
    throw new Error("Invitation redirect is not allowed");
  }
  return `${url.origin}/dashboard`;
}
