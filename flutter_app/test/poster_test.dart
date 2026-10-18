import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:torneo_app/core/poster_repo.dart';
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
}
