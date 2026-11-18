import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('google-sheets Edge Function (sync-only, no URL/ID ingestion)', () => {
  const fnPath = path.resolve('supabase/functions/google-sheets/index.ts');
  const fn = fs.readFileSync(fnPath, 'utf8');

  it('uses Sheets API base URL only', () => {
    expect(fn).toMatch(/https:\/\/sheets\.googleapis\.com\/\$\{path\}/);
    expect(fn).not.toMatch(/www\.googleapis\.com\/drive/);
    expect(fn).not.toMatch(/drive\/v3/);
  });

  it('supports sync action and reads values via Sheets API', () => {
    expect(fn).toMatch(/body\.action === 'sync'/);
    expect(fn).toMatch(/v4\/spreadsheets\/\$\{encodeURIComponent\(spreadsheetId\)\}\/values\/\$\{range\}/);
  });

  it('enforces 5,000-row sync cap', () => {
    expect(fn).toMatch(/more than 5,000 data rows/);
  });

  it('does not implement URL/ID paste ingestion or Drive discovery', () => {
    expect(fn).not.toMatch(/extractSpreadsheetId/);
    expect(fn).not.toMatch(/list-tabs/);
    expect(fn).not.toMatch(/action === 'preview'/);
    expect(fn).not.toMatch(/list-spread/);
  });
});


