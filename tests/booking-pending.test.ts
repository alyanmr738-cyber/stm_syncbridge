import { describe, it, expect } from "vitest";
import { handleMockBooking } from "@/services/workflows/booking";
import { processSyncEvent } from "@/services/events/processor";

describe("booking pending path (T09, T10)", () => {
  it("defaults to pending when forced", async () => {
    const res = await handleMockBooking({
      forcePending: true,
      reason: "Availability not verified",
    });
    expect(res.type).toBe("pending_jobber_confirmation");
  });

  it("processor uses pending when writes gate closed", async () => {
    await processSyncEvent({
      syncEventId: "1",
      eventKind: "appointment.requested",
      source: "ghl",
    });
    const { getLastMockBookingResolution } = await import(
      "@/services/workflows/booking"
    );
    const last = getLastMockBookingResolution();
    expect(last?.type).toBe("pending_jobber_confirmation");
  });
});
