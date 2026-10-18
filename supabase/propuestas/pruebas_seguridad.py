#!/usr/bin/env python3
"""Pruebas de permisos (RLS) para 2026-10-18_seguridad_rls.sql.

NUNCA correr contra producción: crea y borra datos de prueba. Úsalo con una
base local o un proyecto de Supabase de pruebas.

    python3 pruebas_seguridad.py "postgresql://postgres:...@host:5432/postgres"

Cada caso se ejecuta como un usuario simulado (rol `authenticated` o `anon`
con su id en request.jwt.claim.sub, igual que hace Supabase) dentro de una
transacción que se deshace al final. "filas" es cuántas filas cambió la
instrucción; "error" significa que la base la rechazó.
"""
import subprocess
import sys

DB = sys.argv[1] if len(sys.argv) > 1 else None
if not DB:
    sys.exit(__doc__)

# Usuarios de prueba
A = 'aaaaaaaa-0000-0000-0000-00000000000a'   # admin, dueño de L1
B = 'bbbbbbbb-0000-0000-0000-00000000000b'   # admin, dueño de L2
R = 'cccccccc-0000-0000-0000-00000000000c'   # árbitro
C = 'dddddddd-0000-0000-0000-00000000000d'   # capitán (manager de T1)
U = 'eeeeeeee-0000-0000-0000-00000000000e'   # usuario común
S = 'ffffffff-0000-0000-0000-00000000000f'   # superadmin
X = '99999999-0000-0000-0000-000000000099'   # recién registrado, sin perfil
L1, L2 = '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'
T1, T2, T3 = ('11000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000002',
              '23000000-0000-0000-0000-000000000003')
P1, P3 = '11100000-0000-0000-0000-000000000001', '23300000-0000-0000-0000-000000000003'
M1, M2 = '1a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000002'
E1 = '1e000000-0000-0000-0000-000000000001'
SA1 = '15000000-0000-0000-0000-000000000001'

SEED = f"""
DELETE FROM public.match_events WHERE id = '{E1}';
DELETE FROM public.team_sanctions WHERE league_id IN ('{L1}', '{L2}');
DELETE FROM public.matches WHERE league_id IN ('{L1}', '{L2}');
DELETE FROM public.players WHERE team_id IN ('{T1}', '{T2}', '{T3}');
DELETE FROM public.teams WHERE league_id IN ('{L1}', '{L2}');
DELETE FROM public.leagues WHERE id IN ('{L1}', '{L2}') OR owner_id IN ('{U}', '{X}');
DELETE FROM public.profiles WHERE id IN ('{A}', '{B}', '{R}', '{C}', '{U}', '{S}', '{X}');
DELETE FROM auth.users WHERE id IN ('{A}', '{B}', '{R}', '{C}', '{U}', '{S}', '{X}');
INSERT INTO auth.users (id, email) VALUES
  ('{A}', 'a@t.mx'), ('{B}', 'b@t.mx'), ('{R}', 'r@t.mx'), ('{C}', 'c@t.mx'),
  ('{U}', 'u@t.mx'), ('{S}', 's@t.mx'), ('{X}', 'x@t.mx');
DELETE FROM public.profiles WHERE id = '{X}';  -- X aún no tiene perfil
INSERT INTO public.profiles (id, email, role) VALUES
  ('{A}', 'a@t.mx', 'admin'), ('{B}', 'b@t.mx', 'admin'), ('{R}', 'r@t.mx', 'referee'),
  ('{C}', 'c@t.mx', 'captain'), ('{U}', 'u@t.mx', 'user'), ('{S}', 's@t.mx', 'superadmin')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
INSERT INTO public.leagues (id, name, owner_id, format) VALUES ('{L1}', 'Liga A', '{A}', '11'), ('{L2}', 'Liga B', '{B}', '11');
INSERT INTO public.teams (id, league_id, name, manager_id) VALUES
  ('{T1}', '{L1}', 'T1', '{C}'), ('{T2}', '{L1}', 'T2', NULL), ('{T3}', '{L2}', 'T3', NULL);
INSERT INTO public.players (id, team_id, name) VALUES ('{P1}', '{T1}', 'P1'), ('{P3}', '{T3}', 'P3');
INSERT INTO public.matches (id, league_id, home_team_id, away_team_id, status) VALUES
  ('{M1}', '{L1}', '{T1}', '{T2}', 'scheduled'), ('{M2}', '{L2}', '{T3}', '{T3}', 'scheduled');
INSERT INTO public.match_events (id, match_id, event_type, minute) VALUES ('{E1}', '{M1}', 'goal', 10);
INSERT INTO public.team_sanctions (id, league_id, team_id, points_delta, reason)
  VALUES ('{SA1}', '{L1}', '{T1}', -1, 'prueba');
"""

