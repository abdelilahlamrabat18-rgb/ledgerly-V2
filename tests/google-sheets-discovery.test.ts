import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * These tests pin the contract for the post-OAuth spreadsheet discovery flow.
 * They are source-level assertions because the project has no DOM testing
 * environment (jsdom / @testing-library are not installed).
 */

describe('google-sheets list-spreadsheets action', () => {
  const fnPath = path.resolve('supabase/functions/google-sheets/index.ts');
  const fn = fs.readFileSync(fnPath, 'utf8');

  it('supports pagination via an optional pageToken parameter', () => {
    expect(fn).toMatch(/pageToken/);
    expect(fn).toMatch(/nextPageToken/);
  });

  it('filters for Google Sheets MIME type and excludes trashed files', () => {
    expect(fn).toMatch(/mimeType='application\/vnd\.google-apps\.spreadsheet'/);
    expect(fn).toMatch(/trashed=false/);
  });

  it('returns the connected email from google_connections', () => {
    expect(fn).toMatch(/connected_email/);
    expect(fn).toMatch(/connectedEmail/);
  });

  it('returns nextPageToken in the response payload', () => {
    expect(fn).toMatch(/nextPageToken: result\.nextPageToken/);
  });
});

describe('googleSheets service listSpreadsheets signature', () => {
  const svcPath = path.resolve('src/services/googleSheets.ts');
  const svc = fs.readFileSync(svcPath, 'utf8');

  it('accepts an optional pageToken argument', () => {
    expect(svc).toMatch(/listSpreadsheets\s*=\s*\(pageToken\?:\s*string\)/);
  });

  it('passes pageToken to the backend when provided', () => {
    expect(svc).toMatch(/pageToken \?\s*\{ pageToken \}\s*: \{\}/);
  });

  it('returns SpreadsheetListResult with files, nextPageToken, and connectedEmail', () => {
    expect(svc).toMatch(/SpreadsheetListResult/);
  });
});

describe('GoogleSheetsPage post-OAuth flow', () => {
  const pagePath = path.resolve('src/pages/app/GoogleSheetsPage.tsx');
  const page = fs.readFileSync(pagePath, 'utf8');

  it('consumes the connected=true query parameter', () => {
    expect(page).toMatch(/connected === 'true'/);
  });

  it('consumes OAuth error query parameters', () => {
    expect(page).toMatch(/oauthError/);
  });

  it('removes the query parameter after consuming it', () => {
    expect(page).toMatch(/navigate\('\/app\/google-sheets', \{ replace: true \}\)/);
  });

  it('displays the connected account email', () => {
    expect(page).toMatch(/connectedEmail/);
  });

  it('displays an empty state when no spreadsheets are found', () => {
    expect(page).toMatch(/No Google Sheets spreadsheets found/);
  });

  it('displays a loading state while fetching', () => {
    expect(page).toMatch(/Loading spreadsheets/);
  });

  it('renders each spreadsheet as a selectable item', () => {
    expect(page).toMatch(/selectSpreadsheet/);
    expect(page).toMatch(/selectedId/);
  });

  it('supports loading more pages when nextPageToken is present', () => {
    expect(page).toMatch(/nextPageToken/);
    expect(page).toMatch(/Load more/);
  });

  it('does not expose access tokens or refresh tokens to the UI', () => {
    expect(page).not.toMatch(/access[_-]?token/i);
    expect(page).not.toMatch(/refresh[_-]?token/i);
    expect(page).not.toMatch(/client[_-]?secret/i);
  });
});