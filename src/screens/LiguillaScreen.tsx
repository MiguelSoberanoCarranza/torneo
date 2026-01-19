import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';
import html2canvas from 'html2canvas';

interface Team {
    id: string;
    name: string;
    shield_url: string | null;
    points: number;
    gd: number;
    gf: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    ga: number;
    rank?: number; // Store the original seed/rank
}

interface Match {
    id: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number | null;
    away_score: number | null;
    status: 'scheduled' | 'finished' | 'live' | 'break';
    round_number: number;
    start_time?: string;
}

const LiguillaScreen: React.FC = () => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const exportRef = useRef<HTMLDivElement>(null);
    const isSubmittingRef = useRef(false);

    const [leagues, setLeagues] = useState<any[]>([]);
    const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
    const [qualifiedTeams, setQualifiedTeams] = useState<Team[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Playoff State
    const [qfMatches, setQfMatches] = useState<Match[]>([]);
    const [sfMatches, setSfMatches] = useState<Match[]>([]);
    const [finalMatch, setFinalMatch] = useState<Match | null>(null);

    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [exporting, setExporting] = useState(false);

    // --- MANUEL ENTRY STATE (Ported from Calendar) ---
    const [showManualModal, setShowManualModal] = useState(false);
    const [selectedMatchManual, setSelectedMatchManual] = useState<Match | null>(null);
    const [manualResult, setManualResult] = useState({ home_score: '', away_score: '', finished: true });
    const [manualPlayersHome, setManualPlayersHome] = useState<any[]>([]);
    const [manualPlayersAway, setManualPlayersAway] = useState<any[]>([]);
    const [homeGoalscorers, setHomeGoalscorers] = useState<string[]>([]);
    const [awayGoalscorers, setAwayGoalscorers] = useState<string[]>([]);
    const [homeCards, setHomeCards] = useState<{ name: string, type: 'yellow_card' | 'red_card' }[]>([]);
    const [awayCards, setAwayCards] = useState<{ name: string, type: 'yellow_card' | 'red_card' }[]>([]);

    // Round Constants
    const ROUND_QF = 100;
    const ROUND_SF = 101;
    const ROUND_FINAL = 102;

    // --- PERMISSIONS & HELPERS ---
    const currentLeague = leagues.find(l => l.id === selectedLeagueId);
    // Ownership: If user matches created_by
    const isLeagueOwner = currentUserId && currentLeague && currentLeague.created_by === currentUserId;
    // Edit Permission: SuperAdmin OR (Admin Role AND League Owner)
    const canEdit = isSuperAdmin || (isAdmin && isLeagueOwner);

    useEffect(() => {
        checkUserRole();
        fetchLeagues();
    }, []);

    useEffect(() => {
        if (selectedLeagueId) {
            fetchData(selectedLeagueId);
        }
    }, [selectedLeagueId]);

    const checkUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUserId(user.id);
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if (profile) {
                if (['admin', 'superadmin', 'referee'].includes(profile.role)) setIsAdmin(true);
                if (profile.role === 'superadmin') setIsSuperAdmin(true);
            }
        }
    };

    const fetchLeagues = async () => {
        try {
            // Fetch Public Leagues
            const { data: publicLeagues } = await supabase
                .from('leagues')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (publicLeagues) {
                setLeagues(publicLeagues);
                if (publicLeagues.length > 0) {
                    // Try to restore selection or default to first
                    setSelectedLeagueId(publicLeagues[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching leagues', error);
        }
    };

    const fetchData = async (leagueId: string) => {
        setLoading(true);
        try {
            // 1. Fetch ALL Teams (needed to resolve names in matches)
            const { data: teams, error: teamsError } = await supabase
                .from('teams')
                .select('*')
                .eq('league_id', leagueId);

            if (teamsError) throw teamsError;

            // 2. Fetch Regular Season Matches (Round < 100)
            const { data: regularMatches } = await supabase
                .from('matches')
                .select('id, home_team_id, away_team_id, home_score, away_score, status, round_number')
                .eq('league_id', leagueId)
                .eq('status', 'finished')
                .lt('round_number', 100);

            // 3. Fetch Liguilla Matches (Round >= 100)
            const { data: playoffMatches } = await supabase
                .from('matches')
                .select('*')
                .eq('league_id', leagueId)
                .gte('round_number', 100)
                .order('round_number', { ascending: true });

            // Process Regular Season Standings
            if (teams && regularMatches) {
                const stats = teams.map(team => {
                    let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;
                    regularMatches.forEach(match => {
                        let isHome = match.home_team_id === team.id;
                        let isAway = match.away_team_id === team.id;
                        if (isHome || isAway) {
                            const homeScore = match.home_score ?? 0;
                            const awayScore = match.away_score ?? 0;
                            played++;
                            const teamScore = isHome ? homeScore : awayScore;
                            const opponentScore = isHome ? awayScore : homeScore;
                            gf += teamScore;
                            ga += opponentScore;
                            if (teamScore > opponentScore) won++;
                            else if (teamScore === opponentScore) drawn++;
                            else lost++;
                        }
                    });
                    return {
                        ...team,
                        played, won, drawn, lost, gf, ga,
                        gd: gf - ga,
                        points: (won * 3) + (drawn * 1)
                    };
                });
                // Sort Standings
                stats.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

                // Assign Ranks (1-based index)
                const rankedStats = stats.map((t, index) => ({ ...t, rank: index + 1 }));
                setQualifiedTeams(rankedStats.slice(0, 8)); // Top 8
            }

            // Process Playoff Matches
            if (playoffMatches) {
                setQfMatches(playoffMatches.filter(m => m.round_number === ROUND_QF));
                setSfMatches(playoffMatches.filter(m => m.round_number === ROUND_SF));
                const final = playoffMatches.find(m => m.round_number === ROUND_FINAL);
                setFinalMatch(final || null);
            } else {
                setQfMatches([]);
                setSfMatches([]);
                setFinalMatch(null);
            }

        } catch (error) {
            console.error('Error calculating liguilla', error);
            showToast('Error al cargar datos', 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- ACTIONS ---

    const generateQuarterFinals = async () => {
        if (!canEdit) return;
        if (qualifiedTeams.length < 8) {
            showToast('No hay suficientes equipos (8) para generar liguilla', 'error');
            return;
        }
        if (qfMatches.length > 0) {
            if (!window.confirm("Ya existen partidos de liguilla. ¿Deseas regenerarlos? Se borrarán los actuales.")) return;
            // Delete existing logic would be here, effectively "Reset"
        }

        setUpdating(true);
        try {
            // Matchups: 1vs8, 2vs7, 3vs6, 4vs5
            // Note: We set status to 'scheduled' initially
            const matchups = [
                { home: qualifiedTeams[0], away: qualifiedTeams[7] }, // 1 vs 8
                { home: qualifiedTeams[1], away: qualifiedTeams[6] }, // 2 vs 7
                { home: qualifiedTeams[2], away: qualifiedTeams[5] }, // 3 vs 6
                { home: qualifiedTeams[3], away: qualifiedTeams[4] }, // 4 vs 5
            ];

            // Delete old QF if any
            if (qfMatches.length > 0) {
                await supabase.from('matches').delete().eq('league_id', selectedLeagueId).eq('round_number', ROUND_QF);
            }

            const inserts = matchups.map(m => ({
                league_id: selectedLeagueId,
                home_team_id: m.home.id,
                away_team_id: m.away.id,
                round_number: ROUND_QF,
                start_time: new Date().toISOString(), // Placeholder time
                status: 'scheduled'
            }));

            const { error } = await supabase.from('matches').insert(inserts);
            if (error) throw error;

            showToast('Cuartos de final generados con éxito', 'success');
            fetchData(selectedLeagueId!);

        } catch (error: any) {
            console.error(error);
            showToast('Error: ' + error.message, 'error');
        } finally {
            setUpdating(false);
        }
    };

    const generateSemiFinals = async () => {
        if (!canEdit) return;

        // Validation: Ensure we have enough finished matches
        const finishedMatches = qfMatches.filter(m => m.status === 'finished');

        if (finishedMatches.length < 4) {
            showToast(`Se requieren 4 partidos de Cuartos finalizados. Encontrados: ${finishedMatches.length}`, 'info');
            return;
        }

        setUpdating(true);
        try {
            // Use the finished matches directly. 
            // We prioritize qfMatches if exactly 4 to keep original structure, otherwise filter.
            const sourceMatches = finishedMatches.length === 4 ? finishedMatches : finishedMatches.slice(0, 4);

            const winners = sourceMatches.map(m => {
                const homeScore = m.home_score ?? 0;
                const awayScore = m.away_score ?? 0;

                // Try to find teams in qualifiedTeams to get their Rank for tiebreakers
                // Note: If teams dropped out of top 8, this might return undefined.
                // In a robust system we would fetch specific team data here if missing.
                const homeTeam = qualifiedTeams.find(t => t.id === m.home_team_id);
                const awayTeam = qualifiedTeams.find(t => t.id === m.away_team_id);

                if (!homeTeam || !awayTeam) {
                    console.warn(`Equipo no encontrado en qualifiedTeams para partido ${m.id}`);
                    // Fallback object just to propagate ID if needed, but rank will be missing
                    // Use a very high rank so they lose tiebreakers against valid ranked teams
                    return null;
                }

                if (homeScore > awayScore) return homeTeam;
                if (awayScore > homeScore) return awayTeam;

                // Tie: Best Rank wins
                return (homeTeam.rank! < awayTeam.rank!) ? homeTeam : awayTeam;
            }).filter(Boolean) as Team[];

            // Ensure unique winners
            const uniqueWinners = Array.from(new Set(winners.map(w => w.id)))
                .map(id => winners.find(w => w.id === id)!);

            if (uniqueWinners.length !== 4) {
                throw new Error(`Se esperaban 4 ganadores únicos, se encontraron ${uniqueWinners.length}.`);
            }

            // Re-seed: Sort winners by original Rank
            uniqueWinners.sort((a, b) => a.rank! - b.rank!);

            // Matchups: 1 vs 4, 2 vs 3
            const semiMatchups = [
                { home: uniqueWinners[0], away: uniqueWinners[3] },
                { home: uniqueWinners[1], away: uniqueWinners[2] }
            ];

            // Delete old SF
            if (sfMatches.length > 0) {
                await supabase.from('matches').delete().eq('league_id', selectedLeagueId).eq('round_number', ROUND_SF);
            }

            const inserts = semiMatchups.map(m => ({
                league_id: selectedLeagueId,
                home_team_id: m.home.id,
                away_team_id: m.away.id,
                round_number: ROUND_SF,
                start_time: new Date().toISOString(),
                status: 'scheduled'
            }));

            const { error } = await supabase.from('matches').insert(inserts);
            if (error) throw error;

            showToast('Semifinales generadas', 'success');
            fetchData(selectedLeagueId!);

        } catch (error: any) {
            console.error(error);
            showToast('Error: ' + error.message, 'error');
        } finally {
            setUpdating(false);
        }
    };

    const generateFinal = async () => {
        if (!canEdit) return;

        // Validation: Need 2 SF matches finished
        const finishedMatches = sfMatches.filter(m => m.status === 'finished');

        if (finishedMatches.length < 2) {
            showToast(`Se requieren 2 semifinales finalizadas.`, 'info');
            return;
        }

        setUpdating(true);
        try {
            const winners = finishedMatches.map(m => {
                const homeScore = m.home_score ?? 0;
                const awayScore = m.away_score ?? 0;

                const homeTeam = qualifiedTeams.find(t => t.id === m.home_team_id);
                const awayTeam = qualifiedTeams.find(t => t.id === m.away_team_id);

                if (!homeTeam || !awayTeam) return null;

                if (homeScore > awayScore) return homeTeam;
                if (awayScore > homeScore) return awayTeam;

                // Tie: Best Rank wins
                return (homeTeam.rank! < awayTeam.rank!) ? homeTeam : awayTeam;
            }).filter(Boolean) as Team[];

            const uniqueWinners = Array.from(new Set(winners.map(w => w.id)))
                .map(id => winners.find(w => w.id === id)!);

            if (uniqueWinners.length !== 2) {
                throw new Error(`Se esperaban 2 ganadores únicos.`);
            }

            // Sort by rank for logic consistency (Higher rank is Home usually? Or random? Let's stick to Rank 1 is Home)
            uniqueWinners.sort((a, b) => a.rank! - b.rank!);

            // Delete old Final
            if (finalMatch) {
                await supabase.from('matches').delete().eq('league_id', selectedLeagueId).eq('round_number', ROUND_FINAL);
            }

            const insert = {
                league_id: selectedLeagueId,
                home_team_id: uniqueWinners[0].id,
                away_team_id: uniqueWinners[1].id,
                round_number: ROUND_FINAL,
                start_time: new Date().toISOString(),
                status: 'scheduled'
            };

            const { error } = await supabase.from('matches').insert(insert);
            if (error) throw error;

            showToast('Gran Final generada', 'success');
            fetchData(selectedLeagueId!);

        } catch (error: any) {
            console.error(error);
            showToast('Error: ' + error.message, 'error');
        } finally {
            setUpdating(false);
        }
    };

    // --- MANUAL MANAGEMENT (Ported) ---

    const openManualEntry = async (match: Match) => {
        setSelectedMatchManual(match);
        setManualResult({
            home_score: match.home_score?.toString() || '',
            away_score: match.away_score?.toString() || '',
            finished: match.status === 'finished'
        });

        // Initialize with empty first, then fill
        setHomeGoalscorers(match.home_score ? Array(match.home_score).fill('') : []);
        setAwayGoalscorers(match.away_score ? Array(match.away_score).fill('') : []);
        setHomeCards([]);
        setAwayCards([]);

        // Fetch players for autocomplete
        const { data: players } = await supabase
            .from('players')
            .select('id, name, team_id, number')
            .in('team_id', [match.home_team_id, match.away_team_id]);

        if (players) {
            setManualPlayersHome(players.filter(p => p.team_id === match.home_team_id));
            setManualPlayersAway(players.filter(p => p.team_id === match.away_team_id));
        } else {
            setManualPlayersHome([]);
            setManualPlayersAway([]);
        }

        // Fetch existing events to populate form
        const { data: events } = await supabase
            .from('match_events')
            .select(`
            id,
            event_type,
            team_id,
            player:players!match_events_player_id_fkey(name)
          `)
            .eq('match_id', match.id);

        if (events) {
            // GOALS
            const homeGoals = events.filter(e => e.event_type === 'goal' && e.team_id === match.home_team_id).map(e => (e.player as any)?.name || '');
            const awayGoals = events.filter(e => e.event_type === 'goal' && e.team_id === match.away_team_id).map(e => (e.player as any)?.name || '');

            const currentHomeScore = match.home_score || 0;
            const currentAwayScore = match.away_score || 0;

            const finalHomeGoals = Array(currentHomeScore).fill('').map((_, i) => homeGoals[i] || '');
            const finalAwayGoals = Array(currentAwayScore).fill('').map((_, i) => awayGoals[i] || '');

            setHomeGoalscorers(finalHomeGoals);
            setAwayGoalscorers(finalAwayGoals);

            // CARDS
            const homeCardsData = events
                .filter(e => (e.event_type === 'yellow_card' || e.event_type === 'red_card') && e.team_id === match.home_team_id)
                .map(e => ({ name: (e.player as any)?.name || '', type: e.event_type as 'yellow_card' | 'red_card' }));

            const awayCardsData = events
                .filter(e => (e.event_type === 'yellow_card' || e.event_type === 'red_card') && e.team_id === match.away_team_id)
                .map(e => ({ name: (e.player as any)?.name || '', type: e.event_type as 'yellow_card' | 'red_card' }));

            setHomeCards(homeCardsData);
            setAwayCards(awayCardsData);
        }

        setShowManualModal(true);
    };

    const saveManualResult = async () => {
        if (!selectedMatchManual || isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        setUpdating(true);
        const updates: any = {
            home_score: parseInt(manualResult.home_score) || 0,
            away_score: parseInt(manualResult.away_score) || 0
        };

        if (manualResult.finished) {
            updates.status = 'finished';
        }

        // 1. Update Match
        const { error } = await supabase
            .from('matches')
            .update(updates)
            .eq('id', selectedMatchManual.id);

        if (error) {
            showToast('Error al guardar resultado', 'error');
            setUpdating(false);
            isSubmittingRef.current = false;
            return;
        }

        // 2. Process Goalscorers and Cards
        try {
            if (!selectedMatchManual.home_team_id || !selectedMatchManual.away_team_id) {
                throw new Error("Faltan los IDs de los equipos para registrar eventos");
            }

            // Clear existing events for this match
            const { error: deleteError } = await supabase.from('match_events')
                .delete()
                .eq('match_id', selectedMatchManual.id)
                .in('event_type', ['goal', 'yellow_card', 'red_card']);

            if (deleteError) throw deleteError;

            const currentHomePlayers = [...manualPlayersHome];
            const currentAwayPlayers = [...manualPlayersAway];

            const processPlayerEvent = async (name: string, teamId: string, eventType: string, isHome: boolean) => {
                if (!name || name.trim() === '') return;

                const playersList = isHome ? currentHomePlayers : currentAwayPlayers;
                const searchName = name.trim().toLowerCase();
                let existing = playersList.find(p => p.name.trim().toLowerCase() === searchName);

                let playerId = null;

                if (existing) {
                    playerId = existing.id;
                } else {
                    // Create New Player
                    const { data: newPlayer, error: createError } = await supabase
                        .from('players')
                        .insert({ name: name.trim(), team_id: teamId, number: '0', position: 'Jugador' })
                        .select()
                        .single();

                    if (createError) throw createError;
                    playerId = newPlayer.id;

                    if (isHome) currentHomePlayers.push({ ...newPlayer });
                    else currentAwayPlayers.push({ ...newPlayer });
                }

                if (playerId) {
                    await supabase.from('match_events').insert({
                        match_id: selectedMatchManual.id,
                        player_id: playerId,
                        team_id: teamId,
                        event_type: eventType,
                        minute: 90
                    });
                }
            };

            // Goals
            for (const name of homeGoalscorers) await processPlayerEvent(name, selectedMatchManual.home_team_id, 'goal', true);
            for (const name of awayGoalscorers) await processPlayerEvent(name, selectedMatchManual.away_team_id, 'goal', false);

            // Cards
            for (const item of homeCards) await processPlayerEvent(item.name, selectedMatchManual.home_team_id, item.type, true);
            for (const item of awayCards) await processPlayerEvent(item.name, selectedMatchManual.away_team_id, item.type, false);

            showToast('Resultado y eventos guardados', 'success');
            // Refresh
            fetchData(selectedLeagueId!);
            setShowManualModal(false);

        } catch (e: any) {
            console.error('Error saving manual events:', e);
            showToast('Guardado parcial: ' + (e.message || ''), 'error');
        } finally {
            setUpdating(false);
            isSubmittingRef.current = false;
        }
    };

    const handleResetMatch = async (match: Match) => {
        if (!window.confirm('¿Reiniciar partido? Se borrarán el resultado y los eventos (goles/tarjetas).')) return;

        setUpdating(true);
        try {
            const { error: matchError } = await supabase
                .from('matches')
                .update({ status: 'scheduled', home_score: 0, away_score: 0 })
                .eq('id', match.id);

            if (matchError) throw matchError;

            const { error: eventsError } = await supabase
                .from('match_events')
                .delete()
                .eq('match_id', match.id);

            if (eventsError) throw eventsError;

            showToast('Partido reiniciado', 'success');
            fetchData(selectedLeagueId!);

        } catch (e: any) {
            console.error(e);
            showToast('Error al reiniciar', 'error');
        } finally {
            setUpdating(false);
        }
    };

    const handleMatchClick = (match: Match) => {
        if (match.status !== 'finished') {
            // Go to Real Time
            navigate('/referee-match-control', { state: { matchId: match.id } });
        }
    }


    const downloadImage = async () => {
        if (!exportRef.current) return;
        setExporting(true);
        try {
            const canvas = await html2canvas(exportRef.current, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#0f172a',
                scale: 2,
            });
            const link = document.createElement('a');
            link.download = `liguilla-${currentLeagueName}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            showToast("Imagen descargada", "success");
        } catch (error) {
            console.error(error);
            showToast("Error al exportar", "error");
        } finally {
            setExporting(false);
        }
    };

    // --- RENDER HELPERS ---
    const currentLeagueName = currentLeague?.name || 'Liga';

    const getRankColor = (pos: number) => {
        if (pos === 1) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        if (pos === 2) return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
        if (pos === 3) return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    };

    const MatchCard = ({ match, title }: { match: Match, title?: string }) => {
        const homeTeam = qualifiedTeams.find(t => t.id === match.home_team_id);
        const awayTeam = qualifiedTeams.find(t => t.id === match.away_team_id);

        if (!homeTeam || !awayTeam) return null;

        const isLive = match.status === 'live' || match.status === 'break';
        const isScheduled = match.status === 'scheduled';
        const isFinished = match.status === 'finished';

        return (
            <div
                className={`group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700 overflow-hidden mb-4 ${isScheduled && canEdit ? 'cursor-pointer' : ''}`}
                onClick={() => {
                    if (canEdit && isScheduled) handleMatchClick(match);
                }}
            >
                {/* Header Status */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 flex justify-between items-center border-b border-slate-100 dark:border-slate-700/50">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isLive ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                        {title || (isLive ? 'En Vivo' : isFinished ? 'Finalizado' : 'Programado')}
                    </span>
                    {canEdit && (
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); openManualEntry(match); }}
                                className="text-blue-400 hover:text-blue-500 text-[10px] font-bold p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                title="Editar Resultado"
                            >
                                <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            {isFinished && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleResetMatch(match); }}
                                    className="text-red-400 hover:text-red-500 text-[10px] font-bold p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    title="Reiniciar"
                                >
                                    <span className="material-symbols-outlined text-base">refresh</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 flex flex-col gap-4 relative z-10">
                    {/* Home Team */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs border ${getRankColor(homeTeam.rank!)}`}>
                                #{homeTeam.rank}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="size-10 md:size-12 rounded-full bg-slate-100 dark:bg-slate-700 p-0.5 shrink-0 overflow-hidden border-2 border-slate-200 dark:border-slate-700">
                                    {homeTeam.shield_url ? <img src={homeTeam.shield_url} className="w-full h-full object-cover" /> : null}
                                </div>
                                <span className="font-bold text-slate-800 dark:text-white text-sm">{homeTeam.name}</span>
                            </div>
                        </div>
                        <span className="text-xl font-black text-slate-900 dark:text-white">{match.home_score ?? '-'}</span>
                    </div>

                    {/* VS / Divider */}
                    {isScheduled && !isLive && canEdit && (
                        <div className="flex justify-center -my-2 opacity-50 text-[10px] text-slate-400">
                            Clic para Iniciar
                        </div>
                    )}

                    {/* Away Team */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs border ${getRankColor(awayTeam.rank!)}`}>
                                #{awayTeam.rank}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="size-10 md:size-12 rounded-full bg-slate-100 dark:bg-slate-700 p-0.5 shrink-0 overflow-hidden border-2 border-slate-200 dark:border-slate-700">
                                    {awayTeam.shield_url ? <img src={awayTeam.shield_url} className="w-full h-full object-cover" /> : null}
                                </div>
                                <span className="font-bold text-slate-800 dark:text-white text-sm">{awayTeam.name}</span>
                            </div>
                        </div>
                        <span className="text-xl font-black text-slate-900 dark:text-white">{match.away_score ?? '-'}</span>
                    </div>
                </div>
            </div>
        )
    };

    // --- MAIN RENDER ---

    return (
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen pb-24 font-display">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-4xl mx-auto w-full p-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-yellow-500">workspace_premium</span>
                        Liguilla
                    </h2>
                    <div className="flex items-center gap-2">
                        {/* Admin Action Buttons */}
                        {canEdit && (
                            <div className="flex items-center gap-2 mr-2">
                                {qfMatches.length === 0 && (
                                    <button
                                        onClick={generateQuarterFinals}
                                        disabled={qualifiedTeams.length < 8 || updating}
                                        className="bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined text-base">account_tree</span>
                                        Generar Cuartos
                                    </button>
                                )}
                                {qfMatches.length > 0 && sfMatches.length === 0 && (
                                    <button
                                        onClick={generateSemiFinals}
                                        disabled={updating}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-base">forward</span>
                                        Generar Semis
                                    </button>
                                )}
                                {sfMatches.length > 0 && !finalMatch && (
                                    <button
                                        onClick={generateFinal}
                                        disabled={updating}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-base">emoji_events</span>
                                        Generar Final
                                    </button>
                                )}
                            </div>
                        )}

                        <button
                            onClick={downloadImage}
                            disabled={exporting}
                            className="bg-slate-200 dark:bg-slate-800 p-2 rounded-full hover:bg-slate-300 transition-colors"
                        >
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">download</span>
                        </button>

                        <select
                            className="bg-slate-100 dark:bg-slate-800 border-none text-sm font-semibold rounded-lg p-2 max-w-[150px] truncate outline-none focus:ring-2 focus:ring-primary dark:text-white"
                            value={selectedLeagueId || ''}
                            onChange={(e) => setSelectedLeagueId(e.target.value)}
                        >
                            {leagues.map(l => (
                                <option key={l.id} value={l.id} className="bg-white dark:bg-slate-800">{l.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto w-full p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : qualifiedTeams.length < 8 ? (
                    <div className="text-center py-20">
                        <span className="material-symbols-outlined text-6xl text-slate-300">sports_soccer</span>
                        <h3 className="text-lg font-bold text-slate-500 mt-4">Liga en fase regular</h3>
                        <p className="text-slate-400 text-sm">Se necesitan 8 equipos clasificados para iniciar la liguilla.</p>
                    </div>
                ) : (
                    <div ref={exportRef} className="bg-slate-50 dark:bg-slate-900 p-4 min-h-[600px]">
                        {/* Bracket View */}

                        {/* Quarter Finals Section */}
                        {qfMatches.length > 0 ? (
                            <div className="flex flex-col md:flex-row gap-8 overflow-x-auto pb-8">
                                {/* COL 1: Quarter Finals */}
                                <div className="flex-1 min-w-[280px]">
                                    <h3 className="text-sm uppercase tracking-widest font-bold text-slate-400 mb-4 text-center">Cuartos de Final</h3>
                                    <div className="flex flex-col gap-4">
                                        {[
                                            { h: 0, a: 7 }, // Seed 1 vs 8
                                            { h: 3, a: 4 }, // Seed 4 vs 5
                                            { h: 1, a: 6 }, // Seed 2 vs 7
                                            { h: 2, a: 5 }, // Seed 3 vs 6
                                        ].map((pair) => {
                                            const match = qfMatches.find(m => m.home_team_id === qualifiedTeams[pair.h].id);
                                            return match ? <MatchCard key={match.id} match={match} /> : null;
                                        })}
                                    </div>
                                </div>

                                {/* COL 2: Semi Finals */}
                                <div className="flex-1 min-w-[280px] flex flex-col justify-center">
                                    {sfMatches.length > 0 ? (
                                        <>
                                            <h3 className="text-sm uppercase tracking-widest font-bold text-slate-400 mb-4 text-center">Semifinales</h3>
                                            <div className="flex flex-col gap-8">
                                                {sfMatches.map(m => <MatchCard key={m.id} match={m} />)}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="h-full border-l-2 border-dashed border-slate-200 dark:border-slate-800 ml-4 flex items-center pl-8">
                                            <span className="text-slate-300 text-sm italic">Próximamente</span>
                                        </div>
                                    )}
                                </div>

                                {/* COL 3: Final */}
                                <div className="flex-1 min-w-[280px] flex flex-col justify-center">
                                    {finalMatch ? (
                                        <>
                                            <h3 className="text-sm uppercase tracking-widest font-bold text-yellow-500 mb-4 text-center">Gran Final</h3>
                                            <MatchCard match={finalMatch} />
                                        </>
                                    ) : (
                                        <div className="h-full border-l-2 border-dashed border-slate-200 dark:border-slate-800 ml-4 flex items-center pl-8">
                                            <span className="text-slate-300 text-sm italic">.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-10 animate-in fade-in">
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-8 rounded-3xl shadow-xl max-w-2xl text-center relative overflow-hidden">
                                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                                    <h2 className="text-3xl font-black italic uppercase mb-2 relative z-10">Liguilla Lista</h2>
                                    <p className="text-blue-100 mb-6 relative z-10">Los 8 mejores equipos están clasificados. Genera los cruces para comenzar la fase final.</p>

                                    <div className="grid grid-cols-2 gap-4 text-left bg-white/10 p-4 rounded-xl backdrop-blur-sm mb-6">
                                        {qualifiedTeams.map((t) => (
                                            <div key={t.id} className="flex items-center gap-3">
                                                <span className={`font-bold w-6 h-6 flex items-center justify-center rounded ${getRankColor(t.rank!)} text-xs border bg-opacity-20`}>{t.rank}</span>
                                                <span className="font-bold text-sm truncate">{t.name}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {canEdit ? (
                                        <button
                                            onClick={generateQuarterFinals}
                                            disabled={updating}
                                            className="px-8 py-3 bg-white text-blue-600 rounded-xl font-bold uppercase tracking-widest hover:bg-blue-50 transition shadow-lg disabled:opacity-50"
                                        >
                                            Generar Cruces
                                        </button>
                                    ) : (
                                        <p className="text-sm opacity-70">Esperando al administrador para iniciar...</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Manual Entry Modal */}
            {
                showManualModal && selectedMatchManual && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md md:max-w-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
                            {/* Header */}
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                                <h3 className="font-bold text-lg text-center text-slate-800 dark:text-slate-100">Resultado Manual</h3>
                            </div>

                            {/* Scrollable Content */}
                            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                                <div className="flex items-center justify-center mb-8 gap-8">
                                    <div className="flex flex-col items-center gap-2">
                                        <label className="text-sm font-bold text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{selectedMatchManual.home_team_id === qualifiedTeams.find(t => t.id === selectedMatchManual.home_team_id)?.id ? qualifiedTeams.find(t => t.id === selectedMatchManual.home_team_id)?.name : 'Local'}</label>
                                        <input
                                            type="number"
                                            className="w-20 h-20 text-center text-4xl font-black bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/20 focus:outline-none transition-all"
                                            value={manualResult.home_score}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setManualResult({ ...manualResult, home_score: val });
                                                const count = parseInt(val) || 0;
                                                setHomeGoalscorers(prev => {
                                                    const newArr = [...prev];
                                                    if (count > prev.length) return [...newArr, ...Array(count - prev.length).fill('')];
                                                    return newArr.slice(0, count);
                                                });
                                            }}
                                        />
                                    </div>
                                    <span className="text-3xl font-black text-slate-200 dark:text-slate-700 mt-6">-</span>
                                    <div className="flex flex-col items-center gap-2">
                                        <label className="text-sm font-bold text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{selectedMatchManual.away_team_id === qualifiedTeams.find(t => t.id === selectedMatchManual.away_team_id)?.id ? qualifiedTeams.find(t => t.id === selectedMatchManual.away_team_id)?.name : 'Visitante'}</label>
                                        <input
                                            type="number"
                                            className="w-20 h-20 text-center text-4xl font-black bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/20 focus:outline-none transition-all"
                                            value={manualResult.away_score}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setManualResult({ ...manualResult, away_score: val });
                                                const count = parseInt(val) || 0;
                                                setAwayGoalscorers(prev => {
                                                    const newArr = [...prev];
                                                    if (count > prev.length) return [...newArr, ...Array(count - prev.length).fill('')];
                                                    return newArr.slice(0, count);
                                                });
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Goalscorers Inputs */}
                                {(homeGoalscorers.length > 0 || awayGoalscorers.length > 0) && (
                                    <div className="flex flex-col md:flex-row gap-6 mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                        {/* Home Scorers */}
                                        <div className="flex-1 flex flex-col gap-3">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Goleadores Local</span>
                                            {homeGoalscorers.map((scorer, idx) => (
                                                <div key={`h-${idx}`}>
                                                    <input
                                                        list="home-players"
                                                        placeholder={`Gol ${idx + 1}`}
                                                        className="w-full text-sm p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:outline-none transition-all text-slate-700 dark:text-slate-200"
                                                        value={scorer}
                                                        onChange={(e) => {
                                                            const newArr = [...homeGoalscorers];
                                                            newArr[idx] = e.target.value;
                                                            setHomeGoalscorers(newArr);
                                                        }}
                                                    />
                                                    <datalist id="home-players">
                                                        {manualPlayersHome.map(p => <option key={p.id} value={p.name} />)}
                                                    </datalist>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Away Scorers */}
                                        <div className="flex-1 flex flex-col gap-3">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Goleadores Visitante</span>
                                            {awayGoalscorers.map((scorer, idx) => (
                                                <div key={`a-${idx}`}>
                                                    <input
                                                        list="away-players"
                                                        placeholder={`Gol ${idx + 1}`}
                                                        className="w-full text-sm p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:outline-none transition-all text-slate-700 dark:text-slate-200"
                                                        value={scorer}
                                                        onChange={(e) => {
                                                            const newArr = [...awayGoalscorers];
                                                            newArr[idx] = e.target.value;
                                                            setAwayGoalscorers(newArr);
                                                        }}
                                                    />
                                                    <datalist id="away-players">
                                                        {manualPlayersAway.map(p => <option key={p.id} value={p.name} />)}
                                                    </datalist>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Cards Section */}
                                <div className="flex flex-col md:flex-row gap-6 mb-8">
                                    {/* Home Cards */}
                                    <div className="flex-1 flex flex-col gap-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tarjetas Local</span>
                                            <button
                                                onClick={() => setHomeCards([...homeCards, { name: '', type: 'yellow_card' }])}
                                                className="p-1 px-3 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">add</span>
                                            </button>
                                        </div>
                                        {homeCards.length === 0 && <div className="text-xs text-slate-300 italic text-center py-2">Sin tarjetas</div>}
                                        {homeCards.map((card, idx) => (
                                            <div key={`hc-${idx}`} className="flex gap-2 items-center animate-in slide-in-from-left-2 fade-in">
                                                <input
                                                    list="home-players"
                                                    placeholder="Jugador"
                                                    className="flex-1 text-sm p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-w-0 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:text-white"
                                                    value={card.name}
                                                    onChange={(e) => {
                                                        const newArr = [...homeCards];
                                                        newArr[idx].name = e.target.value;
                                                        setHomeCards(newArr);
                                                    }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newArr = [...homeCards];
                                                        newArr[idx].type = newArr[idx].type === 'yellow_card' ? 'red_card' : 'yellow_card';
                                                        setHomeCards(newArr);
                                                    }}
                                                    className={`w-10 h-11 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95 ${card.type === 'yellow_card' ? 'bg-yellow-100 border-2 border-yellow-200' : 'bg-red-100 border-2 border-red-200'}`}
                                                >
                                                    <div className={`w-3 h-4 rounded-[1px] shadow-sm ${card.type === 'yellow_card' ? 'bg-yellow-400' : 'bg-red-500'}`}></div>
                                                </button>
                                                <button
                                                    onClick={() => setHomeCards(homeCards.filter((_, i) => i !== idx))}
                                                    className="w-10 h-11 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Away Cards */}
                                    <div className="flex-1 flex flex-col gap-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tarjetas Visitante</span>
                                            <button
                                                onClick={() => setAwayCards([...awayCards, { name: '', type: 'yellow_card' }])}
                                                className="p-1 px-3 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">add</span>
                                            </button>
                                        </div>
                                        {awayCards.length === 0 && <div className="text-xs text-slate-300 italic text-center py-2">Sin tarjetas</div>}
                                        {awayCards.map((card, idx) => (
                                            <div key={`ac-${idx}`} className="flex gap-2 items-center animate-in slide-in-from-right-2 fade-in">
                                                <input
                                                    list="away-players"
                                                    placeholder="Jugador"
                                                    className="flex-1 text-sm p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-w-0 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:outline-none transition-all dark:text-white"
                                                    value={card.name}
                                                    onChange={(e) => {
                                                        const newArr = [...awayCards];
                                                        newArr[idx].name = e.target.value;
                                                        setAwayCards(newArr);
                                                    }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newArr = [...awayCards];
                                                        newArr[idx].type = newArr[idx].type === 'yellow_card' ? 'red_card' : 'yellow_card';
                                                        setAwayCards(newArr);
                                                    }}
                                                    className={`w-10 h-11 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95 ${card.type === 'yellow_card' ? 'bg-yellow-100 border-2 border-yellow-200' : 'bg-red-100 border-2 border-red-200'}`}
                                                >
                                                    <div className={`w-3 h-4 rounded-[1px] shadow-sm ${card.type === 'yellow_card' ? 'bg-yellow-400' : 'bg-red-500'}`}></div>
                                                </button>
                                                <button
                                                    onClick={() => setAwayCards(awayCards.filter((_, i) => i !== idx))}
                                                    className="w-10 h-11 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 mb-2 justify-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => setManualResult({ ...manualResult, finished: !manualResult.finished })}>
                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${manualResult.finished ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {manualResult.finished && <span className="material-symbols-outlined text-white text-sm font-bold">check</span>}
                                    </div>
                                    <label className="font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">Marcar partido como Finalizado</label>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowManualModal(false)}
                                        className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={saveManualResult}
                                        disabled={updating}
                                        className="flex-1 py-3.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        {updating ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <span className="material-symbols-outlined">save</span>}
                                        Guardar Resultado
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default LiguillaScreen;
