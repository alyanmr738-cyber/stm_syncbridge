import { listRecentEvents } from "@/services/events/inbox";

const illustrations = [
  {
    tone: "ok" as const,
    label: "Capability audit ready",
    desc: "Phase 0 · run from Settings → Audit when credentials arrive",
    right: "Now",
  },
  {
    tone: "ok" as const,
    label: "Webhooks listening",
    desc: "Jobber + GHL endpoints accept signed payloads",
    right: "Idle",
  },
  {
    tone: "amber" as const,
    label: "Booking requires confirmation",
    desc: "Default path until Jobber availability is verified",
    right: "Pending",
  },
  {
    tone: "ok" as const,
    label: "Production gates closed",
    desc: "Writes, backfill, and messaging awaiting approval",
    right: "Safe",
  },
];

export function ActivityFeed({ heading = "Recent sync activity" }: { heading?: string }) {
  const events = listRecentEvents(6);

  return (
    <section className="rounded-[14px] border border-[#e1e8ec] bg-white p-5 md:p-[21px]">
      <FeedHeader heading={heading} />
      {events.length > 0 ? (
        <ul>
          {events.map((e) => (
            <ActivityRow
              key={e.id}
              tone="ok"
              label={e.eventKind}
              desc={`${e.source} · queued for processing`}
              right="Live"
            />
          ))}
        </ul>
      ) : (
        <ul>
          {illustrations.map((row) => (
            <ActivityRow key={row.label} {...row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedHeader({ heading }: { heading: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold">{heading}</h2>
      <span className="text-xs text-[#657683]">
        {heading.includes("Recent") ? "Illustrative until events arrive" : ""}
      </span>
    </div>
  );
}

export function ActivityRow({
  tone,
  label,
  desc,
  right,
}: {
  tone: "ok" | "amber";
  label: string;
  desc: string;
  right: string;
}) {
  return (
    <li className="flex items-center gap-3 border-t border-[#eef1f3] py-[15px] first:border-t-0 first:pt-0">
      <span
        className={`h-[9px] w-[9px] shrink-0 rounded-full ${
          tone === "amber" ? "bg-[#d49b35]" : "bg-[#4aa77c]"
        }`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">{label}</div>
        <div className="mt-0.5 text-xs text-[#71808b]">{desc}</div>
      </div>
      <span className="ml-auto shrink-0 text-xs text-[#6c7a84]">{right}</span>
    </li>
  );
}
