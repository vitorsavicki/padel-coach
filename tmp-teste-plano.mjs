const BASE = 'https://padel-coach.vitorsavicki.workers.dev';
const jar = new Map();
const email = `plano.${Date.now()}@zeta.test`;
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
async function post(p, d) {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: ch() }, body: new URLSearchParams(d), redirect: 'manual' });
  guardarCookies(r);
  return { s: r.status, l: r.headers.get('location'), b: await r.text() };
}
const csrfDe = (h) => h.match(/<input[^>]*name="csrf"[^>]*>/)?.[0].match(/value="([^"]+)"/)?.[1];
const planoAtual = (h) => h.match(/Seu plano agora:<\/strong>\s*([^<]+)/)?.[1]?.trim();

const c = await get('/cadastro');
await post('/cadastro', { csrf: csrfDe(c.b), nome: 'Plano Zeta', email, senha });

const planos = await get('/planos');
const csrf = csrfDe(planos.b);
const simulado = planos.b.includes('Modo de teste: a assinatura e simulada');
console.log('planos: status=' + planos.s + ' | modo simulado=' + simulado + ' | plano atual=' + planoAtual(planos.b));

async function assinar(id, nome) {
  const abrir = await post(`/planos/simular/${id}`, { csrf });
  console.log(`abrir ${nome}: status=${abrir.s} | tem confirmar=${/Confirmar pagamento simulado/.test(abrir.b)}`);
  if (abrir.s !== 200) return;
  const conf = await post(`/planos/simular/${id}/confirmar`, { csrf: csrfDe(abrir.b) });
  console.log(`confirmar ${nome}: status=${conf.s} location=${conf.l}`);
  const depois = await get('/planos');
  const atual = planoAtual(depois.b);
  const cardAtivo = (depois.b.match(new RegExp(`<h3>${nome}</h3>[\\s\\S]*?Plano ativo`)) || []).length > 0;
  const aindaAssina = depois.b.includes(`Assinar ${nome} (simulado)`);
  console.log(`depois ${nome}: plano atual=${atual} | card com "Plano ativo"=${cardAtivo} | ainda mostra botao=${aindaAssina}`);
}

await assinar(2, 'Atleta');
await assinar(3, 'Pro');
