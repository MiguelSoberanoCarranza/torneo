import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

interface Tournament {
  id: string;
  name: string;
  logo_url: string | null;
}

interface StandingTeam {
  id: string;
  name: string;
  shield_url: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

interface TopScorer {
  playerId: string;
  name: string;
  photoUrl: string | null;
  teamName: string;
  teamShield: string | null;
  goals: number;
}

const DashboardScreen: React.FC = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [followedLeagueIds, setFollowedLeagueIds] = useState<string[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  // Tournament selector
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [leaguesWithoutTournament, setLeaguesWithoutTournament] = useState<any[]>([]);

  // New: Standings & Stats
  const [standings, setStandings] = useState<StandingTeam[]>([]);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);

  // Recent match events (for flip card)
  const [recentMatchEvents, setRecentMatchEvents] = useState<Record<string, any[]>>({});
  const [flippedMatches, setFlippedMatches] = useState<Record<string, boolean>>({});

  // Active section: 'home' | 'standings' | 'scorers'
  const [activeSection, setActiveSection] = useState<'home' | 'standings' | 'scorers'>('home');

  const LiveTimer = ({ match }: { match: any }) => {
    const [time, setTime] = useState(match.elapsed_seconds || 0);

    useEffect(() => {
      const calculateTime = () => {
        let initial = match.elapsed_seconds || 0;
        if (match.status === 'live' && match.last_start_time) {
          const startTime = new Date(match.last_start_time).getTime();
          const now = new Date().getTime();
          initial += Math.floor((now - startTime) / 1000);
        }
        return initial;
      };

      setTime(calculateTime());

      if (match.status !== 'live') return;

      const interval = setInterval(() => {
        setTime(calculateTime());
      }, 1000);
      return () => clearInterval(interval);
    }, [match]);

    const formatSeconds = (totalSeconds: number) => {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <span className="text-2xl font-black font-mono tracking-wider tabular-nums text-emerald-400 drop-shadow-sm">
        {formatSeconds(time)}
      </span>
    );
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (_isRefresh = false) => {
    try {
      setLoading(true);

      // 1. Get User & Profile
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profileData) {
          setUser({ ...user, profile: profileData });
        }
      }

      // 2. Fetch User's Follows
      let myFollows: string[] = [];
      if (user) {
        const { data: follows } = await supabase
          .from('league_followers')
          .select('league_id')
          .eq('user_id', user.id);

        if (follows) {
          myFollows = follows.map(f => f.league_id);
          setFollowedLeagueIds(myFollows);
        }
      }

      // 3. Fetch Tournaments
      let tournamentsQuery = supabase
        .from('tournaments')
        .select('id, name, logo_url')
        .in('status', ['active', 'draft'])
        .order('created_at', { ascending: false });
      
      const { data: profileData } = user ? await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single() : { data: null };
      
      if (profileData?.role !== 'admin' && profileData?.role !== 'superadmin') {
        tournamentsQuery = tournamentsQuery.eq('owner_id', user?.id || 'none');
      }
      
      const { data: tournamentsData } = await tournamentsQuery;
      if (tournamentsData) {
        setTournaments(tournamentsData);
      }

      // 4. Fetch Leagues
      let currentLeagues: any[] = [];

      if (user) {
        const { data: myLeagues } = await supabase
          .from('leagues')
          .select('*, tournaments(name)')
          .eq('owner_id', user.id);

        if (myLeagues) currentLeagues = [...currentLeagues, ...myLeagues];

        if (myFollows.length > 0) {
          const { data: followedLeagues } = await supabase
            .from('leagues')
            .select('*, tournaments(name)')
            .in('id', myFollows);

          if (followedLeagues) {
            const existingIds = new Set(currentLeagues.map(l => l.id));
            followedLeagues.forEach(l => {
              if (!existingIds.has(l.id)) {
                currentLeagues.push(l);
              }
            });
          }
        }
      }

      const { data: publicLeagues } = await supabase
        .from('leagues')
        .select('*, tournaments(name)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (publicLeagues) {
        const existingIds = new Set(currentLeagues.map(l => l.id));
        publicLeagues.forEach(l => {
          if (!existingIds.has(l.id)) {
            currentLeagues.push(l);
          }
        });
      }

      const withoutTournament = currentLeagues.filter(l => !l.tournament_id);
      setLeaguesWithoutTournament(withoutTournament);

      currentLeagues.sort((a, b) => {
        const aFollow = myFollows.includes(a.id) ? 1 : 0;
        const bFollow = myFollows.includes(b.id) ? 1 : 0;
        if (aFollow !== bFollow) return bFollow - aFollow;
        const aOwner = user && a.owner_id === user.id ? 1 : 0;
        const bOwner = user && b.owner_id === user.id ? 1 : 0;
        if (aOwner !== bOwner) return bOwner - aOwner;
        return 0;
      });

      currentLeagues = currentLeagues.filter(l => l.name && l.name.trim().length > 0);
      setLeagues(currentLeagues);

      if (currentLeagues.length > 0) {
        const withTournament = currentLeagues.filter(l => l.tournament_id);
        const firstLeague = withTournament.length > 0 ? withTournament[0] : currentLeagues[0];
        
        if (firstLeague) {
          setSelectedTournamentId(firstLeague.tournament_id || '');
          setSelectedLeagueId(firstLeague.id);
        }
      }

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch standings when selected league changes
  useEffect(() => {
    if (selectedLeagueId) {
      fetchMatchesForLeague(selectedLeagueId);
      fetchStandingsAndStats(selectedLeagueId);
    }
  }, [selectedLeagueId]);

  useEffect(() => {
    setIsFollowing(followedLeagueIds.includes(selectedLeagueId));
  }, [selectedLeagueId, followedLeagueIds]);

  const fetchMatchesForLeague = async (leagueId: string) => {
    try {
      // Live Matches
      const { data: live } = await supabase
        .from('matches')
        .select(`
          *, 
          home_team:teams!matches_home_team_id_fkey(name, shield_url), 
          away_team:teams!matches_away_team_id_fkey(name, shield_url)
        `)
        .eq('league_id', leagueId)
        .in('status', ['live', 'break']);

      if (live) {
        const matchIds = (live as any[]).map(m => m.id);
        const { data: events } = await supabase
          .from('match_events')
          .select('*, player:players(name)')
          .in('match_id', matchIds)
          .order('created_at', { ascending: true });

        const formattedLive = (live as any[]).map(m => ({
          ...m,
          home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
          away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team,
          events: events ? events.filter(e => e.match_id === m.id) : []
        }));
        setLiveMatches(formattedLive);
      } else {
        setLiveMatches([]);
      }

      // Upcoming
      const { data: upcoming } = await supabase
        .from('matches')
        .select(`*, home_team:teams!matches_home_team_id_fkey(name, shield_url), away_team:teams!matches_away_team_id_fkey(name, shield_url)`)
        .eq('league_id', leagueId)
        .eq('status', 'scheduled')
        .gt('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(10);

      if (upcoming) {
        setUpcomingMatches((upcoming as any[]).map(m => ({
          ...m,
          home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
          away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team,
        })));
      } else {
        setUpcomingMatches([]);
      }

      // Recent
      const { data: recent } = await supabase
        .from('matches')
        .select(`*, home_team:teams!matches_home_team_id_fkey(name, shield_url), away_team:teams!matches_away_team_id_fkey(name, shield_url)`)
        .eq('league_id', leagueId)
        .eq('status', 'finished')
        .order('start_time', { ascending: false })
        .limit(10);

      if (recent) {
        setRecentMatches((recent as any[]).map(m => ({
          ...m,
          home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
          away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team,
        })));

        const matchIds = (recent as any[]).map(m => m.id);
        if (matchIds.length > 0) {
          const { data: eventsData } = await supabase
            .from('match_events')
            .select('*, player:players!match_events_player_id_fkey(name)')
            .in('match_id', matchIds)
            .order('created_at', { ascending: true });

          if (eventsData) {
            const grouped: Record<string, any[]> = {};
            (eventsData as any[]).forEach(ev => {
              if (!grouped[ev.match_id]) grouped[ev.match_id] = [];
              grouped[ev.match_id].push(ev);
            });
            setRecentMatchEvents(grouped);
          }
        }
      } else {
        setRecentMatches([]);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  const fetchStandingsAndStats = async (leagueId: string) => {
    try {
      setStandingsLoading(true);

      // Fetch Teams
      const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId);

      // Fetch Finished Matches
      const { data: matchesData } = await supabase
        .from('matches')
        .select('id, home_team_id, away_team_id, home_score, away_score, status')
        .eq('league_id', leagueId)
        .eq('status', 'finished');

      const matches = matchesData || [];

      // Calculate Standings
      if (teams) {
        const stats = teams.map(team => {
          let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;

          matches.forEach(match => {
            const isHome = match.home_team_id === team.id;
            const isAway = match.away_team_id === team.id;

            if (isHome || isAway) {
              const homeScore = match.home_score ?? 0;
              const awayScore = match.away_score ?? 0;

              if (homeScore !== null && awayScore !== null) {
                played++;

                if (homeScore === -1 && awayScore === -1) {
                  lost++;
                } else {
                  const teamScore = isHome ? homeScore : awayScore;
                  const opponentScore = isHome ? awayScore : homeScore;

                  gf += Math.max(0, teamScore);
                  ga += Math.max(0, opponentScore);

                  if (teamScore > opponentScore) won++;
                  else if (teamScore === opponentScore) drawn++;
                  else lost++;
                }
              }
            }
          });

          return {
            id: team.id,
            name: team.name,
            shield_url: team.shield_url,
            played, won, drawn, lost, gf, ga,
            gd: gf - ga,
            points: (won * 3) + (drawn * 1)
          };
        });

        stats.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
        setStandings(stats);
      }

      // Fetch Top Scorers
      const matchIds = matches.map(m => m.id);
      if (matchIds.length > 0) {
        const { data: events } = await supabase
          .from('match_events')
          .select(`
            event_type, player_id,
            player:player_id(name, photo_url, team:team_id(name, shield_url))
          `)
          .in('match_id', matchIds)
          .eq('event_type', 'goal');

        if (events) {
          const goalsMap = new Map<string, TopScorer>();

          events.forEach((ev: any) => {
            if (!ev.player) return;

            const playerId = ev.player_id;
            const playerName = ev.player.name;
            const photoUrl = ev.player.photo_url;
            const teamName = ev.player.team?.name || 'Unknown';
            const teamShield = ev.player.team?.shield_url;

            const current = goalsMap.get(playerId) || {
              playerId, name: playerName, photoUrl, teamName, teamShield, goals: 0
            };
            current.goals++;
            goalsMap.set(playerId, current);
          });

          const scorers = Array.from(goalsMap.values()).sort((a, b) => b.goals - a.goals);
          setTopScorers(scorers);
        }
      } else {
        setTopScorers([]);
      }

    } catch (error) {
      console.error('Error fetching standings:', error);
    } finally {
      setStandingsLoading(false);
    }
  };

  const handleTournamentChange = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
    const leaguesInTournament = tournamentId 
      ? leagues.filter(l => l.tournament_id === tournamentId)
      : leaguesWithoutTournament;
    
    if (leaguesInTournament.length > 0) {
      setSelectedLeagueId(leaguesInTournament[0].id);
    } else {
      setSelectedLeagueId('');
    }
  };

  const handleLeagueChange = (leagueId: string) => {
    const selectedLeague = leagues.find(l => l.id === leagueId);
    if (selectedLeague) {
      setSelectedTournamentId(selectedLeague.tournament_id || '');
    }
    setSelectedLeagueId(leagueId);
  };

  const filteredLeagues = selectedTournamentId
    ? leagues.filter(l => l.tournament_id === selectedTournamentId)
    : leaguesWithoutTournament;

  const toggleFollow = async () => {
    if (!user) {
      alert('Inicia sesión para seguir ligas.');
      return;
    }
    const isCurrentlyFollowing = followedLeagueIds.includes(selectedLeagueId);

    if (isCurrentlyFollowing) {
      const { error } = await supabase
        .from('league_followers')
        .delete()
        .eq('user_id', user.id)
        .eq('league_id', selectedLeagueId);

      if (!error) {
        setFollowedLeagueIds(prev => prev.filter(id => id !== selectedLeagueId));
      }
    } else {
      const { error } = await supabase
        .from('league_followers')
        .insert([{ user_id: user.id, league_id: selectedLeagueId }]);

      if (!error) {
        setFollowedLeagueIds(prev => [...prev, selectedLeagueId]);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateSimple = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Hoy';

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return 'Mañana';

    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const displayedLive = liveMatches.filter(m => m.league_id === selectedLeagueId);
  const displayedUpcoming = upcomingMatches.filter(m => m.league_id === selectedLeagueId);
  const displayedRecent = recentMatches.filter(m => m.league_id === selectedLeagueId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentLeague = leagues.find(l => l.id === selectedLeagueId);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased min-h-screen pb-24">
      {/* Top App Bar */}
      <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 transition-colors duration-300">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 gap-2">
            {/* User Profile */}
            <div
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
              onClick={() => user ? navigate('/profile') : navigate('/admin-login')}
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 overflow-hidden ring-2 ring-white dark:ring-slate-800 shadow-md flex items-center justify-center">
                  {user?.profile?.avatar_url ? (
                    <img src={user.profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-slate-400 dark:text-slate-500">person</span>
                  )}
                </div>
                {user && <div className="absolute bottom-0 right-0 size-3 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 border-2 border-background-light dark:border-background-dark shadow-sm"></div>}
              </div>
              <div className="flex flex-col hidden sm:flex">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{user ? 'Bienvenido' : 'Hola,'}</p>
                <h2 className="text-sm font-black leading-tight truncate max-w-[120px]">
                  {user ? (user.profile?.full_name || user.email?.split('@')[0] || 'Usuario') : 'Invitado'}
                </h2>
              </div>
            </div>

            {/* Tournament + League Selector */}
            <div className="flex-1 px-1 md:px-3 flex justify-end md:justify-center items-center gap-2 min-w-0">
              {tournaments.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-full pl-3 pr-1 py-1 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
                  <span className="material-symbols-outlined text-base text-slate-400 hidden md:inline">emoji_events</span>
                  <select
                    value={selectedTournamentId}
                    onChange={(e) => handleTournamentChange(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold max-w-[90px] md:max-w-[130px] truncate outline-none focus:ring-0 cursor-pointer text-slate-800 dark:text-white appearance-none py-1"
                  >
                    <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                      Sin Torneo
                    </option>
                    {tournaments.map(t => (
                      <option key={t.id} value={t.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {filteredLeagues.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-full pl-3 pr-1 py-1 shadow-sm border border-slate-200/60 dark:border-slate-700/60 min-w-0 max-w-full">
                    <span className="material-symbols-outlined text-base text-slate-400 hidden sm:inline">sports_soccer</span>
                    <select
                      value={selectedLeagueId}
                      onChange={(e) => handleLeagueChange(e.target.value)}
                      className="bg-transparent border-none text-sm font-bold max-w-full truncate outline-none focus:ring-0 cursor-pointer text-slate-800 dark:text-white appearance-none py-1"
                    >
                      {filteredLeagues.map(l => (
                        <option key={l.id} value={l.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                          {l.name} {followedLeagueIds.includes(l.id) ? '★' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={toggleFollow}
                    className={`size-9 rounded-full transition-all flex items-center justify-center shadow-sm ${
                      isFollowing
                        ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50'
                        : 'text-slate-400 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 hover:text-amber-500 hover:scale-105'
                    }`}
                    title={isFollowing ? "Dejar de seguir" : "Seguir liga"}
                  >
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: isFollowing ? "'FILL' 1" : "'FILL' 0" }}>
                      star
                    </span>
                  </button>
                </>
              )}

              <button
                onClick={() => navigate('/tournaments')}
                className="size-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm text-slate-500 hover:text-primary hover:scale-105 transition-all flex items-center justify-center"
                title="Ver Torneos"
              >
                <span className="material-symbols-outlined text-lg">emoji_events</span>
              </button>
            </div>

            {/* Action Icons */}
            <div className="flex items-center gap-2 shrink-0">
              <button className="size-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-center text-slate-500 hover:text-primary hover:scale-105 transition-all">
                <span className="material-symbols-outlined text-lg">search</span>
              </button>

              {user ? (
                <button
                  onClick={handleLogout}
                  className="size-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-center text-slate-500 hover:text-red-500 hover:scale-105 transition-all"
                  title="Cerrar Sesión"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/admin-login')}
                  className="flex items-center justify-center px-4 h-9 rounded-full bg-gradient-to-r from-primary to-purple-600 text-white text-xs font-black shadow-md shadow-primary/30 hover:shadow-lg hover:scale-105 transition-all"
                >
                  Ingresar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section Tabs - NEW */}
      <div className="sticky top-[72px] z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 py-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveSection('home')}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                activeSection === 'home'
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Inicio
            </button>
            <button
              onClick={() => setActiveSection('standings')}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                activeSection === 'standings'
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-base">leaderboard</span>
              Tabla General
            </button>
            <button
              onClick={() => setActiveSection('scorers')}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                activeSection === 'scorers'
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-base">sports_soccer</span>
              Goleo
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto w-full flex flex-col px-4 sm:px-6 lg:px-8">

        {/* === HOME SECTION === */}
        {activeSection === 'home' && (
          <>
            {/* Live Now Section */}
            {displayedLive.length > 0 && (
              <div className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex size-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full size-2.5 bg-red-500"></span>
                    </div>
                    <h3 className="text-lg font-black tracking-tight">En Juego</h3>
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-500 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">LIVE</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">{displayedLive.length}</span>
                </div>

                <div className="flex overflow-x-auto pb-4 gap-4 snap-x no-scrollbar md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible md:pb-0">
                  {displayedLive.map(match => (
                    <div key={match.id} className="min-w-[85vw] sm:min-w-[400px] md:min-w-0 snap-center shrink-0 md:snap-align-none cursor-pointer" onClick={() => navigate('/match-details-live', { state: { matchId: match.id } })}>
                      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-4 text-white shadow-2xl shadow-slate-900/30 overflow-hidden h-full flex flex-col justify-between hover:scale-[1.02] transition-transform duration-200">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-red-500/30 to-pink-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-primary/20 to-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <span className="text-xs font-bold bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10">
                            {currentLeague?.name || 'Liga'}
                          </span>
                          <LiveTimer match={match} />
                        </div>

                        <div className="flex items-center justify-between mb-6 relative z-10">
                          <div className="flex flex-col items-center gap-2 flex-1">
                            <div className="size-16 rounded-full bg-white/10 p-1 backdrop-blur-sm border border-white/20 shadow-lg">
                              {match.home_team?.shield_url ? (
                                <img alt={match.home_team.name} className="w-full h-full rounded-full object-cover" src={match.home_team.shield_url} />
                              ) : (
                                <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs">{match.home_team?.name?.substring(0, 3)}</div>
                              )}
                            </div>
                            <span className="text-sm font-bold text-center leading-tight max-w-[100px] truncate">{match.home_team?.name}</span>
                            <div className="flex gap-1">
                              {[...Array(match.events?.filter((e: any) => e.team_id === match.home_team_id && e.event_type === 'yellow_card').length || 0)].map((_, i) => (
                                <div key={`y-${i}`} className="w-2 h-3 bg-yellow-400 rounded-sm shadow-sm"></div>
                              ))}
                              {[...Array(match.events?.filter((e: any) => e.team_id === match.home_team_id && e.event_type === 'red_card').length || 0)].map((_, i) => (
                                <div key={`r-${i}`} className="w-2 h-3 bg-red-600 rounded-sm shadow-sm"></div>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col items-center px-4">
                            <div className="text-5xl font-display font-black tracking-widest tabular-nums leading-none mb-1">
                              {match.home_score === -1 && match.away_score === -1 ? (
                                <span className="text-3xl text-red-500">P<span className="text-slate-500 mx-1">-</span>P</span>
                              ) : (
                                <>{match.home_score}<span className="text-slate-500 mx-1">-</span>{match.away_score}</>
                              )}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">En Vivo</div>
                          </div>

                          <div className="flex flex-col items-center gap-2 flex-1">
                            <div className="size-16 rounded-full bg-white/10 p-1 backdrop-blur-sm border border-white/20 shadow-lg">
                              {match.away_team?.shield_url ? (
                                <img alt={match.away_team.name} className="w-full h-full rounded-full object-cover" src={match.away_team.shield_url} />
                              ) : (
                                <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs">{match.away_team?.name?.substring(0, 3)}</div>
                              )}
                            </div>
                            <span className="text-sm font-bold text-center leading-tight max-w-[100px] truncate">{match.away_team?.name}</span>
                            <div className="flex gap-1">
                              {[...Array(match.events?.filter((e: any) => e.team_id === match.away_team_id && e.event_type === 'yellow_card').length || 0)].map((_, i) => (
                                <div key={`y-${i}`} className="w-2 h-3 bg-yellow-400 rounded-sm shadow-sm"></div>
                              ))}
                              {[...Array(match.events?.filter((e: any) => e.team_id === match.away_team_id && e.event_type === 'red_card').length || 0)].map((_, i) => (
                                <div key={`r-${i}`} className="w-2 h-3 bg-red-600 rounded-sm shadow-sm"></div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {match.events && match.events.filter((e: any) => e.event_type === 'goal').length > 0 && (
                          <div className="bg-white/5 rounded-2xl p-2.5 backdrop-blur-md border border-white/10">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5 text-center tracking-wider">Goles</p>
                            <div className="flex flex-col gap-1 max-h-[60px] overflow-y-auto no-scrollbar">
                              {match.events.filter((e: any) => e.event_type === 'goal').map((goal: any, idx: number) => {
                                const isHome = goal.team_id === match.home_team_id;
                                return (
                                  <div key={idx} className={`flex items-center text-xs gap-1.5 ${isHome ? 'justify-start' : 'justify-end'}`}>
                                    <span className="material-symbols-outlined text-emerald-400 text-sm">sports_soccer</span>
                                    <span className="text-white font-semibold">{goal.player?.name || 'Jugador'}</span>
                                    <span className="text-emerald-400 font-black tabular-nums">
                                      {Math.floor(goal.rel_time_seconds / 60)}'
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Matches */}
            <div className="py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black tracking-tight">Próximos Partidos</h3>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">{displayedUpcoming.length}</span>
              </div>
              {displayedUpcoming.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                  <div className="size-14 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-2xl text-slate-400">event_busy</span>
                  </div>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No hay partidos programados</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
                  {displayedUpcoming.slice(0, 6).map((match) => {
                    const dateLabel = formatDateSimple(match.start_time);
                    return (
                      <div key={match.id} className="group relative bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-md shadow-slate-200/40 dark:shadow-black/20 border border-slate-200/60 dark:border-slate-700/60 h-full hover:shadow-lg hover:scale-[1.01] transition-all">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center w-14 bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-xl py-2 border border-primary/20">
                            <span className="text-base font-black text-primary tabular-nums leading-none">{formatTime(match.start_time)}</span>
                            <span className="text-[9px] uppercase font-bold text-primary/70 mt-0.5">Hora</span>
                          </div>
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                              <div className="size-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center overflow-hidden border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                                {match.home_team?.shield_url ? <img src={match.home_team.shield_url} className="w-full h-full object-cover" /> : <span className="text-xs font-black text-slate-500">{match.home_team?.name?.substring(0, 2).toUpperCase()}</span>}
                              </div>
                              <span className="font-bold text-[11px] text-center truncate w-full leading-tight">{match.home_team?.name}</span>
                            </div>

                            <div className="px-2 flex flex-col items-center shrink-0">
                              <div className="size-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                <span className="text-[10px] font-black text-slate-400">VS</span>
                              </div>
                            </div>

                            <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                              <div className="size-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center overflow-hidden border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                                {match.away_team?.shield_url ? <img src={match.away_team.shield_url} className="w-full h-full object-cover" /> : <span className="text-xs font-black text-slate-500">{match.away_team?.name?.substring(0, 2).toUpperCase()}</span>}
                              </div>
                              <span className="font-bold text-[11px] text-center truncate w-full leading-tight">{match.away_team?.name}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Results - FLIP CARDS */}
            {displayedRecent.length > 0 && (
              <div className="py-4 pb-8">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight">Resultados Recientes</h3>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Toca</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">{displayedRecent.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ perspective: '1200px' }}>
                  {displayedRecent.slice(0, 6).map(match => {
                    const homeWin = match.home_score > match.away_score;
                    const awayWin = match.away_score > match.home_score;
                    const isFlipped = flippedMatches[match.id] || false;
                    const matchEvents = recentMatchEvents[match.id] || [];

                    return (
                      <div
                        key={match.id}
                        onClick={() => setFlippedMatches(prev => ({ ...prev, [match.id]: !prev[match.id] }))}
                        className="relative cursor-pointer group"
                        style={{ minHeight: '180px' }}
                      >
                        <div
                          className="relative w-full h-full transition-transform duration-500"
                          style={{
                            transformStyle: 'preserve-3d',
                            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                            minHeight: '180px'
                          }}
                        >
                          {/* FRENTE */}
                          <div
                            className="absolute inset-0 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-md shadow-slate-200/40 dark:shadow-black/20 border border-slate-200/60 dark:border-slate-700/60 flex flex-col gap-3 hover:shadow-lg transition-shadow overflow-hidden"
                            style={{ backfaceVisibility: 'hidden' }}
                          >
                            {!homeWin && !awayWin && (
                              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-yellow-400 to-orange-500"></div>
                            )}
                            {homeWin && (
                              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-400 to-green-500"></div>
                            )}
                            {awayWin && (
                              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-400 to-cyan-500"></div>
                            )}

                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate max-w-[70%]">{currentLeague?.name || 'Liga'}</span>
                              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md shrink-0">{formatDateSimple(match.start_time)}</span>
                            </div>

                            <div className={`flex justify-between items-center pl-2 ${homeWin ? 'opacity-100' : 'opacity-65'}`}>
                              <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                                <div className="size-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex-shrink-0 overflow-hidden border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                                  {match.home_team?.shield_url && <img src={match.home_team.shield_url} className="w-full h-full object-cover" />}
                                </div>
                                <span className={`text-sm truncate ${homeWin ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-600 dark:text-slate-400'}`}>
                                  {match.home_team?.name}
                                </span>
                              </div>
                              <span className={`text-2xl tabular-nums ${homeWin ? 'font-black text-emerald-600 dark:text-emerald-400' : 'font-bold text-slate-600 dark:text-slate-400'}`}>
                                {match.home_score === -1 ? 'P' : match.home_score}
                              </span>
                            </div>

                            <div className={`flex justify-between items-center pl-2 ${awayWin ? 'opacity-100' : 'opacity-65'}`}>
                              <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                                <div className="size-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex-shrink-0 overflow-hidden border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                                  {match.away_team?.shield_url && <img src={match.away_team.shield_url} className="w-full h-full object-cover" />}
                                </div>
                                <span className={`text-sm truncate ${awayWin ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-600 dark:text-slate-400'}`}>
                                  {match.away_team?.name}
                                </span>
                              </div>
                              <span className={`text-2xl tabular-nums ${awayWin ? 'font-black text-emerald-600 dark:text-emerald-400' : 'font-bold text-slate-600 dark:text-slate-400'}`}>
                                {match.away_score === -1 ? 'P' : match.away_score}
                              </span>
                            </div>

                            <div className="mt-auto flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider py-1">
                              <span className="material-symbols-outlined text-sm">touch_app</span>
                              <span>Ver detalles</span>
                            </div>
                          </div>

                          {/* REVERSO */}
                          <div
                            className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 rounded-2xl p-4 shadow-md border border-slate-700/60 flex flex-col gap-2 overflow-hidden"
                            style={{
                              backfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)'
                            }}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm text-primary">event_note</span>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Eventos</span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-300 bg-white/15 px-2 py-0.5 rounded-md shrink-0">{matchEvents.length}</span>
                            </div>

                            <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto no-scrollbar">
                              {matchEvents.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
                                  <span className="material-symbols-outlined text-3xl">event_busy</span>
                                  <span className="text-xs font-bold">Sin eventos</span>
                                </div>
                              ) : (
                                matchEvents.slice(0, 6).map((ev: any) => {
                                  const isHome = ev.team_id === match.home_team_id;
                                  const isGoal = ev.event_type === 'goal';
                                  const isRed = ev.event_type === 'red_card';
                                  const isYellow = ev.event_type === 'yellow_card';
                                  return (
                                    <div key={ev.id} className={`flex items-center gap-2 text-[11px] py-1.5 px-2 rounded-lg ${isHome ? 'bg-emerald-500/15 border border-emerald-500/20' : 'bg-blue-500/15 border border-blue-500/20'}`}>
                                      <span className="material-symbols-outlined text-base shrink-0" style={{
                                        color: isGoal ? '#34d399' : isRed ? '#f87171' : isYellow ? '#fbbf24' : '#94a3b8'
                                      }}>
                                        {isGoal ? 'sports_soccer' : isRed ? 'style' : isYellow ? 'style' : 'swap_horiz'}
                                      </span>
                                      <span className="flex-1 truncate text-white font-semibold">
                                        {ev.player?.name || 'Jugador'}
                                      </span>
                                      <span className="font-black tabular-nums text-slate-200 shrink-0 text-xs">
                                        {ev.minute || (ev.rel_time_seconds ? Math.floor(ev.rel_time_seconds / 60) : 0)}'
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            <div className="mt-auto flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider py-1">
                              <span className="material-symbols-outlined text-sm">undo</span>
                              <span>Volver</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* === STANDINGS SECTION === */}
        {activeSection === 'standings' && (
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">leaderboard</span>
                Tabla General
              </h3>
              <button
                onClick={() => navigate('/league-table')}
                className="text-sm font-bold text-primary hover:underline"
              >
                Ver completa
              </button>
            </div>

            {standingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : standings.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <div className="size-14 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-2xl text-slate-400">groups_3</span>
                </div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No hay partidos jugados todavía</p>
                <p className="text-xs text-slate-500 mt-1">Los resultados aparecerán aquí</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[40px_1fr_repeat(4,50px)_60px] gap-1 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">
                  <span className="text-center">#</span>
                  <span>Equipo</span>
                  <span className="text-center">PJ</span>
                  <span className="text-center hidden sm:table-cell">G</span>
                  <span className="text-center hidden sm:table-cell">E</span>
                  <span className="text-center hidden sm:table-cell">P</span>
                  <span className="text-center font-black text-slate-900 dark:text-white">PTS</span>
                </div>

                {/* Rows */}
                {standings.map((team, index) => (
                  <div
                    key={team.id}
                    className={`grid grid-cols-[40px_1fr_repeat(4,50px)_60px] gap-1 px-3 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                      index < 4 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <span className={`text-center font-bold text-sm ${index < 4 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                      {index + 1}
                    </span>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold overflow-hidden border border-slate-200 dark:border-slate-600 shrink-0">
                        {team.shield_url ? (
                          <img src={team.shield_url} className="w-full h-full object-cover" />
                        ) : (
                          team.name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <span className="font-bold text-sm truncate">{team.name}</span>
                    </div>
                    <span className="text-center font-bold text-slate-600 dark:text-slate-300 text-sm">{team.played}</span>
                    <span className="text-center text-slate-500 hidden sm:table-cell text-sm">{team.won}</span>
                    <span className="text-center text-slate-500 hidden sm:table-cell text-sm">{team.drawn}</span>
                    <span className="text-center text-slate-500 hidden sm:table-cell text-sm">{team.lost}</span>
                    <span className="text-center font-black text-primary text-lg">{team.points}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === SCORERS SECTION === */}
        {activeSection === 'scorers' && (
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">sports_soccer</span>
                Tabla de Goleo
              </h3>
              <button
                onClick={() => navigate('/league-table')}
                className="text-sm font-bold text-primary hover:underline"
              >
                Ver completa
              </button>
            </div>

            {standingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : topScorers.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <div className="size-14 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-2xl text-slate-400">sports_soccer</span>
                </div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No hay goles registrados</p>
                <p className="text-xs text-slate-500 mt-1">Los goleadores aparecerán aquí</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {topScorers.slice(0, 10).map((scorer, index) => (
                  <div
                    key={scorer.playerId}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                      index < 3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                      index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-slate-300 text-slate-700' :
                      index === 2 ? 'bg-orange-400 text-orange-900' :
                      'bg-slate-100 dark:bg-slate-700 text-slate-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600 shrink-0">
                      {scorer.photoUrl ? (
                        <img src={scorer.photoUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <span className="material-symbols-outlined text-lg">person</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{scorer.name}</div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        {scorer.teamShield && (
                          <img src={scorer.teamShield} className="size-3 object-contain" />
                        )}
                        <span className="truncate">{scorer.teamName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-black text-primary">{scorer.goals}</span>
                      <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardScreen;
