import 'package:supabase_flutter/supabase_flutter.dart';

SupabaseClient get db => Supabase.instance.client;

User? get currentUser => db.auth.currentUser;

/// PostgREST puede devolver una relación embebida como objeto o como lista;
/// la app React lo normalizaba con `Array.isArray(x) ? x[0] : x`.
Map<String, dynamic>? embedded(dynamic value) {
  if (value == null) return null;
  if (value is List) {
    return value.isEmpty ? null : Map<String, dynamic>.from(value.first);
  }
  return Map<String, dynamic>.from(value as Map);
}

/// Selección estándar de partidos con equipos embebidos.
const matchWithTeamsSelect = '*, '
    'home_team:teams!matches_home_team_id_fkey(name, shield_url), '
    'away_team:teams!matches_away_team_id_fkey(name, shield_url)';
