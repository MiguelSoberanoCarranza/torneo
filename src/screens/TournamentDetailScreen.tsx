import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  status: 'draft' | 'active' | 'finished';
  start_date: string | null;
  end_date: string | null;
  owner_id: string;
}

interface League {
  id: string;
  name: string;
  logo_url: string | null;
  format: string;
  status: string;
  max_teams: number;
  invite_code?: string;
  teams_count?: number;
}

const TournamentDetailScreen: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  // Refrescar la lista cuando la pantalla vuelve a tener foco
  // (por ejemplo, al volver de la pantalla de la liga)
  useEffect(() => {
    const handleFocus = () => {
      fetchData();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // Check role
      let isAdmin = false;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
      }

      // Fetch tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();

      if (tournamentError) throw tournamentError;
      
      // Check ownership
      const isOwner = user && (tournamentData.owner_id === user.id || isAdmin);
      if (!isOwner) {
        navigate('/tournaments');
        showToast('No tienes acceso a este torneo', 'error');
        return;
      }
      
      setTournament(tournamentData);

      // Fetch leagues with team count - only from this tournament
      const { data: leaguesData } = await supabase
        .from('leagues')
        .select(`
          id, name, logo_url, format, status, max_teams, owner_id, invite_code,
          teams(count)
        `)
        .eq('tournament_id', id)
        .order('created_at', { ascending: false });

      if (leaguesData) {
        // En esta pantalla, el usuario es el owner del TORNEO,
        // por lo que debe ver TODAS las ligas del torneo (no solo
        // las que él creó). Si es admin, también ve todas.
        const formatted = (leaguesData as any[]).map(l => ({
          ...l,
          teams_count: l.teams?.[0]?.count || 0
        }));
        setLeagues(formatted);

        // Backfill en cliente: si alguna liga no tiene invite_code,
        // generarlo ahora para que pueda ser compartida
        const leaguesToBackfill = formatted.filter(l => !l.invite_code);
        if (leaguesToBackfill.length > 0) {
          await backfillInviteCodes(leaguesToBackfill);
        }
      }

    } catch (error) {
      console.error('Error fetching tournament:', error);
      showToast('Error al cargar torneo', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Backfill: para ligas que no tengan invite_code, generar uno y persistirlo.
  // Esto es un fallback en el cliente; la solución definitiva es la migración SQL.
  // Solo se actualiza el state si el código se persistió correctamente.
  const backfillInviteCodes = async (leaguesToFix: League[]) => {
    for (const league of leaguesToFix) {
      try {
        const newCode = Math.random().toString(36).substring(2, 10).toLowerCase();
        const { data, error } = await supabase
          .from('leagues')
          .update({ invite_code: newCode })
          .eq('id', league.id)
          .select('id, invite_code')
          .single();
        if (error) {
          console.warn('No se pudo generar código para liga', league.id, error.message);
          continue;
        }
        if (data && data.invite_code) {
          setLeagues(prev => prev.map(l =>
            l.id === league.id ? { ...l, invite_code: data.invite_code } : l
          ));
        }
      } catch (err) {
        console.warn('Error generando código para liga', league.id, err);
      }
    }
  };

  const handleDeleteTournament = async () => {
    if (!tournament) return;
    
    const confirm = window.confirm(`¿Eliminar "${tournament.name}"? Las ligas se conservarán pero quedarán sin torneo.`);
    if (!confirm) return;

    try {
      // Remove tournament_id from leagues first
      await supabase
        .from('leagues')
        .update({ tournament_id: null })
        .eq('tournament_id', tournament.id);

      // Delete tournament
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id);

      if (error) throw error;
      
      showToast('Torneo eliminado', 'success');
      navigate('/tournaments');
    } catch (error) {
      console.error('Error deleting tournament:', error);
      showToast('Error al eliminar torneo', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      active: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
      finished: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
    };
    const labels: Record<string, string> = { draft: 'Borrador', active: 'Activo', finished: 'Finalizado' };
    
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${styles[status as keyof typeof styles]}`}>
        {labels[status] || status}
      </span>
    );
  };

  const handleShareLeague = async (e: React.MouseEvent, league: League) => {
    e.stopPropagation();
    e.preventDefault();

    let code = league.invite_code;

    // Si la liga no tiene invite_code (por ejemplo, creada antes de la migración),
    // lo generamos en el momento y lo persistimos en la BD.
    if (!code) {
      try {
        const newCode = Math.random().toString(36).substring(2, 10).toLowerCase();
        const { data, error } = await supabase
          .from('leagues')
          .update({ invite_code: newCode })
          .eq('id', league.id)
          .select('id, invite_code')
          .single();
        if (error) throw error;
        if (!data?.invite_code) {
          showToast('No se pudo generar el código de invitación', 'error');
          return;
        }
        code = data.invite_code;
        // Actualizar el state local solo si se persistió
        setLeagues(prev => prev.map(l => l.id === league.id ? { ...l, invite_code: code! } : l));
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
      // Fallback: select-and-copy
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

  const isOwner = user && tournament && (user.id === tournament.owner_id || user.profile?.role === 'admin' || user.profile?.role === 'superadmin');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <p className="text-slate-500 mb-4">Torneo no encontrado</p>
        <button onClick={() => navigate('/tournaments')} className="text-primary font-bold">
          Volver a Torneos
        </button>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white antialiased min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <button
              onClick={() => navigate('/tournaments')}
              className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="text-lg font-bold tracking-tight flex-1 text-center truncate px-2">
              {tournament.name}
            </h1>
            {isOwner && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigate('/create-tournament', { state: { tournament_id: id } })}
                  className="flex items-center justify-center size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-blue-500">edit</span>
                </button>
                <button
                  onClick={handleDeleteTournament}
                  className="flex items-center justify-center size-10 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-red-500">delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tournament Profile */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex gap-5 items-start mb-6">
          <div className="relative shrink-0">
            <div
              className="bg-center bg-no-repeat bg-cover rounded-2xl h-24 w-24 shadow-lg ring-1 ring-white/10 flex items-center justify-center bg-slate-100 dark:bg-slate-800"
              style={tournament.logo_url ? { backgroundImage: `url("${tournament.logo_url}")` } : {}}
            >
              {!tournament.logo_url && <span className="material-symbols-outlined text-4xl text-slate-400">emoji_events</span>}
            </div>
            <div className="absolute -bottom-2 -right-2">
              {getStatusBadge(tournament.status)}
            </div>
          </div>
          <div className="flex flex-col pt-1 flex-1 min-w-0">
            <h1 className="text-xl font-extrabold leading-tight tracking-tight mb-1">{tournament.name}</h1>
            {tournament.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{tournament.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
              {tournament.start_date && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">calendar_today</span>
                  {new Date(tournament.start_date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {tournament.end_date && (
                <>
                  <span>-</span>
                  <span>{new Date(tournament.end_date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="flex flex-col items-center justify-center rounded-xl p-4 bg-surface-light dark:bg-surface-dark shadow-sm border border-slate-200 dark:border-slate-800">
            <span className="text-3xl font-bold text-primary">{leagues.length}</span>
            <span className="text-xs text-slate-500">Ligas</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl p-4 bg-surface-light dark:bg-surface-dark shadow-sm border border-slate-200 dark:border-slate-800">
            <span className="text-3xl font-bold text-primary">{leagues.reduce((sum, l) => sum + (l.teams_count || 0), 0)}</span>
            <span className="text-xs text-slate-500">Equipos</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl p-4 bg-surface-light dark:bg-surface-dark shadow-sm border border-slate-200 dark:border-slate-800">
            <span className="text-3xl font-bold text-primary">{leagues.filter(l => l.status === 'active').length}</span>
            <span className="text-xs text-slate-500">Activas</span>
          </div>
        </div>

        {/* Leagues List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Ligas del Torneo</h2>
            {isOwner && (
              <button
                onClick={() => navigate('/create-league', { state: { tournament_id: id } })}
                className="flex items-center gap-1 text-sm text-primary font-bold hover:underline"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Nueva Liga
              </button>
            )}
          </div>

          {leagues.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">sports_soccer</span>
              <p>No hay ligas en este torneo aún.</p>
              {isOwner && (
                <button
                  onClick={() => navigate('/create-league', { state: { tournament_id: id } })}
                  className="mt-3 text-primary font-bold hover:underline"
                >
                  Crear Primera Liga
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {leagues.map((league) => (
                <div
                  key={league.id}
                  className="w-full flex items-center gap-2 p-3 sm:p-4 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all group"
                >
                  <button
                    onClick={() => navigate(`/league/${league.id}`)}
                    className="flex items-center gap-4 flex-1 min-w-0 text-left"
                  >
                    <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {league.logo_url ? (
                        <img src={league.logo_url} alt={league.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-2xl text-slate-400">sports_soccer</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
                          {league.name}
                        </h3>
                        <span className="text-xs text-slate-400">Fut {league.format}</span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {league.teams_count || 0} / {league.max_teams} equipos
                      </p>
                      {league.invite_code && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const link = `${window.location.origin}/join?code=${league.invite_code}`;
                            navigator.clipboard.writeText(link).then(() => {
                              showToast('Link copiado', 'success');
                            });
                          }}
                          className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-slate-600 dark:text-slate-300 text-[11px] font-mono font-bold transition-colors"
                          title="Copiar link de invitación"
                        >
                          <span className="material-symbols-outlined text-[12px]">link</span>
                          {league.invite_code}
                          <span className="material-symbols-outlined text-[12px] opacity-60">content_copy</span>
                        </button>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        league.status === 'active' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        league.status === 'finished' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {league.status === 'upcoming' ? 'Próximo' : league.status === 'active' ? 'Activo' : 'Finalizado'}
                      </span>
                      <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                    </div>
                  </button>
                  {/* Share button */}
                  <button
                    onClick={(e) => handleShareLeague(e, league)}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-slate-500 flex items-center justify-center transition-colors"
                    title="Copiar link de invitación"
                  >
                    <span className="material-symbols-outlined text-xl">share</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentDetailScreen;
