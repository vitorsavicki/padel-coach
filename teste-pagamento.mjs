const BASE = 'https://padel-coach.vitorsavicki.workers.dev';
const jar = new Map();
const email = `pgto.${Date.now()}@zeta.test`;
function guardarCookies(r) { const l = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean); for (const sc of l) { const par = sc.split(';')[0]; const i = par.indexOf('='); if (i > 0) jar.set(par.slice(0, i), par.slice(i + 1)); } }
const ch = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
async function get(p) { const r = await fetch(BASE + p, { headers: { cookie: ch() }, redirect: 'manual' }); guardarCookies(r); return { s: r.status, l: r.headers.get('location'), b: await r.text() }; }
async function post(p, d) { const r = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: ch() }, body: new URLSearchParams(d), redirect: 'manual' }); guardarCookies(r); return { s: r.status, l: r.headers.get('location'), b: await r.text() }; }
const csrfDe = (h) => h.match(/<input[^>]*name="csrf"[^>]*>/)?.[0].match(/value="([^"]+)"/)?.[1];
const c1 = await get('/cadastro'); await post('/cadastro', { csrf: csrfDe(c1.b), nome: 'Pgto Zeta', email, senha: 'TesteZeta123' });
const planos = await get('/planos');
const mpAtivo = !planos.b.includes('Pagamento em breve');
console.log('PLANOS: mpAtivo=' + mpAtivo + ' | "Pagamento em breve" aparece: ' + planos.b.includes('Pagamento em breve') + ' | "Assinar" aparece: ' + /Assinar/.test(planos.b));
if (mpAtivo) {
  const csrf = csrfDe(planos.b);
  const idPlano = planos.b.match(/\/planos\/(\d+)\/assinar/)?.[1];
  console.log('Tentando assinar plano id=' + idPlano);
  const r = await post(`/planos/${idPlano}/assinar`, { csrf });
  console.log('ASSINAR: status=' + r.s + ' location=' + (r.l ?? '(nenhum)'));
  if (r.l && r.l.includes('mercadopago')) {
    const mp = await fetch(r.l, { redirect: 'manual' });
    console.log('MP CHECKOUT: status=' + mp.status + ' sandbox=' + /sandbox|test/.test(mp.url ?? r.l));
  } else if (r.l) {
    const volta = await get(r.l);
    const aviso = volta.b.match(/class="flash"[^>]*>([^<]+)/)?.[1];
    console.log('VOLTOU COM: ' + (aviso ?? r.l));
  }
} else {
  console.log('=> Sem token MP: o botao de assinar nem aparece (so "Pagamento em breve"). Nao ha fluxo simulado no servidor.');
}
