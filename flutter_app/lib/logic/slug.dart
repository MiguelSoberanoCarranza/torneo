/// URLs públicas legibles sin tocar la base de datos.
///
/// El slug se calcula a partir del nombre de la liga: "Liga premier la Lima
/// 3ra edición" -> "liga-premier-la-lima-3ra-edicion". Si dos ligas tienen el
/// mismo nombre, se agrega un sufijo con el inicio del id para distinguirlas.
/// El enlace con el UUID completo sigue funcionando.
library;

const _uuidPattern =
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

bool isUuid(String s) => RegExp(_uuidPattern, caseSensitive: false).hasMatch(s);

String slugify(String name) {
  const from = 'áàäâãéèëêíìïîóòöôõúùüûñç';
  const to = 'aaaaaeeeeiiiiooooouuuunc';
  var t = name.trim().toLowerCase();
  for (var i = 0; i < from.length; i++) {
    t = t.replaceAll(from[i], to[i]);
  }
  return t
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');
}

/// Slug único de [league] entre [all] (ligas con `id` y `name`).
String leagueSlug(({String id, String name}) league,
    Iterable<({String id, String name})> all) {
  final base = slugify(league.name);
  if (base.isEmpty) return league.id;
  final sameName = all.where((l) => slugify(l.name) == base);
  if (sameName.length > 1) {
    return '$base-${league.id.substring(0, 4).toLowerCase()}';
  }
  return base;
}

/// Id de la liga que corresponde a [slugOrId], o null si no hay ninguna o
/// el slug es ambiguo.
String? resolveLeagueSlug(
    String slugOrId, Iterable<({String id, String name})> all) {
  if (isUuid(slugOrId)) return slugOrId;
  final s = slugOrId.toLowerCase();
  final exact = all.where((l) => leagueSlug(l, all) == s).toList();
  if (exact.length == 1) return exact.first.id;
  // Enlace viejo sin sufijo cuando después apareció otra liga igual.
  final byName = all.where((l) => slugify(l.name) == s).toList();
  if (byName.length == 1) return byName.first.id;
  return null;
}
