import 'package:flutter/material.dart';

import '../logic/standings.dart';
import '../logic/stats.dart';
import '../theme/app_theme.dart';
import 'common.dart';

const _headStyle = TextStyle(
    fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary);

/// Tabla general. [exportMode] usa colores fijos para la imagen compartida.
class StandingsTable extends StatelessWidget {
  const StandingsTable({super.key, required this.standings});
  final List<TeamStanding> standings;

  @override
  Widget build(BuildContext context) {
    Widget num(String v, {Color? color, bool bold = false}) => SizedBox(
          width: 30,
          child: Text(v,
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13,
                  color: color,
                  fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
        );

    return Card(
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          child: Row(children: [
            const SizedBox(width: 28, child: Text('Pos', style: _headStyle)),
            const Expanded(child: Text('Equipo', style: _headStyle)),
            for (final h in ['PJ', 'G', 'E', 'P', 'GF', 'GC', 'DIF', 'PTS'])
              SizedBox(
                  width: 30,
                  child: Text(h,
                      textAlign: TextAlign.center, style: _headStyle)),
          ]),
        ),
        const Divider(height: 1, color: AppColors.borderDark),
        for (var i = 0; i < standings.length; i++)
          Container(
            color: i < 8 ? AppColors.primary.withValues(alpha: 0.06) : null,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(children: [
              SizedBox(
                width: 28,
                child: Text('${i + 1}',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: i < 8
                            ? const Color(0xFF2563EB)
                            : const Color(0xFF94A3B8))),
              ),
              Expanded(
                child: Row(children: [
                  TeamShield(
                      url: standings[i].shieldUrl,
                      name: standings[i].name,
                      size: 26),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(standings[i].name,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600)),
                  ),
                ]),
              ),
              num('${standings[i].played}'),
              num('${standings[i].won}'),
              num('${standings[i].drawn}'),
              num('${standings[i].lost}'),
              num('${standings[i].gf}'),
              num('${standings[i].ga}'),
              num(
                standings[i].gd > 0
                    ? '+${standings[i].gd}'
                    : '${standings[i].gd}',
                color: standings[i].gd > 0
                    ? AppColors.success
                    : standings[i].gd < 0
                        ? AppColors.danger
                        : AppColors.textSecondary,
              ),
              num('${standings[i].points}', bold: true),
            ]),
          ),
      ]),
    );
  }
}

class _PlayerCell extends StatelessWidget {
  const _PlayerCell(this.stat);
  final PlayerStat stat;

  @override
  Widget build(BuildContext context) => Row(children: [
        Avatar(url: stat.photoUrl, size: 36),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(stat.name,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600)),
            Row(children: [
              if (stat.teamShield != null) ...[
                SizedBox(
                    width: 14, height: 14, child: NetImage(stat.teamShield!)),
                const SizedBox(width: 4),
              ],
              Flexible(
                child: Text(stat.teamName,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textSecondary)),
              ),
            ]),
          ]),
        ),
      ]);
}

class ScorersTable extends StatelessWidget {
  const ScorersTable({super.key, required this.scorers, this.limit});
  final List<PlayerStat> scorers;
  final int? limit;

  @override
  Widget build(BuildContext context) {
    if (scorers.isEmpty) {
      return const EmptyState(
          icon: Icons.sports_soccer, title: 'No hay goles registrados aún.');
    }
    final list = limit == null ? scorers : scorers.take(limit!).toList();
    return Card(
      child: Column(children: [
        const Padding(
          padding: EdgeInsets.all(10),
          child: Row(children: [
            SizedBox(width: 28, child: Text('#', style: _headStyle)),
            Expanded(child: Text('Jugador', style: _headStyle)),
            Text('Goles', style: _headStyle),
          ]),
        ),
        const Divider(height: 1, color: AppColors.borderDark),
        for (var i = 0; i < list.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(children: [
              SizedBox(
                  width: 28,
                  child: Text('${i + 1}',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: i < 3
                              ? const Color(0xFFFBBF24)
                              : AppColors.textSecondary))),
              Expanded(child: _PlayerCell(list[i])),
              Text('${list[i].goals}',
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.bold)),
            ]),
          ),
      ]),
    );
  }
}

class CardsTable extends StatelessWidget {
  const CardsTable({super.key, required this.stats});
  final List<PlayerStat> stats;

  @override
  Widget build(BuildContext context) {
    if (stats.isEmpty) {
      return const EmptyState(
          icon: Icons.style, title: 'No hay tarjetas registradas aún.');
    }
    Widget cardIcon(Color c) => Container(
        width: 12,
        height: 16,
        decoration:
            BoxDecoration(color: c, borderRadius: BorderRadius.circular(2)));
    return Card(
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.all(10),
          child: Row(children: [
            const SizedBox(width: 28, child: Text('#', style: _headStyle)),
            const Expanded(child: Text('Jugador', style: _headStyle)),
            SizedBox(
                width: 36,
                child: Center(child: cardIcon(AppColors.yellowCard))),
            SizedBox(
                width: 36, child: Center(child: cardIcon(AppColors.redCard))),
          ]),
        ),
        const Divider(height: 1, color: AppColors.borderDark),
        for (var i = 0; i < stats.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(children: [
              SizedBox(width: 28, child: Text('${i + 1}')),
              Expanded(child: _PlayerCell(stats[i])),
              SizedBox(
                  width: 36,
                  child: Text('${stats[i].yellowCards}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          color: AppColors.yellowCard,
                          fontWeight: FontWeight.bold))),
              SizedBox(
                  width: 36,
                  child: Text('${stats[i].redCards}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          color: AppColors.redCard,
                          fontWeight: FontWeight.bold))),
            ]),
          ),
      ]),
    );
  }
}

/// Envoltorio con fondo oscuro para las imágenes exportadas.
class ExportFrame extends StatelessWidget {
  const ExportFrame({
    super.key,
    required this.leagueName,
    required this.title,
    required this.highlight,
    required this.child,
    this.subtitle,
  });

  final String leagueName;
  final String title;
  final String highlight;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF0F172A),
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Liga Premier ${DateTime.now().year}'.toUpperCase(),
              style: const TextStyle(
                  color: Color(0xFF60A5FA),
                  fontSize: 12,
                  letterSpacing: 2,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text.rich(TextSpan(children: [
            TextSpan(text: '$title '),
            TextSpan(
                text: highlight,
                style: const TextStyle(color: Color(0xFF60A5FA))),
          ]),
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.emoji_events, color: Color(0xFFCBD5E1), size: 18),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                  (subtitle ?? leagueName).toUpperCase(),
                  style: const TextStyle(
                      color: Color(0xFFCBD5E1), fontWeight: FontWeight.w600)),
            ),
          ]),
          const SizedBox(height: 16),
          child,
          const SizedBox(height: 16),
          const Row(children: [
            Icon(Icons.verified, size: 16, color: Color(0xFF94A3B8)),
            SizedBox(width: 4),
            Text('Resultados Oficiales',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
            Spacer(),
            Text('torneo-two.vercel.app',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
          ]),
        ],
      ),
    );
  }
}
