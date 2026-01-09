import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const MatchDetailsLiveScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { matchId } = location.state || {};
  const [match, setMatch] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (!matchId) return;
    fetchMatchData();

    const channel = supabase
      .channel('public:matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        setMatch((prev: any) => {
          const updated = { ...prev, ...payload.new };
          // Re-calculate timer base on status change if needed, but the effect below handles ticking
          return updated;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  // Timer effect
  useEffect(() => {
    let interval: any;
    if (match && match.status === 'live') {
      // sync immediately
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else if (match) {
      // If paused/finished, just show elapsed
      setTimer(match.elapsed_seconds || 0);
    }
    return () => clearInterval(interval);
  }, [match]); // Dep on match to catch status/last_start_time updates

  const updateTimer = () => {
    if (!match) return;
    let calculatedTimer = match.elapsed_seconds || 0;
    if (match.status === 'live' && match.last_start_time) {
      const startTime = new Date(match.last_start_time).getTime();
      const now = new Date().getTime();
      const diffInSeconds = Math.floor((now - startTime) / 1000);
      calculatedTimer += diffInSeconds;
    }
    setTimer(calculatedTimer);
  };

  const fetchMatchData = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
            *, 
            home_team:teams!matches_home_team_id_fkey(name, shield_url), 
            away_team:teams!matches_away_team_id_fkey(name, shield_url)
          `)
        .eq('id', matchId)
        .single();

      if (error) throw error;

      const formattedMatch = {
        ...data,
        home_team: Array.isArray(data.home_team) ? data.home_team[0] : data.home_team,
        away_team: Array.isArray(data.away_team) ? data.away_team[0] : data.away_team,
      };

      setMatch(formattedMatch);
      // set initial timer
      let calculatedTimer = formattedMatch.elapsed_seconds || 0;
      if (formattedMatch.status === 'live' && formattedMatch.last_start_time) {
        const startTime = new Date(formattedMatch.last_start_time).getTime();
        const now = new Date().getTime();
        const diffInSeconds = Math.floor((now - startTime) / 1000);
        calculatedTimer += diffInSeconds;
      }
      setTimer(calculatedTimer);

      fetchEvents();
    } catch (error) {
      console.error('Error fetching match:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('match_events')
      .select('*, player:players!match_events_player_id_fkey(name)')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching events:", error);
    }

    if (!error && data) {
      setEvents(data);
    }
  };

  const formatSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!matchId) return <div className="p-10 text-center">No match selected</div>;
  if (loading) return <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center text-white">Cargando...</div>;
  if (!match) return <div className="p-10 text-center">Match not found</div>;

  const redCardsA = events.filter(e => e.team_id === match.home_team_id && e.event_type === 'red_card').length;
  const yellowCardsA = events.filter(e => e.team_id === match.home_team_id && e.event_type === 'yellow_card').length;
  const redCardsB = events.filter(e => e.team_id === match.away_team_id && e.event_type === 'red_card').length;
  const yellowCardsB = events.filter(e => e.team_id === match.away_team_id && e.event_type === 'yellow_card').length;


  return (
    <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex flex-col overflow-x-hidden antialiased text-slate-900 dark:text-white">
      <Header
        title={`Jornada ${match.round_number || '-'}`}
        onBack={() => navigate(-1)}
      />

      {/* Main Content */}
      <main className="flex-1 w-full max-w-lg mx-auto pb-12">
        {/* Live Badge */}
        {(match.status === 'live' || match.status === 'break') && (
          <div className="flex justify-center pt-6 pb-2">
            <div className="flex items-center gap-x-2 rounded-full bg-red-500/20 border border-red-500/30 px-3 py-1 animate-pulse">
              <div className="h-2 w-2 rounded-full bg-red-500"></div>
              <p className="text-red-500 text-xs font-bold tracking-wider">EN VIVO</p>
            </div>
          </div>
        )}
        {match.status === 'finished' && (
          <div className="flex justify-center pt-6 pb-2">
            <div className="flex items-center gap-x-2 rounded-full bg-slate-500/20 border border-slate-500/30 px-3 py-1">
              <p className="text-slate-500 text-xs font-bold tracking-wider">FINALIZADO</p>
            </div>
          </div>
        )}


        {/* Scoreboard Hero */}
        <div className="px-4 py-4">
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 p-6 flex flex-col gap-6">
            {/* Timer */}
            {(match.status === 'live' || match.status === 'break') && (
              <div className="flex justify-center items-center">
                <div className="bg-slate-100 dark:bg-background-dark px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <p className="text-primary font-bold text-lg tabular-nums tracking-tight">
                    {formatSeconds(timer)}
                  </p>
                  {match.status === 'break' && <span className="text-xs text-amber-500 font-bold uppercase">(Entretiempo)</span>}
                </div>
              </div>
            )}

            {/* Teams & Score */}
            <div className="flex items-center justify-between gap-4">
              {/* Team A */}
              <div className="flex flex-col items-center flex-1 gap-3">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-inner overflow-hidden border-2 border-slate-200 dark:border-slate-600 p-1">
                  {match.home_team?.shield_url ? (
                    <div
                      className="w-full h-full bg-center bg-no-repeat bg-cover rounded-full"
                      style={{ backgroundImage: `url("${match.home_team.shield_url}")` }}
                    ></div>
                  ) : (
                    <span className="text-xs font-bold">{match.home_team?.name?.substring(0, 3)}</span>
                  )}
                </div>
                <h3 className="text-center font-bold text-sm leading-tight">{match.home_team?.name}</h3>
                <div className="flex gap-1 justify-center">
                  {Array(yellowCardsA).fill(0).map((_, i) => <div key={i} className="w-1.5 h-2.5 bg-yellow-400 rounded-sm"></div>)}
                  {Array(redCardsA).fill(0).map((_, i) => <div key={i} className="w-1.5 h-2.5 bg-red-600 rounded-sm"></div>)}
                </div>
              </div>
              {/* Score */}
              <div className="flex flex-col items-center justify-center">
                <div className="text-5xl font-extrabold tracking-tighter text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{match.home_score}</span>
                  <span className="text-slate-300 dark:text-slate-600 text-3xl">-</span>
                  <span>{match.away_score}</span>
                </div>
              </div>
              {/* Team B */}
              <div className="flex flex-col items-center flex-1 gap-3">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-inner overflow-hidden border-2 border-slate-200 dark:border-slate-600 p-1">
                  {match.away_team?.shield_url ? (
                    <div
                      className="w-full h-full bg-center bg-no-repeat bg-cover rounded-full"
                      style={{ backgroundImage: `url("${match.away_team.shield_url}")` }}
                    ></div>
                  ) : (
                    <span className="text-xs font-bold">{match.away_team?.name?.substring(0, 3)}</span>
                  )}
                </div>
                <h3 className="text-center font-bold text-sm leading-tight">{match.away_team?.name}</h3>
                <div className="flex gap-1 justify-center">
                  {Array(yellowCardsB).fill(0).map((_, i) => <div key={i} className="w-1.5 h-2.5 bg-yellow-400 rounded-sm"></div>)}
                  {Array(redCardsB).fill(0).map((_, i) => <div key={i} className="w-1.5 h-2.5 bg-red-600 rounded-sm"></div>)}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Timeline Section */}
        <div className="px-4 mt-2">
          <h3 className="text-lg font-bold mb-4 px-2">Minuto a Minuto</h3>
          <div className="relative flex flex-col gap-4 pl-4 pr-2">
            {/* Render Events */}
            {events.length === 0 ? (
              <p className="text-slate-500 text-sm text-center">El partido está comenzando. Aún no hay eventos.</p>
            ) : (
              events.map((event) => {
                const isHome = event.team_id === match.home_team_id;
                return (
                  <div key={event.id} className={`flex items-start gap-4 ${isHome ? '' : 'flex-row-reverse text-right'}`}>
                    {/* Time/Icon */}
                    <div className="flex flex-col items-center min-w-[30px]">
                      <div className={`p-2 rounded-full ${event.event_type === 'goal' ? 'bg-primary/20 text-primary' : event.event_type === 'red_card' ? 'bg-red-500/20 text-red-500' : 'bg-yellow-400/20 text-yellow-500'}`}>
                        <span className="material-symbols-outlined text-lg">
                          {event.event_type === 'goal' ? 'sports_soccer' : 'style'}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-400 mt-1">{event.minute}'</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <p className="font-bold text-sm text-slate-800 dark:text-white">
                        {event.event_type === 'goal' ? '¡GOL!' : event.event_type === 'red_card' ? 'Tarjeta Roja' : 'Tarjeta Amarilla'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {event.player?.name || 'Jugador'} ({isHome ? match.home_team.name : match.away_team.name})
                      </p>
                    </div>
                  </div>
                );
              })
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default MatchDetailsLiveScreen;
