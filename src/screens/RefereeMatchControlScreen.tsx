import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';

const RefereeMatchControlScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const matchId = location.state?.matchId;

  /* State */
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  /* Events State */
  const [events, setEvents] = useState<any[]>([]);
  const [homePlayers, setHomePlayers] = useState<any[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<any[]>([]);

  /* Modal State */
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<{ type: string, teamId: string, teamName: string } | null>(null);
  const [confirmPlayerId, setConfirmPlayerId] = useState<string | null>(null);
  // Add state for button action confirmation
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  /* Lineup State */
  const [showLineupModal, setShowLineupModal] = useState(false);
  const [selectedHomeStarters, setSelectedHomeStarters] = useState<string[]>([]);
  const [selectedAwayStarters, setSelectedAwayStarters] = useState<string[]>([]);
  const [lineupStep, setLineupStep] = useState<'home' | 'away'>('home'); // Wizard step

  /* Substitution State */
  const [subStep, setSubStep] = useState<'out' | 'in' | null>(null);
  const [playerOutId, setPlayerOutId] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) {
      showToast('Partido no identificado', 'error');
      navigate(-1);
      return;
    }
    fetchMatchData();
  }, [matchId]);

  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else if (!isRunning && timer !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning, timer]);

  /* Combined Fetch */
  const fetchMatchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Match Details
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
            *,
            home_team:teams!matches_home_team_id_fkey(name, shield_url),
            away_team:teams!matches_away_team_id_fkey(name, shield_url),

            league:leagues(name, match_duration, format)
        `)
        .eq('id', matchId)
        .single();

      if (matchError) throw matchError;


      const formattedMatch = {
        ...matchData,
        home_team: Array.isArray(matchData.home_team) ? matchData.home_team[0] : matchData.home_team,
        away_team: Array.isArray(matchData.away_team) ? matchData.away_team[0] : matchData.away_team,
        league: Array.isArray(matchData.league) ? matchData.league[0] : matchData.league,
        elapsed_seconds: matchData.elapsed_seconds || 0,
        current_period: matchData.current_period || 1,
        last_start_time: matchData.last_start_time
      };

      // Calculate real timer
      let calculatedTimer = formattedMatch.elapsed_seconds;
      if (formattedMatch.status === 'live' && formattedMatch.last_start_time) {
        const startTime = new Date(formattedMatch.last_start_time).getTime();
        const now = new Date().getTime();
        const diffInSeconds = Math.floor((now - startTime) / 1000);
        calculatedTimer += diffInSeconds;
      }

      setMatch(formattedMatch);
      setTimer(calculatedTimer);

      // Resume timer if match is live
      if (formattedMatch.status === 'live') {
        setIsRunning(true);
      }

      // 2. Fetch Players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .in('team_id', [formattedMatch.home_team_id, formattedMatch.away_team_id]);

      if (playersData) {
        const POSITION_ORDER: { [key: string]: number } = { 'Portero': 1, 'Defensa': 2, 'Medio': 3, 'Delantero': 4 };

        const sortPlayers = (a: any, b: any) => {
          const posA = POSITION_ORDER[a.position] || 99;
          const posB = POSITION_ORDER[b.position] || 99;
          if (posA !== posB) return posA - posB;
          return (parseInt(a.number) || 0) - (parseInt(b.number) || 0);
        };

        const sortedPlayers = playersData.sort(sortPlayers);

        setHomePlayers(sortedPlayers.filter(p => p.team_id === formattedMatch.home_team_id));
        setAwayPlayers(sortedPlayers.filter(p => p.team_id === formattedMatch.away_team_id));
      }

      // 3. Fetch Events
      fetchEvents();

      // 4. Check Lineups Checks
      if (!formattedMatch.lineups || Object.keys(formattedMatch.lineups).length === 0) {
        if (formattedMatch.status === 'scheduled') {
          setShowLineupModal(true);
        }
      }

    } catch (error) {
      console.error("Error loading match:", error);
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    // Explicitly define relationships to avoid ambiguity
    const { data } = await supabase
      .from('match_events')
      .select(`
        *, 
        player:players!match_events_player_id_fkey(name, number),
        player_in:players!match_events_player_in_id_fkey(name, number)
      `)
      .eq('match_id', matchId)
      .order('created_at', { ascending: false });

    if (data) setEvents(data);
  };

  // REMOVED auto-save interval to prevent conflicts. We rely on last_start_time.

  /* Logic */
  const updateScore = async (team: 'home' | 'away', change: number) => {
    if (!match) return;
    const field = team === 'home' ? 'home_score' : 'away_score';
    const currentScore = match[field] || 0;
    const newScore = Math.max(0, currentScore + change);

    const { error } = await supabase
      .from('matches')
      .update({ [field]: newScore }) // Don't touch timer here
      .eq('id', matchId);

    if (error) {
      showToast('Error al actualizar marcador', 'error');
    } else {
      setMatch({ ...match, [field]: newScore });
    }
  };

  const updateStatus = async (newStatus: string) => {
    // Prepare update data
    const updateData: any = { status: newStatus };

    // If finishing or pausing, save the Accumulated Timer and Clear Start Time
    if (newStatus === 'finished' || newStatus === 'break' || newStatus === 'scheduled') {
      updateData.elapsed_seconds = timer;
      updateData.last_start_time = null;
      setIsRunning(false);
    }
    // If starting live (and wasn't running), set start time
    else if (newStatus === 'live') {
      updateData.last_start_time = new Date().toISOString();
      setIsRunning(true);
    }

    const { error } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', matchId);

    if (error) {
      showToast('Error al actualizar estado', 'error');
    } else {
      setMatch({ ...match, ...updateData });
      showToast(`Estado actualizado: ${newStatus === 'live' ? 'En Vivo' : newStatus === 'finished' ? 'Finalizado' : newStatus === 'break' ? 'Entretiempo' : 'Programado'}`, 'success');
      if (newStatus === 'finished') navigate(-1);
    }
  };


  /* Lineup Logic */
  const toggleStarter = (playerId: string, team: 'home' | 'away') => {
    const list = team === 'home' ? selectedHomeStarters : selectedAwayStarters;
    const setList = team === 'home' ? setSelectedHomeStarters : setSelectedAwayStarters;
    const max = parseInt(match.league?.format || '11');

    if (list.includes(playerId)) {
      setList(list.filter(id => id !== playerId));
    } else {
      if (list.length >= max) {
        showToast(`Máximo ${max} jugadores titulares`, 'error');
        return;
      }
      setList([...list, playerId]);
    }
  };

  const saveLineups = async () => {
    const lineups = {
      home: selectedHomeStarters,
      away: selectedAwayStarters
    };

    const { error } = await supabase
      .from('matches')
      .update({ lineups: lineups })
      .eq('id', matchId);

    if (error) {
      showToast('Error al guardar alineaciones', 'error');
    } else {
      setMatch({ ...match, lineups });
      setShowLineupModal(false);
      showToast('Alineaciones confirmadas', 'success');
    }
  };

  const toggleTimer = async () => {
    // Validation: Block start if lineups missing
    if (match.status === 'scheduled') {
      if (!match.lineups || Object.keys(match.lineups).length === 0) {
        showToast('Debes registrar las alineaciones antes de iniciar', 'error');
        setShowLineupModal(true);
        return;
      }
      updateStatus('live');
    } else {
      // Toggle Running State
      if (isRunning) {
        // PAUSE: Save current timer, clear start time
        const { error } = await supabase
          .from('matches')
          .update({
            status: 'break',
            elapsed_seconds: timer,
            last_start_time: null
          })
          .eq('id', matchId);

        if (!error) {
          setIsRunning(false);
          setMatch({ ...match, status: 'break' });
        }
      } else {
        // RESUME: Set start time, keep elapsed_seconds as base
        const { error } = await supabase
          .from('matches')
          .update({
            status: 'live',
            last_start_time: new Date().toISOString()
          })
          .eq('id', matchId);

        if (!error) {
          setIsRunning(true);
          setMatch({ ...match, status: 'live' });
        }
      }
    }
  };

  /* Event Handlers */
  const onTriggerEvent = (type: string, teamId: string, teamName: string) => {
    setPendingEvent({ type, teamId, teamName });
    if (type === 'substitution') {
      setSubStep('out');
      setPlayerOutId(null);
    } else {
      setSubStep(null);
    }
    setShowPlayerModal(true);
  };

  /* Helpers */
  const getPlayerCardStatus = (playerId: string) => {
    const playerEvents = events.filter(e => e.player_id === playerId);
    const hasRed = playerEvents.some(e => e.event_type === 'red_card');
    const yellowCount = playerEvents.filter(e => e.event_type === 'yellow_card').length;
    return { hasRed, yellowCount };
  };

  const confirmEvent = async (playerId: string | null) => {
    if (!pendingEvent) return;

    if (playerId) {
      const status = getPlayerCardStatus(playerId);

      // SUBSTITUTION LOGIC
      if (pendingEvent.type === 'substitution') {
        if (subStep === 'out') {
          setPlayerOutId(playerId);
          setSubStep('in');
          setConfirmPlayerId(null);
          return;
        }
        if (subStep === 'in') {
          if (playerId === playerOutId) {
            showToast('El jugador que entra no puede ser el mismo que sale', 'error');
            return;
          }
        }
      }

      // Red Card Restriction
      if (pendingEvent.type === 'goal' && status.hasRed) {
        showToast('Jugador expulsado no puede anotar', 'error');
        return;
      }

      // Card Logic (Only if NOT a substitution)
      if (pendingEvent.type !== 'substitution') {
        if (pendingEvent.type === 'yellow_card') {
          if (status.hasRed) {
            showToast('Jugador ya tiene tarjeta roja', 'error');
            return;
          }
          // Always confirm for any yellow card
          if (confirmPlayerId !== playerId) {
            setConfirmPlayerId(playerId);
            return;
          }
        }

        if (pendingEvent.type === 'red_card') {
          if (status.hasRed) {
            showToast('Jugador ya está expulsado', 'error');
            return;
          }
          // Confirmation for Red Card
          if (confirmPlayerId !== playerId) {
            setConfirmPlayerId(playerId);
            return;
          }
        }
      }
    }

    // Payload
    const payload: any = {
      match_id: matchId,
      player_id: playerId,
      team_id: pendingEvent.teamId, // FIX: Saving team_id
      event_type: pendingEvent.type,
      minute: Math.floor(timer / 60) + 1,
    };

    if (pendingEvent.type === 'substitution') {
      payload.player_id = playerOutId;
      payload.player_in_id = playerId;
    }

    const { error } = await supabase
      .from('match_events')
      .insert(payload);

    if (error) {
      console.error(error);
      showToast(`Error: ${error.message}`, 'error');
    } else {
      showToast('Evento registrado', 'success');
      fetchEvents();

      if (pendingEvent.type === 'goal') {
        const isHome = pendingEvent.teamId === match.home_team_id;
        updateScore(isHome ? 'home' : 'away', 1);
      }

      // Auto Red Card
      if (pendingEvent.type === 'yellow_card' && playerId) {
        const playerCount = events.filter(e => e.player_id === playerId && e.event_type === 'yellow_card').length;
        if (playerCount >= 1) {
          await supabase.from('match_events').insert({
            match_id: matchId,
            player_id: playerId,
            team_id: pendingEvent.teamId, // FIX: Saving team_id
            event_type: 'red_card',
            minute: Math.floor(timer / 60) + 1,
          });
          showToast('Doble Amarilla: Jugador Expulsado', 'error');
          fetchEvents();
        }
      }
    }
    setShowPlayerModal(false);
    setConfirmPlayerId(null);
    setPendingEvent(null);
    setSubStep(null);
    setPlayerOutId(null);
  };

  const endFirstHalf = async () => {
    const { error } = await supabase
      .from('matches')
      .update({ status: 'break', elapsed_seconds: timer })
      .eq('id', matchId);



    if (error) {
      showToast('Error al finalizar 1er tiempo', 'error');
    } else {
      setMatch({ ...match, status: 'break' });
      setIsRunning(false);
      showToast('Fin del 1er Tiempo', 'success');
      setConfirmAction(null); // Reset confirmation state
    }
  };

  const startSecondHalf = async () => {
    // Determine start time for 2nd half
    // User logic: match_duration is TOTAL time. So 2nd half starts at total / 2.
    // Default to 90 mins total (45 per half) if not defined.
    const totalDuration = match.league?.match_duration || 90;
    const startSeconds = (totalDuration / 2) * 60;

    // Only update timer if it's less than the expected start time (to prevent rewinding if already started)
    const newTimer = timer < startSeconds ? startSeconds : timer;

    const { error } = await supabase
      .from('matches')
      .update({
        status: 'live',
        current_period: 2,
        elapsed_seconds: newTimer
      })
      .eq('id', matchId);

    if (error) {
      showToast('Error al iniciar 2do tiempo', 'error');
    } else {
      setMatch({ ...match, status: 'live', current_period: 2 });
      setTimer(newTimer);
      setIsRunning(true);
      showToast('Inicio del 2do Tiempo', 'success');
    }
  };

  const formatSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /* Render */
  if (loading) return <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark text-slate-500">Cargando...</div>;
  if (!match) return <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark text-slate-500">Error</div>;

  const currentPlayers = pendingEvent ? (pendingEvent.teamId === match.home_team_id ? homePlayers : awayPlayers) : [];

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col relative transition-colors duration-200">
      <header className="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-none mb-1">
            {match.league?.name || 'Liga'} • {match.status === 'break' ? 'Entretiempo' : match.current_period === 1 ? '1er Tiempo' : '2do Tiempo'}
          </h1>
          <h2 className="text-lg font-bold leading-none tracking-tight">{match.home_team?.name} vs {match.away_team?.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          {match.status === 'live' && match.current_period === 1 && (
            <button
              onClick={() => {
                if (confirmAction === 'endFirstHalf') {
                  endFirstHalf();
                } else {
                  setConfirmAction('endFirstHalf');
                  // Auto-reset after 3 seconds if not confirmed
                  setTimeout(() => setConfirmAction(null), 3000);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${confirmAction === 'endFirstHalf'
                ? 'bg-amber-500 text-white shadow-md scale-105'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                }`}
            >
              {confirmAction === 'endFirstHalf' ? '¿Confirmar Fin 1T?' : 'Fin 1T'}
            </button>
          )}
          {match.status === 'break' && (
            <button
              onClick={startSecondHalf}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              Iniciar 2T
            </button>
          )}
          <button
            onClick={() => {
              if (confirmAction === 'finishMatch') {
                updateStatus('finished');
                setConfirmAction(null);
              } else {
                setConfirmAction('finishMatch');
                setTimeout(() => setConfirmAction(null), 3000);
              }
            }}
            className={`flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${confirmAction === 'finishMatch'
              ? 'bg-red-500 text-white shadow-md scale-105'
              : 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400'
              }`}
          >
            {confirmAction === 'finishMatch' ? '¿Confirmar Fin?' : 'Finalizar'}
          </button>
        </div>
      </header>

      {/* Main Container - Responsive Width */}
      <main className="flex-1 flex flex-col p-4 gap-5 max-w-7xl mx-auto w-full pb-20">

        {/* Top Section: Scoreboard (Full Width) */}
        <section className="rounded-2xl bg-white dark:bg-card-dark shadow-sm dark:shadow-[0_0_4px_rgba(0,0,0,0.3)] p-5 flex flex-col items-center gap-4 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${match.status === 'live' ? 'from-green-500 to-emerald-500 animate-pulse' : 'from-slate-400 to-slate-500'}`}></div>
          <div className="flex items-center justify-between w-full mb-1 max-w-lg mx-auto">
            <div className="flex flex-col items-center flex-1">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-2 overflow-hidden flex items-center justify-center">
                {match.home_team?.shield_url ? <img src={match.home_team.shield_url} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-amber-500 text-3xl">shield</span>}
              </div>
              <span className="text-sm font-bold text-center leading-tight">{match.home_team?.name}</span>
            </div>
            <div className="flex flex-col items-center mx-2 z-10 w-24">
              <div className="text-5xl font-black tracking-tighter tabular-nums leading-none mb-2">
                {formatSeconds(timer)}
              </div>
              <div className="flex items-center gap-4 text-3xl font-bold text-slate-400 dark:text-slate-500">
                <div className="flex flex-col items-center">
                  <span className="text-slate-900 dark:text-white mb-1">{match.home_score || 0}</span>
                  <button
                    onClick={() => updateScore('home', -1)}
                    className="text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                  >
                    -1
                  </button>
                </div>
                <span>-</span>
                <div className="flex flex-col items-center">
                  <span className="text-slate-900 dark:text-white mb-1">{match.away_score || 0}</span>
                  <button
                    onClick={() => updateScore('away', -1)}
                    className="text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                  >
                    -1
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center flex-1">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-2 overflow-hidden flex items-center justify-center">
                {match.away_team?.shield_url ? <img src={match.away_team.shield_url} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-primary text-3xl">shield</span>}
              </div>
              <span className="text-sm font-bold text-center leading-tight">{match.away_team?.name}</span>
            </div>
          </div>
          {/* Timer Controls */}
          <div className="flex items-center gap-3 mt-1 w-full max-w-lg mx-auto">
            <button
              onClick={() => setTimer(t => t + 60)}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              +1 Min
            </button>
            <button
              onClick={() => {
                if (match.status === 'break') {
                  startSecondHalf();
                } else {
                  toggleTimer();
                }
              }}
              className={`flex-[2] h-12 flex items-center justify-center gap-2 rounded-xl text-white font-bold shadow-lg transition-all active:scale-95 ${match.status === 'live' && isRunning ? 'bg-amber-500 hover:bg-amber-600' :
                match.status === 'break' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  'bg-primary hover:bg-primary-dark'
                }`}
            >
              <span className="material-symbols-outlined fill-1">{match.status === 'live' && isRunning ? 'pause' : 'play_arrow'}</span>
              <span>
                {match.status === 'scheduled' ? 'Iniciar Partido' :
                  match.status === 'break' ? 'Iniciar 2do Tiempo' :
                    isRunning ? 'Pausar' : 'Reanudar'}
              </span>
            </button>
          </div>
        </section>

        {/* Action Buttons - Grid on Larger Screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Home Actions */}
          <div className="bg-white dark:bg-card-dark rounded-xl p-4 shadow-sm h-full">
            <h3 className="font-bold text-lg mb-3 border-b border-slate-100 dark:border-slate-800 pb-2 text-center md:text-left">{match.home_team?.name} (Local)</h3>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => onTriggerEvent('goal', match.home_team_id, match.home_team?.name)} className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-emerald-500/10 text-emerald-600 font-bold hover:bg-emerald-500/20"><span className="material-symbols-outlined">sports_soccer</span>Gol</button>
              <button onClick={() => onTriggerEvent('yellow_card', match.home_team_id, match.home_team?.name)} className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-amber-500/10 text-amber-600 font-bold hover:bg-amber-500/20"><span className="material-symbols-outlined rotate-90">style</span>Amarilla</button>
              <button onClick={() => onTriggerEvent('red_card', match.home_team_id, match.home_team?.name)} className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-red-500/10 text-red-600 font-bold hover:bg-red-500/20"><span className="material-symbols-outlined rotate-90">style</span>Roja</button>
              <button onClick={() => onTriggerEvent('substitution', match.home_team_id, match.home_team?.name)} className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700"><span className="material-symbols-outlined">published_with_changes</span>Cambio</button>
            </div>
          </div>
          {/* Away Actions */}
          <div className="bg-white dark:bg-card-dark rounded-xl p-4 shadow-sm h-full">
            <h3 className="font-bold text-lg mb-3 border-b border-slate-100 dark:border-slate-800 pb-2 text-center md:text-left">{match.away_team?.name} (Visitante)</h3>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => onTriggerEvent('goal', match.away_team_id, match.away_team?.name)} className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-emerald-500/10 text-emerald-600 font-bold hover:bg-emerald-500/20"><span className="material-symbols-outlined">sports_soccer</span>Gol</button>
              <button onClick={() => onTriggerEvent('yellow_card', match.away_team_id, match.away_team?.name)} className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-amber-500/10 text-amber-600 font-bold hover:bg-amber-500/20"><span className="material-symbols-outlined rotate-90">style</span>Amarilla</button>
              <button onClick={() => onTriggerEvent('red_card', match.away_team_id, match.away_team?.name)} className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-red-500/10 text-red-600 font-bold hover:bg-red-500/20"><span className="material-symbols-outlined rotate-90">style</span>Roja</button>
              <button onClick={() => onTriggerEvent('substitution', match.away_team_id, match.away_team?.name)} className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700"><span className="material-symbols-outlined">published_with_changes</span>Cambio</button>
            </div>
          </div>
        </div>

        {/* TIMELINE */}
        <div className="bg-white dark:bg-card-dark rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-lg mb-3 text-slate-800 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined">history</span>Historial del Partido
          </h3>
          {events.length === 0 ? (
            <p className="text-center text-slate-400 py-4 text-sm">Aún no hay eventos registrados.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map(event => {
                const isHome = event.team_id === match.home_team_id;
                const teamName = isHome ? match.home_team?.name : match.away_team?.name;
                const teamColorClass = isHome ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400';

                return (
                  <div key={event.id} className={`flex items-center gap-3 text-sm border-l-2 pl-3 py-1 ${isHome ? 'border-blue-500/30' : 'border-rose-500/30'}`}>
                    <span className="font-mono font-bold text-slate-500 w-8">{event.minute}'</span>
                    <span className="material-symbols-outlined text-lg">
                      {event.event_type === 'goal' ? 'sports_soccer' :
                        event.event_type === 'yellow_card' ? 'style' :
                          event.event_type === 'red_card' ? 'style' : 'published_with_changes'}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {event.event_type === 'goal' ? 'Gol' :
                          event.event_type === 'yellow_card' ? 'Tarjeta Amarilla' :
                            event.event_type === 'red_card' ? 'Tarjeta Roja' : 'Cambio'}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${teamColorClass}`}>
                        {teamName}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-xs">
                        {event.player ? `${event.player.name} #${event.player.number}` : 'Jugador no identificado'}
                      </span>
                      {event.event_type === 'substitution' && event.player_in && (
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                          Entra: {event.player_in.name} #{event.player_in.number}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* PLAYER SELECTION MODAL */}
      {showPlayerModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card-dark w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">
                  {subStep === 'out' ? '¿Quién sale?' :
                    subStep === 'in' ? '¿Quién entra?' :
                      'Seleccionar Jugador'}
                </h3>
                {subStep === 'in' && <p className="text-xs text-slate-500">Sale: {currentPlayers.find(p => p.id === playerOutId)?.name}</p>}
              </div>
              <button
                onClick={() => { setShowPlayerModal(false); setConfirmPlayerId(null); setSubStep(null); }}
                className="bg-slate-100 dark:bg-slate-700 rounded-full p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-2 overflow-y-auto flex-1">
              <p className="px-2 text-xs font-bold text-slate-400 uppercase mb-2">{pendingEvent?.teamName}</p>
              {currentPlayers.length === 0 ? (
                <p className="p-4 text-center text-slate-500">No hay jugadores registrados en este equipo.</p>
              ) : (
                (() => {
                  // Determine starters (dynamically based on substitutions)
                  const isHome = pendingEvent?.teamId === match.home_team_id;
                  const initialLineupIds = isHome
                    ? (match.lineups?.home || [])
                    : (match.lineups?.away || []);

                  // Process substitutions to find current on-field players
                  const teamEvents = events.filter(e => e.team_id === pendingEvent?.teamId && e.event_type === 'substitution');
                  const subbedOutIds = teamEvents.map(e => e.player_id);
                  const subbedInIds = teamEvents.map(e => e.player_in_id);

                  // Current Starters = (Initial - Out) + In
                  const currentStarterIds = initialLineupIds
                    .filter((id: string) => !subbedOutIds.includes(id))
                    .concat(subbedInIds);

                  const starters = currentPlayers.filter(p => currentStarterIds.includes(p.id));
                  const subs = currentPlayers.filter(p => !currentStarterIds.includes(p.id));

                  const renderPlayerButton = (player: any) => {
                    const status = getPlayerCardStatus(player.id);
                    const isConfirming = confirmPlayerId === player.id;

                    // Disable if Expelled OR if sub step is 'in' and this player was selected as 'out'
                    const isDisabled = status.hasRed || (subStep === 'in' && player.id === playerOutId);

                    // Message for confirmation
                    let confirmText = 'Confirmar';
                    let subText = 'Toque de nuevo para guardar';
                    if (isConfirming && pendingEvent) {
                      if (pendingEvent.type === 'yellow_card') {
                        if (status.yellowCount > 0) {
                          confirmText = 'Confirmar Expulsión';
                          subText = '2da Amarilla = Roja';
                        } else {
                          confirmText = 'Confirmar Amarilla';
                          subText = 'Toque de nuevo';
                        }
                      } else if (pendingEvent.type === 'red_card') {
                        confirmText = 'Confirmar Roja';
                        subText = 'Expulsión Directa';
                      }
                    }

                    return (
                      <button
                        key={player.id}
                        onClick={() => confirmEvent(player.id)}
                        disabled={isDisabled}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left mb-1
                              ${isDisabled ? 'cursor-not-allowed' : ''}
                              ${isConfirming ? 'bg-amber-500 text-white shadow-lg scale-[1.02]' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}
                              ${isConfirming && (status.yellowCount > 0 || pendingEvent?.type === 'red_card') ? 'bg-red-500' : ''}
                            `}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs relative overflow-visible
                              ${isConfirming ? (status.yellowCount > 0 || pendingEvent?.type === 'red_card' ? 'bg-red-700 text-white' : 'bg-amber-600 text-white') : 'bg-slate-200 dark:bg-slate-700'}
                            `}>
                          {player.photo_url ? (
                            <img src={player.photo_url} alt={player.name} className={`w-full h-full object-cover rounded-full ${isDisabled ? 'grayscale contrast-125' : ''}`} />
                          ) : (
                            <span>{player.number || '#'}</span>
                          )}
                          {/* Yellow Card Indicator */}
                          {status.yellowCount > 0 && !status.hasRed && !isDisabled && !isConfirming && (
                            <div className="absolute -top-1 -right-1 w-4 h-5 bg-amber-400 rounded-sm border-2 border-white shadow-sm z-10"></div>
                          )}

                          {/* Red Card Overlay (No dark background, just the card) */}
                          {status.hasRed && (
                            <div className="absolute inset-0 flex items-center justify-center z-20">
                              <div className="w-4 h-5 bg-red-600 rounded-sm border-2 border-white shadow-sm transform rotate-12"></div>
                            </div>
                          )}

                          {/* Substitution Out Overlay */}
                          {subStep === 'in' && player.id === playerOutId && (
                            <div className="absolute inset-0 bg-red-500/80 rounded-full flex items-center justify-center z-20 backdrop-blur-[1px]">
                              <span className="material-symbols-outlined text-white font-bold text-lg">arrow_forward</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`font-bold ${isConfirming ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                            {isConfirming ? confirmText : player.name}
                          </p>
                          <div className="flex gap-2">
                            <p className={`text-xs ${isConfirming ? (status.yellowCount > 0 ? 'text-red-100' : 'text-amber-100') : 'text-slate-500'} font-mono`}>
                              #{player.number}
                            </p>
                            <p className={`text-xs ${isConfirming ? (status.yellowCount > 0 ? 'text-red-100' : 'text-amber-100') : 'text-slate-500'}`}>
                              • {isConfirming ? subText : player.position}
                            </p>
                            {status.hasRed && <span className="text-[10px] font-bold text-red-500 bg-red-100 px-1 rounded">Expulsado</span>}
                            {subStep === 'in' && player.id === playerOutId && <span className="text-[10px] font-bold text-red-500 bg-red-100 px-1 rounded">Sale del campo</span>}
                          </div>
                        </div>
                        {isConfirming && <span className="material-symbols-outlined animate-pulse">priority_high</span>}
                      </button>
                    );
                  };

                  return (
                    <div className="flex flex-col gap-2">
                      {/* Show correct list based on Substitution Mode */}
                      {pendingEvent?.type === 'substitution' && subStep === 'out' && (
                        <>
                          <p className="px-2 text-[10px] font-bold text-emerald-500 uppercase mt-2">Titulares (En Cancha)</p>
                          {starters.map(renderPlayerButton)}
                          {starters.length === 0 && <p className="px-4 text-xs text-slate-400">No hay titulares registrados.</p>}
                        </>
                      )}

                      {pendingEvent?.type === 'substitution' && subStep === 'in' && (
                        <>
                          <p className="px-2 text-[10px] font-bold text-blue-500 uppercase mt-2">Suplentes (Banca)</p>
                          {subs.map(renderPlayerButton)}
                          {subs.length === 0 && <p className="px-4 text-xs text-slate-400">No hay suplentes disponibles.</p>}
                        </>
                      )}


                      {/* Normal Events (Goals, Cards) - Show everyone? Or just starters? Usually just starters can get cards/goals if on pitch, but for simplicity show all or just starters? Let's show Starters then Subs separated */}
                      {pendingEvent?.type !== 'substitution' && (
                        <>
                          <p className="px-2 text-[10px] font-bold text-emerald-500 uppercase mt-2">Titulares</p>
                          {starters.map(renderPlayerButton)}

                          <div className="border-t border-slate-100 dark:border-slate-800 my-2"></div>

                          <p className="px-2 text-[10px] font-bold text-blue-500 uppercase">Banca</p>
                          {subs.map(renderPlayerButton)}
                        </>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* LINEUP SELECTION MODAL */}
      {showLineupModal && match && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background-light dark:bg-background-dark sm:bg-black/50 sm:backdrop-blur-sm sm:p-4">
          <div className="bg-white dark:bg-card-dark w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-card-dark z-10">
              <div>
                <h2 className="text-xl font-bold dark:text-white">Alineaciones Iniciales</h2>
                <p className="text-sm text-slate-500">Selecciona los titulares</p>
              </div>
            </div>

            {/* Wizard Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex justify-center mb-4">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setLineupStep('home')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${lineupStep === 'home' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-400'}`}
                  >
                    {match.home_team?.name} ({selectedHomeStarters.length})
                  </button>
                  <button
                    onClick={() => setLineupStep('away')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${lineupStep === 'away' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-400'}`}
                  >
                    {match.away_team?.name} ({selectedAwayStarters.length})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {(lineupStep === 'home' ? homePlayers : awayPlayers).map(player => {
                  const isSelected = lineupStep === 'home'
                    ? selectedHomeStarters.includes(player.id)
                    : selectedAwayStarters.includes(player.id);

                  return (
                    <button
                      key={player.id}
                      onClick={() => toggleStarter(player.id, lineupStep)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                          ${isSelected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800'
                        }`}
                    >
                      <div className={`size-10 rounded-full flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        {player.number}
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`font-bold ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{player.name}</p>
                        <p className="text-xs text-slate-500">{player.position}</p>
                      </div>
                      {isSelected && <span className="material-symbols-outlined text-emerald-500">check_circle</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-card-dark">
              <button
                onClick={saveLineups}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98]"
              >
                Confirmar Alineaciones e Iniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RefereeMatchControlScreen;
