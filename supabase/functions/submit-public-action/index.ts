import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SPAM_PATTERNS = [
  /https?:\/\/\S+/i,
  /www\.\S+/i,
  /<script/i,
  /\b(viagra|casino|crypto|forex|loan|porn)\b/i,
];

function containsSpam(text: string): boolean {
  return SPAM_PATTERNS.some((re) => re.test(text));
}

async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
  if (!secret) {
    // Reject if server secret is not configured
    return false;
  }

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (remoteIp) formData.append('remoteip', remoteIp);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
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
    const body = (await req.json()) as {
      action?: string;
      turnstileToken?: string;
      payload?: Record<string, unknown>;
    };

    const action = body.action?.trim();
    const token = body.turnstileToken?.trim() || '';
    const remoteIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Turnstile token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const turnstileOk = await verifyTurnstile(token, remoteIp);
    if (!turnstileOk) {
      return new Response(JSON.stringify({ error: 'Turnstile verification failed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    if (action === 'suggestion') {
      const id = String(body.payload?.id || `sug-${Date.now()}`).slice(0, 80);
      const text = String(body.payload?.text || '').trim();
      if (text.length < 3 || text.length > 1000) {
        return new Response(JSON.stringify({ error: 'Invalid suggestion length' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (containsSpam(text)) {
        return new Response(JSON.stringify({ error: 'Content rejected by anti-spam filter' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await admin.from('suggestions').insert({ id, body: text });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'family_contribution') {
      const memorialId = String(body.payload?.memorialId || '').trim();
      const author = String(body.payload?.author || '').trim();
      const relation = String(body.payload?.relation || '').trim();
      const text = String(body.payload?.text || '').trim();

      if (!memorialId || author.length < 1 || author.length > 80 || relation.length < 1 || relation.length > 60 || text.length < 2 || text.length > 1200) {
        return new Response(JSON.stringify({ error: 'Invalid contribution fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (containsSpam(text) || containsSpam(author)) {
        return new Response(JSON.stringify({ error: 'Content rejected by anti-spam filter' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: memorial } = await admin
        .from('memorials')
        .select('id, privacy, deleted_at')
        .eq('id', memorialId)
        .maybeSingle();

      if (!memorial || memorial.deleted_at || memorial.privacy === 'privado') {
        return new Response(JSON.stringify({ error: 'Memorial not open for contributions' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: inserted, error } = await admin
        .from('family_contributions')
        .insert({
          memorial_id: memorialId,
          author,
          relation,
          body: text,
          status: 'pendiente',
        })
        .select('id, created_at')
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, id: inserted.id, createdAt: inserted.created_at }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'report_content') {
      const targetType = String(body.payload?.targetType || '').trim();
      const targetId = String(body.payload?.targetId || '').trim();
      const reason = String(body.payload?.reason || '').trim();

      if (!['memorial', 'contribution', 'book'].includes(targetType) || !targetId || reason.length < 3 || reason.length > 500) {
        return new Response(JSON.stringify({ error: 'Invalid report payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await admin.from('moderation_reports').insert({
        target_type: targetType,
        target_id: targetId,
        reason,
      });
      if (error) throw error;

      if (targetType === 'contribution') {
        await admin.from('family_contributions').update({ reported: true }).eq('id', targetId);
      }

      return new Response(JSON.stringify({ ok: true }), {
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
