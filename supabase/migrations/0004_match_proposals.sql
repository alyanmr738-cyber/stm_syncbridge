create table if not exists match_proposals (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('customer', 'job')),
  jobber_id text,
  ghl_id text,
  bucket text not null,
  reason text,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'suggested'
    check (status in ('suggested', 'accepted', 'rejected')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists match_proposals_pair
  on match_proposals (kind, jobber_id, ghl_id);

alter table match_proposals enable row level security;
revoke all on match_proposals from anon, authenticated;
grant all on match_proposals to postgres, service_role;
