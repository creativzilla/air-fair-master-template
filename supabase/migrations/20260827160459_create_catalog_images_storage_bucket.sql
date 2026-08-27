/*
# Create public storage bucket for catalog images

1. New Storage Bucket
   - `catalog-images` — public bucket for product/service featured images
     and gallery images uploaded from the dashboard.
   - 5MB file size limit.
   - Allowed MIME types: jpeg, png, webp, gif.

2. Security
   - Public read (anyone can view images via public URL).
   - Authenticated users can upload and delete images (dashboard requires sign-in).
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-images',
  'catalog-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "catalog_images_public_read" ON storage.objects;
CREATE POLICY "catalog_images_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'catalog-images');

DROP POLICY IF EXISTS "catalog_images_authed_insert" ON storage.objects;
CREATE POLICY "catalog_images_authed_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'catalog-images');

DROP POLICY IF EXISTS "catalog_images_authed_update" ON storage.objects;
CREATE POLICY "catalog_images_authed_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'catalog-images')
  WITH CHECK (bucket_id = 'catalog-images');

DROP POLICY IF EXISTS "catalog_images_authed_delete" ON storage.objects;
CREATE POLICY "catalog_images_authed_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'catalog-images');
