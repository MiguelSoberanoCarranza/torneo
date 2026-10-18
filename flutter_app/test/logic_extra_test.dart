import 'package:flutter_test/flutter_test.dart';
import 'package:torneo_app/logic/fixture.dart';
import 'package:torneo_app/logic/form.dart';
import 'package:torneo_app/logic/liguilla.dart';
import 'package:torneo_app/logic/scorers.dart';
import 'package:torneo_app/logic/standings.dart';
import 'package:torneo_app/logic/stats.dart';

TeamBase t(String id) => (id: id, name: 'Equipo $id', shieldUrl: null);

MatchResult r(String h, String a, int? hs, int? as) =>
    MatchResult(homeTeamId: h, awayTeamId: a, homeScore: hs, awayScore: as);

List<FixtureMatch> fixture(int n,
        {Set<int> days = const {DateTime.sunday},
        bool homeAndAway = false,
        DateTime? start}) =>
    generateRoundRobin(
      teamIds: [for (var i = 1; i <= n; i++) 'T$i'],
      startDate: start ?? DateTime(2026, 10, 14), // miércoles
      startHour: 15,
      startMinute: 0,
      matchDuration: 25,
      breakDuration: 10,
      allowedWeekdays: days,
      homeAndAway: homeAndAway,
    );

