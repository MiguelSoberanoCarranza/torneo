import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/repo.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class AddPlayerScreen extends StatefulWidget {
  const AddPlayerScreen({super.key, required this.leagueId});
  final String leagueId;

  @override
  State<AddPlayerScreen> createState() => _AddPlayerScreenState();
}

class _AddPlayerScreenState extends State<AddPlayerScreen> {
  List<Team> _teams = [];
  String? _teamId;
  final _name = TextEditingController();
  final _number = TextEditingController();
  String _position = 'Delantero';
  PickedImage? _photo;
  bool _loading = false;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _loadTeams();
  }

  @override
  void dispose() {
    _name.dispose();
    _number.dispose();
    super.dispose();
  }

  Future<void> _loadTeams() async {
    final data = await db
        .from('teams')
        .select('id, name')
        .eq('league_id', widget.leagueId)
        .order('name', ascending: true);
    if (!mounted) return;
    setState(() {
      _teams = data.map(Team.fromJson).toList();
      _teamId = _teams.isNotEmpty ? _teams.first.id : null;
    });
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty || _teamId == null) {
      showToast(context, 'Completa todos los campos obligatorios', ToastType.error);
      return;
    }
    setState(() => _loading = true);
    try {
      String? photoUrl;
      if (_photo != null) {
        setState(() => _uploading = true);
        try {
          photoUrl = await uploadPublicImage('player-photos', _photo!);
        } catch (e) {
          throw Exception('Error al subir la foto: ${errorMessage(e)}');
        } finally {
          if (mounted) setState(() => _uploading = false);
        }
      }
      await db.from('players').insert({
        'team_id': _teamId,
        'name': _name.text.trim(),
        'number': int.tryParse(_number.text) ?? 0,
        'position': _position,
        'photo_url': photoUrl,
      });
      if (!mounted) return;
      showToast(context, 'Jugador agregado exitosamente', ToastType.success);
      context.pop();
    } catch (e) {
      if (mounted) {
        showToast(context, 'Error al agregar jugador: ${errorMessage(e)}',
            ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agregar Jugador')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        LabeledField(
          label: 'Equipo',
          child: _teams.isEmpty
              ? const Text('No hay equipos en esta liga.',
                  style: TextStyle(color: AppColors.danger))
              : SimpleDropdown<String>(
                  value: _teamId,
                  items: [for (final t in _teams) (t.id, t.name)],
                  onChanged: (v) => setState(() => _teamId = v),
                ),
        ),
        LabeledField(
          label: 'Foto (Opcional)',
          child: Row(children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: AppColors.inputDark,
              backgroundImage:
                  _photo != null ? MemoryImage(_photo!.bytes) : null,
              child: _photo == null ? const Icon(Icons.person) : null,
            ),
            const SizedBox(width: 16),
            OutlinedButton(
              onPressed: () async {
                final img = await pickImage();
                if (img != null) setState(() => _photo = img);
              },
              child: Text(_photo != null ? 'Cambiar Foto' : 'Subir Foto'),
            ),
          ]),
        ),
        Row(children: [
          Expanded(
            child: LabeledField(
              label: 'Nombre',
              child: TextField(
                  controller: _name,
                  decoration:
                      const InputDecoration(hintText: 'Nombre del jugador')),
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 90,
            child: LabeledField(
              label: 'Dorsal',
              child: TextField(
                  controller: _number,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(hintText: '#')),
            ),
          ),
        ]),
        LabeledField(
          label: 'Posición',
          child: SimpleDropdown<String>(
            value: _position,
            items: [for (final p in positions) (p, p)],
            onChanged: (v) => setState(() => _position = v ?? _position),
          ),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed:
              _loading || _uploading || _teams.isEmpty ? null : _save,
          child: Text(_uploading
              ? 'Subiendo foto...'
              : _loading
                  ? 'Guardando...'
                  : 'Guardar Jugador'),
        ),
      ]),
    );
  }
}
