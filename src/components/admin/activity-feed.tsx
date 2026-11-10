import { listRecentEvents } from "@/services/events/inbox";

export async function ActivityFeed({ heading = "Recent sync activity" }: { heading?: string }) {
  const events = await listRecentEvents(8);

  return (
    <section className="rounded-[14px] border border-[#e1e8ec] bg-white p-5 md:p-[21px]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">{heading}</h2>
        <span className="text-xs text-[#657683]">
          {events.length ? "From Supabase" : "Waiting for signed webhooks"}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-[#657683]">
          No durable events yet. Jobber HMAC-verified webhooks persist here after
          enqueue.
        </p>
      ) : (
        <ul>
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 border-t border-[#eef1f3] py-[15px] first:border-t-0 first:pt-0"
            >
              <span
                className={`h-[9px] w-[9px] shrink-0 rounded-full ${
                  e.status === "dead_letter" || e.status === "failed"
                    ? "bg-[#d49b35]"
                    : "bg-[#4aa77c]"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{e.eventKind}</div>
                <div className="mt-0.5 text-xs text-[#71808b]">
                  {e.source} · {e.status}
                  {e.error ? ` · ${e.error}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
