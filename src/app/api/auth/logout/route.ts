import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { type AdminSession } from "@/lib/auth/session";
import { requireAdminSessionSecret } from "@/lib/config/env";

export async function POST() {
  const session = await getIronSession<AdminSession>(await cookies(), {
    password: requireAdminSessionSecret(),
    cookieName: "syncbridge_admin",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  });
  session.destroy();
  return Response.json({ ok: true });
}
