import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../core/repo.dart';
import '../core/session.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class MyLeaguesScreen extends StatefulWidget {
  const MyLeaguesScreen({super.key});

  @override
  State<MyLeaguesScreen> createState() => _MyLeaguesScreenState();
}

class _MyLeaguesScreenState extends State<MyLeaguesScreen> {
  List<League> _leagues = [];
  bool _loading = true;
  String? _togglingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final user = session.user;
      if (user == null) {
        if (mounted) context.go('/admin-login');
        return;
      }
      final rows = await db
          .from('leagues')
          .select()
          .eq('owner_id', user.id)
          .order('created_at', ascending: false);
      _leagues = rows.map(League.fromJson).toList();
    } catch (e) {
      if (mounted) showToast(context, 'Error al cargar ligas', ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggle(League l) async {
    final active = l.isActive;
    final ok = await confirmDialog(
      context,
      active
          ? '¿Desactivar "${l.name}"? Dejará de verse en todo el sistema.'
          : '¿Activar "${l.name}"? Volverá a mostrarse en el sistema.',
      destructive: active,
    );
    if (!ok) return;
    setState(() => _togglingId = l.id);
    try {
      await db.from('leagues').update({'is_active': !active}).eq('id', l.id);
      setState(() {
        final i = _leagues.indexWhere((x) => x.id == l.id);
        _leagues[i] = l.copyWith(isActive: !active);
      });
      await session.refresh();
      if (mounted) {
        showToast(
            context,
            active
                ? 'Liga desactivada correctamente'
                : 'Liga activada correctamente',
            ToastType.success);
      }
    } catch (e) {
      if (mounted) {
        showToast(context, errorMessage(e), ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _togglingId = null);
    }
  }

  Future<void> _copyPublicLink(League l) async {
    final url = publicTournamentUrl(l.id);
    await Clipboard.setData(ClipboardData(text: url));
    if (mounted) showToast(context, 'Enlace público copiado: $url', ToastType.success);
  }

  Widget _card(League l) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        onTap: () async {
          await context.push('/league/${l.id}');
          _load();
        },
        leading: TeamShield(url: l.logoUrl, size: 48, icon: Icons.emoji_events),
        title: Row(children: [
          Flexible(
              child: Text(l.name,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.bold))),
          if (!l.isActive) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text('Inactiva',
                  style: TextStyle(fontSize: 10, color: AppColors.warning)),
            ),
          ],
        ]),
        subtitle: Text(
            l.format != null ? 'Fútbol ${l.format}' : 'Formato no definido'),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          if (l.isActive)
            IconButton(
              tooltip: 'Copiar enlace público',
              icon: const Icon(Icons.link),
              onPressed: () => _copyPublicLink(l),
            ),
          IconButton(
            tooltip: l.isActive ? 'Desactivar liga' : 'Activar liga',
            onPressed: _togglingId == l.id ? null : () => _toggle(l),
            icon: _togglingId == l.id
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : Icon(l.isActive ? Icons.visibility_off : Icons.visibility),
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final active = _leagues.where((l) => l.isActive).toList();
    final inactive = _leagues.where((l) => !l.isActive).toList();
    return Scaffold(
      appBar: AppBar(
        centerTitle: false,
        title: const Text('Mis Ligas'),
        actions: [
          TextButton.icon(
            onPressed: () async {
              await context.push('/create-league');
              _load();
            },
            icon: const Icon(Icons.add),
            label: const Text('Crear'),
          ),
        ],
      ),
      body: _loading
          ? const LoadingView()
          : _leagues.isEmpty
              ? EmptyState(
                  icon: Icons.emoji_events,
                  title: 'No tienes ligas aún',
                  message:
                      'Crea tu primera liga para comenzar a gestionar el torneo.',
                  action: FilledButton(
                    onPressed: () async {
                      await context.push('/create-league');
                      _load();
                    },
                    child: const Text('Crear Liga'),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.all(16), children: [
                    if (active.isNotEmpty) ...[
                      SectionTitle('Activas (${active.length})'),
                      ...active.map(_card),
                    ],
                    if (inactive.isNotEmpty) ...[
                      SectionTitle('Inactivas (${inactive.length})'),
                      ...inactive.map(_card),
                    ],
                  ]),
                ),
    );
  }
}
