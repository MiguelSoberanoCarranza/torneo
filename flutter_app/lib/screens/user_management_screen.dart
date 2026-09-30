import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/session.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

const _roles = [
  ('superadmin', 'Super Admin'),
  ('admin', 'Administrador'),
  ('referee', 'Árbitro'),
  ('captain', 'Capitán'),
  ('player', 'Jugador'),
  ('user', 'Usuario'),
];

class UserManagementScreen extends StatefulWidget {
  const UserManagementScreen({super.key});

  @override
  State<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends State<UserManagementScreen> {
  List<Profile> _users = [];
  bool _loading = true;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final me = session.user;
      if (me == null) return;
      final profile =
          await db.from('profiles').select('role').eq('id', me.id).maybeSingle();
      if (profile?['role'] != 'superadmin') {
        if (mounted) {
          showToast(context, 'No tienes permisos de super administrador',
              ToastType.error);
          context.go('/');
        }
        return;
      }
      final rows = await db
          .from('profiles')
          .select()
          .order('created_at', ascending: false);
      _users = rows.map(Profile.fromJson).toList();
    } catch (e) {
      if (mounted) showToast(context, 'Error al cargar usuarios', ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _changeRole(Profile u, String role) async {
    try {
      await db.from('profiles').update({'role': role}).eq('id', u.id);
      setState(() {
        final i = _users.indexWhere((x) => x.id == u.id);
        _users[i] = Profile(
            id: u.id,
            email: u.email,
            fullName: u.fullName,
            avatarUrl: u.avatarUrl,
            role: role);
      });
      if (mounted) showToast(context, 'Rol actualizado correctamente', ToastType.success);
    } catch (e) {
      if (mounted) {
        showToast(context, 'Error al actualizar rol: ${errorMessage(e)}',
            ToastType.error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _query.toLowerCase();
    final users = _users
        .where((u) =>
            (u.fullName ?? '').toLowerCase().contains(q) ||
            (u.email ?? '').toLowerCase().contains(q))
        .toList();
    final myId = session.user?.id;
    return Scaffold(
      appBar: AppBar(title: const Text('Gestión de Usuarios')),
      body: _loading
          ? const LoadingView()
          : ListView(padding: const EdgeInsets.all(16), children: [
              TextField(
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Buscar por nombre o correo...',
                ),
                onChanged: (v) => setState(() => _query = v),
              ),
              const SizedBox(height: 12),
              if (users.isEmpty)
                const EmptyState(
                    icon: Icons.person_search,
                    title: 'No se encontraron usuarios.'),
              for (final u in users)
                Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(children: [
                      Row(children: [
                        Avatar(url: u.avatarUrl, size: 40),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${u.fullName?.isNotEmpty == true ? u.fullName : 'Usuario sin nombre'}'
                                  '${u.id == myId ? ' (Tú)' : ''}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold),
                                ),
                                Text(u.email ?? '',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary)),
                              ]),
                        ),
                      ]),
                      const SizedBox(height: 8),
                      Row(children: [
                        const Text('Rol:'),
                        const SizedBox(width: 12),
                        Expanded(
                          child: IgnorePointer(
                            // Evita que el superadmin se quite su propio rol.
                            ignoring: u.id == myId,
                            child: Opacity(
                              opacity: u.id == myId ? 0.5 : 1,
                              child: SimpleDropdown<String>(
                                value: u.role ?? 'user',
                                items: _roles,
                                onChanged: (v) {
                                  if (v != null && v != u.role) {
                                    _changeRole(u, v);
                                  }
                                },
                              ),
                            ),
                          ),
                        ),
                      ]),
                    ]),
                  ),
                ),
            ]),
    );
  }
}
