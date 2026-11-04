import { supabase, isSupabaseConfigured, getSupabaseConfigurationIssue } from '../lib/supabase';
import { userFacingError } from '../lib/errors';
import type { Entitlement, BillingState } from '../lib/billing';

async function extractFunctionError(error: { message: string; context?: unknown }) {
  const context = error.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as { error?: string; message?: string };
      if (body.error || body.message) return body.error || body.message || error.message;
    } catch {
      // Keep the SDK's message if an edge response is not JSON.
    }
  }
  return userFacingError(error);
}

async function invokeBilling<T extends Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const configIssue = getSupabaseConfigurationIssue();
  if (!isSupabaseConfigured || configIssue) throw new Error(configIssue || 'Supabase is not configured.');
  try {
    const { data, error } = await supabase.functions.invoke('billing-state', { body });
    if (error) throw new Error(await extractFunctionError(error));
    if (data?.error) throw new Error(String(data.error));
    return data as T;
  } catch (error) {
    throw new Error(userFacingError(error));
  }
}

export async function fetchBillingState(): Promise<BillingState> {
  const raw = await invokeBilling<Record<string, unknown>>({ action: 'read' });
  return normalizeBillingState(raw);
}

export async function startTrialOnce(): Promise<BillingState> {
  const raw = await invokeBilling<Record<string, unknown>>({ action: 'start-trial' });
  return normalizeBillingState(raw);
}

function normalizeBillingState(raw: Record<string, unknown>): BillingState {
  const trial = raw.trial as BillingState['trial'] | undefined;
  return {
    ok: raw.ok === true,
    providerApiKeyPresent: raw.providerApiKeyPresent === true,
    trial: trial ?? null,
    error: typeof raw.error === 'string' ? raw.error : undefined,
  };
}

export type { Entitlement };