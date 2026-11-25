-- JHV-PUBLIC-BETA-001: Secure Schema, RLS, Storage, Invites & Moderation
-- Versioned migration for Jardín Huella Viva (DueloAnimal.co)

create extension if not exists pgcrypto;

-- 1. Public/shared memorials table (sanitized: NO private letters, NO raw invite codes, NO invited emails)
create table if not exists public.memorials (
  id text primary key,
  owner_uuid uuid not null references auth.users(id) on delete cascade,
  owner_id text not null,
  privacy text not null default 'privado' check (privacy in ('privado', 'invitados', 'publico')),
  invite_code_hash text,
  data jsonb not null,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_memorials_public_active
  on public.memorials (created_at asc)
  where deleted_at is null and is_demo = false;

create index if not exists idx_memorials_owner_uuid
  on public.memorials (owner_uuid)
  where deleted_at is null;

create index if not exists idx_memorials_invite_hash
  on public.memorials (invite_code_hash)
  where invite_code_hash is not null and deleted_at is null;

-- 2. Private memorial data (strictly owner-only: privateLetters, inviteCode, invitedEmails)
create table if not exists public.memorial_private_data (
  memorial_id text primary key references public.memorials(id) on delete cascade,
  owner_uuid uuid not null references auth.users(id) on delete cascade,
  private_letters jsonb not null default '[]'::jsonb,
  invite_code text,
  invited_emails text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- 3. Invite grants (records which authenticated user redeemed an invite code)
create table if not exists public.memorial_invite_grants (
  id uuid primary key default gen_random_uuid(),
  memorial_id text not null references public.memorials(id) on delete cascade,
  grantee_uuid uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  unique (memorial_id, grantee_uuid)
);

-- 4. Private draft memory books (strictly owner-only)
create table if not exists public.memory_books (
  id text primary key,
  owner_uuid uuid not null references auth.users(id) on delete cascade,
  owner_id text not null,
  memorial_id text references public.memorials(id) on delete set null,
  privacy text not null default 'privado' check (privacy in ('privado', 'invitados', 'publico')),
  invite_code_hash text,
  data jsonb not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_memory_books_owner_uuid
  on public.memory_books (owner_uuid)
  where deleted_at is null;

-- 5. Published memory books (public/invited snapshot only, never private drafts)
create table if not exists public.published_memory_books (
  book_id text primary key references public.memory_books(id) on delete cascade,
  owner_uuid uuid not null references auth.users(id) on delete cascade,
  memorial_id text references public.memorials(id) on delete set null,
  privacy text not null check (privacy in ('invitados', 'publico')),
  invite_code_hash text,
  snapshot jsonb not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Family / visitor contributions & moderation queue
create table if not exists public.family_contributions (
  id uuid primary key default gen_random_uuid(),
  memorial_id text not null references public.memorials(id) on delete cascade,
  author text not null check (char_length(author) between 1 and 80),
  relation text not null check (char_length(relation) between 1 and 60),
  body text not null check (char_length(body) between 2 and 1200),
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'oculto')),
  reported boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_contributions_memorial
  on public.family_contributions (memorial_id, status, created_at desc);

-- 7. Suggestions (inserted via Turnstile-validated Edge Function only)
create table if not exists public.suggestions (
  id text primary key,
  body text not null check (char_length(body) between 3 and 1000),
  created_at timestamptz not null default now()
);

-- 8. Moderation reports
create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('memorial', 'contribution', 'book')),
  target_id text not null,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);

-- Enable Row Level Security on ALL tables
alter table public.memorials enable row level security;
alter table public.memorial_private_data enable row level security;
alter table public.memorial_invite_grants enable row level security;
alter table public.memory_books enable row level security;
alter table public.published_memory_books enable row level security;
alter table public.family_contributions enable row level security;
alter table public.suggestions enable row level security;
alter table public.moderation_reports enable row level security;

-- RLS Policies: public.memorials
create policy "memorials_select_authorized"
  on public.memorials for select
  using (
    deleted_at is null
    and (
      privacy = 'publico'
      or (select auth.uid()) = owner_uuid
      or (
        privacy = 'invitados'
        and exists (
          select 1 from public.memorial_invite_grants g
          where g.memorial_id = memorials.id
            and g.grantee_uuid = (select auth.uid())
        )
      )
    )
  );

create policy "memorials_insert_owner"
  on public.memorials for insert
  to authenticated
  with check ((select auth.uid()) = owner_uuid and is_demo = false);

create policy "memorials_update_owner"
  on public.memorials for update
  to authenticated
  using ((select auth.uid()) = owner_uuid)
  with check ((select auth.uid()) = owner_uuid and is_demo = false);

create policy "memorials_delete_owner"
  on public.memorials for delete
  to authenticated
  using ((select auth.uid()) = owner_uuid);

-- RLS Policies: public.memorial_private_data (strictly owner-only)
create policy "memorial_private_owner_all"
  on public.memorial_private_data for all
  to authenticated
  using ((select auth.uid()) = owner_uuid)
  with check ((select auth.uid()) = owner_uuid);

-- RLS Policies: public.memorial_invite_grants
create policy "invite_grants_select_own"
  on public.memorial_invite_grants for select
  to authenticated
  using ((select auth.uid()) = grantee_uuid);

-- RLS Policies: public.memory_books (strictly owner-only drafts)
create policy "memory_books_owner_all"
  on public.memory_books for all
  to authenticated
  using ((select auth.uid()) = owner_uuid)
  with check ((select auth.uid()) = owner_uuid);

-- RLS Policies: public.published_memory_books
create policy "published_books_select_authorized"
  on public.published_memory_books for select
  using (
    privacy = 'publico'
    or (select auth.uid()) = owner_uuid
    or (
      privacy = 'invitados'
      and memorial_id is not null
      and exists (
        select 1 from public.memorial_invite_grants g
        where g.memorial_id = published_memory_books.memorial_id
          and g.grantee_uuid = (select auth.uid())
      )
    )
  );

create policy "published_books_owner_write"
  on public.published_memory_books for all
  to authenticated
  using ((select auth.uid()) = owner_uuid)
  with check ((select auth.uid()) = owner_uuid);

-- RLS Policies: public.family_contributions
-- Public/visitors can read approved; owners can read/moderate all on their memorials.
-- Inserts are done via Turnstile-validated Edge Function (service_role) to enforce anti-spam.
create policy "contributions_select_approved_or_owner"
  on public.family_contributions for select
  using (
    status = 'aprobado'
    or exists (
      select 1 from public.memorials m
      where m.id = family_contributions.memorial_id
        and m.owner_uuid = (select auth.uid())
    )
  );

create policy "contributions_update_owner"
  on public.family_contributions for update
  to authenticated
  using (
    exists (
      select 1 from public.memorials m
      where m.id = family_contributions.memorial_id
        and m.owner_uuid = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.memorials m
      where m.id = family_contributions.memorial_id
        and m.owner_uuid = (select auth.uid())
    )
  );

create policy "contributions_delete_owner"
  on public.family_contributions for delete
  to authenticated
  using (
    exists (
      select 1 from public.memorials m
      where m.id = family_contributions.memorial_id
        and m.owner_uuid = (select auth.uid())
    )
  );

-- Suggestions & Moderation Reports: no direct client SELECT/INSERT (handled by Edge Function with Turnstile)
create policy "suggestions_no_direct_client_access"
  on public.suggestions for select
  to authenticated
  using (false);

create policy "moderation_reports_no_direct_client_access"
  on public.moderation_reports for select
  to authenticated
  using (false);

-- 9. Secure invite redemption RPC (no raw invite code exposed in tables)
create or replace function public.redeem_memorial_invite(p_code text)
returns table (memorial_id text, data jsonb)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_uid uuid;
begin
  if p_code is null or char_length(trim(p_code)) < 4 then
    return;
  end if;

  v_hash := encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex');
  v_uid := auth.uid();

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

grant execute on function public.redeem_memorial_invite(text) to anon, authenticated;

-- 10. Quota / usage monitoring RPC (F3/F4)
create or replace function public.get_sanctuary_usage_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_memorials bigint;
  v_books bigint;
  v_db_bytes bigint;
  v_storage_bytes bigint;
begin
  select count(*) into v_memorials from public.memorials where deleted_at is null and is_demo = false;
  select count(*) into v_books from public.memory_books where deleted_at is null;
  select pg_database_size(current_database()) into v_db_bytes;
  select coalesce(sum((metadata->>'size')::bigint), 0) into v_storage_bytes from storage.objects where bucket_id = 'memorial-photos';

  return jsonb_build_object(
    'memorials_count', v_memorials,
    'books_count', v_books,
    'db_bytes', v_db_bytes,
    'db_limit_bytes', 524288000,
    'storage_bytes', v_storage_bytes,
    'storage_limit_bytes', 1073741824
  );
end;
$$;

grant execute on function public.get_sanctuary_usage_stats() to authenticated;

-- 11. Storage bucket for memorial photos (WebP, owner-scoped folder)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memorial-photos',
  'memorial-photos',
  true,
  2097152, -- 2 MB max per compressed WebP image
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "memorial_photos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'memorial-photos');

create policy "memorial_photos_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'memorial-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "memorial_photos_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'memorial-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'memorial-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "memorial_photos_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'memorial-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
