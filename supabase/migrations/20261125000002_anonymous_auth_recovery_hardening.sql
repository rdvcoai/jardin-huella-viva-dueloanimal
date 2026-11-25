-- JHV-PUBLIC-LAUNCH-003 (F2 & F3):
-- Anonymous Auth, Cryptographic Recovery Key Verifier, Private Storage,
-- Conditioned Contributions RLS, Revocable/Limited Invites, No Base64 in JSONB.

-- 1. Cryptographic recovery credentials (ONLY salted verifier hash stored, never plaintext)
create table if not exists public.user_recovery_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key_id text not null unique,
  verifier_hash text not null,
  salt text not null,
  key_hint text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  rotated_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_recovery_credentials enable row level security;

create policy "recovery_owner_select_hint"
  on public.user_recovery_credentials for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 2. Revocable, limited invitations table
create table if not exists public.memorial_invites (
  id uuid primary key default gen_random_uuid(),
  memorial_id text not null references public.memorials(id) on delete cascade,
  owner_uuid uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  max_uses int not null default 25 check (max_uses between 1 and 500),
  use_count int not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_memorial_invites_hash
  on public.memorial_invites (code_hash)
  where revoked_at is null;

alter table public.memorial_invites enable row level security;

create policy "invites_owner_all"
  on public.memorial_invites for all
  to authenticated
  using ((select auth.uid()) = owner_uuid)
  with check ((select auth.uid()) = owner_uuid);

-- 3. Reject Base64 data:image/ inside PostgreSQL JSONB (F3)
alter table public.memorials
  drop constraint if exists chk_memorials_no_base64_images;
alter table public.memorials
  add constraint chk_memorials_no_base64_images
  check (data::text !~ 'data:image/');

alter table public.memory_books
  drop constraint if exists chk_books_no_base64_images;
alter table public.memory_books
  add constraint chk_books_no_base64_images
  check (data::text !~ 'data:image/');

-- 4. Condition family_contributions SELECT RLS on parent memorial privacy (F3)
drop policy if exists "contributions_select_approved_or_owner" on public.family_contributions;
create policy "contributions_select_approved_or_owner"
  on public.family_contributions for select
  using (
    exists (
      select 1 from public.memorials m
      where m.id = family_contributions.memorial_id
        and m.deleted_at is null
        and (
          m.owner_uuid = (select auth.uid())
          or (
            family_contributions.status = 'aprobado'
            and (
              m.privacy = 'publico'
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
    )
  );

-- 5. Update redeem_memorial_invite to enforce revocable, limited invites
create or replace function public.redeem_memorial_invite(p_code text)
returns table (memorial_id text, data jsonb)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_uid uuid;
  v_invite record;
begin
  if p_code is null or char_length(trim(p_code)) < 4 then
    return;
  end if;

  v_hash := encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex');
  v_uid := auth.uid();

  -- Prefer explicit revocable invite row if present
  select i.* into v_invite
  from public.memorial_invites i
  join public.memorials m on m.id = i.memorial_id
  where i.code_hash = v_hash
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
    and i.use_count < i.max_uses
    and m.privacy = 'invitados'
    and m.deleted_at is null
  limit 1;

  if v_invite.id is not null then
    update public.memorial_invites
      set use_count = use_count + 1
      where id = v_invite.id;

    if v_uid is not null then
      insert into public.memorial_invite_grants (memorial_id, grantee_uuid)
      values (v_invite.memorial_id, v_uid)
      on conflict do nothing;
    end if;

    return query
    select m.id, m.data
    from public.memorials m
    where m.id = v_invite.memorial_id;
    return;
  end if;

  -- Fallback for legacy invite_code_hash on memorials
  if v_uid is not null then
    insert into public.memorial_invite_grants (memorial_id, grantee_uuid)
    select m.id, v_uid
    from public.memorials m
    where m.invite_code_hash = v_hash
      and m.privacy = 'invitados'
      and m.deleted_at is null
    on conflict do nothing;
  end if;

  return query
  select m.id, m.data
  from public.memorials m
  where m.invite_code_hash = v_hash
    and m.privacy = 'invitados'
    and m.deleted_at is null;
end;
$$;

-- 6. Revoke invite RPC (revokes invite & clears existing grants for that memorial)
create or replace function public.revoke_memorial_invites(p_memorial_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.memorial_invites
    set revoked_at = now()
    where memorial_id = p_memorial_id
      and owner_uuid = auth.uid()
      and revoked_at is null;

  update public.memorials
    set invite_code_hash = null,
        updated_at = now()
    where id = p_memorial_id
      and owner_uuid = auth.uid();

  delete from public.memorial_invite_grants
    where memorial_id = p_memorial_id
      and exists (
        select 1 from public.memorials m
        where m.id = p_memorial_id and m.owner_uuid = auth.uid()
      );
end;
$$;

grant execute on function public.revoke_memorial_invites(text) to authenticated;

-- 7. Private Storage bucket + privacy-conditioned SELECT policy (F3)
update storage.buckets
set public = false
where id = 'memorial-photos';

drop policy if exists "memorial_photos_public_read" on storage.objects;
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
            m.privacy = 'publico'
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
