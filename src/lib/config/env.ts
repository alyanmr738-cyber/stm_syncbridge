import { z } from "zod";

const booleanFlag = z
  .string()
  .optional()
  .transform((v) => v === "true");

const envSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  BUSINESS_TIMEZONE: z.string().optional(),
  SYNC_ENABLED: booleanFlag,
  OUTBOUND_WRITES_ENABLED: booleanFlag,
  CUSTOMER_MESSAGING_ENABLED: booleanFlag,
  HISTORICAL_IMPORT_ENABLED: booleanFlag,
  BOOKING_SYNC_ENABLED: booleanFlag,
  JOB_COMPLETION_SYNC_ENABLED: booleanFlag,
  ESTIMATE_SYNC_ENABLED: booleanFlag,
  INVOICE_SYNC_ENABLED: booleanFlag,
  AI_SUMMARY_SYNC_ENABLED: booleanFlag,
  REVIEW_TRIGGER_ENABLED: booleanFlag,
  EMERGENCY_AUTO_BOOK_ENABLED: booleanFlag,
  MIN_BOOKING_LEAD_TIME_MINUTES: z.coerce.number().optional(),
  VISIT_BUFFER_MINUTES: z.coerce.number().optional(),
  TRAVEL_TIME_ALLOWANCE_MINUTES: z.coerce.number().optional(),
  JOBBER_CLIENT_ID: z.string().optional(),
  JOBBER_CLIENT_SECRET: z.string().optional(),
  JOBBER_OAUTH_CALLBACK_URL: z.string().optional(),
  JOBBER_GRAPHQL_VERSION: z.string().optional(),
  JOBBER_ALLOWED_ACCOUNT_IDS: z.string().optional(),
  GHL_LOCATION_ID: z.string().optional(),
  GHL_PRIVATE_INTEGRATION_TOKEN: z.string().optional(),
  GHL_ALLOWED_LOCATION_IDS: z.string().optional(),
  GHL_REVIEW_WORKFLOW_INBOUND_URL: z.string().optional(),
  GHL_WEBHOOK_SECRET: z.string().optional(),
  GHL_WEBHOOK_PUBLIC_KEY: z.string().optional(),
  PILOT_ENTITY_IDS: z.string().optional(),
  PILOT_JOBBER_CLIENT_IDS: z.string().optional(),
  PILOT_JOBBER_JOB_IDS: z.string().optional(),
  PILOT_GHL_CONTACT_IDS: z.string().optional(),
  PILOT_GHL_OPPORTUNITY_IDS: z.string().optional(),
  PILOT_GHL_ALLOWED_FIELDS: z.string().optional(),
  PILOT_EXISTING_RECORDS_ONLY: z.string().optional(),
  ALLOW_RECORD_CREATION: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  TOKEN_ENCRYPTION_KEY_BASE64: z.string().optional(),
  QUEUE_PROVIDER: z.enum(["postgres", "memory"]).default("memory"),
  INTERNAL_ACTION_SIGNING_SECRET: z.string().optional(),
  ADMIN_SESSION_SECRET: z.string().min(32).optional(),
  ADMIN_EMAIL_ALLOWLIST: z.string().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().optional(),
  USE_PROVIDER_MOCKS: booleanFlag,
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function resetEnvCacheForTests(): void {
  cached = null;
}

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  cached = {
    ...parsed.data,
    USE_PROVIDER_MOCKS:
      parsed.data.USE_PROVIDER_MOCKS ?? parsed.data.APP_ENV === "development",
  };
  return cached;
}

export function requireAdminSessionSecret(): string {
  const secret = getEnv().ADMIN_SESSION_SECRET;
  if (!secret) {
    if (getEnv().APP_ENV === "development") {
      return "development-only-syncbridge-session-secret-32chars";
    }
    throw new Error("ADMIN_SESSION_SECRET is required");
  }
  return secret;
}

export function getAdminAllowlist(): string[] {
  const raw = getEnv().ADMIN_EMAIL_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function parseIdAllowlist(raw?: string): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
