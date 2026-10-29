/**
 * Ledgerly billing entitlement engine.
 *
 * This module is deliberately provider-agnostic. It decides whether a user
 * may access core Ledgerly features based ONLY on trusted server-side data.
 *
 * It never inspects browser state, query parameters, or client-supplied flags.
 * All inputs are rows returned by a trusted server path (Edge Function using
 * the service role, or the authenticated user's own read-only projection).
 */

export type Entitlement =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'unpaid'
  | 'no_provider';

export interface BillingRecord {
  entitlement: Entitlement;
  provider?: string | null;
  provider_status?: string | null;
  trial_end?: string | null;
  current_period_end?: string | null;
  paid_through?: string | null;
}

/**
 * Safe read-only projection returned to the browser by the billing-state
 * Edge Function. Provider identifiers and internal mutation fields are
 * deliberately excluded.
 */
export interface BillingTrial {
  userId: string;
  entitlement: Entitlement;
  plan: string;
  planPriceCents: number;
  currency: string;
  trialStart: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  paidThrough: string | null;
  provider: string;
  created?: boolean;
}

export interface BillingState {
  ok: boolean;
  trial: BillingTrial | null;
  error?: string;
}

const NOW = (): number => Date.now();

/**
 * Compare a UTC ISO timestamp to the current time.
 * Returns negative if the timestamp is in the past, positive if in the future.
 */
function msUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed - NOW() : null;
}

/**
 * Policy for past-due subscriptions, stated explicitly rather than left to
 * accidental behavior:
 *
 *   A past-due subscription keeps core-feature access until the provider
 *   confirms a paid-through end date that has already passed. If the provider
 *   has not supplied a paid-through date, access continues until the current
 *   billing period ends. After that, the entitlement degrades to 'unpaid'.
 *
 * This is a conservative policy: it never cuts off a user the provider has
 * confirmed is still paid for.
 */
export function evaluateEntitlement(record: BillingRecord | null | undefined): Entitlement {
  if (!record || !record.entitlement) return 'no_provider';

  const current = record.entitlement;

  switch (current) {
    case 'trialing': {
      const remaining = msUntil(record.trial_end);
      if (remaining === null) return 'expired';
      return remaining > 0 ? 'trialing' : 'expired';
    }
    case 'active':
      return 'active';
    case 'past_due': {
      const paidThrough = msUntil(record.paid_through);
      if (paidThrough !== null && paidThrough > 0) return 'past_due';
      const periodEnd = msUntil(record.current_period_end);
      if (periodEnd !== null && periodEnd > 0) return 'past_due';
      return 'unpaid';
    }
    case 'cancelled': {
      const paidThrough = msUntil(record.paid_through);
      if (paidThrough !== null && paidThrough > 0) return 'cancelled';
      return 'expired';
    }
    case 'expired':
    case 'unpaid':
    case 'no_provider':
    default:
      return current;
  }
}

/**
 * Determines whether the current entitlement grants client-side navigation
 * to core Ledgerly features.
 *
 * 'no_provider' is intentionally included so route guards do not lock the
 * UI during development or before a billing row exists. This is a NAVIGATION
 * convenience only: it does NOT grant server-side entitlement, and the
 * Google Sheets Edge Function enforces its own independent check that
 * rejects 'no_provider' (see supabase/functions/google-sheets/index.ts).
 */
export function hasCoreAccess(entitlement: Entitlement | string): boolean {
  return (
    entitlement === 'trialing' ||
    entitlement === 'active' ||
    entitlement === 'no_provider'
  );
}

export function isTrialing(entitlement: Entitlement): boolean {
  return entitlement === 'trialing';
}

export function isPaid(entitlement: Entitlement): boolean {
  return entitlement === 'active' || entitlement === 'past_due';
}

/**
 * Map a provider-reported status string to an internal entitlement.
 * Unknown provider statuses are treated conservatively as 'unpaid' so that
 * a malformed webhook can never accidentally grant access.
 */
export function mapProviderStatus(status: string | null | undefined): Entitlement {
  const normalized = (status || '').trim().toLowerCase();
  switch (normalized) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
    case 'pastdue':
      return 'past_due';
    case 'cancelled':
      return 'cancelled';
    case 'expired':
      return 'expired';
    case 'unpaid':
    case 'failed_payment':
    case 'payment_failed':
      return 'unpaid';
    default:
      return 'unpaid';
  }
}