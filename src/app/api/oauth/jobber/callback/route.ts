import { getEnv } from "@/lib/config/env";

/**
 * OAuth callback scaffold — token exchange implemented in P1 after audit.
 * No token logging; no browser exposure.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return Response.redirect(
      new URL(`/settings/connections?jobber=error&reason=${encodeURIComponent(error)}`, getEnv().APP_BASE_URL)
    );
  }

  if (!code || !state) {
    return Response.json({ error: "Missing code or state" }, { status: 400 });
  }

  return Response.redirect(
    new URL("/settings/connections?jobber=pending_token_exchange", getEnv().APP_BASE_URL)
  );
}
