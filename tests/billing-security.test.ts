import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('billing SQL security', () => {
  const migrationPath = path.resolve('supabase/migrations/20261025000000_subscriptions.sql');
  const migration = fs.readFileSync(migrationPath, 'utf8');

  it('revokes start_trial_if_missing from public/anon/authenticated', () => {
    expect(migration).toMatch(/revoke all on function public\.start_trial_if_missing.*from public/i);
    expect(migration).toMatch(/revoke all on function public\.start_trial_if_missing.*from anon/i);
    expect(migration).toMatch(/revoke all on function public\.start_trial_if_missing.*from authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.start_trial_if_missing.*to service_role/i);
  });

  it('revokes subscription_safe_view from public/anon', () => {
    expect(migration).toMatch(/revoke all on function public\.subscription_safe_view.*from public/i);
    expect(migration).toMatch(/revoke all on function public\.subscription_safe_view.*from anon/i);
    expect(migration).toMatch(/grant execute on function public\.subscription_safe_view.*to authenticated/i);
  });

  it('subscription_safe_view checks auth.uid()', () => {
    expect(migration).toMatch(/auth\.uid\(\)\s*is not null/i);
    expect(migration).toMatch(/auth\.uid\(\)\s*=\s*p_user_id/i);
  });

  it('start_trial_if_missing uses atomic upsert and sets provider lemonsqueezy', () => {
    expect(migration).toMatch(/on conflict \(user_id\) do nothing/i);
    expect(migration).toMatch(/'lemonsqueezy'/i);
  });

  it('both functions have safe search_path', () => {
    expect(migration).toMatch(/security definer.*set search_path\s*=\s*public,\s*pg_temp/i);
  });
});
