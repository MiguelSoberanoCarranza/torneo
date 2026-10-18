import 'standings.dart';

/// Resultado de un equipo en un partido: G (ganó), E (empató), P (perdió).
enum FormResult { win, draw, loss }

/// Últimos [count] resultados de [teamId], del más antiguo al más reciente.
/// [matches] deben venir ordenados cronológicamente y ya finalizados.
/// Doble default (-1/-1) cuenta como derrota, igual que en la tabla.
List<FormResult> teamForm(String teamId, List<MatchResult> matches,
    {int count = 5}) {
  final results = <FormResult>[];
  for (final m in matches) {
    final isHome = m.homeTeamId == teamId;
    if (!isHome && m.awayTeamId != teamId) continue;
    final h = m.homeScore ?? 0, a = m.awayScore ?? 0;
    if (h == -1 && a == -1) {
      results.add(FormResult.loss);
      continue;
    }
    final mine = isHome ? h : a, theirs = isHome ? a : h;
    results.add(mine > theirs
        ? FormResult.win
        : mine == theirs
            ? FormResult.draw
            : FormResult.loss);
  }
  return results.length <= count
      ? results
      : results.sublist(results.length - count);
}
