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

async function invokeBilling<T>(body: Record<string, unknown>): Promise<T> {
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
  return invokeBilling<BillingState>({ action: 'read' });
}

export async function startTrialOnce(): Promise<BillingState> {
  return invokeBilling<BillingState>({ action: 'start-trial' });
}

export function isProviderConfigured(): boolean {
  // Provider configuration lives in Supabase Edge Function secrets, not the
  // browser. The absence of a configured provider is reported by the server
  // response, so this helper is intentionally conservative.
  return false;
}

export type { Entitlement };