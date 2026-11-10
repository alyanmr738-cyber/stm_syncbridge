import { getEnv, parseIdAllowlist } from "@/lib/config/env";

const JOBBER_AUTH = "https://api.getjobber.com/api/oauth/authorize";
const JOBBER_TOKEN = "https://api.getjobber.com/api/oauth/token";
const JOBBER_GRAPHQL = "https://api.getjobber.com/api/graphql";

export type JobberTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export function buildJobberAuthorizeUrl(
  state: string,
  codeChallenge: string
): string {
  const env = getEnv();
  const clientId = env.JOBBER_CLIENT_ID;
  const redirect = env.JOBBER_OAUTH_CALLBACK_URL;
  if (!clientId || !redirect) {
    throw new Error("JOBBER_CLIENT_ID and JOBBER_OAUTH_CALLBACK_URL required");
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirect,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${JOBBER_AUTH}?${params.toString()}`;
}

export async function exchangeJobberAuthorizationCode(
  code: string,
  codeVerifier: string
): Promise<JobberTokenResponse> {
  const env = getEnv();
  const clientId = env.JOBBER_CLIENT_ID;
  const clientSecret = env.JOBBER_CLIENT_SECRET;
  const redirect = env.JOBBER_OAUTH_CALLBACK_URL;
  if (!clientId || !clientSecret || !redirect) {
    throw new Error("Jobber OAuth env incomplete");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirect,
    code_verifier: codeVerifier,
  });
  const res = await fetch(JOBBER_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jobber token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<JobberTokenResponse>;
}

export async function fetchJobberAccount(accessToken: string): Promise<{
  id: string;
  name: string;
}> {
  const version = getEnv().JOBBER_GRAPHQL_VERSION ?? "2025-01-20";
  const res = await fetch(JOBBER_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": version,
    },
    body: JSON.stringify({
      query: "query { account { id name } }",
    }),
  });
  const json = (await res.json()) as {
    data?: { account?: { id: string; name: string } };
    errors?: unknown[];
  };
  if (json.errors?.length || !json.data?.account?.id) {
    throw new Error("Failed to read Jobber account identity");
  }
  const account = json.data.account;
  const allowed = parseIdAllowlist(getEnv().JOBBER_ALLOWED_ACCOUNT_IDS);
  if (allowed.length > 0 && !allowed.includes(account.id)) {
    throw new Error("Connected Jobber account is not on the allowlist");
  }
  return account;
}
