export type BookingAdminRequest = {
  ghlAppointmentId?: string;
  requestedStartAt?: string;
  confirm?: boolean;
  confirmVisit?: boolean;
  decline?: boolean;
};

export type BookingAdminPlan =
  | { status: 403; error: "approval_required"; kind: "confirm_blocked" | "decline_stored_only" }
  | { status: 400; error: string }
  | { status: 200; kind: "upsert_pending"; jobberWrite: false; booking_state: "pending_jobber_confirmation" | "cancelled" };

export function planBookingAdminPost(body: BookingAdminRequest): BookingAdminPlan {
  if (body.confirmVisit) {
    return {
      status: 403,
      error: "approval_required",
      kind: "confirm_blocked",
    };
  }
  if (!body.ghlAppointmentId || body.confirm !== true) {
    return { status: 400, error: "ghlAppointmentId and confirm=true required" };
  }
  if (body.decline) {
    return {
      status: 200,
      kind: "upsert_pending",
      jobberWrite: false,
      booking_state: "cancelled",
    };
  }
  return {
    status: 200,
    kind: "upsert_pending",
    jobberWrite: false,
    booking_state: "pending_jobber_confirmation",
  };
}
