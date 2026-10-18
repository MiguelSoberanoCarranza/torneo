import 'package:flutter_test/flutter_test.dart';
import 'package:torneo_app/logic/postpone.dart';
import 'package:torneo_app/models/models.dart';

MatchModel m(String id, int round, DateTime start,
        [String status = 'scheduled']) =>
    MatchModel(
        id: id,
        homeTeamId: 'a',
        awayTeamId: 'b',
        roundNumber: round,
        startTime: start,
        status: status);

MatchModel p(String id, int round, String home, String away, DateTime? start,
        [String status = 'scheduled']) =>
    MatchModel(
        id: id,
        homeTeamId: home,
        awayTeamId: away,
        roundNumber: round,
        startTime: start,
        status: status);

void main() {
  test('copias repetidas a borrar (caso LIGA MX)', () {
    final list = [
      // J1: jugado en enero + copia pendiente en noviembre -> borrar copia.
      p('j1-ene', 1, 'pumas', 'halcones', DateTime(2026, 1, 17), 'finished'),
      p('j1-nov', 1, 'pumas', 'halcones', DateTime(2026, 11, 21)),
      p('j1-oct', 1, 'halcones', 'pumas', DateTime(2026, 10, 24)),
      // J2: tres copias pendientes -> se queda la más próxima desde hoy.
      p('j2-jun', 2, 'atl', 'halcones', DateTime(2026, 6, 13)),
      p('j2-oct', 2, 'atl', 'halcones', DateTime(2026, 10, 31)),
      p('j2-nov', 2, 'halcones', 'atl', DateTime(2026, 11, 28)),
      // J9: todas las copias en el pasado -> se queda la más reciente.
      p('j9-a', 9, 'x', 'y', DateTime(2026, 8, 1)),
      p('j9-b', 9, 'x', 'y', DateTime(2026, 9, 1)),
      // J3: sin repetir -> no se toca.
      p('j3', 3, 'toros', 'halcones', DateTime(2026, 12, 5)),
      // Sin fecha -> nunca se toca.
      p('x1', 200, 'a', 'b', null),
      p('x2', 200, 'a', 'b', null),
    ];
    expect(
        duplicatesToRemove(list, now: DateTime(2026, 10, 18)).map((m) => m.id),
        ['j1-oct', 'j1-nov', 'j2-jun', 'j2-nov', 'j9-a']);
  });

  final matches = [
    m('j14', 14, DateTime(2026, 10, 11, 9)),
    m('j15a', 15, DateTime(2026, 10, 18, 9)),
    m('j15b', 15, DateTime(2026, 10, 18, 11, 30)),
    m('j15done', 15, DateTime(2026, 10, 18, 8), 'finished'),
    m('j16', 16, DateTime(2026, 10, 25, 10)),
    m('final', 102, DateTime(2026, 12, 6, 12)),
  ];

  test('pospone la jornada y recorre las siguientes', () {
    final plan =
        planPostpone(matches, round: 15, newDate: DateTime(2026, 10, 25));
    expect(plan.days, 7);
    final byId = {for (final x in plan.moves) x.match.id: x.newStart};
    expect(byId.keys.toSet(), {'j15a', 'j15b', 'j16', 'final'});
    expect(byId['j15b'], DateTime(2026, 10, 25, 11, 30));
    expect(byId['j16'], DateTime(2026, 11, 1, 10));
    expect(byId['final'], DateTime(2026, 12, 13, 12));
    expect(plan.rounds, [15, 16, 102]);
  });

  test('solo la jornada', () {
    final plan = planPostpone(matches,
        round: 15, newDate: DateTime(2026, 10, 25), shiftFollowing: false);
    expect(plan.moves.map((x) => x.match.id).toSet(), {'j15a', 'j15b'});
  });

  test('misma fecha no mueve nada', () {
    final plan =
        planPostpone(matches, round: 15, newDate: DateTime(2026, 10, 18, 20));
    expect(plan.isEmpty, true);
  });

  test('detecta repetidos y jornadas en varias fechas', () {
    final list = [
      m('a', 3, DateTime(2026, 6, 20, 9)),
      m('b', 3, DateTime(2026, 12, 5, 9)),
      m('c', 3, DateTime(2026, 12, 5, 10)),
      m('d', 4, DateTime(2026, 12, 12, 9)),
    ];
    expect(
        pendingDays(list, 3), [DateTime(2026, 6, 20), DateTime(2026, 12, 5)]);
    expect(pendingDays(list, 4).length, 1);
    // a, b, c tienen el mismo par 'a' vs 'b' en la jornada 3; d está en otra.
    expect(duplicateIds(list), {'a', 'b', 'c'});
  });
}
