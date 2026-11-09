
create policy "Admin manages media" on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'media' and public.has_role(auth.uid(), 'admin'));
create policy "Admin manages premium files" on storage.objects for all to authenticated
  using (bucket_id = 'premium' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'premium' and public.has_role(auth.uid(), 'admin'));
create policy "Premium users read premium files" on storage.objects for select to authenticated
  using (bucket_id = 'premium' and public.is_premium(auth.uid()));
