import '../models/models.dart';

/// Un partido que cambia de fecha al posponer una jornada.
class PostponeMove {
  const PostponeMove(this.match, this.newStart);
  final MatchModel match;
  final DateTime newStart;
}

/// Plan para posponer la jornada [round].
class PostponePlan {
  const PostponePlan(this.days, this.moves);

  /// Días que se recorre cada partido (puede ser negativo para adelantar).
  final int days;
  final List<PostponeMove> moves;

  bool get isEmpty => moves.isEmpty || days == 0;
  List<int> get rounds =>
      (moves.map((m) => m.match.roundNumber ?? 0).toSet().toList()..sort());
}

DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);

/// Solo se mueven partidos que no se han jugado ni están en curso.
bool canMove(MatchModel m) => !m.isFinished && !m.isLive && m.startTime != null;

/// Fecha de referencia de la jornada: el día del primer partido pendiente.
DateTime? roundDate(Iterable<MatchModel> matches, int round) {
  final pending = matches
      .where((m) => (m.roundNumber ?? 0) == round && canMove(m))
      .map((m) => m.startTime!.toLocal())
      .toList()
    ..sort();
  return pending.isEmpty ? null : _day(pending.first);
}

/// Calcula cuántos días se recorre la jornada [round] para que caiga en
/// [newDate] y qué partidos cambian. Con [shiftFollowing] también se recorren
/// todas las jornadas posteriores (incluida la liguilla) los mismos días, así
/// se conserva el espacio entre jornadas. Se respeta la hora de cada partido.
PostponePlan planPostpone(
  Iterable<MatchModel> matches, {
  required int round,
  required DateTime newDate,
  bool shiftFollowing = true,
}) {
  final ref = roundDate(matches, round);
  if (ref == null) return const PostponePlan(0, []);
  // Diferencia por calendario (no por horas) para no fallar con horario de verano.
  final days = DateTime.utc(newDate.year, newDate.month, newDate.day)
      .difference(DateTime.utc(ref.year, ref.month, ref.day))
      .inDays;
  final moves = <PostponeMove>[];
  for (final m in matches) {
    final r = m.roundNumber ?? 0;
    final inScope = shiftFollowing ? r >= round : r == round;
    if (!inScope || !canMove(m)) continue;
    final s = m.startTime!.toLocal();
    moves.add(PostponeMove(
        m, DateTime(s.year, s.month, s.day + days, s.hour, s.minute)));
  }
  moves.sort((a, b) => a.newStart.compareTo(b.newStart));
  return PostponePlan(days, moves);
}
