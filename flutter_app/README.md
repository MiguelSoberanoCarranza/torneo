# Torneo Premier — Flutter

Migración a Flutter de la app React/Vite + Capacitor que vive en la raíz del
repo (`src/`). Usa **la misma base de datos Supabase**, sin cambios de esquema,
políticas ni datos.

Plataformas: **Web**, **Android** e **iOS** desde un solo código.

## Ejecutar

```bash
cd flutter_app
cp env.example.json env.json   # rellenar SUPABASE_URL y SUPABASE_ANON_KEY
flutter pub get
flutter run --dart-define-from-file=env.json            # móvil / escritorio
flutter run -d chrome --dart-define-from-file=env.json  # web
flutter test                                            # pruebas de lógica
```

`env.json` está en `.gitignore`. Los valores son los mismos de `VITE_SUPABASE_URL`
y `VITE_SUPABASE_ANON_KEY` del `.env` de la app React.
`PUBLIC_BASE_URL` (opcional) es el dominio con el que se arman los enlaces
públicos desde Android/iOS; en web se usa el dominio actual.

### Build

```bash
flutter build web --release --dart-define-from-file=env.json
flutter build apk --release --dart-define-from-file=env.json
```

- **Web / Vercel:** subir `build/web` (p. ej. `vercel deploy build/web --prod`).
  `web/vercel.json` se copia al build y reescribe todas las rutas a
  `index.html`, así que `/torneo/<id>` funciona al abrirlo directo.
- **Android:** `applicationId` = `com.torneo.premier` (igual que la app
  Capacitor) para publicarla como actualización. Hay que firmarla con la misma
  llave de la versión actual.

## Ruta pública por torneo

```
https://<tu-dominio>/torneo/<league_id>
https://<tu-dominio>/torneo/<league_id>/partido/<match_id>
```

- Sin login y sin menú de administración.
- Pestañas: **Partidos** (en vivo, próximos, resultados), **Tabla**,
  **Goleo**, **Tarjetas** y **Liguilla** (solo lectura).
- Los marcadores se actualizan en tiempo real (Supabase Realtime sobre
  `matches`).
- Las ligas desactivadas (`is_active = false`) muestran "Torneo no disponible".
- El enlace se copia desde **Mis Ligas** (icono 🔗), desde **Detalles de Liga**
  o con el icono 🌐 del Inicio.

No requiere cambios en la BD: solo lee tablas que ya tienen política `SELECT`
pública (`leagues`, `teams`, `players`, `matches`, `match_events`,
`team_sanctions`).

## Mapa de rutas (React → Flutter)

| React | Flutter |
|---|---|
| `/` | `/` |
| `/league-table` | `/league-table` |
| `/liguilla` | `/liguilla` |
| `/calendar` | `/calendar` |
| `/sanciones` | `/sanciones` |
| `/my-leagues` | `/my-leagues` |
| `/my-team` | `/my-team` |
| `/admin-login` | `/admin-login` |
| `/match/:id` y `/match-details-live` (state) | `/match/:id` (una sola pantalla, con tiempo real) |
| `/league/:id` | `/league/:id` |
| `/create-league` (+ state para editar) | `/create-league`, `/league/:id/edit` |
| `/create-team` (state) | `/league/:id/create-team`, `/team/:teamId` |
| `/add-player` (state) | `/league/:id/add-player` |
| `/referee-match-control` (state) | `/referee/:matchId` |
| `/fixture-generator`, `/create-match`, `/match-management`, `/add-referee`, `/profile`, `/user-management` | igual |
| — | **`/torneo/:id`** (nuevo, público) |

Los parámetros que en React iban en `location.state` ahora van en la URL, así
cualquier pantalla se puede abrir o recargar directamente.

`/directory` y `/player-join` no se migraron: en React eran maquetas sin
lógica ni datos.

## Estructura

```
lib/
  main.dart, router.dart
  config/env.dart            credenciales vía --dart-define
  core/                      cliente Supabase, sesión/rol, consultas compartidas,
                             subida de imágenes, exportar imagen
  logic/                     lógica pura y probada: tabla, fixture round-robin,
                             liguilla, goleo/tarjetas, datos de prueba
  models/                    League, Team, Player, MatchModel, MatchEvent, ...
  widgets/                   menú inferior, tablas, cuadro de liguilla,
                             tarjetas de partido, captura de resultado manual
  screens/                   una pantalla por pantalla de React
  screens/public/            página pública por torneo
test/logic_test.dart
```

## Diferencias respecto a la app React

Correcciones que **no** tocan la BD:

1. **Liguilla:** el permiso de edición comparaba contra `leagues.created_by`,
   columna que no existe, así que solo el superadmin podía generar cruces.
   Ahora usa `owner_id`.
2. **Árbitro, 2º tiempo:** al iniciar el 2T no se guardaba `last_start_time`,
   así que el reloj público se quedaba congelado. Al terminar el 1T tampoco se
   limpiaba. Ya se guardan los dos. `+1 Min` también se guarda en la BD.
3. **Agregar árbitro:** validaba un campo "nombre" que no existía en el
   formulario, así que nunca se podía enviar. Ahora solo pide el email.
4. **Crear partido manual:** no enviaba `league_id` (NOT NULL) y el insert
   fallaba. Ahora primero se elige la liga.
5. **Detalle de partido:** los cambios se mostraban como "Tarjeta Amarilla";
   ahora se muestran como cambio con quién sale y quién entra.
6. **Inicio en vivo:** el minuto del gol usaba un campo inexistente
   (`rel_time_seconds`) y la consulta de eventos era ambigua (dos FK a
   `players`). Ahora usa `minute` y la FK explícita.
7. **Calendario, editar partido:** la fecha se tomaba en UTC y la hora en hora
   local, así que partidos nocturnos podían cambiar de día. Ahora todo es en
   hora local.
8. El menú inferior se renderizaba dos veces (`MainLayout`).
9. Confirmaciones de "toca otra vez en 3 s" → diálogos de confirmación.
10. **Detalles de Liga:** editar, agregar y generar datos de prueba solo
    aparece para el dueño de la liga o un superadmin (antes lo veía cualquiera).

Se conservó igual a propósito: el registro sigue intentando crear el perfil
con rol `admin` (igual que React; ver notas de BD).
