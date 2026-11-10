import { getEnv } from "@/lib/config/env";
import { getJobberPkceSession } from "@/lib/jobber/oauth-pkce-session";
import { exchangeJobberAuthorizationCode, fetchJobberAccount } from "@/lib/jobber/oauth";
import { upsertJobberConnection } from "@/lib/db/sync-connections";

function redirect(path: string) {
  return Response.redirect(new URL(path, getEnv().APP_BASE_URL));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirect(
      `/settings/connections?jobber=error&reason=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return Response.json({ error: "Missing code or state" }, { status: 400 });
  }

  const pkce = await getJobberPkceSession();
  if (!pkce.state || !pkce.codeVerifier || pkce.state !== state) {
    return redirect("/settings/connections?jobber=error&reason=invalid_state");
  }

  try {
    const tokens = await exchangeJobberAuthorizationCode(code, pkce.codeVerifier);
    const account = await fetchJobberAccount(tokens.access_token);
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    await upsertJobberConnection({
      accountId: account.id,
      accountName: account.name,
      credentials: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expires_at: expiresAt,
      },
    });

    pkce.state = undefined;
    pkce.codeVerifier = undefined;
    await pkce.destroy();

    return redirect(
      `/settings/connections?jobber=connected&account=${encodeURIComponent(account.name)}`
    );
  } catch (e) {
    const reason = e instanceof Error ? e.message : "token_exchange_failed";
    return redirect(
      `/settings/connections?jobber=error&reason=${encodeURIComponent(reason.slice(0, 120))}`
    );
  }
}
