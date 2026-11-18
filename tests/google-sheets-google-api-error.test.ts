import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Focused tests for Google API error handling in the Edge Function sync action.
 */

const fnPath = path.resolve('supabase/functions/google-sheets/index.ts');
const fn = fs.readFileSync(fnPath, 'utf8');

describe('googleGet preserves Google error fields', () => {
  it('extracts error.message from the parsed Google response', () => {
    expect(fn).toMatch(/googleError\?\.message/);
  });

  it('extracts the first error reason and domain', () => {
    expect(fn).toMatch(/\[0\]\?\.reason/);
    expect(fn).toMatch(/\[0\]\?\.domain/);
  });

  it('attaches status/reason/domain to the thrown error', () => {
    expect(fn).toMatch(/\.status = response\.status/);
    expect(fn).toMatch(/\.reason = googleReason/);
    expect(fn).toMatch(/\.domain = googleDomain/);
  });
});

describe('outer catch block logs and returns diagnostic fields', () => {
  it('logs status, reason, and domain', () => {
    expect(fn).toMatch(/reason: errorReason/);
    expect(fn).toMatch(/domain: errorDomain/);
  });

  it('returns reason and domain in JSON response body', () => {
    expect(fn).toMatch(/reason: errorReason, domain: errorDomain/);
  });

  it('does not log secrets', () => {
    expect(fn).not.toMatch(/console\.(log|error|debug)\([^)]*(?:access_token|refresh_token|client_secret|GOOGLE_CLIENT)/i);
  });
});
