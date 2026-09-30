import 'package:flutter/material.dart';

import '../logic/liguilla.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import 'common.dart';

class LiguillaData {
  LiguillaData({
    required this.qualified,
    required this.qf,
    required this.sf,
    required this.finalMatch,
  });

  final List<RankedTeam> qualified;
  final List<MatchModel> qf;
  final List<MatchModel> sf;
  final MatchModel? finalMatch;

  static LiguillaData empty() =>
      LiguillaData(qualified: [], qf: [], sf: [], finalMatch: null);
}

/// Cuadro de liguilla. Solo lectura si [canEdit] es false.
class LiguillaBracket extends StatelessWidget {
  const LiguillaBracket({
    super.key,
    required this.data,
    this.canEdit = false,
    this.onMatchTap,
    this.onEdit,
    this.onReset,
  });

  final LiguillaData data;
  final bool canEdit;
  final void Function(MatchModel)? onMatchTap;
  final void Function(MatchModel)? onEdit;
  final void Function(MatchModel)? onReset;

  @override
  Widget build(BuildContext context) {
    final q = data.qualified;
    // Orden visual del cuadro: 1v8, 4v5, 2v7, 3v6.
    final qfOrdered = <MatchModel>[
      for (final seed in [0, 3, 1, 2])
        if (q.length > seed)
          ...data.qf.where((m) => m.homeTeamId == q[seed].id),
    ];

    Widget column(String title, List<MatchModel> matches, String emptyLabel) =>
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(title.toUpperCase(),
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 12,
                    letterSpacing: 1.5,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textSecondary)),
          ),
          if (matches.isEmpty)
            Container(
              height: 80,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.borderDark),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(emptyLabel,
                  style: const TextStyle(color: AppColors.textSecondary)),
            ),
          for (final m in matches)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _PlayoffMatchCard(
                match: m,
                qualified: q,
                canEdit: canEdit,
                onTap: onMatchTap,
                onEdit: onEdit,
                onReset: onReset,
              ),
            ),
        ]);

    final cols = [
      column('Cuartos de Final', qfOrdered, 'Pendiente'),
      column('Semifinales', data.sf, 'Próximamente'),
      column('Gran Final',
          data.finalMatch == null ? [] : [data.finalMatch!], 'Próximamente'),
    ];

    return LayoutBuilder(builder: (context, c) {
      if (c.maxWidth >= 900) {
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final col in cols)
            Expanded(
                child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: col)),
        ]);
      }
      return Column(children: [
        for (final col in cols)
          Padding(padding: const EdgeInsets.only(bottom: 16), child: col),
      ]);
    });
  }
}

class _PlayoffMatchCard extends StatelessWidget {
  const _PlayoffMatchCard({
    required this.match,
    required this.qualified,
    required this.canEdit,
    this.onTap,
    this.onEdit,
    this.onReset,
  });

  final MatchModel match;
  final List<RankedTeam> qualified;
  final bool canEdit;
  final void Function(MatchModel)? onTap;
  final void Function(MatchModel)? onEdit;
  final void Function(MatchModel)? onReset;

  @override
  Widget build(BuildContext context) {
    final home = qualified.where((t) => t.id == match.homeTeamId).firstOrNull;
    final away = qualified.where((t) => t.id == match.awayTeamId).firstOrNull;
    if (home == null || away == null) return const SizedBox.shrink();

    final label = match.isLive
        ? 'En Vivo'
        : match.isFinished
            ? 'Finalizado'
            : 'Programado';

    Widget row(RankedTeam t, int? score) {
      final text = match.isDoubleDefault
          ? 'P'
          : (match.isScheduled ? '-' : '${score ?? '-'}');
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          Container(
            width: 28,
            padding: const EdgeInsets.symmetric(vertical: 2),
            decoration: BoxDecoration(
              color: _rankColor(t.rank).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text('#${t.rank}',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: _rankColor(t.rank))),
          ),
          const SizedBox(width: 8),
          TeamShield(url: t.shieldUrl, name: t.name, size: 24),
          const SizedBox(width: 8),
          Expanded(
              child: Text(t.name,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600))),
          Text(text,
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ]),
      );
    }

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap == null ? null : () => onTap!(match),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
          child: Column(children: [
            Row(children: [
              Text(label.toUpperCase(),
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: match.isLive
                          ? AppColors.live
                          : AppColors.textSecondary)),
              const Spacer(),
              if (canEdit && onEdit != null)
                IconButton(
                  visualDensity: VisualDensity.compact,
                  tooltip: 'Editar Resultado',
                  icon: const Icon(Icons.edit, size: 18),
                  onPressed: () => onEdit!(match),
                ),
              if (canEdit && match.isFinished && onReset != null)
                IconButton(
                  visualDensity: VisualDensity.compact,
                  tooltip: 'Reiniciar',
                  icon: const Icon(Icons.restart_alt, size: 18),
                  onPressed: () => onReset!(match),
                ),
            ]),
            row(home, match.homeScore),
            row(away, match.awayScore),
            if (canEdit && match.isScheduled)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text('Clic para Iniciar',
                    style: TextStyle(fontSize: 11, color: AppColors.primary)),
              ),
          ]),
        ),
      ),
    );
  }

  Color _rankColor(int pos) => switch (pos) {
        1 => const Color(0xFFEAB308),
        2 => const Color(0xFF94A3B8),
        3 => const Color(0xFFF97316),
        _ => const Color(0xFF3B82F6),
      };
}
