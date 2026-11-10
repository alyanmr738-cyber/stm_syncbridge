import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { requireAdminSessionSecret } from "@/lib/config/env";

export type JobberPkceSession = {
  state?: string;
  codeVerifier?: string;
};

const options = () => ({
  password: requireAdminSessionSecret(),
  cookieName: "jobber_oauth_pkce",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  },
});

export async function getJobberPkceSession() {
  return getIronSession<JobberPkceSession>(await cookies(), options());
}
