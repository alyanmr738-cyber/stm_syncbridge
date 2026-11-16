alter table sync_events
  add column if not exists process_outcome text;
