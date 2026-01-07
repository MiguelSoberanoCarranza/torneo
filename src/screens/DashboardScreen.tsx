import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const DashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);

  // Helper component for Live Timer
  const LiveTimer = ({ match }: { match: any }) => {
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

  useEffect(() => {
    const fetchUserAndLeagues = async () => {
      console.log('--- Dashboard Init ---');
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current User:', user);
      setUser(user);

      if (user) {
        console.log('Fetching leagues for owner_id:', user.id);
        const { data: leaguesData, error } = await supabase
          .from('leagues')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });

        if (error) console.error('Error fetching leagues:', error);
        if (leaguesData) {
          setLeagues(leaguesData);
          fetchMatches(leaguesData.map(l => l.id));
        }
      }
    };

    // Fetch matches for user's leagues
    const fetchMatches = async (leagueIds: string[]) => {
      if (leagueIds.length === 0) return;

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
        // Fetch events separately to avoid RLS/Join issues hiding the match
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

      // Upcoming Matches
      const { data: upcoming } = await supabase
        .from('matches')
        .select(`*, home_team:teams!matches_home_team_id_fkey(name, shield_url), away_team:teams!matches_away_team_id_fkey(name, shield_url)`)
        .in('league_id', leagueIds)
        .eq('status', 'scheduled')
        .gte('start_time', new Date().toISOString()) // Only future matches
        .order('start_time', { ascending: true })
        .limit(5);

      if (upcoming) {
        const formattedUpcoming = (upcoming as any[]).map(m => ({
          ...m,
          home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
          away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team
        }));
        setUpcomingMatches(formattedUpcoming);
      }

      // Recent Matches
      const { data: recent } = await supabase
        .from('matches')
        .select(`*, home_team:teams!matches_home_team_id_fkey(name, shield_url), away_team:teams!matches_away_team_id_fkey(name, shield_url), league:leagues(name)`)
        .in('league_id', leagueIds)
        .eq('status', 'finished')
        .order('start_time', { ascending: false })
        .limit(4);

      if (recent) {
        const formattedRecent = (recent as any[]).map(m => ({
          ...m,
          home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
          away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team,
          league: Array.isArray(m.league) ? m.league[0] : m.league
        }));
        setRecentMatches(formattedRecent);
      }
    };


    fetchUserAndLeagues();

    // REAL-TIME SUBSCRIPTION
    const matchSubscription = supabase
      .channel('public:matches-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => fetchUserAndLeagues()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_events' },
        () => fetchUserAndLeagues()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchSubscription);
    };
  }, []);

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

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased min-h-screen pb-24">
      {/* Top App Bar / Sticky Header Container */}
      <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            {/* User Profile */}
            <div
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('/profile')}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ring-2 ring-white dark:ring-slate-800 shadow-md flex items-center justify-center">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-slate-400 dark:text-slate-500">person</span>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 size-3 rounded-full bg-green-500 border-2 border-background-light dark:border-background-dark"></div>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bienvenido</p>
                <h2 className="text-sm font-bold leading-tight">
                  {user ? (user.email?.split('@')[0] || 'Admin') : 'Cargando...'}
                </h2>
              </div>
            </div>
            {/* Action Icons */}
            <div className="flex items-center gap-2">
              <button className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
                <span className="material-symbols-outlined">search</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center size-10 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Cerrar Sesión"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Responsive Container */}
      <div className="max-w-7xl mx-auto w-full flex flex-col px-4 sm:px-6 lg:px-8">
        {/* My Leagues Carousel (Keep as carousel mostly but allow wrapping on desktop) */}
        <div className="pt-6 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold tracking-tight">Mis Ligas</h3>
            <button onClick={() => navigate('/directory')} className="text-xs font-semibold text-primary">Ver todas</button>
          </div>
          <div className="flex w-full overflow-x-auto no-scrollbar gap-4 pb-2 md:grid md:grid-cols-4 lg:grid-cols-6 md:overflow-visible flex-wrap">
            {/* Create New League Item */}
            <div className="flex flex-col items-center gap-2 min-w-[80px]">
              <button
                onClick={() => navigate('/create-league')}
                className="size-[80px] rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-400 dark:border-slate-600 text-primary hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-3xl">add</span>
              </button>
              <span className="text-xs font-medium text-center truncate w-full">Crear Liga</span>
            </div>

            {/* Render User Leagues */}
            {leagues.map((league) => (
              <div key={league.id} className="flex flex-col items-center gap-2 min-w-[80px]">
                <button
                  onClick={() => navigate(`/league/${league.id}`)}
                  className="size-[80px] rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:scale-105 transition-transform"
                >
                  {league.logo_url ? (
                    <img src={league.logo_url} alt={league.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-3xl text-slate-400">emoji_events</span>
                  )}
                </button>
                <span className="text-xs font-medium text-center truncate w-full max-w-[80px]">{league.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Now Section */}
        {liveMatches.length > 0 && (
          <div className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2.5 bg-red-500"></span>
              </div>
              <h3 className="text-lg font-bold tracking-tight">En Juego</h3>
            </div>

            <div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
              {liveMatches.map(match => (
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
          {upcomingMatches.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No hay partidos programados pronto.</p>
          ) : (
            <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
              {upcomingMatches.map((match, index) => {
                const dateLabel = formatDateSimple(match.start_time);
                const prevMatch = upcomingMatches[index - 1];
                const prevDateLabel = prevMatch ? formatDateSimple(prevMatch.start_time) : null;
                const showHeader = dateLabel !== prevDateLabel;

                return (
                  <React.Fragment key={match.id}>
                    {showHeader && (
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-1 md:col-span-2 lg:col-span-3">{dateLabel}</p>
                    )}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-3 flex items-center shadow-sm border border-slate-200 dark:border-slate-800 h-full">
                      <div className="flex flex-col items-center justify-center w-12 border-r border-slate-100 dark:border-slate-700 pr-3 mr-2">
                        <span className="text-sm font-bold">{formatTime(match.start_time)}</span>
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        {/* Home Team */}
                        <div className="flex-1 flex items-center gap-2 justify-end">
                          <span className="font-medium text-xs text-right truncate">{match.home_team?.name}</span>
                          <div className="size-6 min-w-[1.5rem] rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold overflow-hidden">
                            {match.home_team?.shield_url ? <img src={match.home_team.shield_url} className="w-full h-full object-cover" /> : match.home_team?.name?.substring(0, 3).toUpperCase()}
                          </div>
                        </div>

                        <span className="text-[10px] uppercase font-bold text-slate-400 px-2">vs</span>

                        {/* Away Team */}
                        <div className="flex-1 flex items-center gap-2 justify-start">
                          <div className="size-6 min-w-[1.5rem] rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold overflow-hidden">
                            {match.away_team?.shield_url ? <img src={match.away_team.shield_url} className="w-full h-full object-cover" /> : match.away_team?.name?.substring(0, 3).toUpperCase()}
                          </div>
                          <span className="font-medium text-xs text-left truncate">{match.away_team?.name}</span>
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
        {recentMatches.length > 0 && (
          <div className="py-4 pb-8">
            <h3 className="text-lg font-bold tracking-tight mb-3">Resultados Recientes</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {recentMatches.map(match => (
                <div key={match.id} className="bg-white dark:bg-surface-dark rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                  <span className="text-[10px] text-slate-400 truncate">{match.league?.name || 'Liga'} • {formatDateSimple(match.start_time)}</span>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold truncate max-w-[80px]">{match.home_team?.name}</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{match.home_score}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-500 truncate max-w-[80px]">{match.away_team?.name}</span>
                    <span className="text-sm font-bold text-slate-500">{match.away_score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Floating Action Button (Admin/Creator) */}
      <div className="fixed bottom-24 right-4 z-30">
        <button
          onClick={() => navigate('/create-match')}
          className="bg-primary hover:bg-blue-600 text-white rounded-full size-14 shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <span className="material-symbols-outlined text-2xl">add</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardScreen;
