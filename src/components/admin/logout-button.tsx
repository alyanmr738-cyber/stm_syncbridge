"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="rounded-lg border border-[#e1e8ec] px-2.5 py-1 text-[11px] font-medium text-[#657683] hover:bg-[#f6f8fa]"
    >
      Sign out
    </button>
  );
}
