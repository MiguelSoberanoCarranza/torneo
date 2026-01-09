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
  home_team_id: string;
  away_team_id: string;
  location?: string;
  league?: { name: string };
  league_id?: string;
  round_number?: number;
}

const CalendarScreen: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null); // Added user state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'next_round'>('all');
  const [leagues, setLeagues] = useState<any[]>([]); // Added leagues state
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [teams, setTeams] = useState<any[]>([]); // Teams for the selector

  // Edit State
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    time: '',
    round: 1,
    home_team_id: '',
    away_team_id: '',
    location: ''
  });

  const [isCreating, setIsCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchRoleAndMatches = async () => {
      setLoading(true);

      // Fetch Role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        setRole(profile?.role || 'user');
      }
      setUser(user);

      // Fetch Leagues
      const { data: leaguesData } = await supabase.from('leagues').select('id, name, owner_id').order('created_at', { ascending: false });
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
            location,
            league_id,
            home_team_id,
            away_team_id,
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
    fetchRoleAndMatches();
  }, [showToast]);

  // Fetch Teams when League Changes
  useEffect(() => {
    const fetchTeams = async () => {
      if (!selectedLeagueId) {
        setTeams([]);
        return;
      }
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name')
        .eq('league_id', selectedLeagueId)
        .order('name');

      if (teamsData) setTeams(teamsData);
    };

    fetchTeams();
  }, [selectedLeagueId]);

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

  const handleEditClick = (match: Match) => {
    const dateObj = new Date(match.start_time);
    // Format YYYY-MM-DD
    const date = dateObj.toISOString().split('T')[0];
    // Format HH:mm
    const time = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

    setEditingMatch(match);
    setIsCreating(false);
    setEditForm({
      date,
      time,
      round: match.round_number || 1,
      home_team_id: match.home_team_id,
      away_team_id: match.away_team_id,
      location: match.location || ''
    });
  };

  const handleCreateClick = () => {
    // Default values
    const today = new Date();
    const date = today.toISOString().split('T')[0];
    const time = '09:00'; // Default start time

    setIsCreating(true);
    setEditingMatch(null);
    setEditForm({
      date,
      time,
      round: nextRoundNumber || 1, // Suggest next round
      home_team_id: '',
      away_team_id: '',
      location: ''
    });
  };

  const handleSaveMatch = async () => {
    if (!selectedLeagueId) {
      showToast("Error: No hay liga seleccionada", "error");
      return;
    }
    setUpdating(true);

    try {
      // Validate inputs
      if (!editForm.home_team_id || !editForm.away_team_id) {
        showToast("Selecciona ambos equipos", "error");
        setUpdating(false);
        return;
      }

      if (editForm.home_team_id === editForm.away_team_id) {
        showToast("No puedes seleccionar el mismo equipo", "error");
        setUpdating(false);
        return;
      }

      // Construct ISO string
      const dateTimeString = `${editForm.date}T${editForm.time}:00`;
      const newDate = new Date(dateTimeString);

      if (isCreating) {
        // INSERT Logic
        const { data, error } = await supabase
          .from('matches')
          .insert([{
            league_id: selectedLeagueId,
            home_team_id: editForm.home_team_id,
            away_team_id: editForm.away_team_id,
            start_time: newDate.toISOString(),
            status: 'scheduled',
            round_number: editForm.round,
            location: editForm.location
          }])
          .select()
          .single();

        if (error) throw error;

        showToast('Partido creado', 'success');
        setIsCreating(false);

        const homeTeam = teams.find(t => t.id === editForm.home_team_id);
        const awayTeam = teams.find(t => t.id === editForm.away_team_id);

        const newMatch: Match = {
          ...data,
          home_team: homeTeam || { name: 'Local' },
          away_team: awayTeam || { name: 'Visitante' }
        };

        setMatches(prev => [...prev, newMatch].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));

      } else if (editingMatch) {
        // UPDATE Logic
        const { error } = await supabase
          .from('matches')
          .update({
            start_time: newDate.toISOString(),
            round_number: editForm.round,
            home_team_id: editForm.home_team_id,
            away_team_id: editForm.away_team_id,
            location: editForm.location
          })
          .eq('id', editingMatch.id);

        if (error) throw error;

        showToast('Partido actualizado', 'success');
        setEditingMatch(null);

        // Optimistic update
        const newHomeTeam = teams.find(t => t.id === editForm.home_team_id);
        const newAwayTeam = teams.find(t => t.id === editForm.away_team_id);

        setMatches(prev => prev.map(m => m.id === editingMatch.id ? {
          ...m,
          start_time: newDate.toISOString(),
          round_number: editForm.round,
          home_team_id: editForm.home_team_id,
          away_team_id: editForm.away_team_id,
          location: editForm.location,
          home_team: newHomeTeam ? { name: newHomeTeam.name, shield_url: m.home_team.shield_url } : m.home_team,
          away_team: newAwayTeam ? { name: newAwayTeam.name, shield_url: m.away_team.shield_url } : m.away_team
        } : m));
      }

    } catch (error: any) {
      console.error('Error saving match:', error);
      showToast('Error al guardar', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteMatch = async () => {
    if (!editingMatch) return;

    if (!window.confirm('¿Estás seguro de que quieres eliminar este partido?')) {
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', editingMatch.id);

      if (error) throw error;

      showToast('Partido eliminado', 'success');
      setMatches(prev => prev.filter(m => m.id !== editingMatch.id));
      setEditingMatch(null);
    } catch (error) {
      console.error('Error deleting match:', error);
      showToast('Error al eliminar', 'error');
    } finally {
      setUpdating(false);
    }
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

            {user && leagues.find(l => l.id === selectedLeagueId)?.owner_id === user.id && (
              <>
                <button
                  onClick={handleCreateClick}
                  className="flex items-center justify-center rounded-full w-10 h-10 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                  title="Crear Partido Manualmente"
                >
                  <span className="material-symbols-outlined text-[24px]">add</span>
                </button>
                <button
                  onClick={() => navigate('/fixture-generator')}
                  className="flex items-center justify-center rounded-full w-10 h-10 bg-primary text-white shadow-lg hover:bg-primary-dark transition-colors"
                  title="Generador Automático"
                >
                  <span className="material-symbols-outlined text-[24px]">auto_fix</span>
                </button>
              </>
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
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{formatTime(match.start_time)}</span>
                          {/* Edit Button */}
                          {match.status === 'scheduled' && (role === 'admin' || (user && leagues.find(l => l.id === match.league_id)?.owner_id === user.id)) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(match);
                              }}
                              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary transition-colors"
                              title="Editar Partido"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                          )}
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

        {/* Edit Match Modal */}
        {(editingMatch || isCreating) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-surface-dark rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                {isCreating ? 'Crear Partido' : 'Editar Partido'}
              </h3>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Jornada</label>
                  <input
                    type="number"
                    value={editForm.round}
                    onChange={e => setEditForm({ ...editForm, round: parseInt(e.target.value) || 0 })}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Local</label>
                    <select
                      value={editForm.home_team_id}
                      onChange={(e) => setEditForm({ ...editForm, home_team_id: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white text-sm appearance-none"
                    >
                      <option value="">Seleccionar</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Visitante</label>
                    <select
                      value={editForm.away_team_id}
                      onChange={(e) => setEditForm({ ...editForm, away_team_id: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white text-sm appearance-none"
                    >
                      <option value="">Seleccionar</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Hora</label>
                    <input
                      type="time"
                      value={editForm.time}
                      onChange={e => setEditForm({ ...editForm, time: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-8">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setEditingMatch(null); setIsCreating(false); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveMatch}
                    disabled={updating}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary-dark transition-colors shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                  >
                    {updating && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                    {isCreating ? 'Crear' : 'Guardar'}
                  </button>
                </div>

                {!isCreating && editingMatch?.status === 'scheduled' && (
                  <button
                    onClick={handleDeleteMatch}
                    disabled={updating}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
                  >
                    Eliminar Partido
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarScreen;
