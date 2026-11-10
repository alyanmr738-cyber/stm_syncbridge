import { getEnv } from "./env";

export type ProductionApprovalGate =
  | "production_writes"
  | "historical_backfill"
  | "customer_messaging";

export function isSyncEnabled(): boolean {
  return getEnv().SYNC_ENABLED === true;
}

export function canWriteToProviders(): boolean {
  const env = getEnv();
  return env.SYNC_ENABLED === true && env.OUTBOUND_WRITES_ENABLED === true;
}

export function gateStatus(): Record<ProductionApprovalGate, boolean> {
  const env = getEnv();
  return {
    production_writes: env.OUTBOUND_WRITES_ENABLED === true,
    historical_backfill: env.HISTORICAL_IMPORT_ENABLED === true,
    customer_messaging: env.CUSTOMER_MESSAGING_ENABLED === true,
  };
}

export function assertGate(
  gate: ProductionApprovalGate,
  operation: string
): void {
  const status = gateStatus();
  if (!status[gate]) {
    throw new GateClosedError(gate, operation);
  }
}

export function assertOutboundWrite(operation: string): void {
  if (!canWriteToProviders()) {
    throw new GateClosedError("production_writes", operation);
  }
}

export class GateClosedError extends Error {
  constructor(
    public readonly gate: ProductionApprovalGate,
    public readonly operation: string
  ) {
    super(
      `Blocked: ${operation} requires approval gate "${gate}" to be enabled.`
    );
    this.name = "GateClosedError";
  }
}

export function featureFlagsSnapshot() {
  const env = getEnv();
  return {
    syncEnabled: env.SYNC_ENABLED === true,
    outboundWrites: env.OUTBOUND_WRITES_ENABLED === true,
    customerMessaging: env.CUSTOMER_MESSAGING_ENABLED === true,
    historicalImport: env.HISTORICAL_IMPORT_ENABLED === true,
    bookingSync: env.BOOKING_SYNC_ENABLED === true,
    jobCompletionSync: env.JOB_COMPLETION_SYNC_ENABLED === true,
    estimateSync: env.ESTIMATE_SYNC_ENABLED === true,
    invoiceSync: env.INVOICE_SYNC_ENABLED === true,
    aiSummarySync: env.AI_SUMMARY_SYNC_ENABLED === true,
    reviewTrigger: env.REVIEW_TRIGGER_ENABLED === true,
    emergencyAutoBook: env.EMERGENCY_AUTO_BOOK_ENABLED === true,
    gates: gateStatus(),
  };
}
