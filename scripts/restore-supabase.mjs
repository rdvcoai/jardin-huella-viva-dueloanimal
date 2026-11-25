/**
 * JHV-PUBLIC-BETA-001 (F4) — Restore PostgreSQL & Storage from Backup
 * Usage: BACKUP_DIR=backups/<timestamp> node scripts/restore-supabase.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BACKUP_DIR = process.env.BACKUP_DIR || '';

if (!SUPABASE_URL || !SERVICE_KEY || !BACKUP_DIR) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or BACKUP_DIR');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES_ORDER = [
  { name: 'memorials', conflict: 'id' },
  { name: 'memorial_private_data', conflict: 'memorial_id' },
  { name: 'memorial_invite_grants', conflict: 'id' },
  { name: 'memory_books', conflict: 'id' },
  { name: 'published_memory_books', conflict: 'book_id' },
  { name: 'family_contributions', conflict: 'id' },
  { name: 'suggestions', conflict: 'id' },
  { name: 'moderation_reports', conflict: 'id' },
];

const dbDir = path.resolve(process.cwd(), BACKUP_DIR, 'postgres');
for (const { name: table, conflict } of TABLES_ORDER) {
  const file = path.join(dbDir, `${table}.json`);
  if (!fs.existsSync(file)) continue;
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0) continue;

  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });
  if (error) {
    console.error(`Error restoring ${table}:`, error.message);
    process.exit(1);
  }
  console.log(`Restored ${rows.length} rows into ${table}`);
}

const storageRoot = path.resolve(process.cwd(), BACKUP_DIR, 'storage', 'memorial-photos');
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

let restoredFiles = 0;
for (const file of walk(storageRoot)) {
  const rel = path.relative(storageRoot, file).replace(/\\/g, '/');
  const buf = fs.readFileSync(file);
  const { error } = await supabase.storage
    .from('memorial-photos')
    .upload(rel, buf, { upsert: true, contentType: rel.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' });
  if (!error) restoredFiles += 1;
}

console.log(`Restore completed. Storage files restored: ${restoredFiles}`);
