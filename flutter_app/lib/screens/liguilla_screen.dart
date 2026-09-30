import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/export_image.dart';
import '../core/liguilla_repo.dart';
import '../core/repo.dart';
import '../core/session.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../logic/liguilla.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import '../widgets/liguilla_bracket.dart';
import '../widgets/manual_result_sheet.dart';

class LiguillaScreen extends StatefulWidget {
  const LiguillaScreen({super.key});

  @override
  State<LiguillaScreen> createState() => _LiguillaScreenState();
}

class _LiguillaScreenState extends State<LiguillaScreen> {
  final _exportKey = GlobalKey();
  List<League> _leagues = [];
  String? _selectedId;
  LiguillaData _data = LiguillaData.empty();
  bool _loading = true;
  bool _updating = false;
  bool _exporting = false;

  League? get _league => _leagues.where((l) => l.id == _selectedId).firstOrNull;

  /// SuperAdmin, o staff que es dueño de la liga.
  /// (En React se comparaba contra `created_by`, columna que no existe en
  /// `leagues`; aquí se usa `owner_id`.)
  bool get _canEdit {
    if (session.isSuperAdmin) return true;
    final uid = session.user?.id;
    return session.isStaff && uid != null && _league?.ownerId == uid;
  }

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final res = await fetchSelectableLeagues();
      _leagues = res.leagues;
      _selectedId = _leagues.isNotEmpty ? _leagues.first.id : null;
      await _load();
    } catch (e) {
      debugPrint('$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _load() async {
    final id = _selectedId;
    if (id == null) return;
    setState(() => _loading = true);
    try {
      _data = await fetchLiguilla(id);
    } catch (e) {
      if (mounted) showToast(context, 'Error al cargar datos', ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _insertRound(
      int round, List<(RankedTeam, RankedTeam)> pairs, bool hadExisting) async {
    if (hadExisting) {
      await db
          .from('matches')
          .delete()
          .eq('league_id', _selectedId!)
          .eq('round_number', round);
    }
    await db.from('matches').insert([
      for (final (home, away) in pairs)
        {
          'league_id': _selectedId,
          'home_team_id': home.id,
          'away_team_id': away.id,
          'round_number': round,
          'start_time': DateTime.now().toUtc().toIso8601String(),
          'status': 'scheduled',
        }
    ]);
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() => _updating = true);
    try {
      await action();
      if (mounted) showToast(context, success, ToastType.success);
      await _load();
    } catch (e) {
      if (mounted) showToast(context, 'Error: ${errorMessage(e)}', ToastType.error);
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _generateQF() async {
    if (!_canEdit) return;
    if (_data.qualified.length < 8) {
      showToast(context, 'No hay suficientes equipos (8) para generar liguilla',
          ToastType.error);
      return;
    }
    final existing = _data.qf.isNotEmpty;
    if (existing &&
        !await confirmDialog(context,
            'Ya existen partidos de liguilla. ¿Deseas regenerarlos? Se borrarán los actuales.',
            destructive: true)) {
      return;
    }
    await _run(
      () => _insertRound(
          roundQF, quarterFinalPairs(_data.qualified), existing),
      'Cuartos de final generados con éxito',
    );
  }

  List<RankedTeam> _winners(List<MatchModel> matches) => matches
      .map((m) => playoffWinner(
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            qualified: _data.qualified,
          ))
      .whereType<RankedTeam>()
      .fold<List<RankedTeam>>([], (acc, t) {
    if (!acc.any((x) => x.id == t.id)) acc.add(t);
    return acc;
  });

  Future<void> _generateSF() async {
    if (!_canEdit) return;
    final finished = _data.qf.where((m) => m.isFinished).take(4).toList();
    if (finished.length < 4) {
      showToast(
          context,
          'Se requieren 4 partidos de Cuartos finalizados. Encontrados: ${finished.length}',
          ToastType.info);
      return;
    }
    await _run(() async {
      final winners = _winners(finished);
      if (winners.length != 4) {
        throw Exception(
            'Se esperaban 4 ganadores únicos, se encontraron ${winners.length}.');
      }
      await _insertRound(roundSF, reseedPairs(winners), _data.sf.isNotEmpty);
    }, 'Semifinales generadas');
  }

  Future<void> _generateFinal() async {
    if (!_canEdit) return;
    final finished = _data.sf.where((m) => m.isFinished).toList();
    if (finished.length < 2) {
      showToast(context, 'Se requieren 2 semifinales finalizadas.',
          ToastType.info);
      return;
    }
    await _run(() async {
      final winners = _winners(finished);
      if (winners.length != 2) {
        throw Exception('Se esperaban 2 ganadores únicos.');
      }
      await _insertRound(
          roundFinal, reseedPairs(winners), _data.finalMatch != null);
    }, 'Gran Final generada');
  }

  Future<void> _editMatch(MatchModel m) async {
    String nameOf(String id) =>
        _data.qualified.where((t) => t.id == id).firstOrNull?.name ?? '';
    final res = await showManualResultSheet(context,
        match: m,
        homeName: nameOf(m.homeTeamId).isEmpty ? 'Local' : nameOf(m.homeTeamId),
        awayName:
            nameOf(m.awayTeamId).isEmpty ? 'Visitante' : nameOf(m.awayTeamId));
    if (res != null) await _load();
  }

  Future<void> _resetMatch(MatchModel m) async {
    if (!await confirmDialog(context,
        '¿Reiniciar partido? Se borrarán el resultado y los eventos (goles/tarjetas).',
        destructive: true)) {
      return;
    }
    await _run(() async {
      await db
          .from('matches')
          .update({'status': 'scheduled', 'home_score': 0, 'away_score': 0})
          .eq('id', m.id);
      await db.from('match_events').delete().eq('match_id', m.id);
    }, 'Partido reiniciado');
  }

  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      final slug =
          (_league?.name ?? 'liga').replaceAll(RegExp(r'\s+'), '-').toLowerCase();
      await captureAndShare(_exportKey, 'liguilla-$slug.png');
      if (mounted) showToast(context, 'Imagen generada', ToastType.success);
    } catch (e) {
      if (mounted) showToast(context, 'Error al exportar', ToastType.error);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) => Scaffold(
        appBar: AppBar(
          centerTitle: false,
          title: const Row(children: [
            Icon(Icons.workspace_premium, color: Colors.amber),
            SizedBox(width: 8),
            Text('Liguilla'),
          ]),
          actions: [
            IconButton(
              tooltip: 'Descargar imagen',
              icon: const Icon(Icons.download),
              onPressed: _exporting || _data.qualified.length < 8
                  ? null
                  : _export,
            ),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(56),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: LeagueDropdown(
                leagues: _leagues,
                selectedId: _selectedId,
                onChanged: (id) {
                  _selectedId = id;
                  _load();
                },
              ),
            ),
          ),
        ),
        body: _loading
            ? const LoadingView()
            : _data.qualified.length < 8
                ? const EmptyState(
                    icon: Icons.sports_soccer,
                    title: 'Liga en fase regular',
                    message:
                        'Se necesitan 8 equipos clasificados para iniciar la liguilla.',
                  )
                : ListView(padding: const EdgeInsets.all(16), children: [
                    if (_canEdit) _adminActions(),
                    RepaintBoundary(
                      key: _exportKey,
                      child: Container(
                        color: AppColors.backgroundDark,
                        padding: const EdgeInsets.all(8),
                        child: _data.qf.isEmpty
                            ? _readyView()
                            : LiguillaBracket(
                                data: _data,
                                canEdit: _canEdit,
                                onMatchTap: (m) {
                                  if (_canEdit && m.isScheduled) {
                                    context.push('/referee/${m.id}');
                                  }
                                },
                                onEdit: _editMatch,
                                onReset: _resetMatch,
                              ),
                      ),
                    ),
                  ]),
      ),
    );
  }

  Widget _adminActions() {
    Widget btn(String label, IconData icon, VoidCallback? onTap) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: FilledButton.icon(
              onPressed: _updating ? null : onTap,
              icon: Icon(icon),
              label: Text(label)),
        );
    if (_data.qf.isEmpty) {
      return btn('Generar Cuartos', Icons.account_tree, _generateQF);
    }
    if (_data.sf.isEmpty) {
      return btn('Generar Semis', Icons.forward, _generateSF);
    }
    if (_data.finalMatch == null) {
      return btn('Generar Final', Icons.emoji_events, _generateFinal);
    }
    return const SizedBox.shrink();
  }

  Widget _readyView() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          const Text('Liguilla Lista',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text(
            'Los 8 mejores equipos están clasificados. Genera los cruces para comenzar la fase final.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
          for (final t in _data.qualified)
            ListTile(
              dense: true,
              leading: CircleAvatar(radius: 14, child: Text('${t.rank}')),
              title: Text(t.name),
            ),
          const SizedBox(height: 8),
          if (!_canEdit)
            const Text('Esperando al administrador para iniciar...',
                style: TextStyle(color: AppColors.textSecondary)),
        ]),
      ),
    );
  }
}
