import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { loginAdmin, type AdminSession } from "@/lib/auth/session";
import { requireAdminSessionSecret } from "@/lib/config/env";
import { consumeLoginAttempt } from "@/lib/auth/rate-limit";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!consumeLoginAttempt(ip)) {
    return Response.json({ error: "Too many attempts" }, { status: 429 });
  }
  if (!body.email || !body.password) {
    return Response.json({ error: "Email and password required" }, { status: 400 });
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && !origin.includes(host) && process.env.NODE_ENV === "production") {
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  }
  const ok = await loginAdmin(body.email, body.password);
  if (!ok) {
    return Response.json({ error: "Invalid credentials or not allowlisted" }, { status: 401 });
  }
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
  session.email = body.email.toLowerCase();
  session.isLoggedIn = true;
  await session.save();
  return Response.json({ ok: true });
}
