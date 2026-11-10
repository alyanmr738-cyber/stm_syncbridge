import { getEnv } from "./env";

export type SchedulingPolicy = {
  minBookingLeadTimeMinutes: number | null;
  visitBufferMinutes: number | null;
  travelTimeAllowanceMinutes: number | null;
  autoSchedulingEnabled: boolean;
  emergencyAutoBookEnabled: boolean;
};

/**
 * Scheduling knobs are independent until the business confirms values.
 * Auto scheduling stays off when lead time / buffers are unset (ambiguous).
 */
export function getSchedulingPolicy(): SchedulingPolicy {
  const env = getEnv();
  const minLead = env.MIN_BOOKING_LEAD_TIME_MINUTES ?? null;
  const buffer = env.VISIT_BUFFER_MINUTES ?? null;
  const travel = env.TRAVEL_TIME_ALLOWANCE_MINUTES ?? null;
  const buffersConfigured = minLead !== null && buffer !== null;

  return {
    minBookingLeadTimeMinutes: minLead,
    visitBufferMinutes: buffer,
    travelTimeAllowanceMinutes: travel,
    autoSchedulingEnabled:
      env.BOOKING_SYNC_ENABLED === true && buffersConfigured,
    emergencyAutoBookEnabled: env.EMERGENCY_AUTO_BOOK_ENABLED === true,
  };
}
