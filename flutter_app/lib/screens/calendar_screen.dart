import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/export_image.dart';
import '../core/repo.dart';
import '../core/session.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import '../widgets/manual_result_sheet.dart';
import '../widgets/stats_tables.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  bool _loading = true;
  bool _updating = false;
  List<League> _leagues = [];
  String? _selectedId;
  List<MatchModel> _matches = [];
  List<Team> _teams = [];
  String _query = '';
  bool _searchOpen = false;
  bool _nextRoundOnly = false;

  String? get _uid => session.user?.id;
  String? get _role => session.role;
  League? get _league => _leagues.where((l) => l.id == _selectedId).firstOrNull;
  bool get _isOwner => _uid != null && _league?.ownerId == _uid;
  bool get _canOperate =>
      _role == 'admin' || _role == 'referee' || _isOwner;
  bool get _canManage => _role == 'admin' || _isOwner;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      if (session.profile == null && session.isLoggedIn) await session.refresh();
      final res = await fetchSelectableLeagues();
      _leagues = res.leagues;
      _selectedId = _leagues.isNotEmpty ? _leagues.first.id : null;
      await _loadLeagueData();
    } catch (e) {
      if (mounted) showToast(context, 'Error al cargar partidos', ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadLeagueData() async {
    final id = _selectedId;
    if (id == null) return;
    final rows = await db
        .from('matches')
        .select('id, start_time, home_score, away_score, status, '
            'round_number, location, league_id, home_team_id, away_team_id, '
            'home_team:teams!matches_home_team_id_fkey(name, shield_url), '
            'away_team:teams!matches_away_team_id_fkey(name, shield_url), '
            'league:leagues(name)')
        .eq('league_id', id)
        .order('start_time');
    final teams = await db
        .from('teams')
        .select('id, name')
        .eq('league_id', id)
        .order('name');
    if (!mounted) return;
    setState(() {
      _matches = rows.map(MatchModel.fromJson).toList();
      _teams = teams.map(Team.fromJson).toList();
    });
  }

  int get _nextRound {
    final upcoming = _matches.where((m) => m.isScheduled);
    if (upcoming.isEmpty) return 0;
    return upcoming
        .map((m) => m.roundNumber ?? 100)
        .reduce((a, b) => a < b ? a : b);
  }

  Map<int, List<MatchModel>> get _grouped {
    final q = _query.toLowerCase();
    final next = _nextRound;
    final map = <int, List<MatchModel>>{};
    for (final m in _matches) {
      final matchesSearch = q.isEmpty ||
          (m.homeTeam?.name.toLowerCase().contains(q) ?? false) ||
          (m.awayTeam?.name.toLowerCase().contains(q) ?? false) ||
          (m.leagueName?.toLowerCase().contains(q) ?? false);
      if (!matchesSearch) continue;
      if (_nextRoundOnly && (m.roundNumber ?? 0) != next) continue;
      map.putIfAbsent(m.roundNumber ?? 0, () => []).add(m);
    }
    return Map.fromEntries(
        map.entries.toList()..sort((a, b) => a.key.compareTo(b.key)));
  }

  // ---------------- Crear / editar partido ----------------

  Future<void> _openMatchForm({MatchModel? editing}) async {
    final now = DateTime.now();
    var date = editing?.startTime ?? DateTime(now.year, now.month, now.day);
    var time = editing?.startTime != null
        ? TimeOfDay.fromDateTime(editing!.startTime!)
        : const TimeOfDay(hour: 9, minute: 0);
    final round = TextEditingController(
        text: '${editing?.roundNumber ?? (_nextRound == 0 ? 1 : _nextRound)}');
    final location = TextEditingController(text: editing?.location ?? '');
    String? homeId = editing?.homeTeamId;
    String? awayId = editing?.awayTeamId;
    final isCreating = editing == null;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) {
          final teamItems = [for (final t in _teams) (t.id, t.name)];
          return AlertDialog(
            title: Text(isCreating ? 'Crear Partido' : 'Editar Partido'),
            content: SizedBox(
              width: 420,
              child: SingleChildScrollView(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  LabeledField(
                    label: 'Jornada',
                    child: TextField(
                        controller: round,
                        keyboardType: TextInputType.number),
                  ),
                  LabeledField(
                    label: 'Local',
                    child: SimpleDropdown<String>(
                      value: homeId,
                      hint: 'Seleccionar',
                      items: teamItems,
                      onChanged: (v) => setLocal(() => homeId = v),
                    ),
                  ),
                  LabeledField(
                    label: 'Visitante',
                    child: SimpleDropdown<String>(
                      value: awayId,
                      hint: 'Seleccionar',
                      items: teamItems,
                      onChanged: (v) => setLocal(() => awayId = v),
                    ),
                  ),
                  Row(children: [
                    Expanded(
                      child: LabeledField(
                        label: 'Fecha',
                        child: OutlinedButton(
                          onPressed: () async {
                            final d = await showDatePicker(
                              context: ctx,
                              initialDate: date,
                              firstDate: DateTime(2020),
                              lastDate: DateTime(2100),
                            );
                            if (d != null) setLocal(() => date = d);
                          },
                          child: Text(formatDateMedium(date)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: LabeledField(
                        label: 'Hora',
                        child: OutlinedButton(
                          onPressed: () async {
                            final t = await showTimePicker(
                                context: ctx, initialTime: time);
                            if (t != null) setLocal(() => time = t);
                          },
                          child: Text(time.format(ctx)),
                        ),
                      ),
                    ),
                  ]),
                  LabeledField(
                    label: 'Ubicación / Cancha',
                    child: TextField(
                        controller: location,
                        decoration:
                            const InputDecoration(hintText: 'Ej. Cancha 1')),
                  ),
                  if (!isCreating && editing.isScheduled)
                    TextButton.icon(
                      onPressed: _updating
                          ? null
                          : () async {
                              if (await _deleteMatch(editing) && ctx.mounted) {
                                Navigator.pop(ctx);
                              }
                            },
                      icon: const Icon(Icons.delete, color: AppColors.danger),
                      label: const Text('Eliminar Partido',
                          style: TextStyle(color: AppColors.danger)),
                    ),
                ]),
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancelar')),
              FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
                onPressed: _updating
                    ? null
                    : () async {
                        final ok = await _saveMatch(
                          editing: editing,
                          homeId: homeId,
                          awayId: awayId,
                          start: DateTime(date.year, date.month, date.day,
                              time.hour, time.minute),
                          round: int.tryParse(round.text) ?? 0,
                          location: location.text.trim(),
                        );
                        if (ok && ctx.mounted) Navigator.pop(ctx);
                      },
                child: Text(isCreating ? 'Crear' : 'Guardar'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<bool> _saveMatch({
    MatchModel? editing,
    String? homeId,
    String? awayId,
    required DateTime start,
    required int round,
    required String location,
  }) async {
    if (_selectedId == null) {
      showToast(context, 'Error: No hay liga seleccionada', ToastType.error);
      return false;
    }
    if (homeId == null || awayId == null) {
      showToast(context, 'Selecciona ambos equipos', ToastType.error);
      return false;
    }
    if (homeId == awayId) {
      showToast(context, 'No puedes seleccionar el mismo equipo', ToastType.error);
      return false;
    }
    setState(() => _updating = true);
    try {
      final data = {
        'league_id': _selectedId,
        'home_team_id': homeId,
        'away_team_id': awayId,
        'start_time': start.toUtc().toIso8601String(),
        'location': location,
        'round_number': round,
      };
      if (editing == null) {
        await db.from('matches').insert({...data, 'status': 'scheduled'});
        if (mounted) showToast(context, 'Partido creado exitosamente', ToastType.success);
      } else {
        await db.from('matches').update(data).eq('id', editing.id);
        if (mounted) showToast(context, 'Partido actualizado', ToastType.success);
      }
      await _loadLeagueData();
      return true;
    } catch (e) {
      if (mounted) showToast(context, 'Error al guardar: ${errorMessage(e)}', ToastType.error);
      return false;
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<bool> _deleteMatch(MatchModel m) async {
    if (!await confirmDialog(
        context, '¿Estás seguro de que quieres eliminar este partido?',
        destructive: true)) {
      return false;
    }
    try {
      await db.from('matches').delete().eq('id', m.id);
      if (mounted) showToast(context, 'Partido eliminado', ToastType.success);
      setState(() => _matches.removeWhere((x) => x.id == m.id));
      return true;
    } catch (e) {
      if (mounted) showToast(context, 'Error al eliminar', ToastType.error);
      return false;
    }
  }

  Future<void> _resetMatch(MatchModel m) async {
    if (!await confirmDialog(context,
        '¿Reiniciar partido? Se borrarán el resultado y los eventos (goles/tarjetas).',
        destructive: true)) {
      return;
    }
    setState(() => _updating = true);
    try {
      await db
          .from('matches')
          .update({'status': 'scheduled', 'home_score': 0, 'away_score': 0})
          .eq('id', m.id);
      await db.from('match_events').delete().eq('match_id', m.id);
      setState(() {
        final i = _matches.indexWhere((x) => x.id == m.id);
        if (i >= 0) {
          _matches[i] = m.merge(
              {'status': 'scheduled', 'home_score': 0, 'away_score': 0});
        }
      });
      if (mounted) showToast(context, 'Partido reiniciado', ToastType.success);
    } catch (e) {
      if (mounted) showToast(context, 'Error al reiniciar', ToastType.error);
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _manual(MatchModel m) async {
    final res = await showManualResultSheet(context,
        match: m,
        homeName: m.homeTeam?.name ?? 'Local',
        awayName: m.awayTeam?.name ?? 'Visitante');
    if (res != null) {
      setState(() {
        final i = _matches.indexWhere((x) => x.id == m.id);
        if (i >= 0) _matches[i] = m.merge(res);
      });
    }
  }

  Future<void> _exportRound(int round, List<MatchModel> matches) async {
    final key = GlobalKey();
    await showDialog(
      context: context,
      builder: (ctx) {
        var exporting = false;
        return StatefulBuilder(
          builder: (ctx, setLocal) => AlertDialog(
            title: const Text('Vista Previa'),
            contentPadding: const EdgeInsets.all(8),
            content: SizedBox(
              width: 520,
              child: SingleChildScrollView(
                child: RepaintBoundary(
                  key: key,
                  child: ExportFrame(
                    leagueName: _league?.name ?? '',
                    title: 'Jornada',
                    highlight: '$round',
                    subtitle: matches.isEmpty
                        ? 'FECHA'
                        : formatDateLong(matches.first.startTime),
                    child: Column(children: [
                      for (final m in matches) _exportRow(m),
                    ]),
                  ),
                ),
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancelar')),
              FilledButton.icon(
                style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
                onPressed: exporting
                    ? null
                    : () async {
                        setLocal(() => exporting = true);
                        try {
                          await captureAndShare(
                              key, 'jornada-$round-premier.png');
                          if (ctx.mounted) Navigator.pop(ctx);
                        } catch (e) {
                          setLocal(() => exporting = false);
                          if (mounted) {
                            showToast(context, 'Error al exportar imagen',
                                ToastType.error);
                          }
                        }
                      },
                icon: const Icon(Icons.download),
                label: Text(exporting ? 'Exportando...' : 'Descargar Imagen'),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _exportRow(MatchModel m) {
    const white = TextStyle(color: Colors.white, fontWeight: FontWeight.bold);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white24),
      ),
      child: Row(children: [
        SizedBox(
          width: 52,
          child: Text(m.isFinished ? 'FINAL' : formatTime(m.startTime),
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
        ),
        Expanded(
            child: Text(m.homeTeam?.name ?? '',
                textAlign: TextAlign.end,
                overflow: TextOverflow.ellipsis,
                style: white)),
        const SizedBox(width: 6),
        TeamShield(url: m.homeTeam?.shieldUrl, name: m.homeTeam?.name, size: 30),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text(
            m.isScheduled
                ? 'VS'
                : '${scoreText(m.homeScore)} - ${scoreText(m.awayScore)}',
            style: white,
          ),
        ),
        TeamShield(url: m.awayTeam?.shieldUrl, name: m.awayTeam?.name, size: 30),
        const SizedBox(width: 6),
        Expanded(
            child: Text(m.awayTeam?.name ?? '',
                overflow: TextOverflow.ellipsis, style: white)),
      ]),
    );
  }

  // ---------------- UI ----------------

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        if (_loading) return const Scaffold(body: LoadingView());
        if (!session.isStaff) {
          return Scaffold(
            body: EmptyState(
              icon: Icons.lock,
              title: 'Acceso Restringido',
              message:
                  'Solo el personal autorizado (Administradores y Árbitros) puede acceder al calendario de gestión.',
              action: FilledButton(
                  onPressed: () => context.go('/'),
                  child: const Text('Volver al Inicio')),
            ),
          );
        }
        final grouped = _grouped;
        return Scaffold(
          appBar: AppBar(
            centerTitle: false,
            title: _searchOpen
                ? TextField(
                    autofocus: true,
                    decoration:
                        const InputDecoration(hintText: 'Buscar equipo...'),
                    onChanged: (v) => setState(() => _query = v),
                  )
                : _leagues.isEmpty
                    ? const Text('Calendario')
                    : LeagueDropdown(
                        leagues: _leagues,
                        selectedId: _selectedId,
                        onChanged: (id) async {
                          setState(() => _selectedId = id);
                          await _loadLeagueData();
                        },
                      ),
            actions: [
              IconButton(
                icon: Icon(_searchOpen ? Icons.close : Icons.search),
                onPressed: () => setState(() {
                  _searchOpen = !_searchOpen;
                  if (!_searchOpen) _query = '';
                }),
              ),
              if (_isOwner) ...[
                IconButton(
                  tooltip: 'Crear Partido Manualmente',
                  icon: const Icon(Icons.add),
                  onPressed: () => _openMatchForm(),
                ),
                IconButton(
                  tooltip: 'Generador Automático',
                  icon: const Icon(Icons.auto_fix_high),
                  onPressed: () async {
                    await context.push('/fixture-generator');
                    await _loadLeagueData();
                  },
                ),
              ],
            ],
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(52),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: false, label: Text('Todos')),
                    ButtonSegment(value: true, label: Text('Próxima Jornada')),
                  ],
                  selected: {_nextRoundOnly},
                  onSelectionChanged: (s) =>
                      setState(() => _nextRoundOnly = s.first),
                ),
              ),
            ),
          ),
          body: RefreshIndicator(
            onRefresh: _loadLeagueData,
            child: _matches.isEmpty
                ? ListView(children: const [
                    SizedBox(height: 80),
                    EmptyState(
                        icon: Icons.event_busy,
                        title: 'No hay partidos programados.'),
                  ])
                : ListView(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 32),
                    children: [
                      for (final entry in grouped.entries) ...[
                        _roundHeader(entry.key, entry.value),
                        for (final m in entry.value) _matchCard(m),
                      ],
                    ],
                  ),
          ),
        );
      },
    );
  }

  Widget _roundHeader(int round, List<MatchModel> matches) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Jornada $round',
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(formatDateLong(matches.first.startTime),
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary)),
          ]),
        ),
        TextButton.icon(
          onPressed: () => _exportRound(round, matches),
          icon: const Icon(Icons.share, size: 18),
          label: const Text('Compartir'),
        ),
      ]),
    );
  }

  Widget _matchCard(MatchModel m) {
    final showScore = m.isFinished || m.isLive;
    Widget team(TeamRef? t, String fallback) => Expanded(
          child: Column(children: [
            TeamShield(url: t?.shieldUrl, size: 44),
            const SizedBox(height: 6),
            Text(t?.name ?? fallback,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ]),
        );

    Widget center;
    if (showScore) {
      center = Column(children: [
        Text(
          m.isDoubleDefault
              ? 'P - P'
              : '${m.homeScore ?? 0} - ${m.awayScore ?? 0}',
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
        ),
        if (m.isFinished && _canOperate)
          Wrap(spacing: 4, children: [
            TextButton.icon(
              onPressed: _updating ? null : () => _resetMatch(m),
              icon: const Icon(Icons.restart_alt, size: 16),
              label: const Text('Reiniciar', style: TextStyle(fontSize: 12)),
            ),
            TextButton.icon(
              onPressed: () => _manual(m),
              icon: const Icon(Icons.edit_note, size: 16),
              label: const Text('Editar', style: TextStyle(fontSize: 12)),
            ),
          ]),
      ]);
    } else if (_canOperate && m.isScheduled) {
      center = Column(children: [
        FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: const Size(0, 36)),
          onPressed: () => context.push('/referee/${m.id}'),
          icon: const Icon(Icons.play_arrow, size: 18),
          label: const Text('Iniciar'),
        ),
        if (_canManage)
          IconButton(
            tooltip: 'Cargar Resultado Manual',
            onPressed: () => _manual(m),
            icon: const Icon(Icons.edit_note),
          ),
      ]);
    } else {
      center = const Text('VS',
          style: TextStyle(
              fontWeight: FontWeight.bold, color: AppColors.textSecondary));
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            if (_canOperate && !m.isFinished) {
              context.push('/referee/${m.id}');
            }
          },
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: [
              Row(children: [
                const Icon(Icons.schedule,
                    size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(formatTime(m.startTime),
                    style: const TextStyle(color: AppColors.textSecondary)),
                const Spacer(),
                if (m.isScheduled && _canManage)
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    tooltip: 'Editar partido',
                    icon: const Icon(Icons.settings, size: 18),
                    onPressed: () => _openMatchForm(editing: m),
                  ),
              ]),
              Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                team(m.homeTeam, 'Local'),
                SizedBox(width: 130, child: Center(child: center)),
                team(m.awayTeam, 'Visitante'),
              ]),
              const SizedBox(height: 4),
              Text(statusLabel(m.status),
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: m.isLive ? AppColors.live : AppColors.textSecondary)),
            ]),
          ),
        ),
      ),
    );
  }
}
