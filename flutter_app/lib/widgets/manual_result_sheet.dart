import 'package:flutter/material.dart';

import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';

class _Entry {
  _Entry({this.name = '', this.minute = '', this.type = 'goal'});
  String name;
  String minute;
  String type; // goal | yellow_card | red_card
}

/// Captura manual de resultado, goleadores y tarjetas.
/// Compartido por Calendario y Liguilla (antes duplicado en ambos).
/// Devuelve los campos actualizados del partido si se guardó el marcador.
Future<Map<String, dynamic>?> showManualResultSheet(
  BuildContext context, {
  required MatchModel match,
  required String homeName,
  required String awayName,
}) {
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.surfaceDark,
    builder: (_) => _ManualResultSheet(
        match: match, homeName: homeName, awayName: awayName),
  );
}

class _ManualResultSheet extends StatefulWidget {
  const _ManualResultSheet({
    required this.match,
    required this.homeName,
    required this.awayName,
  });

  final MatchModel match;
  final String homeName;
  final String awayName;

  @override
  State<_ManualResultSheet> createState() => _ManualResultSheetState();
}

class _ManualResultSheetState extends State<_ManualResultSheet> {
  late final TextEditingController _homeScore;
  late final TextEditingController _awayScore;
  bool _finished = true;
  bool _loading = true;
  bool _saving = false;

  List<Map<String, dynamic>> _homePlayers = [];
  List<Map<String, dynamic>> _awayPlayers = [];
  List<_Entry> _homeGoals = [];
  List<_Entry> _awayGoals = [];
  List<_Entry> _homeCards = [];
  List<_Entry> _awayCards = [];

  MatchModel get m => widget.match;

  @override
  void initState() {
    super.initState();
    _homeScore = TextEditingController(text: m.homeScore?.toString() ?? '');
    _awayScore = TextEditingController(text: m.awayScore?.toString() ?? '');
    _finished = m.isFinished;
    _load();
  }

