import { supabase } from '../supabaseClient';

/**
 * Genera la primera ronda de liguilla (cuartos de final o semifinal directa)
 * basándose en la tabla de posiciones actual.
 */
export async function generatePlayoffBracket(leagueId: string): Promise<{ success: boolean; error?: string; round?: number }> {
  try {
    // 1. Obtener la liga y su configuración
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('settings')
      .eq('id', leagueId)
      .single();

    if (leagueError) throw leagueError;
    if (!league) return { success: false, error: 'Liga no encontrada' };

    const settings = (league.settings as any) || {};
    const liguillaSize = settings.liguilla_size || 4;
    const twoLegged = settings.liguilla_two_legged || false;

    // 2. Verificar que no haya partidos de liguilla ya creados
    const { data: existing, error: existingError } = await supabase
      .from('matches')
      .select('id')
      .eq('league_id', leagueId)
      .gte('round_number', 100);

    if (existingError) throw existingError;
    if (existing && existing.length > 0) {
      return { success: false, error: 'Ya existen partidos de liguilla. Usa "Avanzar ronda" para crear la siguiente llave.' };
    }

    // 3. Calcular standings (tabla de posiciones)
    const standings = await computeStandings(leagueId);
    if (standings.length < liguillaSize) {
      return { success: false, error: `Se necesitan al menos ${liguillaSize} equipos en la tabla. Solo hay ${standings.length}.` };
    }

    const qualified = standings.slice(0, liguillaSize);

    // 4. Definir cruces según formato
    // 8 equipos: 1v8, 4v5, 3v6, 2v7
    // 4 equipos: 1v4, 2v3
    const matchups = liguillaSize === 8
      ? [
          { home: 0, away: 7 },
          { home: 3, away: 4 },
          { home: 2, away: 5 },
          { home: 1, away: 6 },
        ]
      : liguillaSize === 4
        ? [
            { home: 0, away: 3 },
            { home: 1, away: 2 },
          ]
        : [{ home: 0, away: 1 }];

    // 5. Crear partidos
    const roundNumber = 100; // Cuartos o primera ronda
    const matchesToInsert: any[] = [];

    for (const matchup of matchups) {
      const homeTeam = qualified[matchup.home];
      const awayTeam = qualified[matchup.away];
      if (!homeTeam || !awayTeam) continue;

      // Si es ida y vuelta, crear 2 partidos
      const legCount = twoLegged ? 2 : 1;
      for (let leg = 1; leg <= legCount; leg++) {
        matchesToInsert.push({
          league_id: leagueId,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          round_number: roundNumber,
          status: 'scheduled',
          start_time: null,
        });
      }
    }

    if (matchesToInsert.length === 0) {
      return { success: false, error: 'No se pudieron generar los cruces' };
    }

    const { error: insertError } = await supabase
      .from('matches')
      .insert(matchesToInsert);

    if (insertError) throw insertError;

    return { success: true, round: roundNumber };
  } catch (error: any) {
    console.error('Error generating playoff bracket:', error);
    return { success: false, error: error.message || 'Error desconocido' };
  }
}

/**
 * Avanza a la siguiente ronda de liguilla, tomando los ganadores de la ronda actual.
 * Si allow_draws=true y hay empate global, gana el mejor posicionado en la tabla.
 * Para la FINAL siempre hay tiempo extra y penales (no aplica aquí, eso es en el partido).
 */
