import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/liguilla_repo.dart';
import '../../core/repo.dart';
import '../../core/supabase.dart';
import '../../core/ui_helpers.dart';
import '../../logic/standings.dart';
import '../../logic/stats.dart';
import '../../models/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/liguilla_bracket.dart';
import '../../widgets/match_cards.dart';
import '../../widgets/stats_tables.dart';

/// Página pública de un torneo: `/torneo/{leagueId}`
///
/// No requiere sesión. Solo lee tablas que ya tienen política SELECT pública
/// (leagues, teams, players, matches, match_events, team_sanctions), por lo que
/// no necesita cambios en la base de datos.
class PublicTournamentScreen extends StatefulWidget {
  const PublicTournamentScreen({super.key, required this.leagueId});
  final String leagueId;

  @override
  State<PublicTournamentScreen> createState() => _PublicTournamentScreenState();
}

class _PublicTournamentScreenState extends State<PublicTournamentScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 5, vsync: this);

  bool _loading = true;
  League? _league;
  List<MatchModel> _matches = [];
  Map<String, List<MatchEvent>> _liveEvents = {};
  List<TeamStanding> _standings = [];
  LeagueStats _stats = LeagueStats([], []);
  LiguillaData _liguilla = LiguillaData.empty();

  RealtimeChannel? _channel;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    if (_channel != null) db.removeChannel(_channel!);
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await db
          .from('leagues')
          .select()
          .eq('id', widget.leagueId)
          .maybeSingle();
      final league = data == null ? null : League.fromJson(data);
      if (league == null || !league.isActive) {
        _league = null;
        return;
      }
      _league = league;
      await Future.wait([_loadMatches(), _loadTables()]);
      _subscribe();
    } catch (e) {
      debugPrint('Error cargando torneo público: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMatches() async {
    final rows = await db
        .from('matches')
        .select(matchWithTeamsSelect)
        .eq('league_id', widget.leagueId)
        .order('start_time', ascending: true);
    final matches = rows.map(MatchModel.fromJson).toList();
    final liveIds = matches.where((m) => m.isLive).map((m) => m.id).toList();
    final events = <String, List<MatchEvent>>{};
    if (liveIds.isNotEmpty) {
      final evs = await db
          .from('match_events')
          .select('*, player:players!match_events_player_id_fkey(name)')
          .inFilter('match_id', liveIds)
          .order('created_at', ascending: true);
      for (final e in evs.map(MatchEvent.fromJson)) {
        events.putIfAbsent(e.matchId, () => []).add(e);
      }
    }
    if (!mounted) return;
    setState(() {
      _matches = matches;
      _liveEvents = events;
    });
  }

  Future<void> _loadTables() async {
    final standings = await fetchStandings(widget.leagueId);
    final stats = aggregateStats(await fetchFinishedMatchEvents(widget.leagueId));
    final liguilla = await fetchLiguilla(widget.leagueId);
    if (!mounted) return;
    setState(() {
      _standings = standings;
      _stats = stats;
      _liguilla = liguilla;
    });
  }

  /// Marcadores en vivo: cualquier cambio en partidos de esta liga recarga.
  void _subscribe() {
    _channel = db
        .channel('public-league-${widget.leagueId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'matches',
          filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'league_id',
              value: widget.leagueId),
          callback: (payload) {
            _debounce?.cancel();
            _debounce = Timer(const Duration(milliseconds: 800), () async {
              await _loadMatches();
              final status = payload.newRecord['status'];
              if (status == 'finished' || payload.eventType == PostgresChangeEvent.delete) {
                await _loadTables();
              }
            });
          },
        )
        .subscribe();
  }

  Future<void> _share() async {
    final url = publicTournamentUrl(widget.leagueId);
    await Clipboard.setData(ClipboardData(text: url));
    if (mounted) showToast(context, 'Enlace copiado: $url', ToastType.success);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingView());
    final league = _league;
    if (league == null) {
      return Scaffold(
        body: EmptyState(
          icon: Icons.search_off,
          title: 'Torneo no disponible',
          message: 'El torneo no existe o fue desactivado por su organizador.',
          action: TextButton(
              onPressed: () => context.go('/'),
              child: const Text('Ir al inicio')),
        ),
      );
    }

    return Title(
      title: '${league.name} · Torneo',
      color: AppColors.primary,
      child: Scaffold(
        body: NestedScrollView(
          headerSliverBuilder: (context, _) => [
            SliverAppBar(
              pinned: true,
              expandedHeight: 190,
              automaticallyImplyLeading: false,
              actions: [
                IconButton(
                  tooltip: 'Copiar enlace',
                  icon: const Icon(Icons.share),
                  onPressed: _share,
                ),
              ],
              title: Text(league.name, overflow: TextOverflow.ellipsis),
              flexibleSpace: FlexibleSpaceBar(
                collapseMode: CollapseMode.pin,
                background: _Header(league: league),
              ),
              bottom: TabBar(
                controller: _tabs,
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                tabs: const [
                  Tab(text: 'Partidos'),
                  Tab(text: 'Tabla'),
                  Tab(text: 'Goleo'),
                  Tab(text: 'Tarjetas'),
                  Tab(text: 'Liguilla'),
                ],
              ),
            ),
          ],
          body: TabBarView(controller: _tabs, children: [
            _matchesTab(),
            _wrap([
              if (_standings.isEmpty)
                const EmptyState(
                    icon: Icons.groups, title: 'Aún no hay equipos')
              else
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: SizedBox(
                      width: 560,
                      child: StandingsTable(standings: _standings)),
                ),
            ]),
            _wrap([ScorersTable(scorers: _stats.scorers)]),
            _wrap([CardsTable(stats: _stats.cards)]),
            _wrap([_liguillaTab()]),
          ]),
        ),
      ),
    );
  }

  Widget _wrap(List<Widget> children) => RefreshIndicator(
        onRefresh: () async {
          await _loadMatches();
          await _loadTables();
        },
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 900),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: children),
              ),
            ),
          ],
        ),
      );

  void _openMatch(MatchModel m) =>
      context.push('/torneo/${widget.leagueId}/partido/${m.id}');

  Widget _matchesTab() {
    final live = _matches.where((m) => m.isLive).toList();
    final now = DateTime.now();
    final upcoming = _matches
        .where((m) =>
            m.isScheduled && (m.startTime == null || m.startTime!.isAfter(now)))
        .take(12)
        .toList();
    final finished = _matches.where((m) => m.isFinished).toList()
      ..sort((a, b) => (b.startTime ?? now).compareTo(a.startTime ?? now));

    String roundLabel(MatchModel m) => switch (m.roundNumber) {
          100 => 'Cuartos de Final',
          101 => 'Semifinales',
          102 => 'Gran Final',
          null => 'Jornada -',
          _ => 'Jornada ${m.roundNumber}',
        };

    final children = <Widget>[];
    if (live.isNotEmpty) {
      children.add(const SectionTitle('En Juego'));
      for (final m in live) {
        children.add(Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: LiveMatchCard(
            match: m,
            events: _liveEvents[m.id] ?? const [],
            leagueName: roundLabel(m),
            onTap: () => _openMatch(m),
          ),
        ));
      }
    }

    children.add(const SectionTitle('Próximos Partidos'));
    if (upcoming.isEmpty) {
      children.add(const Text('No hay partidos programados pronto.',
          style: TextStyle(color: AppColors.textSecondary)));
    } else {
      String? prev;
      for (final m in upcoming) {
        final label = '${roundLabel(m)} · ${formatDateRelative(m.startTime)}';
        if (label != prev) {
          children.add(Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 6),
            child: Text(label.toUpperCase(),
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textSecondary)),
          ));
          prev = label;
        }
        children.add(Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: UpcomingMatchTile(match: m, onTap: () => _openMatch(m)),
        ));
      }
    }

    if (finished.isNotEmpty) {
      children.add(const SectionTitle('Resultados'));
      for (final m in finished) {
        children.add(Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: ResultTile(
              match: m, caption: roundLabel(m), onTap: () => _openMatch(m)),
        ));
      }
    }
    return _wrap(children);
  }

  Widget _liguillaTab() {
    final d = _liguilla;
    if (d.qualified.length < 8) {
      return const EmptyState(
        icon: Icons.sports_soccer,
        title: 'Liga en fase regular',
        message: 'La liguilla inicia cuando hay 8 equipos clasificados.',
      );
    }
    if (d.qf.isEmpty) {
      return Card(
        child: Column(children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Clasificados a Liguilla',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ),
          for (final t in d.qualified)
            ListTile(
              leading: CircleAvatar(radius: 14, child: Text('${t.rank}')),
              title: Text(t.name),
              trailing: TeamShield(url: t.shieldUrl, name: t.name, size: 28),
            ),
        ]),
      );
    }
    return LiguillaBracket(data: d, onMatchTap: _openMatch);
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.league});
  final League league;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.primary.withValues(alpha: 0.35),
            AppColors.backgroundDark,
          ],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 56, 16, 56),
      child: Row(children: [
        TeamShield(url: league.logoUrl, size: 64, icon: Icons.emoji_events),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(league.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w900)),
              Text(
                [
                  if (league.format != null) 'Fútbol ${league.format}',
                  if (league.description != null &&
                      league.description!.trim().isNotEmpty)
                    league.description!,
                ].join(' · '),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ]),
    );
  }
}
