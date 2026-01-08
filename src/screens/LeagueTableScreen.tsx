import React, { useEffect, useState } from 'react';

import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const LeagueTableScreen: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeagues = async () => {
      // Fetch all leagues for public view
      const { data } = await supabase
        .from('leagues')
        .select('*')

        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setLeagues(data);
        setSelectedLeagueId(data[0].id);
      } else {
        setLoading(false);
      }
    };
    fetchLeagues();
  }, []);

  useEffect(() => {
    if (selectedLeagueId) {
      fetchStandings(selectedLeagueId);
    }
  }, [selectedLeagueId]);

  const fetchStandings = async (leagueId: string) => {
    setLoading(true);
    try {
      // 1. Fetch Teams (Critical)
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId);

      if (teamsError) throw teamsError;

      // 2. Fetch Matches (Optional - if fails, just show 0 stats)
      let matches: any[] = [];
      try {
        const { data } = await supabase
          .from('matches')
          .select('home_team_id, away_team_id, home_score, away_score, status')
          .eq('league_id', leagueId)
          .eq('status', 'finished');
        if (data) matches = data;
      } catch (err) {
        console.warn('Error fetching matches for table:', err);
      }

      if (teams) {
        // Calculate standings
        const stats = teams.map(team => {
          let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;

          matches.forEach(match => {
            let isHome = match.home_team_id === team.id;
            let isAway = match.away_team_id === team.id;

            if (isHome || isAway) {
              const homeScore = match.home_score ?? 0;
              const awayScore = match.away_score ?? 0;

              if ((isHome && homeScore !== null && awayScore !== null) || (isAway && homeScore !== null && awayScore !== null)) {
                played++;
                const teamScore = isHome ? homeScore : awayScore;
                const opponentScore = isHome ? awayScore : homeScore;

                gf += teamScore;
                ga += opponentScore;

                if (teamScore > opponentScore) won++;
                else if (teamScore === opponentScore) drawn++;
                else lost++;
              }
            }
          });

          return {
            ...team,
            played,
            won,
            drawn,
            lost,
            gf,
            ga,
            gd: gf - ga,
            points: (won * 3) + (drawn * 1)
          };
        });

        // Sort by points, then GD, then GF
        stats.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
        setStandings(stats);
      }
    } catch (error) {
      console.error('Error calculating standings', error);
      showToast('Error al cargar la tabla', 'error'); // Assuming useToast is available (checking imports)
    } finally {
      setLoading(false);
    }
  };

  const currentLeagueName = leagues.find(l => l.id === selectedLeagueId)?.name || 'Seleccionar Liga';

  return (
    <div className="bg-background-light dark:bg-background-dark font-display antialiased text-gray-900 dark:text-white min-h-screen">
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-24">
        {/* Header with League Selector Logic (Mocked via Header title or custom) */}
        <div className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Tabla General</h2>
          {/* Simple Dropdown for Leagues */}
          <select
            className="bg-slate-100 dark:bg-slate-800 border-none text-sm font-semibold rounded-lg p-2 max-w-[150px] truncate outline-none focus:ring-2 focus:ring-primary"
            value={selectedLeagueId || ''}
            onChange={(e) => setSelectedLeagueId(e.target.value)}
          >
            {leagues.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-500">Cargando...</p>
          </div>
        ) : standings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">groups_3</span>
            <p className="text-slate-500 font-medium">No hay equipos en "{currentLeagueName}"</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[250px]">
              Para ver la tabla, primero debes registrar equipos en esta liga desde la sección "Gestionar".
            </p>
            <button
              onClick={() => navigate(`/league/${selectedLeagueId}`)}
              className="mt-4 text-primary text-sm font-semibold hover:underline"
            >
              Ir a Gestionar Liga
            </button>
          </div>
        ) : (
          <div className="flex-1 w-full overflow-hidden flex flex-col pt-4">
            <div className="w-full overflow-x-auto pb-4">
              <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400 font-bold bg-slate-50/50 dark:bg-surface-dark/50 backdrop-blur-sm">
                    <th className="px-4 py-3 w-10 text-center sticky left-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur z-10">Pos</th>
                    <th className="px-2 py-3 sticky left-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur z-10">Equipo</th>
                    <th className="px-2 py-3 text-center w-10 text-slate-700 dark:text-slate-300">PJ</th>
                    <th className="px-2 py-3 text-center w-10">G</th>
                    <th className="px-2 py-3 text-center w-10">E</th>
                    <th className="px-2 py-3 text-center w-10">P</th>
                    <th className="px-2 py-3 text-center w-10 text-slate-400">GF</th>
                    <th className="px-2 py-3 text-center w-10 text-slate-400">GC</th>
                    <th className="px-2 py-3 text-center w-10">DIF</th>
                    <th className="px-4 py-3 text-center w-14 font-black text-slate-900 dark:text-white bg-slate-100/50 dark:bg-white/5">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {standings.map((team, index) => (
                    <tr key={team.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-center font-bold text-slate-400 group-hover:text-primary sticky left-0 bg-background-light dark:bg-background-dark group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 transition-colors z-10 border-r border-transparent group-hover:border-slate-100 dark:group-hover:border-slate-800">
                        {index + 1}
                      </td>
                      <td className="px-2 py-3 sticky left-10 bg-background-light dark:bg-background-dark group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 transition-colors z-10 border-r border-transparent group-hover:border-slate-100 dark:group-hover:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0 shadow-sm border border-slate-200 dark:border-slate-700">
                            {team.shield_url ? <img src={team.shield_url} className="w-full h-full object-cover" /> : team.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white truncate max-w-[140px]">{team.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center font-bold text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-white/5">{team.played}</td>
                      <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400">{team.won}</td>
                      <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400">{team.drawn}</td>
                      <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400">{team.lost}</td>
                      <td className="px-2 py-3 text-center text-slate-400 text-xs">{team.gf}</td>
                      <td className="px-2 py-3 text-center text-slate-400 text-xs">{team.ga}</td>
                      <td className="px-2 py-3 text-center font-medium">
                        <span className={team.gd > 0 ? "text-emerald-500" : team.gd < 0 ? "text-red-500" : "text-slate-400"}>
                          {team.gd > 0 ? `+${team.gd}` : team.gd}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-black text-lg text-primary bg-slate-100/50 dark:bg-white/5">
                        {team.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detailed Stats Legend */}
            <div className="px-4 mt-4 grid grid-cols-2 gap-2 text-[10px] text-slate-400 uppercase tracking-wider text-center sm:flex sm:justify-center sm:gap-6">
              <span>PJ: Jugados</span>
              <span>G: Ganados</span>
              <span>E: Empatados</span>
              <span>P: Perdidos</span>
              <span>GF: Goles Favor</span>
              <span>GE: Goles Contra</span>
              <span>DIF: Diferencia</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueTableScreen;
