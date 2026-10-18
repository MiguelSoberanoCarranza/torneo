# Notas sobre la base de datos (producción)

**No se ejecutó nada contra la base de datos.** La migración a Flutter y la ruta
pública por torneo funcionan con el esquema y las políticas actuales.

Este documento lista lo que convendría hacer después. Todo es **propuesta**:
pruébalo primero en una copia, nunca directo en producción.

## Cómo probar sin tocar producción

1. **Supabase Branching** (plan Pro): crea una rama de preview con el mismo
   esquema. Ahí se aplican y prueban las migraciones.
2. **O un proyecto de staging:**
   ```bash
   supabase db dump --db-url "$PROD_DB_URL" -f schema.sql            # solo esquema
   supabase db dump --db-url "$PROD_DB_URL" --data-only -f data.sql  # datos (opcional)
   psql "$STAGING_DB_URL" -f schema.sql && psql "$STAGING_DB_URL" -f data.sql
   ```
   Apunta `env.json` de Flutter al proyecto de staging y prueba ahí.
3. Cuando esté validado, aplica el mismo `.sql` en producción, dentro de una
   transacción y con un respaldo reciente.

## 1. (Opcional) URL pública bonita: `/torneo/liga-apertura-2026`

Hoy la URL usa el UUID de la liga (`/torneo/3f2a…`) y no necesita cambios.
Para usar un *slug* legible:

```sql
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS leagues_slug_key ON public.leagues (slug);
-- Rellenar slugs existentes (revisar duplicados antes):
UPDATE public.leagues
SET slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
           || '-' || substr(id::text, 1, 4)
WHERE slug IS NULL;
```

En Flutter solo habría que buscar por `slug` y, si no hay resultado, por `id`
(en `PublicTournamentScreen._load`).

## 2. Seguridad: hallazgos de la revisión

> **Estado (18 oct 2026): migración lista y probada, pendiente de aplicar.**
> `supabase/propuestas/2026-10-18_seguridad_rls.sql` resuelve 2.1 y 2.3 (y el
> hueco de registro de 2.2). Se probó en un PostgreSQL local que imita a
> Supabase, con las políticas de los `.sql` del repo:
> `supabase/propuestas/pruebas_seguridad.py` pasa de **26/54** casos correctos
> antes a **54/54** después. La migración se puede ejecutar dos veces sin error,
> y `..._deshacer.sql` vuelve exactamente al estado anterior.
> El registro de capitanes por correo (`sync_captain_role`) sigue funcionando.
>
> Pasos para aplicarla:
> 1. En producción, SQL Editor:
>    `select tablename, policyname, cmd from pg_policies where schemaname = 'public';`
>    y guarda el resultado (por si hay políticas que no están en el repo).
> 2. Haz un respaldo (Database → Backups).
> 3. Si tienes proyecto de pruebas: aplica ahí y corre
>    `python3 supabase/propuestas/pruebas_seguridad.py "<cadena de conexión de pruebas>"`.
>    **Nunca corras ese script contra producción** (crea datos de prueba).
> 4. Aplica `2026-10-18_seguridad_rls.sql` en producción (va en una transacción).
> 5. Prueba en la app: editar un partido de tu liga, árbitro registrando goles,
>    capitán editando su plantilla, asignar árbitro.
>
> La app Flutter ya está ajustada a estas reglas: los botones de gestión solo
> aparecen al dueño de la liga (o superadmin), y "Agregar árbitro" avisa si la
> base rechaza el cambio.
>
> Lo que **no** cubre: los árbitros siguen siendo globales (pueden operar
> partidos de cualquier liga), porque el modelo no liga árbitros a ligas; y los
> buckets de imágenes (storage) no se revisaron.

### 2.1 Cualquier usuario puede hacerse `superadmin`
La política `"Users can update own profile."` (`USING (auth.uid() = id)`) no
restringe columnas: un usuario autenticado puede ejecutar
`update profiles set role = 'superadmin' where id = auth.uid()` desde la
consola del navegador con la anon key.

