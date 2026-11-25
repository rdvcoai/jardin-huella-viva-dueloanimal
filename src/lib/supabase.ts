import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Memorial, MemoryBook } from '../types/memorial';
import { dataUrlToBlob } from '../utils/imageUtils';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export interface CloudWriteResult {
  ok: boolean;
  error?: string;
}

export interface UsageStats {
  memorialsCount: number;
  booksCount: number;
  dbBytes: number;
  dbLimitBytes: number;
  dbPercent: number;
  storageBytes: number;
  storageLimitBytes: number;
  storagePercent: number;
  alertLevel: 'ok' | 'warning_70' | 'critical_85';
}

const STORAGE_PREFIX = 'storage://memorial-photos/';

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getAuthenticatedUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Ensures an active Supabase Anonymous Auth session on the first action
 * requiring ownership (creating/editing a memorial or memory book).
 */
export async function ensureAnonymousSession(): Promise<User | null> {
  if (!supabase) return null;
  const existing = await getAuthenticatedUser();
  if (existing) return existing;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) return null;
  return data.user ?? null;
}

export async function signOutCloud(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function registerOrRotateRecoveryKey(): Promise<{
  ok: boolean;
  recoveryKey?: string;
  keyHint?: string;
  error?: string;
}> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  const user = await ensureAnonymousSession();
  if (!user) return { ok: false, error: 'No se pudo iniciar sesión anónima' };

  const { data, error } = await supabase.functions.invoke('recovery-auth', {
    body: { action: 'register_or_rotate' },
  });
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === 'object' && 'error' in data) {
    return { ok: false, error: String((data as { error: unknown }).error) };
  }
  return {
    ok: true,
    recoveryKey: (data as { recoveryKey?: string }).recoveryKey,
    keyHint: (data as { keyHint?: string }).keyHint,
  };
}

export async function revokeRecoveryKey(): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  const { data, error } = await supabase.functions.invoke('recovery-auth', {
    body: { action: 'revoke' },
  });
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === 'object' && 'error' in data) {
    return { ok: false, error: String((data as { error: unknown }).error) };
  }
  return { ok: true };
}

export async function recoverAccountWithKey(
  recoveryKey: string,
  turnstileToken: string
): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  const user = await ensureAnonymousSession();
  if (!user) return { ok: false, error: 'No se pudo iniciar sesión de recuperación' };

  const { data, error } = await supabase.functions.invoke('recovery-auth', {
    body: { action: 'recover', recoveryKey, turnstileToken },
  });
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === 'object' && 'error' in data) {
    return { ok: false, error: String((data as { error: unknown }).error) };
  }
  return { ok: true };
}

export async function getRecoveryKeyHint(): Promise<{ keyHint: string; rotatedAt: string; revokedAt: string | null } | null> {
  if (!supabase) return null;
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const { data } = await supabase
    .from('user_recovery_credentials')
    .select('key_hint, rotated_at, revoked_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    keyHint: String(data.key_hint),
    rotatedAt: String(data.rotated_at),
    revokedAt: (data.revoked_at as string | null) ?? null,
  };
}

