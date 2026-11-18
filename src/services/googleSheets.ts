// Google Sheets backend integration has been removed in favor of client-side
// multi-format file imports (CSV/Excel/JSON) on the ingestion page.
// This module is retained as a compatibility stub for existing error-handling tests.

export function isJsonParseError(error: { message: string; name?: string }): boolean {
  if (error.name === 'SyntaxError') return true;
  return /Unexpected token|is not valid JSON|JSON\.parse|invalid json/i.test(error.message || '');
}

function nonJsonResponseMessage(status: number | undefined): string {
  return `The Google Sheets service returned an unexpected response (HTTP ${status ?? 'unknown'}). Try again, or reconnect Google if it persists.`;
}

export async function extractFunctionError(error: { message: string; name?: string; context?: unknown }) {
  if (isJsonParseError(error)) {
    return 'The Google Sheets service returned an unexpected response. Try again, or reconnect Google if it persists.';
  }
  if (error.name === 'FunctionsRelayError') {
    return 'The Google Sheets service is temporarily unavailable. Please try again later.';
  }
  if (error.name === 'FunctionsHttpError' && error.context instanceof Response) {
    const status = error.context.status;
    const contentType = error.context.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return nonJsonResponseMessage(status);
    }
    try {
      const body = await error.context.clone().json() as { error?: string; message?: string; reason?: string; domain?: string };
      const base = body.error || body.message;
      if (base) return body.reason ? `${base} (reason: ${body.reason})` : base;
    } catch {
      // fall through
    }
    return `The Google Sheets service returned an error (HTTP ${status}). Please try again.`;
  }
  if (error.name === 'FunctionsFetchError') {
    return 'Could not reach the Google Sheets service. Check your internet connection and Supabase function deployment, then try again.';
  }
  if (error.context instanceof Response) {
    const contentType = error.context.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return nonJsonResponseMessage(error.context.status);
    }
    try {
      const body = await error.context.clone().json() as { error?: string; message?: string; reason?: string; domain?: string };
      const base = body.error || body.message || error.message;
      return body.reason ? `${base} (reason: ${body.reason})` : base;
    } catch {
      // fall through
    }
  }
  return error.message || 'Google Sheets integration is not available. Use file upload to import data.';
}

export async function startGoogleConnection(): Promise<void> {
  throw new Error('Google Sheets connection is not available. Use file upload to import data.');
}

export async function disconnectGoogle(): Promise<{ disconnected: boolean }> {
  return { disconnected: true };
}


