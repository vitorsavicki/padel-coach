// Teste do prompt: envia 4 fotos nitidas como se fossem os quadros do video,
// sem passar pela extracao. Serve para avaliar a qualidade da analise da IA.
import { readFileSync } from 'node:fs';

const BASE = 'https://padel-coach.vitorsavicki.workers.dev';
const FOTOS = process.argv.slice(2);
if (FOTOS.length !== 4) {
  console.error('uso: node teste-fotos.mjs foto1.jpg foto2.jpg foto3.jpg foto4.jpg');
  process.exit(1);
}
const jar = new Map();
const email = `fotos.${Date.now()}@zeta.test`;
const senha = 'TesteZeta123';
function guardarCookies(r) {
  const l = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean);
  for (const sc of l) {
    const par = sc.split(';')[0];
    const i = par.indexOf('=');
    if (i > 0) jar.set(par.slice(0, i), par.slice(i + 1));
  }
}
const ch = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
async function get(p) {
  const r = await fetch(BASE + p, { headers: { cookie: ch() }, redirect: 'manual' });
  guardarCookies(r);
  return { s: r.status, l: r.headers.get('location'), b: await r.text() };
}
async function post(p, d, extra = {}) {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: ch(), ...extra },
    body: new URLSearchParams(d),
    redirect: 'manual',
  });
  guardarCookies(r);
  return { s: r.status, l: r.headers.get('location'), b: await r.text() };
}
const csrfDe = (h) => h.match(/<input[^>]*name="csrf"[^>]*>/)?.[0].match(/value="([^"]+)"/)?.[1];

const c1 = await get('/cadastro');
const r1 = await post('/cadastro', { csrf: csrfDe(c1.b), nome: 'Fotos Teste', email, senha });
console.log('cadastro:', r1.s, r1.l ?? '');

const novo = await get('/videos/novo');
const quadros = FOTOS.map((f) => 'data:image/jpeg;base64,' + readFileSync(f).toString('base64'));
const t0 = Date.now();
const r2 = await post(
  '/videos/novo',
  { csrf: csrfDe(novo.b), titulo: 'Teste com fotos nitidas', quadros: JSON.stringify(quadros) },
  { 'x-async': '1' },
);
console.log('analise:', r2.s, `${Math.round((Date.now() - t0) / 1000)}s`, r2.b.slice(0, 300));