export async function uploadDataUrlToStorage(
  ownerUuid: string,
  memorialId: string,
  dataUrl: string,
  slot: string
): Promise<string> {
  if (!supabase || !dataUrl.startsWith('data:image/')) return dataUrl;
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
  const path = `${ownerUuid}/${memorialId}/${slot}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('memorial-photos')
    .upload(path, blob, { contentType: blob.type, upsert: true });

  if (error) {
    throw new Error(`Error subiendo fotografía a Storage: ${error.message}`);
  }
  return `${STORAGE_PREFIX}${path}`;
}

async function resolveSignedPhotoUrls(memorials: Memorial[]): Promise<Memorial[]> {
  if (!supabase) return memorials;
  const paths = new Set<string>();
  for (const m of memorials) {
    if (m.photoUrl?.startsWith(STORAGE_PREFIX)) {
      paths.add(m.photoUrl.slice(STORAGE_PREFIX.length));
    }
  }
  if (paths.size === 0) return memorials;

  const pathList = Array.from(paths);
  const { data } = await supabase.storage.from('memorial-photos').createSignedUrls(pathList, 3600);
  if (!data) return memorials;

  const urlMap = new Map<string, string>();
  data.forEach((item) => {
    if (item.path && item.signedUrl) {
      urlMap.set(`${STORAGE_PREFIX}${item.path}`, item.signedUrl);
    }
  });

  return memorials.map((m) =>
    m.photoUrl && urlMap.has(m.photoUrl) ? { ...m, photoUrl: urlMap.get(m.photoUrl)! } : m
  );
}

function sanitizeMemorialForPublic(m: Memorial): Memorial {
  return {
    ...m,
    privateLetters: [],
    inviteCode: undefined,
    invitedEmails: undefined,
  };
}

export async function fetchCloudMemorialsPage(
  page = 0,
  pageSize = 30
): Promise<{ memorials: Memorial[]; totalCount: number } | null> {
  if (!supabase) return null;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await supabase
    .from('memorials')
    .select('id, owner_uuid, data', { count: 'exact' })
    .is('deleted_at', null)
    .eq('is_demo', false)
    .order('created_at', { ascending: true })
    .range(from, to);

  if (error || !data) return null;

  const user = await getAuthenticatedUser();
  let privateMap = new Map<
    string,
    { private_letters?: Memorial['privateLetters']; invite_code?: string; invited_emails?: string[] }
  >();

  if (user && data.length > 0) {
    const ownedIds = data.filter((r) => r.owner_uuid === user.id).map((r) => r.id as string);
    if (ownedIds.length > 0) {
      const { data: privRows } = await supabase
        .from('memorial_private_data')
        .select('memorial_id, private_letters, invite_code, invited_emails')
        .in('memorial_id', ownedIds);

      if (privRows) {
        privateMap = new Map(privRows.map((p) => [p.memorial_id as string, p]));
      }
    }
  }

  const rawMemorials = data.map((row) => {
    const base = row.data as Memorial;
    const priv = privateMap.get(row.id as string);
    if (!priv) return sanitizeMemorialForPublic(base);
    return {
      ...base,
      privateLetters: priv.private_letters ?? base.privateLetters ?? [],
      inviteCode: priv.invite_code ?? base.inviteCode,
      invitedEmails: priv.invited_emails ?? base.invitedEmails,
    };
  });

  const memorials = await resolveSignedPhotoUrls(rawMemorials);
  return { memorials, totalCount: count ?? memorials.length };
}

export async function upsertCloudMemorial(
  memorial: Memorial,
  profileEmail?: string
): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  if (memorial.ownerId === 'demo-owner') {
    return { ok: true };
  }

  const user = await ensureAnonymousSession();
  if (!user) {
    return { ok: false, error: 'No se pudo autenticar la sesión' };
  }

  let prepared = { ...memorial };
  if (prepared.photoUrl?.startsWith('data:image/')) {
    try {
      prepared.photoUrl = await uploadDataUrlToStorage(user.id, prepared.id, prepared.photoUrl, 'cover');
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error subiendo fotografía' };
    }
  }

  const sanitized = sanitizeMemorialForPublic(prepared);
  const normalizedCode = memorial.inviteCode?.trim().toUpperCase() || '';
  const inviteCodeHash =
    memorial.privacy === 'invitados' && normalizedCode.length >= 4
      ? await sha256Hex(normalizedCode)
      : null;

  const normalizedEmail = profileEmail?.trim().toLowerCase() || '';
  const emailHash =
    normalizedEmail.length >= 5 && normalizedEmail.includes('@')
      ? await sha256Hex(normalizedEmail)
      : null;

  const { error: memErr } = await supabase.from('memorials').upsert(
    {
      id: memorial.id,
      owner_uuid: user.id,
      owner_id: memorial.ownerId,
      privacy: memorial.privacy,
      invite_code_hash: inviteCodeHash,
      email_hash: emailHash,
      data: sanitized,
      is_demo: false,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (memErr) return { ok: false, error: memErr.message };

  if (inviteCodeHash) {
    await supabase.from('memorial_invites').upsert(
      {
        memorial_id: memorial.id,
        owner_uuid: user.id,
        code_hash: inviteCodeHash,
        max_uses: 25,
      },
      { onConflict: 'id' }
    );
  }

  const { error: privErr } = await supabase.from('memorial_private_data').upsert(
    {
      memorial_id: memorial.id,
      owner_uuid: user.id,
      private_letters: memorial.privateLetters ?? [],
      invite_code: normalizedCode || null,
      invited_emails: memorial.invitedEmails ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'memorial_id' }
  );

  return privErr ? { ok: false, error: privErr.message } : { ok: true };
}

export async function deleteCloudMemorial(id: string): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: 'Autenticación requerida' };

  // Clean up Storage objects in owner's memorial folder before deleting row
  const prefix = `${user.id}/${id}`;
  const { data: files } = await supabase.storage.from('memorial-photos').list(prefix);
  if (files && files.length > 0) {
    await supabase.storage
      .from('memorial-photos')
      .remove(files.map((f) => `${prefix}/${f.name}`));
  }

  const { error } = await supabase
    .from('memorials')
    .delete()
    .eq('id', id)
    .eq('owner_uuid', user.id);

  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function revokeMemorialInvites(memorialId: string): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  const { error } = await supabase.rpc('revoke_memorial_invites', { p_memorial_id: memorialId });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function redeemCloudInviteCode(code: string): Promise<Memorial[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('redeem_memorial_invite', {
    p_code: code.trim().toUpperCase(),
  });
  if (error || !Array.isArray(data)) return [];
  const raw = data
    .map((row: { data?: Memorial }) => row.data)
    .filter((m): m is Memorial => Boolean(m))
    .map(sanitizeMemorialForPublic);
  return resolveSignedPhotoUrls(raw);
}

export async function findPublicMemorialsByEmail(email: string): Promise<Memorial[]> {
  if (!supabase) return [];
  const clean = email.trim().toLowerCase();
  if (clean.length < 5 || !clean.includes('@')) return [];
  const { data, error } = await supabase.rpc('find_public_memorials_by_email', {
    p_email: clean,
  });
  if (error || !Array.isArray(data)) return [];
  const raw = data
    .map((row: { data?: Memorial }) => row.data)
    .filter((m): m is Memorial => Boolean(m))
    .map(sanitizeMemorialForPublic);
  return resolveSignedPhotoUrls(raw);
}

export async function fetchCloudBooksPage(page = 0, pageSize = 30): Promise<MemoryBook[] | null> {
  if (!supabase) return null;
  const user = await getAuthenticatedUser();
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const [ownedRes, publishedRes] = await Promise.all([
    user
      ? supabase
          .from('memory_books')
          .select('data')
          .eq('owner_uuid', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .range(from, to)
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('published_memory_books')
      .select('book_id, owner_uuid, memorial_id, privacy, snapshot, published_at')
      .order('published_at', { ascending: true })
      .range(from, to),
  ]);

  const map = new Map<string, MemoryBook>();
  if (publishedRes.data) {
    for (const row of publishedRes.data) {
      const snap = row.snapshot as MemoryBook['publishedSnapshot'];
      if (!snap) continue;
      map.set(row.book_id as string, {
        id: row.book_id as string,
        ownerId: String(row.owner_uuid),
        memorialId: (row.memorial_id as string | null) ?? undefined,
        title: snap.cover.title,
        subtitle: snap.cover.animalName,
        template: snap.template,
        cover: snap.cover,
        openingNote: snap.openingNote,
        closingNote: snap.closingNote,
        privacy: row.privacy as MemoryBook['privacy'],
        chapters: snap.chapters,
        voiceContributions: [],
        publishedSnapshot: snap,
        updatedAt: snap.publishedAt,
      });
    }
  }

  if (ownedRes.data) {
    for (const row of ownedRes.data) {
      const b = row.data as MemoryBook;
      map.set(b.id, b);
    }
  }

  return Array.from(map.values());
}

export const fetchCloudBooks = () => fetchCloudBooksPage(0, 30);

export async function upsertCloudBook(book: MemoryBook): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  const user = await ensureAnonymousSession();
  if (!user) return { ok: false, error: 'No se pudo autenticar la sesión' };

  const { error: bookErr } = await supabase.from('memory_books').upsert(
    {
      id: book.id,
      owner_uuid: user.id,
      owner_id: book.ownerId,
      memorial_id: book.memorialId ?? null,
      privacy: book.privacy,
      data: book,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (bookErr) return { ok: false, error: bookErr.message };

  if (book.publishedSnapshot && book.privacy !== 'privado') {
    const { error: pubErr } = await supabase.from('published_memory_books').upsert(
      {
        book_id: book.id,
        owner_uuid: user.id,
        memorial_id: book.memorialId ?? null,
        privacy: book.privacy,
        snapshot: book.publishedSnapshot,
        published_at: book.publishedSnapshot.publishedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'book_id' }
    );
    if (pubErr) return { ok: false, error: pubErr.message };
  } else {
    await supabase.from('published_memory_books').delete().eq('book_id', book.id).eq('owner_uuid', user.id);
  }

  return { ok: true };
}

export async function deleteCloudBook(id: string): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: 'Autenticación requerida' };

  const { error } = await supabase
    .from('memory_books')
    .delete()
    .eq('id', id)
    .eq('owner_uuid', user.id);

  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function submitPublicAction(
  action: 'suggestion' | 'family_contribution' | 'report_content',
  turnstileToken: string,
  payload: Record<string, unknown>
): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  const { data, error } = await supabase.functions.invoke('submit-public-action', {
    body: { action, turnstileToken, payload },
  });
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === 'object' && 'error' in data) {
    return { ok: false, error: String((data as { error: unknown }).error) };
  }
  return { ok: true };
}

export async function submitCloudSuggestion(
  id: string,
  text: string,
  turnstileToken = ''
): Promise<CloudWriteResult> {
  return submitPublicAction('suggestion', turnstileToken, { id, text });
}

export async function fetchUsageStats(): Promise<UsageStats | null> {
  if (!supabase) return null;
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('get_sanctuary_usage_stats');
  if (error || !data) return null;

  const raw = data as {
    memorials_count: number;
    books_count: number;
    db_bytes: number;
    db_limit_bytes: number;
    storage_bytes: number;
    storage_limit_bytes: number;
  };
  const dbPercent = raw.db_limit_bytes > 0 ? (raw.db_bytes / raw.db_limit_bytes) * 100 : 0;
  const storagePercent = raw.storage_limit_bytes > 0 ? (raw.storage_bytes / raw.storage_limit_bytes) * 100 : 0;
  const maxPct = Math.max(dbPercent, storagePercent);

  return {
    memorialsCount: raw.memorials_count,
    booksCount: raw.books_count,
    dbBytes: raw.db_bytes,
    dbLimitBytes: raw.db_limit_bytes,
    dbPercent,
    storageBytes: raw.storage_bytes,
    storageLimitBytes: raw.storage_limit_bytes,
    storagePercent,
    alertLevel: maxPct >= 85 ? 'critical_85' : maxPct >= 70 ? 'warning_70' : 'ok',
  };
}