Propuesta (revisar antes de aplicar; hoy los dueños de liga promueven usuarios
a `captain`/`referee` desde la app, y esto lo mantiene):

```sql
CREATE OR REPLACE FUNCTION public.guard_profile_role()
-- SECURITY INVOKER a propósito: así current_user es el rol de quien llama.
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE my_role text;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN RETURN NEW; END IF;
  -- Triggers/funciones internas (p. ej. sync_captain_role) no pasan por aquí
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;

  SELECT role INTO my_role FROM profiles WHERE id = auth.uid();
  IF my_role = 'superadmin' THEN RETURN NEW; END IF;
  IF my_role = 'admin' AND NEW.id <> auth.uid()
     AND NEW.role IN ('captain', 'referee')
     AND coalesce(OLD.role, 'user') IN ('user', 'player', 'captain', 'referee') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'No autorizado para cambiar el rol';
END $$;

CREATE TRIGGER trg_guard_profile_role
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();
```

### 2.2 El registro crea perfiles con rol `admin`
`AdminLoginScreen` (y la versión Flutter, para no cambiar el comportamiento)
inserta el perfil con `role: 'admin'`. Si esto no es intencional, conviene que
el trigger `handle_new_user` cree siempre `user` y quitar ese insert del
cliente.

### 2.3 Escritura abierta a cualquier usuario autenticado
Políticas como `"Auth users can update matches"`, `"Auth Update Events"`,
`"Auth users can update players"`, `"Auth users can update teams"` y
`"Auth users can update leagues"` (de `schema.sql`) usan
`auth.role() = 'authenticated'`: cualquier cuenta puede modificar o borrar
partidos, eventos, jugadores o equipos de **cualquier** liga. Como las políticas
se combinan con OR, `"Owners can update their leagues"` no protege si la otra
sigue existiendo.

Propuesta de patrón (ejemplo para `matches`; repetir para las demás tablas):

```sql
CREATE OR REPLACE FUNCTION public.can_manage_league(p_league uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM leagues WHERE id = p_league AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
                 AND role IN ('superadmin', 'admin', 'referee'));
$$;

DROP POLICY IF EXISTS "Auth users can update matches" ON public.matches;
CREATE POLICY "League staff can update matches" ON public.matches
  FOR UPDATE USING (public.can_manage_league(league_id));
-- igual para INSERT (WITH CHECK) y DELETE
```

Primero ejecuta `select * from pg_policies where schemaname = 'public';` en
producción para ver las políticas que realmente existen; los `.sql` del repo
no dicen cuáles se aplicaron.

## 3. Secretos en el repositorio
- `.env` está versionado (URL + anon key). La anon key es pública por diseño,
  pero conviene sacarlo del repo (`git rm --cached .env`) y usar `.env.example`.
- `release-key.jks` (llave de firma de Android) está versionado. Las contraseñas
  no están en el repo, pero la llave no debería estar en git. Sácala del repo y
  guárdala en un gestor de secretos. **No la pierdas:** la versión Flutter
  necesita la misma llave para publicarse como actualización en Play Store.

**Por qué no lo quité yo:** si se borra del repo desde aquí, el próximo
`git pull` en tu PC **borraría tu copia local** de la llave y del `.env`; y si
Vercel compila la app React leyendo ese `.env`, el sitio dejaría de conectarse
a Supabase. Hazlo tú en este orden:

1. Respalda `release-key.jks` fuera de la carpeta del proyecto (y en un gestor
   de contraseñas o almacenamiento privado).
2. En Vercel → Settings → Environment Variables, confirma que estén
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (los nombres que use `.env`).
3. En tu PC, dentro de `D:\torneo`:
   ```
   git rm --cached .env release-key.jks
   echo .env>> .gitignore
   echo *.jks>> .gitignore
   git commit -m "chore: sacar secretos del repositorio"
   git push origin viejo
   ```
   Los archivos se quedan en tu disco; solo dejan de subirse.
4. Siguen en el historial de git. Si el repositorio es o fue público, considera
   la llave expuesta: con Play App Signing puedes pedir a Google un cambio de
   llave de subida (Play Console → Configuración → Integridad de la app).
