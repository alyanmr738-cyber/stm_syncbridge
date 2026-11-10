-- SyncBridge initial schema (Septic Tank Man). Review RLS before production apply.
create extension if not exists pgcrypto;

create table if not exists sync_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('jobber', 'ghl')),
  provider_account_id text not null,
  provider_account_name text,
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'reauthorization_required', 'error')),
  granted_scopes text[] not null default '{}',
  encrypted_credentials bytea,
  token_expires_at timestamptz,
  connected_at timestamptz,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_account_id)
);

create table if not exists customer_links (
  id uuid primary key default gen_random_uuid(),
  jobber_client_id text unique,
  ghl_contact_id text unique,
  verified boolean not null default false,
  match_method text not null default 'pending',
  last_jobber_revision text,
  last_ghl_revision text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  check (jobber_client_id is not null or ghl_contact_id is not null)
);

create table if not exists property_links (
  id uuid primary key default gen_random_uuid(),
  customer_link_id uuid references customer_links(id) on delete cascade,
  jobber_property_id text unique,
  ghl_property_reference text,
  last_synced_at timestamptz
);

create table if not exists job_links (
  id uuid primary key default gen_random_uuid(),
  customer_link_id uuid references customer_links(id),
  jobber_job_id text unique,
  ghl_opportunity_id text unique,
  source_booking_key text unique,
  last_job_status text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  check (jobber_job_id is not null or ghl_opportunity_id is not null or source_booking_key is not null)
);

create table if not exists appointment_links (
  id uuid primary key default gen_random_uuid(),
  job_link_id uuid references job_links(id),
  ghl_appointment_id text unique,
  jobber_visit_id text unique,
  requested_start_at timestamptz,
  confirmed_start_at timestamptz,
  confirmed_end_at timestamptz,
  booking_state text not null default 'requested'
    check (booking_state in (
      'requested', 'checking', 'pending_jobber_confirmation', 'confirmed',
      'alternative_offered', 'cancelled', 'failed'
    )),
  last_synced_at timestamptz
);

create table if not exists quote_links (
  id uuid primary key default gen_random_uuid(),
  jobber_quote_id text not null unique,
  customer_link_id uuid references customer_links(id),
  ghl_reference text,
  last_status text,
  last_synced_at timestamptz
);

create table if not exists invoice_links (
  id uuid primary key default gen_random_uuid(),
  jobber_invoice_id text not null unique,
  customer_link_id uuid references customer_links(id),
  ghl_reference text,
  last_status text,
  last_synced_at timestamptz
);

create table if not exists service_mappings (
  id uuid primary key default gen_random_uuid(),
  ghl_service_key text not null,
  ghl_display_name text,
  jobber_product_or_service_id text,
  jobber_display_name text,
  duration_minutes int,
  status text not null default 'pending'
    check (status in ('pending', 'mapped', 'review_required', 'disabled')),
  notes text,
  updated_at timestamptz not null default now(),
  unique (ghl_service_key)
);

create table if not exists sync_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('jobber', 'ghl', 'internal')),
  event_kind text not null,
  provider_entity_id text,
  provider_event_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'retrying', 'dead_letter', 'suppressed')),
  attempts int not null default 0,
  next_attempt_at timestamptz,
  last_error_redacted text,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  idempotency_key text,
  unique (source, provider_event_key)
);

create index if not exists sync_events_queue on sync_events (status, next_attempt_at, received_at);

create table if not exists queue_jobs (
  id uuid primary key default gen_random_uuid(),
  sync_event_id uuid not null references sync_events(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'leased', 'completed', 'dead_letter')),
  lease_owner text,
  leased_until timestamptz,
  attempt int not null default 0,
  max_attempts int not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists queue_jobs_poll on queue_jobs (status, leased_until, created_at);

create table if not exists review_deliveries (
  id uuid primary key default gen_random_uuid(),
  jobber_account_id text not null,
  jobber_job_id text not null,
  review_kind text not null default 'job_completion',
  ghl_contact_id text,
  ghl_opportunity_id text,
  status text not null default 'eligible'
    check (status in ('eligible', 'suppressed', 'authorized', 'accepted', 'sent', 'failed', 'unknown')),
  external_workflow_event_id text,
  failure_reason_redacted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jobber_account_id, jobber_job_id, review_kind)
);

create table if not exists note_deliveries (
  id uuid primary key default gen_random_uuid(),
  ghl_summary_event_key text not null unique,
  jobber_note_id text,
  jobber_client_id text,
  jobber_job_id text,
  summary_hash text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  source_event_id uuid references sync_events(id),
  entity_type text not null,
  source_entity_id text,
  reason text not null,
  details_redacted jsonb not null default '{}'::jsonb,
  state text not null default 'open' check (state in ('open', 'resolved', 'dismissed')),
  resolved_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists sync_configuration (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists capability_audit_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('mock', 'live_readonly')),
  summary jsonb not null default '{}'::jsonb,
  matrix jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists integration_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id text,
  action text not null,
  entity_type text,
  entity_id text,
  context_redacted jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
