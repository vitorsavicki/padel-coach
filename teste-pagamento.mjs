const BASE = 'https://padel-coach.vitorsavicki.workers.dev';
const email = `pagto.${Date.now()}@zeta.test`;
const cookies = new Map();
function cookieJar(r) {
  for (const sc of r.headers.getSetCookie?.() ?? []) {
    const [par] = sc.split(';');
    const i = par.indexOf('=');
    if (i > 0) cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
  }
}
const hdrs = () => ({ cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') });
async function get(p) { const r = await fetch(BASE + p, { headers: hdrs(), redirect: 'manual' }); cookieJar(r); return r; }
async function post(p, dados) {
  const r = await fetch(BASE + p, { method: 'POST', headers: { ...hdrs(), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(dados), redirect: 'manual' });
  cookieJar(r); return r;
}
let falhas = 0;
const ok = (n, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'} - ${n}${extra ? ' | ' + extra : ''}`); if (!c) falhas++; };

// cadastro
let r = await get('/cadastro');
const csrf = (await r.text()).match(/name="csrf" value="([^"]+)"/)?.[1];
r = await post('/cadastro', { nome: 'Pagador', email, senha: 'TesteZeta123', csrf });
ok('cadastro', r.status === 302);

// planos: botao de simular pagamento existe?
r = await get('/planos');
const html = await r.text();
const acaoSimular = html.match(/action="(\/planos\/simular\/\d+)"/)?.[1];
ok('botao "Simular pagamento" aparece', !!acaoSimular, acaoSimular ?? '-');

// abre a simulacao
const csrf2 = html.match(/name="csrf" value="([^"]+)"/)?.[1] ?? csrf;
r = await post(acaoSimular, { csrf: csrf2 });
const htmlSim = await r.text();
ok('pagina de simulacao abre', r.status === 200 && /Simular pagamento/i.test(htmlSim));

// confirma
const acaoConfirmar = htmlSim.match(/action="([^"]*confirmar)"/)?.[1];
const csrf3 = htmlSim.match(/name="csrf" value="([^"]+)"/)?.[1];
ok('form de confirmacao existe', !!acaoConfirmar && !!csrf3);
r = await post(acaoConfirmar, { csrf: csrf3 });
ok('confirmacao redireciona', r.status === 302, r.headers.get('location') ?? '');

// plano ativo?
r = await get('/planos');
const htmlFinal = await r.text();
const ativo = /Atleta[^]*?(ativo|atual)/i.test(htmlFinal) || /plano[^]*?ativo/i.test(htmlFinal) && /Atleta/i.test(htmlFinal);
ok('plano Atleta ativo', ativo);
const usoMatch = htmlFinal.match(/(\d+)\s*de\s*(\d+)\s*an[áa]lise/i);
ok('contador de uso do plano', !!usoMatch, usoMatch ? usoMatch[0] : 'sem contador');

console.log(falhas === 0 ? 'PAGAMENTO SIMULADO: TUDO PASSOU' : `${falhas} FALHAS`);
