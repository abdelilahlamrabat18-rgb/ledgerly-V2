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
});
