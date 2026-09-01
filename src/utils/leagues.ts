export function isLeagueActive(league: { is_active?: boolean | null }): boolean {
  return league.is_active !== false;
}

export function filterActiveLeagues<T extends { is_active?: boolean | null }>(
  leagues: T[]
): T[] {
  return leagues.filter(isLeagueActive);
}
