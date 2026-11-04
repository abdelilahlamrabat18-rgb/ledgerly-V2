import { supabase, isSupabaseConfigured, getSupabaseConfigurationIssue } from '../lib/supabase';
import { userFacingError } from '../lib/errors';
import type { SheetPreview, SpreadsheetFile, SpreadsheetListResult, SpreadsheetTab } from '../types';

/**
 * Supabase SDK function-invocation error class names. The SDK distinguishes
 * three failure modes; the previous handler collapsed all of them into a
 * single generic message, so callers could not tell whether the function was
 * unreachable, unavailable, or returned an error body.
 */
const FUNCTIONS_FETCH_ERROR = 'FunctionsFetchError';
const FUNCTIONS_RELAY_ERROR = 'FunctionsRelayError';
const FUNCTIONS_HTTP_ERROR = 'FunctionsHttpError';

/**
 * Extract a safe, human-readable message from a Supabase Edge Function
 * invocation error. Never exposes access tokens, API keys, OAuth secrets,
 * refresh tokens, or other credential material — only the server's own
 * error string or a generic reachability message.
 */
async function extractFunctionError(error: { message: string; name?: string; context?: unknown }) {
  if (error.name === FUNCTIONS_RELAY_ERROR) {
    return 'The Google Sheets service is temporarily unavailable. Please try again later.';
  }

  if (error.name === FUNCTIONS_HTTP_ERROR && error.context instanceof Response) {
    try {
      const body = await error.context.clone().json() as { error?: string; message?: string };
      if (body.error || body.message) return body.error || body.message;
    } catch {
      // Fall through to the generic message if the body is not JSON.
    }
    return 'The Google Sheets service returned an error. Please try again.';
  }

  if (error.name === FUNCTIONS_FETCH_ERROR) {
    return 'Could not reach the Google Sheets service. Check your internet connection and Supabase function deployment, then try again.';
  }

  // Existing behaviour for unrelated errors (network, timeout, etc.).
  if (error.context instanceof Response) {
    try {
      const body = await error.context.clone().json() as { error?: string; message?: string };
      if (body.error || body.message) return body.error || body.message || error.message;
    } catch {
      // Keep the SDK's message if an edge response is not JSON.
    }
  }
  return userFacingError(error);
}

export async function invokeGoogle<T>(body: Record<string, unknown>): Promise<T> {
  const configIssue = getSupabaseConfigurationIssue();
  if (!isSupabaseConfigured || configIssue) throw new Error(configIssue || 'Supabase is not configured.');
  try {
    const { data, error } = await supabase.functions.invoke('google-sheets', { body });
    if (error) throw new Error(await extractFunctionError(error));
    if (data?.error) throw new Error(String(data.error));
    return data as T;
  } catch (error) {
    throw new Error(userFacingError(error));
  }
}

export async function startGoogleConnection() {
  const configIssue = getSupabaseConfigurationIssue();
  if (!isSupabaseConfigured || configIssue) throw new Error(configIssue || 'Supabase is not configured.');
  try {
    const { data, error } = await supabase.functions.invoke('google-oauth-start', { body: {} });
    if (error) throw new Error(await extractFunctionError(error));
    if (data?.error) throw new Error(String(data.error));
    if (!data?.url || typeof data.url !== 'string') {
      throw new Error('Google authorization is not configured. Verify the OAuth client, redirect URI, and Supabase function secrets.');
    }
    window.location.assign(data.url);
  } catch (error) {
    throw new Error(userFacingError(error));
  }
}

export const disconnectGoogle = () => invokeGoogle<{ disconnected: boolean }>({ action: 'disconnect' });
export const listSpreadsheets = (pageToken?: string) => invokeGoogle<SpreadsheetListResult>({ action: 'list-spreadsheets', ...(pageToken ? { pageToken } : {}) });
export const listTabs = (spreadsheetId: string) => invokeGoogle<{ sheets: SpreadsheetTab[] }>({ action: 'list-tabs', spreadsheetId });
export const previewSheet = (spreadsheetId: string, sheetName: string) => invokeGoogle<SheetPreview>({ action: 'preview', spreadsheetId, sheetName });
export const syncSheet = (payload: { spreadsheetId: string; spreadsheetName: string; sheetName: string; target: string; mapping: Record<string, string> }) => invokeGoogle<{ imported: number; skipped?: number }>({ action: 'sync', ...payload });
