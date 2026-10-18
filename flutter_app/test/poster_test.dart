import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:torneo_app/core/poster_repo.dart';
import 'package:torneo_app/logic/scorers.dart';
import 'package:torneo_app/models/models.dart';
import 'package:torneo_app/widgets/match_poster.dart';

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  testWidgets('el marcador del póster queda en una sola línea sin desbordar',
      (tester) async {
    final match = MatchModel.fromJson({
      'id': 'm1',
      'home_team_id': 'a',
      'away_team_id': 'b',
      'status': 'finished',
      'home_score': 10,
      'away_score': 12,
      'round_number': 1,
      'start_time': '2026-01-17T15:00:00Z',
      'home_team': {'name': 'Pumas', 'shield_url': null},
      'away_team': {'name': 'Halcones', 'shield_url': null},
    });
    await tester.pumpWidget(MaterialApp(
      home: Center(
        child: MatchPoster(
          kind: PosterKind.result,
          data: PosterData(match: match, leagueName: 'Liga MX', events: []),
        ),
      ),
    ));
    // Sin errores de overflow (RenderFlex) durante el layout.
    expect(tester.takeException(), isNull);
    final score = find.text('10 - 12');
    expect(score, findsOneWidget);
    // Una sola línea: la altura del texto es la de una línea (height: 1).
    final box = tester.getSize(score);
    expect(box.height, lessThan(60));
  });

  testWidgets('póster con muchos goleadores no desborda', (tester) async {
    final match = MatchModel.fromJson({
      'id': 'm2',
      'home_team_id': 'a',
      'away_team_id': 'b',
      'status': 'finished',
      'home_score': 8,
      'away_score': 2,
      'round_number': 4,
      'home_team': {'name': 'Bioroma', 'shield_url': null},
      'away_team': {'name': 'Dep Limón', 'shield_url': null},
    });
    MatchEvent ev(int i, String team, String type, String name) =>
        MatchEvent.fromJson({
          'id': 'e$i',
          'match_id': 'm2',
          'team_id': team,
          'event_type': type,
          'minute': 90,
          'player': {'name': name},
        });
    final events = [
      for (var i = 0; i < 8; i++) ev(i, 'a', 'goal', 'Jugador ${i % 6}'),
      ev(20, 'b', 'goal', 'Joshua Aguilar'),
      ev(21, 'b', 'goal', 'Leonardo Romero'),
      ev(22, 'a', 'yellow_card', 'X'),
      ev(23, 'b', 'red_card', 'Y'),
    ];
    await tester.pumpWidget(MaterialApp(
      home: Center(
        child: MatchPoster(
          kind: PosterKind.result,
          data: PosterData(
            match: match,
            leagueName: 'Liga premier la Lima 3ra edición',
            events: events,
          ),
        ),
      ),
    ));
    expect(tester.takeException(), isNull);
    expect(find.text('Jugador 0 ×2'), findsOneWidget);
    expect(find.text('+2 goles más'), findsOneWidget);
    // El nombre de la liga se muestra completo (no truncado a 1 línea).
    final league =
        tester.widget<Text>(find.text('LIGA PREMIER LA LIMA 3RA EDICIÓN'));
    expect(league.maxLines, 2);
  });

  test('groupScorers agrupa por jugador y conserva el orden', () {
    final lines = groupScorers([
      ('Jesus cueva', 10),
      ('Pedro gil', 20),
      ('Jesus cueva', 30),
      (null, 40),
    ]);
    expect(lines.map((l) => l.label),
        ['Jesus cueva ×2', "Pedro gil 20'", "Gol 40'"]);
  });
}