export async function advanceToNextRound(leagueId: string): Promise<{ success: boolean; error?: string; round?: number }> {
  try {
    // 1. Obtener la liga y configuración
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('settings')
      .eq('id', leagueId)
      .single();

    if (leagueError) throw leagueError;
    if (!league) return { success: false, error: 'Liga no encontrada' };

    const settings = (league.settings as any) || {};
    const allowDraws = settings.allow_draws ?? true;
    const twoLegged = settings.liguilla_two_legged || false;
    const liguillaSize = settings.liguilla_size || 4;

    // 2. Obtener todos los partidos de liguilla, ordenados por ronda
    const { data: allPlayoff, error: mErr } = await supabase
      .from('matches')
      .select('*')
      .eq('league_id', leagueId)
      .gte('round_number', 100)
      .order('round_number', { ascending: true });

    if (mErr) throw mErr;
    if (!allPlayoff || allPlayoff.length === 0) {
      return { success: false, error: 'No hay partidos de liguilla generados' };
    }

    // 3. Encontrar la última ronda con partidos
    const maxRound = Math.max(...allPlayoff.map(m => m.round_number));
    const currentRoundMatches = allPlayoff.filter(m => m.round_number === maxRound);

    // 4. Si es la última ronda posible (final), no se puede avanzar más
    const isFinalRound =
      (liguillaSize === 8 && maxRound === 300) || // Final después de cuartos(100) + semis(200)
      (liguillaSize === 4 && maxRound === 200) || // Final después de semis(200)
      (liguillaSize === 2 && maxRound === 100);

    if (isFinalRound) {
      return { success: false, error: 'Ya estás en la final. No hay más rondas para generar.' };
    }

    // 5. Determinar si todos los partidos de la ronda actual están finalizados
    const allFinished = currentRoundMatches.every(m => m.status === 'finished');
    if (!allFinished) {
      const pending = currentRoundMatches.filter(m => m.status !== 'finished').length;
      return {
        success: false,
        error: `Hay ${pending} partido(s) pendiente(s) en la ronda actual. Finaliza todos antes de avanzar.`
      };
    }

    // 6. Calcular standings para resolver empates si allow_draws=true
    const standings = await computeStandings(leagueId);
    const positionMap = new Map<string, number>();
    standings.forEach((s, idx) => positionMap.set(s.id, idx + 1));

    // 7. Determinar ganadores de cada cruce de la ronda actual
    const winners: string[] = [];

    // Agrupar partidos por cruce (sin columna leg: agrupamos por equipos)
    const groupedByMatchup: Record<string, any[]> = {};
    currentRoundMatches.forEach(m => {
      const key = [m.home_team_id, m.away_team_id].sort().join('-');
      if (!groupedByMatchup[key]) groupedByMatchup[key] = [];
      groupedByMatchup[key].push(m);
    });

    for (const key in groupedByMatchup) {
      const matchupMatches = groupedByMatchup[key];

      let homeGoals = 0;
      let awayGoals = 0;
      // Tomamos el primer equipo como "home" para acumular
      const homeTeamId = matchupMatches[0].home_team_id;
      const awayTeamId = matchupMatches[0].away_team_id;

      matchupMatches.forEach(m => {
        const h = m.home_score ?? 0;
        const a = m.away_score ?? 0;
        if (m.home_team_id === homeTeamId) {
          homeGoals += h;
          awayGoals += a;
        } else {
          // Partido con home/away invertido (vuelta)
          homeGoals += a;
          awayGoals += h;
        }
      });

      let winnerId: string | null = null;
      if (homeGoals > awayGoals) winnerId = homeTeamId;
      else if (awayGoals > homeGoals) winnerId = awayTeamId;
      else {
        // Empate global
        if (allowDraws) {
          // Pasa el mejor posicionado en la tabla
          const homePos = positionMap.get(homeTeamId) ?? 999;
          const awayPos = positionMap.get(awayTeamId) ?? 999;
          winnerId = homePos < awayPos ? homeTeamId : awayTeamId;
        } else {
          // No se puede avanzar automáticamente: hay penales
          return {
            success: false,
            error: `Hay empate global en un cruce y los empates están desactivados. Cargá el resultado final con penales antes de avanzar.`
          };
        }
      }

      if (winnerId) winners.push(winnerId);
    }

    if (winners.length < 2) {
      return { success: false, error: 'Se necesitan al menos 2 ganadores para la siguiente ronda' };
    }

    // 8. Crear partidos de la siguiente ronda
    const nextRound = maxRound + 100;
    // Los cruces: 1°vs2°, 3°vs4° según orden de emparejamiento original
    // Para mantener el bracket correcto, los emparejamos en orden secuencial
    const matchups: { home: string; away: string }[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      if (winners[i + 1]) {
        matchups.push({ home: winners[i], away: winners[i + 1] });
      }
    }

    const matchesToInsert: any[] = [];
    for (const m of matchups) {
      // La final (round 300) siempre es partido único; otras rondas pueden ser ida/vuelta
      const legCount = twoLegged && nextRound < 300 ? 2 : 1;
      for (let leg = 1; leg <= legCount; leg++) {
        matchesToInsert.push({
          league_id: leagueId,
          home_team_id: m.home,
          away_team_id: m.away,
          round_number: nextRound,
          status: 'scheduled',
          start_time: null,
        });
      }
    }

    if (matchesToInsert.length === 0) {
      return { success: false, error: 'No se pudo generar la siguiente llave' };
    }

    const { error: insertError } = await supabase
      .from('matches')
      .insert(matchesToInsert);

    if (insertError) throw insertError;

    return { success: true, round: nextRound };
  } catch (error: any) {
    console.error('Error advancing playoff round:', error);
    return { success: false, error: error.message || 'Error desconocido' };
  }
}

/**
 * Calcula los standings (tabla de posiciones) de la fase regular.
 */
async function computeStandings(leagueId: string): Promise<Array<{ id: string; name: string; shield_url: string | null; pts: number; pj: number; gf: number; gc: number }>> {
  // 1. Obtener todos los equipos de la liga
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('id, name, shield_url')
    .eq('league_id', leagueId);

  if (teamsErr) throw teamsErr;
  if (!teams || teams.length === 0) return [];

  // 2. Obtener todos los partidos finalizados de fase regular (round < 100)
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('*')
    .eq('league_id', leagueId)
    .lt('round_number', 100)
    .eq('status', 'finished');

  if (mErr) throw mErr;

  // 3. Calcular stats
  const stats: Record<string, { id: string; name: string; shield_url: string | null; pts: number; pj: number; gf: number; gc: number }> = {};
  teams.forEach((t: any) => {
    stats[t.id] = {
      id: t.id,
      name: t.name,
      shield_url: t.shield_url,
      pts: 0,
      pj: 0,
      gf: 0,
      gc: 0,
    };
  });

  (matches || []).forEach((m: any) => {
    const home = stats[m.home_team_id];
    const away = stats[m.away_team_id];
    if (!home || !away) return;

    const homeScore = m.home_score ?? 0;
    const awayScore = m.away_score ?? 0;

    home.pj++;
    away.pj++;
    home.gf += homeScore;
    home.gc += awayScore;
    away.gf += awayScore;
    away.gc += homeScore;

    if (homeScore > awayScore) {
      home.pts += 3;
    } else if (awayScore > homeScore) {
      away.pts += 3;
    } else {
      home.pts += 1;
      away.pts += 1;
    }
  });

  // 4. Ordenar por puntos, diferencia de gol, goles a favor
  return Object.values(stats).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const dgA = a.gf - a.gc;
    const dgB = b.gf - b.gc;
    if (dgB !== dgA) return dgB - dgA;
    return b.gf - a.gf;
  });
}
