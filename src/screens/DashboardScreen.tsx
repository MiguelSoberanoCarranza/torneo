import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const DashboardScreen: React.FC = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  // const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [followedLeagueIds, setFollowedLeagueIds] = useState<string[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  // ... LiveTimer ...
  const LiveTimer = ({ match }: { match: any }) => {
    // ...
    const [time, setTime] = useState(match.elapsed_seconds || 0);

    useEffect(() => {
      // Calculate initial time based on last_start_time
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



  // ... (LiveTimer component remains same)

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

      // 2. Fetch User's Follows (if logged in)
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

      // 3. Determine Scope & Fetch Leagues
      let currentLeagues: any[] = [];
      let leagueIds: string[] = [];

      // Strategy: Fetch ALL public leagues for guest (limit 20?), 
      // or if user logged in, fetch followed + created + public fallback.
      // Simplify: Fetch top 20 leagues, then sort followed to top.
      // Or better: Fetch specific followed leagues + generic public list.

      if (user) {
        // Fetch User's Created Leagues
        const { data: myLeagues } = await supabase
          .from('leagues')
          .select('*')
          .eq('owner_id', user.id);

        if (myLeagues) currentLeagues = [...currentLeagues, ...myLeagues];
      }

      // Always fetch public/active leagues to fill selector
      const { data: publicLeagues } = await supabase
        .from('leagues')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (publicLeagues) {
        // Merge without duplicates
        const existingIds = new Set(currentLeagues.map(l => l.id));
        publicLeagues.forEach(l => {
          if (!existingIds.has(l.id)) {
            currentLeagues.push(l);
          }
        });
      }

      // Sort: Followed first, then Created, then others
      currentLeagues.sort((a, b) => {
        const aFollow = myFollows.includes(a.id) ? 1 : 0;
        const bFollow = myFollows.includes(b.id) ? 1 : 0;
        if (aFollow !== bFollow) return bFollow - aFollow; // Followed first
        return 0; // Keep existing order (created/date)
      });

      setLeagues(currentLeagues);

      if (currentLeagues.length > 0) {
        // Auto-select logic
        // If NO selection yet, OR current selection not in list (edge case)
        if (!selectedLeagueId) {
          // If user follows exactly ONE league, pick it. 
          // If user follows multiple, pick first followed.
          // If none, pick first in list.
          if (myFollows.length > 0) {
            // The sorted list puts followed at top, so index 0 is best guess
            setSelectedLeagueId(currentLeagues[0].id);
          } else {
            setSelectedLeagueId(currentLeagues[0].id);
          }
        }
        leagueIds = currentLeagues.map(l => l.id);
      }

      // Check if current selected is followed
      // (Will update in useEffect[selectedLeagueId] too)

      // ... (Matches fetching remains same logic, implicitly uses leagueIds which contains everything needed? 
      // Wait, matches fetch uses `leagueIds` array. If we fetch matches for ALL leagues, that ensures 
      // we have data when switching selector. Good.)
      if (leagueIds.length > 0) {
        // Live Matches
        const { data: live } = await supabase
          .from('matches')
          .select(`
            *, 
            home_team:teams!matches_home_team_id_fkey(name, shield_url), 
            away_team:teams!matches_away_team_id_fkey(name, shield_url)
          `)
          .in('league_id', leagueIds)
          .in('status', ['live', 'break']);

        if (live) {
          const matchIds = (live as any[]).map(m => m.id);
          const { data: events } = await supabase
            .from('match_events')
            .select('*, player:players(name)')
            .in('match_id', matchIds)
            .order('created_at', { ascending: true });

          const formattedLive = (live as any[]).map(m => {
            const matchEvents = events ? events.filter(e => e.match_id === m.id) : [];
            return {
              ...m,
              home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
              away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team,
              events: matchEvents
            };
          });
          setLiveMatches(formattedLive);
        }

        // Upcoming
        const { data: upcoming } = await supabase
          .from('matches')
          .select(`*, home_team:teams!matches_home_team_id_fkey(name, shield_url), away_team:teams!matches_away_team_id_fkey(name, shield_url)`)
          .in('league_id', leagueIds)
          .eq('status', 'scheduled')
          .gt('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(10);

        if (upcoming) {
          const formattedUpcoming = (upcoming as any[]).map(m => ({
            ...m,
            home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
            away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team,
          }));
          setUpcomingMatches(formattedUpcoming);
        }

        // Recent
        const { data: recent } = await supabase
          .from('matches')
          .select(`*, home_team:teams!matches_home_team_id_fkey(name, shield_url), away_team:teams!matches_away_team_id_fkey(name, shield_url)`)
          .in('league_id', leagueIds)
          .eq('status', 'finished')
          .order('start_time', { ascending: false })
          .limit(10);

        if (recent) {
          const formattedRecent = (recent as any[]).map(m => ({
            ...m,
            home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
            away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team,
          }));
          setRecentMatches(formattedRecent);
        }
      }

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Update isFollowing when selection changes or follows change
  useEffect(() => {
    setIsFollowing(followedLeagueIds.includes(selectedLeagueId));
  }, [selectedLeagueId, followedLeagueIds]);

  const toggleFollow = async () => {
    if (!user) {
      // Prompt login if guest? For now just return or simple alert
      alert('Inicia sesión para seguir ligas.');
      return;
    }
    const isCurrentlyFollowing = followedLeagueIds.includes(selectedLeagueId);

    if (isCurrentlyFollowing) {
      // Unfollow
      const { error } = await supabase
        .from('league_followers')
        .delete()
        .eq('user_id', user.id)
        .eq('league_id', selectedLeagueId);

      if (!error) {
        setFollowedLeagueIds(prev => prev.filter(id => id !== selectedLeagueId));
      }
    } else {
      // Follow
      const { error } = await supabase
        .from('league_followers')
        .insert([{ user_id: user.id, league_id: selectedLeagueId }]);

      if (!error) {
        setFollowedLeagueIds(prev => [...prev, selectedLeagueId]);
      }
    }
  };

  /* Listen to Changes */
  // ... existing listener useEffect ...

  // ... handleLogout ...
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

  // Filtered Lists
  const displayedLive = liveMatches.filter(m => m.league_id === selectedLeagueId);
  const displayedUpcoming = upcomingMatches.filter(m => m.league_id === selectedLeagueId);
  const displayedRecent = recentMatches.filter(m => m.league_id === selectedLeagueId);

  if (loading) {
    // ... spinner
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased min-h-screen pb-24">
      {/* Top App Bar / Sticky Header Container */}
      <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            {/* User Profile / Guest Header */}
            <div
              className={`flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => user ? navigate('/profile') : navigate('/admin-login')}
            >
              {/* ... User Avatar ... */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ring-2 ring-white dark:ring-slate-800 shadow-md flex items-center justify-center">
                  {user?.profile?.avatar_url ? (
                    <img src={user.profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-slate-400 dark:text-slate-500">person</span>
                  )}
                </div>
                {user && <div className="absolute bottom-0 right-0 size-3 rounded-full bg-green-500 border-2 border-background-light dark:border-background-dark"></div>}
              </div>
              <div className="flex flex-col">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{user ? 'Bienvenido' : 'Hola,'}</p>
                <h2 className="text-sm font-bold leading-tight truncate max-w-[120px]">
                  {user ? (user.profile?.full_name || user.email?.split('@')[0] || 'Usuario') : 'Invitado'}
                </h2>
              </div>
            </div>

            {/* League Selector (Revised) */}
            <div className="flex-1 px-4 flex justify-end md:justify-center items-center gap-2">
              {leagues.length > 0 && (
                <>
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 pr-3 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400 pl-2">Liga:</span>
                    <select
                      value={selectedLeagueId}
                      onChange={(e) => setSelectedLeagueId(e.target.value)}
                      className="bg-transparent border-none text-sm font-bold max-w-[140px] truncate outline-none focus:ring-0 cursor-pointer text-slate-800 dark:text-white appearance-none"
                    >
                      {leagues.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name} {followedLeagueIds.includes(l.id) ? '★' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={toggleFollow}
                    className={`p-2 rounded-full transition-colors ${isFollowing ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    title={isFollowing ? "Dejar de seguir" : "Seguir liga"}
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: isFollowing ? "'FILL' 1" : "'FILL' 0" }}>
                      {isFollowing ? 'star' : 'star'}
                    </span>
                  </button>
                </>
              )}
            </div>

            {/* Action Icons (Search + Logout) */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Search button ... */}
              {user && leagues.find(l => l.id === selectedLeagueId)?.owner_id === user.id && (
                <button
                  onClick={() => navigate('/create-match')}
                  className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  title="Crear Partido"
                >
                  <span className="material-symbols-outlined">add_circle</span>
                </button>
              )}
              {/* Search button ... */}
              <button className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
                <span className="material-symbols-outlined">search</span>
              </button>

              {user ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center size-10 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Cerrar Sesión"
                >
                  <span className="material-symbols-outlined">logout</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/admin-login')}
                  className="flex items-center justify-center px-4 h-10 rounded-full bg-primary text-white text-xs font-bold shadow-md hover:bg-blue-600 transition-colors"
                >
                  Ingresar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Responsive Container */}
      <div className="max-w-7xl mx-auto w-full flex flex-col px-4 sm:px-6 lg:px-8">


        {/* Live Now Section */}
        {displayedLive.length > 0 && (
          <div className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2.5 bg-red-500"></span>
              </div>
              <h3 className="text-lg font-bold tracking-tight">En Juego</h3>
            </div>

            <div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
              {displayedLive.map(match => (
                <div key={match.id} className="min-w-[85vw] sm:min-w-0 snap-center md:snap-align-none">
                  <div className="bg-slate-900 rounded-3xl p-4 text-white shadow-xl relative overflow-hidden h-full flex flex-col justify-between">
                    {/* Background decorations */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -tranne-y-1/2 translate-x-1/2"></div>

                    {/* Header: League & Timer */}
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <span className="text-xs font-bold bg-white/10 px-2 py-1 rounded-lg backdrop-blur-md border border-white/5">
                        {match.league_id === leagues[0]?.id ? leagues[0]?.name : 'Liga'}
                      </span>
                      <LiveTimer match={match} />
                    </div>

                    {/* Score Board */}
                    <div className="flex items-center justify-between mb-6 relative z-10">
                      {/* Team A */}
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <div className="size-16 rounded-full bg-white/10 p-1 backdrop-blur-sm border border-white/10">
                          {match.home_team?.shield_url ? (
                            <img alt={match.home_team.name} className="w-full h-full rounded-full object-cover" src={match.home_team.shield_url} />
                          ) : (
                            <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs">{match.home_team?.name?.substring(0, 3)}</div>
                          )}
                        </div>
                        <span className="text-sm font-bold text-center leading-tight max-w-[100px] truncate">{match.home_team?.name}</span>
                        {/* Cards Summary */}
                        <div className="flex gap-1">
                          {[...Array(match.events?.filter((e: any) => e.team_id === match.home_team_id && e.event_type === 'yellow_card').length || 0)].map((_, i) => (
                            <div key={`y-${i}`} className="w-2 h-3 bg-yellow-400 rounded-sm"></div>
                          ))}
                          {[...Array(match.events?.filter((e: any) => e.team_id === match.home_team_id && e.event_type === 'red_card').length || 0)].map((_, i) => (
                            <div key={`r-${i}`} className="w-2 h-3 bg-red-600 rounded-sm"></div>
                          ))}
                        </div>
                      </div>

                      {/* Score */}
                      <div className="flex flex-col items-center px-4">
                        <div className="text-5xl font-display font-black tracking-widest tabular-nums leading-none mb-1">
                          {match.home_score}<span className="text-slate-500 mx-1">-</span>{match.away_score}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">En Vivo</div>
                      </div>

                      {/* Team B */}
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <div className="size-16 rounded-full bg-white/10 p-1 backdrop-blur-sm border border-white/10">
                          {match.away_team?.shield_url ? (
                            <img alt={match.away_team.name} className="w-full h-full rounded-full object-cover" src={match.away_team.shield_url} />
                          ) : (
                            <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs">{match.away_team?.name?.substring(0, 3)}</div>
                          )}
                        </div>
                        <span className="text-sm font-bold text-center leading-tight max-w-[100px] truncate">{match.away_team?.name}</span>
                        {/* Cards Summary */}
                        <div className="flex gap-1">
                          {[...Array(match.events?.filter((e: any) => e.team_id === match.away_team_id && e.event_type === 'yellow_card').length || 0)].map((_, i) => (
                            <div key={`y-${i}`} className="w-2 h-3 bg-yellow-400 rounded-sm"></div>
                          ))}
                          {[...Array(match.events?.filter((e: any) => e.team_id === match.away_team_id && e.event_type === 'red_card').length || 0)].map((_, i) => (
                            <div key={`r-${i}`} className="w-2 h-3 bg-red-600 rounded-sm"></div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Events / Goals List */}
                    {match.events && match.events.filter((e: any) => e.event_type === 'goal').length > 0 && (
                      <div className="bg-white/5 rounded-xl p-2 backdrop-blur-sm border border-white/5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Goles</p>
                        <div className="flex flex-col gap-1 max-h-[60px] overflow-y-auto no-scrollbar">
                          {match.events.filter((e: any) => e.event_type === 'goal').map((goal: any, idx: number) => {
                            const isHome = goal.team_id === match.home_team_id;
                            return (
                              <div key={idx} className={`flex items-center text-xs ${isHome ? 'justify-start' : 'justify-end'}`}>
                                <span className="text-white font-medium">{goal.player?.name || 'Jugador'}</span>
                                <span className="text-emerald-400 font-bold ml-1">
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
        <div className="py-2">
          <h3 className="text-lg font-bold tracking-tight mb-3">Próximos Partidos</h3>
          {displayedUpcoming.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No hay partidos programados pronto.</p>
          ) : (
            <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
              {displayedUpcoming.map((match, index) => {
                const dateLabel = formatDateSimple(match.start_time);
                const prevMatch = displayedUpcoming[index - 1];
                const prevDateLabel = prevMatch ? formatDateSimple(prevMatch.start_time) : null;
                const showHeader = dateLabel !== prevDateLabel;

                return (
                  <React.Fragment key={match.id}>
                    {showHeader && (
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-1 md:col-span-2 lg:col-span-3">{dateLabel}</p>
                    )}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-4 flex items-center shadow-sm border border-slate-200 dark:border-slate-800 h-full hover:shadow-md transition-shadow">
                      <div className="flex flex-col items-center justify-center w-14 border-r border-slate-100 dark:border-slate-700 pr-4 mr-4">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{formatTime(match.start_time)}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Hora</span>
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        {/* Home Team */}
                        <div className="flex-1 flex flex-col items-end gap-1">
                          <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                            {match.home_team?.shield_url ? <img src={match.home_team.shield_url} className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{match.home_team?.name?.substring(0, 2).toUpperCase()}</span>}
                          </div>
                          <span className="font-bold text-xs text-right truncate w-full">{match.home_team?.name}</span>
                        </div>

                        <div className="px-3 flex flex-col items-center">
                          <span className="text-xs font-black text-slate-300">VS</span>
                        </div>

                        {/* Away Team */}
                        <div className="flex-1 flex flex-col items-start gap-1">
                          <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                            {match.away_team?.shield_url ? <img src={match.away_team.shield_url} className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{match.away_team?.name?.substring(0, 2).toUpperCase()}</span>}
                          </div>
                          <span className="font-bold text-xs text-left truncate w-full">{match.away_team?.name}</span>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Results */}
        {displayedRecent.length > 0 && (
          <div className="py-4 pb-8">
            <h3 className="text-lg font-bold tracking-tight mb-3">Resultados Recientes</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {displayedRecent.map(match => (
                <div
                  key={match.id}
                  onClick={() => navigate(`/match/${match.id}`)}
                  className="bg-white dark:bg-surface-dark rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-2 hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">{match.league?.name || 'Liga'}</span>
                    <span className="text-[10px] text-slate-500">{formatDateSimple(match.start_time)}</span>
                  </div>

                  {/* Home Team Row */}
                  <div className={`flex justify-between items-center ${match.home_score > match.away_score ? 'opacity-100' : 'opacity-70'}`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="size-5 rounded-full bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                        {match.home_team?.shield_url && <img src={match.home_team.shield_url} className="w-full h-full object-cover" />}
                      </div>
                      <span className={`text-sm truncate ${match.home_score > match.away_score ? 'font-black text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                        {match.home_team?.name}
                      </span>
                    </div>
                    <span className={`text-sm ${match.home_score > match.away_score ? 'font-black text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                      {match.home_score}
                    </span>
                  </div>

                  {/* Away Team Row */}
                  <div className={`flex justify-between items-center ${match.away_score > match.home_score ? 'opacity-100' : 'opacity-70'}`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="size-5 rounded-full bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                        {match.away_team?.shield_url && <img src={match.away_team.shield_url} className="w-full h-full object-cover" />}
                      </div>
                      <span className={`text-sm truncate ${match.away_score > match.home_score ? 'font-black text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                        {match.away_team?.name}
                      </span>
                    </div>
                    <span className={`text-sm ${match.away_score > match.home_score ? 'font-black text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                      {match.away_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


export default DashboardScreen;
