import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:torneo_app/core/poster_repo.dart';
import 'package:torneo_app/logic/form.dart';
import 'package:torneo_app/logic/liguilla.dart';
import 'package:torneo_app/logic/standings.dart';
import 'package:torneo_app/models/models.dart';
import 'package:torneo_app/theme/app_theme.dart';
import 'package:torneo_app/widgets/common.dart';
import 'package:torneo_app/widgets/liguilla_bracket.dart';
import 'package:torneo_app/widgets/match_cards.dart';
import 'package:torneo_app/widgets/match_poster.dart';
import 'package:torneo_app/widgets/poster_background.dart';
import 'package:torneo_app/widgets/stats_tables.dart';

// Pruebas de componentes con datos en memoria: sin red ni Supabase.
// (MainShell no se prueba aquí: depende del `session` global, que necesita
// Supabase.initialize.)

const phone = Size(390, 844);
const desktop = Size(1280, 800);

Future<void> pumpAt(WidgetTester tester, Size size, Widget child) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(
    theme: AppTheme.dark(),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  ));
}

MatchModel match({
  String id = 'm1',
  String status = 'scheduled',
  int? home,
  int? away,
  int round = 1,
  String homeId = 'a',
  String awayId = 'b',
  String homeName = 'Deportivo Limón de la Colonia Centro',
  String awayName = 'Atlético San Miguel',
}) =>
    MatchModel.fromJson({
      'id': id,
      'home_team_id': homeId,
      'away_team_id': awayId,
      'status': status,
      'home_score': home,
      'away_score': away,
      'round_number': round,
      'start_time': '2026-10-25T21:00:00Z',
      'home_team': {'name': homeName, 'shield_url': null},
      'away_team': {'name': awayName, 'shield_url': null},
    });

TeamStanding standing(String id, String name, int pts,
        {int gf = 10, int ga = 5}) =>
    TeamStanding(
      id: id,
      name: name,
      played: 10,
      won: 5,
      drawn: 2,
      lost: 3,
      gf: gf,
      ga: ga,
      matchPoints: pts,
      sanctionPoints: 0,
    );

