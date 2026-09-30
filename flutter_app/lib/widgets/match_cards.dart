import 'package:flutter/material.dart';

import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// Tarjeta grande de partido en vivo (Dashboard / página pública).
class LiveMatchCard extends StatelessWidget {
  const LiveMatchCard({
    super.key,
    required this.match,
    required this.events,
    this.leagueName,
    this.onTap,
  });

  final MatchModel match;
  final List<MatchEvent> events;
  final String? leagueName;
  final VoidCallback? onTap;

  int _count(String teamId, String type) =>
      events.where((e) => e.teamId == teamId && e.eventType == type).length;

  @override
  Widget build(BuildContext context) {
    final goals = events.where((e) => e.eventType == 'goal').toList();
    Widget team(String teamId, TeamRef? t) => Expanded(
          child: Column(children: [
            TeamShield(url: t?.shieldUrl, name: t?.name, size: 56),
            const SizedBox(height: 6),
            Text(t?.name ?? '',
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            CardDots(
                yellow: _count(teamId, 'yellow_card'),
                red: _count(teamId, 'red_card')),
          ]),
        );

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.primary.withValues(alpha: 0.25),
                AppColors.cardDark,
              ],
            ),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Row(children: [
              Expanded(
                child: Text(leagueName ?? 'Liga',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textSecondary)),
              ),
              LiveTimer(
                  match: match,
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontFeatures: [FontFeature.tabularFigures()])),
            ]),
            const SizedBox(height: 12),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              team(match.homeTeamId, match.homeTeam),
              Column(children: [
                Text(
                  match.isDoubleDefault
                      ? 'P - P'
                      : '${match.homeScore ?? 0} - ${match.awayScore ?? 0}',
                  style: const TextStyle(
                      fontSize: 34, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                LiveBadge(
                    label: match.status == 'break' ? 'ENTRETIEMPO' : 'EN VIVO'),
              ]),
              team(match.awayTeamId, match.awayTeam),
            ]),
            if (goals.isNotEmpty) ...[
              const Divider(height: 24, color: AppColors.borderDark),
              const Align(
                alignment: Alignment.centerLeft,
                child: Text('Goles',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.textSecondary)),
              ),
              const SizedBox(height: 4),
              for (final g in goals)
                Align(
                  alignment: g.teamId == match.homeTeamId
                      ? Alignment.centerLeft
                      : Alignment.centerRight,
                  child: Text(
                    '⚽ ${g.playerName ?? 'Jugador'} ${g.minute ?? ''}\'',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
            ],
          ]),
        ),
      ),
    );
  }
}

/// Fila de próximo partido.
class UpcomingMatchTile extends StatelessWidget {
  const UpcomingMatchTile({super.key, required this.match, this.onTap});
  final MatchModel match;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    Widget team(TeamRef? t, {bool end = false}) => Expanded(
          child: Row(
            mainAxisAlignment:
                end ? MainAxisAlignment.end : MainAxisAlignment.start,
            children: [
              if (!end) TeamShield(url: t?.shieldUrl, name: t?.name, size: 30),
              if (!end) const SizedBox(width: 8),
              Flexible(
                child: Text(t?.name ?? '',
                    overflow: TextOverflow.ellipsis,
                    textAlign: end ? TextAlign.end : TextAlign.start,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
              if (end) const SizedBox(width: 8),
              if (end) TeamShield(url: t?.shieldUrl, name: t?.name, size: 30),
            ],
          ),
        );

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            SizedBox(
              width: 52,
              child: Column(children: [
                Text(formatTime(match.startTime),
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                const Text('Hora',
                    style: TextStyle(
                        fontSize: 10, color: AppColors.textSecondary)),
              ]),
            ),
            const SizedBox(width: 8),
            team(match.homeTeam),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Text('VS',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textSecondary)),
            ),
            team(match.awayTeam, end: true),
          ]),
        ),
      ),
    );
  }
}

/// Resultado final compacto.
class ResultTile extends StatelessWidget {
  const ResultTile({super.key, required this.match, this.onTap, this.caption});
  final MatchModel match;
  final VoidCallback? onTap;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final h = match.homeScore ?? 0, a = match.awayScore ?? 0;
    Widget row(TeamRef? t, int? score, bool winner) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(children: [
            TeamShield(url: t?.shieldUrl, name: t?.name, size: 24),
            const SizedBox(width: 8),
            Expanded(
              child: Text(t?.name ?? '',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontWeight:
                          winner ? FontWeight.bold : FontWeight.normal)),
            ),
            Text(scoreText(score),
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: score == -1 ? AppColors.danger : null)),
          ]),
        );
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            Row(children: [
              Expanded(
                child: Text(caption ?? match.leagueName ?? 'Liga',
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textSecondary)),
              ),
              Text(formatDateRelative(match.startTime),
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.textSecondary)),
            ]),
            const SizedBox(height: 6),
            row(match.homeTeam, match.homeScore, h > a),
            row(match.awayTeam, match.awayScore, a > h),
          ]),
        ),
      ),
    );
  }
}
