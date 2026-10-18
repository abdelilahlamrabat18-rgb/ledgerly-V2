import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const decoder = new TextDecoder();
const allowedTargets = ['clients', 'invoices', 'expenses', 'orders'] as const;
type Target = typeof allowedTargets[number];

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized + '='.repeat((4 - normalized.length % 4) % 4)), (character) => character.charCodeAt(0));
}
async function decrypt(ciphertext: string) {
  const keyBase64 = Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY_B64');
  if (!keyBase64) throw new Error('Google token encryption is not configured.');
  const keyBytes = Uint8Array.from(atob(keyBase64), (character) => character.charCodeAt(0));
  if (keyBytes.length !== 32) throw new Error('Google token encryption key must decode to 32 bytes.');
  const bytes = decodeBase64Url(ciphertext);
  if (bytes.length <= 12) throw new Error('Stored Google connection token is invalid.');
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  return decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12)));
}
async function googleAccessToken(refreshToken: string) {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Google OAuth client secrets are missing from Supabase.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const data = await response.json();
  if (!response.ok) {
    if (data.error === 'invalid_grant') throw new Error('Google authorization expired or was revoked. Disconnect and reconnect Google Sheets.');
    throw new Error(data.error_description || 'Unable to refresh Google authorization.');
  }
  return data.access_token as string;
}
async function googleGet(path: string, token: string) {
  const response = await fetch(`https://www.googleapis.com/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Google Sheets returned an error. Check the file permissions and try again.');
  return data;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function sheetRange(sheetName: string, lastRow: number) {
  const safeName = sheetName.replaceAll("'", "''");
  return `${encodeURIComponent(`'${safeName}'!A1:Z${lastRow}`)}`;
}
function parseAmount(value: string) {
  const cleaned = String(value || '').replace(/[$,\s]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
function parseDate(value: string) {
  const text = String(value || '').trim();
  if (!text) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const usDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (usDate) {
    const year = usDate[3].length === 2 ? `20${usDate[3]}` : usDate[3];
    return `${year}-${usDate[1].padStart(2, '0')}-${usDate[2].padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}
function requiredFields(target: Target) {
  if (target === 'clients') return ['name'];
  if (target === 'invoices') return ['invoice_number', 'amount'];
  if (target === 'expenses') return ['description', 'amount'];
  return ['product', 'total'];
}
function validateMapping(target: Target, headers: string[], mapping: Record<string, unknown>) {
  const required = requiredFields(target);
  for (const field of required) {
    const header = mapping[field];
    if (typeof header !== 'string' || !headers.includes(header)) {
      throw new Error(`Map a valid spreadsheet column to the required “${field.replaceAll('_', ' ')}” field.`);
    }
  }
  for (const header of Object.values(mapping)) {
    if (typeof header !== 'string' || !headers.includes(header)) throw new Error('A mapped spreadsheet column no longer exists. Preview the sheet again.');
  }
}
function rowValue(row: string[], headers: string[], mapping: Record<string, unknown>, field: string) {
  const header = mapping[field];
  if (typeof header !== 'string') return '';
  const index = headers.indexOf(header);
  return index < 0 ? '' : String(row[index] ?? '').trim();
}
function mapRecord(target: Target, userId: string, headers: string[], row: string[], mapping: Record<string, unknown>) {
  const get = (field: string) => rowValue(row, headers, mapping, field);
  const common = { user_id: userId };
  if (target === 'clients') {
    const name = get('name');
    return name ? { ...common, name, email: get('email') || null, phone: get('phone') || null, company: get('company') || null, address: get('address') || null, notes: get('notes') || null } : null;
  }
  if (target === 'invoices') {
    const invoiceNumber = get('invoice_number');
    const amount = parseAmount(get('amount'));
    if (!invoiceNumber || amount === null || amount < 0) return null;
    const validStatus = ['draft', 'pending', 'paid', 'overdue', 'cancelled'];
    const status = get('status').toLowerCase();
    return { ...common, invoice_number: invoiceNumber, amount, status: validStatus.includes(status) ? status : 'draft', issue_date: parseDate(get('issue_date')), due_date: get('due_date') ? parseDate(get('due_date')) : null, notes: get('notes') || null };
  }
  if (target === 'expenses') {
    const description = get('description');
    const amount = parseAmount(get('amount'));
    if (!description || amount === null || amount < 0) return null;
    return { ...common, description, category: get('category') || 'Other', amount, date: parseDate(get('date')), notes: get('notes') || null };
  }
  const product = get('product');
  const total = parseAmount(get('total'));
  if (!product || total === null || total < 0) return null;
  const quantity = parseAmount(get('quantity')) || 1;
  const validStatus = ['pending', 'processing', 'completed', 'cancelled'];
  const status = get('status').toLowerCase();
  return { ...common, product, quantity: Math.max(1, Math.floor(quantity)), total, status: validStatus.includes(status) ? status : 'pending', order_date: parseDate(get('order_date')), notes: get('notes') || null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST for Google Sheets actions.' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'You must be signed in.' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('[google-sheets] Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY function environment.');
      return json({ error: 'The Google Sheets service is not configured correctly. Contact the workspace administrator.' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Your session could not be verified. Please sign in again.' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.action !== 'string') return json({ error: 'Choose a valid Google Sheets action.' }, 400);

    if (body.action === 'disconnect') {
      const { error: secretDeleteError } = await admin.from('google_connection_secrets').delete().eq('user_id', user.id);
      if (secretDeleteError) throw new Error('Your Google authorization could not be removed. Please try again.');
      const { error: metadataDeleteError } = await admin.from('google_connections').delete().eq('user_id', user.id);
      if (metadataDeleteError) throw new Error('Your Google connection could not be removed. Please try again.');
      return json({ disconnected: true });
    }

    const { data: secret, error: secretError } = await admin.from('google_connection_secrets').select('refresh_token_ciphertext').eq('user_id', user.id).maybeSingle();
    if (secretError) throw new Error('Your Google connection could not be loaded. Please reconnect Google Sheets.');
    if (!secret) return json({ error: 'Connect Google Sheets before loading spreadsheets.' }, 400);
    const token = await googleAccessToken(await decrypt(secret.refresh_token_ciphertext));

    if (body.action === 'list-spreadsheets') {
      const result = await googleGet('drive/v3/files?pageSize=100&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime,webViewLink)&q=mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27%20and%20trashed%3Dfalse', token);
      return json({ files: result.files || [] });
    }

    if (body.action === 'list-tabs') {
      if (typeof body.spreadsheetId !== 'string' || !body.spreadsheetId.trim()) return json({ error: 'Select a spreadsheet first.' }, 400);
      const result = await googleGet(`sheets/v4/spreadsheets/${encodeURIComponent(body.spreadsheetId)}?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))`, token);
      return json({ sheets: (result.sheets || []).map((sheet: { properties: { sheetId: number; title: string; gridProperties?: { rowCount?: number; columnCount?: number } } }) => ({ id: sheet.properties.sheetId, title: sheet.properties.title, rowCount: sheet.properties.gridProperties?.rowCount, columnCount: sheet.properties.gridProperties?.columnCount })) });
    }

    if (body.action === 'preview' || body.action === 'sync') {
      if (typeof body.spreadsheetId !== 'string' || !body.spreadsheetId.trim() || typeof body.sheetName !== 'string' || !body.sheetName.trim()) {
        return json({ error: 'Select a spreadsheet and sheet tab first.' }, 400);
      }
      const isSync = body.action === 'sync';
      const range = sheetRange(body.sheetName, isSync ? 5002 : 501);
      const result = await googleGet(`sheets/v4/spreadsheets/${encodeURIComponent(body.spreadsheetId)}/values/${range}`, token);
      const values = (result.values || []) as unknown[][];
      if (!values.length || !values[0].some((value) => String(value ?? '').trim())) return json({ error: 'This sheet is empty or has no header row. Add column headers and try again.' }, 400);
      if (isSync && values.length > 5001) return json({ error: 'This sheet has more than 5,000 data rows. Split it into smaller imports for the MVP.' }, 400);
      const headers = values[0].map((value) => String(value ?? '').trim());
      if (!isSync) {
        return json({ headers, rows: values.slice(1, 21).map((row) => (row as unknown[]).map((cell) => String(cell ?? ''))), totalRows: Math.max(values.length - 1, 0) });
      }

      if (!allowedTargets.includes(body.target as Target)) return json({ error: 'Choose a supported import type.' }, 400);
      const mapping = body.mapping;
      if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return json({ error: 'Map your spreadsheet columns before importing.' }, 400);
      const target = body.target as Target;
      validateMapping(target, headers, mapping as Record<string, unknown>);
      const dataRows = values.slice(1) as unknown[][];
      const records = dataRows
        .map((row) => row.map((cell) => String(cell ?? '')))
        .filter((row) => row.some((cell) => cell.trim()))
        .map((row) => mapRecord(target, user.id, headers, row, mapping as Record<string, unknown>))
        .filter((record): record is NonNullable<typeof record> => record !== null);

      if (records.length) {
        const { error } = await admin.from(target).insert(records as never[]);
        if (error) throw new Error(`Import failed: ${error.message}`);
      }
      const { error: connectionError } = await admin.from('google_connections').update({ spreadsheet_id: body.spreadsheetId, spreadsheet_name: String(body.spreadsheetName || ''), selected_sheet: body.sheetName }).eq('user_id', user.id);
      if (connectionError) console.warn('[google-sheets] Imported data, but spreadsheet metadata was not updated:', connectionError.message);
      return json({ imported: records.length, skipped: Math.max(dataRows.length - records.length, 0) });
    }

    return json({ error: 'Unsupported Google Sheets action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process your Google Sheet.';
    console.error('[google-sheets] Request failed:', message);
    return json({ error: message }, 500);
  }
});
