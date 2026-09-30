import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/session.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

const _positionOrder = {'Portero': 1, 'Defensa': 2, 'Medio': 3, 'Delantero': 4};

class RefereeMatchControlScreen extends StatefulWidget {
  const RefereeMatchControlScreen({super.key, required this.matchId});
  final String matchId;

  @override
  State<RefereeMatchControlScreen> createState() =>
      _RefereeMatchControlScreenState();
}

class _RefereeMatchControlScreenState extends State<RefereeMatchControlScreen> {
  MatchModel? _match;
  String? _leagueName;
  int _matchDuration = 90;
  int _maxStarters = 11;
  String? _leagueOwnerId;

  bool _loading = true;
  int _timer = 0;
  bool _running = false;
  Timer? _ticker;

  List<MatchEvent> _events = [];
  List<Player> _homePlayers = [];
  List<Player> _awayPlayers = [];

  String get _id => widget.matchId;

  bool get _isAdmin {
    final role = session.role;
    return role == 'admin' ||
        role == 'referee' ||
        (session.user != null && _leagueOwnerId == session.user!.id);
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _setRunning(bool value) {
    _running = value;
    _ticker?.cancel();
    if (value) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _timer++);
      });
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await db
          .from('matches')
          .select('$matchWithTeamsSelect, '
              'league:leagues(name, match_duration, format, owner_id)')
          .eq('id', _id)
          .single();
      final league = embedded(data['league']);
      _leagueName = league?['name'] as String?;
      _matchDuration = (league?['match_duration'] as num?)?.toInt() ?? 90;
      _maxStarters = int.tryParse('${league?['format'] ?? '11'}') ?? 11;
      _leagueOwnerId = league?['owner_id'] as String?;
      final m = MatchModel.fromJson(data);
      _match = m;
      _timer = m.currentSeconds();
      _setRunning(m.status == 'live');

      final players = await db
          .from('players')
          .select()
          .inFilter('team_id', [m.homeTeamId, m.awayTeamId]);
      final sorted = players.map(Player.fromJson).toList()
        ..sort((a, b) {
          final pa = _positionOrder[a.position] ?? 99;
          final pb = _positionOrder[b.position] ?? 99;
          if (pa != pb) return pa.compareTo(pb);
          return (a.number ?? 0).compareTo(b.number ?? 0);
        });
      _homePlayers = sorted.where((p) => p.teamId == m.homeTeamId).toList();
      _awayPlayers = sorted.where((p) => p.teamId == m.awayTeamId).toList();

      await _loadEvents();

      if ((m.lineups == null || m.lineups!.isEmpty) && m.isScheduled) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _openLineups());
      }
    } catch (e) {
      debugPrint('Error loading match: $e');
      if (mounted) showToast(context, 'Error al cargar datos', ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadEvents() async {
    final data = await db
        .from('match_events')
        .select('*, '
            'player:players!match_events_player_id_fkey(name, number), '
            'player_in:players!match_events_player_in_id_fkey(name, number)')
        .eq('match_id', _id)
        .order('created_at', ascending: false);
    if (mounted) setState(() => _events = data.map(MatchEvent.fromJson).toList());
  }

  Future<bool> _update(Map<String, dynamic> data, String errorMsg) async {
    try {
      await db.from('matches').update(data).eq('id', _id);
      setState(() => _match = _match!.merge(data));
      return true;
    } catch (e) {
      if (mounted) showToast(context, errorMsg, ToastType.error);
      return false;
    }
  }

  String get _nowIso => DateTime.now().toUtc().toIso8601String();

  // ---------------- Marcador / estado ----------------

  Future<void> _changeScore(bool home, int delta) async {
    final m = _match!;
    final field = home ? 'home_score' : 'away_score';
    final current = (home ? m.homeScore : m.awayScore) ?? 0;
    final next = (current + delta) < 0 ? 0 : current + delta;
    await _update({field: next}, 'Error al actualizar marcador');
  }

  Future<void> _startMatch() async {
    final m = _match!;
    if (m.lineups == null || m.lineups!.isEmpty) {
      showToast(context, 'Debes registrar las alineaciones antes de iniciar',
          ToastType.error);
      _openLineups();
      return;
    }
    if (await _update({'status': 'live', 'last_start_time': _nowIso},
        'Error al actualizar estado')) {
      setState(() => _setRunning(true));
      if (mounted) showToast(context, 'Estado actualizado: En Vivo', ToastType.success);
    }
  }

  Future<void> _pause() async {
    if (await _update({
      'status': 'break',
      'elapsed_seconds': _timer,
      'last_start_time': null,
    }, 'Error al pausar')) {
      setState(() => _setRunning(false));
    }
  }

  Future<void> _resume() async {
    if (await _update({'status': 'live', 'last_start_time': _nowIso},
        'Error al reanudar')) {
      setState(() => _setRunning(true));
    }
  }

  Future<void> _endFirstHalf() async {
    if (!await confirmDialog(context, '¿Confirmar fin del 1er tiempo?')) return;
    if (await _update({
      'status': 'break',
      'elapsed_seconds': _timer,
      'last_start_time': null,
      'current_period': 2,
    }, 'Error al finalizar 1er tiempo')) {
      setState(() => _setRunning(false));
      if (mounted) showToast(context, 'Fin del 1er Tiempo', ToastType.success);
    }
  }

  Future<void> _startSecondHalf() async {
    final half = (_matchDuration / 2 * 60).round();
    final newTimer = _timer < half ? half : _timer;
    if (await _update({
      'status': 'live',
      'current_period': 2,
      'elapsed_seconds': newTimer,
      // En React faltaba: sin esto el reloj público se congelaba en el 2T.
      'last_start_time': _nowIso,
    }, 'Error al iniciar 2do tiempo')) {
      setState(() {
        _timer = newTimer;
        _setRunning(true);
      });
      if (mounted) showToast(context, '2do Tiempo iniciado', ToastType.success);
    }
  }

  Future<void> _finish() async {
    if (!await confirmDialog(context, '¿Confirmar fin del partido?')) return;
    if (await _update({
      'status': 'finished',
      'elapsed_seconds': _timer,
      'last_start_time': null,
    }, 'Error al actualizar estado')) {
      _setRunning(false);
      if (!mounted) return;
      showToast(context, 'Estado actualizado: Finalizado', ToastType.success);
      context.canPop() ? context.pop() : context.go('/calendar');
    }
  }

  Future<void> _addMinute() async {
    final m = _match!;
    setState(() => _timer += 60);
    // Se persiste para que el reloj público también avance.
    final base = _running ? m.elapsedSeconds + 60 : _timer;
    await _update({'elapsed_seconds': base}, 'Error al ajustar tiempo');
  }

  Future<void> _restart() async {
    if (!await confirmDialog(context,
        '¿Reiniciar el partido? Se borrarán marcador, alineaciones y eventos.',
        destructive: true)) {
      return;
    }
    setState(() => _loading = true);
    final reset = {
      'status': 'scheduled',
      'home_score': 0,
      'away_score': 0,
      'elapsed_seconds': 0,
      'current_period': 1,
      'last_start_time': null,
      'lineups': null,
    };
    try {
      await db.from('matches').update(reset).eq('id', _id);
    } catch (e) {
      if (mounted) {
        showToast(context, 'Error al reiniciar partido', ToastType.error);
        setState(() => _loading = false);
      }
      return;
    }
    try {
      await db.from('match_events').delete().eq('match_id', _id);
      _match = _match!.merge(reset);
      _events = [];
      _timer = 0;
      _setRunning(false);
      if (mounted) showToast(context, 'Partido reiniciado', ToastType.success);
      WidgetsBinding.instance.addPostFrameCallback((_) => _openLineups());
    } catch (e) {
      if (mounted) showToast(context, 'Error al borrar eventos', ToastType.error);
    }
    if (mounted) setState(() => _loading = false);
  }

  // ---------------- Alineaciones ----------------

  Future<void> _openLineups() async {
    final m = _match;
    if (m == null || !mounted) return;
    final home = <String>{...?(m.lineups?['home'] as List?)?.cast<String>()};
    final away = <String>{...?(m.lineups?['away'] as List?)?.cast<String>()};
    var step = 'home';
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      useSafeArea: true,
      backgroundColor: AppColors.surfaceDark,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setLocal) {
        final players = step == 'home' ? _homePlayers : _awayPlayers;
        final selected = step == 'home' ? home : away;
        return SizedBox(
          height: MediaQuery.of(ctx).size.height * 0.85,
          child: Column(children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Column(children: [
                Text('Alineaciones Iniciales',
                    style:
                        TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                Text('Selecciona los titulares',
                    style: TextStyle(color: AppColors.textSecondary)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SegmentedButton<String>(
                segments: [
                  ButtonSegment(
                      value: 'home',
                      label: Text('${m.homeTeam?.name ?? 'Local'} (${home.length})',
                          overflow: TextOverflow.ellipsis)),
                  ButtonSegment(
                      value: 'away',
                      label: Text('${m.awayTeam?.name ?? 'Visitante'} (${away.length})',
                          overflow: TextOverflow.ellipsis)),
                ],
                selected: {step},
                onSelectionChanged: (s) => setLocal(() => step = s.first),
              ),
            ),
            Expanded(
              child: ListView(children: [
                for (final p in players)
                  CheckboxListTile(
                    value: selected.contains(p.id),
                    secondary: CircleAvatar(child: Text('${p.number ?? '#'}')),
                    title: Text(p.name),
                    subtitle: Text(p.position ?? ''),
                    onChanged: (v) => setLocal(() {
                      if (selected.contains(p.id)) {
                        selected.remove(p.id);
                      } else if (selected.length >= _maxStarters) {
                        showToast(context,
                            'Máximo $_maxStarters jugadores titulares',
                            ToastType.error);
                      } else {
                        selected.add(p.id);
                      }
                    }),
                  ),
                if (players.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No hay jugadores registrados en este equipo.',
                        textAlign: TextAlign.center),
                  ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Cerrar')),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Confirmar Alineaciones'),
                  ),
                ),
              ]),
            ),
          ]),
        );
      }),
    );
    if (saved == true) {
      final lineups = {'home': home.toList(), 'away': away.toList()};
      if (await _update({'lineups': lineups}, 'Error al guardar alineaciones') &&
          mounted) {
        showToast(context, 'Alineaciones confirmadas', ToastType.success);
      }
    }
  }

  // ---------------- Eventos ----------------

  ({bool hasRed, int yellow}) _cardStatus(String playerId) {
    final evs = _events.where((e) => e.playerId == playerId);
    return (
      hasRed: evs.any((e) => e.eventType == 'red_card'),
      yellow: evs.where((e) => e.eventType == 'yellow_card').length,
    );
  }

  Future<void> _triggerEvent(String type, bool home) async {
    final m = _match!;
    final teamId = home ? m.homeTeamId : m.awayTeamId;
    final teamName = (home ? m.homeTeam?.name : m.awayTeam?.name) ?? '';
    final players = home ? _homePlayers : _awayPlayers;

    // Titulares actuales = alineación inicial - salen + entran.
    final lineupKey = home ? 'home' : 'away';
    final initial =
        (m.lineups?[lineupKey] as List?)?.cast<String>() ?? const <String>[];
    final subs = _events
        .where((e) => e.teamId == teamId && e.eventType == 'substitution');
    final outIds = subs.map((e) => e.playerId).toSet();
    final onField = {
      ...initial.where((id) => !outIds.contains(id)),
      ...subs.map((e) => e.playerInId).whereType<String>(),
    };

    final pick = await showModalBottomSheet<_EventPick>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.surfaceDark,
      builder: (_) => _EventPickerSheet(
        type: type,
        teamName: teamName,
        players: players,
        onFieldIds: onField,
        cardStatus: _cardStatus,
      ),
    );
    if (pick == null) return;

    final minute = _timer ~/ 60 + 1;
    final payload = {
      'match_id': _id,
      'player_id': pick.playerId,
      'team_id': teamId,
      'event_type': type,
      'minute': minute,
      if (type == 'substitution') 'player_in_id': pick.playerInId,
    };
    try {
      await db.from('match_events').insert(payload);
      if (mounted) showToast(context, 'Evento registrado', ToastType.success);
      if (type == 'goal') await _changeScore(home, 1);
      if (type == 'yellow_card' && pick.playerId != null) {
        final previous = _events
            .where((e) =>
                e.playerId == pick.playerId && e.eventType == 'yellow_card')
            .length;
        if (previous >= 1) {
          await db.from('match_events').insert({
            'match_id': _id,
            'player_id': pick.playerId,
            'team_id': teamId,
            'event_type': 'red_card',
            'minute': minute,
          });
          if (mounted) {
            showToast(context, 'Doble Amarilla: Jugador Expulsado',
                ToastType.error);
          }
        }
      }
      await _loadEvents();
    } catch (e) {
      if (mounted) showToast(context, 'Error: ${errorMessage(e)}', ToastType.error);
    }
  }

  // ---------------- UI ----------------

  String get _mainButtonLabel {
    final m = _match!;
    if (m.status == 'scheduled') return 'Iniciar Partido';
    if (m.status == 'live' && _running) return 'Pausar';
    if (m.status == 'break' && m.currentPeriod == 2) {
      final half = _matchDuration / 2 * 60;
      return _timer > half + 60 ? 'Reanudar' : 'Iniciar 2do Tiempo';
    }
    return 'Reanudar';
  }

  void _mainAction() {
    final m = _match!;
    if (m.status == 'break' && m.currentPeriod == 2) {
      _startSecondHalf();
    } else if (m.status == 'scheduled') {
      _startMatch();
    } else if (_running) {
      _pause();
    } else {
      _resume();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingView());
    final m = _match;
    if (m == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: Text('Error')));
    }
    final periodLabel = m.status == 'break'
        ? 'Entretiempo'
        : m.currentPeriod == 1
            ? '1er Tiempo'
            : '2do Tiempo';

    return Scaffold(
      appBar: AppBar(
        centerTitle: false,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${_leagueName ?? 'Liga'} • $periodLabel',
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textSecondary)),
          Text('${m.homeTeam?.name} vs ${m.awayTeam?.name}',
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16)),
        ]),
        actions: [
          if (m.status == 'live' && m.currentPeriod == 1)
            TextButton(onPressed: _endFirstHalf, child: const Text('Fin 1T')),
          if (m.status != 'finished')
            TextButton(
              onPressed: _finish,
              child: const Text('Finalizar',
                  style: TextStyle(color: AppColors.danger)),
            ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'lineups') _openLineups();
              if (v == 'restart') _restart();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'lineups', child: Text('Alineaciones')),
              if (_isAdmin)
                const PopupMenuItem(
                    value: 'restart', child: Text('Reiniciar Partido')),
            ],
          ),
        ],
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        _scoreboard(m),
        const SizedBox(height: 16),
        LayoutBuilder(builder: (context, c) {
          final home = _actions(true, m);
          final away = _actions(false, m);
          if (c.maxWidth > 700) {
            return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: home),
              const SizedBox(width: 12),
              Expanded(child: away),
            ]);
          }
          return Column(children: [home, const SizedBox(height: 12), away]);
        }),
        const SectionTitle('Historial del Partido'),
        if (_events.isEmpty)
          const Text('Aún no hay eventos registrados.',
              style: TextStyle(color: AppColors.textSecondary))
        else
          for (final e in _events) _eventRow(m, e),
      ]),
    );
  }

  Widget _scoreboard(MatchModel m) {
    Widget team(TeamRef? t) => Expanded(
          child: Column(children: [
            TeamShield(url: t?.shieldUrl, size: 56),
            const SizedBox(height: 6),
            Text(t?.name ?? '',
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.bold)),
          ]),
        );
    Widget score(bool home) => Column(children: [
          Text('${(home ? m.homeScore : m.awayScore) ?? 0}',
              style:
                  const TextStyle(fontSize: 44, fontWeight: FontWeight.w900)),
          TextButton(
            onPressed: () => _changeScore(home, -1),
            child: const Text('-1'),
          ),
        ]);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            team(m.homeTeam),
            Column(children: [
              Text(formatSeconds(_timer),
                  style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      fontFeatures: [FontFeature.tabularFigures()])),
              Row(children: [
                score(true),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Text('-', style: TextStyle(fontSize: 32)),
                ),
                score(false),
              ]),
            ]),
            team(m.awayTeam),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            OutlinedButton(
                onPressed: _addMinute, child: const Text('+1 Min')),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                onPressed: m.isFinished ? null : _mainAction,
                icon: Icon(m.status == 'live' && _running
                    ? Icons.pause
                    : Icons.play_arrow),
                label: Text(_mainButtonLabel),
              ),
            ),
          ]),
        ]),
      ),
    );
  }

  Widget _actions(bool home, MatchModel m) {
    final name = home ? m.homeTeam?.name : m.awayTeam?.name;
    Widget btn(String label, IconData icon, Color color, String type) =>
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: BorderSide(color: color.withValues(alpha: 0.6)),
              ),
              onPressed: () => _triggerEvent(type, home),
              child: Column(children: [
                Icon(icon, color: color),
                const SizedBox(height: 4),
                Text(label, style: const TextStyle(fontSize: 12)),
              ]),
            ),
          ),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('$name (${home ? 'Local' : 'Visitante'})',
              style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Row(children: [
            btn('Gol', Icons.sports_soccer, AppColors.success, 'goal'),
            btn('Amarilla', Icons.style, AppColors.yellowCard, 'yellow_card'),
            btn('Roja', Icons.style, AppColors.redCard, 'red_card'),
            btn('Cambio', Icons.swap_horiz, Colors.lightBlueAccent,
                'substitution'),
          ]),
        ]),
      ),
    );
  }

  Widget _eventRow(MatchModel m, MatchEvent e) {
    final isHome = e.teamId == m.homeTeamId;
    final teamName = isHome ? m.homeTeam?.name : m.awayTeam?.name;
    final (icon, color) = switch (e.eventType) {
      'goal' => (Icons.sports_soccer, AppColors.success),
      'yellow_card' => (Icons.style, AppColors.yellowCard),
      'red_card' => (Icons.style, AppColors.redCard),
      _ => (Icons.swap_horiz, Colors.lightBlueAccent),
    };
    final who = e.playerName != null
        ? '${e.playerName} #${e.playerNumber ?? ''}'
        : 'Jugador no identificado';
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: SizedBox(
        width: 72,
        child: Row(children: [
          Text("${e.minute ?? '-'}'",
              style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(width: 8),
          Icon(icon, color: color),
        ]),
      ),
      title: Text(
          e.eventType == 'goal' ? 'Gol' : e.label,
          style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text([
        teamName ?? '',
        who,
        if (e.eventType == 'substitution' && e.playerInName != null)
          '→ Entra: ${e.playerInName} #${e.playerInNumber ?? ''}',
      ].join(' · ')),
      iconColor: isHome ? Colors.blueAccent : Colors.pinkAccent,
    );
  }
}

