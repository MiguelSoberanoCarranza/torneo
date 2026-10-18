/// Goleador agrupado: un renglón por jugador aunque haya anotado varias veces.
class ScorerLine {
  ScorerLine(this.name, this.minutes);
  final String name;
  final List<int?> minutes;

  int get goals => minutes.length;

  /// "Jesus cueva ×2" o "Pedro gil 23'".
  String get label {
    if (goals > 1) return '$name ×$goals';
    final m = minutes.first;
    return m == null ? name : "$name $m'";
  }
}

/// Agrupa por nombre conservando el orden de la primera anotación.
/// [goals] son (nombre del jugador o null, minuto).
List<ScorerLine> groupScorers(Iterable<(String?, int?)> goals) {
  final byName = <String, ScorerLine>{};
  for (final (name, minute) in goals) {
    final key = (name == null || name.trim().isEmpty) ? 'Gol' : name.trim();
    byName.putIfAbsent(key, () => ScorerLine(key, [])).minutes.add(minute);
  }
  return byName.values.toList();
}
