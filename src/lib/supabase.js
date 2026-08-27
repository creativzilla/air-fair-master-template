import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function uploadCatalogImage(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
  const filePath = `${fileName}`
  const { error } = await supabase.storage
    .from('catalog-images')
    .upload(filePath, file, { contentType: file.type, upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('catalog-images').getPublicUrl(filePath)
  return data.publicUrl
}
