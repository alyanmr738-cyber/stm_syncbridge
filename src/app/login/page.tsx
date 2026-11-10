"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setError(body.error ?? "Login failed");
      return;
    }
    router.push("/overview");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f8fa] px-4">
      <MotionWrap>
        <MotionBrandBlock />
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-[14px] border border-[#e1e8ec] bg-white p-8 shadow-sm"
        >
          <h1 className="text-xl font-semibold tracking-tight text-[#192b36]">
            Admin sign in
          </h1>
          <p className="mt-2 text-sm text-[#657683]">
            All Access Digital administrators only.
          </p>
          <label className="mt-6 block text-sm font-medium text-[#192b36]">
            Email
            <input
              className="mt-1.5 w-full rounded-lg border border-[#e1e8ec] px-3 py-2 text-[#192b36] outline-none ring-[#1c4454] focus:ring-2"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-[#192b36]">
            Password
            <input
              className="mt-1.5 w-full rounded-lg border border-[#e1e8ec] px-3 py-2 text-[#192b36] outline-none ring-[#1c4454] focus:ring-2"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-[#1c4454] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#163a47] disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Continue to dashboard"}
          </button>
        </form>
      </MotionWrap>
    </div>
  );
}

function MotionWrap({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full max-w-md flex-col items-center gap-8">{children}</div>;
}

function MotionBrandBlock() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-[#1c4454] text-sm font-extrabold text-white">
        S
      </span>
      <div>
        <div className="text-[17px] font-semibold tracking-tight">SyncBridge</div>
        <div className="text-xs text-[#657683]">Septic Tank Man</div>
      </div>
    </div>
  );
}
