import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

interface Match {
  id: string;
  start_time: string;
  home_score: number;
  away_score: number;
  status: string;
  home_team: { name: string; shield_url?: string };
  away_team: { name: string; shield_url?: string };
}

const MatchManagementScreen: React.FC = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, scheduled, live, finished

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('matches')
        .select(`
            id, 
            start_time, 
            home_score, 
            away_score, 
            status,
            home_team:teams!matches_home_team_id_fkey(name, shield_url),
            away_team:teams!matches_away_team_id_fkey(name, shield_url)
        `)
        .order('start_time', { ascending: false });

      if (data) {
        const formattedData = (data as any[] || []).map(m => ({
          ...m,
          home_team: Array.isArray(m.home_team) ? m.home_team[0] : m.home_team,
          away_team: Array.isArray(m.away_team) ? m.away_team[0] : m.away_team
        }));
        setMatches(formattedData);
      }
      setLoading(false);
    };

    fetchMatches();
  }, []);

  const filteredMatches = matches.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'live') return m.status === 'live';
    if (filter === 'scheduled') return m.status === 'scheduled';
    if (filter === 'finished') return m.status === 'finished';
    return true;
  });

  // Helper to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-xl overflow-hidden text-slate-900 dark:text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center p-4 pb-2 justify-between">
          <h2 className="text-xl font-bold leading-tight tracking-tight flex-1">Gestión de Partidos</h2>
          <div className="flex items-center justify-end gap-2">
            <button className="flex items-center justify-center rounded-full h-10 w-10 bg-transparent hover:bg-gray-200 dark:hover:bg-input-dark transition-colors">
              <span className="material-symbols-outlined text-2xl dark:text-white text-gray-700">add_circle</span>
            </button>
          </div>
        </div>
        {/* Search Bar (Visual Only for now) */}
        <div className="px-4 pb-3 pt-1">
          <div className="relative flex h-11 w-full items-center">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <span className="material-symbols-outlined text-text-secondary text-[20px]">search</span>
            </div>
            <input
              className="block w-full rounded-xl border-none bg-white dark:bg-input-dark py-2.5 pl-10 pr-3 text-sm text-gray-900 dark:text-white placeholder:text-text-secondary focus:ring-2 focus:ring-primary"
              placeholder="Buscar..."
              type="search"
            />
          </div>
        </div>
        {/* Segmented Control */}
        <div className="px-4 pb-4">
          <div className="flex h-10 w-full items-center rounded-lg bg-gray-200 dark:bg-input-dark p-1">
            {['all', 'scheduled', 'live', 'finished'].map(f => (
              <label key={f} className="group flex cursor-pointer h-full flex-1 items-center justify-center rounded-[5px] transition-all has-[:checked]:bg-white dark:has-[:checked]:bg-card-dark has-[:checked]:shadow-sm">
                <input
                  className="hidden"
                  name="match_filter"
                  type="radio"
                  value={f}
                  checked={filter === f}
                  onChange={() => setFilter(f)}
                />
                <span className="text-xs font-semibold capitalize text-gray-500 dark:text-text-secondary group-has-[:checked]:text-primary">
                  {f === 'all' ? 'Todos' : f === 'scheduled' ? 'Pendientes' : f === 'live' ? 'En Vivo' : 'Fin'}
                </span>
              </label>
            ))}
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto px-4 flex flex-col gap-3 pt-4">
        {loading ? (
          <div className="text-center py-10 opacity-50">Cargando...</div>
        ) : filteredMatches.length === 0 ? (
          <div className="text-center py-10 opacity-50">No hay partidos en esta categoría.</div>
        ) : (
          filteredMatches.map(match => (
            <div key={match.id} className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <div className="flex flex-col items-center min-w-[3rem]">
                <span className="text-xs font-bold text-primary">{match.status === 'live' ? 'LIVE' : match.status === 'finished' ? 'FT' : match.home_score + '-' + match.away_score}</span>
                {match.status === 'live' && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mt-1"></span>}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{match.home_team?.name}</span>
                  </div>
                  <span className="font-bold">{match.home_score}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{match.away_team?.name}</span>
                  </div>
                  <span className="font-bold">{match.away_score}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500 flex justify-between">
                  <span>{formatDate(match.start_time)}</span>
                  <span className="capitalize">{match.status}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      <button
        onClick={() => navigate('/create-match')}
        className="fixed bottom-[88px] right-4 h-14 w-14 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center text-white z-20 hover:scale-105 transition-transform"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>
    </div>
  );
};

export default MatchManagementScreen;
