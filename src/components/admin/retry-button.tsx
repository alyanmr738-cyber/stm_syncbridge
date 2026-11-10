"use client";

import { useState } from "react";

export function RetryButton({ eventId }: { eventId: string }) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  return (
    <button
      type="button"
      className="text-[#0b6e4f] underline"
      onClick={async () => {
        const res = await fetch("/api/admin/queue/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        setState(res.ok ? "ok" : "err");
      }}
    >
      {state === "ok" ? "queued" : state === "err" ? "failed" : "retry"}
    </button>
  );
}
