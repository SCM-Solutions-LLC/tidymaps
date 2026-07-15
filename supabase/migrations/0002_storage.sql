-- Private bucket for user media; per-user folder isolation via first path segment
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('space-media', 'space-media', false, 5242880,
        array['image/jpeg','image/png','image/webp']);

create policy "own folder select" on storage.objects for select to authenticated
  using (bucket_id = 'space-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'space-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'space-media' and (storage.foldername(name))[1] = auth.uid()::text);