void main() {
  group('generateRoundRobin', () {
    test('número impar de equipos: descansa uno por jornada', () {
      final m = fixture(5);
      // 5 equipos -> 5 jornadas de 2 partidos, todos contra todos una vez.
      expect(m.length, 10);
      expect(m.map((x) => x.roundNumber).toSet(), {1, 2, 3, 4, 5});
      final pairs = m.map((x) => ([x.homeTeamId, x.awayTeamId]..sort()).join());
      expect(pairs.toSet().length, 10);
      expect(
          m.any((x) =>
              x.homeTeamId.startsWith('__') || x.awayTeamId.startsWith('__')),
          isFalse);
      for (var round = 1; round <= 5; round++) {
        final teams = m
            .where((x) => x.roundNumber == round)
            .expand((x) => [x.homeTeamId, x.awayTeamId])
            .toList();
        expect(teams.length, 4);
        expect(teams.toSet().length, 4, reason: 'nadie juega dos veces');
      }
    });

    test('horarios consecutivos sin hueco por el equipo que descansa', () {
      final m = fixture(5).where((x) => x.roundNumber == 1).toList();
      expect(m.map((x) => (x.startTime.hour, x.startTime.minute)),
          [(15, 0), (15, 35)]);
    });

    test('solo cae en días permitidos y una jornada por día', () {
      final m = fixture(6, days: {DateTime.saturday, DateTime.sunday});
      expect(m.every((x) => x.startTime.weekday >= DateTime.saturday), isTrue);
      final dayOfRound = <int, DateTime>{};
      for (final x in m) {
        final d =
            DateTime(x.startTime.year, x.startTime.month, x.startTime.day);
        dayOfRound.putIfAbsent(x.roundNumber, () => d);
        expect(d, dayOfRound[x.roundNumber]);
      }
      // Sáb 17, dom 18, sáb 24, dom 25, sáb 31 de octubre.
      expect(dayOfRound.values.toList(), [
        DateTime(2026, 10, 17),
        DateTime(2026, 10, 18),
        DateTime(2026, 10, 24),
        DateTime(2026, 10, 25),
        DateTime(2026, 10, 31),
      ]);
    });

    test('si la fecha inicial es día permitido, empieza ese día', () {
      final m = fixture(4, start: DateTime(2026, 10, 18)); // domingo
      expect(m.first.startTime, DateTime(2026, 10, 18, 15));
    });

    test('ida y vuelta: doble de partidos, localía invertida', () {
      final m = fixture(4, homeAndAway: true);
      expect(m.length, 12);
      expect(m.map((x) => x.roundNumber).toSet(), {1, 2, 3, 4, 5, 6});
      final directed = m.map((x) => '${x.homeTeamId}>${x.awayTeamId}').toSet();
      expect(directed.length, 12, reason: 'cada partido una vez de local');
      final lastFirstLeg = m
          .where((x) => x.roundNumber == 3)
          .map((x) => x.startTime)
          .reduce((a, b) => a.isAfter(b) ? a : b);
      expect(
          m
              .where((x) => x.roundNumber > 3)
              .every((x) => x.startTime.isAfter(lastFirstLeg)),
          isTrue);
    });

    test('dos equipos', () {
      final m = fixture(2, homeAndAway: true);
      expect(m.length, 2);
      expect(m[1].homeTeamId, m[0].awayTeamId);
    });

    test('toInsert usa UTC y estado programado', () {
      final x = fixture(2).first;
      final j = x.toInsert('L');
      expect(j['league_id'], 'L');
      expect(j['status'], 'scheduled');
      expect(j['round_number'], 1);
      expect(
          DateTime.parse(j['start_time'] as String)
              .isAtSameMomentAs(x.startTime),
          isTrue);
      expect((j['start_time'] as String).endsWith('Z'), isTrue);
    });
  });

  group('calculateStandings', () {
    test('desempate: puntos, diferencia, goles a favor, orden original', () {
      final s = calculateStandings(
        [t('A'), t('B'), t('C'), t('D')],
        [
          r('A', 'X', 3, 1), // A: +2, gf 3
          r('B', 'X', 2, 0), // B: +2, gf 2
          r('C', 'X', 1, 0), // C: +1
          r('D', 'X', 1, 0), // D: +1 igual que C
        ],
      );
      expect(s.map((x) => x.id), ['A', 'B', 'C', 'D']);
    });

    test('sanciones pueden cambiar el orden', () {
      final totals = buildSanctionTotals([
        {'team_id': 'A', 'points_delta': -3},
        {'team_id': 'A', 'points_delta': 1},
        {'team_id': 'B', 'points_delta': 2},
      ]);
      expect(totals, {'A': -2, 'B': 2});
      final s =
          calculateStandings([t('A'), t('B')], [r('A', 'B', 1, 0)], totals);
      expect(s.first.id, 'B');
      expect((s.first.points, s.first.matchPoints, s.first.sanctionPoints),
          (2, 0, 2));
      expect(s.last.points, 1);
    });

    test('default de un solo equipo: pierde sin sumar goles negativos', () {
      final s = calculateStandings([t('A'), t('B')], [r('A', 'B', -1, 3)]);
      final a = s.firstWhere((x) => x.id == 'A');
      final b = s.firstWhere((x) => x.id == 'B');
      expect((a.lost, a.gf, a.ga), (1, 0, 3));
      expect((b.won, b.points, b.gf), (1, 3, 3));
    });

    test('marcador nulo cuenta como 0-0 y equipos sin partidos', () {
      final s = calculateStandings(
          [t('A'), t('B'), t('C')], [r('A', 'B', null, null)]);
      expect(s.firstWhere((x) => x.id == 'A').drawn, 1);
      final c = s.firstWhere((x) => x.id == 'C');
      expect((c.played, c.points), (0, 0));
    });

    test('MatchResult.fromJson', () {
      final m = MatchResult.fromJson({
        'home_team_id': 'A',
        'away_team_id': 'B',
        'home_score': 2.0,
        'away_score': null,
      });
      expect((m.homeScore, m.awayScore), (2, null));
    });
  });

  group('aggregateStats', () {
    Map<String, dynamic> ev(String type, String? pid,
            {Object? player = const {'name': 'Jugador'}}) =>
        {'event_type': type, 'player_id': pid, 'player': player};

    test('ignora eventos sin jugador y cuenta cambios aparte', () {
      final s = aggregateStats([
        ev('goal', null),
        ev('goal', 'p1', player: null),
        ev('substitution', 'p1'),
        ev('goal', 'p1'),
      ]);
      expect(s.scorers.length, 1);
      expect(s.scorers.first.goals, 1);
      expect(s.cards, isEmpty);
    });

    test('tarjetas: roja pesa más que amarillas; equipo por defecto', () {
      final s = aggregateStats([
        ev('yellow_card', 'p1'),
        ev('yellow_card', 'p1'),
        ev('red_card', 'p2', player: {
          'name': 'Rojo',
          'team': [
            {'name': 'Pumas', 'shield_url': 's'}
          ]
        }),
      ]);
      expect(s.cards.map((x) => x.playerId), ['p2', 'p1']);
      expect(s.cards.first.teamName, 'Pumas');
      expect(s.cards.last.teamName, 'Unknown');
      expect(s.cards.last.yellowCards, 2);
    });
  });

  group('liguilla', () {
    List<RankedTeam> ranked(int n) {
      final st = calculateStandings([for (var i = 1; i <= n; i++) t('$i')], []);
      return [for (var i = 0; i < n; i++) RankedTeam(st[i], i + 1)];
    }

    test('ganador por marcador y equipo no clasificado', () {
      final q = ranked(4);
      expect(
          playoffWinner(
                  homeTeamId: '1',
                  awayTeamId: '4',
                  homeScore: 0,
                  awayScore: 2,
                  qualified: q)!
              .rank,
          4);
      expect(
          playoffWinner(
              homeTeamId: '1',
              awayTeamId: 'X',
              homeScore: 1,
              awayScore: 0,
              qualified: q),
          isNull);
      // Sin marcador (null-null) avanza el mejor posicionado.
      expect(
          playoffWinner(
                  homeTeamId: '4',
                  awayTeamId: '2',
                  homeScore: null,
                  awayScore: null,
                  qualified: q)!
              .rank,
          2);
    });

    test('reseed con dos ganadores y con número impar', () {
      final q = ranked(8);
      expect(reseedPairs([q[5], q[1]]).map((p) => (p.$1.rank, p.$2.rank)),
          [(2, 6)]);
      expect(reseedPairs([q[0], q[3], q[6]]).length, 1);
      expect(reseedPairs(const []), isEmpty);
    });

    test('constantes de ronda', () {
      expect((roundQF, roundSF, roundFinal), (100, 101, 102));
    });
  });

  group('groupScorers', () {
    test('nombres vacíos o nulos se agrupan como "Gol" y se recortan', () {
      final g = groupScorers([
        (' Juan ', 10),
        (null, 20),
        ('', 30),
        ('Juan', null),
      ]);
      expect(g.map((x) => x.name), ['Juan', 'Gol']);
      expect(g.first.goals, 2);
      expect(g.last.goals, 2);
    });

    test('etiqueta con y sin minuto', () {
      expect(groupScorers([('Ana', 23)]).single.label, "Ana 23'");
      expect(groupScorers([('Ana', null)]).single.label, 'Ana');
      expect(groupScorers([('Ana', 1), ('Ana', 2), ('Ana', 3)]).single.label,
          'Ana ×3');
    });
  });

  group('teamForm', () {
    test('local y visitante, empates y defaults', () {
      final f = teamForm('A', [
        r('A', 'B', 1, 0), // gana de local
        r('B', 'A', 2, 1), // pierde de visitante
        r('C', 'A', 1, 1), // empata
        r('A', 'D', -1, -1), // doble default
        r('X', 'Y', 3, 0), // no juega
      ]);
      expect(f, [
        FormResult.win,
        FormResult.loss,
        FormResult.draw,
        FormResult.loss,
      ]);
    });

    test('count limita a los más recientes', () {
      final ms = [for (var i = 0; i < 7; i++) r('A', 'B', i.isEven ? 1 : 0, 0)];
      final f = teamForm('A', ms, count: 3);
      expect(f, [FormResult.win, FormResult.draw, FormResult.win]);
      expect(teamForm('Z', ms), isEmpty);
    });
  });
}