ERR = 'error'
# (descripción, usuario o None=anon, sql, esperado: nº de filas o 'error')
CASES = [
    # Partidos
    ('Dueño edita marcador de su liga', A, f"UPDATE matches SET home_score = 1 WHERE id = '{M1}'", 1),
    ('Otro admin edita partido ajeno', B, f"UPDATE matches SET home_score = 9 WHERE id = '{M1}'", 0),
    ('Árbitro edita marcador', R, f"UPDATE matches SET home_score = 2 WHERE id = '{M1}'", 1),
    ('Capitán edita marcador', C, f"UPDATE matches SET home_score = 9 WHERE id = '{M1}'", 0),
    ('Usuario común edita marcador', U, f"UPDATE matches SET home_score = 9 WHERE id = '{M1}'", 0),
    ('Visitante sin sesión edita marcador', None, f"UPDATE matches SET home_score = 9 WHERE id = '{M1}'", 0),
    ('Superadmin edita partido', S, f"UPDATE matches SET home_score = 3 WHERE id = '{M1}'", 1),
    ('Árbitro no puede borrar partidos', R, f"DELETE FROM matches WHERE id = '{M1}'", 0),
    ('Otro admin no puede borrar partido ajeno', B, f"DELETE FROM matches WHERE id = '{M1}'", 0),
    ('Dueño borra partido de su liga', A, f"DELETE FROM matches WHERE id = '{M1}'", 1),
    ('Dueño crea partido en su liga', A,
     f"INSERT INTO matches (league_id, home_team_id, away_team_id) VALUES ('{L1}', '{T1}', '{T2}')", 1),
    ('Otro admin crea partido en liga ajena', B,
     f"INSERT INTO matches (league_id, home_team_id, away_team_id) VALUES ('{L1}', '{T1}', '{T2}')", ERR),
    ('Dueño no puede mover partido a liga ajena', A,
     f"UPDATE matches SET league_id = '{L2}' WHERE id = '{M1}'", ERR),
    # Ligas
    ('Dueño edita su liga', A, f"UPDATE leagues SET name = 'x' WHERE id = '{L1}'", 1),
    ('Otro admin edita liga ajena', B, f"UPDATE leagues SET name = 'x' WHERE id = '{L1}'", 0),
    ('Otro admin borra liga ajena', B, f"DELETE FROM leagues WHERE id = '{L1}'", 0),
    ('Usuario crea su propia liga', U, f"INSERT INTO leagues (name, owner_id, format) VALUES ('Mía', '{U}', '11')", 1),
    ('Crear liga a nombre de otro', B, f"INSERT INTO leagues (name, owner_id, format) VALUES ('Falsa', '{A}', '11')", ERR),
    ('Dueño no puede regalar su liga', A, f"UPDATE leagues SET owner_id = '{B}' WHERE id = '{L1}'", ERR),
    ('Superadmin cambia dueño', S, f"UPDATE leagues SET owner_id = '{B}' WHERE id = '{L1}'", 1),
    # Equipos
    ('Dueño edita equipo de su liga', A, f"UPDATE teams SET name = 'x' WHERE id = '{T2}'", 1),
    ('Otro admin edita equipo ajeno', B, f"UPDATE teams SET name = 'x' WHERE id = '{T1}'", 0),
    ('Capitán edita su equipo', C, f"UPDATE teams SET name = 'Mi equipo' WHERE id = '{T1}'", 1),
    ('Capitán no puede mover su equipo de liga', C, f"UPDATE teams SET league_id = '{L2}' WHERE id = '{T1}'", ERR),
    ('Capitán no edita otro equipo', C, f"UPDATE teams SET name = 'x' WHERE id = '{T2}'", 0),
    ('Otro admin crea equipo en liga ajena', B, f"INSERT INTO teams (league_id, name) VALUES ('{L1}', 'x')", ERR),
    # Jugadores
    ('Capitán agrega jugador a su equipo', C, f"INSERT INTO players (team_id, name) VALUES ('{T1}', 'Nuevo')", 1),
    ('Capitán agrega jugador a otro equipo', C, f"INSERT INTO players (team_id, name) VALUES ('{T3}', 'x')", ERR),
    ('Capitán no puede pasar jugador a otro equipo', C, f"UPDATE players SET team_id = '{T3}' WHERE id = '{P1}'", ERR),
    ('Capitán borra jugador ajeno', C, f"DELETE FROM players WHERE id = '{P3}'", 0),
    ('Dueño edita jugador de su liga', A, f"UPDATE players SET name = 'x' WHERE id = '{P1}'", 1),
    ('Otro admin agrega jugador en liga ajena', B, f"INSERT INTO players (team_id, name) VALUES ('{T1}', 'x')", ERR),
    # Eventos
    ('Árbitro registra gol', R, f"INSERT INTO match_events (match_id, event_type, minute) VALUES ('{M1}', 'goal', 5)", 1),
    ('Otro admin registra gol en partido ajeno', B,
     f"INSERT INTO match_events (match_id, event_type, minute) VALUES ('{M1}', 'goal', 5)", ERR),
    ('Usuario común borra evento', U, f"DELETE FROM match_events WHERE id = '{E1}'", 0),
    ('Dueño borra evento', A, f"DELETE FROM match_events WHERE id = '{E1}'", 1),
    # Sanciones
    ('Dueño registra sanción', A,
     f"INSERT INTO team_sanctions (league_id, team_id, points_delta, reason) VALUES ('{L1}', '{T1}', -3, 'r')", 1),
    ('Otro admin registra sanción en liga ajena', B,
     f"INSERT INTO team_sanctions (league_id, team_id, points_delta, reason) VALUES ('{L1}', '{T1}', -3, 'r')", ERR),
    ('Otro admin borra sanción ajena', B, f"DELETE FROM team_sanctions WHERE id = '{SA1}'", 0),
    # Perfiles y roles
    ('Usuario se hace superadmin', U, f"UPDATE profiles SET role = 'superadmin' WHERE id = '{U}'", ERR),
    ('Admin se hace superadmin', A, f"UPDATE profiles SET role = 'superadmin' WHERE id = '{A}'", ERR),
    ('Usuario cambia su nombre', U, f"UPDATE profiles SET full_name = 'Juan' WHERE id = '{U}'", 1),
    ('Admin nombra árbitro a un usuario', A, f"UPDATE profiles SET role = 'referee' WHERE id = '{U}'", 1),
    ('Admin nombra capitán a un usuario', A, f"UPDATE profiles SET role = 'captain' WHERE id = '{U}'", 1),
    ('Admin cambia el nombre de otro', A, f"UPDATE profiles SET full_name = 'x' WHERE id = '{U}'", ERR),
    ('Admin hace superadmin a otro', A, f"UPDATE profiles SET role = 'superadmin' WHERE id = '{U}'", ERR),
    ('Admin degrada a otro admin', A, f"UPDATE profiles SET role = 'user' WHERE id = '{B}'", ERR),
    ('Usuario cambia rol de otro', U, f"UPDATE profiles SET role = 'referee' WHERE id = '{C}'", 0),
    ('Superadmin cambia cualquier rol', S, f"UPDATE profiles SET role = 'admin' WHERE id = '{U}'", 1),
    ('Registro: crea su perfil como admin', X,
     f"INSERT INTO profiles (id, email, role) VALUES ('{X}', 'x@t.mx', 'admin')", 1),
    ('Registro: crea su perfil como superadmin', X,
     f"INSERT INTO profiles (id, email, role) VALUES ('{X}', 'x@t.mx', 'superadmin')", ERR),
    ('Crear perfil de otra persona', U,
     f"INSERT INTO profiles (id, email, role) VALUES ('{X}', 'x@t.mx', 'user')", ERR),
    # Lectura pública sigue funcionando
    ('Visitante lee partidos', None, "SELECT 1 FROM matches WHERE league_id IN "
                                     f"('{L1}', '{L2}')", 2),
    ('Visitante lee eventos', None, f"SELECT 1 FROM match_events WHERE id = '{E1}'", 1),
]


