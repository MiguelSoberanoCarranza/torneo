import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/repo.dart';
import '../core/session.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class CreateLeagueScreen extends StatefulWidget {
  const CreateLeagueScreen({super.key, this.leagueId});
  final String? leagueId;

  @override
  State<CreateLeagueScreen> createState() => _CreateLeagueScreenState();
}

class _CreateLeagueScreenState extends State<CreateLeagueScreen> {
  final _name = TextEditingController();
  final _description = TextEditingController();
  final _duration = TextEditingController(text: '45');
  String _format = '5';
  int _maxTeams = 12;
  int _maxPlayers = 20;
  bool _twoLegged = false;
  bool _allowDraws = true;
  String? _logoUrl;
  PickedImage? _logo;
  bool _loading = false;

  bool get _isEditing => widget.leagueId != null;

  @override
  void initState() {
    super.initState();
    if (_isEditing) _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _duration.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data =
          await db.from('leagues').select().eq('id', widget.leagueId!).single();
      final l = League.fromJson(data);
      _name.text = l.name;
      _description.text = l.description ?? '';
      _format = l.format ?? '5';
      _maxTeams = l.maxTeams ?? 12;
      _maxPlayers = l.maxPlayersPerTeam ?? 20;
      _duration.text = '${l.matchDuration ?? 45}';
      _logoUrl = l.logoUrl;
      _twoLegged = l.settings['two_legged'] == true;
      _allowDraws = l.settings['allow_draws'] != false;
    } catch (e) {
      if (mounted) showToast(context, errorMessage(e), ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      showToast(context, 'Por favor ingresa un nombre para la liga.',
          ToastType.error);
      return;
    }
    final user = session.user;
    if (user == null) {
      showToast(context, 'Debes iniciar sesión.', ToastType.error);
      context.go('/admin-login');
      return;
    }
    setState(() => _loading = true);
    try {
      var logoUrl = _logoUrl;
      if (_logo != null) {
        try {
          logoUrl = await uploadPublicImage('league-logos', _logo!);
        } catch (e) {
          if (mounted) {
            showToast(context, 'No se pudo subir el logo.', ToastType.error);
          }
        }
      }
      final data = {
        'name': _name.text.trim(),
        'description': _description.text,
        'format': _format,
        'max_teams': _maxTeams,
        'max_players_per_team': _maxPlayers,
        'match_duration': int.tryParse(_duration.text) ?? 0,
        'logo_url': logoUrl,
        'settings': {'two_legged': _twoLegged, 'allow_draws': _allowDraws},
      };
      if (_isEditing) {
        await db.from('leagues').update(data).eq('id', widget.leagueId!);
      } else {
        await db.from('leagues').insert(
            {'owner_id': user.id, 'status': 'upcoming', ...data});
        await session.refresh();
      }
      if (!mounted) return;
      showToast(
          context,
          _isEditing ? '¡Liga actualizada!' : '¡Liga creada exitosamente!',
          ToastType.success);
      context.canPop() ? context.pop(true) : context.go('/my-leagues');
    } catch (e) {
      if (mounted) {
        showToast(context, 'Error al guardar: ${errorMessage(e)}', ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _stepper(String title, String subtitle, int value, int min,
          ValueChanged<int> onChanged) =>
      ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle,
            style: const TextStyle(color: AppColors.textSecondary)),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton.filledTonal(
              onPressed: value > min ? () => onChanged(value - 1) : null,
              icon: const Icon(Icons.remove)),
          SizedBox(
              width: 36,
              child: Text('$value',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.bold))),
          IconButton.filledTonal(
              onPressed: () => onChanged(value + 1),
              icon: const Icon(Icons.add)),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEditing ? 'Editar Liga' : 'Crear Liga')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: _loading ? null : _save,
            icon: Icon(_isEditing ? Icons.save : Icons.arrow_forward),
            label: Text(_loading
                ? (_isEditing ? 'Guardando...' : 'Creando...')
                : (_isEditing ? 'Guardar Cambios' : 'Crear Liga')),
          ),
        ),
      ),
      body: _loading && _isEditing && _name.text.isEmpty
          ? const LoadingView()
          : ListView(padding: const EdgeInsets.all(16), children: [
              Center(
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () async {
                    final img = await pickImage();
                    if (img != null) setState(() => _logo = img);
                  },
                  child: Column(children: [
                    Container(
                      width: 112,
                      height: 112,
                      decoration: const BoxDecoration(
                          shape: BoxShape.circle, color: AppColors.inputDark),
                      clipBehavior: Clip.antiAlias,
                      child: _logo != null
                          ? Image.memory(_logo!.bytes, fit: BoxFit.cover)
                          : _logoUrl != null
                              ? NetImage(_logoUrl!)
                              : const Icon(Icons.add_a_photo,
                                  size: 36, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 8),
                    const Text('Subir Escudo',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                    const Text('Formato .png recomendado',
                        style: TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                  ]),
                ),
              ),
              const SectionTitle('Detalles Básicos'),
              LabeledField(
                label: 'Nombre de la Liga',
                child: TextField(
                  controller: _name,
                  decoration: const InputDecoration(
                      hintText: 'Ej. Torneo Apertura 2024',
                      suffixIcon: Icon(Icons.emoji_events)),
                ),
              ),
              LabeledField(
                label: 'Descripción',
                child: TextField(
                  controller: _description,
                  maxLines: 4,
                  decoration: const InputDecoration(
                      hintText:
                          'Reglas breves, premios o detalles del torneo...'),
                ),
              ),
              const SectionTitle('Formato de Juego'),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                      value: '5',
                      icon: Icon(Icons.sports_soccer),
                      label: Text('Fut 5')),
                  ButtonSegment(
                      value: '7', icon: Icon(Icons.groups), label: Text('Fut 7')),
                  ButtonSegment(
                      value: '11',
                      icon: Icon(Icons.stadium),
                      label: Text('Fut 11')),
                ],
                selected: {_format},
                onSelectionChanged: (s) => setState(() => _format = s.first),
              ),
              const SizedBox(height: 12),
              _stepper('Equipos', 'Máximo participantes', _maxTeams, 2,
                  (v) => setState(() => _maxTeams = v)),
              _stepper('Jugadores', 'Máximo por equipo', _maxPlayers, 5,
                  (v) => setState(() => _maxPlayers = v)),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Duración',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('Minutos por tiempo',
                    style: TextStyle(color: AppColors.textSecondary)),
                trailing: SizedBox(
                  width: 110,
                  child: TextField(
                    controller: _duration,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    decoration: const InputDecoration(suffixText: 'min'),
                  ),
                ),
              ),
              const SectionTitle('Reglas Avanzadas'),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                secondary: const Icon(Icons.repeat),
                title: const Text('Ida y Vuelta'),
                subtitle: const Text('Dos partidos por enfrentamiento'),
                value: _twoLegged,
                onChanged: (v) => setState(() => _twoLegged = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                secondary: const Icon(Icons.handshake),
                title: const Text('Permitir Empates'),
                subtitle: const Text('Sin penales al final del tiempo regular'),
                value: _allowDraws,
                onChanged: (v) => setState(() => _allowDraws = v),
              ),
            ]),
    );
  }
}
