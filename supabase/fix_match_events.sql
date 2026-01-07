-- Create match_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.match_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  event_type TEXT CHECK (event_type IN ('goal', 'yellow_card', 'red_card', 'substitution')) NOT NULL,
  minute INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone
CREATE POLICY "Match events are viewable by everyone." ON public.match_events FOR SELECT USING (true);

-- Allow authenticated users (referees/admins) to insert events
CREATE POLICY "Auth users can insert match events" ON public.match_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update/delete (optional for now, but good for corrections)
CREATE POLICY "Auth users can update match events" ON public.match_events FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete match events" ON public.match_events FOR DELETE USING (auth.role() = 'authenticated');
