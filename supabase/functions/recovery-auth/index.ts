import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveVerifier(secretKey: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(secretKey), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(bits));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
  if (!secret) return false;
  const fd = new FormData();
  fd.append('secret', secret);
  fd.append('response', token);
  if (remoteIp) fd.append('remoteip', remoteIp);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const caller = userRes.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Authenticated session required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as {
      action?: string;
      recoveryKey?: string;
      turnstileToken?: string;
    };
    const action = body.action?.trim();
    const remoteIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for');

    if (action === 'register_or_rotate') {
      // Generate cryptographically secure recovery key: JHV-<keyId>-<secret>
      const idBytes = crypto.getRandomValues(new Uint8Array(4));
      const secBytes = crypto.getRandomValues(new Uint8Array(16));
      const keyId = toHex(idBytes).toUpperCase();
      const rawSecret = toHex(secBytes).toUpperCase();
      const fullKey = `JHV-${keyId}-${rawSecret}`;
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
      const verifierHash = await deriveVerifier(fullKey, salt);
      const keyHint = `••••${rawSecret.slice(-4)}`;

      const { error } = await admin.from('user_recovery_credentials').upsert(
        {
          user_id: caller.id,
          key_id: keyId,
          verifier_hash: verifierHash,
          salt,
          key_hint: keyHint,
          failed_attempts: 0,
          locked_until: null,
          rotated_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: 'user_id' }
      );
      if (error) throw error;

      // Return fullKey ONCE to the owner; server only keeps salted PBKDF2 verifierHash
      return new Response(JSON.stringify({ ok: true, recoveryKey: fullKey, keyHint }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'revoke') {
      const { error } = await admin
        .from('user_recovery_credentials')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', caller.id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'recover') {
      const token = body.turnstileToken?.trim() || '';
      if (!token || !(await verifyTurnstile(token, remoteIp))) {
        return new Response(JSON.stringify({ error: 'Turnstile verification failed' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rawKey = (body.recoveryKey || '').trim().toUpperCase();
      const parts = rawKey.split('-');
      if (parts.length !== 3 || parts[0] !== 'JHV' || parts[1].length !== 8 || parts[2].length !== 32) {
        return new Response(JSON.stringify({ error: 'Formato de clave de recuperación inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const keyId = parts[1];
      const { data: cred } = await admin
        .from('user_recovery_credentials')
        .select('*')
        .eq('key_id', keyId)
        .maybeSingle();

      if (!cred || cred.revoked_at) {
        return new Response(JSON.stringify({ error: 'Clave inválida o revocada' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (cred.locked_until && new Date(cred.locked_until).getTime() > Date.now()) {
        return new Response(JSON.stringify({ error: 'Demasiados intentos. Intenta en 15 minutos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const candidateHash = await deriveVerifier(rawKey, cred.salt);
      if (!timingSafeEqual(candidateHash, cred.verifier_hash)) {
        const nextAttempts = (cred.failed_attempts ?? 0) + 1;
        const lockUntil = nextAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await admin
          .from('user_recovery_credentials')
          .update({ failed_attempts: nextAttempts, locked_until: lockUntil })
          .eq('user_id', cred.user_id);
        return new Response(JSON.stringify({ error: 'Clave de recuperación incorrecta' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const oldUserId = cred.user_id as string;
      if (oldUserId !== caller.id) {
        // Transfer ownership of memorials, private data, books, invites & grants to caller's auth.uid()
        await admin.from('memorials').update({ owner_uuid: caller.id }).eq('owner_uuid', oldUserId);
        await admin.from('memorial_private_data').update({ owner_uuid: caller.id }).eq('owner_uuid', oldUserId);
        await admin.from('memory_books').update({ owner_uuid: caller.id }).eq('owner_uuid', oldUserId);
        await admin.from('published_memory_books').update({ owner_uuid: caller.id }).eq('owner_uuid', oldUserId);
        await admin.from('memorial_invites').update({ owner_uuid: caller.id }).eq('owner_uuid', oldUserId);
        await admin.from('memorial_invite_grants').update({ grantee_uuid: caller.id }).eq('grantee_uuid', oldUserId);

        // Move recovery credential record to the new auth.uid() and reset failed attempts
        await admin
          .from('user_recovery_credentials')
          .update({ user_id: caller.id, failed_attempts: 0, locked_until: null })
          .eq('user_id', oldUserId);
      } else {
        await admin
          .from('user_recovery_credentials')
          .update({ failed_attempts: 0, locked_until: null })
          .eq('user_id', oldUserId);
      }

      return new Response(JSON.stringify({ ok: true, recoveredFrom: oldUserId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
