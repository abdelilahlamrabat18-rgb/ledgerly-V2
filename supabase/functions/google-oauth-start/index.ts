const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const encoder = new TextEncoder();
const denoRuntime = (globalThis as typeof globalThis & {
  Deno: {
    env: { get(name: string): string | undefined };
    serve(handler: (req: Request) => Response | Promise<Response>): void;
  };
}).Deno;

function jsonResponse(
  data: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signState(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoded = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encoded));
  return `${encoded}.${encodeBase64Url(new Uint8Array(signature))}`;
}

denoRuntime.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const clientId = denoRuntime.env.get("GOOGLE_CLIENT_ID");
    const supabaseUrl = denoRuntime.env.get("SUPABASE_URL");
    const supabaseAnonKey = denoRuntime.env.get("SUPABASE_ANON_KEY");
    const stateSecret = denoRuntime.env.get("GOOGLE_STATE_SECRET");
    const appUrl = denoRuntime.env.get("APP_URL");

    if (!clientId) {
      throw new Error(
        "GOOGLE_CLIENT_ID is missing from your Supabase function secrets.",
      );
    }
    if (!supabaseUrl) {
      throw new Error(
        "SUPABASE_URL is missing from your environment variables.",
      );
    }
    if (!supabaseAnonKey) {
      throw new Error(
        "SUPABASE_ANON_KEY is missing from your environment variables.",
      );
    }
    if (!stateSecret) {
      throw new Error(
        "GOOGLE_STATE_SECRET is missing from your Supabase function secrets.",
      );
    }

    const authorization = req.headers.get("Authorization") || "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";
    if (!accessToken) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    // Deno resolves this URL import at runtime; standard TypeScript does not.
    // @ts-ignore
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) {
      return jsonResponse({ error: "Invalid or expired session." }, 401);
    }

    // This URL must match the redirect URI configured in Google Cloud.
    const redirectUri = new URL(
      "/functions/v1/google-oauth-callback",
      supabaseUrl,
    ).toString();

    const scopes = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ];

    const state = await signState(
      {
        uid: userData.user.id,
        ...(appUrl ? { returnTo: `${new URL(appUrl).origin}/app/google-sheets` } : {}),
        exp: Date.now() + 10 * 60 * 1000,
      },
      stateSecret,
    );

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    return jsonResponse({ url: authUrl.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});


