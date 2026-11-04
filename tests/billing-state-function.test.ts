import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('billing-state edge function', () => {
  const fnPath = path.resolve('supabase/functions/billing-state/index.ts');
  const fn = fs.readFileSync(fnPath, 'utf8');

  it('verifies user session via getUser', () => {
    expect(fn).toMatch(/auth\.getUser\(\)/);
  });

  it('uses service role for admin operations', () => {
    expect(fn).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(fn).toMatch(/createClient\(supabaseUrl, serviceRoleKey\)/);
  });

  it('calls start_trial_if_missing and subscription_safe_view', () => {
    expect(fn).toMatch(/start_trial_if_missing/);
    expect(fn).toMatch(/subscription_safe_view/);
  });

  it('handles the client read request (supabase.functions.invoke always POSTs)', () => {
    // fetchBillingState sends { action: 'read' } via invoke, which is a POST.
    // The function must accept that action rather than returning 400, which
    // is what caused the production "Failed to send a request" loop.
    expect(fn).toMatch(/body\.action === 'read'/);
    expect(fn).toMatch(/readBillingState/);
  });

  it('rejects unknown actions instead of defaulting to allow', () => {
    expect(fn).toMatch(/Unknown billing action/);
  });

  it('derives API-key presence from server-side configuration, not from the user row', () => {
    // Presence is operational env state, not a per-user subscription property.
    // It must be computed independently of the trial row so a brand-new user
    // with no subscription record still sees the correct value.
    expect(fn).toMatch(/isProviderApiKeyPresent/);
    expect(fn).toMatch(/LEMON_SQUEEZY_API_KEY/);
  });

  it('returns providerApiKeyPresent as a safe boolean in all three response shapes', () => {
    // POST start-trial, POST read, and GET read must all carry the presence
    // flag so the frontend can gate checkout UI without re-deriving it from
    // provider strings. There are two distinct call sites: the start-trial
    // inline return and the readBillingState return.
    const matches = fn.match(/return json\(\{\s*ok:\s*true,\s*providerApiKeyPresent:\s*isProviderApiKeyPresent\(\),\s*trial:/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });

  it('never sends secret values to the frontend', () => {
    // The presence flag is a boolean only. The API key is read server-side
    // via Deno.env.get and must never be interpolated into a response payload
    // or logged to stdout where a client could see it.
    expect(fn).not.toMatch(/Deno\.env\.get\(['"]LEMON_SQUEEZY_API_KEY['"]\)[^;]*\+[^;]*json/);
    expect(fn).not.toMatch(/console\.(log|error|debug)\([^)]*LEMON_SQUEEZY_API_KEY/);
  });

  it('trial creation is independent of provider configuration', () => {
    // start-trial must succeed regardless of whether the API key is set.
    // The RPC call (start_trial_if_missing) must never consult
    // isProviderApiKeyPresent — only the response payload carries the flag.
    const rpcCall = fn.slice(
      fn.indexOf("admin.rpc('start_trial_if_missing'"),
      fn.indexOf('return json', fn.indexOf("admin.rpc('start_trial_if_missing'")),
    );
    expect(rpcCall).not.toMatch(/isProviderApiKeyPresent/);
  });
});