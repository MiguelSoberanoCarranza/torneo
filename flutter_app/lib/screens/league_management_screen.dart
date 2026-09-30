import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../core/repo.dart';
import '../core/session.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../logic/seeder.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class LeagueManagementScreen extends StatefulWidget {
  const LeagueManagementScreen({super.key, required this.leagueId});
  final String leagueId;

  @override
  State<LeagueManagementScreen> createState() => _LeagueManagementScreenState();
}

class _LeagueManagementScreenState extends State<LeagueManagementScreen> {
  League? _league;
  List<Team> _teams = [];
  List<Player>? _players;
  List<Profile>? _referees;
  int _matchCount = 0;
  bool _loading = true;
  String _mode = 'Equipos';
  String _query = '';

  /// Dueño de la liga o superadmin pueden gestionarla.
  bool get _isOwner =>
      session.isSuperAdmin ||
      (session.user != null && _league?.ownerId == session.user!.id);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await db
          .from('leagues')
          .select()
          .eq('id', widget.leagueId)
          .single();
      final league = League.fromJson(data);
      final isOwner =
          session.user != null && league.ownerId == session.user!.id;
      if (!league.isActive && !isOwner) {
        _league = null;
        return;
      }
      _league = league;
      final teams = await db
          .from('teams')
          .select()
          .eq('league_id', widget.leagueId)
          .order('name');
      _teams = teams.map(Team.fromJson).toList();
      final matches = await db
          .from('matches')
          .select('id')
          .eq('league_id', widget.leagueId);
      _matchCount = matches.length;
      _players = null;
    } catch (e) {
      debugPrint('Error fetching league data: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _setMode(String mode) async {
    setState(() => _mode = mode);
    if (mode == 'Jugadores' && _players == null && _teams.isNotEmpty) {
      final data = await db
          .from('players')
          .select('*, teams(name, shield_url)')
          .inFilter('team_id', _teams.map((t) => t.id).toList())
          .order('name');
      if (mounted) setState(() => _players = data.map(Player.fromJson).toList());
    }
    if (mode == 'Árbitros' && _referees == null) {
      final data = await db.from('profiles').select().eq('role', 'referee');
      if (mounted) {
        setState(() => _referees = data.map(Profile.fromJson).toList());
      }
    }
  }

  Future<void> _seed() async {
    if (!await confirmDialog(
        context, '¿Seguro que quieres generar equipos aleatorios?')) {
      return;
    }
    setState(() => _loading = true);
    final ok = await seedLeague(widget.leagueId);
    if (!mounted) return;
    if (!ok) showToast(context, 'Error al generar datos', ToastType.error);
    await _load();
  }

  Future<void> _fab() async {
    final id = widget.leagueId;
    switch (_mode) {
      case 'Equipos':
        await context.push('/league/$id/create-team');
      case 'Jugadores':
        await context.push('/league/$id/add-player');
      default:
        await context.push('/add-referee');
    }
    _referees = null;
    await _load();
    if (_mode != 'Equipos') await _setMode(_mode);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingView());
    final l = _league;
    if (l == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const EmptyState(
            icon: Icons.search_off,
            title: 'Liga no encontrada o no disponible'),
      );
    }
    final q = _query.toLowerCase();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalles de Liga'),
        actions: [
          if (l.isActive)
            IconButton(
              tooltip: 'Ver página pública',
              icon: const Icon(Icons.public),
              onPressed: () => context.push('/torneo/${l.id}'),
            ),
          if (_isOwner)
            IconButton(
              tooltip: 'Editar liga',
              icon: const Icon(Icons.edit_square),
              onPressed: () async {
                await context.push('/league/${l.id}/edit');
                _load();
              },
            ),
        ],
      ),
      floatingActionButton: _isOwner
          ? FloatingActionButton(
              onPressed: _fab,
              child: Icon(_mode == 'Árbitros' ? Icons.person_add : Icons.add),
            )
          : null,
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (!l.isActive)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(children: [
              Icon(Icons.visibility_off, color: AppColors.warning),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                    'Esta liga está desactivada y no es visible en el sistema. Actívala desde Mis Ligas.'),
              ),
            ]),
          ),
        Row(children: [
          TeamShield(url: l.logoUrl, size: 80, icon: Icons.emoji_events),
          const SizedBox(width: 16),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(l.name,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.bold)),
              Text('Formato: Fut ${l.format ?? '-'} · ${l.status ?? ''}',
                  style: const TextStyle(color: AppColors.textSecondary)),
              if (l.description != null && l.description!.isNotEmpty)
                Text(l.description!,
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.textSecondary)),
            ]),
          ),
        ]),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(
              child: _stat(Icons.groups, 'Equipos',
                  '${_teams.length} / ${l.maxTeams ?? '-'}')),
          const SizedBox(width: 12),
          Expanded(child: _stat(Icons.sports_soccer, 'Partidos', '$_matchCount')),
        ]),
        if (l.isActive) ...[
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              leading: const Icon(Icons.link, color: AppColors.primary),
              title: const Text('Enlace público del torneo'),
              subtitle: Text(publicTournamentUrl(l.id),
                  overflow: TextOverflow.ellipsis),
              trailing: IconButton(
                tooltip: 'Copiar',
                icon: const Icon(Icons.copy),
                onPressed: () async {
                  await Clipboard.setData(
                      ClipboardData(text: publicTournamentUrl(l.id)));
                  if (context.mounted) {
                    showToast(context, 'Enlace copiado', ToastType.success);
                  }
                },
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'Equipos', label: Text('Equipos')),
            ButtonSegment(value: 'Jugadores', label: Text('Jugadores')),
            ButtonSegment(value: 'Árbitros', label: Text('Árbitros')),
          ],
          selected: {_mode},
          onSelectionChanged: (s) => _setMode(s.first),
        ),
        const SizedBox(height: 12),
        TextField(
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.search),
            hintText:
                'Buscar ${_mode.substring(0, _mode.length - 1).toLowerCase()}...',
          ),
          onChanged: (v) => setState(() => _query = v),
        ),
        const SizedBox(height: 12),
        ..._list(q),
        const SizedBox(height: 80),
      ]),
    );
  }

  Widget _stat(IconData icon, String label, String value) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(label,
                  style: const TextStyle(color: AppColors.textSecondary)),
            ]),
            const SizedBox(height: 6),
            Text(value,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          ]),
        ),
      );

  List<Widget> _list(String q) {
    switch (_mode) {
      case 'Equipos':
        final teams =
            _teams.where((t) => t.name.toLowerCase().contains(q)).toList();
        if (teams.isEmpty) {
          return [
            EmptyState(
              icon: Icons.shield,
              title: _teams.isEmpty
                  ? 'No hay equipos registrados aún.'
                  : 'No se encontraron equipos.',
              action: _teams.isEmpty && _isOwner
                  ? OutlinedButton(
                      onPressed: _seed,
                      child: const Text('Generar 10 Equipos de Prueba'))
                  : null,
            ),
          ];
        }
        return [
          for (final t in teams)
            Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: TeamShield(url: t.shieldUrl, name: t.name, size: 44),
                title: Text(t.name,
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('Capitán: ${t.captainName?.isNotEmpty == true ? t.captainName : 'Sin asignar'}'),
                trailing: _isOwner ? const Icon(Icons.chevron_right) : null,
                onTap: _isOwner
                    ? () async {
                        await context.push('/team/${t.id}');
                        _load();
                      }
                    : null,
              ),
            ),
        ];
      case 'Jugadores':
        if (_players == null) {
          return [const Padding(padding: EdgeInsets.all(24), child: LoadingView())];
        }
        final players =
            _players!.where((p) => p.name.toLowerCase().contains(q)).toList();
        if (players.isEmpty) {
          return [
            EmptyState(
                icon: Icons.person_off,
                title: _players!.isEmpty
                    ? 'No hay jugadores registrados.'
                    : 'No se encontraron jugadores.'),
          ];
        }
        return [
          for (final p in players)
            Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: CircleAvatar(child: Text('${p.number ?? '#'}')),
                title: Text(p.name),
                subtitle: Text(
                    [p.position, p.teamName].whereType<String>().join(' · ')),
              ),
            ),
        ];
      default:
        if (_referees == null) {
          return [const Padding(padding: EdgeInsets.all(24), child: LoadingView())];
        }
        final refs = _referees!
            .where((r) => r.displayName.toLowerCase().contains(q))
            .toList();
        if (refs.isEmpty) {
          return [
            EmptyState(
                icon: Icons.sports,
                title: _referees!.isEmpty
                    ? 'No hay árbitros registrados.'
                    : 'No se encontraron árbitros.'),
          ];
        }
        return [
          for (final r in refs)
            Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: Avatar(url: r.avatarUrl, icon: Icons.sports),
                title: Text(r.displayName),
                subtitle: const Text('Árbitro Oficial'),
              ),
            ),
        ];
    }
  }
}
