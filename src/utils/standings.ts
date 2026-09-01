export interface MatchResult {
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
}

export interface TeamBase {
  id: string;
  name: string;
  shield_url?: string | null;
}

export interface TeamStanding extends TeamBase {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  matchPoints: number;
  sanctionPoints: number;
  points: number;
}

export function buildSanctionTotals(
  sanctions: { team_id: string; points_delta: number }[]
): Map<string, number> {
  const totals = new Map<string, number>();
  sanctions.forEach((s) => {
    totals.set(s.team_id, (totals.get(s.team_id) || 0) + s.points_delta);
  });
  return totals;
}

export function calculateStandings(
  teams: TeamBase[],
  matches: MatchResult[],
  sanctionTotals: Map<string, number> = new Map()
): TeamStanding[] {
  const stats = teams.map((team) => {
    let played = 0;
    let won = 0;
    let drawn = 0;
    let lost = 0;
    let gf = 0;
    let ga = 0;

    matches.forEach((match) => {
      const isHome = match.home_team_id === team.id;
      const isAway = match.away_team_id === team.id;

      if (!isHome && !isAway) return;

      const homeScore = match.home_score ?? 0;
      const awayScore = match.away_score ?? 0;

      if (homeScore === null || awayScore === null) return;

      played++;

      if (homeScore === -1 && awayScore === -1) {
        lost++;
        return;
      }

      const teamScore = isHome ? homeScore : awayScore;
      const opponentScore = isHome ? awayScore : homeScore;

      gf += Math.max(0, teamScore);
      ga += Math.max(0, opponentScore);

      if (teamScore > opponentScore) won++;
      else if (teamScore === opponentScore) drawn++;
      else lost++;
    });

    const matchPoints = won * 3 + drawn;
    const sanctionPoints = sanctionTotals.get(team.id) || 0;

    return {
      ...team,
      played,
      won,
      drawn,
      lost,
      gf,
      ga,
      gd: gf - ga,
      matchPoints,
      sanctionPoints,
      points: matchPoints + sanctionPoints,
    };
  });

  stats.sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf
  );

  return stats;
}
