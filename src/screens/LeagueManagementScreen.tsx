import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { seedLeague } from '../utils/seeder';
import { generatePlayoffBracket, advanceToNextRound } from '../utils/playoffs';
import { useToast } from '../context/ToastContext';

const LeagueManagementScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { showToast } = useToast();
  
  const [viewMode, setViewMode] = useState<string>('Tabla');
  const [league, setLeague] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  // Additional state for players and referees
  const [players, setPlayers] = useState<any[]>([]);
  const [referees, setReferees] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingReferees, setLoadingReferees] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Subscribers/Invitations state
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  // State para Tabla (standings) y Liguilla
  const [regularMatches, setRegularMatches] = useState<any[]>([]);
  const [playoffMatches, setPlayoffMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [standings, setStandings] = useState<any[]>([]);
  const [generatingPlayoffs, setGeneratingPlayoffs] = useState(false);
  const [advancingPlayoffs, setAdvancingPlayoffs] = useState(false);

  // Refetch matches (para recargar después de generar/avanzar llaves)
  const refetchMatches = async () => {
    if (!id) return;
    const { data: play } = await supabase
      .from('matches')
      .select('*')
      .eq('league_id', id)
      .gte('round_number', 100)
      .order('round_number', { ascending: true });
    setPlayoffMatches(play || []);
  };

  // Generar primera llave de liguilla
  const handleGeneratePlayoffs = async () => {
    if (!id) return;
    setGeneratingPlayoffs(true);
    const result = await generatePlayoffBracket(id);
    setGeneratingPlayoffs(false);
    if (result.success) {
      showToast(`¡${result.round === 100 ? 'Cuartos' : 'Semifinales'} generados!`, 'success');
      await refetchMatches();
    } else {
      showToast(result.error || 'Error al generar llave', 'error');
    }
  };

  // Avanzar a la siguiente ronda
  const handleAdvancePlayoffs = async () => {
    if (!id) return;
    setAdvancingPlayoffs(true);
    const result = await advanceToNextRound(id);
    setAdvancingPlayoffs(false);
    if (result.success) {
      const roundName = result.round === 200 ? 'Semifinales' :
        result.round === 300 ? 'Final' : 'siguiente ronda';
      showToast(`¡${roundName} generados!`, 'success');
      await refetchMatches();
    } else {
      showToast(result.error || 'Error al avanzar', 'error');
    }
  };

  // Estado para editor de partido de liguilla
  const [editingPlayoffMatch, setEditingPlayoffMatch] = useState<any>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [savingMatchEdit, setSavingMatchEdit] = useState(false);

  const openPlayoffMatchEditor = (match: any) => {
    setEditingPlayoffMatch(match);
    if (match.start_time) {
      // Convertir a formato datetime-local
      const d = new Date(match.start_time);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      setEditStartTime(local.toISOString().slice(0, 16));
    } else {
      // Default: mañana a las 19:00
      const t = new Date();
      t.setDate(t.getDate() + 1);
      t.setHours(19, 0, 0, 0);
      const local = new Date(t.getTime() - t.getTimezoneOffset() * 60000);
      setEditStartTime(local.toISOString().slice(0, 16));
    }
  };

  const handleSavePlayoffMatch = async () => {
    if (!editingPlayoffMatch) return;
    setSavingMatchEdit(true);
    try {
      const iso = editStartTime ? new Date(editStartTime).toISOString() : null;
      const { error } = await supabase
        .from('matches')
        .update({ start_time: iso })
        .eq('id', editingPlayoffMatch.id);
      if (error) throw error;
      showToast('Fecha actualizada', 'success');
      setEditingPlayoffMatch(null);
      await refetchMatches();
      await fetchMatches();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar', 'error');
    } finally {
      setSavingMatchEdit(false);
    }
  };

  useEffect(() => {
    const fetchLeagueData = async () => {
      if (!id) return;
      try {
        // Get user
        const { data: { user } } = await supabase.auth.getUser();

        // Check role
        let owner = false;
        let admin = false;
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          admin = profile?.role === 'admin' || profile?.role === 'superadmin';
        }

        // Fetch League Details
        const { data: leagueData, error: leagueError } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', id)
          .single();

        if (leagueError) throw leagueError;

        // Check ownership
        owner = !!(user && (leagueData.owner_id === user.id || admin));

        setLeague(leagueData);
        setIsOwner(owner);

        // Fetch Teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .eq('league_id', id);

        if (teamsError) throw teamsError;
        setTeams(teamsData || []);
      } catch (error) {
        console.error('Error fetching league data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, [id, location.key]);

  // Fetch players when switching to Players tab
  useEffect(() => {
    if (viewMode === 'Jugadores' && players.length === 0 && teams.length > 0) {
      const fetchPlayers = async () => {
        setLoadingPlayers(true);
        const teamIds = teams.map(t => t.id);
        const { data, error } = await supabase
          .from('players')
          .select('*, teams(name, shield_url)')
          .in('team_id', teamIds)
          .order('name');

        if (!error && data) setPlayers(data);
        setLoadingPlayers(false);
      };
      fetchPlayers();
    }
  }, [viewMode, teams, players.length]);

  // Fetch referees when switching to Referees tab
  useEffect(() => {
    if (viewMode === 'Árbitros' && referees.length === 0) {
      const fetchReferees = async () => {
        setLoadingReferees(true);
        // Assuming referees are profiles with role 'referee'
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'referee');

        if (!error && data) setReferees(data);
        setLoadingReferees(false);
      };
      fetchReferees();
    }
  }, [viewMode, referees.length]);

  // Fetch subscribers and invitations when switching to Suscriptores tab
  useEffect(() => {
    if (viewMode === 'Suscriptores' && id) {
      fetchSubscribers();
      fetchInvitations();
    }
  }, [viewMode, id]);

  // Fetch matches for Tabla (regular season) and Liguilla (playoffs)
  const fetchMatches = useCallback(async () => {
    if (!id) return;
    setLoadingMatches(true);
    // Fase regular: round_number < 100
    const { data: reg } = await supabase
      .from('matches')
      .select('*')
      .eq('league_id', id)
      .lt('round_number', 100);
    if (reg) setRegularMatches(reg);

    // Liguilla: round_number >= 100
    const { data: play } = await supabase
      .from('matches')
      .select('*')
      .eq('league_id', id)
      .gte('round_number', 100)
      .order('round_number', { ascending: true });
    if (play) setPlayoffMatches(play);

    setLoadingMatches(false);
  }, [id]);

  useEffect(() => {
    if (viewMode === 'Tabla' || viewMode === 'Liguilla') {
      fetchMatches();
    }
  }, [viewMode, id, fetchMatches]);

  // Calcular standings (tabla general) a partir de los matches de fase regular
  useEffect(() => {
    if (viewMode !== 'Tabla') return;
    if (teams.length === 0) {
      setStandings([]);
      return;
    }
    // Inicializar todos los equipos en 0
    const stats: Record<string, { team_id: string; name: string; logo_url: string | null; pj: number; g: number; e: number; p: number; gf: number; gc: number; pts: number; }> = {};
    teams.forEach((t: any) => {
      stats[t.id] = {
        team_id: t.id,
        name: t.name,
        logo_url: t.logo_url || t.shield_url || null,
        pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0
      };
    });
    // Recorrer los partidos finalizados
    regularMatches.forEach((m: any) => {
      if (m.status !== 'finished') return;
      const home = stats[m.home_team_id];
      const away = stats[m.away_team_id];
      if (!home || !away) return;
      const hs = m.home_score ?? 0;
      const as = m.away_score ?? 0;
      home.pj += 1; away.pj += 1;
      home.gf += hs; home.gc += as;
      away.gf += as; away.gc += hs;
      if (hs > as) { home.g += 1; home.pts += 3; away.p += 1; }
      else if (hs < as) { away.g += 1; away.pts += 3; home.p += 1; }
      else { home.e += 1; away.e += 1; home.pts += 1; away.pts += 1; }
    });
    const arr = Object.values(stats).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const dgA = a.gf - a.gc, dgB = b.gf - b.gc;
      if (dgB !== dgA) return dgB - dgA;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    });
    setStandings(arr);
  }, [viewMode, regularMatches, teams]);

  const fetchSubscribers = async () => {
    if (!id) return;
    setLoadingSubscribers(true);
    try {
      const { data } = await supabase
        .from('league_followers')
        .select(`
          *,
          profile:profiles(id, full_name, email, avatar_url)
        `)
        .eq('league_id', id)
        .order('created_at', { ascending: false });

      if (data) setSubscribers(data);
    } catch (error) {
      console.error('Error fetching subscribers:', error);
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const fetchInvitations = async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from('league_invitations')
        .select('*')
        .eq('league_id', id)
        .order('created_at', { ascending: false });

      if (data) setInvitations(data);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  const handleInviteByEmail = async () => {
    if (!id || !inviteEmail.trim()) return;
    if (!inviteEmail.includes('@')) {
      showToast('Ingresa un email válido', 'error');
      return;
    }

    setInviteLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('league_invitations')
        .insert([{
          league_id: id,
          email: inviteEmail.toLowerCase().trim(),
          invited_by: user?.id
        }]);

      if (error) {
        if (error.code === '23505') {
          showToast('Ya se envió una invitación a este email', 'info');
        } else {
          throw error;
        }
      } else {
        showToast('Invitación enviada', 'success');
        setInviteEmail('');
        fetchInvitations();
      }
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      showToast('Error al enviar invitación', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveSubscriber = async (subscriberId: string) => {
    if (!confirm('¿Quitar a este suscriptor?')) return;

    try {
      await supabase
        .from('league_followers')
        .delete()
        .eq('id', subscriberId);

      showToast('Suscriptor removido', 'success');
      fetchSubscribers();
    } catch (error) {
      console.error('Error removing subscriber:', error);
      showToast('Error al remover', 'error');
    }
  };

  const handleCopyInviteLink = async () => {
    if (!league) return;

    let code = league.invite_code;

    // Si la liga no tiene invite_code, lo generamos en el momento
    if (!code) {
      try {
        const newCode = Math.random().toString(36).substring(2, 10).toLowerCase();
        const { error } = await supabase
          .from('leagues')
          .update({ invite_code: newCode })
          .eq('id', league.id);
        if (error) throw error;
        code = newCode;
        setLeague({ ...league, invite_code: newCode });
      } catch (err: any) {
        showToast('No se pudo generar el código de invitación', 'error');
        return;
      }
    }

    const link = `${window.location.origin}/join?code=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Link copiado al portapapeles', 'success');
    } catch (err) {
      // Fallback
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand('copy');
        showToast('Link copiado al portapapeles', 'success');
      } catch {
        showToast(`Copia manualmente: ${link}`, 'info');
      }
      document.body.removeChild(input);
    }
  };

  const handleSeedData = async () => {
    if (!id) return;
    const confirm = window.confirm('¿Seguro que quieres generar equipos aleatorios?');
    if (!confirm) return;

    setLoading(true);
    const { success } = await seedLeague(id);
    if (success) {
      window.location.reload();
    } else {
      alert('Error al generar datos');
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">Cargando...</div>;
  }

  if (!league) {
    return <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">Liga no encontrada</div>;
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased selection:bg-primary selection:text-white h-screen overflow-hidden flex flex-col">
      <div className="relative flex h-full min-h-screen w-full flex-col pb-24 overflow-y-auto">
        {/* Top App Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md p-4 border-b border-slate-200/60 dark:border-slate-800/60">
          <button
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-slate-900 dark:text-white text-2xl">arrow_back</span>
          </button>
          <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">
            {isOwner ? 'Detalles de Liga' : 'Liga'}
          </h2>
          {isOwner ? (
            <button
              onClick={() => navigate('/create-league', { state: { league_id: id } })}
              className="flex size-10 items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-primary text-2xl">edit_square</span>
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>

        {/* League Hero Header con fondo gradiente */}
        <div className="relative px-4 pt-5 pb-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
          <div className="relative flex flex-col gap-5">
            <div className="flex gap-4 items-start">
              <div className="relative shrink-0">
                <div
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-3xl h-24 w-24 shadow-xl ring-4 ring-white/60 dark:ring-slate-800/60 flex items-center justify-center bg-slate-100 dark:bg-slate-800"
                  style={league.logo_url ? { backgroundImage: `url("${league.logo_url}")` } : {}}
                >
                  {!league.logo_url && <span className="material-symbols-outlined text-5xl text-slate-400">emoji_events</span>}
                </div>
                <div className={`absolute -bottom-1 -right-1 text-white text-[10px] font-bold px-2.5 py-1 rounded-full border-[3px] border-background-light dark:border-background-dark uppercase shadow-md ${
                  league.status === 'active' ? 'bg-emerald-500' :
                  league.status === 'finished' ? 'bg-blue-500' : 'bg-slate-500'
                }`}>
                  {league.status === 'active' ? 'Activa' : league.status === 'finished' ? 'Final' : 'Borrador'}
                </div>
              </div>
              <div className="flex flex-col flex-1 min-w-0 pt-1">
                <h1 className="text-2xl font-black leading-tight tracking-tight mb-2">{league.name}</h1>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm ${
                    league.settings?.competition_format === 'liguilla'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                  }`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {league.settings?.competition_format === 'liguilla' ? 'emoji_events' : 'sports_soccer'}
                    </span>
                    {league.settings?.competition_format === 'liguilla' ? 'Liguilla' : 'Europeo'}
                  </span>
                  {league.settings?.competition_format === 'liguilla' && league.settings?.liguilla_two_legged && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
                      <span className="material-symbols-outlined text-[14px]">account_tree</span>
                      Cruces x2
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm">
                    <span className="material-symbols-outlined text-[14px]">sports_soccer</span>
                    Fut {league.format}
                  </span>
                </div>
                {league.description && (
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-2 line-clamp-2">
                    {league.description}
                  </p>
                )}
                
                {/* Share Buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {/* Link Público */}
                  <button
                    onClick={async () => {
                      const slug = league.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + league.id.substring(0, 8);
                      const publicUrl = `${window.location.origin}/l/${slug}`;
                      try {
                        await navigator.clipboard.writeText(publicUrl);
                        showToast('Link público copiado', 'success');
                      } catch {
                        showToast(`URL: ${publicUrl}`, 'info');
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">public</span>
                    Link Público
                  </button>

                  {/* Link de Invitación */}
                  <button
                    onClick={async () => {
                      const inviteUrl = `${window.location.origin}/join?code=${league.invite_code || league.id}`;
                      try {
                        await navigator.clipboard.writeText(inviteUrl);
                        showToast('Link de invitación copiado', 'success');
                      } catch {
                        showToast(`URL: ${inviteUrl}`, 'info');
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">link</span>
                    Link de Invitación
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards con elevación */}
        <div className="flex overflow-x-auto hide-scrollbar gap-3 px-4 pb-5 w-full shrink-0">
          <div className="flex min-w-[150px] flex-1 flex-col gap-2 rounded-2xl p-4 bg-white dark:bg-slate-800 shadow-md shadow-slate-200/60 dark:shadow-black/20 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-white text-base">groups</span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Equipos</p>
            </div>
            <p className="text-3xl font-black tracking-tight">
              {teams.length}
              <span className="text-base text-slate-400 font-bold ml-1">/ {league.max_teams || '∞'}</span>
            </p>
          </div>
          <div className="flex min-w-[150px] flex-1 flex-col gap-2 rounded-2xl p-4 bg-white dark:bg-slate-800 shadow-md shadow-slate-200/60 dark:shadow-black/20 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-white text-base">sports_soccer</span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Partidos</p>
            </div>
            <p className="text-3xl font-black tracking-tight">
              {regularMatches.length + playoffMatches.length}
            </p>
          </div>
        </div>

        {/* Tabs con estilo pills */}
        <div className="px-4 pb-4 sticky top-[72px] z-10 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {(isOwner
              ? ['Tabla', 'Liguilla', 'Equipos', 'Jugadores', 'Árbitros', 'Suscriptores']
              : ['Tabla', 'Liguilla', 'Equipos']
            ).map((mode) => {
              const isActive = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/30 scale-105'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>


        {/* Search Bar */}
        {(viewMode === 'Equipos' || viewMode === 'Jugadores' || viewMode === 'Árbitros' || viewMode === 'Suscriptores') && (
          <div className="px-4 pb-4">
            <div className="relative flex items-center w-full h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/30 transition-all">
              <div className="grid place-items-center h-full w-12 text-slate-400">
                <span className="material-symbols-outlined text-xl">search</span>
              </div>
              <input
                className="peer h-full w-full outline-none bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 pr-4 font-medium"
                id="search"
                placeholder={`Buscar ${viewMode.slice(0, -1).toLowerCase()}...`}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="flex flex-col gap-3 px-4">

          {/* TABLA GENERAL (Standings) */}
          {viewMode === 'Tabla' && (
            loadingMatches ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : standings.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-3xl text-slate-400">leaderboard</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-bold">Aún no hay tabla</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Necesitas equipos y partidos finalizados para verla.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header sticky de la tabla */}
                <div className="grid grid-cols-[40px_1fr_48px_40px_40px_44px] gap-1 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <span className="text-center">#</span>
                  <span>Equipo</span>
                  <span className="text-center">Pts</span>
                  <span className="text-center">PJ</span>
                  <span className="text-center">G</span>
                  <span className="text-center">DG</span>
                </div>
                {standings.map((s, idx) => {
                  const dg = s.gf - s.gc;
                  const isLeader = idx === 0 && s.pj > 0;
                  const qualifiesLiguilla = league?.settings?.competition_format === 'liguilla' && idx < (league?.settings?.liguilla_size || 4) && s.pj > 0;
                  return (
                    <div
                      key={s.team_id}
                      className={`grid grid-cols-[40px_1fr_48px_40px_40px_44px] gap-1 px-3 py-3 items-center rounded-2xl border transition-all ${
                        isLeader
                          ? 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-700/50 shadow-md'
                          : qualifiesLiguilla
                          ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-700/40 shadow-sm'
                          : 'bg-white dark:bg-slate-800 border-slate-200/60 dark:border-slate-700/60 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-center">
                        <div className={`size-7 rounded-lg flex items-center justify-center font-black text-sm ${
                          isLeader
                            ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-md'
                            : qualifiesLiguilla
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          {idx + 1}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {s.logo_url ? (
                          <img src={s.logo_url} alt={s.name} className="w-9 h-9 rounded-xl object-cover bg-slate-100 shadow-sm" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-sm font-black text-slate-600 dark:text-slate-300 shadow-sm">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate dark:text-white">{s.name}</p>
                          {isLeader && (
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Líder</p>
                          )}
                          {qualifiesLiguilla && !isLeader && (
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Liguilla</p>
                          )}
                        </div>
                      </div>
                      <span className="text-center font-black text-base text-slate-900 dark:text-white">{s.pts}</span>
                      <span className="text-center text-sm font-semibold text-slate-500 dark:text-slate-400">{s.pj}</span>
                      <span className="text-center text-sm font-semibold text-slate-500 dark:text-slate-400">{s.g}</span>
                      <span className={`text-center text-xs font-black ${
                        dg > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                        dg < 0 ? 'text-red-500 dark:text-red-400' :
                        'text-slate-500 dark:text-slate-400'
                      }`}>
                        {dg > 0 ? `+${dg}` : dg}
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* LIGUILLA (Playoffs) */}
          {viewMode === 'Liguilla' && isOwner && (
            <>
              {playoffMatches.length === 0 ? (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border-2 border-purple-200 dark:border-purple-900/50 p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="size-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shrink-0">
                      <span className="material-symbols-outlined text-white text-2xl">emoji_events</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 dark:text-white">Generar Primera Llave</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        Se tomarán los <b>{league?.settings?.liguilla_size || 4} mejores</b> equipos según la tabla actual.
                      </p>
                      <button
                        onClick={handleGeneratePlayoffs}
                        disabled={generatingPlayoffs}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 transition-all active:scale-95"
                      >
                        {generatingPlayoffs ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                            Generando...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-lg">add_circle</span>
                            Generar {league?.settings?.liguilla_size === 8 ? 'Cuartos' : 'Semifinales'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <PlayoffActions
                  league={league}
                  playoffMatches={playoffMatches}
                  onAdvanced={refetchMatches}
                />
              )}
            </>
          )}

          {viewMode === 'Liguilla' && (
            loadingMatches ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : playoffMatches.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <div className="size-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 mx-auto flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-3xl text-purple-500">emoji_events</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-bold">Liguilla no generada</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">La fase final aún no se ha generado. Ve a la sección de liguilla para crearla.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {Array.from(new Set(playoffMatches.map((m: any) => m.round_number))).sort((a, b) => a - b).map((round) => {
                  const roundConfig =
                    round === 100 ? { label: 'Cuartos de Final', color: 'from-blue-500 to-cyan-500' } :
                    round === 200 ? { label: 'Semifinales', color: 'from-purple-500 to-pink-500' } :
                    round === 300 ? { label: 'Final', color: 'from-amber-500 to-orange-500' } :
                    { label: `Ronda ${round}`, color: 'from-slate-500 to-slate-600' };
                  const matches = playoffMatches.filter((m: any) => m.round_number === round);
                  return (
                    <div key={round} className="space-y-2.5">
                      <div className="flex items-center gap-2 px-1">
                        <div className={`size-8 rounded-xl bg-gradient-to-br ${roundConfig.color} flex items-center justify-center shadow-md`}>
                          <span className="material-symbols-outlined text-white text-base">emoji_events</span>
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">{roundConfig.label}</h3>
                      </div>
                      <div className="space-y-2">
                        {matches.map((m: any) => {
                          const home = teams.find((t: any) => t.id === m.home_team_id);
                          const away = teams.find((t: any) => t.id === m.away_team_id);
                          const legLabel = m.leg === 2 ? 'Vuelta' : (m.leg === 1 ? 'Ida' : null);
                          const isFinished = m.status === 'finished';
                          const homeWin = isFinished && (m.home_score ?? 0) > (m.away_score ?? 0);
                          const awayWin = isFinished && (m.away_score ?? 0) > (m.home_score ?? 0);
                          return (
                            <div
                              key={m.id}
                              className={`rounded-2xl bg-white dark:bg-slate-800 border ${
                                isFinished ? 'border-slate-200/60 dark:border-slate-700/60' : 'border-dashed border-slate-300 dark:border-slate-600'
                              } shadow-sm overflow-hidden`}
                            >
                              {legLabel && (
                                <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{legLabel}</span>
                                  {isFinished && (
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Final</span>
                                  )}
                                </div>
                              )}
                              <div className="p-3 space-y-2">
                                {/* Home team */}
                                <div className={`flex items-center gap-2.5 ${homeWin ? 'opacity-100' : awayWin ? 'opacity-60' : ''}`}>
                                  {home?.logo_url || home?.shield_url ? (
                                    <img src={home.logo_url || home.shield_url} alt={home?.name} className="w-8 h-8 rounded-lg object-cover bg-slate-100" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300">
                                      {home?.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <span className={`flex-1 text-sm font-bold truncate ${homeWin ? 'text-slate-900 dark:text-white' : 'dark:text-slate-200'}`}>
                                    {home?.name || 'Por definir'}
                                  </span>
                                  {isFinished && (
                                    <span className={`text-base font-black tabular-nums ${homeWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                      {m.home_score ?? 0}
                                    </span>
                                  )}
                                </div>
                                {/* Away team */}
                                <div className={`flex items-center gap-2.5 ${awayWin ? 'opacity-100' : homeWin ? 'opacity-60' : ''}`}>
                                  {away?.logo_url || away?.shield_url ? (
                                    <img src={away.logo_url || away.shield_url} alt={away?.name} className="w-8 h-8 rounded-lg object-cover bg-slate-100" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300">
                                      {away?.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <span className={`flex-1 text-sm font-bold truncate ${awayWin ? 'text-slate-900 dark:text-white' : 'dark:text-slate-200'}`}>
                                    {away?.name || 'Por definir'}
                                  </span>
                                  {isFinished && (
                                    <span className={`text-base font-black tabular-nums ${awayWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                      {m.away_score ?? 0}
                                    </span>
                                  )}
                                </div>
                                {!isFinished && (
                                  <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                                      <span className="material-symbols-outlined text-sm shrink-0">schedule</span>
                                      <span className="text-xs font-semibold truncate">
                                        {m.start_time
                                          ? new Date(m.start_time).toLocaleString('es-MX', {
                                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })
                                          : 'Sin fecha'}
                                      </span>
                                    </div>
                                    {isOwner && (
                                      <button
                                        onClick={() => openPlayoffMatchEditor(m)}
                                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-primary/10 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase tracking-wider transition-colors"
                                      >
                                        <span className="material-symbols-outlined text-xs">edit_calendar</span>
                                        {m.start_time ? 'Editar' : 'Asignar'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {viewMode === 'Equipos' && (
            teams.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-3xl text-slate-400">groups</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-bold mb-1">
                  {teams.length === 0 ? 'No hay equipos aún' : 'Sin resultados'}
                </p>
                {teams.length === 0 && isOwner && (
                  <button
                    onClick={handleSeedData}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    Generar 10 Equipos
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {teams.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).map((team) => (
                  <div
                    key={team.id}
                    onClick={() => {
                      if (isOwner) navigate('/create-team', { state: { teamId: team.id } });
                    }}
                    className={`group flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all ${isOwner ? 'cursor-pointer' : ''}`}
                  >
                    <div
                      className="bg-center bg-no-repeat bg-cover rounded-xl h-14 w-14 shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center shadow-inner"
                      style={team.shield_url ? { backgroundImage: `url("${team.shield_url}")` } : {}}
                    >
                      {!team.shield_url && <span className="material-symbols-outlined text-2xl text-slate-400">shield</span>}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <p className="text-base font-bold text-slate-900 dark:text-white truncate">{team.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="material-symbols-outlined text-xs text-slate-400">person</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{team.captain_name || 'Sin capitán'}</p>
                      </div>
                    </div>
                    {isOwner && (
                      <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all">chevron_right</span>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {viewMode === 'Jugadores' && (
            loadingPlayers ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : players.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-3xl text-slate-400">person</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-bold">No hay jugadores</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Agrega jugadores desde la edición de cada equipo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {players.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center text-sm font-black text-primary border border-primary/20">
                      {player.number || '#'}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <p className="text-base font-bold text-slate-900 dark:text-white truncate">{player.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{player.position}</span>
                        {player.teams && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                              {player.teams.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {viewMode === 'Árbitros' && (
            loadingReferees ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : referees.filter(r => (r.full_name || r.email).toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-3xl text-slate-400">sports</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-bold">No hay árbitros</p>
              </div>
            ) : (
              <div className="space-y-2">
                {referees.filter(r => (r.full_name || r.email).toLowerCase().includes(searchQuery.toLowerCase())).map((ref) => (
                  <div
                    key={ref.id}
                    className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div
                      className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 bg-cover bg-center flex items-center justify-center text-amber-600 dark:text-amber-400 border-2 border-amber-200/50 dark:border-amber-700/30"
                      style={ref.avatar_url ? { backgroundImage: `url("${ref.avatar_url}")` } : {}}
                    >
                      {!ref.avatar_url && <span className="material-symbols-outlined">sports</span>}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <p className="text-base font-bold text-slate-900 dark:text-white truncate">{ref.full_name || ref.email}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                          <span className="material-symbols-outlined text-[10px]">verified</span>
                          Árbitro
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {viewMode === 'Suscriptores' && (
            <div className="space-y-4">
              {/* Invite Link Section con gradiente */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-purple-600 p-5 shadow-xl shadow-primary/20">
                <div className="absolute -top-12 -right-12 size-32 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-12 -left-12 size-32 bg-purple-300/20 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-base">share</span>
                    </div>
                    <h3 className="font-black text-white text-lg">Compartir Liga</h3>
                  </div>

                  {/* Invite Code */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 bg-white/15 backdrop-blur-md rounded-xl px-4 py-3 border border-white/20">
                      <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider mb-0.5">Código</p>
                      <p className="font-mono font-black text-white text-xl tracking-widest">{league?.invite_code || 'Generando...'}</p>
                    </div>
                    <button
                      onClick={handleCopyInviteLink}
                      className="h-[68px] px-4 bg-white text-primary rounded-xl hover:bg-white/90 shadow-lg active:scale-95 transition-all"
                      title="Copiar link"
                    >
                      <span className="material-symbols-outlined">content_copy</span>
                    </button>
                  </div>

                  {/* Invite by Email */}
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Email del usuario"
                      className="flex-1 bg-white/15 backdrop-blur-md rounded-xl px-4 h-11 border border-white/20 text-white placeholder-white/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/40"
                    />
                    <button
                      onClick={handleInviteByEmail}
                      disabled={inviteLoading || !inviteEmail.trim()}
                      className="h-11 px-4 bg-white text-primary rounded-xl hover:bg-white/90 shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm flex items-center gap-1.5"
                    >
                      {inviteLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">send</span>
                          <span>Invitar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Subscribers List */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-black text-sm uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-base">group</span>
                    Suscriptores
                  </h3>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{subscribers.length}</span>
                </div>

                {loadingSubscribers ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : subscribers.length === 0 ? (
                  <div className="text-center py-10 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                    <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-3xl text-slate-400">person_off</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-bold">No hay suscriptores aún</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Comparte el código o invita por email</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {subscribers.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                          {sub.profile?.avatar_url ? (
                            <img src={sub.profile.avatar_url} className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-primary">person</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate text-sm">{sub.profile?.full_name || 'Usuario'}</p>
                          <p className="text-xs text-slate-500 truncate">{sub.profile?.email}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveSubscriber(sub.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                          title="Remover suscriptor"
                        >
                          <span className="material-symbols-outlined text-lg">person_remove</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Invitations */}
              {invitations.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-black text-sm uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-500 text-base">pending</span>
                      Invitaciones Pendientes
                    </h3>
                    <span className="text-xs font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full">
                      {invitations.filter(i => i.status === 'pending').length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {invitations.filter(i => i.status === 'pending').map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200/60 dark:border-orange-700/40 shadow-sm"
                      >
                        <div className="size-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400">
                          <span className="material-symbols-outlined">mail</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{inv.email}</p>
                          <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Esperando aceptación</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Action Button - solo para owners en modos de edición */}
        {isOwner && (viewMode === 'Equipos' || viewMode === 'Jugadores' || viewMode === 'Árbitros' || viewMode === 'Suscriptores') && (
          <div className="fixed bottom-[88px] right-6 z-30">
            <button
              onClick={() => {
                if (viewMode === 'Equipos') {
                  navigate('/create-team', { state: { league_id: id } });
                } else if (viewMode === 'Jugadores') {
                  navigate('/add-player', { state: { league_id: id } });
                } else if (viewMode === 'Árbitros') {
                  navigate('/add-referee', { state: { league_id: id } });
                }
              }}
              className={`group flex items-center justify-center h-14 w-14 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all ${
                viewMode === 'Suscriptores'
                  ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/40 text-white'
                  : 'bg-gradient-to-br from-primary to-purple-600 shadow-primary/40 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">
                {viewMode === 'Suscriptores' ? 'share' : (viewMode === 'Árbitros' ? 'person_add' : 'add')}
              </span>
            </button>
          </div>
        )}

        {/* Modal de edición de partido de liguilla */}
        {editingPlayoffMatch && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
              <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-white text-lg">edit_calendar</span>
                  </div>
                  <div>
                    <h3 className="font-black text-base">Asignar Fecha</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Partido de liguilla</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingPlayoffMatch(null)}
                  className="size-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Equipos */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 space-y-2">
                  {(() => {
                    const home = teams.find(t => t.id === editingPlayoffMatch.home_team_id);
                    const away = teams.find(t => t.id === editingPlayoffMatch.away_team_id);
                    return (
                      <>
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                            {home?.shield_url ? <img src={home.shield_url} className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{home?.name?.[0]}</span>}
                          </div>
                          <span className="font-bold text-sm truncate">{home?.name}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                            {away?.shield_url ? <img src={away.shield_url} className="w-full h-full object-cover" /> : <span className="text-xs font-bold">{away?.name?.[0]}</span>}
                          </div>
                          <span className="font-bold text-sm truncate">{away?.name}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Date/Time input */}
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 block uppercase tracking-wider">Fecha y hora</label>
                  <input
                    type="datetime-local"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="px-5 pb-5 pt-2 flex gap-2">
                <button
                  onClick={() => setEditingPlayoffMatch(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePlayoffMatch}
                  disabled={savingMatchEdit || !editStartTime}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm shadow-md disabled:opacity-50 active:scale-95 transition-all"
                >
                  {savingMatchEdit ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================
// Componente: Acciones de liguilla (Generar / Avanzar)
// =====================================================
interface PlayoffActionsProps {
  league: any;
  playoffMatches: any[];
  onAdvanced: () => void | Promise<void>;
}

const PlayoffActions: React.FC<PlayoffActionsProps> = ({ league, playoffMatches, onAdvanced }) => {
  const { showToast } = useToast();
  const [advancing, setAdvancing] = useState(false);

  const settings = league?.settings || {};
  const liguillaSize = settings.liguilla_size || 4;
  const maxRound = playoffMatches.length > 0 ? Math.max(...playoffMatches.map(m => m.round_number)) : 0;

  // Detectar si estamos en la final
  const isFinalRound =
    (liguillaSize === 8 && maxRound === 300) ||
    (liguillaSize === 4 && maxRound === 200) ||
    (liguillaSize === 2 && maxRound === 100);

  // Verificar si todos los partidos de la ronda actual están finalizados
  const currentRoundMatches = playoffMatches.filter(m => m.round_number === maxRound);
  const allFinished = currentRoundMatches.length > 0 && currentRoundMatches.every(m => m.status === 'finished');
  const pending = currentRoundMatches.filter(m => m.status !== 'finished').length;

  const handleAdvance = async () => {
    setAdvancing(true);
    const result = await advanceToNextRound(league.id);
    setAdvancing(false);
    if (result.success) {
      const roundName = result.round === 200 ? 'Semifinales' :
        result.round === 300 ? 'Final' : 'siguiente ronda';
      showToast(`¡${roundName} generados!`, 'success');
      await onAdvanced();
    } else {
      showToast(result.error || 'Error al avanzar', 'error');
    }
  };

  if (isFinalRound) {
    // Estamos en la final
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border-2 border-amber-300 dark:border-amber-900/50 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shrink-0">
            <span className="material-symbols-outlined text-white">emoji_events</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm">🏆 Final en juego</h3>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
              {allFinished
                ? '¡Finalizada! Ya no hay más rondas.'
                : `Pendiente: ${pending} partido(s). Recordá: en la final hay tiempo extra y penales.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-md shrink-0">
            <span className="material-symbols-outlined text-white">fast_forward</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Avanzar a la Siguiente Llave</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
              {allFinished
                ? (maxRound === 100 ? 'Cuartos finalizados. Listos para semis.' : 'Semis finalizadas. Listas para la final.')
                : `Pendiente: ${pending} partido(s) de la ronda actual.`}
            </p>
          </div>
        </div>
        <button
          onClick={handleAdvance}
          disabled={!allFinished || advancing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
        >
          {advancing ? (
            <>
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
              Avanzando
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
              {maxRound === 100 ? 'Generar Semis' : 'Generar Final'}
            </>
          )}
        </button>
      </div>
      {!allFinished && (
        <div className="mt-3 pt-3 border-t border-indigo-200/50 dark:border-indigo-900/50 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
          <span className="material-symbols-outlined text-sm text-amber-500">info</span>
          <span>
            {settings.allow_draws
              ? 'Si hay empate global, pasa el mejor posicionado de la tabla. Solo en la final hay tiempo extra y penales.'
              : 'Los empates se definen con tiempo extra + penales. Cargá los penales en cada partido finalizado.'}
          </span>
        </div>
      )}
    </div>
  );
};

export default LeagueManagementScreen;
