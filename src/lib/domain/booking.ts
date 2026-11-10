export type BookingState =
  | "requested"
  | "checking"
  | "pending_jobber_confirmation"
  | "confirmed"
  | "alternative_offered"
  | "cancelled"
  | "failed";

export type BookingIntent = {
  ghlAppointmentId: string;
  ghlContactId: string;
  serviceKey: string;
  requestedStart: string;
  requestedEnd: string;
  isReschedule: boolean;
  linkedJobberJobId?: string;
};

export type BookingResolution =
  | { type: "confirmed"; jobberVisitId: string; confirmedStart: string }
  | { type: "pending_jobber_confirmation"; reason: string }
  | { type: "alternative_offered"; slots: string[] }
  | { type: "failed"; reason: string };

export function stableBookingKey(intent: BookingIntent): string {
  const base = intent.isReschedule
    ? `reschedule:${intent.ghlAppointmentId}`
    : `new:${intent.ghlAppointmentId}`;
  return base;
}
