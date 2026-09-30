import '../core/supabase.dart';

int? _int(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

class League {
  League({
    required this.id,
    required this.name,
    this.ownerId,
    this.description,
    this.logoUrl,
    this.format,
    this.maxTeams,
    this.maxPlayersPerTeam,
    this.matchDuration,
    this.status,
    this.isActive = true,
    this.settings = const {},
    this.createdAt,
  });

  final String id;
  final String name;
  final String? ownerId;
  final String? description;
  final String? logoUrl;
  final String? format;
  final int? maxTeams;
  final int? maxPlayersPerTeam;
  final int? matchDuration;
  final String? status;
  final bool isActive;
  final Map<String, dynamic> settings;
  final DateTime? createdAt;

  factory League.fromJson(Map<String, dynamic> j) => League(
        id: j['id'] as String,
        name: (j['name'] ?? '') as String,
        ownerId: j['owner_id'] as String?,
        description: j['description'] as String?,
        logoUrl: j['logo_url'] as String?,
        format: j['format']?.toString(),
        maxTeams: _int(j['max_teams']),
        maxPlayersPerTeam: _int(j['max_players_per_team']),
        matchDuration: _int(j['match_duration']),
        status: j['status'] as String?,
        // Igual que isLeagueActive(): solo `false` explícito desactiva.
        isActive: j['is_active'] != false,
        settings: j['settings'] is Map
            ? Map<String, dynamic>.from(j['settings'] as Map)
            : const {},
        createdAt: j['created_at'] != null
            ? DateTime.tryParse(j['created_at'].toString())
            : null,
      );

  League copyWith({bool? isActive}) => League(
        id: id,
        name: name,
        ownerId: ownerId,
        description: description,
        logoUrl: logoUrl,
        format: format,
        maxTeams: maxTeams,
        maxPlayersPerTeam: maxPlayersPerTeam,
        matchDuration: matchDuration,
        status: status,
        isActive: isActive ?? this.isActive,
        settings: settings,
        createdAt: createdAt,
      );
}

class TeamRef {
  const TeamRef({required this.name, this.shieldUrl});
  final String name;
  final String? shieldUrl;

  static TeamRef? fromJson(dynamic raw) {
    final j = embedded(raw);
    if (j == null) return null;
    return TeamRef(
      name: (j['name'] ?? '') as String,
      shieldUrl: j['shield_url'] as String?,
    );
  }
}

class Team {
  Team({
    required this.id,
    required this.name,
    this.leagueId,
    this.shieldUrl,
    this.captainName,
    this.captainEmail,
    this.managerId,
    this.homeKitColor,
    this.awayKitColor,
  });

  final String id;
  final String name;
  final String? leagueId;
  final String? shieldUrl;
  final String? captainName;
  final String? captainEmail;
  final String? managerId;
  final String? homeKitColor;
  final String? awayKitColor;

  factory Team.fromJson(Map<String, dynamic> j) => Team(
        id: j['id'] as String,
        name: (j['name'] ?? '') as String,
        leagueId: j['league_id'] as String?,
        shieldUrl: j['shield_url'] as String?,
        captainName: j['captain_name'] as String?,
        captainEmail: j['captain_email'] as String?,
        managerId: j['manager_id'] as String?,
        homeKitColor: j['home_kit_color'] as String?,
        awayKitColor: j['away_kit_color'] as String?,
      );
}

class Player {
  Player({
    required this.id,
    required this.name,
    this.teamId,
    this.number,
    this.position,
    this.photoUrl,
    this.teamName,
  });

  final String id;
  final String name;
  final String? teamId;
  final int? number;
  final String? position;
  final String? photoUrl;
  final String? teamName;

  factory Player.fromJson(Map<String, dynamic> j) => Player(
        id: j['id'] as String,
        name: (j['name'] ?? '') as String,
        teamId: j['team_id'] as String?,
        number: _int(j['number']),
        position: j['position'] as String?,
        photoUrl: j['photo_url'] as String?,
        teamName: embedded(j['teams'])?['name'] as String?,
      );
}

class MatchModel {
  MatchModel({
    required this.id,
    required this.homeTeamId,
    required this.awayTeamId,
    this.leagueId,
    this.startTime,
    this.status = 'scheduled',
    this.homeScore,
    this.awayScore,
    this.location,
    this.roundNumber,
    this.homeTeam,
    this.awayTeam,
    this.leagueName,
    this.elapsedSeconds = 0,
    this.lastStartTime,
    this.currentPeriod = 1,
    this.lineups,
  });

  final String id;
  final String homeTeamId;
  final String awayTeamId;
  final String? leagueId;
  final DateTime? startTime;
  final String status;
  final int? homeScore;
  final int? awayScore;
  final String? location;
  final int? roundNumber;
  final TeamRef? homeTeam;
  final TeamRef? awayTeam;
  final String? leagueName;
  final int elapsedSeconds;
  final DateTime? lastStartTime;
  final int currentPeriod;
  final Map<String, dynamic>? lineups;

  bool get isLive => status == 'live' || status == 'break';
  bool get isFinished => status == 'finished';
  bool get isScheduled => status == 'scheduled';

  /// -1 / -1 = ambos perdieron por default.
  bool get isDoubleDefault => homeScore == -1 && awayScore == -1;

  /// Segundos transcurridos tomando en cuenta el reloj corriendo.
  int currentSeconds([DateTime? now]) {
    var total = elapsedSeconds;
    if (status == 'live' && lastStartTime != null) {
      total += (now ?? DateTime.now()).difference(lastStartTime!).inSeconds;
    }
    return total < 0 ? 0 : total;
  }

  factory MatchModel.fromJson(Map<String, dynamic> j) => MatchModel(
        id: j['id'] as String,
        homeTeamId: j['home_team_id'] as String,
        awayTeamId: j['away_team_id'] as String,
        leagueId: j['league_id'] as String?,
        startTime: j['start_time'] != null
            ? DateTime.tryParse(j['start_time'].toString())?.toLocal()
            : null,
        status: (j['status'] ?? 'scheduled') as String,
        homeScore: _int(j['home_score']),
        awayScore: _int(j['away_score']),
        location: j['location'] as String?,
        roundNumber: _int(j['round_number']),
        homeTeam: TeamRef.fromJson(j['home_team']),
        awayTeam: TeamRef.fromJson(j['away_team']),
        leagueName: embedded(j['league'])?['name'] as String?,
        elapsedSeconds: _int(j['elapsed_seconds']) ?? 0,
        lastStartTime: j['last_start_time'] != null
            ? DateTime.tryParse(j['last_start_time'].toString())
            : null,
        currentPeriod: _int(j['current_period']) ?? 1,
        lineups: j['lineups'] is Map
            ? Map<String, dynamic>.from(j['lineups'] as Map)
            : null,
      );

  /// Aplica un payload parcial (p. ej. de realtime o de un update local).
  MatchModel merge(Map<String, dynamic> changes) {
    final base = toJson()..addAll(changes);
    return MatchModel.fromJson(base);
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'home_team_id': homeTeamId,
        'away_team_id': awayTeamId,
        'league_id': leagueId,
        'start_time': startTime?.toUtc().toIso8601String(),
        'status': status,
        'home_score': homeScore,
        'away_score': awayScore,
        'location': location,
        'round_number': roundNumber,
        'home_team': homeTeam == null
            ? null
            : {'name': homeTeam!.name, 'shield_url': homeTeam!.shieldUrl},
        'away_team': awayTeam == null
            ? null
            : {'name': awayTeam!.name, 'shield_url': awayTeam!.shieldUrl},
        'league': leagueName == null ? null : {'name': leagueName},
        'elapsed_seconds': elapsedSeconds,
        'last_start_time': lastStartTime?.toUtc().toIso8601String(),
        'current_period': currentPeriod,
        'lineups': lineups,
      };
}

class MatchEvent {
  MatchEvent({
    required this.id,
    required this.matchId,
    required this.eventType,
    this.playerId,
    this.playerInId,
    this.teamId,
    this.minute,
    this.playerName,
    this.playerNumber,
    this.playerInName,
    this.playerInNumber,
    this.createdAt,
  });

  final String id;
  final String matchId;
  final String eventType;
  final String? playerId;
  final String? playerInId;
  final String? teamId;
  final int? minute;
  final String? playerName;
  final int? playerNumber;
  final String? playerInName;
  final int? playerInNumber;
  final DateTime? createdAt;

  factory MatchEvent.fromJson(Map<String, dynamic> j) {
    final p = embedded(j['player']);
    final pin = embedded(j['player_in']);
    return MatchEvent(
      id: j['id'] as String,
      matchId: j['match_id'] as String,
      eventType: j['event_type'] as String,
      playerId: j['player_id'] as String?,
      playerInId: j['player_in_id'] as String?,
      teamId: j['team_id'] as String?,
      minute: _int(j['minute']),
      playerName: p?['name'] as String?,
      playerNumber: _int(p?['number']),
      playerInName: pin?['name'] as String?,
      playerInNumber: _int(pin?['number']),
      createdAt: j['created_at'] != null
          ? DateTime.tryParse(j['created_at'].toString())
          : null,
    );
  }

  String get label => switch (eventType) {
        'goal' => '¡GOL!',
        'yellow_card' => 'Tarjeta Amarilla',
        'red_card' => 'Tarjeta Roja',
        'substitution' => 'Cambio',
        _ => eventType,
      };
}

class Profile {
  Profile({
    required this.id,
    this.email,
    this.fullName,
    this.avatarUrl,
    this.role,
  });

  final String id;
  final String? email;
  final String? fullName;
  final String? avatarUrl;
  final String? role;

  String get displayName =>
      (fullName != null && fullName!.trim().isNotEmpty)
          ? fullName!
          : (email ?? 'Usuario');

  factory Profile.fromJson(Map<String, dynamic> j) => Profile(
        id: j['id'] as String,
        email: j['email'] as String?,
        fullName: j['full_name'] as String?,
        avatarUrl: j['avatar_url'] as String?,
        role: j['role'] as String?,
      );
}

class TeamSanction {
  TeamSanction({
    required this.id,
    required this.leagueId,
    required this.teamId,
    required this.pointsDelta,
    required this.reason,
    this.createdAt,
    this.teamName,
    this.teamShield,
    this.creatorName,
  });

  final String id;
  final String leagueId;
  final String teamId;
  final int pointsDelta;
  final String reason;
  final DateTime? createdAt;
  final String? teamName;
  final String? teamShield;
  final String? creatorName;

  factory TeamSanction.fromJson(Map<String, dynamic> j) {
    final team = embedded(j['team']);
    final creator = embedded(j['creator']);
    final fullName = creator?['full_name'] as String?;
    return TeamSanction(
      id: j['id'] as String,
      leagueId: j['league_id'] as String,
      teamId: j['team_id'] as String,
      pointsDelta: _int(j['points_delta']) ?? 0,
      reason: (j['reason'] ?? '') as String,
      createdAt: j['created_at'] != null
          ? DateTime.tryParse(j['created_at'].toString())?.toLocal()
          : null,
      teamName: team?['name'] as String?,
      teamShield: team?['shield_url'] as String?,
      creatorName: (fullName != null && fullName.isNotEmpty)
          ? fullName
          : creator?['email'] as String?,
    );
  }
}