class _EventPick {
  const _EventPick(this.playerId, [this.playerInId]);
  final String? playerId;
  final String? playerInId;
}

/// Selector de jugador para goles, tarjetas y cambios.
class _EventPickerSheet extends StatefulWidget {
  const _EventPickerSheet({
    required this.type,
    required this.teamName,
    required this.players,
    required this.onFieldIds,
    required this.cardStatus,
  });

  final String type;
  final String teamName;
  final List<Player> players;
  final Set<String> onFieldIds;
  final ({bool hasRed, int yellow}) Function(String) cardStatus;

  @override
  State<_EventPickerSheet> createState() => _EventPickerSheetState();
}

class _EventPickerSheetState extends State<_EventPickerSheet> {
  String? _confirmId;
  String? _outId; // en cambios: jugador que sale
  String? _error;

  bool get _isSub => widget.type == 'substitution';
  bool get _isCard =>
      widget.type == 'yellow_card' || widget.type == 'red_card';

  void _tap(Player p) {
    final status = widget.cardStatus(p.id);
    setState(() => _error = null);

    if (_isSub) {
      if (_outId == null) {
        setState(() => _outId = p.id);
        return;
      }
      if (p.id == _outId) {
        setState(() =>
            _error = 'El jugador que entra no puede ser el mismo que sale');
        return;
      }
      Navigator.pop(context, _EventPick(_outId, p.id));
      return;
    }
    if (widget.type == 'goal' && status.hasRed) {
      setState(() => _error = 'Jugador expulsado no puede anotar');
      return;
    }
    if (_isCard) {
      if (status.hasRed) {
        setState(() => _error = widget.type == 'red_card'
            ? 'Jugador ya está expulsado'
            : 'Jugador ya tiene tarjeta roja');
        return;
      }
      if (_confirmId != p.id) {
        setState(() => _confirmId = p.id);
        return;
      }
    }
    Navigator.pop(context, _EventPick(p.id));
  }

