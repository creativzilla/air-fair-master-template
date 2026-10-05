-- Only the bounded form-upload broker (service role) may store public uploads.
-- Restrictive policies also defeat any surviving legacy permissive policies.
create policy form_upload_broker_insert on storage.objects as restrictive
  for insert to anon, authenticated with check (bucket_id <> 'form-attachments');
create policy form_upload_broker_update on storage.objects as restrictive
  for update to anon, authenticated using (bucket_id <> 'form-attachments')
  with check (bucket_id <> 'form-attachments');

update storage.buckets set public=false, file_size_limit=10485760,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp','image/heic',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  where id='form-attachments';
