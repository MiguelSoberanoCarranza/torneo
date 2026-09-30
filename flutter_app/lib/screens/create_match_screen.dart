import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/repo.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../widgets/common.dart';

/// Crear partido manual.
/// (En React no se enviaba league_id —columna NOT NULL— y el insert fallaba;
/// aquí se elige primero la liga.)
class CreateMatchScreen extends StatefulWidget {
  const CreateMatchScreen({super.key});

  @override
  State<CreateMatchScreen> createState() => _CreateMatchScreenState();
}

class _CreateMatchScreenState extends State<CreateMatchScreen> {
  List<League> _leagues = [];
  String? _leagueId;
  List<Team> _teams = [];
  String? _homeId;
  String? _awayId;
  DateTime? _date;
  TimeOfDay? _time;
  final _location = TextEditingController();
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _location.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    _leagues = await fetchOwnedActiveLeagues();
    if (_leagues.isNotEmpty) {
      _leagueId = _leagues.first.id;
      await _loadTeams();
    }
    if (mounted) setState(() {});
  }

  Future<void> _loadTeams() async {
    final data = await db
        .from('teams')
        .select('id, name')
        .eq('league_id', _leagueId!)
        .order('name');
    if (!mounted) return;
    setState(() {
      _teams = data.map(Team.fromJson).toList();
      _homeId = null;
      _awayId = null;
    });
  }

  Future<void> _save() async {
    if (_leagueId == null ||
        _homeId == null ||
        _awayId == null ||
        _date == null ||
        _time == null) {
      showToast(context, 'Completa los campos obligatorios', ToastType.error);
      return;
    }
    if (_homeId == _awayId) {
      showToast(context, 'El equipo local y visitante no pueden ser el mismo',
          ToastType.error);
      return;
    }
    setState(() => _loading = true);
    try {
      final start = DateTime(_date!.year, _date!.month, _date!.day,
          _time!.hour, _time!.minute);
      await db.from('matches').insert({
        'league_id': _leagueId,
        'home_team_id': _homeId,
        'away_team_id': _awayId,
        'start_time': start.toUtc().toIso8601String(),
        'location': _location.text.trim(),
        'status': 'scheduled',
      });
      if (!mounted) return;
      showToast(context, 'Partido creado exitosamente', ToastType.success);
      context.pop();
    } catch (e) {
      if (mounted) {
        showToast(context, 'Error al crear partido: ${errorMessage(e)}',
            ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final teamItems = [for (final t in _teams) (t.id, t.name)];
    return Scaffold(
      appBar: AppBar(title: const Text('Crear Partido Manual')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        LabeledField(
          label: 'Liga',
          child: LeagueDropdown(
            leagues: _leagues,
            selectedId: _leagueId,
            onChanged: (id) {
              _leagueId = id;
              _loadTeams();
            },
          ),
        ),
        LabeledField(
          label: 'Equipo Local',
          child: SimpleDropdown<String>(
            value: _homeId,
            hint: 'Seleccionar Equipo',
            items: teamItems,
            onChanged: (v) => setState(() => _homeId = v),
          ),
        ),
        LabeledField(
          label: 'Equipo Visitante',
          child: SimpleDropdown<String>(
            value: _awayId,
            hint: 'Seleccionar Equipo',
            items: teamItems,
            onChanged: (v) => setState(() => _awayId = v),
          ),
        ),
        Row(children: [
          Expanded(
            child: LabeledField(
              label: 'Fecha',
              child: OutlinedButton(
                onPressed: () async {
                  final d = await showDatePicker(
                    context: context,
                    initialDate: _date ?? DateTime.now(),
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2100),
                  );
                  if (d != null) setState(() => _date = d);
                },
                child: Text(_date == null ? 'Elegir' : formatDateMedium(_date)),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: LabeledField(
              label: 'Hora',
              child: OutlinedButton(
                onPressed: () async {
                  final t = await showTimePicker(
                      context: context,
                      initialTime: _time ?? const TimeOfDay(hour: 9, minute: 0));
                  if (t != null) setState(() => _time = t);
                },
                child: Text(_time == null ? 'Elegir' : _time!.format(context)),
              ),
            ),
          ),
        ]),
        LabeledField(
          label: 'Ubicación / Cancha',
          child: TextField(
              controller: _location,
              decoration: const InputDecoration(hintText: 'Ej. Cancha 1')),
        ),
        FilledButton(
          onPressed: _loading ? null : _save,
          child: Text(_loading ? 'Creando...' : 'Crear Partido'),
        ),
      ]),
    );
  }
}
