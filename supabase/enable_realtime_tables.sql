-- Enable realtime for the tables
-- First, ensure the publication exists (Supabase creates 'supabase_realtime' by default)
-- We add our tables to it.

alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table match_events;

-- If 'supabase_realtime' doesn't exist (unlikely), create it:
-- create publication supabase_realtime for table matches, match_events;
