import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../config/env.dart';
import '../core/ui_helpers.dart';
import '../logic/standings.dart';
import '../logic/stats.dart';
import '../models/models.dart';
import 'common.dart';

/// Diseños de las imágenes exportadas (tabla general, goleo, tarjetas y
/// jornada). Reproducen el diseño de la app anterior: se dibujan siempre al
/// mismo ancho de escritorio, sin importar el dispositivo.

const _bg = Color(0xFF0A101E);
const _blue = Color(0xFF60A5FA);
const _muted = Color(0xFF94A3B8);
const _dim = Color(0xFF64748B);
const _light = Color(0xFFCBD5E1);
final _line = Colors.white.withValues(alpha: 0.05);
final _box = Colors.white.withValues(alpha: 0.10);
final _boxBorder = Colors.white.withValues(alpha: 0.20);

/// Dominio que aparece al pie de las imágenes.
String exportHost() {
  final uri = kIsWeb ? Uri.base : Uri.parse(Env.publicBaseUrl);
  return uri.host.isEmpty ? Env.publicBaseUrl : uri.host;
}

/// Marco oscuro con brillos, encabezado centrado y pie "Resultados
/// Oficiales".
class ExportFrame extends StatelessWidget {
  const ExportFrame({
    super.key,
    required this.title,
    required this.highlight,
    required this.subtitle,
    required this.child,
    this.subtitleIcon = Icons.emoji_events,
  });

  final String title;
  final String highlight;
  final String subtitle;
  final IconData subtitleIcon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: Stack(children: [
        Positioned.fill(child: Container(color: _bg)),
        // Brillos de fondo (azul arriba a la derecha, verde abajo a la
        // izquierda), como en la versión anterior.
        Positioned(
          top: -300,
          right: -300,
          child: _Glow(const Color(0xFF2563EB).withValues(alpha: 0.18), 800),
        ),
        Positioned(
          bottom: -300,
          left: -300,
          child: _Glow(const Color(0xFF10B981).withValues(alpha: 0.10), 700),
        ),
        Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.fromLTRB(24, 36, 24, 32),
            decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: _line, width: 1))),
            child: Column(children: [
              Text('LIGA PREMIER ${DateTime.now().year}',
                  style: const TextStyle(
                      color: _blue,
                      fontSize: 20,
                      letterSpacing: 10,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: '${title.toUpperCase()} '),
                    TextSpan(
                        text: highlight.toUpperCase(),
                        style: const TextStyle(color: _blue)),
                  ]),
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 72,
                      height: 1,
                      letterSpacing: -2,
                      fontStyle: FontStyle.italic,
                      fontWeight: FontWeight.w900),
                ),
              ),
              const SizedBox(height: 18),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: _boxBorder),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(subtitleIcon, size: 24, color: _light),
                  const SizedBox(width: 12),
                  Flexible(
                    child: Text(subtitle.toUpperCase(),
                        style: const TextStyle(
                            color: _light,
                            fontSize: 20,
                            letterSpacing: 2,
                            fontWeight: FontWeight.bold)),
                  ),
                ]),
              ),
            ]),
          ),
          const SizedBox(height: 32),
          Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: child),
          const SizedBox(height: 40),
          Container(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
            decoration: BoxDecoration(
                border: Border(top: BorderSide(color: _line, width: 1))),
            child: Opacity(
              opacity: 0.6,
              child: Row(children: [
                const Icon(Icons.verified, size: 20, color: Color(0xFF3B82F6)),
                const SizedBox(width: 8),
                const Text('RESULTADOS OFICIALES', style: _footStyle),
                const Spacer(),
                Text(exportHost().toUpperCase(), style: _footStyle),
              ]),
            ),
          ),
        ]),
      ]),
    );
  }
}

const _footStyle = TextStyle(
    color: _muted, fontSize: 14, letterSpacing: 4, fontWeight: FontWeight.bold);

class _Glow extends StatelessWidget {
  const _Glow(this.color, this.size);
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
        ),
      );
}

Widget _circleImage(String? url, double size, IconData fallback,
    {bool cover = false}) {
  return Container(
    width: size,
    height: size,
    padding: const EdgeInsets.all(2),
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: _box,
      border: Border.all(color: _boxBorder, width: 2),
    ),
    child: ClipOval(
      child: url == null || url.isEmpty
          ? Icon(fallback, color: _dim, size: size * 0.5)
          : NetImage(url, fit: cover ? BoxFit.cover : BoxFit.contain),
    ),
  );
}

