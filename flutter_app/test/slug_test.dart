import 'package:flutter_test/flutter_test.dart';
import 'package:torneo_app/logic/slug.dart';

void main() {
  const a = (
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    name: 'Liga premier la Lima 3ra edición '
  );
  const b = (id: 'bbbbbbbb-0000-0000-0000-000000000002', name: 'LIGA MX');
  const c = (id: 'cccccccc-0000-0000-0000-000000000003', name: 'Liga MX');

  test('slugify quita acentos, espacios y símbolos', () {
    expect(slugify(a.name), 'liga-premier-la-lima-3ra-edicion');
    expect(slugify('  Fútbol 7 · Zona Ñ  '), 'futbol-7-zona-n');
    expect(slugify('***'), '');
  });

  test('ligas con el mismo nombre llevan sufijo', () {
    expect(leagueSlug(a, [a, b, c]), 'liga-premier-la-lima-3ra-edicion');
    expect(leagueSlug(b, [a, b, c]), 'liga-mx-bbbb');
    expect(leagueSlug(c, [a, b, c]), 'liga-mx-cccc');
    expect(leagueSlug(b, [a, b]), 'liga-mx');
  });

  test('resolve: uuid, slug único, slug con sufijo y ambiguo', () {
    expect(resolveLeagueSlug(a.id, [a, b, c]), a.id);
    expect(
        resolveLeagueSlug('liga-premier-la-lima-3ra-edicion', [a, b, c]), a.id);
    expect(resolveLeagueSlug('LIGA-MX-cccc', [a, b, c]), c.id);
    expect(resolveLeagueSlug('liga-mx', [a, b, c]), isNull);
    expect(resolveLeagueSlug('liga-mx', [a, b]), b.id);
    expect(resolveLeagueSlug('no-existe', [a, b, c]), isNull);
  });
}
