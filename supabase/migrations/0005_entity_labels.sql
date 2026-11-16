create table if not exists entity_labels (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  entity_type text not null,
  entity_id text not null,
  title text,
  subtitle text,
  extra jsonb not null default '{}'::jsonb,
  lookup_ok boolean not null default true,
  fetched_at timestamptz not null default now(),
  unique (provider, entity_type, entity_id)
);

create index if not exists entity_labels_lookup
  on entity_labels (provider, entity_type, entity_id);

alter table entity_labels enable row level security;
revoke all on entity_labels from anon, authenticated;
grant all on entity_labels to postgres, service_role;
