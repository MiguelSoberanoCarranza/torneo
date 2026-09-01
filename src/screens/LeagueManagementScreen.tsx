import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { seedLeague } from '../utils/seeder';
import { isLeagueActive } from '../utils/leagues';

const LeagueManagementScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [viewMode, setViewMode] = useState<string>('Equipos');
  const [league, setLeague] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Additional state for players and referees
  const [players, setPlayers] = useState<any[]>([]);
  const [referees, setReferees] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingReferees, setLoadingReferees] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchLeagueData = async () => {
      if (!id) return;
      try {
        // Fetch League Details
        const { data: leagueData, error: leagueError } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', id)
          .single();

        if (leagueError) throw leagueError;

        const { data: { user } } = await supabase.auth.getUser();
        const isOwner = user && leagueData.owner_id === user.id;

        if (!isLeagueActive(leagueData) && !isOwner) {
          setLeague(null);
          return;
        }

        setLeague(leagueData);

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
  }, [id]);

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
    return <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">Liga no encontrada o no disponible</div>;
  }

  const leagueInactive = !isLeagueActive(league);

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased selection:bg-primary selection:text-white h-screen overflow-hidden flex flex-col">
      <div className="relative flex h-full min-h-screen w-full flex-col pb-24 overflow-y-auto">
        {/* Top App Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm p-4 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-slate-900 dark:text-white text-2xl">arrow_back</span>
          </button>
          <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">Detalles de Liga</h2>
          <button
            onClick={() => navigate('/create-league', { state: { league_id: id } })}
            className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-primary text-2xl">edit_square</span>
          </button>
        </div>

        {leagueInactive && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-amber-100 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">visibility_off</span>
            Esta liga está desactivada y no es visible en el sistema. Actívala desde Mis Ligas.
          </div>
        )}

        {/* League Header Profile */}
        <div className="px-4 pt-6 pb-2">
          <div className="flex flex-col gap-6">
            <div className="flex gap-5 items-start">
              <div className="relative shrink-0">
                <div
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-2xl h-24 w-24 shadow-lg ring-1 ring-white/10 flex items-center justify-center bg-slate-100 dark:bg-slate-800"
                  style={league.logo_url ? { backgroundImage: `url("${league.logo_url}")` } : {}}
                >
                  {!league.logo_url && <span className="material-symbols-outlined text-4xl text-slate-400">emoji_events</span>}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-background-light dark:border-background-dark uppercase">
                  {league.status}
                </div>
              </div>
              <div className="flex flex-col pt-1">
                <h1 className="text-xl font-extrabold leading-tight tracking-tight mb-1">{league.name}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">category</span>
                  Formato: Fut {league.format}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1 box-clamp-2">
                  {league.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards (Horizontal Scroll) */}
        <div className="flex overflow-x-auto hide-scrollbar gap-3 px-4 py-4 w-full shrink-0">
          <div className="flex min-w-[140px] flex-1 flex-col justify-between rounded-xl p-4 bg-surface-light dark:bg-surface-dark shadow-sm border border-slate-200 dark:border-slate-800/50">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <span className="material-symbols-outlined">groups</span>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Equipos</p>
            </div>
            <p className="text-3xl font-bold tracking-tight">{teams.length} / {league.max_teams || '-'}</p>
          </div>
          {/* Static Stats for now */}
          <div className="flex min-w-[140px] flex-1 flex-col justify-between rounded-xl p-4 bg-surface-light dark:bg-surface-dark shadow-sm border border-slate-200 dark:border-slate-800/50">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <span className="material-symbols-outlined">sports_soccer</span>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Partidos</p>
            </div>
            <p className="text-3xl font-bold tracking-tight">0</p>
          </div>
        </div>

        {/* Segmented Control */}
        <div className="px-4 py-2 sticky top-[72px] z-10 bg-background-light dark:bg-background-dark pb-3">
          <div className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 p-1">
            {['Equipos', 'Jugadores', 'Árbitros'].map((mode) => (
              <label key={mode} className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 has-[:checked]:bg-white dark:has-[:checked]:bg-surface-dark has-[:checked]:shadow-sm has-[:checked]:text-primary text-slate-500 dark:text-slate-400 text-sm font-bold transition-all duration-200">
                <span className="truncate">{mode}</span>
                <input
                  className="invisible w-0 absolute"
                  type="radio"
                  name="view_mode"
                  value={mode}
                  checked={viewMode === mode}
                  onChange={() => setViewMode(mode)}
                />
              </label>
            ))}
          </div>
        </div>


        {/* Search Bar */}
        <div className="px-4 pb-4">
          <div className="relative flex items-center w-full h-12 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 transition-shadow">
            <div className="grid place-items-center h-full w-12 text-slate-400">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input
              className="peer h-full w-full outline-none bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 pr-4 font-normal"
              id="search"
              placeholder={`Buscar ${viewMode.slice(0, -1).toLowerCase()}...`}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Content List */}
        <div className="flex flex-col gap-3 px-4">
          {viewMode === 'Equipos' && (
            teams.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <p>{teams.length === 0 ? 'No hay equipos registrados aún.' : 'No se encontraron equipos.'}</p>
                {teams.length === 0 && (
                  <button
                    onClick={handleSeedData}
                    className="mt-4 px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-200 transition-colors"
                  >
                    Generar 10 Equipos de Prueba
                  </button>
                )}
              </div>
            ) : (
              teams.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).map((team) => (
                <div
                  key={team.id}
                  onClick={() => navigate('/create-team', { state: { teamId: team.id } })} // Edit team
                  className="group flex items-center gap-4 p-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div
                    className="bg-center bg-no-repeat bg-cover rounded-lg h-14 w-14 shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                    style={team.shield_url ? { backgroundImage: `url("${team.shield_url}")` } : {}}
                  >
                    {!team.shield_url && <span className="material-symbols-outlined text-2xl text-slate-400">shield</span>}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <p className="text-base font-bold text-slate-900 dark:text-white truncate">{team.name}</p>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Capitán: {team.captain_name || 'Sin asignar'}</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">chevron_right</span>
                </div>
              ))
            )
          )}

          {viewMode === 'Jugadores' && (
            loadingPlayers ? (
              <div className="text-center py-10 text-slate-500">Cargando jugadores...</div>
            ) : players.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <p>{players.length === 0 ? 'No hay jugadores registrados.' : 'No se encontraron jugadores.'}</p>
              </div>
            ) : (
              players.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800"
                >
                  <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
                    {player.number || '#'}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-900 dark:text-white truncate">{player.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary">{player.position}</span>
                      {player.teams && (
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                          {player.teams.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          )}

          {viewMode === 'Árbitros' && (
            loadingReferees ? (
              <div className="text-center py-10 text-slate-500">Cargando árbitros...</div>
            ) : referees.filter(r => (r.full_name || r.email).toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <p>{referees.length === 0 ? 'No hay árbitros registrados.' : 'No se encontraron árbitros.'}</p>
              </div>
            ) : (
              referees.filter(r => (r.full_name || r.email).toLowerCase().includes(searchQuery.toLowerCase())).map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800"
                >
                  <div
                    className="h-12 w-12 shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 bg-cover bg-center flex items-center justify-center text-slate-500"
                    style={ref.avatar_url ? { backgroundImage: `url("${ref.avatar_url}")` } : {}}
                  >
                    {!ref.avatar_url && <span className="material-symbols-outlined">sports_whistle</span>}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-900 dark:text-white truncate">{ref.full_name || ref.email}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Árbitro Oficial</p>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Floating Action Button */}
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
            className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:scale-105 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-2xl">{viewMode === 'Árbitros' ? 'person_add' : 'add'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeagueManagementScreen;