const _thStyle = TextStyle(
    color: _muted, fontSize: 11, letterSpacing: 3, fontWeight: FontWeight.bold);

Widget _th(String t, double w, {Color color = _muted}) => SizedBox(
    width: w,
    child: Text(t,
        textAlign: TextAlign.center, style: _thStyle.copyWith(color: color)));

Widget _td(String t, double w,
        {Color color = _muted,
        double size = 18,
        FontWeight weight = FontWeight.w500}) =>
    SizedBox(
        width: w,
        child: Text(t,
            textAlign: TextAlign.center,
            style:
                TextStyle(color: color, fontSize: size, fontWeight: weight)));

/// Tabla general exportada.
class ExportStandings extends StatelessWidget {
  const ExportStandings({super.key, required this.standings});
  final List<TeamStanding> standings;

  @override
  Widget build(BuildContext context) {
    const w = 48.0;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Row(children: [
          _th('#', 48),
          const Expanded(
              child: Padding(
                  padding: EdgeInsets.only(left: 8),
                  child: Text('EQUIPO', style: _thStyle))),
          _th('PJ', w),
          _th('G', w),
          _th('E', w),
          _th('P', w),
          _th('GF', w),
          _th('GC', w),
          _th('DG', 56),
          _th('PTS', 72, color: Colors.white),
        ]),
      ),
      Container(height: 1, color: Colors.white.withValues(alpha: 0.10)),
      for (var i = 0; i < standings.length; i++)
        Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: i < 8
                ? const Color(0xFF3B82F6).withValues(alpha: 0.08)
                : Colors.transparent,
            border: Border(
              bottom: i == 7
                  ? BorderSide(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.5),
                      width: 3)
                  : BorderSide(color: _line, width: 1),
            ),
          ),
          child: Row(children: [
            _td('${i + 1}', 48,
                color: i < 8 ? _blue : _dim, weight: FontWeight.w900),
            Expanded(
              child: Row(children: [
                _circleImage(standings[i].shieldUrl, 56, Icons.shield),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(standings[i].name.toUpperCase(),
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          letterSpacing: -0.5,
                          fontWeight: FontWeight.bold)),
                ),
              ]),
            ),
            _td('${standings[i].played}', w,
                color: _light, weight: FontWeight.bold),
            _td('${standings[i].won}', w),
            _td('${standings[i].drawn}', w),
            _td('${standings[i].lost}', w),
            _td('${standings[i].gf}', w, color: _dim, size: 16),
            _td('${standings[i].ga}', w, color: _dim, size: 16),
            _td(
              standings[i].gd > 0
                  ? '+${standings[i].gd}'
                  : '${standings[i].gd}',
              56,
              weight: FontWeight.bold,
              color: standings[i].gd > 0
                  ? const Color(0xFF34D399)
                  : standings[i].gd < 0
                      ? const Color(0xFFF87171)
                      : _light,
            ),
            SizedBox(
              width: 72,
              child: Center(
                child: Container(
                  width: 64,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _box,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: _boxBorder),
                  ),
                  child: Text('${standings[i].points}',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          height: 1,
                          fontWeight: FontWeight.w900)),
                ),
              ),
            ),
          ]),
        ),
    ]);
  }
}

Widget _playerCell(PlayerStat s) => Row(children: [
      _circleImage(s.photoUrl, 56, Icons.person, cover: true),
      const SizedBox(width: 16),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s.name.toUpperCase(),
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  letterSpacing: -0.5,
                  fontWeight: FontWeight.bold)),
          Row(children: [
            if (s.teamShield != null) ...[
              SizedBox(width: 16, height: 16, child: NetImage(s.teamShield!)),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: Text(s.teamName.toUpperCase(),
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      color: _muted,
                      fontSize: 14,
                      letterSpacing: 2,
                      fontWeight: FontWeight.bold)),
            ),
          ]),
        ]),
      ),
    ]);

Widget _rank(int i) => SizedBox(
    width: 64,
    child: Text('${i + 1}',
        textAlign: TextAlign.center,
        style: TextStyle(
            color: i < 3 ? const Color(0xFFFBBF24) : _muted,
            fontSize: 24,
            fontWeight: FontWeight.bold)));

/// Tabla de goleo exportada.
class ExportScorers extends StatelessWidget {
  const ExportScorers({super.key, required this.scorers, this.limit = 5});
  final List<PlayerStat> scorers;
  final int limit;

