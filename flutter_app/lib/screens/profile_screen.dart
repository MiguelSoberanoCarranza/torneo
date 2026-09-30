import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/repo.dart';
import '../core/session.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

const _presetAvatars = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Calvin',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Bella',
  'https://api.dicebear.com/7.x/shapes/svg?seed=Geo',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Robot',
];

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _fullName = TextEditingController();
  String? _avatarUrl;
  PickedImage? _file;
  String _role = '';
  bool _loading = true;
  bool _updating = false;
  bool _showSelector = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _fullName.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final user = session.user;
    if (user == null) return;
    final data = await db
        .from('profiles')
        .select('full_name, avatar_url, role')
        .eq('id', user.id)
        .maybeSingle();
    if (!mounted) return;
    setState(() {
      _fullName.text = data?['full_name'] ?? '';
      _avatarUrl = data?['avatar_url'] as String?;
      _role = (data?['role'] ?? '') as String;
      _loading = false;
    });
  }

  Future<void> _save() async {
    final user = session.user!;
    setState(() => _updating = true);
    var avatar = _avatarUrl;
    if (_file != null) {
      try {
        avatar = await uploadPublicImage('user-avatars', _file!,
            prefix: '${user.id}_${DateTime.now().millisecondsSinceEpoch}');
      } catch (e) {
        if (mounted) {
          showToast(context, 'Error al subir imagen', ToastType.error);
          setState(() => _updating = false);
        }
        return;
      }
    }
    try {
      final res = await db.from('profiles').upsert({
        'id': user.id,
        'email': user.email,
        'full_name': _fullName.text.trim(),
        'avatar_url': avatar,
      }).select();
      if (!mounted) return;
      if (res.isEmpty) {
        showToast(context, 'Error de permisos: No se guardaron datos.',
            ToastType.error);
      } else {
        showToast(context, 'Perfil actualizado correctamente', ToastType.success);
        setState(() {
          _avatarUrl = avatar;
          _file = null;
          _showSelector = false;
        });
        session.refresh();
      }
    } catch (e) {
      if (mounted) {
        showToast(context, 'Error al actualizar perfil: ${errorMessage(e)}',
            ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingView());
    final email = session.user?.email ?? '';
    return Scaffold(
      appBar: AppBar(title: const Text('Mi Perfil')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Center(
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: () => setState(() => _showSelector = !_showSelector),
            child: Stack(children: [
              Container(
                width: 112,
                height: 112,
                decoration: const BoxDecoration(
                    shape: BoxShape.circle, color: AppColors.inputDark),
                clipBehavior: Clip.antiAlias,
                child: _file != null
                    ? Image.memory(_file!.bytes, fit: BoxFit.cover)
                    : (_avatarUrl != null && _avatarUrl!.isNotEmpty)
                        ? NetImage(_avatarUrl!)
                        : const Icon(Icons.person, size: 56),
              ),
              const Positioned(
                right: 0,
                bottom: 0,
                child: CircleAvatar(
                    radius: 16,
                    backgroundColor: AppColors.primary,
                    child: Icon(Icons.edit, size: 16, color: Colors.white)),
              ),
            ]),
          ),
        ),
        if (_showSelector)
          Card(
            margin: const EdgeInsets.only(top: 16),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(children: [
                const Text('Elige un icono o sube tu foto'),
                const SizedBox(height: 12),
                Wrap(spacing: 10, runSpacing: 10, children: [
                  for (final url in _presetAvatars)
                    InkWell(
                      onTap: () => setState(() {
                        _avatarUrl = url;
                        _file = null;
                      }),
                      child: Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: _avatarUrl == url
                                  ? AppColors.primary
                                  : Colors.transparent,
                              width: 2),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: NetImage(url),
                      ),
                    ),
                ]),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () async {
                    final img = await pickImage();
                    if (img != null) setState(() => _file = img);
                  },
                  icon: const Icon(Icons.cloud_upload),
                  label: const Text('Subir Imagen'),
                ),
                if (_file != null) Text('Seleccionado: ${_file!.name}'),
              ]),
            ),
          ),
        const SizedBox(height: 24),
        Card(
          child: ListTile(
            title: const Text('Correo Electrónico',
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            subtitle: Text(email, style: const TextStyle(fontSize: 16)),
            trailing: _role == 'superadmin'
                ? const Chip(label: Text('Super Admin'))
                : _role == 'admin'
                    ? const Chip(label: Text('Administrador'))
                    : null,
          ),
        ),
        const SizedBox(height: 16),
        LabeledField(
          label: 'Nombre Completo',
          child: TextField(
              controller: _fullName,
              decoration: const InputDecoration(hintText: 'Ej. Juan Pérez')),
        ),
        FilledButton(
          onPressed: _updating ? null : _save,
          child: Text(_updating ? 'Guardando...' : 'Guardar Cambios'),
        ),
        const SizedBox(height: 12),
        if (_role == 'superadmin')
          OutlinedButton.icon(
            onPressed: () => context.push('/user-management'),
            icon: const Icon(Icons.admin_panel_settings),
            label: const Text('Administrar Usuarios'),
          ),
        const SizedBox(height: 8),
        TextButton.icon(
          onPressed: () async {
            await session.signOut();
            if (context.mounted) context.go('/admin-login');
          },
          icon: const Icon(Icons.logout, color: AppColors.danger),
          label: const Text('Cerrar Sesión',
              style: TextStyle(color: AppColors.danger)),
        ),
      ]),
    );
  }
}
