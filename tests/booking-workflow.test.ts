import { describe, expect, it } from "vitest";
import {
  BOOKING_CONFIRM_403_REASON,
  transitionBookingState,
} from "@/lib/sync/booking-workflow";

describe("booking workflow", () => {
  it("blocks confirmVisit with dedicated gate state", () => {
    expect(transitionBookingState("received", "admin_confirm_visit")).toBe(
      "confirm_blocked_gate"
    );
  });

  it("never reaches confirmed from admin_confirm without Jobber API", () => {
    const next = transitionBookingState("matched_existing_jobber_customer", "admin_confirm");
    expect(next).toBe("pending_jobber_confirmation");
    expect(next).not.toBe("confirm_blocked_gate");
  });

  it("documents booking confirm 403 as intentional gate", () => {
    expect(BOOKING_CONFIRM_403_REASON).toMatch(/booking authorization/i);
  });
});