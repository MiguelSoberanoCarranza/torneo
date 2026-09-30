/// Port directo de src/utils/standings.ts.
library;

class MatchResult {
  const MatchResult({
    required this.homeTeamId,
    required this.awayTeamId,
    this.homeScore,
    this.awayScore,
  });

  final String homeTeamId;
  final String awayTeamId;
  final int? homeScore;
  final int? awayScore;

  factory MatchResult.fromJson(Map<String, dynamic> j) => MatchResult(
        homeTeamId: j['home_team_id'] as String,
        awayTeamId: j['away_team_id'] as String,
        homeScore: (j['home_score'] as num?)?.toInt(),
        awayScore: (j['away_score'] as num?)?.toInt(),
      );
}

class TeamStanding {
  TeamStanding({
    required this.id,
    required this.name,
    this.shieldUrl,
    required this.played,
    required this.won,
    required this.drawn,
    required this.lost,
    required this.gf,
    required this.ga,
    required this.matchPoints,
    required this.sanctionPoints,
  });

  final String id;
  final String name;
  final String? shieldUrl;
  final int played;
  final int won;
  final int drawn;
  final int lost;
  final int gf;
  final int ga;
  final int matchPoints;
  final int sanctionPoints;

  int get gd => gf - ga;
  int get points => matchPoints + sanctionPoints;
}

Map<String, int> buildSanctionTotals(Iterable<Map<String, dynamic>> sanctions) {
  final totals = <String, int>{};
  for (final s in sanctions) {
    final teamId = s['team_id'] as String;
    final delta = (s['points_delta'] as num).toInt();
    totals[teamId] = (totals[teamId] ?? 0) + delta;
  }
  return totals;
}

typedef TeamBase = ({String id, String name, String? shieldUrl});

List<TeamStanding> calculateStandings(
  List<TeamBase> teams,
  List<MatchResult> matches, [
  Map<String, int> sanctionTotals = const {},
]) {
  final stats = teams.map((team) {
    var played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;

    for (final m in matches) {
      final isHome = m.homeTeamId == team.id;
      final isAway = m.awayTeamId == team.id;
      if (!isHome && !isAway) continue;

      final homeScore = m.homeScore ?? 0;
      final awayScore = m.awayScore ?? 0;
      played++;

      // Doble default: ambos pierden.
      if (homeScore == -1 && awayScore == -1) {
        lost++;
        continue;
      }

      final teamScore = isHome ? homeScore : awayScore;
      final oppScore = isHome ? awayScore : homeScore;
      gf += teamScore < 0 ? 0 : teamScore;
      ga += oppScore < 0 ? 0 : oppScore;

      if (teamScore > oppScore) {
        won++;
      } else if (teamScore == oppScore) {
        drawn++;
      } else {
        lost++;
      }
    }

    return TeamStanding(
      id: team.id,
      name: team.name,
      shieldUrl: team.shieldUrl,
      played: played,
      won: won,
      drawn: drawn,
      lost: lost,
      gf: gf,
      ga: ga,
      matchPoints: won * 3 + drawn,
      sanctionPoints: sanctionTotals[team.id] ?? 0,
    );
  }).toList();

  // Orden estable como Array.prototype.sort en JS moderno.
  final indexed = stats.asMap().entries.toList()
    ..sort((a, b) {
      final x = a.value, y = b.value;
      final c = y.points.compareTo(x.points);
      if (c != 0) return c;
      final d = y.gd.compareTo(x.gd);
      if (d != 0) return d;
      final e = y.gf.compareTo(x.gf);
      if (e != 0) return e;
      return a.key.compareTo(b.key);
    });
  return indexed.map((e) => e.value).toList();
}
