import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/poster_repo.dart';
import '../core/ui_helpers.dart';
import '../logic/form.dart';
import '../models/models.dart';
import 'common.dart';

enum PosterKind { preview, result }

/// Póster 4:5 (360x450 lógicos → 1080x1350 al exportar con pixelRatio 3).
/// Colores fijos (no del tema) para que la imagen sea igual en cualquier app.
class MatchPoster extends StatelessWidget {
  const MatchPoster({super.key, required this.data, required this.kind});

  final PosterData data;
  final PosterKind kind;

  static const width = 360.0;
  static const height = 450.0;

  static const _bg = Color(0xFF0B1220);
  static const _accent = Color(0xFF60A5FA);
  static const _muted = Color(0xFF94A3B8);

  MatchModel get m => data.match;

  Color _teamColor(String? hex, Color fallback) {
    final c = parseHexColor(hex);
    // Blanco/negro casi puros no lucen como resplandor; usa el de respaldo.
    if (c == null ||
        c.computeLuminance() > 0.85 ||
        c.computeLuminance() < 0.02) {
      return fallback;
    }
    return c;
  }

  bool _similar(Color a, Color b) =>
      (a.r - b.r).abs() + (a.g - b.g).abs() + (a.b - b.b).abs() < 0.35;

  String get _roundLabel => switch (m.roundNumber) {
        100 => 'CUARTOS DE FINAL',
        101 => 'SEMIFINAL',
        102 => 'GRAN FINAL',
        null => '',
        _ => 'JORNADA ${m.roundNumber}',
      };

