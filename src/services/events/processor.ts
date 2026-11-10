import { assertOutboundWrite, GateClosedError } from "@/lib/config/feature-flags";
import { getSchedulingPolicy } from "@/lib/config/scheduling-policy";
import type { QueueJobPayload } from "@/lib/queue/types";
import { handleMockBooking } from "@/services/workflows/booking";

export async function processSyncEvent(payload: QueueJobPayload): Promise<void> {
  switch (payload.eventKind) {
    case "appointment.requested":
    case "appointment.updated":
      await handleBookingEvent(payload.eventKind);
      return;
    case "job.completed":
      await handleJobCompleted();
      return;
    default:
      return;
  }
}

async function handleBookingEvent(kind: string): Promise<void> {
  const policy = getSchedulingPolicy();
  try {
    assertOutboundWrite(`booking:${kind}`);
  } catch (e) {
    if (e instanceof GateClosedError) {
      await handleMockBooking({ forcePending: true, reason: e.message });
      return;
    }
    throw e;
  }
  if (!policy.autoSchedulingEnabled) {
    await handleMockBooking({
      forcePending: true,
      reason: "Scheduling buffers not confirmed — pending_jobber_confirmation",
    });
    return;
  }
  await handleMockBooking({ forcePending: false });
}

async function handleJobCompleted(): Promise<void> {
  // Review + opportunity sync gated by feature flags; mock no-op when disabled.
}
