-- Fix P2: Ensure recovered owners (new auth.uid()) can read private memorial photos
-- stored under their previous auth.uid() folder via memorials.owner_uuid.
drop policy if exists "memorial_photos_authorized_read" on storage.objects;
create policy "memorial_photos_authorized_read"
  on storage.objects for select
  to public
  using (
    bucket_id = 'memorial-photos'
    and (
      (select auth.uid())::text = (storage.foldername(name))[1]
      or exists (
        select 1 from public.memorials m
        where m.id = (storage.foldername(name))[2]
          and m.deleted_at is null
          and (
            m.owner_uuid = (select auth.uid())
            or m.privacy = 'publico'
            or (
              m.privacy = 'invitados'
              and exists (
                select 1 from public.memorial_invite_grants g
                where g.memorial_id = m.id
                  and g.grantee_uuid = (select auth.uid())
              )
            )
          )
      )
    )
  );
