const BASE = 'https://padel-coach.vitorsavicki.workers.dev';
const jar = new Map();
const email = `diag.${Date.now()}@zeta.test`;
function guardarCookies(r) { const l = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean); for (const sc of l) { const par = sc.split(';')[0]; const i = par.indexOf('='); if (i > 0) jar.set(par.slice(0, i), par.slice(i + 1)); } }
const ch = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
async function get(p) { const r = await fetch(BASE + p, { headers: { cookie: ch() }, redirect: 'manual' }); guardarCookies(r); return { s: r.status, b: await r.text() }; }
async function post(p, d) { const r = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: ch() }, body: new URLSearchParams(d), redirect: 'manual' }); guardarCookies(r); return { s: r.status, b: await r.text() }; }
const c1 = await get('/cadastro'); const csrf = c1.b.match(/<input[^>]*name="csrf"[^>]*>/)?.[0].match(/value="([^"]+)"/)?.[1];
await post('/cadastro', { csrf, nome: 'Diag Zeta', email, senha: 'TesteZeta123' });
for (const rota of ['/saude/ia', '/saude/ia/groq', '/saude/ia/gerar', '/saude/ia/modelos']) {
  const t0 = Date.now();
  try {
    const r = await get(rota);
    console.log(`${rota} [${r.s}] ${Date.now() - t0}ms: ${r.b.slice(0, 300)}`);
  } catch (e) { console.log(`${rota} ERRO: ${e.message}`); }
}
