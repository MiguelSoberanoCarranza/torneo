import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

/// Detalle de partido con actualización en tiempo real.
/// Une MatchDetailsScreen y MatchDetailsLiveScreen de React.
class MatchDetailsScreen extends StatefulWidget {
  const MatchDetailsScreen({
    super.key,
    required this.matchId,
    this.publicLeagueId,
  });

  final String matchId;

  /// Si viene de la página pública, el botón atrás regresa a ella.
  final String? publicLeagueId;

  @override
  State<MatchDetailsScreen> createState() => _MatchDetailsScreenState();
}

class _MatchDetailsScreenState extends State<MatchDetailsScreen> {
  MatchModel? _match;
  List<MatchEvent> _events = [];
  bool _loading = true;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _load();
    _subscribe();
  }

  @override
  void dispose() {
    if (_channel != null) db.removeChannel(_channel!);
    super.dispose();
  }

  void _subscribe() {
    _channel = db
        .channel('match-${widget.matchId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'matches',
          filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'id',
              value: widget.matchId),
          callback: (payload) {
            if (_match == null || payload.newRecord.isEmpty) return;
            final changes = Map<String, dynamic>.from(payload.newRecord)
              ..remove('home_team')
              ..remove('away_team');
            if (mounted) setState(() => _match = _match!.merge(changes));
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'match_events',
          filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'match_id',
              value: widget.matchId),
          callback: (_) => _loadEvents(),
        )
        .subscribe();
  }

  Future<void> _load() async {
    try {
      final data = await db
          .from('matches')
          .select('$matchWithTeamsSelect, league:leagues(name)')
          .eq('id', widget.matchId)
          .single();
      _match = MatchModel.fromJson(data);
      await _loadEvents();
    } catch (e) {
      debugPrint('Error loading match details: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadEvents() async {
    final data = await db
        .from('match_events')
        .select('*, '
            'player:players!match_events_player_id_fkey(name), '
            'player_in:players!match_events_player_in_id_fkey(name)')
        .eq('match_id', widget.matchId)
        .order('created_at', ascending: false);
    if (mounted) setState(() => _events = data.map(MatchEvent.fromJson).toList());
  }

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else if (widget.publicLeagueId != null) {
      context.go('/torneo/${widget.publicLeagueId}');
    } else {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = _match;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new), onPressed: _back),
        title: Text(m == null ? 'Partido' : 'Jornada ${m.roundNumber ?? '-'}'),
      ),
      body: _loading
          ? const LoadingView()
          : m == null
              ? const EmptyState(
                  icon: Icons.sports_soccer, title: 'Partido no encontrado')
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Center(
                      child: m.isLive
                          ? const LiveBadge()
                          : Chip(label: Text(statusLabel(m.status).toUpperCase())),
                    ),
                    const SizedBox(height: 12),
                    _scoreboard(m),
                    const SectionTitle('Minuto a Minuto'),
                    if (_events.isEmpty)
                      Text(
                        m.isLive
                            ? 'El partido está comenzando. Aún no hay eventos.'
                            : 'No hay eventos registrados.',
                        style: const TextStyle(color: AppColors.textSecondary),
                      )
                    else
                      for (final e in _events) _eventTile(m, e),
                  ],
                ),
    );
  }

  Widget _scoreboard(MatchModel m) {
    int count(String teamId, String type) =>
        _events.where((e) => e.teamId == teamId && e.eventType == type).length;
    Widget team(String id, TeamRef? t) => Expanded(
          child: Column(children: [
            TeamShield(url: t?.shieldUrl, name: t?.name, size: 72),
            const SizedBox(height: 8),
            Text(t?.name ?? '',
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            CardDots(
                yellow: count(id, 'yellow_card'), red: count(id, 'red_card')),
          ]),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          if (m.isLive) ...[
            LiveTimer(
                match: m,
                style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppColors.live)),
            if (m.status == 'break')
              const Text('(Entretiempo)',
                  style: TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 12),
          ],
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            team(m.homeTeamId, m.homeTeam),
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text(
                '${scoreText(m.homeScore)} - ${scoreText(m.awayScore)}',
                style:
                    const TextStyle(fontSize: 40, fontWeight: FontWeight.w900),
              ),
            ),
            team(m.awayTeamId, m.awayTeam),
          ]),
          if (m.startTime != null) ...[
            const SizedBox(height: 12),
            Text(
              '${formatDateLong(m.startTime)} · ${formatTime(m.startTime)}'
              '${m.location != null && m.location!.isNotEmpty ? ' · ${m.location}' : ''}',
              textAlign: TextAlign.center,
              style:
                  const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ]),
      ),
    );
  }

  Widget _eventTile(MatchModel m, MatchEvent e) {
    final isHome = e.teamId == m.homeTeamId;
    final teamName = isHome ? m.homeTeam?.name : m.awayTeam?.name;
    final (icon, color) = switch (e.eventType) {
      'goal' => (Icons.sports_soccer, AppColors.success),
      'yellow_card' => (Icons.style, AppColors.yellowCard),
      'red_card' => (Icons.style, AppColors.redCard),
      _ => (Icons.swap_horiz, Colors.lightBlueAccent),
    };
    final detail = e.eventType == 'substitution'
        ? 'Sale: ${e.playerName ?? 'Jugador'} · Entra: ${e.playerInName ?? 'Jugador'}'
        : (e.playerName ?? 'Jugador');
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: color.withValues(alpha: 0.15),
        child: Icon(icon, color: color),
      ),
      title: Text(e.label, style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Text('$detail (${teamName ?? ''})'),
      trailing: Text("${e.minute ?? '-'}'",
          style: const TextStyle(fontWeight: FontWeight.bold)),
    );
  }
}
