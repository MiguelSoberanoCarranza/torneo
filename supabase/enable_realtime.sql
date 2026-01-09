begin;
  -- 'matches' is already added, skipping.
  -- Add match_events only.
  alter publication supabase_realtime add table match_events;
commit;

-- Policies: Drop first to ensure creation works
drop policy if exists "Public Read Matches" on matches;
create policy "Public Read Matches" on matches for select using ( true );

drop policy if exists "Public Read Match Events" on match_events;
create policy "Public Read Match Events" on match_events for select using ( true );

-- Replica Identity
alter table matches replica identity full;
alter table match_events replica identity full;
