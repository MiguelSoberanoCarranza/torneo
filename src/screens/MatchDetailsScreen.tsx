import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Header from '../components/Header';

interface MatchEvent {
    id: string;
    event_type: 'goal' | 'yellow_card' | 'red_card' | 'substitution';
    minute: number;
    player_id: string;
    player: {
        name: string;
    };
    player_in?: {
        name: string;
    };
}

interface MatchDetail {
    id: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number;
    away_score: number;
    start_time: string;
    status: string;
    home_team: { name: string; shield_url: string; };
    away_team: { name: string; shield_url: string; };
    league: { name: string; };
    round_number?: number;
}

const MatchDetailsScreen = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [match, setMatch] = useState<MatchDetail | null>(null);
    const [events, setEvents] = useState<MatchEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;

            try {
                // Fetch Match Info
                const { data: matchData, error: matchError } = await supabase
                    .from('matches')
                    .select(`
            id, home_team_id, away_team_id, home_score, away_score, start_time, status, round_number,
            home_team:teams!matches_home_team_id_fkey(name, shield_url),
            away_team:teams!matches_away_team_id_fkey(name, shield_url),
            league:leagues(name)
          `)
                    .eq('id', id)
                    .single();

                if (matchError) throw matchError;

                // Fetch Events
                const { data: eventsData, error: eventsError } = await supabase
                    .from('match_events')
                    .select(`
            *,
            player:players!match_events_player_id_fkey(name),
            player_in:players!match_events_player_in_id_fkey(name)
          `)
                    .eq('match_id', id)
                    .order('created_at', { ascending: false });

                if (eventsError) throw eventsError;

                // Transform data
                const formattedMatch = {
                    ...matchData,
                    home_team: Array.isArray(matchData.home_team) ? matchData.home_team[0] : matchData.home_team,
                    away_team: Array.isArray(matchData.away_team) ? matchData.away_team[0] : matchData.away_team,
                    league: Array.isArray(matchData.league) ? matchData.league[0] : matchData.league,
                };

                setMatch(formattedMatch as unknown as MatchDetail);
                setEvents(eventsData as unknown as MatchEvent[]);
            } catch (err) {
                console.error('Error loading match details:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!match) return null;

    const redCardsA = events.filter(e => e.player?.name && (match.home_team_id && e.player_id && true) && e.event_type === 'red_card').length; // Logic simplified, strictly we check team_id in events if available or infer
    // Actually typically events have team_id. Let's check if we queried it or can infer.
    // The previous Live screen calculates cards based on team_id in event.
    // Let's assume we can fetch team_id in events or infer from context.
    // Ideally we should select team_id in the query above.

    // Correction: Let's assume standard event fetching includes team_id or we rely on the component display logic.
    // For the UI cards summary:
    // We'll trust the events list has what we need or skip the summary dots if too complex to infer without team_id.
    // But wait, the previous code fetched `*`. So team_id matches match_events schema.

    const countCards = (teamId: string, type: 'yellow_card' | 'red_card') => {
        // We need to check if event has team_id.
        // If not explicitly fetched as prop, `*` includes it.
        return events.filter((e: any) => e.team_id === teamId && e.event_type === type).length;
    };

    const redCardsHome = countCards(match.home_team_id, 'red_card');
    const yellowCardsHome = countCards(match.home_team_id, 'yellow_card');
    const redCardsAway = countCards(match.away_team_id, 'red_card');
    const yellowCardsAway = countCards(match.away_team_id, 'yellow_card');


    return (
        <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex flex-col overflow-x-hidden antialiased text-slate-900 dark:text-white">
            <Header
                title={`Jornada ${match.round_number || '-'}`}
                onBack={() => navigate(-1)}
            />

            {/* Main Content */}
            <main className="flex-1 w-full max-w-lg mx-auto pb-12">
                <div className="flex justify-center pt-6 pb-2">
                    <div className="flex items-center gap-x-2 rounded-full bg-slate-500/20 border border-slate-500/30 px-3 py-1">
                        <p className="text-slate-500 text-xs font-bold tracking-wider uppercase">
                            {match.status === 'finished' ? 'Finalizado' : match.status}
                        </p>
                    </div>
                </div>

                {/* Scoreboard Hero */}
                <div className="px-4 py-4">
                    <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 p-6 flex flex-col gap-6">

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
                                    {Array(yellowCardsHome).fill(0).map((_, i) => <div key={i} className="w-1.5 h-2.5 bg-yellow-400 rounded-sm"></div>)}
                                    {Array(redCardsHome).fill(0).map((_, i) => <div key={i} className="w-1.5 h-2.5 bg-red-600 rounded-sm"></div>)}
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
                                    {Array(yellowCardsAway).fill(0).map((_, i) => <div key={i} className="w-1.5 h-2.5 bg-yellow-400 rounded-sm"></div>)}
                                    {Array(redCardsAway).fill(0).map((_, i) => <div key={i} className="w-1.5 h-2.5 bg-red-600 rounded-sm"></div>)}
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
                            <p className="text-slate-500 text-sm text-center">No hay eventos registrados.</p>
                        ) : (
                            events.map((event: any) => {
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

export default MatchDetailsScreen;
