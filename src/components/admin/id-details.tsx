"use client";

export function IdDetails({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <details className="mt-1 text-[11px] text-[#657683]">
      <summary className="cursor-pointer select-none">{label}</summary>
      <div className="mt-1 flex items-center gap-2 break-all">
        <code>{value}</code>
        <button
          type="button"
          className="underline"
          onClick={() => void navigator.clipboard.writeText(value)}
        >
          Copy
        </button>
      </div>
    </details>
  );
}