  Widget _tile(Player p) {
    final status = widget.cardStatus(p.id);
    final confirming = _confirmId == p.id;
    final isOut = _isSub && _outId == p.id;
    final disabled = status.hasRed || isOut;

    var title = p.name;
    var sub = '#${p.number ?? ''} • ${p.position ?? ''}';
    if (confirming) {
      if (widget.type == 'yellow_card') {
        title = status.yellow > 0 ? 'Confirmar Expulsión' : 'Confirmar Amarilla';
        sub = status.yellow > 0 ? '2da Amarilla = Roja' : 'Toque de nuevo';
      } else {
        title = 'Confirmar Roja';
        sub = 'Expulsión Directa';
      }
    }
    return ListTile(
      enabled: !disabled,
      tileColor: confirming ? AppColors.danger.withValues(alpha: 0.15) : null,
      leading: Stack(clipBehavior: Clip.none, children: [
        p.photoUrl != null
            ? Avatar(url: p.photoUrl, size: 40)
            : CircleAvatar(child: Text('${p.number ?? '#'}')),
        if (status.yellow > 0 && !status.hasRed)
          Positioned(
              right: -2,
              top: -2,
              child: Container(
                  width: 10, height: 14, color: AppColors.yellowCard)),
        if (status.hasRed)
          Positioned(
              right: -2,
              top: -2,
              child:
                  Container(width: 10, height: 14, color: AppColors.redCard)),
      ]),
      title: Text(title,
          style: TextStyle(
              fontWeight: FontWeight.w600,
              color: confirming ? AppColors.danger : null)),
      subtitle: Text([
        sub,
        if (status.hasRed) 'Expulsado',
        if (isOut) 'Sale del campo',
      ].join(' · ')),
      trailing: confirming ? const Icon(Icons.priority_high) : null,
      onTap: disabled ? null : () => _tap(p),
    );
  }

  @override
  Widget build(BuildContext context) {
    final starters =
        widget.players.where((p) => widget.onFieldIds.contains(p.id)).toList();
    final bench =
        widget.players.where((p) => !widget.onFieldIds.contains(p.id)).toList();
    final outName = widget.players.where((p) => p.id == _outId).firstOrNull?.name;

    Widget label(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Text(t.toUpperCase(),
              style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textSecondary)),
        );

    final children = <Widget>[];
    if (_isSub) {
      if (_outId == null) {
        children.add(label('Titulares (En Cancha)'));
        children.addAll(starters.map(_tile));
        if (starters.isEmpty) {
          children.add(const Padding(
              padding: EdgeInsets.all(16),
              child: Text('No hay titulares registrados.')));
        }
      } else {
        children.add(label('Suplentes (Banca)'));
        children.addAll(bench.map(_tile));
        if (bench.isEmpty) {
          children.add(const Padding(
              padding: EdgeInsets.all(16),
              child: Text('No hay suplentes disponibles.')));
        }
      }
    } else {
      if (widget.type == 'goal') {
        children.add(ListTile(
          leading: const CircleAvatar(child: Icon(Icons.sports_soccer)),
          title: const Text('Gol General'),
          subtitle: const Text('Sin jugador específico'),
          onTap: () => Navigator.pop(context, const _EventPick(null)),
        ));
      }
      if (_isCard) {
        children.add(ListTile(
          leading: const CircleAvatar(child: Text('CT')),
          title: const Text('Sin Jugador'),
          subtitle: const Text('Tarjeta General'),
          trailing: const Icon(Icons.add),
          onTap: () => Navigator.pop(context, const _EventPick(null)),
        ));
      }
      children.add(label('Titulares'));
      children.addAll(starters.map(_tile));
      children.add(label('Banca'));
      children.addAll(bench.map(_tile));
    }

    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.8,
      child: Column(children: [
        ListTile(
          title: Text(
            _isSub
                ? (_outId == null ? '¿Quién sale?' : '¿Quién entra?')
                : 'Seleccionar Jugador',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          subtitle: Text(_isSub && outName != null
              ? '${widget.teamName} · Sale: $outName'
              : widget.teamName),
          trailing: IconButton(
              icon: const Icon(Icons.close),
              onPressed: () => Navigator.pop(context)),
        ),
        if (_error != null)
          Container(
            width: double.infinity,
            margin: const EdgeInsets.symmetric(horizontal: 16),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(_error!,
                style: const TextStyle(color: AppColors.danger)),
          ),
        if (widget.players.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Text('No hay jugadores registrados en este equipo.'),
          ),
        Expanded(child: ListView(children: children)),
      ]),
    );
  }
}
