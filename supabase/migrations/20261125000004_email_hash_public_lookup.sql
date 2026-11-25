-- JHV-PUBLIC-UX-HOTFIX-004:
-- 1. Store SHA-256 hash of optional profile email on memorials (never plaintext email)
--    to allow locating PUBLIC memorials from another device without granting ownership.
-- 2. Close legacy invite fallback when an explicit invite is revoked or exhausted.

alter table public.memorials
  add column if not exists email_hash text;

create index if not exists idx_memorials_email_hash
  on public.memorials (email_hash)
  where email_hash is not null and privacy = 'publico' and deleted_at is null;

create or replace function public.find_public_memorials_by_email(p_email text)
returns table (memorial_id text, data jsonb)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if p_email is null or char_length(trim(p_email)) < 5 or position('@' in p_email) = 0 then
    return;
  end if;

  v_hash := encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex');

  return query
  select m.id, m.data
  from public.memorials m
  where m.email_hash = v_hash
    and m.privacy = 'publico'
    and m.deleted_at is null
    and m.is_demo = false
  order by m.created_at asc
  limit 60;
end;
$$;

grant execute on function public.find_public_memorials_by_email(text) to anon, authenticated;

-- Close A5 P2 #1: do not fall back to memorials.invite_code_hash if an explicit
-- memorial_invites record exists for that hash (even if revoked or exhausted).
create or replace function public.redeem_memorial_invite(p_code text)
returns table (memorial_id text, data jsonb)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_uid uuid;
  v_has_explicit boolean;
  v_invite record;
begin
  if p_code is null or char_length(trim(p_code)) < 4 then
    return;
  end if;

  v_hash := encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex');
  v_uid := auth.uid();

  select exists(
    select 1 from public.memorial_invites where code_hash = v_hash
  ) into v_has_explicit;

  if v_has_explicit then
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

    if v_invite.id is null then
      return;
    end if;

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
