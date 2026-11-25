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

export async function signInWithEmailOtp(email: string): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function verifyEmailOtp(email: string, token: string): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOutCloud(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
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
  const path = `${ownerUuid}/${memorialId}/${slot}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('memorial-photos')
    .upload(path, blob, { contentType: blob.type, upsert: true });

  if (error) return dataUrl;
  const { data } = supabase.storage.from('memorial-photos').getPublicUrl(path);
  return data.publicUrl || dataUrl;
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

  const memorials = data.map((row) => {
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

  return { memorials, totalCount: count ?? memorials.length };
}

export async function upsertCloudMemorial(memorial: Memorial): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  if (memorial.ownerId === 'demo-owner') {
    // Excluir contenido demo de la persistencia productiva
    return { ok: true };
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return { ok: false, error: 'Inicia sesión para guardar en la nube' };
  }

  let prepared = { ...memorial };
  if (prepared.photoUrl?.startsWith('data:image/')) {
    prepared.photoUrl = await uploadDataUrlToStorage(user.id, prepared.id, prepared.photoUrl, 'cover');
  }

  const sanitized = sanitizeMemorialForPublic(prepared);
  const normalizedCode = memorial.inviteCode?.trim().toUpperCase() || '';
  const inviteCodeHash =
    memorial.privacy === 'invitados' && normalizedCode.length >= 4
      ? await sha256Hex(normalizedCode)
      : null;

  const { error: memErr } = await supabase.from('memorials').upsert(
    {
      id: memorial.id,
      owner_uuid: user.id,
      owner_id: memorial.ownerId,
      privacy: memorial.privacy,
      invite_code_hash: inviteCodeHash,
      data: sanitized,
      is_demo: false,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (memErr) return { ok: false, error: memErr.message };

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

  const { error } = await supabase
    .from('memorials')
    .delete()
    .eq('id', id)
    .eq('owner_uuid', user.id);

  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function redeemCloudInviteCode(code: string): Promise<Memorial[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('redeem_memorial_invite', {
    p_code: code.trim().toUpperCase(),
  });
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row: { data?: Memorial }) => row.data)
    .filter((m): m is Memorial => Boolean(m))
    .map(sanitizeMemorialForPublic);
}

export async function fetchCloudBooks(): Promise<MemoryBook[] | null> {
  if (!supabase) return null;
  const user = await getAuthenticatedUser();

  const [ownedRes, publishedRes] = await Promise.all([
    user
      ? supabase
          .from('memory_books')
          .select('data')
          .eq('owner_uuid', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('published_memory_books')
      .select('book_id, owner_uuid, memorial_id, privacy, snapshot, published_at')
      .order('published_at', { ascending: true }),
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

export async function upsertCloudBook(book: MemoryBook): Promise<CloudWriteResult> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: 'Inicia sesión para guardar el libro' };

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
