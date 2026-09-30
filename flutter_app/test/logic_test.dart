import 'package:flutter_test/flutter_test.dart';
import 'package:torneo_app/logic/fixture.dart';
import 'package:torneo_app/logic/liguilla.dart';
import 'package:torneo_app/logic/standings.dart';
import 'package:torneo_app/logic/stats.dart';

TeamBase t(String id) => (id: id, name: 'Equipo $id', shieldUrl: null);

MatchResult r(String h, String a, int hs, int as) =>
    MatchResult(homeTeamId: h, awayTeamId: a, homeScore: hs, awayScore: as);

void main() {
  group('calculateStandings', () {
    test('puntos, diferencia y orden', () {
      final s = calculateStandings(
        [t('A'), t('B'), t('C')],
        [r('A', 'B', 2, 0), r('B', 'C', 1, 1), r('C', 'A', 0, 3)],
      );
      expect(s.map((x) => x.id), ['A', 'B', 'C']);
      final a = s.first;
      expect((a.played, a.won, a.points, a.gf, a.ga, a.gd), (2, 2, 6, 5, 0, 5));
      expect(s[1].points, 1);
      expect(s[2].points, 1);
      // Empate a puntos: B (-2) arriba de C (-3).
      expect(s[1].gd, -2);
    });

    test('doble default (-1/-1) cuenta como derrota para ambos', () {
      final s = calculateStandings([t('A'), t('B')], [r('A', 'B', -1, -1)]);
      for (final x in s) {
        expect((x.played, x.lost, x.gf, x.ga, x.points), (1, 1, 0, 0, 0));
      }
    });

    test('sanciones ajustan puntos y orden', () {
      final totals = buildSanctionTotals([
        {'team_id': 'A', 'points_delta': -3},
        {'team_id': 'A', 'points_delta': -1},
      ]);
      final s = calculateStandings(
          [t('A'), t('B')], [r('A', 'B', 1, 0)], totals);
      expect(s.first.id, 'B');
      final a = s.firstWhere((x) => x.id == 'A');
      expect((a.matchPoints, a.sanctionPoints, a.points), (3, -4, -1));
    });
  });

  group('generateRoundRobin', () {
    test('todos contra todos, sin repetir, en sábados', () {
      final ids = ['1', '2', '3', '4', '5'];
      final m = generateRoundRobin(
        teamIds: ids,
        startDate: DateTime(2026, 10, 1), // jueves
        startHour: 9,
        startMinute: 0,
        matchDuration: 40,
        breakDuration: 10,
        allowedWeekdays: {DateTime.saturday},
      );
      expect(m.length, 10); // 5*4/2
      final pairs = m.map((x) => ({x.homeTeamId, x.awayTeamId})).toList();
      for (var i = 0; i < pairs.length; i++) {
        for (var j = i + 1; j < pairs.length; j++) {
          expect(pairs[i].containsAll(pairs[j]), isFalse);
        }
      }
      expect(m.every((x) => x.startTime.weekday == DateTime.saturday), isTrue);
      expect(m.first.startTime, DateTime(2026, 10, 3, 9, 0));
      // Segundo partido de la jornada 1 a las 9:50.
      expect(m[1].startTime, DateTime(2026, 10, 3, 9, 50));
      expect(m.map((x) => x.roundNumber).toSet(), {1, 2, 3, 4, 5});
    });

    test('ida y vuelta invierte localía y continúa jornadas', () {
      final m = generateRoundRobin(
        teamIds: ['1', '2', '3', '4'],
        startDate: DateTime(2026, 10, 3),
        startHour: 10,
        startMinute: 0,
        matchDuration: 40,
        breakDuration: 10,
        allowedWeekdays: {DateTime.saturday, DateTime.sunday},
        homeAndAway: true,
      );
      expect(m.length, 12);
      final first = m.where((x) => x.roundNumber == 1).toList();
      final back = m.where((x) => x.roundNumber == 4).toList();
      expect(back.length, first.length);
      for (var i = 0; i < first.length; i++) {
        expect(back[i].homeTeamId, first[i].awayTeamId);
        expect(back[i].awayTeamId, first[i].homeTeamId);
      }
    });
  });

  group('liguilla', () {
    final standings = calculateStandings(
        [for (var i = 1; i <= 8; i++) t('$i')], const []);
    final ranked = [
      for (var i = 0; i < 8; i++) RankedTeam(standings[i], i + 1),
    ];

    test('cuartos 1v8, 2v7, 3v6, 4v5', () {
      final p = quarterFinalPairs(ranked);
      expect(p.map((x) => '${x.$1.rank}v${x.$2.rank}'),
          ['1v8', '2v7', '3v6', '4v5']);
    });

    test('empate avanza el mejor posicionado', () {
      final w = playoffWinner(
          homeTeamId: ranked[5].id,
          awayTeamId: ranked[2].id,
          homeScore: 1,
          awayScore: 1,
          qualified: ranked);
      expect(w!.rank, 3);
    });

    test('reseed de semifinales: mejor vs peor', () {
      final p = reseedPairs([ranked[4], ranked[0], ranked[6], ranked[2]]);
      expect(p.map((x) => '${x.$1.rank}v${x.$2.rank}'), ['1v7', '3v5']);
    });
  });

  test('aggregateStats cuenta goles y tarjetas', () {
    Map<String, dynamic> ev(String type, String pid) => {
          'event_type': type,
          'player_id': pid,
          'player': {
            'name': 'P$pid',
            'photo_url': null,
            'team': {'name': 'T', 'shield_url': null},
          },
        };
    final s = aggregateStats([
      ev('goal', '1'),
      ev('goal', '1'),
      ev('goal', '2'),
      ev('yellow_card', '2'),
      ev('red_card', '3'),
      {'event_type': 'goal', 'player_id': null, 'player': null},
    ]);
    expect(s.scorers.map((x) => (x.playerId, x.goals)), [('1', 2), ('2', 1)]);
    expect(s.cards.first.playerId, '3');
  });
}
