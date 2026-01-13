import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';
import html2canvas from 'html2canvas';

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
  const isSubmittingRef = useRef(false);
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

  /* Manual Entry State */
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedMatchManual, setSelectedMatchManual] = useState<Match | null>(null);
  const [manualResult, setManualResult] = useState({ home_score: '', away_score: '', finished: true });
  const [manualPlayersHome, setManualPlayersHome] = useState<any[]>([]);
  const [manualPlayersAway, setManualPlayersAway] = useState<any[]>([]);
  const [homeGoalscorers, setHomeGoalscorers] = useState<string[]>([]);
  const [awayGoalscorers, setAwayGoalscorers] = useState<string[]>([]);
  const [homeCards, setHomeCards] = useState<{ name: string, type: 'yellow_card' | 'red_card' }[]>([]);
  const [awayCards, setAwayCards] = useState<{ name: string, type: 'yellow_card' | 'red_card' }[]>([]);

  /* Export State */
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState<{ round: number; matches: Match[] } | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const [exporting, setExporting] = useState(false);

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

      // Fetch Leagues with Priority
      let currentLeagues: any[] = [];
      let myFollows: string[] = [];

      if (user) {
        const { data: follows } = await supabase.from('league_followers').select('league_id').eq('user_id', user.id);
        if (follows) {
          myFollows = follows.map(f => f.league_id);
          if (myFollows.length > 0) {
            const { data: followed } = await supabase.from('leagues').select('id, name, owner_id').in('id', myFollows);
            if (followed) currentLeagues = [...currentLeagues, ...followed];
          }
        }
        const { data: owned } = await supabase.from('leagues').select('id, name, owner_id').eq('owner_id', user.id);
        if (owned) {
          const existingIds = new Set(currentLeagues.map(l => l.id));
          owned.forEach(l => !existingIds.has(l.id) && currentLeagues.push(l));
        }
      }

      const { data: publicLeagues } = await supabase.from('leagues').select('id, name, owner_id').order('created_at', { ascending: false }).limit(20);
      if (publicLeagues) {
        const existingIds = new Set(currentLeagues.map(l => l.id));
        publicLeagues.forEach(l => !existingIds.has(l.id) && currentLeagues.push(l));
      }

      // Sort
      currentLeagues.sort((a, b) => {
        const aFollow = myFollows.includes(a.id) ? 1 : 0;
        const bFollow = myFollows.includes(b.id) ? 1 : 0;
        if (aFollow !== bFollow) return bFollow - aFollow;
        const aOwner = user && a.owner_id === user.id ? 1 : 0;
        const bOwner = user && b.owner_id === user.id ? 1 : 0;
        if (aOwner !== bOwner) return bOwner - aOwner;
        return 0;
      });

      if (currentLeagues.length > 0) {
        setLeagues(currentLeagues);
        setSelectedLeagueId(prev => prev || currentLeagues[0].id);
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

    // Prevent double execution
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setUpdating(true);

    try {
      // Validate inputs
      if (!editForm.home_team_id || !editForm.away_team_id) {
        showToast("Selecciona ambos equipos", "error");
        setUpdating(false);
        isSubmittingRef.current = false;
        return;
      }

      if (editForm.home_team_id === editForm.away_team_id) {
        showToast("No puedes seleccionar el mismo equipo", "error");
        setUpdating(false);
        isSubmittingRef.current = false;
        return;
      }

      // Conflict Validation Removed: Teams CAN play multiple times in a round (Jornada Doble)

      // Construct ISO string handling Timezone
      const [year, month, day] = editForm.date.split('-').map(Number);
      const [hours, minutes] = editForm.time.split(':').map(Number);
      const localDate = new Date(year, month - 1, day, hours, minutes);
      const dateTimeString = localDate.toISOString();

      const homeTeam = teams.find(t => t.id === editForm.home_team_id);
      const awayTeam = teams.find(t => t.id === editForm.away_team_id);

      const matchData = {
        league_id: selectedLeagueId,
        home_team_id: editForm.home_team_id,
        away_team_id: editForm.away_team_id,
        start_time: dateTimeString,
        location: editForm.location,
        round_number: editForm.round,
        status: isCreating ? 'scheduled' : undefined // Only set scheduled on create
      };

      if (isCreating) {
        const { data, error } = await supabase.from('matches').insert([matchData]).select().single();
        if (error) throw error;

        showToast("Partido creado exitosamente", "success");
        setIsCreating(false);

        // Optimistic add
        const newMatch: Match = {
          ...data,
          home_team: homeTeam || { name: 'Local' },
          away_team: awayTeam || { name: 'Visitante' }
        };
        setMatches(prev => [...prev, newMatch].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));

      } else if (editingMatch) {
        // Update Logic
        const { error } = await supabase
          .from('matches')
          .update(matchData)
          .eq('id', editingMatch.id);

        if (error) throw error;
        showToast("Partido actualizado", "success");

        setMatches(prev => prev.map(m => m.id === editingMatch.id ? {
          ...m,
          ...matchData,
          status: matchData.status || m.status, // Ensure status is preserved
          start_time: dateTimeString, // Ensure string format
          home_team: homeTeam ? { ...m.home_team, name: homeTeam.name } : m.home_team,
          away_team: awayTeam ? { ...m.away_team, name: awayTeam.name } : m.away_team
        } : m));

        setEditingMatch(null);
      }

      // Optionally re-fetch to be safe
      // fetchMatches(); 

    } catch (error: any) {
      console.error('Error saving match:', error);
      showToast('Error al guardar: ' + error.message, 'error');
    } finally {
      setUpdating(false);
      isSubmittingRef.current = false;
    }
  };

  const openManualEntry = async (match: Match) => {
    setSelectedMatchManual(match);
    setManualResult({
      home_score: match.home_score?.toString() || '',
      away_score: match.away_score?.toString() || '',
      finished: match.status === 'finished'
    });
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

    // 2. Process Goalscorers
    try {
      // Clear existing events for this match to prevent partial duplicates on re-save
      await supabase.from('match_events')
        .delete()
        .eq('match_id', selectedMatchManual.id)
        .in('event_type', ['goal', 'yellow_card', 'red_card']);

      // Local cache to prevent duplicate creation during this transaction
      const currentHomePlayers = [...manualPlayersHome];
      const currentAwayPlayers = [...manualPlayersAway];

      const processPlayerEvent = async (name: string, teamId: string, eventType: string, isHome: boolean) => {
        if (!name || name.trim() === '') return;

        const playersList = isHome ? currentHomePlayers : currentAwayPlayers;

        // Check if exists in our local (potentially updated) cache
        // Normalize comparison
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

          // Add to local cache immediately so next iteration finds it
          const playerToAdd = { ...newPlayer }; // Ensure we have a clean object
          if (isHome) {
            currentHomePlayers.push(playerToAdd);
          } else {
            currentAwayPlayers.push(playerToAdd);
          }
        }

        // Insert Event
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

      setMatches(prev => prev.map(m => m.id === selectedMatchManual.id ? { ...m, ...updates } : m));
      setUpdating(false);
      isSubmittingRef.current = false;
      setShowManualModal(false);
      showToast('Resultado guardado', 'success');

    } catch (e) {
      console.error(e);
      setUpdating(false);
      isSubmittingRef.current = false;
    }
  };

  const handleExportClick = (round: number, matches: Match[]) => {
    setExportData({ round, matches });
    setShowExportModal(true);
  };

  const downloadImage = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      // 1. Pre-load images as Base64 to avoid CORS issues
      const images = Array.from(exportRef.current.getElementsByTagName('img'));
      const originalSrcs = images.map(img => img.src);

      await Promise.all(images.map(async (img) => {
        try {
          const response = await fetch(img.src, { mode: 'cors' });
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              img.src = reader.result as string;
              resolve(null);
            };
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn("Failed to load image for export", e);
          // Keep original src if fail
        }
      }));

      // 2. Capture
      const canvas = await html2canvas(exportRef.current, {
        useCORS: true,
        allowTaint: true, // Try to allow if CORS fails slightly, but mainly rely on Base64 above
        backgroundColor: '#0f172a',
        scale: 2,
        logging: false
      });

      // 3. Restore images (optional, as modal might close, but good practice)
      images.forEach((img, i) => {
        img.src = originalSrcs[i];
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Jornada-${exportData?.round || 1}.png`;
      link.click();
      showToast("Imagen descargada", "success");
      setShowExportModal(false);
    } catch (error) {
      console.error(error);
      showToast("Error al exportar imagen (Intenta de nuevo)", "error");
    } finally {
      setExporting(false);
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
            <div className="flex-1 flex items-center min-w-0">
              {leagues.length > 0 ? (
                <div className="relative group min-w-0">
                  <select
                    value={selectedLeagueId}
                    onChange={(e) => setSelectedLeagueId(e.target.value)}
                    className="bg-transparent text-xl md:text-2xl font-bold text-slate-900 dark:text-white border-none outline-none cursor-pointer appearance-none pr-8 py-1 z-10 truncate max-w-full"
                  >
                    {leagues.map(l => (
                      <option key={l.id} value={l.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{l.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-slate-900 dark:text-white pointer-events-none">expand_more</span>
                </div>
              ) : (
                <h2 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">Calendario</h2>
              )}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 md:gap-3 shrink-0">
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
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex flex-col">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider w-fit">
                        Jornada {round}
                      </span>
                      <span className="text-xs text-slate-400 font-medium ml-1 mt-1 capitalize">{roundDate}</span>
                    </div>
                    <button
                      onClick={() => handleExportClick(round, roundMatches)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">share</span>
                      Compartir
                    </button>
                  </div>

                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1 mt-auto mb-2"></div>


                  {/* Responsive Grid for Matches */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roundMatches.map((match) => (
                      <div
                        key={match.id}
                        onClick={() => {
                          const isOwner = user && leagues.find(l => l.id === match.league_id)?.owner_id === user.id;
                          if (role === 'admin' || role === 'referee' || isOwner) {
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
                          {/* Score / VS / Actions */}
                          <div className="flex flex-col items-center px-2">
                            {match.status === 'finished' || match.status === 'live' || match.status === 'break' ? (
                              <div className="text-2xl font-black tracking-tight font-mono">
                                {match.home_score} - {match.away_score}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                {/* Show Actions if Authorized */}
                                {(role === 'admin' || role === 'referee' || (user && leagues.find(l => l.id === match.league_id)?.owner_id === user.id)) && match.status === 'scheduled' ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/referee-match-control', { state: { matchId: match.id } });
                                      }}
                                      className="bg-primary hover:bg-primary-dark text-white text-[10px] uppercase font-bold px-4 py-2 rounded-lg shadow-lg shadow-primary/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                                      Iniciar
                                    </button>

                                    {(role === 'admin' || (user && leagues.find(l => l.id === match.league_id)?.owner_id === user.id)) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openManualEntry(match);
                                        }}
                                        className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 p-2 rounded-lg transition-colors"
                                        title="Cargar Resultado Manual"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-lg font-bold text-slate-300 dark:text-slate-600">
                                    VS
                                  </div>
                                )}
                              </div>
                            )}
                            <span className={`text-[10px] uppercase font-bold mt-2 px-2 py-0.5 rounded-full ${match.status === 'live' ? 'bg-red-500 text-white animate-pulse' : match.status === 'break' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>
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

        {/* Manual Entry Modal */}
        {
          showManualModal && selectedMatchManual && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white dark:bg-card-dark rounded-xl w-full max-w-md md:max-w-3xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <h3 className="font-bold text-lg text-center text-slate-900 dark:text-white">Resultado Manual</h3>
                </div>

                {/* Scrollable Content */}
                <div className="p-4 overflow-y-auto flex-1">
                  <div className="flex items-center justify-between mb-6 gap-4">
                    <div className="flex flex-col items-center">
                      <label className="text-xs font-bold mb-1 truncate max-w-[100px] text-slate-900 dark:text-white">{selectedMatchManual.home_team?.name}</label>
                      <input
                        type="number"
                        className="w-16 h-16 text-center text-3xl font-bold bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white"
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
                    <span className="text-2xl font-bold text-slate-300">-</span>
                    <div className="flex flex-col items-center">
                      <label className="text-xs font-bold mb-1 truncate max-w-[100px] text-slate-900 dark:text-white">{selectedMatchManual.away_team?.name}</label>
                      <input
                        type="number"
                        className="w-16 h-16 text-center text-3xl font-bold bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white"
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
                    <div className="flex flex-col md:flex-row gap-4 mb-6 transition-all">
                      {/* Home Scorers */}
                      <div className="flex-1 flex flex-col gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Goleadores ({selectedMatchManual.home_team?.name?.substring(0, 10)})</span>
                        {homeGoalscorers.map((scorer, idx) => (
                          <div key={`h-${idx}`}>
                            <input
                              list="home-players"
                              placeholder={`Gol ${idx + 1}`}
                              className="w-full text-sm p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
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
                      <div className="flex-1 flex flex-col gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Goleadores ({selectedMatchManual.away_team?.name?.substring(0, 10)})</span>
                        {awayGoalscorers.map((scorer, idx) => (
                          <div key={`a-${idx}`}>
                            <input
                              list="away-players"
                              placeholder={`Gol ${idx + 1}`}
                              className="w-full text-sm p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
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
                  <div className="flex flex-col md:flex-row gap-4 mb-8">
                    {/* Home Cards */}
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tarjetas ({selectedMatchManual.home_team?.name?.substring(0, 10)})</span>
                        <button
                          onClick={() => setHomeCards([...homeCards, { name: '', type: 'yellow_card' }])}
                          className="p-1 px-2 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                        </button>
                      </div>
                      {homeCards.map((card, idx) => (
                        <div key={`hc-${idx}`} className="flex gap-2 items-center">
                          <input
                            list="home-players"
                            placeholder="Jugador"
                            className="flex-1 text-sm p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-w-0 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
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
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors shadow-sm ${card.type === 'yellow_card' ? 'bg-yellow-100 border border-yellow-300' : 'bg-red-100 border border-red-300'}`}
                          >
                            <div className={`w-4 h-5 rounded-sm shadow-sm ${card.type === 'yellow_card' ? 'bg-yellow-400' : 'bg-red-500'}`}></div>
                          </button>
                          <button
                            onClick={() => setHomeCards(homeCards.filter((_, i) => i !== idx))}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Away Cards */}
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tarjetas ({selectedMatchManual.away_team?.name?.substring(0, 10)})</span>
                        <button
                          onClick={() => setAwayCards([...awayCards, { name: '', type: 'yellow_card' }])}
                          className="p-1 px-2 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                        </button>
                      </div>
                      {awayCards.map((card, idx) => (
                        <div key={`ac-${idx}`} className="flex gap-2 items-center">
                          <input
                            list="away-players"
                            placeholder="Jugador"
                            className="flex-1 text-sm p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-w-0 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
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
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors shadow-sm ${card.type === 'yellow_card' ? 'bg-yellow-100 border border-yellow-300' : 'bg-red-100 border border-red-300'}`}
                          >
                            <div className={`w-4 h-5 rounded-sm shadow-sm ${card.type === 'yellow_card' ? 'bg-yellow-400' : 'bg-red-500'}`}></div>
                          </button>
                          <button
                            onClick={() => setAwayCards(awayCards.filter((_, i) => i !== idx))}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2 justify-center">
                    <input
                      type="checkbox"
                      id="markFinished"
                      className="w-5 h-5 accent-primary"
                      checked={manualResult.finished}
                      onChange={(e) => setManualResult({ ...manualResult, finished: e.target.checked })}
                    />
                    <label htmlFor="markFinished" className="font-medium text-slate-900 dark:text-white">Marcar como Finalizado</label>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowManualModal(false)}
                      className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveManualResult}
                      disabled={updating}
                      className="flex-1 py-3 rounded-xl font-bold text-white bg-primary flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
                    >
                      {updating && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                      Guardar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Create Match Fab */}
        {
          (editingMatch || isCreating) && (
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
                      type="button"
                      onClick={() => { setEditingMatch(null); setIsCreating(false); }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
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
                      type="button"
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
          )
        }

        {/* EXPORT MODAL */}
        {
          showExportModal && exportData && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-card-dark rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-lg dark:text-white">Vista Previa</h3>
                  <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <span className="material-symbols-outlined dark:text-white">close</span>
                  </button>
                </div>

                <div className="flex-1 p-4 bg-slate-900 flex justify-center overflow-auto items-center">
                  {/* THE DESIGN TO CAPTURE */}
                  <div
                    ref={exportRef}
                    className="w-[1200px] h-[630px] bg-slate-900 text-white p-0 relative overflow-hidden shadow-2xl flex flex-col"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {/* Background Elements */}
                    <div className="absolute top-0 left-0 w-full h-full bg-[#0a101e] z-0"></div>
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full z-0 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full z-0 pointer-events-none"></div>

                    {/* Top Content (Header) */}
                    <div className="relative z-10 w-full pt-8 pb-4 flex flex-col items-center shrink-0">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="px-5 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-[0.2em]">
                          {leagues.find(l => l.id === selectedLeagueId)?.name || 'TORNEO'}
                        </div>
                        <div className="h-4 w-[1px] bg-slate-700"></div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                          <span className="text-xs font-bold uppercase tracking-widest">{groupedMatches[exportData.round] && groupedMatches[exportData.round][0] ? formatDate(groupedMatches[exportData.round][0].start_time) : ''}</span>
                        </div>
                      </div>

                      <h1 className="text-5xl font-black italic tracking-tighter text-white mb-0 uppercase drop-shadow-lg flex items-center gap-3">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Jornada</span>
                        <span className="text-blue-500">{exportData.round}</span>
                      </h1>
                    </div>

                    {/* Main Content (Matches Grid) */}
                    <div className="relative z-10 flex-1 px-12 pb-8 overflow-hidden flex items-center">
                      <div className="w-full grid grid-cols-2 gap-x-12 gap-y-3 align-content-center">
                        {exportData.matches.map(m => (
                          <div key={m.id} className="flex items-center bg-slate-800/40 backdrop-blur-sm border border-slate-700/30 p-3 rounded-xl relative group">
                            {/* Glow Bar */}
                            {m.status === 'live' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-orange-500"></div>}

                            {/* Time */}
                            <div className="w-16 flex flex-col items-center justify-center border-r border-slate-700/30 pr-3 mr-3 shrink-0">
                              {m.status === 'finished' ? (
                                <span className="text-xs font-black text-slate-500">FINAL</span>
                              ) : (
                                <>
                                  <span className="text-lg font-bold text-white leading-none">{formatTime(m.start_time).split(':')[0]}:{formatTime(m.start_time).split(':')[1]}</span>
                                  <span className="text-[9px] font-bold text-slate-500 uppercase">{formatTime(m.start_time).includes('PM') ? 'PM' : 'AM'}</span>
                                </>
                              )}
                            </div>

                            {/* Match Info */}
                            <div className="flex-1 flex items-center justify-between gap-2 overflow-hidden">
                              {/* Home */}
                              <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                                <span className="text-lg font-bold text-white text-right truncate uppercase">{m.home_team?.name}</span>
                                <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                                  {m.home_team?.shield_url ?
                                    <img src={m.home_team.shield_url} className="w-full h-full object-contain filter drop-shadow-lg" crossOrigin="anonymous" />
                                    : <span className="material-symbols-outlined text-2xl text-slate-600">shield</span>
                                  }
                                </div>
                              </div>

                              {/* Score/VS */}
                              <div className="px-2 shrink-0">
                                {m.status === 'scheduled' ? (
                                  <span className="text-sm font-black text-slate-700 italic">VS</span>
                                ) : (
                                  <div className="flex items-center gap-2 bg-slate-900/50 px-2 py-1 rounded border border-slate-700/50">
                                    <span className="text-xl font-bold text-white">{m.home_score}</span>
                                    <span className="text-slate-600">:</span>
                                    <span className="text-xl font-bold text-white">{m.away_score}</span>
                                  </div>
                                )}
                              </div>

                              {/* Away */}
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                                  {m.away_team?.shield_url ?
                                    <img src={m.away_team.shield_url} className="w-full h-full object-contain filter drop-shadow-lg" crossOrigin="anonymous" />
                                    : <span className="material-symbols-outlined text-2xl text-slate-600">shield</span>
                                  }
                                </div>
                                <span className="text-lg font-bold text-white text-left truncate uppercase">{m.away_team?.name}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer Branding */}
                    <div className="relative z-10 w-full py-3 border-t border-slate-800/50 flex justify-between px-8 bg-black/20 text-[10px] text-slate-500 font-bold tracking-widest uppercase">
                      <span>Resultados Oficiales</span>
                      <span>ligapremier.com</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-card-dark">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={downloadImage}
                    disabled={exporting}
                    className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
                  >
                    {exporting ? (
                      <>
                        <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                        Exportando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Descargar Imagen
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        }
      </div >
    </div >
  );
};

export default CalendarScreen;
