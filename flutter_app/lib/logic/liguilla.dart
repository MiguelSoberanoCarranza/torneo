import 'standings.dart';

const roundQF = 100;
const roundSF = 101;
const roundFinal = 102;

class RankedTeam {
  RankedTeam(this.standing, this.rank);
  final TeamStanding standing;
  final int rank;
  String get id => standing.id;
  String get name => standing.name;
  String? get shieldUrl => standing.shieldUrl;
}

/// Ganador de un cruce de liguilla: más goles; en empate avanza el mejor
/// posicionado en la fase regular (rank menor).
RankedTeam? playoffWinner({
  required String homeTeamId,
  required String awayTeamId,
  required int? homeScore,
  required int? awayScore,
  required List<RankedTeam> qualified,
}) {
  final home = qualified.where((t) => t.id == homeTeamId).firstOrNull;
  final away = qualified.where((t) => t.id == awayTeamId).firstOrNull;
  if (home == null || away == null) return null;
  final h = homeScore ?? 0, a = awayScore ?? 0;
  if (h > a) return home;
  if (a > h) return away;
  return home.rank < away.rank ? home : away;
}

/// Cuartos: 1v8, 2v7, 3v6, 4v5.
List<(RankedTeam, RankedTeam)> quarterFinalPairs(List<RankedTeam> top8) => [
      (top8[0], top8[7]),
      (top8[1], top8[6]),
      (top8[2], top8[5]),
      (top8[3], top8[4]),
    ];

/// Reordena ganadores por rank y empareja mejor vs peor.
List<(RankedTeam, RankedTeam)> reseedPairs(List<RankedTeam> winners) {
  final sorted = [...winners]..sort((a, b) => a.rank.compareTo(b.rank));
  final pairs = <(RankedTeam, RankedTeam)>[];
  for (var i = 0; i < sorted.length ~/ 2; i++) {
    pairs.add((sorted[i], sorted[sorted.length - 1 - i]));
  }
  return pairs;
}
