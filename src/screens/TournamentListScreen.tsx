import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  status: 'draft' | 'active' | 'finished';
  start_date: string | null;
  end_date: string | null;
  league_count?: number;
}

const TournamentListScreen: React.FC = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [leaguesWithoutTournament, setLeaguesWithoutTournament] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // Check user role
      let admin = false;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        admin = profile?.role === 'admin' || profile?.role === 'superadmin';
      }
      setIsAdmin(admin);

      // Guard: solo admins pueden acceder a esta pantalla
      if (!admin) {
        navigate('/');
        return;
      }

      // Fetch tournaments
      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select(`
          *,
          leagues(count)
        `)
        .order('created_at', { ascending: false });

      if (tournamentsData) {
        const formatted = (tournamentsData as any[]).map(t => ({
          ...t,
          league_count: t.leagues?.[0]?.count || 0
        }));
        setTournaments(formatted);
      }

      // Fetch leagues without tournament
      const { data: orphanLeagues } = await supabase
        .from('leagues')
        .select('id, name, logo_url, format, status, owner_id')
        .is('tournament_id', null)
        .order('created_at', { ascending: false });

      if (orphanLeagues) {
        setLeaguesWithoutTournament(orphanLeagues);
      }

    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      active: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
      finished: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
    };
    const labels = { draft: 'Borrador', active: 'Activo', finished: 'Finalizado' };
    
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${styles[status as keyof typeof styles] || styles.draft}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white antialiased min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-xl font-bold tracking-tight">Torneos</h1>
            {user && (
              <button
                onClick={() => navigate('/create-tournament')}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-full font-bold text-sm shadow-md hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                <span>Nuevo</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Torneos */}
        {tournaments.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Mis Torneos ({tournaments.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tournaments.map((tournament) => (
                <button
                  key={tournament.id}
                  onClick={() => navigate(`/tournament/${tournament.id}`)}
                  className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col gap-4 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                      {tournament.logo_url ? (
                        <img src={tournament.logo_url} alt={tournament.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-3xl text-slate-400">emoji_events</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                          {tournament.name}
                        </h3>
                        {getStatusBadge(tournament.status)}
                      </div>
                      {tournament.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                          {tournament.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                      <span className="material-symbols-outlined text-base">groups</span>
                      <span>{tournament.league_count} {tournament.league_count === 1 ? 'liga' : 'ligas'}</span>
                    </div>
                    {tournament.start_date && (
                      <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                        <span className="material-symbols-outlined text-base">calendar_today</span>
                        <span>{new Date(tournament.start_date).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl text-slate-400">emoji_events</span>
            </div>
            <h3 className="text-lg font-bold mb-2">No hay torneos aún</h3>
            <p className="text-slate-500 mb-6 max-w-xs">Crea un torneo para organizar tus ligas bajo un mismo evento.</p>
            {user && (
              <button
                onClick={() => navigate('/create-tournament')}
                className="text-primary font-bold hover:underline"
              >
                Crear Primer Torneo
              </button>
            )}
          </div>
        )}

        {/* Ligas sin torneo */}
        {leaguesWithoutTournament.length > 0 && (
          <div className="mt-10 space-y-4">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Ligas Independientes ({leaguesWithoutTournament.length})
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Estas ligas no están asignadas a ningún torneo. Puedes asignarlas desde la gestión de cada liga.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {leaguesWithoutTournament.map((league) => (
                <button
                  key={league.id}
                  onClick={() => navigate(`/league/${league.id}`)}
                  className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-3 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {league.logo_url ? (
                      <img src={league.logo_url} alt={league.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-xl text-slate-400">sports_soccer</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate group-hover:text-primary transition-colors">{league.name}</h3>
                    <p className="text-xs text-slate-500">Fut {league.format}</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 text-sm">chevron_right</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentListScreen;
