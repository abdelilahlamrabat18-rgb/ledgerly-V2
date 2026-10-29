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

  it('fails closed when the caller has no billing row', () => {
    // maybeSingle returns null when no row exists; evaluateEntitlement maps
    // that to 'no_provider', which is not in CORE_ENTITLEMENTS.
    expect(fn).toMatch(/no_provider/);
  });

  it('does not gate the disconnect action', () => {
    expect(fn).toMatch(/body\.action !== 'disconnect'/);
  });

  it('uses the service-role client for the entitlement lookup', () => {
    expect(fn).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(fn).toMatch(/createClient\(supabaseUrl, serviceRoleKey\)/);
  });
});