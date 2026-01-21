import React, { useEffect, useState, useRef } from 'react';
import html2canvas from 'html2canvas';

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

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>('general');

  useEffect(() => {
    const fetchLeagues = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      let currentLeagues: any[] = [];
      let myFollows: string[] = [];

      if (user) {
        // 1. Fetch Followed Leagues
        const { data: follows } = await supabase
          .from('league_followers')
          .select('league_id')
          .eq('user_id', user.id);

        if (follows) {
          myFollows = follows.map(f => f.league_id);
          // Explicitly fetch details of followed leagues
          if (myFollows.length > 0) {
            const { data: followedLeagues } = await supabase.from('leagues').select('*').in('id', myFollows);
            if (followedLeagues) currentLeagues = [...currentLeagues, ...followedLeagues];
          }
        }

        // 2. Fetch Created Leagues
        const { data: myLeagues } = await supabase
          .from('leagues')
          .select('*')
          .eq('owner_id', user.id);

        if (myLeagues) {
          // Merge avoiding duplicates
          const existingIds = new Set(currentLeagues.map(l => l.id));
          myLeagues.forEach(l => {
            if (!existingIds.has(l.id)) currentLeagues.push(l);
          });
        }
      }

      // 3. Fetch Public Leagues (Limit 20)
      const { data: publicLeagues } = await supabase
        .from('leagues')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (publicLeagues) {
        const existingIds = new Set(currentLeagues.map(l => l.id));
        publicLeagues.forEach(l => {
          if (!existingIds.has(l.id)) currentLeagues.push(l);
        });
      }

      // Sort: Followed first, then Created
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
        // Only override if none selected (or first load)
        setSelectedLeagueId(prev => prev || currentLeagues[0].id);
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

  // Function to handle image download
  const downloadImage = async () => {
    if (!exportRef.current) return;

    setExporting(true);
    try {
      const element = exportRef.current;
      const images = Array.from(element.querySelectorAll('img'));
      const promises = images.map(img => {
        return new Promise<void>((resolve) => {
          if (img.src.startsWith('data:')) { resolve(); return; }
          const originalSrc = img.src;
          const image = new Image();
          image.crossOrigin = "anonymous";
          image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(image, 0, 0);
              img.src = canvas.toDataURL('image/png');
              img.dataset.originalSrc = originalSrc;
            }
            resolve();
          };
          image.onerror = () => { resolve(); };
          image.src = originalSrc + '?t=' + new Date().getTime();
        });
      });

      await Promise.race([Promise.all(promises), new Promise(resolve => setTimeout(resolve, 5000))]);

      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0f172a',
        logging: false,
        scale: 2,
      });

      images.forEach(img => {
        if (img.dataset.originalSrc) {
          img.src = img.dataset.originalSrc;
          delete img.dataset.originalSrc;
        }
      });

      const link = document.createElement('a');
      link.download = `tabla-general-${currentLeagueName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();

      showToast("Imagen descargada correctamente", "success");
      setShowExportModal(false);

    } catch (error) {
      console.error(error);
      showToast("Error al exportar imagen", "error");
    } finally {
      setExporting(false);
    }
  };

  const currentLeagueName = leagues.find(l => l.id === selectedLeagueId)?.name || 'Seleccionar Liga';

  return (
    <div className="bg-slate-50 dark:bg-slate-900 font-display antialiased text-gray-900 dark:text-white min-h-screen">
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-24">
        {/* Header with League Selector Logic */}
        <div className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="max-w-3xl mx-auto w-full p-4">
            <div className="flex flex-col gap-4">
              {/* Row 1: Title and Actions */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Estadísticas</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                    title="Compartir Tabla"
                  >
                    <span className="material-symbols-outlined">share</span>
                  </button>
                  <select
                    className="bg-slate-100 dark:bg-slate-800 border-none text-sm font-semibold rounded-lg p-2 max-w-[150px] truncate outline-none focus:ring-2 focus:ring-primary"
                    value={selectedLeagueId || ''}
                    onChange={(e) => setSelectedLeagueId(e.target.value)}
                  >
                    {leagues.map(l => (
                      <option key={l.id} value={l.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Tabs (Full Width) */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'general'
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                >
                  General
                </button>
                <button
                  onClick={() => setActiveTab('scorers')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'scorers'
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                >
                  Goleo
                </button>
                <button
                  onClick={() => setActiveTab('cards')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'cards'
                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                >
                  Tarjetas
                </button>
              </div>
            </div>
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
                  <table className="w-full text-left text-sm border-collapse min-w-full md:min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-500 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-800/50">
                        <th className="px-2 md:px-4 py-3 w-8 md:w-10 text-center sticky left-0 bg-slate-50 dark:bg-slate-800">Pos</th>
                        <th className="px-2 py-3 sticky left-8 md:left-10 bg-slate-50 dark:bg-slate-800">Equipo</th>
                        <th className="px-2 py-3 text-center w-8 md:w-10">PJ</th>
                        <th className="px-2 py-3 text-center w-10 hidden md:table-cell">G</th>
                        <th className="px-2 py-3 text-center w-10 hidden md:table-cell">E</th>
                        <th className="px-2 py-3 text-center w-10 hidden md:table-cell">P</th>
                        <th className="px-2 py-3 text-center w-10 text-slate-400 hidden md:table-cell">GF</th>
                        <th className="px-2 py-3 text-center w-10 text-slate-400 hidden md:table-cell">GC</th>
                        <th className="px-2 py-3 text-center w-10">DIF</th>
                        <th className="px-2 md:px-4 py-3 text-center w-12 md:w-14 font-black text-slate-900 dark:text-white bg-slate-100/50 dark:bg-white/5">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {standings.map((team, index) => (
                        <tr key={team.id}
                          className="group border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 transition-colors"
                          style={index < 8 ? { backgroundColor: 'rgba(59, 130, 246, 0.05)' } : {}}
                        >
                          <td className="px-3 py-3 text-center sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30">
                            <span className="text-xs font-bold" style={index < 8 ? { color: '#2563eb' } : { color: '#94a3b8' }}>{index + 1}</span>
                          </td>
                          <td className="px-2 py-3 sticky left-8 md:left-10 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/30">
                            <div className="flex items-center gap-2 md:gap-3">
                              <div className="size-10 md:size-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0 border-2 border-slate-200 dark:border-slate-600">
                                {team.shield_url ? <img src={team.shield_url} className="w-full h-full object-cover" /> : team.name.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="font-bold text-slate-900 dark:text-white truncate max-w-[100px] md:max-w-[140px] text-xs md:text-sm">{team.name}</span>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-slate-600 dark:text-slate-300 text-xs md:text-sm">{team.played}</td>
                          <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400 hidden md:table-cell">{team.won}</td>
                          <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400 hidden md:table-cell">{team.drawn}</td>
                          <td className="px-2 py-3 text-center text-slate-500 dark:text-slate-400 hidden md:table-cell">{team.lost}</td>
                          <td className="px-2 py-3 text-center text-slate-400 text-xs hidden md:table-cell">{team.gf}</td>
                          <td className="px-2 py-3 text-center text-slate-400 text-xs hidden md:table-cell">{team.ga}</td>
                          <td className="px-2 py-3 text-center font-medium text-xs md:text-sm">
                            <span className={team.gd > 0 ? "text-emerald-500" : team.gd < 0 ? "text-red-500" : "text-slate-400"}>
                              {team.gd > 0 ? `+${team.gd}` : team.gd}
                            </span>
                          </td>
                          <td className="px-2 md:px-4 py-3 text-center font-black text-sm md:text-lg text-primary bg-slate-50 dark:bg-white/5">
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

      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-2xl max-w-[95vw] w-full h-[95vh] flex flex-col overflow-hidden border border-slate-800 shadow-2xl">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg dark:text-white">Vista Previa</h3>
              <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                <span className="material-symbols-outlined dark:text-white">close</span>
              </button>
            </div>

            <div className="flex-1 p-4 bg-slate-900 flex justify-center overflow-auto items-start">
              {/* THE DESIGN TO CAPTURE */}
              <div
                ref={exportRef}
                className="w-[1080px] p-12 relative overflow-hidden flex flex-col shrink-0 mx-auto"
                style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#0f172a', color: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', minHeight: '1350px', height: 'auto' }}
              >
                {/* Background Elements - Explicit Colors */}
                <div className="absolute top-0 left-0 w-full h-full z-0" style={{ backgroundColor: '#0a101e' }}></div>
                <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full z-0 pointer-events-none" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', filter: 'blur(150px)' }}></div>
                <div className="absolute bottom-0 left-0 w-[700px] h-[700px] rounded-full z-0 pointer-events-none" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', filter: 'blur(120px)' }}></div>

                {/* Header */}
                <div className="relative z-10 flex flex-col items-center justify-center mb-10 shrink-0 border-b pb-8" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="font-bold tracking-[0.5em] uppercase text-xl mb-3 pl-[0.5em]" style={{ color: '#60a5fa' }}>Liga Premier {new Date().getFullYear()}</span>
                  <h1 className="text-7xl font-black italic uppercase tracking-tighter mb-4 text-center" style={{ color: '#ffffff' }}>
                    TABLA <span style={{ color: '#60a5fa' }}>
                      {activeTab === 'general' ? 'GENERAL' : activeTab === 'scorers' ? 'DE GOLEO' : 'FAIR PLAY'}
                    </span>
                  </h1>
                  <div className="px-8 py-3 rounded-full border text-xl font-bold uppercase tracking-widest flex items-center gap-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)', color: '#cbd5e1' }}>
                    <span className="material-symbols-outlined text-2xl">trophy</span>
                    <span className="leading-none pt-[3px]">{currentLeagueName.toUpperCase()}</span>
                  </div>
                </div>

                {/* Table List */}
                <div className="relative z-10 flex-1 w-full overflow-hidden px-4">
                  {/* GENERAL TABLE EXPORT */}
                  {activeTab === 'general' && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                          <th className="px-2 py-4 text-center uppercase tracking-widest text-[10px] font-bold w-12" style={{ color: '#94a3b8' }}>#</th>
                          <th className="px-2 py-4 uppercase tracking-widest text-[10px] font-bold" style={{ color: '#94a3b8' }}>Equipo</th>
                          <th className="px-2 py-4 text-center uppercase tracking-widest text-[10px] font-bold w-12" style={{ color: '#94a3b8' }}>PJ</th>
                          <th className="px-2 py-4 text-center uppercase tracking-widest text-[10px] font-bold w-12" style={{ color: '#94a3b8' }}>G</th>
                          <th className="px-2 py-4 text-center uppercase tracking-widest text-[10px] font-bold w-12" style={{ color: '#94a3b8' }}>E</th>
                          <th className="px-2 py-4 text-center uppercase tracking-widest text-[10px] font-bold w-12" style={{ color: '#94a3b8' }}>P</th>
                          <th className="px-2 py-4 text-center uppercase tracking-widest text-[10px] font-bold w-12" style={{ color: '#94a3b8' }}>GF</th>
                          <th className="px-2 py-4 text-center uppercase tracking-widest text-[10px] font-bold w-12" style={{ color: '#94a3b8' }}>GC</th>
                          <th className="px-2 py-4 text-center uppercase tracking-widest text-[10px] font-bold w-14" style={{ color: '#94a3b8' }}>DG</th>
                          <th className="px-2 py-4 text-center uppercase tracking-widest text-[10px] font-bold w-16" style={{ color: '#ffffff' }}>PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((team, index) => (
                          <tr key={team.id} style={{ borderBottom: index === 7 ? '3px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255,255,255,0.05)', backgroundColor: index < 8 ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                            <td className="px-2 py-3 text-center">
                              <span className="text-lg font-black" style={index < 8 ? { color: '#60a5fa' } : { color: '#64748b' }}>{index + 1}</span>
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-3">
                                <div className="w-14 h-14 flex items-center justify-center shrink-0 rounded-full p-0.5 border-2 overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }}>
                                  {team.shield_url ?
                                    <img src={team.shield_url} className="w-full h-full object-contain rounded-full" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }} crossOrigin="anonymous" />
                                    : <span className="material-symbols-outlined text-2xl" style={{ color: '#64748b' }}>shield</span>
                                  }
                                </div>
                                <span className="text-lg font-bold uppercase tracking-tight" style={{ color: '#ffffff' }}>{team.name}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center text-lg font-bold" style={{ color: '#cbd5e1' }}>{team.played}</td>
                            <td className="px-2 py-2 text-center text-lg font-medium" style={{ color: '#94a3b8' }}>{team.won}</td>
                            <td className="px-2 py-2 text-center text-lg font-medium" style={{ color: '#94a3b8' }}>{team.drawn}</td>
                            <td className="px-2 py-2 text-center text-lg font-medium" style={{ color: '#94a3b8' }}>{team.lost}</td>
                            <td className="px-2 py-2 text-center text-base font-medium" style={{ color: '#64748b' }}>{team.gf}</td>
                            <td className="px-2 py-2 text-center text-base font-medium" style={{ color: '#64748b' }}>{team.ga}</td>
                            <td className="px-2 py-2 text-center text-lg font-bold" style={{ color: team.gd > 0 ? '#34d399' : team.gd < 0 ? '#f87171' : '#cbd5e1' }}>
                              {team.gd > 0 ? `+${team.gd}` : team.gd}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center h-12 w-16 mx-auto rounded-lg border font-black text-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#ffffff', lineHeight: '1' }}>
                                <span>{team.points}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* SCORERS TABLE EXPORT */}
                  {activeTab === 'scorers' && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                          <th className="px-4 py-4 text-center uppercase tracking-widest text-sm font-bold w-16" style={{ color: '#94a3b8' }}>#</th>
                          <th className="px-4 py-4 uppercase tracking-widest text-sm font-bold" style={{ color: '#94a3b8' }}>Jugador</th>
                          <th className="px-4 py-4 text-right uppercase tracking-widest text-sm font-bold w-32" style={{ color: '#ffffff' }}>Goles</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topScorers.map((scorer, index) => (
                          <tr key={scorer.playerId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td className="px-4 py-3 text-center font-bold text-2xl" style={{ color: index < 3 ? '#fbbf24' : '#94a3b8' }}>
                              {index + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 flex items-center justify-center shrink-0 rounded-full p-0.5 border shadow-inner overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)' }}>
                                  {scorer.photoUrl ?
                                    <img src={scorer.photoUrl} className="w-full h-full object-cover rounded-full" crossOrigin="anonymous" />
                                    : <span className="material-symbols-outlined text-3xl" style={{ color: '#64748b' }}>person</span>
                                  }
                                </div>
                                <div>
                                  <div className="text-xl font-bold uppercase tracking-tight" style={{ color: '#ffffff' }}>{scorer.name}</div>
                                  <div className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#94a3b8' }}>
                                    {scorer.teamShield && <img src={scorer.teamShield} className="size-4 object-contain" crossOrigin="anonymous" />}
                                    {scorer.teamName}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-block px-4 py-1 rounded-lg border font-black text-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                                {scorer.goals}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* CARDS TABLE EXPORT */}
                  {activeTab === 'cards' && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                          <th className="px-4 py-4 text-center uppercase tracking-widest text-sm font-bold w-16" style={{ color: '#94a3b8' }}>#</th>
                          <th className="px-4 py-4 uppercase tracking-widest text-sm font-bold" style={{ color: '#94a3b8' }}>Jugador</th>
                          <th className="px-4 py-4 text-center uppercase tracking-widest text-sm font-bold w-20">
                            <div className="size-4 rounded-sm mx-auto" style={{ backgroundColor: '#facc15' }}></div>
                          </th>
                          <th className="px-4 py-4 text-center uppercase tracking-widest text-sm font-bold w-20">
                            <div className="size-4 rounded-sm mx-auto" style={{ backgroundColor: '#ef4444' }}></div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {fairPlay.map((stat, index) => (
                          <tr key={stat.playerId} className="border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                            <td className="px-4 py-3 text-center font-bold text-2xl" style={{ color: index < 3 ? '#fbbf24' : '#94a3b8' }}>
                              {index + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 flex items-center justify-center shrink-0 rounded-full p-0.5 border shadow-inner overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)' }}>
                                  {stat.photoUrl ?
                                    <img src={stat.photoUrl} className="w-full h-full object-cover rounded-full" crossOrigin="anonymous" />
                                    : <span className="material-symbols-outlined text-3xl" style={{ color: '#64748b' }}>person</span>
                                  }
                                </div>
                                <div>
                                  <div className="text-xl font-bold uppercase tracking-tight" style={{ color: '#ffffff' }}>{stat.name}</div>
                                  <div className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#94a3b8' }}>
                                    {stat.teamShield && <img src={stat.teamShield} className="size-4 object-contain" crossOrigin="anonymous" />}
                                    {stat.teamName}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-black text-xl" style={{ color: '#facc15' }}>{stat.yellowCards}</td>
                            <td className="px-4 py-3 text-center font-black text-xl" style={{ color: '#f87171' }}>{stat.redCards}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Footer */}
                <div className="relative z-10 w-full mt-auto border-t pt-6 flex justify-between px-4 pb-4" style={{ borderColor: 'rgba(255,255,255,0.05)', opacity: 0.6 }}>
                  <span className="text-sm font-bold uppercase tracking-[0.3em] flex items-center gap-2" style={{ color: '#94a3b8' }}>
                    <span className="material-symbols-outlined text-lg">verified</span> Resultados Oficiales
                  </span>
                  <span className="text-sm font-bold uppercase tracking-[0.3em]" style={{ color: '#94a3b8' }}>torneo-two.vercel.app</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-card-dark">
              <button onClick={() => setShowExportModal(false)}>Cancelar</button>
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
      )}
    </div>
  );
};

export default LeagueTableScreen;
