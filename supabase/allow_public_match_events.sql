-- Enable RLS on match_events if not already enabled (good practice)
alter table match_events enable row level security;

-- Drop existing policy if it exists to avoid conflicts (or use different name)
drop policy if exists "Public read match_events" on match_events;

-- Create policy to allow everyone (anon and authenticated) to read match_events
create policy "Public read match_events"
on match_events for select
to anon, authenticated
using (true);

-- Ensure players are also readable as we join with them
alter table players enable row level security;
drop policy if exists "Public read players" on players;

create policy "Public read players"
on players for select
to anon, authenticated
using (true);
