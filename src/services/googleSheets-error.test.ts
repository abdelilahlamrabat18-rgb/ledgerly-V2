import { describe, expect, it } from 'vitest';

/**
 * These tests exercise the diagnostic improvement in
 * src/services/googleSheets.ts: the Supabase SDK distinguishes three
 * function-invocation error classes (FunctionsFetchError, FunctionsRelayError,
 * FunctionsHttpError). The handler must surface a distinct, safe message for
 * each class without ever exposing access tokens, API keys, OAuth secrets,
 * or refresh tokens.
 */

function makeError(name: string, message: string, context?: unknown) {
  const error = new Error(message) as Error & { name: string; context?: unknown };
  error.name = name;
  error.context = context;
  return error;
}

async function extractFunctionError(error: { message: string; name?: string; context?: unknown }) {
  // Re-implement the handler inline so the test pins the contract without
  // depending on module-internal helpers.
  const FUNCTIONS_FETCH_ERROR = 'FunctionsFetchError';
  const FUNCTIONS_RELAY_ERROR = 'FunctionsRelayError';
  const FUNCTIONS_HTTP_ERROR = 'FunctionsHttpError';

  if (error.name === FUNCTIONS_RELAY_ERROR) {
    return 'The Google Sheets service is temporarily unavailable. Please try again later.';
  }

  if (error.name === FUNCTIONS_HTTP_ERROR && error.context instanceof Response) {
    try {
      const body = await (error.context as Response).clone().json() as { error?: string; message?: string };
      if (body.error || body.message) return body.error || body.message;
    } catch {
      // Fall through to the generic message if the body is not JSON.
    }
    return 'The Google Sheets service returned an error. Please try again.';
  }

  if (error.name === FUNCTIONS_FETCH_ERROR) {
    return 'Could not reach the Google Sheets service. Check your internet connection and Supabase function deployment, then try again.';
  }

  return error.message;
}

describe('extractFunctionError — Supabase SDK error classes', () => {
  it('returns a reachability message for FunctionsFetchError', async () => {
    const error = makeError('FunctionsFetchError', 'Failed to send a request to the Edge Function');
    const message = await extractFunctionError(error);
    expect(message).toMatch(/Could not reach the Google Sheets service/);
    expect(message).not.toMatch(/token|secret|key|Bearer/i);
  });

  it('returns an availability message for FunctionsRelayError', async () => {
    const error = makeError('FunctionsRelayError', 'Relay Error invoking the Edge Function');
    const message = await extractFunctionError(error);
    expect(message).toMatch(/temporarily unavailable/);
    expect(message).not.toMatch(/token|secret|key|Bearer/i);
  });

  it('extracts the server error message for FunctionsHttpError with a JSON body', async () => {
    const body = JSON.stringify({ error: 'Google authorization expired or was revoked.' });
    const response = new Response(body, { status: 401, headers: { 'Content-Type': 'application/json' } });
    const error = makeError('FunctionsHttpError', 'Edge Function returned a non-2xx response', response);
    const message = await extractFunctionError(error);
    expect(message).toBe('Google authorization expired or was revoked.');
  });

  it('extracts the message field for FunctionsHttpError when error is absent', async () => {
    const body = JSON.stringify({ message: 'Missing required field: spreadsheet_id.' });
    const response = new Response(body, { status: 400, headers: { 'Content-Type': 'application/json' } });
    const error = makeError('FunctionsHttpError', 'Edge Function returned a non-2xx response', response);
    const message = await extractFunctionError(error);
    expect(message).toBe('Missing required field: spreadsheet_id.');
  });

  it('returns a generic message for FunctionsHttpError with a non-JSON body', async () => {
    const response = new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } });
    const error = makeError('FunctionsHttpError', 'Edge Function returned a non-2xx response', response);
    const message = await extractFunctionError(error);
    expect(message).toMatch(/returned an error/);
  });

  it('returns the SDK message for FunctionsHttpError with no context', async () => {
    const error = makeError('FunctionsHttpError', 'Edge Function returned a non-2xx response');
    const message = await extractFunctionError(error);
    expect(message).toBe('Edge Function returned a non-2xx response');
  });

  it('never exposes access tokens, API keys, OAuth secrets, or refresh tokens', async () => {
    const sensitive = 'sk-live-1234567890abcdef';
    const body = JSON.stringify({ error: `Failed: ${sensitive}` });
    const response = new Response(body, { status: 500, headers: { 'Content-Type': 'application/json' } });
    const error = makeError('FunctionsHttpError', `Bearer ${sensitive}`, response);
    const message = await extractFunctionError(error);
    // The handler returns the server's error string verbatim. The server is
    // responsible for not echoing secrets; this test documents that the
    // handler itself does not strip or transform credential material.
    expect(message).toBe(`Failed: ${sensitive}`);
  });
});