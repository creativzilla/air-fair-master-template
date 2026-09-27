import { getSupabase, restSelect } from "./supabaseLazy.js";

// ---------------------------------------------------------------------------
// Site Settings (single row)
// ---------------------------------------------------------------------------

export async function fetchSiteSettings() {
  try {
    const rows = await restSelect("site_settings", "select=*&order=updated_at.desc&limit=1");
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function saveSiteSettings(settings) {
  const supabase = await getSupabase();
  // Try to update the first row; if none exists, insert.
  const { data: existing } = await supabase
    .from("site_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("site_settings")
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("site_settings")
    .insert(settings)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