  @override
  Widget build(BuildContext context) {
    final list = scorers.take(limit).toList();
    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Row(children: [
          _th('#', 64),
          const Expanded(child: Text('JUGADOR', style: _thStyle)),
          _th('GOLES', 128, color: Colors.white),
        ]),
      ),
      Container(height: 1, color: Colors.white.withValues(alpha: 0.10)),
      for (var i = 0; i < list.length; i++)
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration:
              BoxDecoration(border: Border(bottom: BorderSide(color: _line))),
          child: Row(children: [
            _rank(i),
            Expanded(child: _playerCell(list[i])),
            SizedBox(
              width: 128,
              child: Center(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  decoration: BoxDecoration(
                    color: _box,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: _boxBorder),
                  ),
                  child: Text('${list[i].goals}',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w900)),
                ),
              ),
            ),
          ]),
        ),
    ]);
  }
}

/// Tabla de tarjetas exportada.
class ExportCards extends StatelessWidget {
  const ExportCards({super.key, required this.stats});
  final List<PlayerStat> stats;

  @override
  Widget build(BuildContext context) {
    Widget card(Color c) => Container(
        width: 16,
        height: 16,
        decoration:
            BoxDecoration(color: c, borderRadius: BorderRadius.circular(3)));
    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Row(children: [
          _th('#', 64),
          const Expanded(child: Text('JUGADOR', style: _thStyle)),
          SizedBox(
              width: 80, child: Center(child: card(const Color(0xFFFACC15)))),
          SizedBox(
              width: 80, child: Center(child: card(const Color(0xFFEF4444)))),
        ]),
      ),
      Container(height: 1, color: Colors.white.withValues(alpha: 0.10)),
      for (var i = 0; i < stats.length; i++)
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration:
              BoxDecoration(border: Border(bottom: BorderSide(color: _line))),
          child: Row(children: [
            _rank(i),
            Expanded(child: _playerCell(stats[i])),
            _td('${stats[i].yellowCards}', 80,
                color: const Color(0xFFFACC15),
                size: 20,
                weight: FontWeight.w900),
            _td('${stats[i].redCards}', 80,
                color: const Color(0xFFF87171),
                size: 20,
                weight: FontWeight.w900),
          ]),
        ),
    ]);
  }
}

/// Fila de partido para la jornada exportada.
class ExportMatchRow extends StatelessWidget {
  const ExportMatchRow(this.m, {super.key});
  final MatchModel m;

  @override
  Widget build(BuildContext context) {
    const name = TextStyle(
        color: Colors.white,
        fontSize: 28,
        height: 1.1,
        fontWeight: FontWeight.w900);
    Widget score(int? v) => Text(
          v == -1 ? 'P' : scoreText(v),
          style: TextStyle(
              color: v == -1 ? const Color(0xFFEF4444) : Colors.white,
              fontSize: 36,
              height: 1,
              letterSpacing: -1,
              fontWeight: FontWeight.w900),
        );
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(16),
      constraints: const BoxConstraints(minHeight: 120),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
      ),
      child: Row(children: [
        Container(
          width: 96,
          margin: const EdgeInsets.only(right: 16),
          padding: const EdgeInsets.only(right: 16),
          decoration: BoxDecoration(
              border: Border(right: BorderSide(color: _boxBorder))),
          child: m.isFinished
              ? const Text('FINAL',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: _muted, fontSize: 18, fontWeight: FontWeight.w900))
              : Text(formatTime(m.startTime),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 30,
                      height: 1,
                      fontWeight: FontWeight.w900)),
        ),
        Expanded(
          child: Text((m.homeTeam?.name ?? '').toUpperCase(),
              textAlign: TextAlign.end, maxLines: 2, style: name),
        ),
        const SizedBox(width: 12),
        _circleImage(m.homeTeam?.shieldUrl, 96, Icons.shield),
        SizedBox(
          width: 150,
          child: Center(
            child: m.isScheduled
                ? const Text('VS',
                    style: TextStyle(
                        color: Color(0xFF475569),
                        fontSize: 24,
                        fontStyle: FontStyle.italic,
                        fontWeight: FontWeight.w900))
                : Container(
                    height: 64,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF020617).withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: _boxBorder),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      score(m.homeScore),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text('-',
                            style: TextStyle(
                                color: Colors.white30,
                                fontSize: 24,
                                fontWeight: FontWeight.w900)),
                      ),
                      score(m.awayScore),
                    ]),
                  ),
          ),
        ),
        _circleImage(m.awayTeam?.shieldUrl, 96, Icons.shield),
        const SizedBox(width: 12),
        Expanded(
          child: Text((m.awayTeam?.name ?? '').toUpperCase(),
              maxLines: 2, style: name),
        ),
      ]),
    );
  }
}
