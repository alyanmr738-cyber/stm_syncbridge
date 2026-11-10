import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getAdminAllowlist, requireAdminSessionSecret } from "@/lib/config/env";

export type AdminSession = {
  email: string;
  isLoggedIn: boolean;
};

const sessionOptions = {
  password: "placeholder",
  cookieName: "syncbridge_admin",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
  },
};

export async function getAdminSession(): Promise<AdminSession> {
  sessionOptions.password = requireAdminSessionSecret();
  const session = await getIronSession<AdminSession>(await cookies(), sessionOptions);
  return session;
}

export function isAllowlistedAdmin(email: string): boolean {
  const list = getAdminAllowlist();
  if (list.length === 0 && process.env.NODE_ENV === "development") {
    return true;
  }
  return list.includes(email.trim().toLowerCase());
}

export async function loginAdmin(email: string, password: string): Promise<boolean> {
  if (!isAllowlistedAdmin(email)) return false;
  const expected = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!expected) {
    if (process.env.NODE_ENV === "development") {
      return password.length > 0;
    }
    return false;
  }
  return password === expected;
}
