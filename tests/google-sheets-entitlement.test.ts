import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('google-sheets entitlement enforcement', () => {
  const fnPath = path.resolve('supabase/functions/google-sheets/index.ts');
  const fn = fs.readFileSync(fnPath, 'utf8');

  it('derives the user id from the verified session, not client input', () => {
    expect(fn).toMatch(/auth\.getUser\(\)/);
    expect(fn).not.toMatch(/req\.json\(\)\.catch.*user_id/);
  });

  it('checks entitlement before protected actions', () => {
    expect(fn).toMatch(/from\('subscriptions'\)/);
    expect(fn).toMatch(/evaluateEntitlement/);
    expect(fn).toMatch(/CORE_ENTITLEMENTS/);
  });

  it('fails closed on entitlement lookup errors', () => {
    expect(fn).toMatch(/billingError/);
    expect(fn).toMatch(/503/);
  });

  it('does not gate the disconnect action', () => {
    expect(fn).toMatch(/body\.action !== 'disconnect'/);
  });

  it('uses the service-role client for the entitlement lookup', () => {
    expect(fn).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(fn).toMatch(/createClient\(supabaseUrl, serviceRoleKey\)/);
  });

  // --- CORE_ENTITLEMENTS policy assertions ---
  // Intended Ledgerly policy for the Google Sheets Edge Function:
  //   Allow:  trialing, active, no_provider
  //   Deny:   past_due, cancelled, expired, unpaid
  // A missing subscription row maps to 'no_provider' and must be allowed so
  // a brand-new user can connect Google Sheets before starting a trial.

  it('allows trialing, active, and no_provider', () => {
    const allowed = ['trialing', 'active', 'no_provider'];
    const setMatch = fn.match(/CORE_ENTITLEMENTS\s*=\s*new Set\(\[([^\]]*)\]\)/);
    expect(setMatch).not.toBeNull();
    const members = setMatch![1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    allowed.forEach((state) => expect(members).toContain(state));
  });

  it('denies past_due, cancelled, expired, and unpaid', () => {
    const denied = ['past_due', 'cancelled', 'expired', 'unpaid'];
    const setMatch = fn.match(/CORE_ENTITLEMENTS\s*=\s*new Set\(\[([^\]]*)\]\)/);
    expect(setMatch).not.toBeNull();
    const members = setMatch![1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    denied.forEach((state) => expect(members).not.toContain(state));
  });

  it('maps a missing subscription row to no_provider and allows it', () => {
    // maybeSingle returns null when no row exists; evaluateEntitlement maps
    // that to 'no_provider', which is now in CORE_ENTITLEMENTS.
    expect(fn).toMatch(/no_provider/);
    const setMatch = fn.match(/CORE_ENTITLEMENTS\s*=\s*new Set\(\[([^\]]*)\]\)/);
    expect(setMatch).not.toBeNull();
    const members = setMatch![1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    expect(members).toContain('no_provider');
  });
});