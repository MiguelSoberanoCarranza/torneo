import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

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

interface Match {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  start_time: string;
  status: string;
  home_team?: any;
  away_team?: any;
}

const LeaguePublicScreen: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [league, setLeague] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingTeam[]>([]);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'standings'>('home');
  const [visibleHomeRounds, setVisibleHomeRounds] = useState(2);
  const [visibleUpcomingRounds, setVisibleUpcomingRounds] = useState(2);

  useEffect(() => {
    fetchLeagueData();
  }, [slug, location.key]);

  const fetchLeagueData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener usuario actual (si está logueado)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (!slug) {
        setError('Liga no encontrada');
        return;
      }

      // Fetch league por slug
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (leagueError || !leagueData) {
        setError('Liga no encontrada');
        return;
      }

      // Si la liga no es pública y el usuario no está autenticado, mostrar login
      if (!leagueData.is_public) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Esta liga es privada. Iniciá sesión para acceder.');
          setLeague(leagueData);
          return;
        }
        // Si está autenticado pero no tiene acceso, la RLS ya filtró
      }

      setLeague(leagueData);
      const leagueId = leagueData.id;

      // Fetch standings
      const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId);

      const { data: matchesData } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(name, shield_url),
          away_team:teams!matches_away_team_id_fkey(name, shield_url)
        `)
        .eq('league_id', leagueId)
        .order('start_time', { ascending: false });

      if (matchesData) {
        const formattedMatches = (matchesData as any[]).map(m => ({
          ...m,
          home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
          away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team,
        }));
        setMatches(formattedMatches);

        // Calculate standings
        if (teams) {
          const finishedMatches = matchesData.filter((m: any) => m.status === 'finished');
          const stats = teams.map((team: any) => {
            let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;

            finishedMatches.forEach((match: any) => {
              const isHome = match.home_team_id === team.id;
              const isAway = match.away_team_id === team.id;

              if (isHome || isAway) {
                const homeScore = match.home_score ?? 0;
                const awayScore = match.away_score ?? 0;

                if (homeScore !== null && awayScore !== null) {
                  played++;
                  const teamScore = isHome ? homeScore : awayScore;
                  const opponentScore = isHome ? awayScore : homeScore;

                  gf += Math.max(0, teamScore);
                  ga += Math.max(0, opponentScore);

                  if (teamScore > opponentScore) won++;
                  else if (teamScore === opponentScore) drawn++;
                  else lost++;
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

          stats.sort((a: any, b: any) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
          setStandings(stats);
        }

        // Fetch top scorers
        const matchIds = matchesData.filter((m: any) => m.status === 'finished').map((m: any) => m.id);
        if (matchIds.length > 0) {
          const { data: events } = await supabase
            .from('match_events')
            .select(`
              event_type, player_id, team_id,
              player:players!match_events_player_id_fkey(name, photo_url, team_id)
            `)
            .in('match_id', matchIds)
            .eq('event_type', 'goal');

          if (events) {
            // Necesitamos los equipos también
            const { data: allTeams } = await supabase
              .from('teams')
              .select('id, name, shield_url')
              .in('id', (events as any[]).map(e => e.team_id).filter(Boolean));

            const teamsMap = new Map((allTeams || []).map((t: any) => [t.id, t]));

            const goalsMap = new Map<string, TopScorer>();
            events.forEach((ev: any) => {
              if (!ev.player) return;
              const team = teamsMap.get(ev.team_id);
              const current = goalsMap.get(ev.player_id) || {
                playerId: ev.player_id,
                name: ev.player.name,
                photoUrl: ev.player.photo_url,
                teamName: team?.name || 'Unknown',
                teamShield: team?.shield_url || null,
                goals: 0
              };
              current.goals++;
              goalsMap.set(ev.player_id, current);
            });
            setTopScorers(Array.from(goalsMap.values()).sort((a, b) => b.goals - a.goals));
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar la liga');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // Helper para mostrar el score: si ambos son -1 (perdido-perdido) muestra "P - P"
  const formatScore = (homeScore: number | null, awayScore: number | null): { home: string; away: string } => {
    if (homeScore === -1 && awayScore === -1) {
      return { home: 'P', away: 'P' };
    }
    return {
      home: homeScore === null ? '-' : String(homeScore),
      away: awayScore === null ? '-' : String(awayScore)
    };
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-4">
        <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">error</span>
        <h1 className="text-2xl font-bold mb-2">Liga no encontrada</h1>
        <p className="text-slate-500 mb-4">{error}</p>
        <Link to="/" className="text-primary font-bold hover:underline">
          Ir al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased min-h-screen pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <Link
              to={user && league?.owner_id === user.id ? `/league/${league?.id}` : '/admin-login'}
              className="text-sm font-bold opacity-80 hover:opacity-100 flex items-center gap-1"
            >
              {user && league?.owner_id === user.id ? (
                <>
                  <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                  Gestionar
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">login</span>
                  Iniciar sesión
                </>
              )}
            </Link>
          </div>
          
          <h1 className="text-3xl font-black mb-2">{league.name}</h1>
          {league.description && (
            <p className="opacity-80 text-sm mb-4">{league.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm opacity-70">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-lg">groups</span>
              {standings.length} equipos
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-lg">sports_soccer</span>
              {matches.filter(m => m.status === 'finished').length} partidos
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1 py-2 justify-center">
            <button
              onClick={() => setActiveTab('home')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'home' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Inicio
            </button>
            <button
              onClick={() => setActiveTab('standings')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1 ${
                activeTab === 'standings' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-base">leaderboard</span>
              Tabla
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Top 3 Standings */}
            <div>
              <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">leaderboard</span>
                Líderes
              </h2>
              {standings.length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500">No hay equipos registrados</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {standings.slice(0, 3).map((team, index) => (
                    <div
                      key={team.id}
                      className={`relative bg-white dark:bg-slate-800 rounded-2xl p-4 text-center border ${
                        index === 0 ? 'border-yellow-400 shadow-lg shadow-yellow-400/20' :
                        index === 1 ? 'border-slate-300 dark:border-slate-600' :
                        'border-orange-400 dark:border-orange-600'
                      }`}
                    >
                      {index === 0 && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-black px-3 py-1 rounded-full">
                          1°
                        </div>
                      )}
                      <div className="size-16 mx-auto mb-2 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-slate-200 dark:border-slate-600">
                        {team.shield_url ? (
                          <img src={team.shield_url} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl font-black text-slate-400">{team.name.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm truncate">{team.name}</h3>
                      <p className="text-2xl font-black text-primary">{team.points} pts</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Próximos Partidos - LIGUILLA PRIMERO si hay, después jornadas */}
            {(() => {
              const upcoming = matches.filter(m => m.status === 'scheduled');
              if (upcoming.length === 0) return null;

              // Separar liguilla de jornadas normales
              const upcomingLiguilla = upcoming.filter(m => (m.round_number ?? 1) >= 100);
              const upcomingNormal = upcoming.filter(m => (m.round_number ?? 1) < 100);

              // Ordenar cada grupo: más reciente primero (descendente por fecha).
              // Los partidos sin fecha van al final.
              const sortByRecent = (a: any, b: any) => {
                const aHas = !!a.start_time;
                const bHas = !!b.start_time;
                if (!aHas && !bHas) return 0;
                if (!aHas) return 1;
                if (!bHas) return -1;
                return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
              };
              upcomingLiguilla.sort(sortByRecent);
              upcomingNormal.sort(sortByRecent);

              // LIGUILLA primero (con diseño destacado en amber)
              const renderRound = (matchList: any[], isLiguilla: boolean) => {
                if (matchList.length === 0) return null;
                const round = matchList[0].round_number ?? 1;
                const roundName = isLiguilla
                  ? `Liguilla - Ronda ${Number(round) - 99}`
                  : `Jornada ${round}`;

                return (
                  <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className={`text-xs font-black uppercase tracking-wider ${isLiguilla ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}>
                        {roundName}
                      </span>
                      <div className={`flex-1 h-px ${isLiguilla ? 'bg-amber-200 dark:bg-amber-900' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      <span className="text-[10px] text-slate-400 font-bold">{matchList.length} partido{matchList.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="space-y-2">
                      {matchList.map(match => (
                        <div key={match.id} className={`bg-white dark:bg-slate-800 rounded-xl p-3 border ${
                          isLiguilla ? 'border-amber-200 dark:border-amber-900/50' : 'border-slate-200 dark:border-slate-700'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] text-slate-400 font-bold">{formatDate(match.start_time)} • {formatTime(match.start_time)}</span>
                            {match.leg && match.leg > 1 && (
                              <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold uppercase">Vuelta</span>
                            )}
                          </div>
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                            <div className="flex items-center gap-2 justify-end min-w-0">
                              <span className="font-bold text-sm truncate text-right">{match.home_team?.name}</span>
                              <div className="size-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                {match.home_team?.shield_url ? (
                                  <img src={match.home_team.shield_url} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[9px] font-bold text-slate-400">{match.home_team?.name?.substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                            </div>
                            <div className="px-2">
                              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">VS</span>
                            </div>
                            <div className="flex items-center gap-2 justify-start min-w-0">
                              <div className="size-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                {match.away_team?.shield_url ? (
                                  <img src={match.away_team.shield_url} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[9px] font-bold text-slate-400">{match.away_team?.name?.substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <span className="font-bold text-sm truncate">{match.away_team?.name}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              };

              return (
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="material-symbols-outlined text-primary text-base">schedule</span>
                    <h2 className="text-lg font-black flex items-center gap-2">
                      Próximos Partidos
                    </h2>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    <span className="text-[10px] text-slate-400 font-bold">{upcoming.length} partido{upcoming.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="space-y-4">
                    {/* LIGUILLA primero */}
                    {upcomingLiguilla.length > 0 && renderRound(upcomingLiguilla, true)}
                    {/* Después jornadas normales */}
                    {upcomingNormal.length > 0 && renderRound(upcomingNormal, false)}
                  </div>
                </div>
              );
            })()}

            {/* Top Scorers - MOVIDO a la pestaña Tabla */}

            {/* Resultados Recientes - solo jornadas normales (no liguilla) */}
            {(() => {
              const finishedNormal = matches
                .filter(m => m.status === 'finished' && (m.round_number ?? 1) < 100);

              if (finishedNormal.length === 0) return null;

              // Agrupar por jornada (round_number)
              const byRound: Record<string, any[]> = {};
              finishedNormal.forEach((m: any) => {
                const round = m.round_number ?? 1;
                if (!byRound[round]) byRound[round] = [];
                byRound[round].push(m);
              });

              // Ordenar partidos dentro de cada jornada por hora
              Object.keys(byRound).forEach(round => {
                byRound[round].sort((a, b) =>
                  new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
                );
              });

              const sortedRounds = Object.entries(byRound).sort(([a], [b]) => Number(b) - Number(a));
              const visibleRounds = sortedRounds.slice(0, visibleHomeRounds);
              const hasMore = sortedRounds.length > visibleHomeRounds;

              return (
                <div>
                  <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">history</span>
                    Resultados Recientes
                  </h2>
                  <div className="space-y-4">
                    {visibleRounds.map(([round, roundMatches]) => (
                      <div key={round}>
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                            Jornada {round}
                          </span>
                          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                          <span className="text-[10px] text-slate-400 font-bold">{roundMatches.length} partido{roundMatches.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="space-y-2">
                          {roundMatches.map((match: any) => (
                            <MatchCard key={match.id} match={match} formatDate={formatDate} formatScore={formatScore} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasMore && (
                    <button
                      onClick={() => setVisibleHomeRounds(prev => prev + 1)}
                      className="w-full mt-3 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">expand_more</span>
                      Ver jornada anterior ({sortedRounds.length - visibleHomeRounds} restantes)
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Liguilla - Brackets dinámicos según tabla */}
            {standings.length >= 2 && (() => {
              const liguillaMatches = matches.filter(m => (m.round_number ?? 1) >= 100);
              const numTeams = standings.length;
              const liguillaSize = league?.settings?.liguilla_size || 4;
              const qualifiedCount = Math.min(liguillaSize, numTeams >= 8 ? 8 : numTeams >= 4 ? 4 : 2);

              // Solo mostrar si hay partidos de liguilla O si la liga tiene suficientes equipos
              if (liguillaMatches.length === 0 && numTeams < 4) return null;

              return (
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="material-symbols-outlined text-amber-500">emoji_events</span>
                    <h2 className="text-lg font-black">Liguilla</h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-amber-200 via-amber-400 to-transparent dark:from-amber-900 dark:via-amber-700 dark:to-transparent" />
                  </div>
                  <DynamicBracket
                    standings={standings}
                    matches={matches}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    formatScore={formatScore}
                    liguillaSize={liguillaSize}
                  />
                </div>
              );
            })()}
          </div>
        )}

        {/* STANDINGS TAB */}
        {activeTab === 'standings' && (
          <div>
            {standings.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">groups_3</span>
                <p className="text-slate-500">No hay equipos registrados</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="grid grid-cols-[40px_1fr_repeat(4,40px)_50px] gap-1 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase text-slate-500 font-bold">
                  <span className="text-center">#</span>
                  <span>Equipo</span>
                  <span className="text-center">PJ</span>
                  <span className="text-center">G</span>
                  <span className="text-center">E</span>
                  <span className="text-center">P</span>
                  <span className="text-center font-black text-slate-900 dark:text-white">PTS</span>
                </div>
                {standings.map((team, index) => (
                  <div
                    key={team.id}
                    className={`grid grid-cols-[40px_1fr_repeat(4,40px)_50px] gap-1 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 ${
                      index < 4 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <span className={`text-center font-bold ${index < 4 ? 'text-blue-600' : 'text-slate-400'}`}>
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
                    <span className="text-center font-bold text-slate-600">{team.played}</span>
                    <span className="text-center text-slate-500">{team.won}</span>
                    <span className="text-center text-slate-500">{team.drawn}</span>
                    <span className="text-center text-slate-500">{team.lost}</span>
                    <span className="text-center font-black text-primary text-lg">{team.points}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Goleadores - movido desde Inicio */}
            {topScorers.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">sports_soccer</span>
                  Goleadores
                </h2>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  {topScorers.map((scorer, index) => (
                    <div
                      key={scorer.playerId}
                      className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-slate-300 text-slate-700' :
                        index === 2 ? 'bg-orange-400 text-orange-900' :
                        'bg-slate-100 dark:bg-slate-700 text-slate-500'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                        {scorer.photoUrl ? (
                          <img src={scorer.photoUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined">person</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{scorer.name}</p>
                        <p className="text-xs text-slate-500 truncate">{scorer.teamName}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xl font-black text-primary">{scorer.goals}</span>
                        <span className="material-symbols-outlined text-emerald-500 text-lg">sports_soccer</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================
// Componente reutilizable para mostrar un partido
// =====================================================
interface MatchCardProps {
  match: any;
  formatDate: (date: string) => string;
  formatScore: (home: number | null, away: number | null) => { home: string; away: string };
}

const MatchCard: React.FC<MatchCardProps> = ({ match, formatDate, formatScore }) => {
  const s = formatScore(match.home_score, match.away_score);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-400 font-bold">{formatDate(match.start_time)}</span>
        <div className="flex items-center gap-1">
          {match.leg && match.leg > 1 && (
            <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold uppercase">Vuelta</span>
          )}
          {match.round_number && match.round_number >= 100 && (
            <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-bold uppercase">Liguilla</span>
          )}
        </div>
      </div>
      {/* Grid de 3 columnas fijas: home | score | away */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Home team - alineado a la derecha */}
        <div className="flex items-center gap-2 justify-end min-w-0">
          <span className={`font-bold text-sm truncate text-right ${match.home_score > match.away_score ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
            {match.home_team?.name}
          </span>
          <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
            {match.home_team?.shield_url ? (
              <img src={match.home_team.shield_url} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-slate-400">{match.home_team?.name?.substring(0, 2).toUpperCase()}</span>
            )}
          </div>
        </div>
        {/* Score centrado */}
        <div className="flex items-center gap-1.5 px-2">
          <span className={`text-xl font-black tabular-nums ${
            (match.home_score ?? 0) > (match.away_score ?? 0) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
          }`}>
            {s.home}
          </span>
          <span className="text-slate-300 text-sm font-light">-</span>
          <span className={`text-xl font-black tabular-nums ${
            (match.away_score ?? 0) > (match.home_score ?? 0) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
          }`}>
            {s.away}
          </span>
        </div>
        {/* Away team - alineado a la izquierda */}
        <div className="flex items-center gap-2 justify-start min-w-0">
          <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
            {match.away_team?.shield_url ? (
              <img src={match.away_team.shield_url} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-slate-400">{match.away_team?.name?.substring(0, 2).toUpperCase()}</span>
            )}
          </div>
          <span className={`font-bold text-sm truncate ${match.away_score > match.home_score ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
            {match.away_team?.name}
          </span>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// Componente de Brackets DINÁMICOS según tabla de posiciones
// =====================================================
interface DynamicBracketProps {
  standings: StandingTeam[];
  matches: any[]; // Todos los partidos
  formatDate: (date: string) => string;
  formatTime: (date: string) => string;
  formatScore: (home: number | null, away: number | null) => { home: string; away: string };
  liguillaSize?: number; // 4 u 8, configurado en CreateLeagueScreen
}

const DynamicBracket: React.FC<DynamicBracketProps> = ({ standings, matches, formatDate, formatTime, formatScore, liguillaSize = 4 }) => {
  // Determinar cuántos equipos van a liguilla
  // Prioridad: configuración de la liga → fallback según cantidad de equipos
  const numTeams = standings.length;
  const configured = liguillaSize;
  // Si hay menos equipos que los configurados, ajustar
  const qualifiedCount = Math.min(configured, numTeams >= 8 ? 8 : numTeams >= 4 ? 4 : 2);

  if (numTeams < 2) return null;

  const qualified = standings.slice(0, qualifiedCount);

  // Generar los cruces según formato
  // Para 8: 1v8, 4v5, 3v6, 2v7
  // Para 4: 1v4, 2v3
  // Para 2: 1v2
  const getMatchups = (count: number) => {
    if (count === 8) {
      return [
        { home: 0, away: 7, label: '1° vs 8°' },
        { home: 3, away: 4, label: '4° vs 5°' },
        { home: 2, away: 5, label: '3° vs 6°' },
        { home: 1, away: 6, label: '2° vs 7°' },
      ];
    } else if (count === 4) {
      return [
        { home: 0, away: 3, label: '1° vs 4°' },
        { home: 1, away: 2, label: '2° vs 3°' },
      ];
    } else {
      return [
        { home: 0, away: 1, label: '1° vs 2°' },
      ];
    }
  };

  const matchups = getMatchups(qualifiedCount);

  // Obtener partidos de liguilla existentes en BD
  const liguillaMatches = matches.filter(m => (m.round_number ?? 1) >= 100);

  // Helper: buscar un partido existente por equipos
  const findMatch = (homeTeamId: string, awayTeamId: string) => {
    return liguillaMatches.find((m: any) =>
      (m.home_team_id === homeTeamId && m.away_team_id === awayTeamId) ||
      (m.home_team_id === awayTeamId && m.away_team_id === homeTeamId)
    );
  };

  // Helper: obtener el ganador de un partido
  const getWinner = (match: any) => {
    if (!match || match.status !== 'finished') return null;
    if ((match.home_score ?? 0) > (match.away_score ?? 0)) return match.home_team_id;
    if ((match.away_score ?? 0) > (match.home_score ?? 0)) return match.away_team_id;
    return null;
  };

  // Para cada matchup, buscar partido existente
  const renderMatchup = (matchup: typeof matchups[0], index: number) => {
    const homeTeam = qualified[matchup.home];
    const awayTeam = qualified[matchup.away];
    if (!homeTeam || !awayTeam) return null;

    const existingMatch = findMatch(homeTeam.id, awayTeam.id);
    const s = existingMatch ? formatScore(existingMatch.home_score, existingMatch.away_score) : null;
    const isFinished = existingMatch?.status === 'finished';
    const isLive = existingMatch?.status === 'live';
    const homeWon = isFinished && existingMatch.home_score > existingMatch.away_score;
    const awayWon = isFinished && existingMatch.away_score > existingMatch.home_score;

    return (
      <div key={index} className={`bg-white dark:bg-slate-800 rounded-xl border-2 overflow-hidden ${
        isLive ? 'border-red-400 shadow-lg shadow-red-400/20' :
        isFinished ? 'border-slate-200 dark:border-slate-700' :
        'border-amber-200 dark:border-amber-900/50'
      }`}>
        {/* Header */}
        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
          <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase">{matchup.label}</span>
          {existingMatch && (
            <span className="text-[9px] font-bold text-slate-500 uppercase">
              {isLive ? '🔴 En vivo' : isFinished ? 'Final' : formatDate(existingMatch.start_time)}
            </span>
          )}
          {!existingMatch && (
            <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase">Por jugarse</span>
          )}
        </div>

        {/* Home team */}
        <div className={`flex items-center gap-2 px-3 py-2 ${
          homeWon ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''
        }`}>
          <div className="size-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
            {homeTeam.shield_url ? (
              <img src={homeTeam.shield_url} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[9px] font-bold text-slate-400">{homeTeam.name.substring(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 w-4">{matchup.home + 1}°</span>
            <span className={`text-sm font-bold truncate ${homeWon ? 'text-emerald-700 dark:text-emerald-400' : awayWon ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
              {homeTeam.name}
            </span>
          </div>
          {s && (
            <span className={`text-lg font-black tabular-nums shrink-0 ${
              isFinished ? (homeWon ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500') : 'text-slate-400'
            }`}>
              {s.home}
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="h-px bg-slate-100 dark:bg-slate-700/50 mx-3" />

        {/* Away team */}
        <div className={`flex items-center gap-2 px-3 py-2 ${
          awayWon ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''
        }`}>
          <div className="size-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
            {awayTeam.shield_url ? (
              <img src={awayTeam.shield_url} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[9px] font-bold text-slate-400">{awayTeam.name.substring(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 w-4">{matchup.away + 1}°</span>
            <span className={`text-sm font-bold truncate ${awayWon ? 'text-emerald-700 dark:text-emerald-400' : homeWon ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
              {awayTeam.name}
            </span>
          </div>
          {s && (
            <span className={`text-lg font-black tabular-nums shrink-0 ${
              isFinished ? (awayWon ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500') : 'text-slate-400'
            }`}>
              {s.away}
            </span>
          )}
        </div>
      </div>
    );
  };

  const roundName = qualifiedCount === 8 ? 'Cuartos de Final' :
    qualifiedCount === 4 ? 'Semifinal' : 'Final';

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="size-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-sm">military_tech</span>
        </div>
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">{roundName}</span>
          <span className="text-[10px] text-slate-500 ml-1">· Top {qualifiedCount} de la tabla</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-200 to-transparent dark:from-amber-900" />
        <span className="text-[10px] text-slate-400 font-bold">{matchups.length} partido{matchups.length === 1 ? '' : 's'}</span>
      </div>
      <div className="space-y-2">
        {matchups.map((m, i) => renderMatchup(m, i))}
      </div>
    </div>
  );
};

export default LeaguePublicScreen;
