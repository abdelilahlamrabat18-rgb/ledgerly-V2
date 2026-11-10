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
 * Detects a raw JSON.parse SyntaxError. The Supabase SDK
 * (@supabase/functions-js 2.114.0) calls response.json() directly when an Edge
 * Function returns 200 with Content-Type application/json but a non-JSON body
 * (for example an HTML gateway or "function not found" page). That raw
 * SyntaxError has name "SyntaxError", which previously fell through every
 * named-class branch below and reached the UI verbatim.
 *
 * This helper is exported so the production handler can be unit-tested
 * directly instead of requiring a copy of its logic in the test file.
 */
export function isJsonParseError(error: { message: string; name?: string }): boolean {
  if (error.name === 'SyntaxError') return true;
  return /Unexpected token|is not valid JSON|JSON\.parse|invalid json/i.test(error.message || '');
}

function nonJsonResponseMessage(status: number | undefined): string {
  return `The Google Sheets service returned an unexpected response (HTTP ${status ?? 'unknown'}). Try again, or reconnect Google if it persists.`;
}

/**
 * Extract a safe, human-readable message from a Supabase Edge Function
 * invocation error. Never exposes access tokens, API keys, OAuth secrets,
 * refresh tokens, HTML bodies, or stack traces — only the server's own error
 * string or a generic reachability message.
 *
 * Preserves useful messages for: unreachable function, temporarily
 * unavailable relay, JSON error bodies (auth/entitlement/Google API), and
 * network/timeout errors.
 */
export async function extractFunctionError(error: { message: string; name?: string; context?: unknown }) {
  // Raw JSON.parse SyntaxError (SDK bug case): never leak the parse text.
  if (isJsonParseError(error)) {
    return 'The Google Sheets service returned an unexpected response. Try again, or reconnect Google if it persists.';
  }

  if (error.name === FUNCTIONS_RELAY_ERROR) {
    return 'The Google Sheets service is temporarily unavailable. Please try again later.';
  }

  if (error.name === FUNCTIONS_HTTP_ERROR && error.context instanceof Response) {
    const status = error.context.status;
    const contentType = error.context.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return nonJsonResponseMessage(status);
    }
    try {
      const body = await error.context.clone().json() as { error?: string; message?: string };
      if (body.error || body.message) return body.error || body.message;
    } catch {
      // Fall through to the generic message if the body is not JSON.
    }
    return `The Google Sheets service returned an error (HTTP ${status}). Please try again.`;
  }

  if (error.name === FUNCTIONS_FETCH_ERROR) {
    return 'Could not reach the Google Sheets service. Check your internet connection and Supabase function deployment, then try again.';
  }

  // Existing behaviour for unrelated errors (network, timeout, etc.).
  if (error.context instanceof Response) {
    const contentType = (error.context as Response).headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return nonJsonResponseMessage((error.context as Response).status);
    }
    try {
      const body = await (error.context as Response).clone().json() as { error?: string; message?: string };
      if (body.error || body.message) return body.error || body.message || error.message;
    } catch {
      // Keep the SDK's message if an edge response is not JSON.
    }
  }
  return userFacingError(error);
}

export async function invokeGoogle<T>(body: Record<string, unknown>): Promise<T> {
  const configIssue = getSupabaseConfigurationIssue();
  console.log('[ledgerly][diag] invokeGoogle config:', { isSupabaseConfigured, configIssue });
  if (!isSupabaseConfigured || configIssue) throw new Error(configIssue || 'Supabase is not configured.');
  console.log('[ledgerly][diag] invokeGoogle calling functions.invoke:', { action: body.action });
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
