import '../core/supabase.dart';

class PlayerStat {
  PlayerStat({
    required this.playerId,
    required this.name,
    this.photoUrl,
    required this.teamName,
    this.teamShield,
  });

  final String playerId;
  final String name;
  final String? photoUrl;
  final String teamName;
  final String? teamShield;
  int goals = 0;
  int yellowCards = 0;
  int redCards = 0;
}

class LeagueStats {
  LeagueStats(this.scorers, this.cards);
  final List<PlayerStat> scorers;
  final List<PlayerStat> cards;
}

/// Agrega goles y tarjetas por jugador (como LeagueTableScreen.tsx).
LeagueStats aggregateStats(List<Map<String, dynamic>> events) {
  final goals = <String, PlayerStat>{};
  final cards = <String, PlayerStat>{};

  PlayerStat build(Map<String, dynamic> ev, Map<String, dynamic> player) {
    final team = embedded(player['team']);
    return PlayerStat(
      playerId: ev['player_id'] as String,
      name: (player['name'] ?? '') as String,
      photoUrl: player['photo_url'] as String?,
      teamName: (team?['name'] ?? 'Unknown') as String,
      teamShield: team?['shield_url'] as String?,
    );
  }

  for (final ev in events) {
    final player = embedded(ev['player']);
    if (player == null || ev['player_id'] == null) continue;
    final id = ev['player_id'] as String;
    switch (ev['event_type']) {
      case 'goal':
        goals.putIfAbsent(id, () => build(ev, player)).goals++;
      case 'yellow_card':
        cards.putIfAbsent(id, () => build(ev, player)).yellowCards++;
      case 'red_card':
        cards.putIfAbsent(id, () => build(ev, player)).redCards++;
    }
  }

  final scorers = goals.values.toList()
    ..sort((a, b) => b.goals.compareTo(a.goals));
  final cardList = cards.values.toList()
    ..sort((a, b) {
      final r = b.redCards.compareTo(a.redCards);
      return r != 0 ? r : b.yellowCards.compareTo(a.yellowCards);
    });
  return LeagueStats(scorers, cardList);
}
