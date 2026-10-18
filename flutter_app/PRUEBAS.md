# Pruebas antes de pasar a producción

Hay tres niveles. Los dos primeros son automáticos y **no escriben nada** en la
base de datos; el tercero es manual y sí escribe, así que hazlo en una liga de
prueba (o, mejor, en un proyecto de Supabase de pruebas, ver al final).

## 1. Pruebas automáticas (siempre)

```bash
cd flutter_app
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

Cubren la lógica sin red: tabla de posiciones y desempates, sanciones,
generador de fixture (pares, impares, ida y vuelta, días permitidos), liguilla,
estadísticas, racha, posponer jornada, partidos repetidos, modelos y formatos,
pósters sin desbordes y los componentes de pantalla (tablas, tarjetas de
partido, llaves de liguilla, menú).

GitHub Actions (`.github/workflows/flutter.yml`) corre lo mismo y además
compila la versión web en cada push que toque `flutter_app/`. **No se pasa a
producción con la CI en rojo.**

## 2. Prueba de humo con datos reales (solo lectura)

Abre cada pantalla con los datos de producción, como visitante y como dueño de
una liga, y falla si hay excepciones, errores de consola, consultas que fallan o
si alguna pantalla intenta escribir solo por abrirse. Todas las escrituras se
bloquean antes de salir del navegador.

```bash
cd flutter_app
flutter build web --release --dart-define-from-file=env.json
# servir build/web con cualquier servidor estático que redirija a index.html, p. ej.:
npx serve -s build/web -l 8088
# en otra terminal (una vez: npm i -D playwright && npx playwright install chromium)
SMOKE_SUPABASE_REF=ptqdkouuatgxejbxqztw \
SMOKE_USER_ID=<uuid del dueño de la liga> \
SMOKE_LEAGUE_ID=<uuid de la liga> \
SMOKE_MATCH_ID=<uuid de un partido> \
SMOKE_TEAM_ID=<uuid de un equipo> \
node tool/smoke/smoke.mjs
```

En PowerShell las variables se ponen con `$env:SMOKE_USER_ID="..."` antes del
comando. Deja capturas de cada pantalla en `build/smoke/`.

## 3. Checklist manual (escribe datos: usar liga de prueba)

Marca cada punto en celular (Android/iPhone) **y** en computadora.

### Acceso
- [ ] Entrar con cuenta de administrador, cerrar sesión y volver a entrar.
- [ ] Una ruta protegida sin sesión manda a Ingresar y, tras entrar, regresa a la ruta.
- [ ] Un visitante sin sesión ve Inicio, Tabla y Liguilla, pero no Calendario ni Sanciones.

### Liga y equipos
- [ ] Crear liga; editarla y cambiar su estado (Próximamente / Activa / Finalizada).
- [ ] Crear equipo con escudo (subir imagen) y colores; editarlo.
- [ ] Agregar jugador con foto, dorsal y posición; editarlo y borrarlo.
- [ ] Copiar el enlace público del torneo y abrirlo en una ventana privada.

### Calendario
- [ ] Generar fixture (días permitidos, ida y vuelta) y revisar que no haya repetidos.
- [ ] Crear, editar y borrar un partido a mano.
- [ ] **Posponer jornada** con "recorrer posteriores": cambian las fechas de
      esa y las siguientes jornadas, conservando la hora; los jugados no se mueven.
- [ ] Posponer sin recorrer: solo cambia esa jornada.
- [ ] "Eliminar repetidos": la lista coincide con lo esperado y solo afecta la liga elegida.
- [ ] Compartir jornada (imagen) se descarga/comparte bien.

### Partido en vivo (árbitro)
- [ ] Iniciar, registrar gol, autogol, amarilla, roja, cambio y deshacer evento.
- [ ] Medio tiempo, segundo tiempo, +1 min, finalizar; el reloj sigue bien tras recargar.
- [ ] En otro dispositivo, Detalle del partido se actualiza solo (tiempo real).
- [ ] Alineaciones se guardan.
- [ ] Resultado manual y doble default (P - P); reiniciar partido borra eventos.

### Resultados y estadísticas
- [ ] La tabla suma puntos y desempata como se espera; las sanciones restan puntos.
- [ ] Goleadores y tarjetas cuadran con los eventos.
- [ ] Liguilla: cruces 1v8, 2v7…, avance por marcador y por mejor posición en empate.

### Pósters
- [ ] Póster previa y resultado: con muchos goles, nombres largos y cada fondo; con foto propia.
- [ ] Descarga en computadora (PNG 1080×1350) y compartir en celular.

### Otros
- [ ] Sanciones: registrar, editar, quitar.
- [ ] Perfil: cambiar nombre y foto.
- [ ] Gestión de usuarios: cambiar rol.
- [ ] Menú flotante: no tapa el último elemento de ninguna lista; botón de sanción visible.

## Entorno de pruebas recomendado

La base actual es la de producción. Para el punto 3 lo más seguro es crear un
segundo proyecto de Supabase (gratis), correr `supabase/schema.sql` y los demás
`.sql` de la carpeta `supabase/`, y compilar la app con un `env.staging.json`
que apunte a ese proyecto:

```bash
flutter run -d chrome --dart-define-from-file=env.staging.json
```

Así se puede probar todo lo que escribe sin riesgo para las ligas reales.
