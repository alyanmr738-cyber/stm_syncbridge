export type QueueJobPayload = {
  syncEventId: string;
  eventKind: string;
  source: "jobber" | "ghl" | "internal";
  providerEntityId?: string;
};

export type EnqueueResult = { jobId: string; alreadyQueued?: boolean };

export interface EventQueue {
  enqueue(payload: QueueJobPayload, idempotencyKey?: string): Promise<EnqueueResult>;
  processNext(handler: (payload: QueueJobPayload) => Promise<void>): Promise<boolean>;
  stats(): Promise<{ pending: number; leased: number; deadLetter: number }>;
}
