import { supabase } from "./supabase.js";

const bucket = () => supabase.storage.from("catalog-images");
const folder = slug => `travel-package-posters/${slug}`;

export async function fetchTravelPoster(slug) {
  const { data, error } = await bucket().list(folder(slug), { search: "poster", limit: 10 });
  if (error) throw error;
  const file = data?.find(item => item.name === "poster");
  if (!file) return null;
  const { data: url } = bucket().getPublicUrl(`${folder(slug)}/poster`);
  return `${url.publicUrl}?v=${encodeURIComponent(file.updated_at || file.created_at || "1")}`;
}

export async function saveTravelPoster(slug, file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
  const { error } = await bucket().upload(`${folder(slug)}/poster`, file, {
    contentType: file.type, upsert: true, cacheControl: "60",
  });
  if (error) throw error;
  return fetchTravelPoster(slug);
}

export async function removeTravelPoster(slug) {
  const { error } = await bucket().remove([`${folder(slug)}/poster`]);
  if (error) throw error;
}
