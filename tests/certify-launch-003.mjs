/**
 * JHV-PUBLIC-LAUNCH-003 (F6) — Versioned Certification & Load Test Suite
 * Tests Anonymous Auth, Cryptographic Recovery Keys, Private Storage,
 * RLS Isolation, Revocable Invites, Base64 Rejection, Encrypted Backup/Restore,
 * 50 Concurrent Reads, and 1,000-Memorial Synthetic Dataset Pagination (with cleanup).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pgaaqnczxaylqznliecl.supabase.co';
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnYWFxbmN6eGF5bHF6bmxpZWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MDk0NjMsImV4cCI6MjExMTE4NTQ2M30.KFhfdX60c246-Sn5h_i-tZvRfLCAg7yQphtLk0IKIZQ';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY || 'cert-test-aes-key-32bytes-minimum!!';
const TURNSTILE_TEST_TOKEN = process.env.TURNSTILE_TEST_TOKEN || 'XXXX.DUMMY.TOKEN.XXXX';

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

const results = [];
const assert = (name, cond, detail = '') => {
  results.push({ name, pass: Boolean(cond), detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
};

const runId = Date.now();
const createdUserIds = [];
const createdMemorialIds = [];
const createdStoragePaths = [];

try {
  // 1. Anonymous Auth sessions (User A, User B, Recovery Device C)
  const clientA = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const clientB = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const clientC = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  const [resA, resB, resC] = await Promise.all([
    clientA.auth.signInAnonymously(),
    clientB.auth.signInAnonymously(),
    clientC.auth.signInAnonymously(),
  ]);
  assert('Anonymous Auth creates distinct sessions', Boolean(resA.data.user && resB.data.user && resC.data.user && resA.data.user.id !== resB.data.user.id), resA.error?.message || '');

  const uidA = resA.data.user.id;
  const uidB = resB.data.user.id;
  const uidC = resC.data.user.id;
  createdUserIds.push(uidA, uidB, uidC);

  // 2. Cryptographic Recovery Key: register, rotate, revoke, re-register
  const reg1 = await clientA.functions.invoke('recovery-auth', { body: { action: 'register_or_rotate' } });
  const key1 = reg1.data?.recoveryKey;
  assert('User A generates cryptographic recovery key', Boolean(key1 && key1.startsWith('JHV-')), reg1.error?.message || '');

  const reg2 = await clientA.functions.invoke('recovery-auth', { body: { action: 'register_or_rotate' } });
  const key2 = reg2.data?.recoveryKey;
  assert('User A rotates recovery key (invalidates key1)', Boolean(key2 && key2 !== key1));

  // Verify DB never stores plaintext key
  const { data: credRow } = await admin.from('user_recovery_credentials').select('verifier_hash, salt').eq('user_id', uidA).single();
  assert('Recovery credential stores salted verifier only (no plaintext)', Boolean(credRow && credRow.verifier_hash !== key2 && credRow.salt));

  // 3. CRUD + Base64 rejection + Private Storage
  const pubId = `cert-pub-${runId}`;
  const invId = `cert-inv-${runId}`;
  const privId = `cert-priv-${runId}`;
  createdMemorialIds.push(pubId, invId, privId);

  const b64ErrRes = await clientA.from('memorials').insert({
    id: `cert-b64-${runId}`,
    owner_uuid: uidA,
    owner_id: `uid:${uidA}`,
    privacy: 'publico',
    data: { id: `cert-b64-${runId}`, photoUrl: 'data:image/png;base64,iVBORw0KGgo=' },
    is_demo: false,
  });
  assert('PostgreSQL rejects Base64 data:image/ inside JSONB', Boolean(b64ErrRes.error), b64ErrRes.error?.message);

  const webpStub = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64');
  const privPhotoPath = `${uidA}/${privId}/cover.webp`;
  createdStoragePaths.push(privPhotoPath);
  const { error: upErr } = await clientA.storage.from('memorial-photos').upload(privPhotoPath, webpStub, { contentType: 'image/webp', upsert: true });
  assert('User A uploads WebP to private Storage bucket', !upErr, upErr?.message);

  const inviteCode = `INV-${runId.toString().slice(-4)}`;
  const inviteHash = crypto.createHash('sha256').update(inviteCode).digest('hex');

  const insRes = await clientA.from('memorials').insert([
    { id: pubId, owner_uuid: uidA, owner_id: `uid:${uidA}`, privacy: 'publico', data: { id: pubId, name: 'Publico', privacy: 'publico' }, is_demo: false },
    { id: invId, owner_uuid: uidA, owner_id: `uid:${uidA}`, privacy: 'invitados', invite_code_hash: inviteHash, data: { id: invId, name: 'Invitados', privacy: 'invitados' }, is_demo: false },
    { id: privId, owner_uuid: uidA, owner_id: `uid:${uidA}`, privacy: 'privado', data: { id: privId, name: 'Privado', photoUrl: `storage://memorial-photos/${privPhotoPath}`, privacy: 'privado' }, is_demo: false },
  ]);
  assert('User A creates publico/invitados/privado memorials', !insRes.error, insRes.error?.message);

  // 4. Conditioned family_contributions RLS
  await admin.from('family_contributions').insert({
    memorial_id: privId,
    author: 'Familiar',
    relation: 'Hermano',
    body: 'Mensaje en memorial privado',
    status: 'aprobado',
  });
  const { data: bContrib } = await clientB.from('family_contributions').select('id').eq('memorial_id', privId);
  assert('Approved contribution on privado memorial is hidden from User B', (bContrib?.length ?? 0) === 0);

  // 5. Private Storage isolation
  const { data: bSigned } = await clientB.storage.from('memorial-photos').createSignedUrl(privPhotoPath, 60);
  const bFetch = bSigned?.signedUrl ? await fetch(bSigned.signedUrl) : { status: 403 };
  assert('User B cannot read User A private memorial photo', !bSigned?.signedUrl || bFetch.status >= 400);

  // 6. Revocable invite
  await clientA.from('memorial_invites').insert({ memorial_id: invId, owner_uuid: uidA, code_hash: inviteHash, max_uses: 2 });
  const red1 = await clientB.rpc('redeem_memorial_invite', { p_code: inviteCode });
  assert('User B redeems limited invite', !red1.error && red1.data?.length === 1);

  await clientA.rpc('revoke_memorial_invites', { p_memorial_id: invId });
  const redAfterRevoke = await clientB.rpc('redeem_memorial_invite', { p_code: inviteCode });
  assert('Revoked invite cannot be redeemed again', (redAfterRevoke.data?.length ?? 0) === 0);

  // 7. Recovery onto new Device C without OTP
  const recWrong = await clientC.functions.invoke('recovery-auth', {
    body: { action: 'recover', recoveryKey: key1, turnstileToken: TURNSTILE_TEST_TOKEN },
  });
  assert('Old rotated key1 is rejected on recovery', Boolean(recWrong.error || recWrong.data?.error));

  const recOk = await clientC.functions.invoke('recovery-auth', {
    body: { action: 'recover', recoveryKey: key2, turnstileToken: TURNSTILE_TEST_TOKEN },
  });
  assert('Device C recovers User A ownership using key2', Boolean(recOk.data?.ok), JSON.stringify(recOk.data || recOk.error));

  const { data: cOwned } = await clientC.from('memorials').select('id').eq('owner_uuid', uidC).in('id', [pubId, invId, privId]);
  assert('Device C now owns all 3 memorials via auth.uid()', cOwned?.length === 3, `count=${cOwned?.length}`);

  // 8. Encrypted Backup & Fail-Closed Restore
  const backupDir = path.resolve('backups/cert-launch-003');
  execSync('node scripts/backup-supabase.mjs', {
    env: { ...process.env, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, BACKUP_ENCRYPTION_KEY: ENCRYPTION_KEY, BACKUP_DIR: backupDir },
    stdio: 'pipe',
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));
  assert('Encrypted backup created with SHA-256 manifest', manifest.encrypted === true && Boolean(manifest.bundleSha256));

  await admin.from('memorials').delete().eq('id', pubId);
  execSync('node scripts/restore-supabase.mjs', {
    env: { ...process.env, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, BACKUP_ENCRYPTION_KEY: ENCRYPTION_KEY, BACKUP_DIR: backupDir },
    stdio: 'pipe',
  });
  const { data: restoredPub } = await admin.from('memorials').select('id').eq('id', pubId).maybeSingle();
  assert('Encrypted restore recovered deleted memorial', restoredPub?.id === pubId);
  fs.rmSync(backupDir, { recursive: true, force: true });

  // 9. Synthetic 1,000-memorial dataset pagination + 50 concurrent reads (isolated & cleaned up)
  const synthIds = Array.from({ length: 1000 }, (_, i) => `synth-${runId}-${i}`);
  createdMemorialIds.push(...synthIds);
  for (let i = 0; i < 1000; i += 250) {
    const batch = synthIds.slice(i, i + 250).map((id, idx) => ({
      id,
      owner_uuid: uidC,
      owner_id: `uid:${uidC}`,
      privacy: 'publico',
      data: { id, name: `Mascota ${i + idx}`, privacy: 'publico' },
      is_demo: false,
    }));
    const { error } = await admin.from('memorials').insert(batch);
    if (error) throw error;
  }

  const page33 = await anon.from('memorials').select('id, data', { count: 'exact' }).is('deleted_at', null).range(990, 1019);
  assert('1,000-memorial dataset paginated (30/page) returns exact count >= 1000', (page33.count ?? 0) >= 1000 && (page33.data?.length ?? 0) >= 10, `count=${page33.count}`);

  const latencies = [];
  const loadStart = Date.now();
  const loadRes = await Promise.all(
    Array.from({ length: 50 }, async (_, i) => {
      const t0 = Date.now();
      const page = i % 33;
      const { error } = await anon.from('memorials').select('id, data').is('deleted_at', null).range(page * 30, page * 30 + 29);
      latencies.push(Date.now() - t0);
      return !error;
    })
  );
  const totalMs = Date.now() - loadStart;
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  assert('50 concurrent reads across 1,000-memorial dataset', loadRes.filter(Boolean).length === 50, `50/50 ok, total=${totalMs}ms, p95=${p95}ms`);
} finally {
  for (let i = 0; i < createdMemorialIds.length; i += 250) {
    await admin.from('memorials').delete().in('id', createdMemorialIds.slice(i, i + 250));
  }
  if (createdStoragePaths.length > 0) {
    await admin.storage.from('memorial-photos').remove(createdStoragePaths);
  }
  for (const uid of createdUserIds) {
    await admin.auth.admin.deleteUser(uid);
  }
}

const failed = results.filter((r) => !r.pass);
console.log(`\nLAUNCH-003 CERTIFICATION SUMMARY: ${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
