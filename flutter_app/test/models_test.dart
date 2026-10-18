import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:torneo_app/core/supabase.dart';
import 'package:torneo_app/core/ui_helpers.dart';
import 'package:torneo_app/models/models.dart';

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  group('embedded', () {
    test('objeto, lista y null', () {
      expect(embedded(null), isNull);
      expect(embedded(const []), isNull);
      expect(embedded({'name': 'A'})!['name'], 'A');
      expect(
          embedded([
            {'name': 'B'},
            {'name': 'C'}
          ])!['name'],
          'B');
    });
  });

  group('League', () {
    test('fromJson con todos los campos', () {
      final l = League.fromJson({
        'id': 'l1',
        'name': 'Liga',
        'owner_id': 'u1',
        'format': 7,
        'max_teams': '14',
        'max_players_per_team': 20.0,
        'match_duration': 90,
        'status': 'active',
        'is_active': true,
        'settings': {'x': 1},
        'created_at': '2026-01-01T10:00:00Z',
      });
      expect(l.format, '7');
      expect(l.maxTeams, 14);
      expect(l.maxPlayersPerTeam, 20);
      expect(l.matchDuration, 90);
      expect(l.status, 'active');
      expect(l.settings['x'], 1);
      expect(l.createdAt, DateTime.utc(2026, 1, 1, 10));
    });

    test('valores faltantes: nombre vacío, activa por defecto', () {
      final l = League.fromJson({'id': 'l1', 'name': null, 'is_active': null});
      expect(l.name, '');
      expect(l.isActive, isTrue);
      expect(l.settings, isEmpty);
      expect(l.createdAt, isNull);
      expect(
          League.fromJson({'id': 'l', 'is_active': false}).isActive, isFalse);
    });

    test('copyWith solo cambia isActive', () {
      final l = League.fromJson({'id': 'l1', 'name': 'Liga', 'status': 'x'});
      final c = l.copyWith(isActive: false);
      expect((c.id, c.name, c.status, c.isActive), ('l1', 'Liga', 'x', false));
    });
  });

  group('Team / Player / TeamRef', () {
    test('Team.fromJson', () {
      final t = Team.fromJson({
        'id': 't1',
        'name': 'Pumas',
        'league_id': 'l1',
        'home_kit_color': '#FF0000',
      });
      expect((t.id, t.name, t.leagueId, t.homeKitColor),
          ('t1', 'Pumas', 'l1', '#FF0000'));
      expect(t.awayKitColor, isNull);
    });

    test('Player.fromJson con equipo embebido como lista', () {
      final p = Player.fromJson({
        'id': 'p1',
        'name': 'Juan',
        'number': '10',
        'teams': [
          {'name': 'Pumas'}
        ],
      });
      expect((p.number, p.teamName), (10, 'Pumas'));
      expect(Player.fromJson({'id': 'p2'}).teamName, isNull);
    });

    test('TeamRef.fromJson null', () {
      expect(TeamRef.fromJson(null), isNull);
      expect(
          TeamRef.fromJson({'name': 'A', 'shield_url': 'u'})!.shieldUrl, 'u');
    });
  });

  group('MatchModel', () {
    Map<String, dynamic> json() => {
          'id': 'm1',
          'home_team_id': 'h',
          'away_team_id': 'a',
          'league_id': 'l1',
          'start_time': '2026-10-18T21:00:00Z',
          'status': 'finished',
          'home_score': 2,
          'away_score': 1,
          'round_number': 15,
          'home_team': {'name': 'Pumas', 'shield_url': 'p.png'},
          'away_team': [
            {'name': 'Halcones'}
          ],
          'league': {'name': 'Liga MX'},
          'elapsed_seconds': 5400,
          'current_period': 2,
          'lineups': {'h': []},
        };

    test('fromJson con equipos embebidos', () {
      final m = MatchModel.fromJson(json());
      expect(m.homeTeam!.name, 'Pumas');
      expect(m.awayTeam!.name, 'Halcones');
      expect(m.leagueName, 'Liga MX');
      expect(m.startTime!.toUtc(), DateTime.utc(2026, 10, 18, 21));
      expect(m.startTime!.isUtc, isFalse);
      expect((m.roundNumber, m.currentPeriod, m.elapsedSeconds), (15, 2, 5400));
      expect(m.lineups, isNotNull);
      expect(m.isFinished, isTrue);
      expect(m.isLive, isFalse);
    });

    test('valores por defecto', () {
      final m = MatchModel.fromJson(
          {'id': 'm', 'home_team_id': 'h', 'away_team_id': 'a'});
      expect(m.status, 'scheduled');
      expect(m.isScheduled, isTrue);
      expect((m.elapsedSeconds, m.currentPeriod), (0, 1));
      expect(m.startTime, isNull);
      expect(m.homeTeam, isNull);
      expect(m.leagueName, isNull);
      expect(m.lineups, isNull);
    });

    test('estados', () {
      MatchModel s(String st, [int? h, int? a]) => MatchModel(
          id: 'm',
          homeTeamId: 'h',
          awayTeamId: 'a',
          status: st,
          homeScore: h,
          awayScore: a);
      expect(s('live').isLive, isTrue);
      expect(s('break').isLive, isTrue);
      expect(s('postponed').isLive, isFalse);
      expect(s('postponed').isScheduled, isFalse);
      expect(s('finished', -1, -1).isDoubleDefault, isTrue);
      expect(s('finished', -1, 3).isDoubleDefault, isFalse);
    });

    test('toJson y fromJson ida y vuelta', () {
      final m = MatchModel.fromJson(json());
      final back = MatchModel.fromJson(m.toJson());
      expect(back.toJson(), m.toJson());
      expect(m.toJson()['start_time'], '2026-10-18T21:00:00.000Z');
    });

    test('merge aplica cambios parciales y conserva el resto', () {
      final m = MatchModel.fromJson(json());
      final u = m.merge({'status': 'live', 'home_score': 3});
      expect((u.status, u.homeScore, u.awayScore), ('live', 3, 1));
      expect(u.homeTeam!.name, 'Pumas');
      expect(u.leagueName, 'Liga MX');
      expect(u.startTime, m.startTime);
    });

    test('currentSeconds con reloj corriendo y pausado', () {
      final start = DateTime.utc(2026, 1, 1, 12);
      final live = MatchModel(
          id: 'm',
          homeTeamId: 'h',
          awayTeamId: 'a',
          status: 'live',
          elapsedSeconds: 600,
          lastStartTime: start);
      expect(live.currentSeconds(start.add(const Duration(seconds: 90))), 690);
      // Reloj del dispositivo atrasado: nunca negativo.
      final early = MatchModel(
          id: 'm',
          homeTeamId: 'h',
          awayTeamId: 'a',
          status: 'live',
          lastStartTime: start);
      expect(
          early.currentSeconds(start.subtract(const Duration(minutes: 5))), 0);
      // En entretiempo el reloj está detenido.
      final paused = MatchModel(
          id: 'm',
          homeTeamId: 'h',
          awayTeamId: 'a',
          status: 'break',
          elapsedSeconds: 2700,
          lastStartTime: start);
      expect(paused.currentSeconds(start.add(const Duration(hours: 1))), 2700);
    });
  });

  group('MatchEvent / Profile / TeamSanction', () {
    test('MatchEvent con jugadores embebidos', () {
      final e = MatchEvent.fromJson({
        'id': 'e1',
        'match_id': 'm1',
        'event_type': 'substitution',
        'minute': '67',
        'player': {'name': 'Sale', 'number': 9},
        'player_in': [
          {'name': 'Entra', 'number': '14'}
        ],
        'created_at': '2026-01-01T00:00:00Z',
      });
      expect((e.minute, e.playerName, e.playerNumber), (67, 'Sale', 9));
      expect((e.playerInName, e.playerInNumber), ('Entra', 14));
      expect(e.label, 'Cambio');
    });

    test('MatchEvent sin jugador y etiquetas', () {
      MatchEvent ev(String t) =>
          MatchEvent.fromJson({'id': 'e', 'match_id': 'm', 'event_type': t});
      expect(ev('goal').playerName, isNull);
      expect(ev('goal').label, '¡GOL!');
      expect(ev('yellow_card').label, 'Tarjeta Amarilla');
      expect(ev('red_card').label, 'Tarjeta Roja');
      expect(ev('otro').label, 'otro');
    });

    test('Profile.displayName', () {
      expect(
          Profile.fromJson({'id': 'u', 'full_name': 'Ana'}).displayName, 'Ana');
      expect(
          Profile.fromJson({'id': 'u', 'full_name': '  ', 'email': 'a@b.c'})
              .displayName,
          'a@b.c');
      expect(Profile.fromJson({'id': 'u'}).displayName, 'Usuario');
    });

    test('TeamSanction con creador y equipo', () {
      final s = TeamSanction.fromJson({
        'id': 's1',
        'league_id': 'l1',
        'team_id': 't1',
        'points_delta': -3,
        'reason': 'Alineación indebida',
        'team': {'name': 'Pumas', 'shield_url': 'p.png'},
        'creator': {'full_name': '', 'email': 'admin@x.com'},
      });
      expect((s.pointsDelta, s.teamName, s.teamShield), (-3, 'Pumas', 'p.png'));
      expect(s.creatorName, 'admin@x.com');
      final s2 =
          TeamSanction.fromJson({'id': 's', 'league_id': 'l', 'team_id': 't'});
      expect((s2.pointsDelta, s2.reason, s2.creatorName), (0, '', null));
    });
  });

  group('ui_helpers', () {
    test('statusLabel y leagueStatusLabel', () {
      expect(statusLabel('scheduled'), 'Programado');
      expect(statusLabel('live'), 'En Vivo');
      expect(statusLabel('break'), 'Entretiempo');
      expect(statusLabel('finished'), 'Finalizado');
      expect(statusLabel('postponed'), 'Pospuesto');
      expect(statusLabel('raro'), 'raro');
      expect(leagueStatusLabel('upcoming'), 'Próxima');
      expect(leagueStatusLabel('active'), 'En curso');
      expect(leagueStatusLabel('finished'), 'Finalizada');
      expect(leagueStatusLabel(null), '');
    });

    test('dorsal, scoreText y formatSeconds', () {
      expect(dorsal(null), '#');
      expect(dorsal(0), '#');
      expect(dorsal(7), '7');
      expect(scoreText(-1), 'P');
      expect(scoreText(null), '0');
      expect(scoreText(4), '4');
      expect(formatSeconds(0), '00:00');
      expect(formatSeconds(5400), '90:00');
      expect(formatSeconds(61), '01:01');
    });

    test('parseHexColor y toHexColor', () {
      expect(parseHexColor('#FF0000'), const Color(0xFFFF0000));
      expect(parseHexColor('FF0000'), isNull);
      expect(parseHexColor('#FFF'), isNull);
      expect(parseHexColor(null), isNull);
      expect(toHexColor(const Color(0xFF1E90FF)), '#1e90ff');
      expect(parseHexColor(toHexColor(const Color(0xFF00AA11))),
          const Color(0xFF00AA11));
    });

    test('formatos de fecha en español', () {
      final d = DateTime(2026, 10, 18, 9, 5);
      expect(formatTime(d), '09:05');
      expect(formatTime(null), '--:--');
      expect(formatDateLong(d), 'domingo 18 de octubre');
      expect(formatDateShort(d), startsWith('dom 18'));
      expect(formatDateMedium(d), contains('2026'));
      expect(formatDateTimeShort(d), endsWith('09:05'));
      expect(formatDateLong(null), '');
      expect(formatDateShort(null), '');
    });

    test('formatDateRelative: hoy, mañana y otra fecha', () {
      final now = DateTime.now();
      expect(formatDateRelative(now), 'Hoy');
      expect(formatDateRelative(DateTime(now.year, now.month, now.day + 1, 20)),
          'Mañana');
      final far = DateTime(now.year, now.month, now.day + 10);
      expect(formatDateRelative(far), formatDateShort(far));
      expect(formatDateRelative(null), '');
    });

    test('errorMessage extrae el mensaje de PostgREST', () {
      expect(
          errorMessage(Exception(
              'PostgrestException(message: permiso denegado, code: 42501)')),
          'permiso denegado');
      expect(errorMessage('otro error'), 'otro error');
    });
  });
}
