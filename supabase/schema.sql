-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS (Extends Supabase Auth)
-- Note: 'auth.users' is managed by Supabase. We create a public profile table.
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'referee', 'player')) DEFAULT 'admin',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) for privacy
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. LEAGUES
CREATE TABLE public.leagues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  category TEXT,
  format TEXT CHECK (format IN ('5', '7', '11')) NOT NULL,
  max_teams INTEGER DEFAULT 12,
  match_duration INTEGER DEFAULT 45,
  status TEXT CHECK (status IN ('upcoming', 'active', 'finished')) DEFAULT 'upcoming',
  start_date DATE,
  end_date DATE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TEAMS
CREATE TABLE public.teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  shield_url TEXT,
  home_kit_color TEXT,
  away_kit_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. PLAYERS
CREATE TABLE public.players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  number INTEGER,
  position TEXT,
  is_captain BOOLEAN DEFAULT FALSE,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. MATCHES
CREATE TABLE public.matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  home_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  away_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  referee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('scheduled', 'live', 'finished', 'postponed')) DEFAULT 'scheduled',
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. MATCH EVENTS (Live Stats)
CREATE TABLE public.match_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  event_type TEXT CHECK (event_type IN ('goal', 'yellow_card', 'red_card', 'substitution')) NOT NULL,
  minute INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Basic RLS Policies (Open for development, tighten for production)
-- Allow read access to everyone
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Leagues are viewable by everyone." ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Teams are viewable by everyone." ON public.teams FOR SELECT USING (true);
CREATE POLICY "Matches are viewable by everyone." ON public.matches FOR SELECT USING (true);

-- Allow authenticated users to insert/update (Simplify for MVP)
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- For now, allow authenticated users to manage leagues/teams (Admin logic can assume all logged-in users are admins for MVP)
CREATE POLICY "Auth users can create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can update leagues" ON public.leagues FOR UPDATE USING (auth.role() = 'authenticated');
