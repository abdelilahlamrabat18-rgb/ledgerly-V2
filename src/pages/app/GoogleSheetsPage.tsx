import { supabase } from '../../lib/supabase';
import type { GoogleConnection, SheetPreview, SpreadsheetFile, SpreadsheetTab } from '../../types';

export async function startGoogleConnection(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  const { data, error } = await supabase.functions.invoke('google-oauth-start', {
    headers: {
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
  });

  if (error) {
    console.error('google-oauth-start function error:', error);
    throw new Error(error.message || 'Failed to initialize Google OAuth');
  }

  if (data?.url) {
    window.location.href = data.url;
  } else {
    throw new Error('No authorization URL returned from google-oauth-start');
  }
}

export async function listSpreadsheets(): Promise<{ files: SpreadsheetFile[] }> {
  const { data, error } = await supabase.functions.invoke('google-sheets-api', {
    body: { action: 'list_files' },
  });
  if (error) throw error;
  return data;
}

export async function listTabs(spreadsheetId: string): Promise<{ sheets: SpreadsheetTab[] }> {
  const { data, error } = await supabase.functions.invoke('google-sheets-api', {
    body: { action: 'list_tabs', spreadsheetId },
  });
  if (error) throw error;
  return data;
}

export async function previewSheet(spreadsheetId: string, sheetName: string): Promise<SheetPreview> {
  const { data, error } = await supabase.functions.invoke('google-sheets-api', {
    body: { action: 'preview', spreadsheetId, sheetName },
  });
  if (error) throw error;
  return data;
}

export async function syncSheet(payload: {
  spreadsheetId: string;
  spreadsheetName: string;
  sheetName: string;
  target: string;
  mapping: Record<string, string>;
}): Promise<{ imported: number; skipped: number }> {
  const { data, error } = await supabase.functions.invoke('google-sheets-api', {
    body: { action: 'sync', ...payload },
  });
  if (error) throw error;
  return data;
}

export async function disconnectGoogle(): Promise<void> {
  const { error } = await supabase.functions.invoke('google-oauth-disconnect');
  if (error) throw error;
}