def psql(sql: str) -> subprocess.CompletedProcess:
    return subprocess.run(['psql', DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql],
                          capture_output=True, text=True)


def run_case(user, sql):
    claims = (f"SELECT set_config('request.jwt.claim.sub', '{user}', true),"
              f" set_config('request.jwt.claim.role', 'authenticated', true);"
              f" SET LOCAL ROLE authenticated;") if user else "SET LOCAL ROLE anon;"
    counted = sql if sql.lstrip().upper().startswith('SELECT') else f"{sql} RETURNING 1"
    res = psql(f"BEGIN; {claims} WITH r AS ({counted}) SELECT count(*) FROM r; ROLLBACK;")
    if res.returncode != 0:
        return ERR, res.stderr.strip().splitlines()[-1] if res.stderr.strip() else ''
    out = [line for line in res.stdout.split('\n') if line.strip().isdigit()]
    return int(out[-1]), ''


def main():
    seed = psql(SEED)
    if seed.returncode != 0:
        sys.exit(f'No se pudieron crear los datos de prueba:\n{seed.stderr}')
    fails = 0
    for desc, user, sql, expected in CASES:
        got, detail = run_case(user, sql)
        ok = got == expected
        fails += not ok
        print(f"{'✓' if ok else '✗'} {desc}: esperado {expected}, obtenido {got}"
              + (f"  ({detail[:90]})" if detail and not ok else ''))
    # Limpieza
    psql(SEED.split('INSERT INTO auth.users')[0])
    print(f"\n{len(CASES) - fails}/{len(CASES)} casos correctos")
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
