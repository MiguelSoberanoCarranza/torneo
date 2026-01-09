-- FORCE PUBLIC READ ACCESS
-- Run this to ensure the "Minuto a Minuto" events can be seen by everyone

-- 1. Match Events
alter table match_events enable row level security;
drop policy if exists "Public read match_events" on match_events;
create policy "Public read match_events"
on match_events for select
to anon, authenticated
using (true);

-- 2. Players (Required because we fetch player names with events)
alter table players enable row level security;
drop policy if exists "Public read players" on players;
create policy "Public read players"
on players for select
to anon, authenticated
using (true);

-- 3. Teams (Just in case)
alter table teams enable row level security;
drop policy if exists "Public read teams" on teams;
create policy "Public read teams"
on teams for select
to anon, authenticated
using (true);
