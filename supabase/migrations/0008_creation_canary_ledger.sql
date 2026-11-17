-- Durable creation canary: global slots + per-request ledger (run after 0007).

create table if not exists creation_canary_ledger (
  id uuid primary key default gen_random_uuid(),
  ghl_contact_id text not null,
  service_request_key text not null,
  sync_event_id uuid,
  run_state text not null default 'reserved'
    check (run_state in (
      'reserved', 'creating', 'created', 'reconciliation_required',
      'failed_before_provider_write', 'completed'
    )),
  jobber_client_id text,
  jobber_job_id text,
  client_write_state text not null default 'none'
    check (client_write_state in (
      'none', 'reserved', 'creating', 'created', 'reconciliation_required', 'failed_before_provider_write'
    )),
  job_write_state text not null default 'none'
    check (job_write_state in (
      'none', 'reserved', 'creating', 'created', 'reconciliation_required', 'failed_before_provider_write'
    )),
  lock_owner text,
  lock_expires_at timestamptz,
  last_error_redacted text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_request_key)
);

create unique index if not exists creation_canary_one_open_contact
  on creation_canary_ledger (ghl_contact_id)
  where run_state not in ('completed', 'failed_before_provider_write');

create table if not exists creation_canary_global_slots (
  slot text primary key check (slot in ('client', 'job')),
  write_state text not null default 'available'
    check (write_state in (
      'available', 'reserved', 'creating', 'created', 'reconciliation_required', 'failed_before_provider_write'
    )),
  ledger_id uuid references creation_canary_ledger(id) on delete set null,
  jobber_provider_id text,
  lock_owner text,
  lock_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into creation_canary_global_slots (slot, write_state)
values ('client', 'available'), ('job', 'available')
on conflict (slot) do nothing;

alter table if exists creation_canary_ledger enable row level security;
alter table if exists creation_canary_global_slots enable row level security;

create or replace function try_acquire_creation_slot(
  p_slot text,
  p_ledger_id uuid,
  p_owner text,
  p_ttl_seconds int default 120
) returns boolean
language plpgsql
as $$
declare
  acquired boolean := false;
begin
  if p_slot not in ('client', 'job') then
    return false;
  end if;

  update creation_canary_global_slots
  set
    write_state = 'reserved',
    ledger_id = p_ledger_id,
    lock_owner = p_owner,
    lock_expires_at = now() + make_interval(secs => p_ttl_seconds),
    updated_at = now()
  where slot = p_slot
    and write_state in ('available', 'reserved')
    and (
      write_state = 'available'
      or (lock_expires_at is not null and lock_expires_at < now())
      or lock_owner = p_owner
    )
    and (jobber_provider_id is null);

  if found then
    acquired := true;
  end if;

  if p_slot = 'client' then
    update creation_canary_ledger
    set client_write_state = 'reserved', lock_owner = p_owner, lock_expires_at = now() + make_interval(secs => p_ttl_seconds), updated_at = now()
    where id = p_ledger_id and client_write_state in ('none', 'reserved');
  else
    update creation_canary_ledger
    set job_write_state = 'reserved', lock_owner = p_owner, lock_expires_at = now() + make_interval(secs => p_ttl_seconds), updated_at = now()
    where id = p_ledger_id and job_write_state in ('none', 'reserved');
  end if;

  return acquired;
end;
$$;

create or replace function mark_creation_slot_creating(
  p_slot text,
  p_ledger_id uuid,
  p_owner text
) returns boolean
language plpgsql
as $$
begin
  if p_slot = 'client' then
    update creation_canary_global_slots
    set write_state = 'creating', ledger_id = p_ledger_id, lock_owner = p_owner, updated_at = now()
    where slot = 'client' and ledger_id = p_ledger_id and write_state in ('reserved', 'creating')
      and (lock_owner = p_owner or lock_expires_at < now());
    update creation_canary_ledger
    set client_write_state = 'creating', run_state = 'creating', updated_at = now()
    where id = p_ledger_id and client_write_state in ('reserved', 'creating');
    return found;
  else
    update creation_canary_global_slots
    set write_state = 'creating', ledger_id = p_ledger_id, lock_owner = p_owner, updated_at = now()
    where slot = 'job' and ledger_id = p_ledger_id and write_state in ('reserved', 'creating')
      and (lock_owner = p_owner or lock_expires_at < now());
    update creation_canary_ledger
    set job_write_state = 'creating', run_state = 'creating', updated_at = now()
    where id = p_ledger_id and job_write_state in ('reserved', 'creating');
    return found;
  end if;
end;
$$;

create or replace function complete_creation_slot(
  p_slot text,
  p_ledger_id uuid,
  p_provider_id text
) returns boolean
language plpgsql
as $$
begin
  update creation_canary_global_slots
  set write_state = 'created', jobber_provider_id = p_provider_id, lock_owner = null, lock_expires_at = null, updated_at = now()
  where slot = p_slot and ledger_id = p_ledger_id;

  if p_slot = 'client' then
    update creation_canary_ledger
    set
      client_write_state = 'created',
      jobber_client_id = p_provider_id,
      run_state = case when job_write_state = 'created' then 'completed' else 'created' end,
      updated_at = now()
    where id = p_ledger_id;
  else
    update creation_canary_ledger
    set
      job_write_state = 'created',
      jobber_job_id = p_provider_id,
      run_state = case when client_write_state in ('created', 'none') then
        case when client_write_state = 'created' then 'completed' else 'created' end
        else 'created' end,
      updated_at = now()
    where id = p_ledger_id;
  end if;

  return found;
end;
$$;