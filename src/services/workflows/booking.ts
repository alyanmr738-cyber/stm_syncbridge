import type { BookingResolution } from "@/lib/domain/booking";

let lastResolution: BookingResolution | null = null;

export async function handleMockBooking(opts: {
  forcePending: boolean;
  reason?: string;
}): Promise<BookingResolution> {
  if (opts.forcePending) {
    lastResolution = {
      type: "pending_jobber_confirmation",
      reason: opts.reason ?? "Availability not verified in Jobber",
    };
    return lastResolution;
  }
  lastResolution = {
    type: "confirmed",
    jobberVisitId: "MOCK_VISIT_ID",
    confirmedStart: new Date().toISOString(),
  };
  return lastResolution;
}

export function getLastMockBookingResolution(): BookingResolution | null {
  return lastResolution;
}
