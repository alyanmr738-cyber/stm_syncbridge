import { describe, expect, it } from "vitest";
import { planBookingAdminPost } from "@/lib/sync/booking-admin";

describe("booking admin (no live Jobber visits)", () => {
  it("blocks visit confirmation", () => {
    const p = planBookingAdminPost({
      ghlAppointmentId: "appt-1",
      confirm: true,
      confirmVisit: true,
    });
    expect(p.status).toBe(403);
  });

  it("requires explicit confirm for pending upserts", () => {
    expect(planBookingAdminPost({ ghlAppointmentId: "appt-1" }).status).toBe(400);
  });

  it("date change stays pending, no Jobber write", () => {
    const p = planBookingAdminPost({
      ghlAppointmentId: "appt-1",
      requestedStartAt: "2026-11-20T15:00:00.000Z",
      confirm: true,
    });
    expect(p).toMatchObject({
      status: 200,
      jobberWrite: false,
      booking_state: "pending_jobber_confirmation",
    });
  });

  it("duplicate appointment id stays a single pending upsert", () => {
    const a = planBookingAdminPost({ ghlAppointmentId: "same", confirm: true });
    const b = planBookingAdminPost({ ghlAppointmentId: "same", confirm: true });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    if (a.status === 200 && b.status === 200) {
      expect(a.kind).toBe("upsert_pending");
      expect(b.kind).toBe("upsert_pending");
    }
  });

  it("decline does not create a Jobber visit", () => {
    const p = planBookingAdminPost({
      ghlAppointmentId: "appt-1",
      confirm: true,
      decline: true,
    });
    expect(p.status).toBe(200);
    if (p.status === 200) {
      expect(p.jobberWrite).toBe(false);
      expect(p.booking_state).toBe("cancelled");
    }
  });
});
