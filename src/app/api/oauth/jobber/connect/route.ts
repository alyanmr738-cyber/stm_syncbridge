import { NextResponse } from "next/server";
import { buildJobberAuthorizeUrl } from "@/lib/jobber/oauth";
import { getJobberPkceSession } from "@/lib/jobber/oauth-pkce-session";
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOAuthState,
} from "@/lib/jobber/pkce";

export async function GET() {
  const state = generateOAuthState();
  const verifier = generateCodeVerifier();
  const session = await getJobberPkceSession();
  session.state = state;
  session.codeVerifier = verifier;
  await session.save();

  const url = buildJobberAuthorizeUrl(state, codeChallengeS256(verifier));
  return NextResponse.redirect(url);
}
