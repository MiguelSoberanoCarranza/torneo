import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../context/ToastContext';
import { isLeagueActive } from '../utils/leagues';

const MyLeaguesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyLeagues();
  }, []);

  const fetchMyLeagues = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate('/admin-login');
        return;
      }

      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLeagues(data || []);
    } catch (error: any) {
      console.error('Error fetching leagues:', error);
      showToast('Error al cargar ligas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (
    e: React.MouseEvent,
    league: { id: string; name: string; is_active?: boolean }
  ) => {
    e.stopPropagation();
    const currentlyActive = isLeagueActive(league);
    const action = currentlyActive ? 'desactivar' : 'activar';

    const confirmed = window.confirm(
      currentlyActive
        ? `¿Desactivar "${league.name}"? Dejará de verse en todo el sistema.`
        : `¿Activar "${league.name}"? Volverá a mostrarse en el sistema.`
    );
    if (!confirmed) return;

    setTogglingId(league.id);
    try {
      const { error } = await supabase
        .from('leagues')
        .update({ is_active: !currentlyActive })
        .eq('id', league.id);

      if (error) throw error;

      setLeagues((prev) =>
        prev.map((l) =>
          l.id === league.id ? { ...l, is_active: !currentlyActive } : l
        )
      );

      showToast(
        currentlyActive
          ? 'Liga desactivada correctamente'
          : 'Liga activada correctamente',
        'success'
      );
    } catch (error: any) {
      console.error('Error toggling league:', error);
      showToast(error.message || `Error al ${action} la liga`, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const activeLeagues = leagues.filter(isLeagueActive);
  const inactiveLeagues = leagues.filter((l) => !isLeagueActive(l));

  const renderLeagueCard = (league: any) => {
    const active = isLeagueActive(league);

    return (
      <div
        key={league.id}
        className={`bg-white dark:bg-surface-dark p-4 rounded-2xl shadow-sm border flex items-center gap-4 transition-shadow ${
          active
            ? 'border-slate-200 dark:border-slate-800 hover:shadow-md'
            : 'border-slate-200 dark:border-slate-800 opacity-70'
        }`}
      >
        <button
          onClick={() => navigate(`/league/${league.id}`)}
          className="flex items-center gap-4 flex-1 min-w-0 text-left group"
        >
          <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-600">
            {league.logo_url ? (
              <img src={league.logo_url} alt={league.name} className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-3xl text-slate-400 group-hover:text-primary transition-colors">
                emoji_events
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                {league.name}
              </h3>
              {!active && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500">
                  Inactiva
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">
              {league.format ? `Fútbol ${league.format}` : 'Formato no definido'}
            </p>
          </div>
          <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">
            chevron_right
          </span>
        </button>

        <button
          onClick={(e) => handleToggleActive(e, league)}
          disabled={togglingId === league.id}
          title={active ? 'Desactivar liga' : 'Activar liga'}
          className={`shrink-0 size-10 flex items-center justify-center rounded-full transition-colors ${
            active
              ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
              : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
          } disabled:opacity-50`}
        >
          <span className="material-symbols-outlined">
            {togglingId === league.id
              ? 'progress_activity'
              : active
              ? 'visibility_off'
              : 'visibility'}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased min-h-screen pb-24">
      <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-xl font-bold tracking-tight">Mis Ligas</h1>
            <button
              onClick={() => navigate('/create-league')}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-full font-bold text-sm shadow-md hover:bg-primary-dark transition-colors"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span>Crear</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : leagues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl text-slate-400">emoji_events</span>
            </div>
            <h3 className="text-lg font-bold mb-2">No tienes ligas aún</h3>
            <p className="text-slate-500 mb-6 max-w-xs">
              Crea tu primera liga para comenzar a gestionar el torneo.
            </p>
            <button
              onClick={() => navigate('/create-league')}
              className="text-primary font-bold hover:underline"
            >
              Crear Liga
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {activeLeagues.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">
                  Activas ({activeLeagues.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeLeagues.map(renderLeagueCard)}
                </div>
              </div>
            )}

            {inactiveLeagues.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">
                  Inactivas ({inactiveLeagues.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inactiveLeagues.map(renderLeagueCard)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyLeaguesScreen;
