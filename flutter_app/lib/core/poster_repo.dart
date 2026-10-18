import '../logic/form.dart';
import '../logic/standings.dart';
import '../models/models.dart';
import 'repo.dart';
import 'supabase.dart';

/// Datos para los pósters de previa y resultado de un partido.
class PosterData {
  PosterData({
    required this.match,
    required this.leagueName,
    required this.events,
    this.homeColor,
    this.awayColor,
    this.homePosition,
    this.awayPosition,
    this.homeForm = const [],
    this.awayForm = const [],
  });

  final MatchModel match;
  final String leagueName;
  final List<MatchEvent> events;
  final String? homeColor;
  final String? awayColor;
  final int? homePosition;
  final int? awayPosition;
  final List<FormResult> homeForm;
  final List<FormResult> awayForm;
}

/// Solo lecturas (tablas con SELECT público).
Future<PosterData> fetchPosterData(
    MatchModel match, List<MatchEvent> events) async {
  final leagueId = match.leagueId;
  String leagueName = match.leagueName ?? '';
  String? homeColor, awayColor;
  int? homePos, awayPos;
  var homeForm = <FormResult>[], awayForm = <FormResult>[];

  final teams = await db
      .from('teams')
      .select('id, home_kit_color')
      .inFilter('id', [match.homeTeamId, match.awayTeamId]);
  for (final t in teams) {
    if (t['id'] == match.homeTeamId) homeColor = t['home_kit_color'] as String?;
    if (t['id'] == match.awayTeamId) awayColor = t['home_kit_color'] as String?;
  }

  if (leagueId != null) {
    if (leagueName.isEmpty) {
      final l = await db
          .from('leagues')
          .select('name')
          .eq('id', leagueId)
          .maybeSingle();
      leagueName = (l?['name'] ?? '') as String;
    }
    final standings = await fetchStandings(leagueId);
    final hi = standings.indexWhere((s) => s.id == match.homeTeamId);
    final ai = standings.indexWhere((s) => s.id == match.awayTeamId);
    homePos = hi >= 0 ? hi + 1 : null;
    awayPos = ai >= 0 ? ai + 1 : null;

    // Racha: partidos finalizados ANTES de este (para la previa tiene sentido
    // y para el resultado incluye el propio partido).
    final rows = await db
        .from('matches')
        .select('id, home_team_id, away_team_id, home_score, away_score, '
            'start_time')
        .eq('league_id', leagueId)
        .eq('status', 'finished')
        .order('start_time', ascending: true);
    final results = rows.map(MatchResult.fromJson).toList();
    homeForm = teamForm(match.homeTeamId, results);
    awayForm = teamForm(match.awayTeamId, results);
  }

  return PosterData(
    match: match,
    leagueName: leagueName,
    events: events,
    homeColor: homeColor,
    awayColor: awayColor,
    homePosition: homePos,
    awayPosition: awayPos,
    homeForm: homeForm,
    awayForm: awayForm,
  );
}
