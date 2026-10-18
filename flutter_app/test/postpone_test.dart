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

void main() {
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
}
