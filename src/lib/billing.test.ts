export type BillingState = 
  | 'no_provider'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'expired'
  | 'unpaid';

export interface SubscriptionRecord {
  entitlement?: string | null;
  trial_end?: string | null;
  paid_through?: string | null;
  current_period_end?: string | null;
  status?: string | null;
}

/**
 * Evaluates the current billing entitlement based on subscription records.
 */
export function evaluateEntitlement(record: SubscriptionRecord | null | undefined): BillingState {
  if (!record || !record.entitlement) {
    return 'no_provider';
  }

  const now = Date.now();

  if (record.entitlement === 'trialing') {
    if (!record.trial_end) {
      return 'expired';
    }
    const trialEndTime = new Date(record.trial_end).getTime();
    return trialEndTime > now ? 'trialing' : 'expired';
  }

  if (record.entitlement === 'past_due') {
    const paidThroughTime = record.paid_through ? new Date(record.paid_through).getTime() : 0;
    const periodEndTime = record.current_period_end ? new Date(record.current_period_end).getTime() : 0;
    if (paidThroughTime > now || periodEndTime > now) {
      return 'active';
    }
    return 'past_due';
  }

  if (record.entitlement === 'active') {
    return 'active';
  }

  return (record.entitlement as BillingState) || 'unpaid';
}

/**
 * Determines if the evaluated entitlement grants core access to the app.
 */
export function hasCoreAccess(state: BillingState): boolean {
  return state === 'trialing' || state === 'active';
}

/**
 * Maps raw provider status strings conservatively to internal states.
 */
export function mapProviderStatus(status: string | null | undefined): 'active' | 'unpaid' {
  if (!status) return 'unpaid';
  if (status.toLowerCase() === 'active') return 'active';
  return 'unpaid';
}