  @override
  void dispose() {
    _homeScore.dispose();
    _awayScore.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final players = await db
          .from('players')
          .select('id, name, team_id, number')
          .inFilter('team_id', [m.homeTeamId, m.awayTeamId]);
      _homePlayers =
          players.where((p) => p['team_id'] == m.homeTeamId).toList();
      _awayPlayers =
          players.where((p) => p['team_id'] == m.awayTeamId).toList();

      final events = await db
          .from('match_events')
          .select('id, event_type, team_id, minute, '
              'player:players!match_events_player_id_fkey(name)')
          .eq('match_id', m.id);

      _Entry toEntry(Map<String, dynamic> e) => _Entry(
            name: (embedded(e['player'])?['name'] ?? '') as String,
            minute: e['minute']?.toString() ?? '',
            type: e['event_type'] as String,
          );
      List<_Entry> goals(String teamId, int score) {
        final existing = events
            .where((e) => e['event_type'] == 'goal' && e['team_id'] == teamId)
            .map(toEntry)
            .toList();
        return List.generate(score < 0 ? 0 : score,
            (i) => i < existing.length ? existing[i] : _Entry());
      }

      List<_Entry> cards(String teamId) => events
          .where((e) =>
              (e['event_type'] == 'yellow_card' ||
                  e['event_type'] == 'red_card') &&
              e['team_id'] == teamId)
          .map(toEntry)
          .toList();

      _homeGoals = goals(m.homeTeamId, m.homeScore ?? 0);
      _awayGoals = goals(m.awayTeamId, m.awayScore ?? 0);
      _homeCards = cards(m.homeTeamId);
      _awayCards = cards(m.awayTeamId);
    } catch (e) {
      if (mounted) showToast(context, 'Error: ${errorMessage(e)}', ToastType.error);
    }
    if (mounted) setState(() => _loading = false);
  }

  void _resizeGoals(List<_Entry> list, String value) {
    final count = int.tryParse(value) ?? 0;
    setState(() {
      if (count > list.length) {
        list.addAll(List.generate(count - list.length, (_) => _Entry()));
      } else if (count >= 0) {
        list.removeRange(count, list.length);
      }
    });
  }

  void _doubleDefault() {
    setState(() {
      _homeScore.text = '-1';
      _awayScore.text = '-1';
      _finished = true;
      _homeGoals.clear();
      _awayGoals.clear();
      _homeCards.clear();
      _awayCards.clear();
    });
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);

    final updates = <String, dynamic>{};
    if (_homeScore.text.trim() == '-1' && _awayScore.text.trim() == '-1') {
      updates.addAll(
          {'home_score': -1, 'away_score': -1, 'status': 'finished'});
    } else {
      updates['home_score'] = int.tryParse(_homeScore.text.trim()) ?? 0;
      updates['away_score'] = int.tryParse(_awayScore.text.trim()) ?? 0;
      if (_finished) updates['status'] = 'finished';
    }

    try {
      await db.from('matches').update(updates).eq('id', m.id);
    } catch (e) {
      if (mounted) {
        showToast(context, 'Error al guardar resultado', ToastType.error);
        setState(() => _saving = false);
      }
      return;
    }

    try {
      await db
          .from('match_events')
          .delete()
          .eq('match_id', m.id)
          .inFilter('event_type', ['goal', 'yellow_card', 'red_card']);

      final homeCache = [..._homePlayers];
      final awayCache = [..._awayPlayers];

      Future<void> process(_Entry item, String teamId, String type,
          List<Map<String, dynamic>> cache) async {
        final name = item.name.trim();
        if (name.isEmpty) return;
        final lower = name.toLowerCase();
        var player = cache
            .where((p) =>
                (p['name'] as String).trim().toLowerCase() == lower)
            .firstOrNull;
        if (player == null) {
          player = await db
              .from('players')
              .insert({
                'name': name,
                'team_id': teamId,
                'number': 0,
                'position': 'Jugador',
              })
              .select()
              .single();
          cache.add(player);
        }
        await db.from('match_events').insert({
          'match_id': m.id,
          'player_id': player['id'],
          'team_id': teamId,
          'event_type': type,
          'minute': int.tryParse(item.minute.trim()) ?? 90,
        });
      }

      for (final g in _homeGoals) {
        await process(g, m.homeTeamId, 'goal', homeCache);
      }
      for (final g in _awayGoals) {
        await process(g, m.awayTeamId, 'goal', awayCache);
      }
      for (final c in _homeCards) {
        await process(c, m.homeTeamId, c.type, homeCache);
      }
      for (final c in _awayCards) {
        await process(c, m.awayTeamId, c.type, awayCache);
      }
      if (!mounted) return;
      showToast(context, 'Resultado y eventos guardados', ToastType.success);
      Navigator.pop(context, updates);
    } catch (e) {
      if (!mounted) return;
      showToast(
          context,
          'Guardado parcial: Marcador OK, pero fallaron eventos. ${errorMessage(e)}',
          ToastType.error);
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Padding(
          padding: EdgeInsets.all(16),
          child: Text('Resultado Manual',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ),
        Flexible(
          child: _loading
              ? const Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator())
              : ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: [
                    Row(children: [
                      Expanded(
                          child: _scoreField(widget.homeName, _homeScore,
                              (v) => _resizeGoals(_homeGoals, v))),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 12),
                        child: Text('-', style: TextStyle(fontSize: 24)),
                      ),
                      Expanded(
                          child: _scoreField(widget.awayName, _awayScore,
                              (v) => _resizeGoals(_awayGoals, v))),
                    ]),
                    if (_homeGoals.isNotEmpty || _awayGoals.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      _goalList('Goleadores (${_short(widget.homeName)})',
                          _homeGoals, _homePlayers),
                      _goalList('Goleadores (${_short(widget.awayName)})',
                          _awayGoals, _awayPlayers),
                    ],
                    const SizedBox(height: 8),
                    _cardList('Tarjetas (${_short(widget.homeName)})',
                        _homeCards, _homePlayers),
                    _cardList('Tarjetas (${_short(widget.awayName)})',
                        _awayCards, _awayPlayers),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _finished,
                      onChanged: (v) => setState(() => _finished = v ?? false),
                      title: const Text('Marcar como Finalizado'),
                      controlAffinity: ListTileControlAffinity.leading,
                    ),
                    OutlinedButton.icon(
                      onPressed: _doubleDefault,
                      icon: const Icon(Icons.block, color: AppColors.danger),
                      label: const Text('Ambos Perdieron (Default)',
                          style: TextStyle(color: AppColors.danger)),
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48)),
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancelar'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48)),
                onPressed: _saving || _loading ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Guardar'),
              ),
            ),
          ]),
        ),
      ]),
    );
  }

  String _short(String s) => s.length > 10 ? s.substring(0, 10) : s;

  Widget _scoreField(String label, TextEditingController c,
      ValueChanged<String> onChanged) {
    return Column(children: [
      Text(label,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
              fontSize: 12, color: AppColors.textSecondary)),
      const SizedBox(height: 6),
      TextField(
        controller: c,
        keyboardType: const TextInputType.numberWithOptions(signed: true),
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
        onChanged: onChanged,
      ),
    ]);
  }

  Widget _goalList(String title, List<_Entry> list,
      List<Map<String, dynamic>> players) {
    if (list.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: AppColors.textSecondary)),
        for (var i = 0; i < list.length; i++)
          Padding(
            key: ObjectKey(list[i]),
            padding: const EdgeInsets.only(top: 6),
            child: Row(children: [
              Expanded(
                child: _PlayerNameField(
                  initial: list[i].name,
                  hint: 'Jugador ${i + 1}',
                  options: players.map((p) => p['name'] as String).toList(),
                  onChanged: (v) => list[i].name = v,
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(width: 64, child: _minuteField(list[i])),
            ]),
          ),
      ]),
    );
  }

  Widget _cardList(String title, List<_Entry> list,
      List<Map<String, dynamic>> players) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text(title,
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textSecondary)),
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () =>
                setState(() => list.add(_Entry(type: 'yellow_card'))),
          ),
        ]),
        if (list.isEmpty)
          const Text('Sin tarjetas',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        for (var i = 0; i < list.length; i++)
          Padding(
            key: ObjectKey(list[i]),
            padding: const EdgeInsets.only(top: 6),
            child: Row(children: [
              Expanded(
                child: _PlayerNameField(
                  initial: list[i].name,
                  hint: 'Jugador',
                  options: players.map((p) => p['name'] as String).toList(),
                  onChanged: (v) => list[i].name = v,
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(width: 56, child: _minuteField(list[i])),
              IconButton(
                tooltip: 'Cambiar color',
                onPressed: () => setState(() => list[i].type =
                    list[i].type == 'yellow_card' ? 'red_card' : 'yellow_card'),
                icon: Container(
                  width: 14,
                  height: 20,
                  decoration: BoxDecoration(
                    color: list[i].type == 'yellow_card'
                        ? AppColors.yellowCard
                        : AppColors.redCard,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 18),
                onPressed: () => setState(() => list.removeAt(i)),
              ),
            ]),
          ),
      ]),
    );
  }

  Widget _minuteField(_Entry e) => TextFormField(
        initialValue: e.minute,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(hintText: 'Min'),
        onChanged: (v) => e.minute = v,
      );
}

/// Campo de texto con autocompletado de jugadores (sustituye <datalist>).
class _PlayerNameField extends StatelessWidget {
  const _PlayerNameField({
    required this.initial,
    required this.hint,
    required this.options,
    required this.onChanged,
  });

  final String initial;
  final String hint;
  final List<String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Autocomplete<String>(
      initialValue: TextEditingValue(text: initial),
      optionsBuilder: (v) {
        final q = v.text.toLowerCase();
        if (q.isEmpty) return options;
        return options.where((o) => o.toLowerCase().contains(q));
      },
      onSelected: onChanged,
      fieldViewBuilder: (context, controller, focusNode, onSubmit) =>
          TextField(
        controller: controller,
        focusNode: focusNode,
        decoration: InputDecoration(hintText: hint),
        onChanged: onChanged,
      ),
    );
  }
}
