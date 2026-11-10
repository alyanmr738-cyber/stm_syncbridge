import type { EventQueue, EnqueueResult, QueueJobPayload } from "./types";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";

export class PostgresEventQueue implements EventQueue {
  async enqueue(
    payload: QueueJobPayload,
    idempotencyKey?: string
  ): Promise<EnqueueResult> {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase not configured — refusing to ack");
    const { data: existing } = await supabase
      .from("queue_jobs")
      .select("id")
      .eq("sync_event_id", payload.syncEventId)
      .maybeSingle();
    if (existing?.id) {
      return { jobId: existing.id, alreadyQueued: true };
    }
    const { data, error } = await supabase
      .from("queue_jobs")
      .insert({
        sync_event_id: payload.syncEventId,
        status: "pending",
        attempt: 0,
        max_attempts: 8,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    void idempotencyKey;
    return { jobId: data.id };
  }

  async processNext(
    handler: (payload: QueueJobPayload) => Promise<void>
  ): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;
    const now = new Date().toISOString();
    const { data: jobs } = await supabase
      .from("queue_jobs")
      .select("id, sync_event_id, attempt, max_attempts")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);
    const job = jobs?.[0];
    if (!job) return false;

    const owner = crypto.randomUUID();
    const leaseUntil = new Date(Date.now() + 60_000).toISOString();
    const { data: claimed, error: claimErr } = await supabase
      .from("queue_jobs")
      .update({
        status: "leased",
        lease_owner: owner,
        leased_until: leaseUntil,
        updated_at: now,
      })
      .eq("id", job.id)
      .in("status", ["pending", "leased"])
      .select("id")
      .maybeSingle();
    if (claimErr || !claimed) return false;

    const { data: event } = await supabase
      .from("sync_events")
      .select("id, source, event_kind")
      .eq("id", job.sync_event_id)
      .maybeSingle();
    if (!event) {
      await supabase
        .from("queue_jobs")
        .update({ status: "dead_letter", updated_at: now })
        .eq("id", job.id);
      return true;
    }

    try {
      await handler({
        syncEventId: event.id,
        eventKind: event.event_kind,
        source: event.source as QueueJobPayload["source"],
      });
      await supabase
        .from("queue_jobs")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("lease_owner", owner);
      await supabase
        .from("sync_events")
        .update({
          status: "succeeded",
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);
    } catch (e) {
      const attempt = (job.attempt ?? 0) + 1;
      const dead = attempt >= (job.max_attempts ?? 8);
      await supabase
        .from("queue_jobs")
        .update({
          status: dead ? "dead_letter" : "pending",
          attempt,
          lease_owner: null,
          leased_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      await supabase
        .from("sync_events")
        .update({
          status: dead ? "dead_letter" : "retrying",
          attempts: attempt,
          last_error_redacted:
            e instanceof Error ? e.message.slice(0, 240) : "worker_error",
        })
        .eq("id", event.id);
    }
    return true;
  }

  async stats() {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { pending: 0, leased: 0, deadLetter: 0 };
    const count = async (status: string) => {
      const { count: c } = await supabase
        .from("queue_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      return c ?? 0;
    };
    return {
      pending: await count("pending"),
      leased: await count("leased"),
      deadLetter: await count("dead_letter"),
    };
  }
}
