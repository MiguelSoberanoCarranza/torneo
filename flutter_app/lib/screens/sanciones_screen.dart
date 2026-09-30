import 'package:flutter/material.dart';

import '../core/repo.dart';
import '../core/session.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../logic/standings.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class SancionesScreen extends StatefulWidget {
  const SancionesScreen({super.key});

  @override
  State<SancionesScreen> createState() => _SancionesScreenState();
}

class _SancionesScreenState extends State<SancionesScreen> {
  List<League> _leagues = [];
  String? _selectedId;
  List<Team> _teams = [];
  List<TeamSanction> _sanctions = [];
  bool _loading = true;
  bool _canManage = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      _leagues = await fetchOwnedActiveLeagues();
      _selectedId = _leagues.isNotEmpty ? _leagues.first.id : null;
      await _load();
    } catch (e) {
      if (mounted) showToast(context, 'Error al cargar tus ligas', ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _load() async {
    final id = _selectedId;
    if (id == null) return;
    setState(() => _loading = true);
    try {
      final league = _leagues.firstWhere((l) => l.id == id);
      _canManage = league.ownerId == session.user?.id;
      final teams = await db
          .from('teams')
          .select('id, name, shield_url')
          .eq('league_id', id)
          .order('name');
      _teams = teams.map(Team.fromJson).toList();
      final sanctions = await db
          .from('team_sanctions')
          .select('id, league_id, team_id, points_delta, reason, created_at, '
              'team:team_id(name, shield_url), '
              'creator:created_by(full_name, email)')
          .eq('league_id', id)
          .order('created_at', ascending: false);
      _sanctions = sanctions.map(TeamSanction.fromJson).toList();
    } catch (e) {
      if (mounted) showToast(context, 'Error al cargar sanciones', ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openForm() async {
    String? teamId = _teams.isNotEmpty ? _teams.first.id : null;
    var subtract = true;
    final points = TextEditingController(text: '1');
    final reason = TextEditingController();
    var saving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.surfaceDark,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => Padding(
          padding: EdgeInsets.fromLTRB(
              16, 16, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(children: [
                  const Expanded(
                    child: Text('Nueva sanción',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold)),
                  ),
                  IconButton(
                      onPressed: () => Navigator.pop(ctx),
                      icon: const Icon(Icons.close)),
                ]),
                LabeledField(
                  label: 'Equipo',
                  child: SimpleDropdown<String>(
                    value: teamId,
                    items: [for (final t in _teams) (t.id, t.name)],
                    onChanged: (v) => setLocal(() => teamId = v),
                  ),
                ),
                LabeledField(
                  label: 'Acción',
                  child: SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: true, label: Text('Restar puntos')),
                      ButtonSegment(value: false, label: Text('Sumar puntos')),
                    ],
                    selected: {subtract},
                    onSelectionChanged: (s) =>
                        setLocal(() => subtract = s.first),
                  ),
                ),
                LabeledField(
                  label: 'Puntos',
                  child: TextField(
                      controller: points,
                      keyboardType: TextInputType.number),
                ),
                LabeledField(
                  label: 'Motivo',
                  child: TextField(
                    controller: reason,
                    maxLines: 3,
                    decoration: const InputDecoration(
                        hintText:
                            'Ej: Conducta antideportiva, no presentación, etc.'),
                  ),
                ),
                FilledButton(
                  onPressed: saving || _teams.isEmpty
                      ? null
                      : () async {
                          final amount = int.tryParse(points.text.trim()) ?? 0;
                          if (teamId == null || reason.text.trim().isEmpty) {
                            showToast(context, 'Completa todos los campos',
                                ToastType.error);
                            return;
                          }
                          if (amount <= 0) {
                            showToast(context,
                                'Indica una cantidad de puntos válida',
                                ToastType.error);
                            return;
                          }
                          setLocal(() => saving = true);
                          try {
                            await db.from('team_sanctions').insert({
                              'league_id': _selectedId,
                              'team_id': teamId,
                              'points_delta': subtract ? -amount : amount,
                              'reason': reason.text.trim(),
                              'created_by': session.user?.id,
                            });
                            if (ctx.mounted) Navigator.pop(ctx);
                            if (mounted) {
                              showToast(
                                  context,
                                  subtract
                                      ? 'Se restaron $amount punto(s) al equipo'
                                      : 'Se sumaron $amount punto(s) al equipo',
                                  ToastType.success);
                            }
                            await _load();
                          } catch (e) {
                            setLocal(() => saving = false);
                            if (mounted) {
                              showToast(context, errorMessage(e), ToastType.error);
                            }
                          }
                        },
                  child: Text(saving ? 'Guardando...' : 'Aplicar sanción'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _delete(TeamSanction s) async {
    if (!_canManage) return;
    if (!await confirmDialog(
        context,
        '¿Eliminar esta sanción de ${s.teamName ?? 'equipo'}? '
        'Se revertirá el ajuste de ${s.pointsDelta} punto(s) en la tabla.',
        destructive: true)) {
      return;
    }
    try {
      await db.from('team_sanctions').delete().eq('id', s.id);
      if (mounted) showToast(context, 'Sanción eliminada', ToastType.success);
      await _load();
    } catch (e) {
      if (mounted) showToast(context, errorMessage(e), ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final totals = buildSanctionTotals(_sanctions
        .map((s) => {'team_id': s.teamId, 'points_delta': s.pointsDelta}));
    final adjusted = _teams
        .map((t) => (team: t, adj: totals[t.id] ?? 0))
        .where((x) => x.adj != 0)
        .toList()
      ..sort((a, b) => a.adj.compareTo(b.adj));
    final leagueName =
        _leagues.where((l) => l.id == _selectedId).firstOrNull?.name ?? '';

    return Scaffold(
      appBar: AppBar(
        centerTitle: false,
        title: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Sanciones'),
          Text('Ajustes disciplinarios de puntos por equipo',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ]),
      ),
      floatingActionButton: _canManage
          ? FloatingActionButton.extended(
              onPressed: _openForm,
              icon: const Icon(Icons.gavel),
              label: const Text('Registrar sanción'),
            )
          : null,
      body: !_loading && _leagues.isEmpty
          ? const EmptyState(
              icon: Icons.gavel,
              title: 'Acceso restringido',
              message:
                  'Solo los administradores de liga pueden gestionar sanciones disciplinarias.',
            )
          : ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 96), children: [
              LeagueDropdown(
                leagues: _leagues,
                selectedId: _selectedId,
                onChanged: (id) {
                  _selectedId = id;
                  _load();
                },
              ),
              if (adjusted.isNotEmpty) ...[
                SectionTitle('Saldo por equipo — $leagueName'),
                Card(
                  child: Column(children: [
                    for (final x in adjusted)
                      ListTile(
                        leading: TeamShield(
                            url: x.team.shieldUrl, name: x.team.name, size: 32),
                        title: Text(x.team.name),
                        trailing: Text(
                          '${x.adj > 0 ? '+' : ''}${x.adj} pts',
                          style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: x.adj > 0
                                  ? AppColors.success
                                  : AppColors.danger),
                        ),
                      ),
                  ]),
                ),
              ],
              const SectionTitle('Historial'),
              if (_loading)
                const Padding(padding: EdgeInsets.all(24), child: LoadingView())
              else if (_sanctions.isEmpty)
                const EmptyState(
                    icon: Icons.gavel,
                    title: 'No hay sanciones registradas en esta liga.')
              else
                for (final s in _sanctions)
                  Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: (s.pointsDelta > 0
                                ? AppColors.success
                                : AppColors.danger)
                            .withValues(alpha: 0.2),
                        child: Text(
                            '${s.pointsDelta > 0 ? '+' : ''}${s.pointsDelta}',
                            style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: s.pointsDelta > 0
                                    ? AppColors.success
                                    : AppColors.danger)),
                      ),
                      title: Text(
                          '${s.teamName ?? 'Equipo'} · ${formatDateMedium(s.createdAt)}'),
                      subtitle: Text([
                        s.reason,
                        if (s.creatorName != null) 'Por: ${s.creatorName}',
                      ].join('\n')),
                      isThreeLine: s.creatorName != null,
                      trailing: _canManage
                          ? IconButton(
                              tooltip: 'Eliminar sanción',
                              icon: const Icon(Icons.delete),
                              onPressed: () => _delete(s),
                            )
                          : null,
                    ),
                  ),
            ]),
    );
  }
}
