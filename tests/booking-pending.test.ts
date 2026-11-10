import { describe, it, expect } from "vitest";
import { handleMockBooking } from "@/services/workflows/booking";

describe("booking pending path (T09, T10)", () => {
  it("defaults to pending when forced", async () => {
    const res = await handleMockBooking({
      forcePending: true,
      reason: "Availability not verified",
    });
    expect(res.type).toBe("pending_jobber_confirmation");
  });
});
