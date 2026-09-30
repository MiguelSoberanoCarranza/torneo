import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/repo.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

/// Crear equipo (con [leagueId]) o editar equipo + plantilla (con [teamId]).
class CreateTeamScreen extends StatefulWidget {
  const CreateTeamScreen({
    super.key,
    this.leagueId,
    this.teamId,
    this.embedded = false,
  });

  final String? leagueId;
  final String? teamId;

  /// true cuando se muestra dentro de "Mi Equipo" (capitán).
  final bool embedded;

  @override
  State<CreateTeamScreen> createState() => _CreateTeamScreenState();
}

const _kitColors = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#ffffff', '#94a3b8',
  '#475569', '#000000',
];

class _CreateTeamScreenState extends State<CreateTeamScreen> {
  final _name = TextEditingController();
  final _captainName = TextEditingController();
  final _captainEmail = TextEditingController();
  String _primary = '#ef4444';
  String _secondary = '#3b82f6';
  String? _shieldUrl;
  PickedImage? _shield;
  bool _loading = false;

  List<Player> _players = [];
  final _newName = TextEditingController();
  final _newNumber = TextEditingController();
  String _newPosition = 'Delantero';
  PickedImage? _newPhoto;
  bool _loadingPlayer = false;

  bool get _isEditing => widget.teamId != null;

  @override
  void initState() {
    super.initState();
    if (_isEditing) _load();
  }

