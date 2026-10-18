// Random tokens for newsletter links. Only SHA-256 hashes are stored, so a
// database leak can't be used to confirm or unsubscribe anyone.

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let binary = "";
  for (const b of buf) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export const isToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(value);
