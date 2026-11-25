import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Memorial, MemoryBook } from '../types/memorial';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function fetchCloudMemorials(): Promise<Memorial[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('memorials')
    .select('data')
    .order('created_at', { ascending: true });

  if (error || !data) return null;
  return data.map((row) => row.data as Memorial);
}

export async function upsertCloudMemorial(memorial: Memorial): Promise<void> {
  if (!supabase) return;
  await supabase.from('memorials').upsert(
    {
      id: memorial.id,
      owner_id: memorial.ownerId,
      data: memorial,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
}

export async function deleteCloudMemorial(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('memorials').delete().eq('id', id);
}

export async function fetchCloudBooks(): Promise<MemoryBook[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('memory_books')
    .select('data')
    .order('created_at', { ascending: true });

  if (error || !data) return null;
  return data.map((row) => row.data as MemoryBook);
}

export async function upsertCloudBook(book: MemoryBook): Promise<void> {
  if (!supabase) return;
  await supabase.from('memory_books').upsert(
    {
      id: book.id,
      owner_id: book.ownerId,
      memorial_id: book.memorialId ?? null,
      data: book,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
}

export async function deleteCloudBook(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('memory_books').delete().eq('id', id);
}

export async function submitCloudSuggestion(id: string, text: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('suggestions').insert({ id, text });
}

export function subscribeToCloudMemorials(
  onUpsert: (memorial: Memorial) => void,
  onDelete: (id: string) => void
): () => void {
  if (!supabase) return () => {};

  const channel = supabase
    .channel('memorials-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'memorials' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as { id?: string } | null;
          if (oldRow?.id) onDelete(oldRow.id);
          return;
        }
        const newRow = payload.new as { data?: Memorial } | null;
        if (newRow?.data) {
          onUpsert(newRow.data);
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
