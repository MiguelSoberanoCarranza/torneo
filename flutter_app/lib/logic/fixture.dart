/// Port del algoritmo round-robin de FixtureGeneratorScreen.tsx.
library;

class FixtureMatch {
  FixtureMatch({
    required this.homeTeamId,
    required this.awayTeamId,
    required this.startTime,
    required this.roundNumber,
  });

  final String homeTeamId;
  final String awayTeamId;
  final DateTime startTime; // hora local
  final int roundNumber;

  Map<String, dynamic> toInsert(String leagueId) => {
        'league_id': leagueId,
        'home_team_id': homeTeamId,
        'away_team_id': awayTeamId,
        'start_time': startTime.toUtc().toIso8601String(),
        'status': 'scheduled',
        'location': 'Cancha Principal',
        'round_number': roundNumber,
      };
}

/// [allowedWeekdays] usa DateTime.monday..DateTime.sunday.
List<FixtureMatch> generateRoundRobin({
  required List<String> teamIds,
  required DateTime startDate,
  required int startHour,
  required int startMinute,
  required int matchDuration,
  required int breakDuration,
  required Set<int> allowedWeekdays,
  bool homeAndAway = false,
}) {
  assert(teamIds.length >= 2);
  assert(allowedWeekdays.isNotEmpty);
  const bye = '__BYE__';

  final matches = <FixtureMatch>[];
  var roundTeams = [...teamIds];
  if (roundTeams.length.isOdd) roundTeams.add(bye);

  final numRounds = roundTeams.length - 1;
  final perRound = roundTeams.length ~/ 2;
  final slot = matchDuration + breakDuration;
  var current = DateTime(startDate.year, startDate.month, startDate.day);

  DateTime nextValidDay(DateTime d) {
    var day = d;
    while (!allowedWeekdays.contains(day.weekday)) {
      day = DateTime(day.year, day.month, day.day + 1);
    }
    return day;
  }

  for (var round = 0; round < numRounds; round++) {
    current = nextValidDay(current);
    var minutes = startHour * 60 + startMinute;
    for (var i = 0; i < perRound; i++) {
      final home = roundTeams[i];
      final away = roundTeams[roundTeams.length - 1 - i];
      if (home == bye || away == bye) continue;
      matches.add(FixtureMatch(
        homeTeamId: home,
        awayTeamId: away,
        startTime: DateTime(current.year, current.month, current.day, 0,
            minutes),
        roundNumber: round + 1,
      ));
      minutes += slot;
    }
    // Rotación: fijo el primero, el último pasa a segunda posición.
    roundTeams = [
      roundTeams.first,
      roundTeams.last,
      ...roundTeams.sublist(1, roundTeams.length - 1),
    ];
    current = DateTime(current.year, current.month, current.day + 1);
  }

  if (homeAndAway) {
    final firstLeg = [...matches];
    for (var r = 1; r <= numRounds; r++) {
      current = nextValidDay(current);
      var minutes = startHour * 60 + startMinute;
      for (final m in firstLeg.where((m) => m.roundNumber == r)) {
        matches.add(FixtureMatch(
          homeTeamId: m.awayTeamId,
          awayTeamId: m.homeTeamId,
          startTime: DateTime(current.year, current.month, current.day, 0,
              minutes),
          roundNumber: numRounds + r,
        ));
        minutes += slot;
      }
      current = DateTime(current.year, current.month, current.day + 1);
    }
  }

  return matches;
}
