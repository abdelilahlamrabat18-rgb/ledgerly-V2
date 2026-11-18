import { describe, expect, it } from 'vitest';
import { extractFunctionError, isJsonParseError } from '../src/services/googleSheets';

/**
 * These tests exercise the ACTUAL production error-handling function in
 * src/services/googleSheets.ts. They do not re-implement its logic.
 *
 * The Supabase SDK (@supabase/functions-js 2.114.0) calls response.json()
 * directly when an Edge Function returns 200 with Content-Type
 * application/json but a non-JSON body (e.g. an HTML gateway page). That raw
 * SyntaxError has name "SyntaxError", which previously fell through every
 * named-class branch and reached the UI verbatim as
 * "Unexpected token '<' ... is not valid JSON".
 */

function makeError(name: string, message: string, context?: unknown) {
  const error = new Error(message) as Error & { name: string; context?: unknown };
  error.name = name;
  error.context = context;
  return error;
}

describe('isJsonParseError (production helper)', () => {
  it('matches a SyntaxError-named error', () => {
    expect(isJsonParseError(makeError('SyntaxError', 'Unexpected token'))).toBe(true);
  });

it('matches messages mentioning invalid JSON', () => {
    expect(isJsonParseError(makeError('Error', "Unexpected token '<', \"<!DOCTYPE html>\" is not valid JSON"))).toBe(true);
    expect(isJsonParseError(makeError('Error', 'Parse error: "<html>..." is not valid JSON at line 1'))).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isJsonParseError(makeError('Error', 'Network request failed'))).toBe(false);
    expect(isJsonParseError(makeError('FunctionsHttpError', 'Edge Function returned a non-2xx response'))).toBe(false);
  });
});

describe('extractFunctionError (production handler)', () => {
  it('converts a raw SyntaxError from response.json() into a safe message', async () => {
    const error = makeError('SyntaxError', "Unexpected token '<', \"<!DOCTYPE html>\" is not valid JSON");
    const message = await extractFunctionError(error);
    expect(message).toMatch(/unexpected response/);
    expect(message).not.toMatch(/<!DOCTYPE|Unexpected token|valid JSON/);
    expect(message).not.toMatch(/token|secret|key|Bearer/i);
  });

  it('converts a SyntaxError-named error with a different message', async () => {
    const error = makeError('SyntaxError', 'Unexpected end of JSON input');
    const message = await extractFunctionError(error);
    expect(message).toMatch(/unexpected response/);
    expect(message).not.toMatch(/Unexpected end/);
  });

  it('converts a non-SyntaxError message that mentions invalid JSON', async () => {
    const error = makeError('Error', 'Parse error: "<html>..." is not valid JSON at line 1');
    const message = await extractFunctionError(error);
    expect(message).toMatch(/unexpected response/);
    expect(message).not.toMatch(/Parse error/);
  });

  it('returns an HTTP-specific message for a non-JSON 5xx body', async () => {
    const response = new Response('<!DOCTYPE html><html>502 Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } });
    const error = makeError('FunctionsHttpError', 'Edge Function returned a non-2xx response', response);
    const message = await extractFunctionError(error);
    expect(message).toMatch(/HTTP 502/);
    expect(message).not.toMatch(/<!DOCTYPE/);
  });

  it('returns a generic message for a non-JSON 2xx body (the SDK bug case)', async () => {
    const response = new Response('<!DOCTYPE html><html>Not Found</html>', { status: 200, headers: { 'Content-Type': 'application/json' } });
    const error = makeError('SyntaxError', "Unexpected token '<', \"<!DOCTYPE html>\" is not valid JSON", response);
    const message = await extractFunctionError(error);
    expect(message).toMatch(/unexpected response/);
    expect(message).not.toMatch(/<!DOCTYPE|Unexpected token/);
  });

  it('still extracts the server error for a JSON 4xx body', async () => {
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

it('returns an HTTP-specific message for a non-JSON 5xx body', async () => {
    const response = new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } });
    const error = makeError('FunctionsHttpError', 'Edge Function returned a non-2xx response', response);
    const message = await extractFunctionError(error);
    expect(message).toMatch(/HTTP 500/);
    expect(message).not.toMatch(/Internal Server Error/);
  });

  it('still returns the reachability message for FunctionsFetchError', async () => {
    const error = makeError('FunctionsFetchError', 'Failed to send a request to the Edge Function');
    const message = await extractFunctionError(error);
    expect(message).toMatch(/Could not reach the Google Sheets service/);
  });

  it('still returns the availability message for FunctionsRelayError', async () => {
    const error = makeError('FunctionsRelayError', 'Relay Error invoking the Edge Function');
    const message = await extractFunctionError(error);
    expect(message).toMatch(/temporarily unavailable/);
  });

  it('never exposes access tokens, API keys, OAuth secrets, or refresh tokens', async () => {
    const sensitive = 'sk-live-1234567890abcdef';
    const error = makeError('SyntaxError', `Unexpected token '<', "${sensitive}" is not valid JSON`);
    const message = await extractFunctionError(error);
    expect(message).not.toMatch(sensitive);
    expect(message).not.toMatch(/token|secret|key|Bearer/i);
  });
});
