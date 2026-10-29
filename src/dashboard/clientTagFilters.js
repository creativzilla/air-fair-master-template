// Pure client-tag helpers (no Supabase), shared by the UI and tests.
export const TAG_COLORS = {
  gray: { bg: "#EEF0F2", fg: "#5B6670" }, green: { bg: "#EAF6E1", fg: "#3F8A1F" }, blue: { bg: "#E8F0FC", fg: "#2F67B8" },
  amber: { bg: "#FCEEDC", fg: "#A9601A" }, red: { bg: "#FBE7E7", fg: "#B83232" }, purple: { bg: "#F1E9FB", fg: "#7340B0" },
  teal: { bg: "#E2F4F2", fg: "#21786E" }, pink: { bg: "#FCE8F1", fg: "#B0306C" },
};
export const tagColor = color => TAG_COLORS[color] || TAG_COLORS.gray;

// Clients matching the chosen tags: "any" = at least one, "all" = every one.
export function filterByTags(contacts, contactTags, tagIds, mode = "any") {
  if (!tagIds?.length) return contacts;
  return contacts.filter(c => {
    const mine = contactTags[c.id] || [];
    return mode === "all" ? tagIds.every(t => mine.includes(t)) : tagIds.some(t => mine.includes(t));
  });
}

// How many clients carry each tag.
export function tagCounts(contactTags) {
  const counts = {};
  for (const ids of Object.values(contactTags)) for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  return counts;
}

export const tagDiff = (before = [], after = []) => ({ add: after.filter(t => !before.includes(t)), remove: before.filter(t => !after.includes(t)) });

