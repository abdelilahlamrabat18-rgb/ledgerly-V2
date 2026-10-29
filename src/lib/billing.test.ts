import { describe, expect, it } from 'vitest';
import {
  evaluateEntitlement,
  hasCoreAccess,
  isTrialing,
  isPaid,
  mapProviderStatus,
  type BillingRecord,
  type Entitlement,
} from './billing';

const FUTURE = '2999-01-01T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';

describe('evaluateEntitlement', () => {
  it('returns no_provider for missing data', () => {
    expect(evaluateEntitlement(null)).toBe('no_provider');
    expect(evaluateEntitlement(undefined)).toBe('no_provider');
    expect(evaluateEntitlement({} as BillingRecord)).toBe('no_provider');
  });

  it('keeps a trialing entitlement active while the trial end is in the future', () => {
    expect(evaluateEntitlement({ entitlement: 'trialing', trial_end: FUTURE })).toBe('trialing');
  });

  it('expires a trialing entitlement once the trial end has passed', () => {
    expect(evaluateEntitlement({ entitlement: 'trialing', trial_end: PAST })).toBe('expired');
  });

  it('treats a missing trial end as expired, not as active', () => {
    expect(evaluateEntitlement({ entitlement: 'trialing', trial_end: null })).toBe('expired');
  });

  it('active stays active regardless of dates', () => {
    expect(evaluateEntitlement({ entitlement: 'active', trial_end: PAST })).toBe('active');
  });

  it('past_due keeps access while a confirmed paid-through date is still future', () => {
    expect(
      evaluateEntitlement({
        entitlement: 'past_due',
        paid_through: FUTURE,
        current_period_end: PAST,
      }),
    ).toBe('past_due');
  });

  it('past_due keeps access until the current period ends when no paid-through date exists', () => {
    expect(
      evaluateEntitlement({
        entitlement: 'past_due',
        paid_through: null,
        current_period_end: FUTURE,
      }),
    ).toBe('past_due');
  });

  it('past_due degrades to unpaid once both paid-through and period end have passed', () => {
    expect(
      evaluateEntitlement({
        entitlement: 'past_due',
        paid_through: PAST,
        current_period_end: PAST,
      }),
    ).toBe('unpaid');
  });

  it('cancelled keeps access only while a paid-through date is still future', () => {
    expect(evaluateEntitlement({ entitlement: 'cancelled', paid_through: FUTURE })).toBe('cancelled');
    expect(evaluateEntitlement({ entitlement: 'cancelled', paid_through: PAST })).toBe('expired');
  });

  it('expired and unpaid are terminal states', () => {
    expect(evaluateEntitlement({ entitlement: 'expired' })).toBe('expired');
    expect(evaluateEntitlement({ entitlement: 'unpaid' })).toBe('unpaid');
    expect(evaluateEntitlement({ entitlement: 'no_provider' })).toBe('no_provider');
  });
});

describe('hasCoreAccess', () => {
  it('permits navigation for trialing, active, and no_provider', () => {
    const granted: Array<Entitlement | string> = ['trialing', 'active', 'no_provider'];
    const denied: Array<Entitlement | string> = ['past_due', 'cancelled', 'expired', 'unpaid'];
    granted.forEach((state) => expect(hasCoreAccess(state)).toBe(true));
    denied.forEach((state) => expect(hasCoreAccess(state)).toBe(false));
  });
});

describe('isTrialing / isPaid', () => {
  it('identifies trialing state', () => {
    expect(isTrialing('trialing')).toBe(true);
    expect(isTrialing('active')).toBe(false);
  });

  it('identifies paid states', () => {
    expect(isPaid('active')).toBe(true);
    expect(isPaid('past_due')).toBe(true);
    expect(isPaid('trialing')).toBe(false);
  });
});

describe('mapProviderStatus', () => {
  it('maps known provider statuses', () => {
    expect(mapProviderStatus('trialing')).toBe('trialing');
    expect(mapProviderStatus('active')).toBe('active');
    expect(mapProviderStatus('past_due')).toBe('past_due');
    expect(mapProviderStatus('pastdue')).toBe('past_due');
    expect(mapProviderStatus('cancelled')).toBe('cancelled');
    expect(mapProviderStatus('expired')).toBe('expired');
    expect(mapProviderStatus('unpaid')).toBe('unpaid');
    expect(mapProviderStatus('payment_failed')).toBe('unpaid');
  });

  it('treats unknown and null statuses conservatively as unpaid', () => {
    expect(mapProviderStatus(null)).toBe('unpaid');
    expect(mapProviderStatus(undefined)).toBe('unpaid');
    expect(mapProviderStatus('')).toBe('unpaid');
    expect(mapProviderStatus('something_weird')).toBe('unpaid');
  });
});

describe('trial cannot be restarted by client input', () => {
  it('evaluateEntitlement never returns trialing for a past trial end', () => {
    // A client cannot extend the trial by supplying a future date after the
    // real trial end has passed; the engine re-checks the stored timestamp.
    expect(evaluateEntitlement({ entitlement: 'trialing', trial_end: PAST })).not.toBe('trialing');
  });
});