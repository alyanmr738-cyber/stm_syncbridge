-- Atomic refresh lock: only one owner may hold a live lock.
create or replace function try_acquire_token_refresh_lock(
  p_provider text,
  p_account text,
  p_owner text,
  p_ttl_seconds int default 25
) returns boolean
language plpgsql
as $$
begin
  insert into token_refresh_locks (provider, provider_account_id, locked_until, owner)
  values (
    p_provider,
    p_account,
    now() + make_interval(secs => p_ttl_seconds),
    p_owner
  )
  on conflict (provider, provider_account_id)
  do update set
    locked_until = excluded.locked_until,
    owner = excluded.owner
  where token_refresh_locks.locked_until < now()
     or token_refresh_locks.owner = excluded.owner;

  return exists (
    select 1
    from token_refresh_locks
    where provider = p_provider
      and provider_account_id = p_account
      and owner = p_owner
      and locked_until > now()
  );
end;
$$;
