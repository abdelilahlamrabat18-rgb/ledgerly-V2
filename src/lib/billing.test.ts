import { describe, expect, it } from 'vitest';
import { evaluateEntitlement, hasCoreAccess, mapProviderStatus } from './billing';

describe('billing entitlement', () => {
  it('denies access when no record', () => {
    const ent = evaluateEntitlement(null);
    expect(ent).toBe('no_provider');
    expect(hasCoreAccess(ent)).toBe(false);
  });

  it('expires trial when trial_end in the past', () => {
    const past = new Date(Date.now() - 1000 * 60).toISOString();
    const ent = evaluateEntitlement({ entitlement: 'trialing', trial_end: past });
    expect(ent).toBe('expired');
    expect(hasCoreAccess(ent)).toBe(false);
  });

  it('keeps trialing when trial_end in the future', () => {
    const future = new Date(Date.now() + 1000 * 60).toISOString();
    const ent = evaluateEntitlement({ entitlement: 'trialing', trial_end: future });
    expect(ent).toBe('trialing');
    expect(hasCoreAccess(ent)).toBe(true);
  });

  it('treats missing trial_end as expired', () => {
    const ent = evaluateEntitlement({ entitlement: 'trialing', trial_end: null });
    expect(ent).toBe('expired');
    expect(hasCoreAccess(ent)).toBe(false);
  });

  it('past_due requires paid_through or current_period_end in future', () => {
    const future = new Date(Date.now() + 1000 * 60).toISOString();
    expect(hasCoreAccess(evaluateEntitlement({ entitlement: 'past_due', paid_through: future }))).toBe(true);
    expect(hasCoreAccess(evaluateEntitlement({ entitlement: 'past_due', current_period_end: future }))).toBe(true);
    expect(hasCoreAccess(evaluateEntitlement({ entitlement: 'past_due', paid_through: null, current_period_end: null }))).toBe(false);
  });

  it('maps provider status conservatively', () => {
    expect(mapProviderStatus('unknown')).toBe('unpaid');
    expect(mapProviderStatus(null)).toBe('unpaid');
    expect(mapProviderStatus('active')).toBe('active');
  });
});
