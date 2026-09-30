import 'dart:math';

import 'package:flutter/foundation.dart';

import '../core/supabase.dart';

const _teamNames = [
  'Los Tigres', 'Águilas Reales', 'Lobos Plateados', 'Toros FC',
  'Guerreros de la Cancha', 'Dragones Rojos', 'Panteras Negras',
  'Tiburones Azules', 'Leones Dorados', 'Rayados del Norte',
  'Atlético San Miguel', 'Deportivo Estrellas', 'Huracanes FC',
  'Espartanos', 'Vikingos', 'Halcones', 'Pumas', 'Bravos',
];
const _firstNames = [
  'Juan', 'José', 'Miguel', 'Carlos', 'Luis', 'Pedro', 'Pablo', 'Jorge',
  'Fernando', 'Ricardo', 'Daniel', 'David', 'Eduardo', 'Francisco',
  'Javier', 'Alejandro', 'Manuel', 'Roberto', 'Gabriel',
];
const _lastNames = [
  'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez',
  'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Hernández', 'Ruiz',
  'Torres', 'Vargas', 'Reyes', 'Morales', 'Jiménez',
];
const _positions = ['Portero', 'Defensa', 'Medio', 'Delantero'];

/// Genera equipos y jugadores de prueba (port de utils/seeder.ts).
Future<bool> seedLeague(String leagueId, {int count = 10}) async {
  final rnd = Random();
  final names = [..._teamNames]..shuffle(rnd);
  try {
    for (final name in names.take(count)) {
      final team = await db
          .from('teams')
          .insert({'league_id': leagueId, 'name': name})
          .select()
          .single();
      final n = 11 + rnd.nextInt(5);
      await db.from('players').insert([
        for (var j = 0; j < n; j++)
          {
            'team_id': team['id'],
            'name':
                '${_firstNames[rnd.nextInt(_firstNames.length)]} ${_lastNames[rnd.nextInt(_lastNames.length)]}',
            'number': rnd.nextInt(99) + 1,
            'position': _positions[rnd.nextInt(_positions.length)],
            'is_captain': j == 0,
          }
      ]);
    }
    return true;
  } catch (e) {
    debugPrint('Seeding error: $e');
    return false;
  }
}
