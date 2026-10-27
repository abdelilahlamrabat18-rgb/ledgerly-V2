/**
 * Ledgerly billing state (server-authoritative).
 *
 * This Edge Function is the ONLY trusted path for reading or creating a
 * user's billing entitlement. It runs with the service role, bypasses RLS,
 * and never trusts client-supplied user IDs, timestamps, or statuses.
 *
 * GET  /billing-state  -> { ok: true, trial: {...}, entitlement: "..." }
 * POST /billing-state  -> { action: "start-trial" } starts a 14-day trial once.
 *
 * All responses are read-only safe projections. Provider identifiers and
 * internal entitlement fields are never returned to the browser.
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const TRIAL_DAYS = 14;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: 'Billing service is not configured.' }, 500);
  }

  const authorization = req.headers.get('Authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  if (!accessToken) {
    return json({ ok: false, error: 'Authentication required.' }, 401);
  }

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user?.id) {
    return json({ ok: false, error: 'Invalid or expired session.' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  if (req.method === 'POST') {
    let body: { action?: string } = {};
    try {
      body = await req.json() as { action?: string };
    } catch {
      return json({ ok: false, error: 'Invalid request body.' }, 400);
    }

    if (body.action !== 'start-trial') {
      return json({ ok: false, error: 'Unknown billing action.' }, 400);
    }

    // Server-authoritative: the user id comes from the verified session,
    // and the trial start/end are computed here, never supplied by the client.
    const { data, error } = await admin.rpc('start_trial_if_missing', {
      p_user_id: userData.user.id,
      p_trial_days: TRIAL_DAYS,
    });

    if (error) {
      console.error('[billing-state] start_trial_if_missing failed:', error.message);
      return json({ ok: false, error: 'Unable to start the trial. Please try again.' }, 500);
    }

    const row = (data as Array<unknown> | null)?.[0] as
      | { user_id: string; entitlement: string; trial_start: string | null; trial_end: string | null; created: boolean }
      | undefined;

    return json({
      ok: true,
      trial: row
        ? {
            userId: row.user_id,
            entitlement: row.entitlement,
            trialStart: row.trial_start,
            trialEnd: row.trial_end,
            created: Boolean(row.created),
          }
        : null,
    });
  }

  // GET: read-only safe projection.
  const { data, error } = await admin.rpc('subscription_safe_view', {
    p_user_id: userData.user.id,
  });

  if (error) {
    console.error('[billing-state] subscription_safe_view failed:', error.message);
    return json({ ok: false, error: 'Unable to load billing state.' }, 500);
  }

  const row = (data as Array<unknown> | null)?.[0] as
    | {
        user_id: string;
        entitlement: string;
        plan: string;
        plan_price_cents: number;
        currency: string;
        trial_start: string | null;
        trial_end: string | null;
        current_period_end: string | null;
        paid_through: string | null;
        provider: string;
      }
    | undefined;

  return json({
    ok: true,
    trial: row
      ? {
          userId: row.user_id,
          entitlement: row.entitlement,
          plan: row.plan,
          planPriceCents: row.plan_price_cents,
          currency: row.currency,
          trialStart: row.trial_start,
          trialEnd: row.trial_end,
          currentPeriodEnd: row.current_period_end,
          paidThrough: row.paid_through,
          provider: row.provider,
        }
      : null,
  });
});