// Prueba de humo SOLO LECTURA contra la base real.
//
// Abre cada pantalla de la app (web) en Chromium y falla si:
//  - la página lanza una excepción de JavaScript/Dart,
//  - aparece un error en la consola,
//  - alguna consulta GET a Supabase responde 4xx/5xx (columna o relación
//    mal escrita, permisos, etc.),
//  - la pantalla intenta ESCRIBIR en la base solo por abrirse.
//
// Ninguna escritura llega a Supabase: todo POST/PATCH/PUT/DELETE y todo
// /auth/v1 se responde aquí con 403. Las lecturas se hacen sin token (como
// visitante); para ver las pantallas de administración se simula en el
// navegador la sesión del usuario SMOKE_USER_ID (sin contraseña ni token
// real, solo para que la app muestre los menús de ese rol).
//
// Uso (con la app ya compilada y servida, ver PRUEBAS.md):
//   SMOKE_BASE_URL=http://127.0.0.1:8088 \
//   SMOKE_SUPABASE_REF=ptqdkouuatgxejbxqztw \
//   SMOKE_USER_ID=<uuid dueño de la liga> \
//   SMOKE_LEAGUE_ID=<uuid liga> SMOKE_MATCH_ID=<uuid partido> \
//   SMOKE_TEAM_ID=<uuid equipo> \
//   node tool/smoke/smoke.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const env = (k, def) => {
  const v = process.env[k] ?? def;
  if (v === undefined) {
    console.error(`Falta la variable ${k}`);
    process.exit(2);
  }
  return v;
};
const BASE = env('SMOKE_BASE_URL', 'http://127.0.0.1:8088');
const REF = env('SMOKE_SUPABASE_REF');
const USER = env('SMOKE_USER_ID');
const LEAGUE = env('SMOKE_LEAGUE_ID');
const MATCH = env('SMOKE_MATCH_ID');
const TEAM = env('SMOKE_TEAM_ID');
const OUT = process.env.SMOKE_OUT || 'build/smoke';
const WAIT = Number(process.env.SMOKE_WAIT_MS || 7000);
mkdirSync(OUT, { recursive: true });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const fakeJwt = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: USER, role: 'authenticated', exp, aud: 'authenticated' })}.smoke`;
const fakeSession = {
  access_token: fakeJwt, token_type: 'bearer', expires_in: 3600, expires_at: exp,
  refresh_token: 'smoke',
  user: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'smoke@local',
    app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
};

const ROUTES = [
  // [ruta, ¿con sesión simulada?]
  ['/admin-login', false],
  [`/torneo/${LEAGUE}`, false],
  [`/torneo/${LEAGUE}/partido/${MATCH}`, false],
  ['/', false],
  ['/', true],
  ['/league-table', true],
  ['/liguilla', true],
  ['/calendar', true],
  ['/sanciones', true],
  ['/my-leagues', true],
  ['/profile', true],
  [`/match/${MATCH}`, true],
  [`/league/${LEAGUE}`, true],
  [`/league/${LEAGUE}/edit`, true],
  [`/league/${LEAGUE}/create-team`, true],
  [`/team/${TEAM}`, true],
  ['/create-league', true],
  ['/fixture-generator', true],
  ['/match-management', true],
  ['/create-match', true],
  ['/user-management', true],
];

const browser = await chromium.launch();
const results = [];
for (const [route, admin] of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  const problems = [];
  const writes = [];
  if (admin) {
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v),
      [`sb-${REF}-auth-token`, JSON.stringify(fakeSession)]);
  }
  await page.route(/supabase\.co\/(rest|storage|auth|realtime)\/v1\//, async (r) => {
    const req = r.request();
    const m = req.method();
    const path = req.url().split('?')[0].split('.co')[1];
    if (path.startsWith('/auth/v1') || !['GET', 'HEAD', 'OPTIONS'].includes(m)) {
      if (!path.startsWith('/auth/v1')) writes.push(`${m} ${path}`);
      return r.fulfill({ status: 403, contentType: 'application/json',
        body: JSON.stringify({ message: 'smoke: escritura bloqueada' }) });
    }
    const headers = { ...req.headers() };
    delete headers.authorization;
    try {
      const res = await r.fetch({ headers });
      if (res.status() >= 400) problems.push(`GET ${path} -> ${res.status()} ${(await res.text()).slice(0, 160)}`);
      await r.fulfill({ response: res });
    } catch (e) {
      problems.push(`GET ${path} -> ${e.message}`);
      await r.abort();
    }
  });
  page.on('pageerror', (e) => problems.push(`excepción: ${e.message.slice(0, 200)}`));
  const warnings = [];
  page.on('console', (msg) => {
    // "Failed to load resource" se reporta abajo con su URL (requestfailed /
    // response); el websocket de tiempo real puede fallar detrás de un proxy.
    if (msg.type() === 'error' &&
        !/Failed to load resource|smoke: escritura|WebSocket|realtime/i.test(msg.text())) {
      problems.push(`consola: ${msg.text().slice(0, 200)}`);
    }
  });
  // Recursos que no cargan: los de la app o Supabase son error; imágenes de
  // otros sitios (escudos subidos a hosts externos) solo se avisan.
  const appHost = new URL(BASE).host;
  page.on('requestfailed', (req) => {
    const url = req.url();
    const msg = `${req.failure()?.errorText} ${url.slice(0, 140)}`;
    if (/supabase\.co\/realtime/.test(url)) return;
    if (new URL(url).host === appHost) problems.push(`no cargó: ${msg}`);
    else warnings.push(msg);
  });
  page.on('response', (res) => {
    if (new URL(res.url()).host === appHost && res.status() >= 400) {
      problems.push(`${res.status()} ${res.url().slice(0, 140)}`);
    }
  });
  try {
    await page.goto(BASE + route, { waitUntil: 'load' });
    await page.waitForTimeout(WAIT);
  } catch (e) {
    problems.push(`no cargó: ${e.message.slice(0, 160)}`);
  }
  const name = `${admin ? 'admin' : 'publico'}${route.replace(/[^a-z0-9]+/gi, '_')}`;
  await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
  if (writes.length) problems.push(`intentó escribir al abrir: ${[...new Set(writes)].join(', ')}`);
  // Se cierra antes de reportar para no perder eventos que lleguen tarde.
  await page.close();
  const found = [...new Set(problems)];
  results.push({ route, admin, problems: found });
  console.log(`${found.length ? '✗' : '✓'} ${admin ? '[admin] ' : '[público]'} ${route}`);
  for (const p of found) console.log(`    - ${p}`);
  for (const w of new Set(warnings)) console.log(`    · aviso (externo): ${w}`);
}
await browser.close();

const failed = results.filter((r) => r.problems.length);
console.log(`\n${results.length - failed.length}/${results.length} pantallas OK. Capturas en ${OUT}/`);
process.exit(failed.length ? 1 : 0);
