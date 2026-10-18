import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { userFacingError } from './errors';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
const validatedSupabaseUrl = (() => {
  if (!rawSupabaseUrl) return null;
  try {
    const parsed = new URL(rawSupabaseUrl);
    const localHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !localHttp) return null;
    if (['placeholder.supabase.co', 'your-project.supabase.co'].includes(parsed.hostname)) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
})();

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
export const isSupabaseConfigured = Boolean(validatedSupabaseUrl && supabaseAnonKey && !supabaseAnonKey.startsWith('your-'));

export function getSupabaseConfigurationIssue(): string | null {
  if (!rawSupabaseUrl || !supabaseAnonKey) return 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.';
  if (!validatedSupabaseUrl) return 'VITE_SUPABASE_URL must be a valid HTTPS Supabase project URL (HTTP is allowed for localhost).';
  if (supabaseAnonKey.startsWith('your-')) return 'Replace the placeholder VITE_SUPABASE_ANON_KEY with your project’s public anon key.';
  return null;
}

const networkAwareFetch: typeof fetch = async (input, init) => {
  try {
    const signal = init?.signal ?? AbortSignal.timeout(15_000);
    return await fetch(input, { ...init, signal });
  } catch (error) {
    throw new Error(userFacingError(error));
  }
};

// Only a public anon key is used in the browser. The service-role key and Google
// OAuth secrets are configured only as Supabase Edge Function secrets.
export const supabase = createClient<Database>(
  validatedSupabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey && !supabaseAnonKey.startsWith('your-') ? supabaseAnonKey : 'placeholder-anon-key',
  {
    global: { fetch: networkAwareFetch },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);
