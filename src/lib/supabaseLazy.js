// The full Supabase client (auth, storage, realtime) is the largest library in
// the app. Public pages only need it to submit forms, look up uploaded posters
// or preview drafts, so it is loaded on first use instead of up front.
let clientPromise;
export const getSupabase = () => (clientPromise ||= import("./supabase.js").then(module => module.supabase));

// Read-only anonymous query against the REST API, for published content that
// every visitor needs on first paint. `query` is a PostgREST query string.
export async function restSelect(table, query) {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`Could not load ${table} (${response.status})`);
  return response.json();
}
