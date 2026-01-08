import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';

interface Match {
  id: string;
  start_time: string;
  home_score: number;
  away_score: number;
  status: string;
  home_team: { name: string; shield_url?: string };
  away_team: { name: string; shield_url?: string };
  league?: { name: string };
  league_id?: string; // Added league_id for filtering
  round_number?: number;
}

const CalendarScreen: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null); // Added role state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'next_round'>('all');
  const [leagues, setLeagues] = useState<any[]>([]); // Added leagues state
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(''); // Added selectedLeagueId state

  useEffect(() => {
    const fetchRoleAndMatches = async () => {
      setLoading(true);

      // Fetch Role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        setRole(profile?.role || 'user');
      }

      // Fetch Leagues
      const { data: leaguesData } = await supabase.from('leagues').select('id, name').order('created_at', { ascending: false });
      if (leaguesData) {
        setLeagues(leaguesData);
        // Default to first league if none selected. Using functional update to avoid overwriting user selection if re-fetching?
        // Actually, just set if empty.
        setSelectedLeagueId(prev => prev || (leaguesData.length > 0 ? leaguesData[0].id : ''));
      }

      // Fetch Matches
      const { data, error } = await supabase
        .from('matches')
        .select(`
            id, 
            start_time, 
            home_score, 
            away_score, 
            status,
            round_number,
            league_id,
            home_team:teams!matches_home_team_id_fkey(name, shield_url),
            away_team:teams!matches_away_team_id_fkey(name, shield_url),
            league:leagues(name)
        `)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching matches:', error);
        showToast('Error al cargar partidos', 'error');
      } else {
        const formattedData = (data as any[] || []).map(m => ({
          ...m,
          home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
          away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team,
          league: Array.isArray(m.league) ? m.league[0] : m.league
        }));
        setMatches(formattedData);
      }
      setLoading(false);
    };

    fetchRoleAndMatches();
  }, [showToast]);

  // Filter matches
  const filteredMatchesList = matches.filter(match => {
    // Filter by Selected League
    if (selectedLeagueId && match.league_id !== selectedLeagueId) return false;

    const query = searchQuery.toLowerCase();
    const matchesSearch = match.home_team?.name.toLowerCase().includes(query) ||
      match.away_team?.name.toLowerCase().includes(query) ||
      match.league?.name?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (filterMode === 'next_round') {
      return true;
    }

    return true;
  });

  const upcomingMatches = matches.filter(m => m.status === 'scheduled' && (!selectedLeagueId || m.league_id === selectedLeagueId));
  const nextRoundNumber = upcomingMatches.length > 0
    ? Math.min(...upcomingMatches.map(m => m.round_number || 100))
    : 0;

  // Re-filter filteredMatchesList for next round logic?
  // Logic above: `if (filterMode === 'next_round') return true;` -> doesn't enforce round!
  // It relies on grouping later.
  // Actually, line 84 in Step 611: `if (filterMode === 'next_round') { if ((match.round_number || 0) !== nextRoundNumber) return acc; }`
  // So I need to ensure `nextRoundNumber` respects the league filter too (Added above).

  // ... (Grouping logic) ...
  const groupedMatches = filteredMatchesList.reduce((acc, match) => {
    if (filterMode === 'next_round') {
      if ((match.round_number || 0) !== nextRoundNumber) return acc;
    }

    const round = match.round_number || 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {} as Record<number, Match[]>);

  const sortedRounds = Object.keys(groupedMatches).map(Number).sort((a, b) => a - b);
  // ... (Formatters) ...
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-background-light dark:bg-background-dark transition-colors duration-200 min-h-screen">
      {/* Wrapper to replace max-w-md with responsive max-w */}
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-7xl mx-auto shadow-2xl">

        {/* Header - Stays sticky */}
        <header className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-20 border-b border-transparent dark:border-slate-800">
          {isSearchOpen ? (
            <div className="flex flex-1 items-center bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1 mx-2">
              <input
                autoFocus
                type="text"
                placeholder="Buscar equipo..."
                className="flex-1 bg-transparent border-none outline-none text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="text-slate-400">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center">
              {leagues.length > 0 ? (
                <div className="relative group">
                  <select
                    value={selectedLeagueId}
                    onChange={(e) => setSelectedLeagueId(e.target.value)}
                    className="bg-transparent text-2xl font-bold text-slate-900 dark:text-white border-none outline-none cursor-pointer appearance-none pr-8 py-1 z-10"
                  >
                    {leagues.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-slate-900 dark:text-white pointer-events-none">expand_more</span>
                </div>
              ) : (
                <h2 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">Calendario</h2>
              )}
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            {!isSearchOpen && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center justify-center rounded-full w-10 h-10 bg-transparent text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">search</span>
              </button>
            )}
            {role === 'admin' && (
              <button
                onClick={() => navigate('/fixture-generator')}
                className="flex items-center justify-center rounded-full w-10 h-10 bg-primary text-white shadow-lg hover:bg-primary-dark transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">auto_fix</span>
              </button>
            )}
          </div>
        </header>

        {/* Segmented Control */}
        <div className="px-4 py-3 bg-background-light dark:bg-background-dark z-10 sticky top-[60px] pb-4">
          <div className="max-w-md mx-auto">
            <div className="flex h-10 w-full items-center justify-center rounded-lg bg-gray-200 dark:bg-[#232f48] p-1">
              <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-md transition-all duration-200 relative">
                <input
                  checked={filterMode === 'all'}
                  onChange={() => setFilterMode('all')}
                  className="peer invisible w-0 absolute"
                  name="view-toggle"
                  type="radio"
                  value="all"
                />
                <span className="z-10 truncate text-sm font-bold leading-normal text-slate-500 dark:text-[#92a4c9] peer-checked:text-primary dark:peer-checked:text-white transition-colors">Todos</span>
                <div className="absolute inset-0 bg-white dark:bg-background-dark shadow-sm rounded-md opacity-0 peer-checked:opacity-100 transition-all duration-200"></div>
              </label>
              <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-md transition-all duration-200 relative">
                <input
                  checked={filterMode === 'next_round'}
                  onChange={() => setFilterMode('next_round')}
                  className="peer invisible w-0 absolute"
                  name="view-toggle"
                  type="radio"
                  value="next_round"
                />
                <span className="z-10 truncate text-sm font-bold leading-normal text-slate-500 dark:text-[#92a4c9] peer-checked:text-primary dark:peer-checked:text-white transition-colors">Próxima Jornada</span>
                <div className="absolute inset-0 bg-white dark:bg-background-dark shadow-sm rounded-md opacity-0 peer-checked:opacity-100 transition-all duration-200"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Match List Grouped by Round */}
        <div className="flex-1 bg-background-light dark:bg-background-dark pb-24 px-4 flex flex-col gap-6">
          {loading ? (
            <div className="text-center py-20 text-slate-500">Cargando partidos...</div>
          ) : matches.length === 0 ? (
            <div className="text-center py-20 text-slate-500">No hay partidos programados.</div>
          ) : (
            sortedRounds.map(round => {
              const roundMatches = groupedMatches[round];
              const roundDate = roundMatches.length > 0 ? formatDate(roundMatches[0].start_time) : '';

              return (
                <div key={round} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex flex-col">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider w-fit">
                        Jornada {round}
                      </span>
                      <span className="text-xs text-slate-400 font-medium ml-1 mt-1 capitalize">{roundDate}</span>
                    </div>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1 mt-auto mb-2"></div>
                  </div>

                  {/* Responsive Grid for Matches */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roundMatches.map((match) => (
                      <div
                        key={match.id}
                        onClick={() => {
                          if (role === 'admin' || role === 'referee') {
                            navigate('/referee-match-control', { state: { matchId: match.id } });
                          }
                        }}
                        className={`bg-white dark:bg-surface-dark rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm transition-all ${(role === 'admin' || role === 'referee') ? 'cursor-pointer hover:border-primary active:scale-[0.99]' : ''
                          }`}
                      >
                        <div className="flex justify-end items-center mb-3 text-xs text-slate-500 font-bold uppercase tracking-wider">
                          <span>{formatTime(match.start_time)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          {/* Home */}
                          <div className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden bg-cover bg-center" style={match.home_team?.shield_url ? { backgroundImage: `url("${match.home_team.shield_url}")` } : {}}>
                              {!match.home_team?.shield_url && <span className="material-symbols-outlined text-slate-300">shield</span>}
                            </div>
                            <span className="text-xs font-bold text-center leading-tight">{match.home_team?.name || 'Local'}</span>
                          </div>

                          {/* Score / VS */}
                          <div className="flex flex-col items-center px-4">
                            {match.status === 'finished' || match.status === 'live' || match.status === 'break' ? (
                              <div className="text-2xl font-black tracking-tight font-mono">
                                {match.home_score} - {match.away_score}
                              </div>
                            ) : (
                              <div className="text-lg font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                                VS
                              </div>
                            )}
                            <span className={`text-[10px] uppercase font-bold mt-1 px-2 py-0.5 rounded-full ${match.status === 'live' ? 'bg-red-500 text-white animate-pulse' : match.status === 'break' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>
                              {match.status === 'scheduled' ? 'Programado' : match.status === 'live' ? 'En Vivo' : match.status === 'break' ? 'Entretiempo' : 'Finalizado'}
                            </span>
                          </div>

                          {/* Away */}
                          <div className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden bg-cover bg-center" style={match.away_team?.shield_url ? { backgroundImage: `url("${match.away_team.shield_url}")` } : {}}>
                              {!match.away_team?.shield_url && <span className="material-symbols-outlined text-slate-300">shield</span>}
                            </div>
                            <span className="text-xs font-bold text-center leading-tight">{match.away_team?.name || 'Visitante'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarScreen;
