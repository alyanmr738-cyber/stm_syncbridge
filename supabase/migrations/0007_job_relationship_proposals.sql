create table if not exists job_relationship_proposals (
  id uuid primary key default gen_random_uuid(),
  job_link_id uuid not null,
  jobber_job_id text not null,
  proposal_type text not null check (
    proposal_type in (
      'customer_link_backfill',
      'opportunity_link',
      'noop',
      'blocked'
    )
  ),
  target_customer_link_id uuid,
  target_ghl_opportunity_id text,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  rollback_sql text,
  status text not null default 'suggested'
    check (status in ('suggested', 'accepted', 'rejected', 'applied')),
  created_at timestamptz not null default now()
);

create unique index if not exists job_relationship_proposals_suggested_uq
  on job_relationship_proposals (job_link_id, proposal_type)
  where status = 'suggested';

alter table job_relationship_proposals enable row level security;
revoke all on job_relationship_proposals from anon, authenticated;
grant all on job_relationship_proposals to postgres, service_role;