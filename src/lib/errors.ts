const NETWORK_MESSAGE = 'Unable to reach Ledgerly services. Check your internet connection or Supabase project status, then try again.';

export function userFacingError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message || '';
    if (error.name === 'AbortError' || /timeout|timed out/i.test(message)) return 'The request timed out. Please try again.';
    if (/failed to fetch|network|fetch failed|load failed|connection refused/i.test(message)) return NETWORK_MESSAGE;
    return message || 'Something went wrong. Please try again.';
  }
  if (typeof error === 'string' && error.trim()) {
    if (/failed to fetch|network|fetch failed|load failed|connection refused/i.test(error)) return NETWORK_MESSAGE;
    return error;
  }
  return 'Something went wrong. Please try again.';
}
