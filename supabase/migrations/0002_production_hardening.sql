-- Production hardening: RLS deny-by-default for anon/authenticated; server uses service role.
alter table if exists sync_connections enable row level security;
alter table if exists customer_links enable row level security;
alter table if exists property_links enable row level security;
alter table if exists job_links enable row level security;
alter table if exists appointment_links enable row level security;
alter table if exists quote_links enable row level security;
alter table if exists invoice_links enable row level security;
alter table if exists service_mappings enable row level security;
alter table if exists sync_events enable row level security;
alter table if exists queue_jobs enable row level security;
alter table if exists review_deliveries enable row level security;
alter table if exists note_deliveries enable row level security;
alter table if exists sync_conflicts enable row level security;
alter table if exists sync_configuration enable row level security;
alter table if exists capability_audit_runs enable row level security;
alter table if exists integration_audit enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to postgres, service_role;
grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;

create table if not exists token_refresh_locks (
  provider text not null,
  provider_account_id text not null,
  locked_until timestamptz not null,
  owner text,
  primary key (provider, provider_account_id)
);

create table if not exists login_rate_limits (
  key text primary key,
  attempts int not null default 0,
  window_started_at timestamptz not null default now()
);

create index if not exists appointment_links_state on appointment_links (booking_state);
create index if not exists review_deliveries_status on review_deliveries (status);
