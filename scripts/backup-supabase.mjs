/**
 * JHV-PUBLIC-LAUNCH-003 (F4) — Independent Daily Backup of PostgreSQL & Storage
 * - Full pagination for all tables and Storage files
 * - SHA-256 integrity manifest
 * - Authenticated AES-256-GCM encryption when BACKUP_ENCRYPTION_KEY is set
 * - Quota alerts at 70% and 85%
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('FAIL-CLOSED: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  'memorials',
  'memorial_private_data',
  'memorial_invites',
  'memorial_invite_grants',
  'memory_books',
  'published_memory_books',
  'family_contributions',
  'suggestions',
  'moderation_reports',
  'user_recovery_credentials',
];

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function encryptAes256Gcm(plaintextBuf, passphrase) {
  const key = crypto.createHash('sha256').update(passphrase).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'AES-256-GCM',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

async function fetchAllRows(table) {
  const pageSize = 1000;
  let offset = 0;
  const all = [];
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(`Error reading table ${table}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function listAllStorage(prefix = '') {
  const files = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from('memorial-photos').list(prefix, { limit, offset });
    if (error) throw new Error(`Storage list error: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        files.push(...(await listAllStorage(fullPath)));
      } else {
        files.push(fullPath);
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return files;
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.resolve(process.cwd(), process.env.BACKUP_DIR || `backups/${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const bundle = {
  createdAt: new Date().toISOString(),
  supabaseUrl: SUPABASE_URL,
  tables: {},
  storage: {},
};

const manifest = {
  createdAt: bundle.createdAt,
  supabaseUrl: SUPABASE_URL,
  encrypted: Boolean(ENCRYPTION_KEY),
  tableCounts: {},
  tableHashes: {},
  storageFiles: 0,
  storageHashes: {},
  quotaAlert: 'ok',
};

for (const table of TABLES) {
  const rows = await fetchAllRows(table);
  const jsonStr = JSON.stringify(rows);
  bundle.tables[table] = rows;
  manifest.tableCounts[table] = rows.length;
  manifest.tableHashes[table] = sha256(Buffer.from(jsonStr, 'utf8'));
}

const storageFiles = await listAllStorage('');
for (const filePath of storageFiles) {
  const { data: blob, error } = await supabase.storage.from('memorial-photos').download(filePath);
  if (error || !blob) {
    throw new Error(`FAIL-CLOSED: Could not download Storage file ${filePath}`);
  }
  const buf = Buffer.from(await blob.arrayBuffer());
  bundle.storage[filePath] = buf.toString('base64');
  manifest.storageFiles += 1;
  manifest.storageHashes[filePath] = sha256(buf);
}

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

const bundleBuf = Buffer.from(JSON.stringify(bundle), 'utf8');
manifest.bundleSha256 = sha256(bundleBuf);

if (ENCRYPTION_KEY) {
  const encrypted = encryptAes256Gcm(bundleBuf, ENCRYPTION_KEY);
  fs.writeFileSync(path.join(outDir, 'backup.enc.json'), JSON.stringify(encrypted));
} else {
  fs.writeFileSync(path.join(outDir, 'backup.json'), bundleBuf);
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Backup completed:', outDir, JSON.stringify({ encrypted: manifest.encrypted, tableCounts: manifest.tableCounts, storageFiles: manifest.storageFiles, quotaAlert: manifest.quotaAlert }));
