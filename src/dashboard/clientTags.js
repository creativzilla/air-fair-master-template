// Client tags: data helpers shared by the Clients page and the client drawer.
import { supabase } from "../lib/supabase.js";

export { TAG_COLORS, tagColor, filterByTags, tagCounts, tagDiff } from "./clientTagFilters.js";
import { tagDiff } from "./clientTagFilters.js";

export async function loadClientTags() {
  const [tags, links] = await Promise.all([
    supabase.from("client_tags").select("*").order("sort_order").order("name"),
    supabase.from("contact_tags").select("contact_id,tag_id"),
  ]);
  if (tags.error) throw tags.error;
  if (links.error) throw links.error;
  const byContact = {};
  for (const l of links.data) (byContact[l.contact_id] ||= []).push(l.tag_id);
  return { tags: tags.data, contactTags: byContact };
}

// Save one client's tags (only the changes).
export async function saveContactTags(contactId, before, after) {
  const { add, remove } = tagDiff(before, after);
  if (add.length) {
    const { error } = await supabase.from("contact_tags").upsert(add.map(tag_id => ({ contact_id: contactId, tag_id })), { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  if (remove.length) {
    const { error } = await supabase.from("contact_tags").delete().eq("contact_id", contactId).in("tag_id", remove);
    if (error) throw error;
  }
}

// Add or remove one tag on many clients at once.
export async function bulkTag(contactIds, tagId, add) {
  if (!contactIds.length) return;
  const { error } = add
    ? await supabase.from("contact_tags").upsert(contactIds.map(contact_id => ({ contact_id, tag_id: tagId })), { onConflict: "contact_id,tag_id", ignoreDuplicates: true })
    : await supabase.from("contact_tags").delete().eq("tag_id", tagId).in("contact_id", contactIds);
  if (error) throw error;
}

export async function createTag(name, color = "gray") {
  const { data, error } = await supabase.from("client_tags").insert({ name: name.trim(), color, sort_order: 1000 }).select().single();
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? `A tag named "${name.trim()}" already exists.` : error.message);
  return data;
}

// Archive or restore clients (kept in the database, hidden from active lists).
export async function setArchived(contactIds, archived) {
  if (!contactIds.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("contacts")
    .update({ archived_at: archived ? new Date().toISOString() : null, archived_by: archived ? user?.id ?? null : null })
    .in("id", contactIds);
  if (error) throw error;
}

// Delete clients one by one so a client that can't be deleted (e.g. still has
// documents) doesn't block the rest. Returns the ids that failed, with reasons.
export async function deleteContacts(contactIds) {
  const failed = [];
  for (const id of contactIds) {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) failed.push({ id, reason: error.code === "23503" ? "has documents or other linked records" : /row-level|permission/i.test(error.message) ? "only admins can delete" : error.message });
  }
  return failed;
}
