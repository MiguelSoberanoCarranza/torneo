
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';
import '../logic/standings.dart';
import '../models/models.dart';
import 'supabase.dart';

/// Lista de ligas para los selectores: seguidas primero, luego propias,
/// luego las 20 públicas más recientes (misma lógica que Dashboard,
/// LeagueTable y Calendar en React).
class LeagueListResult {
  LeagueListResult(this.leagues, this.followedIds);
  final List<League> leagues;
  final Set<String> followedIds;
}

Future<LeagueListResult> fetchSelectableLeagues() async {
  final user = currentUser;
  final result = <String, League>{};
  var follows = <String>{};

  if (user != null) {
    final f = await db
        .from('league_followers')
        .select('league_id')
        .eq('user_id', user.id);
    follows = f.map((r) => r['league_id'] as String).toSet();

    if (follows.isNotEmpty) {
      final followed = await db
          .from('leagues')
          .select()
          .inFilter('id', follows.toList())
          .eq('is_active', true);
      for (final l in followed) {
        result.putIfAbsent(l['id'] as String, () => League.fromJson(l));
      }
    }
    final owned = await db
        .from('leagues')
        .select()
        .eq('owner_id', user.id)
        .eq('is_active', true);
    for (final l in owned) {
      result.putIfAbsent(l['id'] as String, () => League.fromJson(l));
    }
  }

  final public = await db
      .from('leagues')
      .select()
      .eq('is_active', true)
      .order('created_at', ascending: false)
      .limit(20);
  for (final l in public) {
    result.putIfAbsent(l['id'] as String, () => League.fromJson(l));
  }

  final list = result.values
      .where((l) => l.isActive && l.name.trim().isNotEmpty)
      .toList();
  // Seguidas primero, luego propias; empate conserva el orden original.
  int rank(League l) =>
      (follows.contains(l.id) ? 2 : 0) +
      (user != null && l.ownerId == user.id ? 1 : 0);
  final indexed = list.asMap().entries.toList()
    ..sort((a, b) {
      final r = rank(b.value) - rank(a.value);
      return r != 0 ? r : a.key - b.key;
    });
  return LeagueListResult(indexed.map((e) => e.value).toList(), follows);
}

Future<List<League>> fetchOwnedActiveLeagues() async {
  final user = currentUser;
  if (user == null) return [];
  final rows = await db
      .from('leagues')
      .select()
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .order('created_at', ascending: false);
  return rows.map(League.fromJson).where((l) => l.isActive).toList();
}

/// Tabla general (partidos finalizados + sanciones).
/// Si [regularOnly] es true, excluye rondas de liguilla (round_number >= 100).
Future<List<TeamStanding>> fetchStandings(String leagueId,
    {bool regularOnly = false}) async {
  final teams = await db.from('teams').select().eq('league_id', leagueId);
  var q = db
      .from('matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, status')
      .eq('league_id', leagueId)
      .eq('status', 'finished');
  if (regularOnly) q = q.lt('round_number', 100);
  final matches = await q;
  final sanctions = await db
      .from('team_sanctions')
      .select('team_id, points_delta')
      .eq('league_id', leagueId);

  return calculateStandings(
    teams
        .map((t) => (
              id: t['id'] as String,
              name: (t['name'] ?? '') as String,
              shieldUrl: t['shield_url'] as String?,
            ))
        .toList(),
    matches.map(MatchResult.fromJson).toList(),
    buildSanctionTotals(sanctions),
  );
}

/// Eventos de partidos finalizados para goleo / tarjetas.
Future<List<Map<String, dynamic>>> fetchFinishedMatchEvents(
    String leagueId) async {
  final matches = await db
      .from('matches')
      .select('id')
      .eq('league_id', leagueId)
      .eq('status', 'finished');
  final ids = matches.map((m) => m['id'] as String).toList();
  if (ids.isEmpty) return [];
  return db
      .from('match_events')
      .select('event_type, player_id, '
          'player:player_id(name, photo_url, team:team_id(name, shield_url))')
      .inFilter('match_id', ids);
}

// ---------------- Storage ----------------

class PickedImage {
  PickedImage(this.bytes, this.name, this.mimeType);
  final Uint8List bytes;
  final String name;
  final String? mimeType;
}

Future<PickedImage?> pickImage() async {
  final file = await ImagePicker().pickImage(
    source: ImageSource.gallery,
    maxWidth: 1024,
    imageQuality: 85,
  );
  if (file == null) return null;
  return PickedImage(await file.readAsBytes(), file.name, file.mimeType);
}

/// Sube a un bucket público y devuelve la URL pública.
Future<String> uploadPublicImage(String bucket, PickedImage img,
    {String? prefix}) async {
  final ext = img.name.contains('.') ? img.name.split('.').last : 'png';
  final rand = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
  final path = '${prefix ?? DateTime.now().millisecondsSinceEpoch}_$rand.$ext';
  await db.storage.from(bucket).uploadBinary(
        path,
        img.bytes,
        fileOptions: FileOptions(contentType: img.mimeType ?? 'image/$ext'),
      );
  return db.storage.from(bucket).getPublicUrl(path);
}

// ---------------- Enlace público ----------------

String publicTournamentUrl(String leagueId) {
  final base = kIsWeb ? Uri.base.origin : Env.publicBaseUrl;
  return '$base/torneo/$leagueId';
}
