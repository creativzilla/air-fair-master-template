// Loaded before the Edge Function: sends Resend traffic to the local sink and
// refuses every other non-local request. (Deno's --allow-net is also limited
// to localhost, so even without this file nothing could leave the machine.)
const realFetch = globalThis.fetch;
const SINK = Deno.env.get("LOCAL_RESEND_SINK")!;
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
  if (url.hostname === "api.resend.com") return realFetch(SINK, init);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    return Promise.reject(new Error(`blocked external request to ${url.hostname}`));
  }
  return realFetch(input, init);
};
