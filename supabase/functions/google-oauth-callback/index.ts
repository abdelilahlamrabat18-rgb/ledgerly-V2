import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
function encodeBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function verifyState(state: string, secret: string) {
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, decodeBase64Url(signature), encoder.encode(encoded));
}
async function encryptToken(value: string, keyBase64: string) {
  const keyBytes = Uint8Array.from(atob(keyBase64), (character) => character.charCodeAt(0));
  if (keyBytes.length !== 32) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY_B64 must decode to exactly 32 bytes.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value)));
  const output = new Uint8Array(iv.length + ciphertext.length);
  output.set(iv);
  output.set(ciphertext, iv.length);
  return encodeBase64Url(output);
}
function json(message: string, status: number) {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
function safeRedirect(appUrl: string, returnTo: string | undefined, errorCode?: string, connected = false) {
  const configured = new URL(appUrl);
  const target = returnTo ? new URL(returnTo) : new URL('/app/google-sheets', configured.origin);
  if (target.origin !== configured.origin) throw new Error('OAuth return URL does not match APP_URL.');
  if (errorCode) target.searchParams.set('error', errorCode);
  if (connected) target.searchParams.set('connected', 'true');
  return Response.redirect(target.toString(), 302);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const appUrl = Deno.env.get('APP_URL');
  if (!appUrl) {
    console.error('[google-oauth-callback] APP_URL is not configured.');
    return json('Google OAuth is misconfigured: APP_URL is missing in Supabase function secrets.', 500);
  }

  let returnTo: string | undefined;
  try {
    const appOrigin = new URL(appUrl).origin;
    returnTo = new URL('/app/google-sheets', appOrigin).toString();
    const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_STATE_SECRET', 'GOOGLE_TOKEN_ENCRYPTION_KEY_B64'];
    const missing = required.filter((name) => !Deno.env.get(name)?.trim());
    if (missing.length) {
      console.error(`[google-oauth-callback] Missing function secrets: ${missing.join(', ')}`);
      return safeRedirect(appUrl, returnTo, 'configuration_missing');
    }

    const providerError = url.searchParams.get('error');
    if (providerError) {
      console.info(`[google-oauth-callback] Google authorization returned ${providerError}.`);
      const code = providerError === 'access_denied' ? 'access_denied' : providerError === 'redirect_uri_mismatch' ? 'redirect_uri_mismatch' : 'authorization_failed';
      return safeRedirect(appUrl, returnTo, code);
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state || !(await verifyState(state, Deno.env.get('GOOGLE_STATE_SECRET')!))) {
      console.warn('[google-oauth-callback] Missing code or invalid OAuth state.');
      return safeRedirect(appUrl, returnTo, 'invalid_authorization');
    }

    const [encodedState] = state.split('.');
    const stateData = JSON.parse(decoder.decode(decodeBase64Url(encodedState))) as { uid?: string; returnTo?: string; exp?: number };
    if (!stateData.uid || !stateData.exp || stateData.exp < Date.now()) {
      console.warn('[google-oauth-callback] OAuth state expired or incomplete.');
      return safeRedirect(appUrl, returnTo, 'expired_authorization');
    }
    returnTo = stateData.returnTo || returnTo;
    // Enforces origin match before using the signed state return URL.
    const safeTarget = new URL(returnTo);
    if (safeTarget.origin !== new URL(appUrl).origin) throw new Error('OAuth return URL does not match APP_URL.');

    const projectUrl = new URL(Deno.env.get('SUPABASE_URL')!);
    const redirectUri = `${projectUrl.origin}/functions/v1/google-oauth-callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.refresh_token) {
      const redirectMismatch = tokens.error === 'redirect_uri_mismatch' || /redirect_uri_mismatch/i.test(tokens.error_description || '');
      console.error('[google-oauth-callback] Google token exchange failed:', tokens.error_description || tokens.error || 'Refresh token was not returned.', redirectMismatch ? `Expected redirect URI: ${redirectUri}` : '');
      return safeRedirect(appUrl, returnTo, redirectMismatch ? 'redirect_uri_mismatch' : 'token_exchange_failed');
    }

    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!userInfoResponse.ok) throw new Error('Google account identity could not be retrieved.');
    const userInfo = await userInfoResponse.json();
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ciphertext = await encryptToken(tokens.refresh_token, Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY_B64')!);
    const { error: secretError } = await admin.from('google_connection_secrets').upsert({ user_id: stateData.uid, refresh_token_ciphertext: ciphertext }, { onConflict: 'user_id' });
    if (secretError) throw new Error(`Google token storage failed: ${secretError.message}`);
    const { error: metadataError } = await admin.from('google_connections').upsert({
      user_id: stateData.uid,
      provider: 'google',
      connected_email: userInfo.email || null,
      scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'],
    }, { onConflict: 'user_id' });
    if (metadataError) throw new Error(`Google connection metadata could not be saved: ${metadataError.message}`);

    return safeRedirect(appUrl, returnTo, undefined, true);
  } catch (error) {
    console.error('[google-oauth-callback] Callback failed:', error instanceof Error ? error.message : 'unknown error');
    try {
      return safeRedirect(appUrl, returnTo, 'connection_failed');
    } catch {
      return json('Google OAuth failed. Check the Supabase function logs and OAuth redirect configuration.', 500);
    }
  }
});
