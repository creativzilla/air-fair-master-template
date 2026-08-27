import { supabase } from "./supabase.js";

// ---------------------------------------------------------------------------
// Pages / Sections / Content Blocks
// ---------------------------------------------------------------------------

/**
 * Fetch all published pages with their sections and content blocks,
 * structured as:
 *   [{ id, slug, title, sections: [{ id, template_type, sort_order, blocks: { field_key: value } }] }]
 */
export async function fetchPublishedPages() {
  const { data: pages, error: pErr } = await supabase
    .from("pages")
    .select("id, slug, title, is_published, sort_order")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (pErr || !pages) return [];

  const pageIds = pages.map(p => p.id);
  if (pageIds.length === 0) return [];

  const { data: sections, error: sErr } = await supabase
    .from("sections")
    .select("id, page_id, template_type, sort_order, is_visible")
    .in("page_id", pageIds)
    .order("sort_order", { ascending: true });
  if (sErr || !sections) return pages.map(p => ({ ...p, sections: [] }));

  const sectionIds = sections.map(s => s.id);
  let blocksMap = {};
  if (sectionIds.length > 0) {
    const { data: blocks, error: bErr } = await supabase
      .from("content_blocks")
      .select("id, section_id, field_key, value")
      .in("section_id", sectionIds);
    if (!bErr && blocks) {
      for (const b of blocks) {
        if (!blocksMap[b.section_id]) blocksMap[b.section_id] = {};
        blocksMap[b.section_id][b.field_key] = b.value;
      }
    }
  }

  return pages.map(p => ({
    ...p,
    sections: sections
      .filter(s => s.page_id === p.id && s.is_visible)
      .map(s => ({ ...s, blocks: blocksMap[s.id] || {} })),
  }));
}

/**
 * Fetch all pages (including unpublished) for the dashboard editor,
 * structured the same as fetchPublishedPages but with all fields.
 */
export async function fetchAllPagesForEditor() {
  const { data: pages, error: pErr } = await supabase
    .from("pages")
    .select("id, slug, title, is_published, sort_order")
    .order("sort_order", { ascending: true });
  if (pErr || !pages) return [];

  const pageIds = pages.map(p => p.id);
  if (pageIds.length === 0) return [];

  const { data: sections, error: sErr } = await supabase
    .from("sections")
    .select("id, page_id, template_type, sort_order, is_visible")
    .in("page_id", pageIds)
    .order("sort_order", { ascending: true });
  if (sErr || !sections) return pages.map(p => ({ ...p, sections: [] }));

  const sectionIds = sections.map(s => s.id);
  let blocksMap = {};
  if (sectionIds.length > 0) {
    const { data: blocks, error: bErr } = await supabase
      .from("content_blocks")
      .select("id, section_id, field_key, value")
      .in("section_id", sectionIds);
    if (!bErr && blocks) {
      for (const b of blocks) {
        if (!blocksMap[b.section_id]) blocksMap[b.section_id] = {};
        blocksMap[b.section_id][b.field_key] = b.value;
      }
    }
  }

  return pages.map(p => ({
    ...p,
    sections: sections
      .filter(s => s.page_id === p.id)
      .map(s => ({ ...s, blocks: blocksMap[s.id] || {} })),
  }));
}

/**
 * Save a single content block value (upsert by section_id + field_key).
 */
export async function saveContentBlock(sectionId, fieldKey, value) {
  const { data, error } = await supabase
    .from("content_blocks")
    .upsert({ section_id: sectionId, field_key: fieldKey, value }, { onConflict: "section_id,field_key" })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

export async function fetchPublishedTestimonials() {
  const { data, error } = await supabase
    .from("testimonials")
    .select("id, client_name, quote, service_category, photo_url")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data;
}

// ---------------------------------------------------------------------------
// Site Settings (single row)
// ---------------------------------------------------------------------------

export async function fetchSiteSettings() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function saveSiteSettings(settings) {
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
