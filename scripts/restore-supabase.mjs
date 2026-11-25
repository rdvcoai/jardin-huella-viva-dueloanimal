/**
 * JHV-PUBLIC-LAUNCH-003 (F4) — Fail-Closed Verified Restore of PostgreSQL & Storage
 * Usage: BACKUP_DIR=backups/<timestamp> BACKUP_ENCRYPTION_KEY=... node scripts/restore-supabase.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BACKUP_DIR = process.env.BACKUP_DIR || '';
const ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY || !BACKUP_DIR) {
  console.error('FAIL-CLOSED: Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or BACKUP_DIR');
  process.exit(1);
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function decryptAes256Gcm(payload, passphrase) {
  const key = crypto.createHash('sha256').update(passphrase).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]);
}

const resolvedDir = path.resolve(process.cwd(), BACKUP_DIR);
const manifestPath = path.join(resolvedDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('FAIL-CLOSED: manifest.json missing');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let bundleBuf;
const encPath = path.join(resolvedDir, 'backup.enc.json');
const plainPath = path.join(resolvedDir, 'backup.json');

if (manifest.encrypted) {
  if (!ENCRYPTION_KEY || !fs.existsSync(encPath)) {
    console.error('FAIL-CLOSED: Encrypted backup requires BACKUP_ENCRYPTION_KEY and backup.enc.json');
    process.exit(1);
  }
  const encPayload = JSON.parse(fs.readFileSync(encPath, 'utf8'));
  bundleBuf = decryptAes256Gcm(encPayload, ENCRYPTION_KEY);
} else {
  if (!fs.existsSync(plainPath)) {
    console.error('FAIL-CLOSED: backup.json missing');
    process.exit(1);
  }
  bundleBuf = fs.readFileSync(plainPath);
}

if (sha256(bundleBuf) !== manifest.bundleSha256) {
  console.error('FAIL-CLOSED: Bundle SHA-256 integrity check failed');
  process.exit(1);
}

const bundle = JSON.parse(bundleBuf.toString('utf8'));

// Verify every table & storage hash before touching target DB
for (const [table, expectedHash] of Object.entries(manifest.tableHashes || {})) {
  const rows = bundle.tables?.[table] || [];
  const actualHash = sha256(Buffer.from(JSON.stringify(rows), 'utf8'));
  if (actualHash !== expectedHash) {
    console.error(`FAIL-CLOSED: Integrity mismatch on table ${table}`);
    process.exit(1);
  }
}

for (const [filePath, expectedHash] of Object.entries(manifest.storageHashes || {})) {
  const b64 = bundle.storage?.[filePath];
  if (!b64 || sha256(Buffer.from(b64, 'base64')) !== expectedHash) {
    console.error(`FAIL-CLOSED: Integrity mismatch on storage file ${filePath}`);
    process.exit(1);
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES_ORDER = [
  { name: 'user_recovery_credentials', conflict: 'user_id' },
  { name: 'memorials', conflict: 'id' },
  { name: 'memorial_private_data', conflict: 'memorial_id' },
  { name: 'memorial_invites', conflict: 'id' },
  { name: 'memorial_invite_grants', conflict: 'id' },
  { name: 'memory_books', conflict: 'id' },
  { name: 'published_memory_books', conflict: 'book_id' },
  { name: 'family_contributions', conflict: 'id' },
  { name: 'suggestions', conflict: 'id' },
  { name: 'moderation_reports', conflict: 'id' },
];

for (const { name: table, conflict } of TABLES_ORDER) {
  const rows = bundle.tables?.[table] || [];
  if (!Array.isArray(rows) || rows.length === 0) continue;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });
  if (error) {
    console.error(`Error restoring ${table}:`, error.message);
    process.exit(1);
  }
  console.log(`Restored ${rows.length} rows into ${table}`);
}

let restoredFiles = 0;
for (const [filePath, b64] of Object.entries(bundle.storage || {})) {
  const buf = Buffer.from(b64, 'base64');
  const { error } = await supabase.storage
    .from('memorial-photos')
    .upload(filePath, buf, { upsert: true, contentType: filePath.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' });
  if (error) {
    console.error(`FAIL-CLOSED: Error restoring storage file ${filePath}:`, error.message);
    process.exit(1);
  }
  restoredFiles += 1;
}

console.log(`Restore completed & verified. Storage files restored: ${restoredFiles}`);
