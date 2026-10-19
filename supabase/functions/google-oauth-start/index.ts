const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    // Validate the required Supabase function secrets.
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

    // This URL must match the redirect URI configured in Google Cloud.
    const redirectUri = new URL(
      "/functions/v1/google-oauth-callback",
      supabaseUrl,
    ).toString();

    const scopes = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.events",
    ];

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", crypto.randomUUID());

    return jsonResponse({ url: authUrl.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