  @override
  Widget build(BuildContext context) {
    final home = _teamColor(data.homeColor, const Color(0xFF2563EB));
    var away = _teamColor(data.awayColor, const Color(0xFFDC2626));
    // Si ambos equipos tienen el mismo color (p. ej. el rojo por defecto),
    // el visitante usa un tono contrastante para que el póster no sea plano.
    if (_similar(home, away)) {
      away = _similar(home, const Color(0xFF2563EB))
          ? const Color(0xFFF59E0B)
          : const Color(0xFF2563EB);
    }
    final isResult = kind == PosterKind.result;

    return SizedBox(
      width: width,
      height: height,
      child: DefaultTextStyle(
        style: const TextStyle(
            fontFamily: 'Lexend',
            color: Colors.white,
            decoration: TextDecoration.none),
        child: Stack(children: [
          const Positioned.fill(child: ColoredBox(color: _bg)),
          // Resplandores con los colores de cada equipo.
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(-1.1, -0.6),
                  radius: 1.1,
                  colors: [home.withValues(alpha: 0.55), Colors.transparent],
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(1.1, 0.7),
                  radius: 1.1,
                  colors: [away.withValues(alpha: 0.55), Colors.transparent],
                ),
              ),
            ),
          ),
          // Marca de agua.
          Positioned(
            right: -40,
            top: 120,
            child: Icon(Icons.sports_soccer,
                size: 220, color: Colors.white.withValues(alpha: 0.04)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _header(),
                  const SizedBox(height: 6),
                  Text(
                    isResult ? 'RESULTADO FINAL' : 'DÍA DE PARTIDO',
                    style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1,
                        height: 1.1),
                  ),
                  const SizedBox(height: 18),
                  _teams(home, away, isResult),
                  const SizedBox(height: 14),
                  Expanded(
                      child: isResult ? _resultDetails() : _previewDetails()),
                  _footer(),
                ]),
          ),
        ]),
      ),
    );
  }

  Widget _header() => Row(children: [
        Expanded(
          child: Text(
            data.leagueName.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
                fontSize: 10,
                letterSpacing: 1.5,
                fontWeight: FontWeight.bold,
                color: _accent),
          ),
        ),
        if (_roundLabel.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(_roundLabel,
                style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1)),
          ),
      ]);

  Widget _teams(Color home, Color away, bool isResult) {
    Widget team(TeamRef? t, Color ring, int? pos) => Expanded(
          child: Column(children: [
            Container(
              width: 92,
              height: 92,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.08),
                border: Border.all(color: ring, width: 3),
              ),
              child: ClipOval(
                child: (t?.shieldUrl != null && t!.shieldUrl!.isNotEmpty)
                    ? NetImage(t.shieldUrl!,
                        fit: BoxFit.contain, fallback: _initials(t.name))
                    : _initials(t?.name ?? ''),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 34,
              child: Text(
                (t?.name ?? '').toUpperCase(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w800, height: 1.2),
              ),
            ),
            if (pos != null)
              Text('$posº en la tabla',
                  style: const TextStyle(fontSize: 9, color: _muted)),
          ]),
        );

    final center = isResult
        ? Column(children: [
            Text(
              m.isDoubleDefault
                  ? 'P - P'
                  : '${m.homeScore ?? 0} - ${m.awayScore ?? 0}',
              style: const TextStyle(
                  fontSize: 44, fontWeight: FontWeight.w900, height: 1),
            ),
            if (!m.isFinished)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text('EN JUEGO',
                    style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFF87171))),
              ),
          ])
        : const Text('VS',
            style: TextStyle(
                fontSize: 34,
                fontWeight: FontWeight.w900,
                fontStyle: FontStyle.italic,
                color: _accent));

    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      team(m.homeTeam, home, data.homePosition),
      SizedBox(width: 96, height: 92, child: Center(child: center)),
      team(m.awayTeam, away, data.awayPosition),
    ]);
  }

  Widget _initials(String name) => Center(
        child: Text(
          name.trim().isEmpty
              ? '?'
              : name
                  .trim()
                  .substring(
                      0, name.trim().length >= 3 ? 3 : name.trim().length)
                  .toUpperCase(),
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
        ),
      );

  Widget _previewDetails() {
    final d = m.startTime;
    final date = d == null
        ? 'FECHA POR CONFIRMAR'
        : DateFormat("EEEE d 'de' MMMM", 'es').format(d).toUpperCase();
    return Column(children: [
      Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
        ),
        child: Column(children: [
          Text(date,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1)),
          Text(d == null ? '--:--' : formatTime(d),
              style: const TextStyle(
                  fontSize: 30, fontWeight: FontWeight.w900, height: 1.2)),
          if (m.location != null && m.location!.trim().isNotEmpty)
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.location_on, size: 12, color: _muted),
              const SizedBox(width: 3),
              Flexible(
                child: Text(m.location!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 10, color: _muted)),
              ),
            ]),
        ]),
      ),
      const Spacer(),
      ..._formSection(),
    ]);
  }

  List<Widget> _formSection() {
    if (data.homeForm.isEmpty && data.awayForm.isEmpty) return const [];
    return [
      const Text('ÚLTIMOS 5 PARTIDOS',
          textAlign: TextAlign.center,
          style: TextStyle(
              fontSize: 9,
              letterSpacing: 1.5,
              fontWeight: FontWeight.bold,
              color: _muted)),
      const SizedBox(height: 6),
      Row(children: [
        Expanded(child: Center(child: _formRow(data.homeForm))),
        const SizedBox(width: 96),
        Expanded(child: Center(child: _formRow(data.awayForm))),
      ]),
      const Spacer(),
    ];
  }

  Widget _formRow(List<FormResult> form) {
    if (form.isEmpty) {
      return const Text('Sin partidos',
          style: TextStyle(fontSize: 9, color: _muted));
    }
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (final r in form)
        Container(
          width: 18,
          height: 18,
          margin: const EdgeInsets.symmetric(horizontal: 1.5),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: switch (r) {
              FormResult.win => const Color(0xFF16A34A),
              FormResult.draw => const Color(0xFF64748B),
              FormResult.loss => const Color(0xFFDC2626),
            },
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            switch (r) {
              FormResult.win => 'G',
              FormResult.draw => 'E',
              FormResult.loss => 'P',
            },
            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900),
          ),
        ),
    ]);
  }

  Widget _resultDetails() {
    // Eventos en orden cronológico.
    final events = [...data.events]
      ..sort((a, b) => (a.minute ?? 0).compareTo(b.minute ?? 0));
    List<MatchEvent> goals(String teamId) => events
        .where((e) => e.eventType == 'goal' && e.teamId == teamId)
        .toList();
    int cards(String teamId, String type) =>
        events.where((e) => e.eventType == type && e.teamId == teamId).length;

    Widget scorers(String teamId, CrossAxisAlignment align) {
      final g = goals(teamId);
      final shown = g.take(5).toList();
      return Column(crossAxisAlignment: align, children: [
        for (final e in shown)
          Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Text(
              "${e.playerName ?? 'Gol'} ${e.minute != null ? "${e.minute}'" : ''}",
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: align == CrossAxisAlignment.end
                  ? TextAlign.end
                  : TextAlign.start,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ),
        if (g.length > shown.length)
          Text('+${g.length - shown.length} más',
              style: const TextStyle(fontSize: 10, color: _muted)),
        const SizedBox(height: 4),
        Row(mainAxisSize: MainAxisSize.min, children: [
          for (final (type, color) in [
            ('yellow_card', const Color(0xFFFACC15)),
            ('red_card', const Color(0xFFEF4444)),
          ])
            if (cards(teamId, type) > 0) ...[
              Container(
                  width: 8,
                  height: 11,
                  decoration: BoxDecoration(
                      color: color, borderRadius: BorderRadius.circular(1.5))),
              const SizedBox(width: 3),
              Text('${cards(teamId, type)}',
                  style: const TextStyle(fontSize: 10)),
              const SizedBox(width: 8),
            ],
        ]),
      ]);
    }

    final hasGoals = events.any((e) => e.eventType == 'goal');
    final box = Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: m.isDoubleDefault
          ? const Center(
              child: Text('Ambos equipos perdieron por default',
                  style: TextStyle(fontSize: 12, color: _muted)))
          : !hasGoals && events.isEmpty
              ? const Center(
                  child: Text('Sin eventos registrados',
                      style: TextStyle(fontSize: 12, color: _muted)))
              : Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                      child: scorers(m.homeTeamId, CrossAxisAlignment.start)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Icon(Icons.sports_soccer,
                        size: 16, color: Colors.white.withValues(alpha: 0.5)),
                  ),
                  Expanded(
                      child: scorers(m.awayTeamId, CrossAxisAlignment.end)),
                ]),
    );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      box,
      const Spacer(),
      ..._formSection(),
    ]);
  }

  Widget _footer() => Padding(
        padding: const EdgeInsets.only(top: 10),
        child: Row(children: [
          const Icon(Icons.verified, size: 12, color: _muted),
          const SizedBox(width: 4),
          const Text('Resultados oficiales',
              style: TextStyle(fontSize: 9, color: _muted)),
          const Spacer(),
          Text(
            m.startTime == null ? '' : formatDateMedium(m.startTime),
            style: const TextStyle(fontSize: 9, color: _muted),
          ),
        ]),
      );
}