  @override
  void dispose() {
    for (final c in [_name, _captainName, _captainEmail, _newName, _newNumber]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final t =
          Team.fromJson(await db.from('teams').select().eq('id', widget.teamId!).single());
      _name.text = t.name;
      _captainName.text = t.captainName ?? '';
      _captainEmail.text = t.captainEmail ?? '';
      _primary = t.homeKitColor ?? '#ef4444';
      _secondary = t.awayKitColor ?? '#3b82f6';
      _shieldUrl = t.shieldUrl;
      final players = await db
          .from('players')
          .select()
          .eq('team_id', widget.teamId!)
          .order('number');
      _players = players.map(Player.fromJson).toList();
    } catch (e) {
      if (mounted) showToast(context, errorMessage(e), ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _back() {
    if (widget.embedded) {
      context.go('/');
    } else if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  Future<void> _save() async {
    final email = _captainEmail.text.trim();
    if (_name.text.trim().isEmpty) {
      showToast(context, 'Por favor ingresa un nombre para el equipo.',
          ToastType.error);
      return;
    }
    if (email.isNotEmpty &&
        !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      showToast(
          context,
          'Por favor ingresa un correo electrónico válido para el capitán.',
          ToastType.error);
      return;
    }
    if (!_isEditing && widget.leagueId == null) {
      showToast(context, 'Error: No se ha especificado una liga.', ToastType.error);
      return;
    }
    setState(() => _loading = true);
    try {
      var shieldUrl = _shieldUrl;
      if (_shield != null) {
        try {
          shieldUrl = await uploadPublicImage('team-shields', _shield!);
        } catch (_) {
          if (mounted) {
            showToast(context, 'No se pudo subir el escudo.', ToastType.error);
          }
        }
      }

      // Vincula al capitán si ya tiene cuenta (y lo promueve a captain).
      String? managerId;
      if (email.isNotEmpty) {
        final profile = await db
            .from('profiles')
            .select('id, role')
            .eq('email', email)
            .maybeSingle();
        if (profile != null) {
          managerId = profile['id'] as String;
          final role = profile['role'] as String?;
          if (role == null || role == 'user') {
            await db
                .from('profiles')
                .update({'role': 'captain'}).eq('id', managerId);
          }
        }
      }

      final data = {
        'name': _name.text.trim(),
        'captain_name': _captainName.text.trim(),
        'captain_email': email,
        'manager_id': managerId,
        'home_kit_color': _primary,
        'away_kit_color': _secondary,
        'shield_url': shieldUrl,
      };

      if (_isEditing) {
        await db.from('teams').update(data).eq('id', widget.teamId!);
        if (!mounted) return;
        showToast(context, '¡Equipo actualizado!', ToastType.success);
        if (!widget.embedded) _back();
      } else {
        final inserted = await db
            .from('teams')
            .insert({'league_id': widget.leagueId, ...data})
            .select()
            .single();
        if (!mounted) return;
        showToast(context, '¡Equipo registrado! Ahora puedes agregar jugadores.',
            ToastType.success);
        context.pushReplacement('/team/${inserted['id']}');
      }
    } catch (e) {
      if (mounted) {
        showToast(context, 'Error al guardar: ${errorMessage(e)}', ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _addPlayer() async {
    if (_newName.text.trim().isEmpty || widget.teamId == null) return;
    setState(() => _loadingPlayer = true);
    try {
      String? photoUrl;
      if (_newPhoto != null) {
        try {
          photoUrl = await uploadPublicImage('player-photos', _newPhoto!);
        } catch (_) {
          if (mounted) {
            showToast(context, 'No se pudo subir la foto, se guardará sin ella.',
                ToastType.error);
          }
        }
      }
      final data = await db
          .from('players')
          .insert({
            'team_id': widget.teamId,
            'name': _newName.text.trim(),
            'number': int.tryParse(_newNumber.text) ?? 0,
            'position': _newPosition,
            'photo_url': photoUrl,
          })
          .select()
          .single();
      setState(() {
        _players.add(Player.fromJson(data));
        _newName.clear();
        _newNumber.clear();
        _newPosition = 'Delantero';
        _newPhoto = null;
      });
      if (mounted) showToast(context, 'Jugador agregado', ToastType.success);
    } catch (e) {
      if (mounted) {
        showToast(context, 'Error al agregar jugador: ${errorMessage(e)}',
            ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _loadingPlayer = false);
    }
  }

  Future<void> _deletePlayer(Player p) async {
    if (!await confirmDialog(context, '¿Eliminar a ${p.name}?',
        destructive: true)) {
      return;
    }
    try {
      await db.from('players').delete().eq('id', p.id);
      setState(() => _players.removeWhere((x) => x.id == p.id));
      if (mounted) showToast(context, 'Jugador eliminado', ToastType.success);
    } catch (e) {
      if (mounted) showToast(context, 'Error: ${errorMessage(e)}', ToastType.error);
    }
  }

  Future<void> _editPlayer(Player p) async {
    final name = TextEditingController(text: p.name);
    final number = TextEditingController(text: '${p.number ?? ''}');
    var position = positions.contains(p.position) ? p.position! : 'Delantero';
    PickedImage? photo;
    var saving = false;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Editar Jugador'),
          content: SizedBox(
            width: 380,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () async {
                    final img = await pickImage();
                    if (img != null) setLocal(() => photo = img);
                  },
                  child: Container(
                    width: 88,
                    height: 88,
                    decoration: const BoxDecoration(
                        shape: BoxShape.circle, color: AppColors.inputDark),
                    clipBehavior: Clip.antiAlias,
                    child: photo != null
                        ? Image.memory(photo!.bytes, fit: BoxFit.cover)
                        : p.photoUrl != null
                            ? NetImage(p.photoUrl!)
                            : const Icon(Icons.add_a_photo),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                    controller: name,
                    decoration: const InputDecoration(hintText: 'Nombre')),
                const SizedBox(height: 12),
                Row(children: [
                  SizedBox(
                    width: 80,
                    child: TextField(
                        controller: number,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(hintText: '#')),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SimpleDropdown<String>(
                      value: position,
                      items: [for (final pos in positions) (pos, pos)],
                      onChanged: (v) => setLocal(() => position = v ?? position),
                    ),
                  ),
                ]),
              ]),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancelar')),
            FilledButton(
              style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
              onPressed: saving
                  ? null
                  : () async {
                      if (name.text.trim().isEmpty) return;
                      setLocal(() => saving = true);
                      try {
                        var photoUrl = p.photoUrl;
                        if (photo != null) {
                          try {
                            photoUrl = await uploadPublicImage(
                                'player-photos', photo!);
                          } catch (_) {
                            if (mounted) {
                              showToast(context, 'No se pudo subir la foto nueva.',
                                  ToastType.error);
                            }
                          }
                        }
                        final updates = {
                          'name': name.text.trim(),
                          'number': int.tryParse(number.text) ?? 0,
                          'position': position,
                          'photo_url': photoUrl,
                        };
                        final res = await db
                            .from('players')
                            .update(updates)
                            .eq('id', p.id)
                            .select();
                        final updated = res.isNotEmpty
                            ? Player.fromJson(res.first)
                            : Player.fromJson(
                                {'id': p.id, 'team_id': p.teamId, ...updates});
                        setState(() {
                          final i = _players.indexWhere((x) => x.id == p.id);
                          if (i >= 0) _players[i] = updated;
                        });
                        if (ctx.mounted) Navigator.pop(ctx);
                        if (mounted) {
                          showToast(context, 'Jugador actualizado',
                              ToastType.success);
                        }
                      } catch (e) {
                        setLocal(() => saving = false);
                        if (mounted) {
                          showToast(context,
                              'Error al actualizar: ${errorMessage(e)}',
                              ToastType.error);
                        }
                      }
                    },
              child: Text(saving ? 'Guardando...' : 'Guardar'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickColor(bool primary) async {
    final chosen = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(primary ? 'Color Principal' : 'Color Secundario'),
        content: Wrap(spacing: 10, runSpacing: 10, children: [
          for (final hex in _kitColors)
            InkWell(
              onTap: () => Navigator.pop(ctx, hex),
              child: CircleAvatar(
                radius: 20,
                backgroundColor: parseHexColor(hex),
                child: CircleAvatar(
                    radius: 19, backgroundColor: parseHexColor(hex)),
              ),
            ),
        ]),
      ),
    );
    if (chosen != null) {
      setState(() => primary ? _primary = chosen : _secondary = chosen);
    }
  }

  @override
  Widget build(BuildContext context) {
    final shieldWidget = _shield != null
        ? Image.memory(_shield!.bytes, fit: BoxFit.cover)
        : _shieldUrl != null
            ? NetImage(_shieldUrl!)
            : null;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new), onPressed: _back),
        title: Text(_isEditing ? 'Editar Equipo' : 'Crear Equipo'),
        actions: [
          TextButton(
              onPressed: _loading ? null : _save,
              child: Text(_loading ? '...' : 'Guardar')),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: _loading ? null : _save,
            icon: Icon(_isEditing ? Icons.save : Icons.add_circle),
            label: Text(_isEditing ? 'Guardar Cambios' : 'Registrar Equipo'),
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
                    if (img != null) setState(() => _shield = img);
                  },
                  child: Column(children: [
                    Container(
                      width: 112,
                      height: 112,
                      decoration: const BoxDecoration(
                          shape: BoxShape.circle, color: AppColors.inputDark),
                      clipBehavior: Clip.antiAlias,
                      child: shieldWidget ??
                          const Icon(Icons.add_a_photo,
                              size: 36, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 8),
                    const Text('Subir Escudo'),
                  ]),
                ),
              ),
              const SectionTitle('Información General'),
              LabeledField(
                label: 'Nombre del Equipo',
                child: TextField(
                    controller: _name,
                    decoration:
                        const InputDecoration(hintText: 'Ej. Leones FC')),
              ),
              LabeledField(
                label: 'Nombre del Capitán',
                child: TextField(
                    controller: _captainName,
                    decoration:
                        const InputDecoration(hintText: 'Ej. Juan Pérez')),
              ),
              LabeledField(
                label: 'Email del Capitán',
                child: TextField(
                  controller: _captainEmail,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    hintText: 'capitan@email.com',
                    helperText:
                        'Si el capitán tiene cuenta, podrá editar su equipo.',
                  ),
                ),
              ),
              const SectionTitle('Colores del Uniforme'),
              Row(children: [
                for (final primary in [true, false])
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickColor(primary),
                      child: Column(children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor:
                              parseHexColor(primary ? _primary : _secondary),
                          child: const Icon(Icons.colorize,
                              color: Colors.white70, size: 20),
                        ),
                        const SizedBox(height: 6),
                        Text(primary ? 'Principal' : 'Secundario'),
                      ]),
                    ),
                  ),
              ]),
              if (_isEditing) ..._roster(),
              const SectionTitle('Vista Previa'),
              Card(
                child: ListTile(
                  leading: TeamShield(url: _shieldUrl, size: 44),
                  title: Text(_name.text.isEmpty ? 'Nombre Equipo' : _name.text),
                  subtitle: Text(_captainName.text.isEmpty
                      ? 'Sin Capitán'
                      : 'C: ${_captainName.text}'),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    CircleAvatar(
                        radius: 10, backgroundColor: parseHexColor(_primary)),
                    const SizedBox(width: 4),
                    CircleAvatar(
                        radius: 10, backgroundColor: parseHexColor(_secondary)),
                  ]),
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text(
                    'Así aparecerá el equipo en la tabla de posiciones y calendario.',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.textSecondary)),
              ),
            ]),
    );
  }

  List<Widget> _roster() => [
        SectionTitle('Plantilla de Jugadores',
            trailing: Text('${_players.length} Jugadores',
                style: const TextStyle(color: AppColors.textSecondary))),
        if (_players.isEmpty)
          const Padding(
            padding: EdgeInsets.all(12),
            child: Text('No hay jugadores registrados aún.',
                style: TextStyle(color: AppColors.textSecondary)),
          ),
        for (final p in _players)
          Card(
            margin: const EdgeInsets.only(bottom: 6),
            child: ListTile(
              leading: p.photoUrl != null
                  ? Avatar(url: p.photoUrl, size: 40)
                  : CircleAvatar(child: Text('${p.number ?? ''}')),
              title: Text(p.name),
              subtitle: Text(p.position ?? ''),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(
                    icon: const Icon(Icons.edit),
                    onPressed: () => _editPlayer(p)),
                IconButton(
                    icon: const Icon(Icons.delete, color: AppColors.danger),
                    onPressed: () => _deletePlayer(p)),
              ]),
            ),
          ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: [
              Row(children: [
                const Expanded(
                  child: Text('Agregar Jugador',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                ),
                InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () async {
                    final img = await pickImage();
                    if (img != null) setState(() => _newPhoto = img);
                  },
                  child: CircleAvatar(
                    backgroundColor: AppColors.inputDark,
                    backgroundImage:
                        _newPhoto != null ? MemoryImage(_newPhoto!.bytes) : null,
                    child: _newPhoto == null
                        ? const Icon(Icons.add_a_photo, size: 18)
                        : null,
                  ),
                ),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: TextField(
                      controller: _newName,
                      decoration: const InputDecoration(hintText: 'Nombre')),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 70,
                  child: TextField(
                      controller: _newNumber,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(hintText: '#')),
                ),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: SimpleDropdown<String>(
                    value: _newPosition,
                    items: [for (final pos in positions) (pos, pos)],
                    onChanged: (v) =>
                        setState(() => _newPosition = v ?? _newPosition),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
                  onPressed: _loadingPlayer ? null : _addPlayer,
                  child: Text(_loadingPlayer ? '...' : 'Agregar'),
                ),
              ]),
            ]),
          ),
        ),
      ];
}
