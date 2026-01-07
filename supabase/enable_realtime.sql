-- Enable Realtime for the 'matches' table
-- This is often required for the client to receive updates

-- 1. Add 'matches' table to the supabase_realtime publication
-- This matches the standard way to enable Realtime via SQL
begin;
  -- Try to add the table to the publication. 
  -- If it fails (e.g. publication doesn't exist), we catch it or it's ignored if already added (depending on postgres version behavior, but 'alter publication' is usually safe if repeated for add table)
  alter publication supabase_realtime add table matches;
commit;

-- 2. Ensure RLS allows reading matches
-- (Assuming Public Access is desired for scores)
create policy "Public Read Matches"
on matches for select
using ( true );

-- 3. Ensure Replica Identity is set to FULL so we get the full row on updates (optional but helpful)
alter table matches replica identity full;
