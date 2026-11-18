import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Contract tests for file-upload ingestion (no Google URL/ID paste or Drive discovery).
 */

describe('google-sheets Edge Function (no direct URL/ID ingestion)', () => {
  const fnPath = path.resolve('supabase/functions/google-sheets/index.ts');
  const fn = fs.readFileSync(fnPath, 'utf8');

  it('does not expose list-tabs/preview or extractSpreadsheetId', () => {
    expect(fn).not.toMatch(/extractSpreadsheetId/);
    expect(fn).not.toMatch(/list-tabs/);
    expect(fn).not.toMatch(/action === 'preview'/);
  });

  it('keeps sync and disconnect actions only', () => {
    expect(fn).toMatch(/action === 'disconnect'/);
    expect(fn).toMatch(/action === 'sync'/);
    expect(fn).not.toMatch(/list-spread/);
    expect(fn).not.toMatch(/drive\/v3/);
    expect(fn).not.toMatch(/drive\.readonly/);
  });
});

describe('googleSheets service stub', () => {
  const svcPath = path.resolve('src/services/googleSheets.ts');
  const svc = fs.readFileSync(svcPath, 'utf8');

  it('does not export Google Sheets URL/ID ingestion APIs', () => {
    expect(svc).not.toMatch(/listTabs/);
    expect(svc).not.toMatch(/previewSheet/);
    expect(svc).not.toMatch(/syncSheet/);
    expect(svc).not.toMatch(/listSpreadsheets/);
  });

  it('exports compatibility error helpers', () => {
    expect(svc).toMatch(/export function isJsonParseError/);
    expect(svc).toMatch(/export async function extractFunctionError/);
  });
});

describe('GoogleSheetsPage multi-format file upload flow', () => {
  const pagePath = path.resolve('src/pages/app/GoogleSheetsPage.tsx');
  const page = fs.readFileSync(pagePath, 'utf8');

  it('does not include Google Sheet URL/ID paste flow', () => {
    expect(page).not.toMatch(/Load spreadsheet/);
    expect(page).not.toMatch(/Paste a Google Sheet URL/);
    expect(page).not.toMatch(/loadTabsFromUrl/);
    expect(page).not.toMatch(/listTabs/);
    expect(page).not.toMatch(/previewSheet/);
    expect(page).not.toMatch(/syncSheet/);
  });

  it('supports CSV, Excel, and JSON file upload', () => {
    expect(page).toMatch(/\.csv,\s*\.xlsx,\s*\.xls,\s*\.json/);
    expect(page).toMatch(/XLSX/);
    expect(page).toMatch(/parseJson/);
    expect(page).toMatch(/handleFile/);
  });

  it('redirects to dashboard after successful import', () => {
    expect(page).toMatch(/navigate\('\/app\/dashboard'\)/);
  });

  it('does not expose tokens or use Drive discovery/picker', () => {
    expect(page).not.toMatch(/access[_-]?token/i);
    expect(page).not.toMatch(/refresh[_-]?token/i);
    expect(page).not.toMatch(/client[_-]?secret/i);
    expect(page).not.toMatch(/gapi\.picker/);
    expect(page).not.toMatch(/drive\.readonly/);
  });
});

