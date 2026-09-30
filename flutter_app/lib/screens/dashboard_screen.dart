import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/repo.dart';
import '../core/session.dart';
import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import '../widgets/match_cards.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  List<League> _leagues = [];
  Set<String> _followed = {};
  String? _selectedId;

  List<MatchModel> _live = [];
  Map<String, List<MatchEvent>> _liveEvents = {};
  List<MatchModel> _upcoming = [];
  List<MatchModel> _recent = [];

  @override
  void initState() {
    super.initState();
    _loadLeagues();
  }

  Future<void> _loadLeagues() async {
    setState(() => _loading = true);
    try {
      final res = await fetchSelectableLeagues();
      _leagues = res.leagues;
      _followed = res.followedIds;
      if (_selectedId == null || !_leagues.any((l) => l.id == _selectedId)) {
        _selectedId = _leagues.isNotEmpty ? _leagues.first.id : null;
      }
      await _loadMatches();
    } catch (e) {
      debugPrint('$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMatches() async {
    final id = _selectedId;
    if (id == null) return;
    final live = await db
        .from('matches')
        .select(matchWithTeamsSelect)
        .eq('league_id', id)
        .inFilter('status', ['live', 'break']);
    _live = live.map(MatchModel.fromJson).toList();

    _liveEvents = {};
    if (_live.isNotEmpty) {
      final events = await db
          .from('match_events')
          .select('*, player:players!match_events_player_id_fkey(name)')
          .inFilter('match_id', _live.map((m) => m.id).toList())
          .order('created_at');
      for (final e in events.map(MatchEvent.fromJson)) {
        _liveEvents.putIfAbsent(e.matchId, () => []).add(e);
      }
    }

    final upcoming = await db
        .from('matches')
        .select(matchWithTeamsSelect)
        .eq('league_id', id)
        .eq('status', 'scheduled')
        .gt('start_time', DateTime.now().toUtc().toIso8601String())
        .order('start_time')
        .limit(10);
    _upcoming = upcoming.map(MatchModel.fromJson).toList();

    final recent = await db
        .from('matches')
        .select(matchWithTeamsSelect)
        .eq('league_id', id)
        .eq('status', 'finished')
        .order('start_time', ascending: false)
        .limit(10);
    _recent = recent.map(MatchModel.fromJson).toList();
    if (mounted) setState(() {});
  }

  Future<void> _toggleFollow() async {
    final user = session.user;
    final id = _selectedId;
    if (id == null) return;
    if (user == null) {
      showToast(context, 'Inicia sesión para seguir ligas.');
      return;
    }
    try {
      if (_followed.contains(id)) {
        await db
            .from('league_followers')
            .delete()
            .eq('user_id', user.id)
            .eq('league_id', id);
        setState(() => _followed.remove(id));
      } else {
        await db
            .from('league_followers')
            .insert({'user_id': user.id, 'league_id': id});
        setState(() => _followed.add(id));
      }
    } catch (e) {
      if (mounted) showToast(context, errorMessage(e), ToastType.error);
    }
  }

  League? get _selected =>
      _leagues.where((l) => l.id == _selectedId).firstOrNull;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListenableBuilder(
          listenable: session,
          builder: (context, _) => _loading
              ? const LoadingView()
              : RefreshIndicator(
                  onRefresh: _loadLeagues,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      _header(),
                      const SizedBox(height: 12),
                      if (_leagues.isNotEmpty) _leagueSelector(),
                      ..._content(),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  Widget _header() {
    final user = session.user;
    final profile = session.profile;
    final name = user == null
        ? 'Invitado'
        : (profile?.fullName?.isNotEmpty == true
            ? profile!.fullName!
            : (user.email?.split('@').first ?? 'Usuario'));
    return Row(children: [
      InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => context.push(user != null ? '/profile' : '/admin-login'),
        child: Row(children: [
          Avatar(url: profile?.avatarUrl, size: 44),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(user != null ? 'Bienvenido' : 'Hola,',
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary)),
            Text(name,
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.bold)),
          ]),
        ]),
      ),
      const Spacer(),
      if (user != null)
        IconButton(
          tooltip: 'Cerrar Sesión',
          icon: const Icon(Icons.logout),
          onPressed: () async {
            await session.signOut();
            if (mounted) context.go('/admin-login');
          },
        )
      else
        TextButton(
          onPressed: () => context.push('/admin-login'),
          child: const Text('Ingresar'),
        ),
    ]);
  }

  Widget _leagueSelector() {
    final following = _selectedId != null && _followed.contains(_selectedId);
    return Row(children: [
      const Text('Liga:',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
      const SizedBox(width: 8),
      Expanded(
        child: LeagueDropdown(
          leagues: _leagues,
          selectedId: _selectedId,
          followedIds: _followed,
          onChanged: (id) async {
            setState(() => _selectedId = id);
            await _loadMatches();
          },
        ),
      ),
      IconButton(
        tooltip: following ? 'Dejar de seguir' : 'Seguir liga',
        onPressed: _toggleFollow,
        icon: Icon(following ? Icons.star : Icons.star_border,
            color: following ? Colors.amber : null),
      ),
      IconButton(
        tooltip: 'Página pública del torneo',
        onPressed: _selectedId == null
            ? null
            : () => context.push('/torneo/$_selectedId'),
        icon: const Icon(Icons.public),
      ),
    ]);
  }

  List<Widget> _content() {
    if (_leagues.isEmpty) {
      return const [
        EmptyState(
            icon: Icons.emoji_events, title: 'No hay ligas disponibles'),
      ];
    }
    final widgets = <Widget>[];
    if (_live.isNotEmpty) {
      widgets.add(const SectionTitle('En Juego'));
      for (final m in _live) {
        widgets.add(Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: LiveMatchCard(
            match: m,
            events: _liveEvents[m.id] ?? const [],
            leagueName: _selected?.name,
            onTap: () => context.push('/match/${m.id}'),
          ),
        ));
      }
    }

    widgets.add(const SectionTitle('Próximos Partidos'));
    if (_upcoming.isEmpty) {
      widgets.add(const Text('No hay partidos programados pronto.',
          style: TextStyle(color: AppColors.textSecondary)));
    } else {
      String? prev;
      for (final m in _upcoming) {
        final label = formatDateRelative(m.startTime);
        if (label != prev) {
          widgets.add(Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 6),
            child: Text(label.toUpperCase(),
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textSecondary)),
          ));
          prev = label;
        }
        widgets.add(Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: UpcomingMatchTile(match: m),
        ));
      }
    }

    if (_recent.isNotEmpty) {
      widgets.add(const SectionTitle('Resultados Recientes'));
      for (final m in _recent) {
        widgets.add(Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: ResultTile(
            match: m,
            caption: _selected?.name,
            onTap: () => context.push('/match/${m.id}'),
          ),
        ));
      }
    }
    return widgets;
  }
}
