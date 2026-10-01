import '../logic/liguilla.dart';
import '../models/models.dart';
import '../widgets/liguilla_bracket.dart';
import 'repo.dart';
import 'supabase.dart';

/// Top 8 de fase regular + partidos de liguilla (round_number >= 100).
Future<LiguillaData> fetchLiguilla(String leagueId) async {
  final standings = await fetchStandings(leagueId, regularOnly: true);
  final qualified = [
    for (var i = 0; i < standings.length && i < 8; i++)
      RankedTeam(standings[i], i + 1),
  ];
  final playoff = await db
      .from('matches')
      .select()
      .eq('league_id', leagueId)
      .gte('round_number', 100)
      .order('round_number', ascending: true);
  final matches = playoff.map(MatchModel.fromJson).toList();
  return LiguillaData(
    qualified: qualified,
    qf: matches.where((m) => m.roundNumber == roundQF).toList(),
    sf: matches.where((m) => m.roundNumber == roundSF).toList(),
    finalMatch: matches.where((m) => m.roundNumber == roundFinal).firstOrNull,
  );
}