void main() {
  setUpAll(() async {
    await initializeDateFormatting('es');
    // Fuente real de la app para medir como en producción (la de pruebas
    // por defecto tiene glifos cuadrados más anchos).
    final lexend = FontLoader('Lexend')
      ..addFont(rootBundle.load('assets/fonts/Lexend.ttf'));
    await lexend.load();
  });

  group('StandingsTable', () {
    final rows = [
      for (var i = 0; i < 10; i++)
        standing('t$i', 'Equipo con nombre muy largo número $i', 30 - i,
            gf: 20 - i, ga: 5 + i),
    ];

    testWidgets('en escritorio muestra GF y GC', (tester) async {
      await pumpAt(tester, desktop, StandingsTable(standings: rows));
      expect(tester.takeException(), isNull);
      expect(find.text('GF'), findsOneWidget);
      expect(find.text('GC'), findsOneWidget);
      expect(find.text('PTS'), findsOneWidget);
      expect(find.text('+15'), findsOneWidget); // DIF del primero (20-5)
    });

    testWidgets('en celular conserva GF/GC y cabe completa', (tester) async {
      await pumpAt(tester, phone, StandingsTable(standings: rows));
      expect(tester.takeException(), isNull);
      expect(find.text('GF'), findsOneWidget);
      expect(find.text('GC'), findsOneWidget);
      expect(find.text('DIF'), findsOneWidget);
      // A 390 px cabe completa, sin desplazamiento lateral.
      expect(
          find.descendant(
              of: find.byType(StandingsTable),
              matching: find.byType(SingleChildScrollView)),
          findsNothing);
    });
  });

  group('Tarjetas de partido', () {
    for (final size in [phone, desktop]) {
      testWidgets('UpcomingMatchTile muestra VS y responde al tap ($size)',
          (tester) async {
        var taps = 0;
        await pumpAt(tester, size,
            UpcomingMatchTile(match: match(), onTap: () => taps++));
        expect(tester.takeException(), isNull);
        expect(find.text('VS'), findsOneWidget);
        expect(find.text('Atlético San Miguel'), findsOneWidget);
        await tester.tap(find.byType(UpcomingMatchTile));
        expect(taps, 1);
      });

      testWidgets('ResultTile muestra el marcador y responde al tap ($size)',
          (tester) async {
        var taps = 0;
        await pumpAt(
            tester,
            size,
            ResultTile(
                match: match(status: 'finished', home: 3, away: 1),
                caption: 'Liga MX',
                onTap: () => taps++));
        expect(tester.takeException(), isNull);
        expect(find.text('3'), findsOneWidget);
        expect(find.text('1'), findsOneWidget);
        expect(find.text('Liga MX'), findsOneWidget);
        await tester.tap(find.byType(ResultTile));
        expect(taps, 1);
      });

      testWidgets('LiveMatchCard muestra marcador, EN VIVO y goles ($size)',
          (tester) async {
        var taps = 0;
        final events = [
          MatchEvent.fromJson({
            'id': 'e1',
            'match_id': 'm1',
            'team_id': 'a',
            'event_type': 'goal',
            'minute': 12,
            'player': {'name': 'Juan Pérez'},
          }),
          MatchEvent.fromJson({
            'id': 'e2',
            'match_id': 'm1',
            'team_id': 'b',
            'event_type': 'yellow_card',
            'minute': 30,
            'player': {'name': 'Luis'},
          }),
        ];
        // Estado 'break' para que el cronómetro no deje un Timer activo.
        await pumpAt(
            tester,
            size,
            LiveMatchCard(
                match: match(status: 'break', home: 1, away: 0),
                events: events,
                leagueName: 'Liga MX',
                onTap: () => taps++));
        expect(tester.takeException(), isNull);
        expect(find.text('1 - 0'), findsOneWidget);
        expect(find.text('ENTRETIEMPO'), findsOneWidget);
        expect(find.textContaining('Juan Pérez'), findsOneWidget);
        expect(find.byType(CardDots), findsNWidgets(2));
        await tester.tap(find.text('1 - 0'));
        expect(taps, 1);
      });
    }

    testWidgets('doble default se muestra como P - P', (tester) async {
      await pumpAt(
          tester,
          phone,
          LiveMatchCard(
              match: match(status: 'break', home: -1, away: -1),
              events: const []));
      expect(find.text('P - P'), findsOneWidget);
    });
  });

  group('LiguillaBracket', () {
    final q = [
      for (var i = 0; i < 8; i++)
        RankedTeam(standing('t$i', 'Equipo ${i + 1}', 30 - i), i + 1),
    ];
    MatchModel po(String id, int a, int b, int round,
            {String status = 'scheduled', int? hs, int? as}) =>
        match(
            id: id,
            homeId: 't$a',
            awayId: 't$b',
            round: round,
            status: status,
            home: hs,
            away: as);
    final data = LiguillaData(
      qualified: q,
      qf: [
        po('qf1', 0, 7, 100, status: 'finished', hs: 2, as: 0),
        po('qf2', 1, 6, 100, status: 'finished', hs: 1, as: 1),
        po('qf3', 2, 5, 100),
        po('qf4', 3, 4, 100),
      ],
      sf: [po('sf1', 0, 3, 101)],
      finalMatch: null,
    );

    for (final size in [phone, desktop]) {
      testWidgets('dibuja las tres rondas sin desbordar ($size)',
          (tester) async {
        MatchModel? tapped;
        await pumpAt(
            tester,
            size,
            LiguillaBracket(
                data: data, canEdit: true, onMatchTap: (m) => tapped = m));
        expect(tester.takeException(), isNull);
        expect(find.text('CUARTOS DE FINAL'), findsOneWidget);
        expect(find.text('SEMIFINALES'), findsOneWidget);
        expect(find.text('GRAN FINAL'), findsOneWidget);
        expect(find.text('Próximamente'), findsOneWidget); // sin final
        expect(find.text('#1'), findsNWidgets(2)); // en cuartos y semis
        await tester.tap(find.text('Equipo 3'));
        expect(tapped?.id, 'qf3');
      });
    }

    testWidgets('sin cruces muestra "Pendiente"', (tester) async {
      await pumpAt(
          tester,
          phone,
          LiguillaBracket(
              data: LiguillaData(
                  qualified: q, qf: const [], sf: const [], finalMatch: null)));
      expect(find.text('Pendiente'), findsOneWidget);
      expect(find.text('Próximamente'), findsNWidgets(2));
    });
  });

  group('Componentes comunes', () {
    testWidgets('TeamShield sin url muestra iniciales o ícono', (tester) async {
      await pumpAt(
          tester,
          phone,
          const Row(children: [
            TeamShield(name: 'Pumas'),
            TeamShield(url: '', name: 'Al'),
            TeamShield(),
            Avatar(),
          ]));
      expect(tester.takeException(), isNull);
      expect(find.text('PUM'), findsOneWidget);
      expect(find.text('AL'), findsOneWidget);
      expect(find.byIcon(Icons.shield), findsOneWidget);
      expect(find.byIcon(Icons.person), findsOneWidget);
    });

    testWidgets('CardDots dibuja una marca por tarjeta y LiveBadge su texto',
        (tester) async {
      await pumpAt(
          tester,
          phone,
          const Column(children: [
            CardDots(yellow: 2, red: 1),
            LiveBadge(),
            LiveBadge(label: 'ENTRETIEMPO'),
          ]));
      final dots = find.descendant(
          of: find.byType(CardDots), matching: find.byType(Container));
      expect(dots, findsNWidgets(3));
      expect(find.text('EN VIVO'), findsOneWidget);
      expect(find.text('ENTRETIEMPO'), findsOneWidget);
    });

    testWidgets('LeagueDropdown cambia de liga y marca las seguidas',
        (tester) async {
      String? selected;
      await pumpAt(
          tester,
          phone,
          LeagueDropdown(
            leagues: [
              League(id: 'l1', name: 'Liga premier la Lima'),
              League(id: 'l2', name: 'LIGA MX'),
            ],
            selectedId: 'l1',
            followedIds: const {'l2'},
            onChanged: (id) => selected = id,
          ));
      expect(find.text('Liga premier la Lima'), findsOneWidget);
      await tester.tap(find.text('Liga premier la Lima'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('LIGA MX ★').last);
      await tester.pumpAndSettle();
      expect(selected, 'l2');
    });

    testWidgets('LeagueDropdown vacío no dibuja nada', (tester) async {
      await pumpAt(
          tester,
          phone,
          LeagueDropdown(
              leagues: const [], selectedId: null, onChanged: (_) {}));
      expect(find.byType(DropdownButton<String>), findsNothing);
    });

    testWidgets('SimpleDropdown selecciona un valor', (tester) async {
      String? value;
      await pumpAt(
          tester,
          phone,
          SimpleDropdown<String>(
            value: null,
            hint: 'Elige equipo',
            items: const [('a', 'Pumas'), ('b', 'Halcones')],
            onChanged: (v) => value = v,
          ));
      expect(find.text('Elige equipo'), findsOneWidget);
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Halcones').last);
      await tester.pumpAndSettle();
      expect(value, 'b');
    });
  });

  group('MatchPoster', () {
    PosterData data(MatchModel m) => PosterData(
          match: m,
          leagueName: 'Liga premier la Lima 3ra edición',
          events: const [],
          homePosition: 1,
          awayPosition: 14,
          homeForm: const [
            FormResult.win,
            FormResult.draw,
            FormResult.loss,
            FormResult.win,
            FormResult.win
          ],
          awayForm: const [FormResult.loss, FormResult.loss],
        );

    testWidgets('previa con nombres muy largos no desborda', (tester) async {
      await pumpAt(
          tester,
          phone,
          Center(
            child: MatchPoster(
              data: data(match(
                  homeName: 'Club Deportivo Real Sociedad de la Colonia',
                  awayName: 'Atlético Independiente Unidos FC 2026')),
              kind: PosterKind.preview,
            ),
          ));
      expect(tester.takeException(), isNull);
    });

    for (final style
        in PosterBgStyle.values.where((s) => s != PosterBgStyle.photo)) {
      testWidgets('previa con fondo ${style.name} no desborda', (tester) async {
        await pumpAt(
            tester,
            phone,
            Center(
              child: MatchPoster(
                data: data(match()),
                kind: PosterKind.preview,
                background: PosterBackground(style: style),
              ),
            ));
        expect(tester.takeException(), isNull);
        expect(find.byType(MatchPoster), findsOneWidget);
      });

      testWidgets('resultado con fondo ${style.name} no desborda',
          (tester) async {
        await pumpAt(
            tester,
            desktop,
            Center(
              child: MatchPoster(
                data: data(match(status: 'finished', home: 4, away: 4)),
                kind: PosterKind.result,
                background: PosterBackground(style: style),
              ),
            ));
        expect(tester.takeException(), isNull);
        expect(find.text('4 - 4'), findsOneWidget);
      });
    }
  });
}
