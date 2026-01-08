import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MatchEvent {
    id: string;
    event_type: 'goal' | 'yellow_card' | 'red_card' | 'substitution';
    minute: number;
    player_id: string;
    player: {
        name: string;
        team_id: string;
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
            id, home_team_id, away_team_id, home_score, away_score, start_time, status,
            home_team:home_team_id(name, shield_url),
            away_team:away_team_id(name, shield_url),
            league:league_id(name)
          `)
                    .eq('id', id)
                    .single();

                if (matchError) throw matchError;

                // Fetch Events
                const { data: eventsData, error: eventsError } = await supabase
                    .from('match_events')
                    .select(`
            id, event_type, minute, player_id,
            player:player_id(name, team_id)
          `)
                    .eq('match_id', id)
                    .order('minute', { ascending: true });

                if (eventsError) throw eventsError;

                // Transform data to match interfaces
                const formattedMatch = {
                    ...matchData,
                    home_team: Array.isArray(matchData.home_team) ? matchData.home_team[0] : matchData.home_team,
                    away_team: Array.isArray(matchData.away_team) ? matchData.away_team[0] : matchData.away_team,
                    league: Array.isArray(matchData.league) ? matchData.league[0] : matchData.league,
                };

                const formattedEvents = (eventsData || []).map((ev: any) => ({
                    ...ev,
                    player: Array.isArray(ev.player) ? ev.player[0] : ev.player,
                }));

                setMatch(formattedMatch as unknown as MatchDetail);
                setEvents(formattedEvents as unknown as MatchEvent[]);
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
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!match) return null;

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'goal': return 'sports_soccer';
            case 'yellow_card': return 'style'; // Rotate 90deg via CSS if needed, or just use style icon
            case 'red_card': return 'style';
            case 'substitution': return 'sync_alt';
            default: return 'circle';
        }
    };

    const getEventColor = (type: string) => {
        switch (type) {
            case 'goal': return 'text-slate-800 dark:text-white';
            case 'yellow_card': return 'text-yellow-500';
            case 'red_card': return 'text-red-500';
            case 'substitution': return 'text-green-500';
            default: return 'text-gray-500';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 font-display">
            {/* Header / Scoreboard */}
            <div className="bg-white dark:bg-surface-dark shadow-sm border-b border-slate-200 dark:border-slate-800 p-6 pt-12 relative overflow-hidden">

                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 left-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors z-10"
                >
                    <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
                </button>

                <div className="text-center mb-6 relative z-10">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-3 py-1 rounded-full">
                        {match.league?.name || 'Torneo'} • {match.status === 'finished' ? 'Finalizado' : 'En Vivo'}
                    </span>
                </div>

                <div className="flex items-center justify-between max-w-md mx-auto relative z-10">
                    {/* Home Team */}
                    <div className="flex flex-col items-center w-1/3">
                        <div className="size-20 bg-white dark:bg-slate-800 rounded-full shadow-lg p-3 mb-3 border-2 border-slate-100 dark:border-slate-700 flex items-center justify-center">
                            {match.home_team?.shield_url ? (
                                <img src={match.home_team.shield_url} className="w-full h-full object-contain" alt={match.home_team.name} />
                            ) : (
                                <span className="material-symbols-outlined text-4xl text-slate-300">shield</span>
                            )}
                        </div>
                        <h2 className="font-bold text-sm text-center text-slate-900 dark:text-white leading-tight">{match.home_team?.name}</h2>
                    </div>

                    {/* Score */}
                    <div className="flex flex-col items-center">
                        <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                            {match.home_score} - {match.away_score}
                        </div>
                        <div className="text-sm font-medium text-slate-500 mt-2">
                            {format(new Date(match.start_time), 'dd MMM, HH:mm', { locale: es })}
                        </div>
                    </div>

                    {/* Away Team */}
                    <div className="flex flex-col items-center w-1/3">
                        <div className="size-20 bg-white dark:bg-slate-800 rounded-full shadow-lg p-3 mb-3 border-2 border-slate-100 dark:border-slate-700 flex items-center justify-center">
                            {match.away_team?.shield_url ? (
                                <img src={match.away_team.shield_url} className="w-full h-full object-contain" alt={match.away_team.name} />
                            ) : (
                                <span className="material-symbols-outlined text-4xl text-slate-300">shield</span>
                            )}
                        </div>
                        <h2 className="font-bold text-sm text-center text-slate-900 dark:text-white leading-tight">{match.away_team?.name}</h2>
                    </div>
                </div>
            </div>

            {/* Timeline Container */}
            <div className="max-w-md mx-auto p-6 relative">
                <h3 className="text-center text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Minuto a Minuto</h3>

                {/* Vertical Line */}
                <div className="absolute left-1/2 top-20 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 -translate-x-1/2"></div>

                <div className="space-y-6 relative">
                    {events.map((event) => {
                        const isHome = event.player?.team_id === match.home_team_id;

                        return (
                            <div key={event.id} className={`flex items-center w-full ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
                                {/* Event Content (Matches side) */}
                                <div className={`w-[calc(50%-20px)] flex items-center ${isHome ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex flex-col ${isHome ? 'items-end text-right' : 'items-start text-left'}`}>
                                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                            {event.player?.name}
                                        </span>
                                        <span className="text-xs text-slate-500 capitalize">{event.event_type.replace('_', ' ')}</span>
                                    </div>
                                </div>

                                {/* Center Node */}
                                <div className="w-[40px] flex justify-center items-center relative z-10 mx-auto">
                                    <div className="size-8 bg-white dark:bg-slate-800 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                                        <span className={`material-symbols-outlined text-lg ${getEventColor(event.event_type)}`}>
                                            {getEventIcon(event.event_type)}
                                        </span>
                                    </div>
                                    <span className="absolute -top-5 text-[10px] font-bold text-slate-400">{event.minute}'</span>
                                </div>

                                {/* Empty Space for opposite side */}
                                <div className="w-[calc(50%-20px)]"></div>
                            </div>
                        );
                    })}

                    {events.length === 0 && (
                        <div className="text-center text-slate-400 py-10">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">history_toggle_off</span>
                            <p>No hay eventos registrados para este partido.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MatchDetailsScreen;
