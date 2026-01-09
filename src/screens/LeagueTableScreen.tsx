import React, { useEffect, useState } from 'react';

import { supabase } from '../supabaseClient';

import { useToast } from '../context/ToastContext';

interface TopScorer {
  playerId: string;
  name: string;
  photoUrl: string | null;
  teamName: string;
  teamShield: string | null;
  goals: number;
}

interface FairPlayStat {
  playerId: string;
  name: string;
  photoUrl: string | null;
  teamName: string;
  teamShield: string | null;
  yellowCards: number;
  redCards: number;
}

type Tab = 'general' | 'scorers' | 'cards';

const LeagueTableScreen: React.FC = () => {

  const { showToast } = useToast();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);

  // Data States
  const [standings, setStandings] = useState<any[]>([]);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [fairPlay, setFairPlay] = useState<FairPlayStat[]>([]);

  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<Tab>('general');

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
      fetchData(selectedLeagueId);
    }
  }, [selectedLeagueId]);

  const fetchData = async (leagueId: string) => {
    setLoading(true);
    try {
      // 1. Fetch Teams (Critical for Standings)
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId);

      if (teamsError) throw teamsError;

      // 2. Fetch Finished Matches (for Standings) and IDs (for Stats)
      let matches: any[] = [];
      const { data: matchesData } = await supabase
        .from('matches')
        .select('id, home_team_id, away_team_id, home_score, away_score, status')
        .eq('league_id', leagueId)
        .eq('status', 'finished');

      if (matchesData) matches = matchesData;

      // --- CALCULATE STANDINGS ---
      if (teams) {
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
            played, won, drawn, lost, gf, ga,
            gd: gf - ga,
            points: (won * 3) + (drawn * 1)
          };
        });

        stats.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
        setStandings(stats);
      }

      // --- FETCH STATS (Top Scorers & Cards) ---
      // We need events from ALL matches in this league (finished or not, usually stats count immediately)
      // Actually, usually stats only count for finished matches or live ones. Let's include all matches for now or just finished.
      // Let's stick to finished matches to be safe with verified data, or maybe all started matches.
      // For now, using 'matches' which are 'finished'.

      const matchIds = matches.map(m => m.id);

      if (matchIds.length > 0) {
        const { data: events } = await supabase
          .from('match_events')
          .select(`
             event_type, player_id,
             player:player_id(name, photo_url, team:team_id(name, shield_url))
            `)
          .in('match_id', matchIds);

        if (events) {
          // Aggregate Goals
          const goalsMap = new Map<string, TopScorer>();
          // Aggregate Cards
          const cardsMap = new Map<string, FairPlayStat>();

          events.forEach((ev: any) => {
            if (!ev.player) return;

            const playerId = ev.player_id;
            const playerName = ev.player.name;
            const photoUrl = ev.player.photo_url;
            const teamName = ev.player.team?.name || 'Unknown';
            const teamShield = ev.player.team?.shield_url;

            if (ev.event_type === 'goal') {
              const current = goalsMap.get(playerId) || {
                playerId, name: playerName, photoUrl, teamName, teamShield, goals: 0
              };
              current.goals++;
              goalsMap.set(playerId, current);
            } else if (ev.event_type === 'yellow_card' || ev.event_type === 'red_card') {
              const current = cardsMap.get(playerId) || {
                playerId, name: playerName, photoUrl, teamName, teamShield, yellowCards: 0, redCards: 0
              };
              if (ev.event_type === 'yellow_card') current.yellowCards++;
              if (ev.event_type === 'red_card') current.redCards++;
              cardsMap.set(playerId, current);
            }
          });

          // Convert to Arrays and Sort
          const scorers = Array.from(goalsMap.values()).sort((a, b) => b.goals - a.goals);
          setTopScorers(scorers);

          const cards = Array.from(cardsMap.values()).sort((a, b) => {
            // Weight: Red = 3 points, Yellow = 1 point equivalent for sorting? 
            // Or simply: Most Reds, then Most Yellows.
            if (b.redCards !== a.redCards) return b.redCards - a.redCards;
            return b.yellowCards - a.yellowCards;
          });
          setFairPlay(cards);
        }
      } else {
        setTopScorers([]);
        setFairPlay([]);
      }

    } catch (error) {
      console.error('Error calculating data', error);
      showToast('Error al cargar la tabla', 'error');
    } finally {
      setLoading(false);
    }
  };

  const currentLeagueName = leagues.find(l => l.id === selectedLeagueId)?.name || 'Seleccionar Liga';

  return (
    <div className="bg-slate-50 dark:bg-slate-900 font-display antialiased text-gray-900 dark:text-white min-h-screen">
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-24">
        {/* Header with League Selector Logic */}
        <div className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Estadísticas</h2>
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

          {/* Tabs */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'general'
                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('scorers')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'scorers'
                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
            >
              Goleo
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'cards'
                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
            >
              Tarjetas
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : standings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">groups_3</span>
            <p className="text-slate-500 font-medium">No hay datos en "{currentLeagueName}"</p>
          </div>
        ) : (
          <div className="flex-1 w-full overflow-hidden flex flex-col pt-4 max-w-md md:max-w-3xl mx-auto w-full px-4 md:px-0">

            {/* GENERAL TABLE */}
            {activeTab === 'general' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-500 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-800/50">
                        <th className="px-4 py-3 w-10 text-center sticky left-0 bg-slate-50 dark:bg-slate-800">Pos</th>
                        <th className="px-2 py-3 sticky left-10 bg-slate-50 dark:bg-slate-800">Equipo</th>
                        <th className="px-2 py-3 text-center w-10">PJ</th>
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
                        <tr key={team.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3 text-center font-bold text-slate-400 sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30">
                            {index + 1}
                          </td>
                          <td className="px-2 py-3 sticky left-10 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30">
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0 border border-slate-200 dark:border-slate-600">
                                {team.shield_url ? <img src={team.shield_url} className="w-full h-full object-cover" /> : team.name.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="font-bold text-slate-900 dark:text-white truncate max-w-[140px]">{team.name}</span>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-slate-600 dark:text-slate-300">{team.played}</td>
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
                          <td className="px-4 py-3 text-center font-black text-lg text-primary bg-slate-50 dark:bg-white/5">
                            {team.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TOP SCORERS */}
            {activeTab === 'scorers' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {topScorers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">No hay goles registrados aún.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-center w-12">#</th>
                        <th className="px-4 py-3">Jugador</th>
                        <th className="px-4 py-3 text-right">Goles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {topScorers.map((scorer, idx) => (
                        <tr key={scorer.playerId} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="px-4 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600">
                                {scorer.photoUrl ? (
                                  <img src={scorer.photoUrl} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <span className="material-symbols-outlined text-lg">person</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{scorer.name}</div>
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  {scorer.teamShield && <img src={scorer.teamShield} className="size-3 object-contain" />}
                                  {scorer.teamName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-lg text-primary">{scorer.goals}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* CARDS */}
            {activeTab === 'cards' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {fairPlay.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">No hay tarjetas registradas aún.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-center w-12">#</th>
                        <th className="px-4 py-3">Jugador</th>
                        <th className="px-4 py-3 text-center">
                          <div className="size-3 bg-yellow-400 rounded-sm mx-auto"></div>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <div className="size-3 bg-red-500 rounded-sm mx-auto"></div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {fairPlay.map((stat, idx) => (
                        <tr key={stat.playerId} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="px-4 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600">
                                {stat.photoUrl ? (
                                  <img src={stat.photoUrl} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <span className="material-symbols-outlined text-lg">person</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{stat.name}</div>
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  {stat.teamShield && <img src={stat.teamShield} className="size-3 object-contain" />}
                                  {stat.teamName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{stat.yellowCards}</td>
                          <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{stat.redCards}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeagueTableScreen;
