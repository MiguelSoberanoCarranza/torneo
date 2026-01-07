-- Add team_id to match_events to track which team triggered the event
ALTER TABLE match_events 
ADD COLUMN team_id UUID REFERENCES teams(id);

-- Optional: Add an index for performance
CREATE INDEX idx_match_events_team_id ON match_events(team_id);
