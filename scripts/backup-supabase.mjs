/**
 * JHV-PUBLIC-BETA-001 (F4) — Independent Daily Backup of PostgreSQL & Storage
 * Runs at $0 cost via GitHub Actions or local CLI.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  'memorials',
  'memorial_private_data',
  'memorial_invite_grants',
  'memory_books',
  'published_memory_books',
  'family_contributions',
  'suggestions',
  'moderation_reports',
];

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.resolve(process.cwd(), process.env.BACKUP_DIR || `backups/${stamp}`);
const dbDir = path.join(outDir, 'postgres');
const storageDir = path.join(outDir, 'storage', 'memorial-photos');

fs.mkdirSync(dbDir, { recursive: true });
fs.mkdirSync(storageDir, { recursive: true });

const manifest = {
  createdAt: new Date().toISOString(),
  supabaseUrl: SUPABASE_URL,
  tables: {},
  storageFiles: 0,
  quotaAlert: 'ok',
};

for (const table of TABLES) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.error(`Error backing up table ${table}:`, error.message);
    process.exit(1);
  }
  fs.writeFileSync(path.join(dbDir, `${table}.json`), JSON.stringify(data ?? [], null, 2));
  manifest.tables[table] = (data ?? []).length;
}

// Independent Storage backup (recursive list of memorial-photos)
async function listAllStorage(prefix = '') {
  const { data, error } = await supabase.storage.from('memorial-photos').list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const files = [];
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      files.push(...(await listAllStorage(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const storageFiles = await listAllStorage('');
for (const filePath of storageFiles) {
  const { data: blob, error } = await supabase.storage.from('memorial-photos').download(filePath);
  if (error || !blob) continue;
  const target = path.join(storageDir, filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const buf = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(target, buf);
  manifest.storageFiles += 1;
}

// Operational quota check (70% / 85% thresholds)
const { data: stats } = await supabase.rpc('get_sanctuary_usage_stats');
if (stats) {
  const dbPct = stats.db_limit_bytes > 0 ? (stats.db_bytes / stats.db_limit_bytes) * 100 : 0;
  const stPct = stats.storage_limit_bytes > 0 ? (stats.storage_bytes / stats.storage_limit_bytes) * 100 : 0;
  const maxPct = Math.max(dbPct, stPct);
  manifest.quotaStats = { ...stats, dbPercent: Number(dbPct.toFixed(2)), storagePercent: Number(stPct.toFixed(2)) };
  if (maxPct >= 85) {
    manifest.quotaAlert = 'CRITICAL_85';
    console.warn(`::warning::CRITICAL: Supabase quota exceeded 85% (${maxPct.toFixed(1)}%)`);
  } else if (maxPct >= 70) {
    manifest.quotaAlert = 'WARNING_70';
    console.warn(`::warning::WARNING: Supabase quota exceeded 70% (${maxPct.toFixed(1)}%)`);
  }
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Backup completed:', outDir, JSON.stringify(manifest));
