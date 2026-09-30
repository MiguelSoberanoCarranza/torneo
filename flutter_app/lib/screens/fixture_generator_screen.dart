import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/repo.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../logic/fixture.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

const _days = [
  (DateTime.monday, 'Lun'),
  (DateTime.tuesday, 'Mar'),
  (DateTime.wednesday, 'Mié'),
  (DateTime.thursday, 'Jue'),
  (DateTime.friday, 'Vie'),
  (DateTime.saturday, 'Sáb'),
  (DateTime.sunday, 'Dom'),
];

class FixtureGeneratorScreen extends StatefulWidget {
  const FixtureGeneratorScreen({super.key});

  @override
  State<FixtureGeneratorScreen> createState() => _FixtureGeneratorScreenState();
}

class _FixtureGeneratorScreenState extends State<FixtureGeneratorScreen> {
  List<League> _leagues = [];
  String? _leagueId;
  DateTime _startDate = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 9, minute: 0);
  final _duration = TextEditingController(text: '40');
  final _break = TextEditingController(text: '10');
  final Set<int> _weekdays = {DateTime.saturday};
  bool _homeAndAway = false;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _duration.dispose();
    _break.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    _leagues = await fetchOwnedActiveLeagues();
    if (_leagues.isNotEmpty) _selectLeague(_leagues.first.id);
    if (mounted) setState(() {});
  }

  void _selectLeague(String id) {
    _leagueId = id;
    final l = _leagues.firstWhere((x) => x.id == id);
    if (l.matchDuration != null) _duration.text = '${l.matchDuration}';
    setState(() {});
  }

  Future<void> _generate() async {
    if (_leagueId == null) {
      showToast(context, 'Selecciona una liga', ToastType.error);
      return;
    }
    setState(() => _loading = true);
    try {
      final teams =
          await db.from('teams').select('id, name').eq('league_id', _leagueId!);
      if (teams.length < 2) {
        if (mounted) {
          showToast(context,
              'Se necesitan al menos 2 equipos para generar un fixture.',
              ToastType.error);
        }
        return;
      }
      final matches = generateRoundRobin(
        teamIds: teams.map((t) => t['id'] as String).toList(),
        startDate: _startDate,
        startHour: _startTime.hour,
        startMinute: _startTime.minute,
        matchDuration: int.tryParse(_duration.text) ?? 40,
        breakDuration: int.tryParse(_break.text) ?? 10,
        allowedWeekdays: _weekdays,
        homeAndAway: _homeAndAway,
      );
      await db
          .from('matches')
          .insert(matches.map((m) => m.toInsert(_leagueId!)).toList());
      if (!mounted) return;
      showToast(context, '¡Fixture generado! ${matches.length} partidos creados.',
          ToastType.success);
      context.pop();
    } catch (e) {
      if (mounted) {
        showToast(context, 'Error al generar: ${errorMessage(e)}', ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Generador de Fixture')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: _loading || _leagues.isEmpty ? null : _generate,
            icon: Icon(_loading ? Icons.refresh : Icons.auto_fix_high),
            label: Text(_loading ? 'Generando...' : 'Generar Calendario'),
          ),
        ),
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        LabeledField(
          label: 'Seleccionar Liga',
          child: _leagues.isEmpty
              ? const Text('Cargando ligas...')
              : LeagueDropdown(
                  leagues: _leagues,
                  selectedId: _leagueId,
                  onChanged: _selectLeague,
                ),
        ),
        Row(children: [
          Expanded(
            child: LabeledField(
              label: 'Fecha Inicio',
              child: OutlinedButton(
                onPressed: () async {
                  final d = await showDatePicker(
                    context: context,
                    initialDate: _startDate,
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2100),
                  );
                  if (d != null) setState(() => _startDate = d);
                },
                child: Text(formatDateMedium(_startDate)),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: LabeledField(
              label: 'Hora Inicio',
              child: OutlinedButton(
                onPressed: () async {
                  final t = await showTimePicker(
                      context: context, initialTime: _startTime);
                  if (t != null) setState(() => _startTime = t);
                },
                child: Text(_startTime.format(context)),
              ),
            ),
          ),
        ]),
        Row(children: [
          Expanded(
            child: LabeledField(
              label: 'Duración (min)',
              child: TextField(
                  controller: _duration, keyboardType: TextInputType.number),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: LabeledField(
              label: 'Descanso (min)',
              child: TextField(
                  controller: _break, keyboardType: TextInputType.number),
            ),
          ),
        ]),
        LabeledField(
          label: 'Días de Juego Principal',
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final (day, label) in _days)
                FilterChip(
                  label: Text(label),
                  selected: _weekdays.contains(day),
                  onSelected: (sel) => setState(() {
                    if (sel) {
                      _weekdays.add(day);
                    } else if (_weekdays.length > 1) {
                      _weekdays.remove(day);
                    }
                  }),
                ),
            ]),
            const SizedBox(height: 6),
            const Text(
                'El sistema buscará el próximo día disponible a partir de la fecha de inicio.',
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ]),
        ),
        const SectionTitle('Reglas Avanzadas'),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          secondary: const Icon(Icons.sync_alt),
          title: const Text('Ida y Vuelta'),
          subtitle: const Text('Dos partidos por enfrentamiento'),
          value: _homeAndAway,
          onChanged: (v) => setState(() => _homeAndAway = v),
        ),
      ]),
    );
  }
}
