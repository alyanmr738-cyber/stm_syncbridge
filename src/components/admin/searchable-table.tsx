"use client";

import { useMemo, useState, type ReactNode } from "react";

export function SearchableTable({
  placeholder,
  rows,
  render,
}: {
  placeholder: string;
  rows: { id: string; haystack: string; node: ReactNode }[];
  render: (filtered: { id: string; haystack: string; node: ReactNode }[]) => ReactNode;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) => r.haystack.toLowerCase().includes(n));
  }, [q, rows]);
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="mb-3 w-full rounded-lg border border-[#e1e8ec] px-3 py-2 text-xs"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-[#657683]">No matching rows.</p>
      ) : (
        render(filtered)
      )}
    </div>
  );
}
