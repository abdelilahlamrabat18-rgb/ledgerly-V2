import { supabase, isSupabaseConfigured, getSupabaseConfigurationIssue } from '../lib/supabase';
import { userFacingError } from '../lib/errors';
import type { SheetPreview, SpreadsheetFile, SpreadsheetTab } from '../types';

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
export const listSpreadsheets = () => invokeGoogle<{ files: SpreadsheetFile[] }>({ action: 'list-spreadsheets' });
export const listTabs = (spreadsheetId: string) => invokeGoogle<{ sheets: SpreadsheetTab[] }>({ action: 'list-tabs', spreadsheetId });
export const previewSheet = (spreadsheetId: string, sheetName: string) => invokeGoogle<SheetPreview>({ action: 'preview', spreadsheetId, sheetName });
export const syncSheet = (payload: { spreadsheetId: string; spreadsheetName: string; sheetName: string; target: string; mapping: Record<string, string> }) => invokeGoogle<{ imported: number; skipped?: number }>({ action: 'sync', ...payload });
