// Teste E2E de usabilidade do Padel Coach IA (contra o site ao vivo).
import sharp from 'sharp';

const BASE = 'https://padel-coach.vitorsavicki.workers.dev';
const email = `teste.${Date.now()}@zeta.test`;
const senha = 'TesteZeta123';
const jar = new Map();
let falhas = 0;

const ok = (nome, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${nome}${extra ? ' | ' + extra : ''}`);
  if (!cond) falhas++;
};

function guardarCookies(r) {
  const lista = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean);
  for (const sc of lista) {
    const par = sc.split(';')[0];
    const i = par.indexOf('=');
    if (i > 0) jar.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
  }
}
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

async function get(path) {
  const r = await fetch(BASE + path, { headers: { cookie: cookieHeader() }, redirect: 'manual' });
  guardarCookies(r);
  return { status: r.status, loc: r.headers.get('location'), body: await r.text() };
}
async function post(path, dados, async = false) {
  const headers = { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader() };
  if (async) headers['x-async'] = '1';
  const r = await fetch(BASE + path, { method: 'POST', headers, body: new URLSearchParams(dados), redirect: 'manual' });
  guardarCookies(r);
  return { status: r.status, loc: r.headers.get('location'), body: await r.text() };
}
const pegaCsrf = (html) => {
  const tag = html.match(/<input[^>]*name="csrf"[^>]*>/)?.[0] ?? '';
  return tag.match(/value="([^"]+)"/)?.[1] ?? null;
};

// ---- 1. Cadastro ----
const pagCad = await get('/cadastro');
const csrf1 = pegaCsrf(pagCad.body);
ok('GET /cadastro abre com formulario', pagCad.status === 200 && !!csrf1);
const rCad = await post('/cadastro', { csrf: csrf1, nome: 'Zeta Teste', email, senha });
ok('POST /cadastro redireciona pro painel', rCad.status === 302 && (rCad.loc || '').includes('/painel'), rCad.loc || rCad.body.slice(0, 120));

// ---- 2. Painel logado ----
const painel = await get('/painel');
ok('Painel sauda o usuario', painel.status === 200 && painel.body.includes('Oi,'), painel.body.match(/Oi,[^<]*/)?.[0]?.slice(0, 40));

// ---- 3. Pagina de novo treino ----
const pagNovo = await get('/videos/novo');
const csrf2 = pegaCsrf(pagNovo.body);
ok('GET /videos/novo abre', pagNovo.status === 200 && !!csrf2, `status=${pagNovo.status} loc=${pagNovo.loc}`);

// ---- 4. Quadros reais: foto de padel do Wikimedia -> 6 recortes ----
let quadros = [];
try {
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=padel%20court&gsrlimit=5&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json';
  const busca = await (await fetch(api, { headers: { 'user-agent': 'teste-usabilidade/1.0' } })).json();
  const paginas = Object.values(busca.query?.pages ?? {});
  const url = paginas.find(p => p.imageinfo?.[0]?.thumburl)?.imageinfo[0].thumburl;
  const foto = Buffer.from(await (await fetch(url)).arrayBuffer());
  const img = sharp(foto).resize(640, 480, { fit: 'cover' });
  for (let i = 0; i < 6; i++) {
    const esq = (i % 3) * 200, topo = i < 3 ? 0 : 240;
    const buf = await img.clone().extract({ left: esq, top: topo, width: 200, height: 240 }).jpeg({ quality: 72 }).toBuffer();
    quadros.push('data:image/jpeg;base64,' + buf.toString('base64'));
  }
  console.log(`INFO - 6 quadros reais gerados (${Math.round(quadros.reduce((s, q) => s + q.length, 0) / 1024)}KB total)`);
} catch (e) {
  console.log('AVISO - Wikimedia falhou, usando quadros fake: ' + e.message);
  const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  quadros = Array(6).fill(px);
}

// ---- 5. Enviar treino (fluxo async do formulario com JS) ----
const rEnvio = await post('/videos/novo', { csrf: csrf2, titulo: 'Teste de usabilidade', quadros: JSON.stringify(quadros) }, true);
let videoId = null;
try { const j = JSON.parse(rEnvio.body); videoId = j.id ?? null; } catch {}
ok('POST /videos/novo analisa e responde JSON ok', rEnvio.status === 200 && videoId, rEnvio.body.slice(0, 200));

// ---- 6. Pagina do treino com a analise ----
if (videoId) {
  const pagVideo = await get(`/videos/${videoId}`);
  ok('Pagina do treino mostra a analise', pagVideo.status === 200 && /nota/i.test(pagVideo.body));
  const nota = pagVideo.body.match(/(\d{1,2}[.,]\d)\s*\/\s*10|>(\d{1,2}[.,]\d)</)?.[0];
  console.log('INFO - nota na pagina: ' + (nota ?? '(nao achei)'));

  // ---- 7. Apagar o treino ----
  const csrfV = pegaCsrf(pagVideo.body);
  const rApagar = await post(`/videos/${videoId}/apagar`, { csrf: csrfV });
  ok('Apagar treino volta pro painel', rApagar.status === 302 && (rApagar.loc || '').includes('/painel'), rApagar.loc);
} else {
  console.log('AVISO - analise falhou, pulando etapas 6-7');
}

// ---- 8. Sair e entrar de novo ----
const rSair = await get('/sair');
ok('Sair encerra sessao', rSair.status === 302);
jar.clear();
const pagEntrar = await get('/entrar');
const csrf3 = pegaCsrf(pagEntrar.body);
const rEntrar = await post('/entrar', { csrf: csrf3, email, senha });
ok('Login reentra na conta', rEntrar.status === 302 && (rEntrar.loc || '').includes('/painel'), rEntrar.loc);

// ---- 9. Perfil por conta ----
const perfil = await get('/perfil');
ok('Pagina de perfil abre', perfil.status === 200 && perfil.body.includes('Mao dominante'));
const salvarPerfil = await post('/perfil', {
  csrf: pegaCsrf(perfil.body),
  mao: 'canhoto',
  categoria: '5',
  meta: 'Chegar a 4a categoria',
  prioridades: 'Bandeja e posicionamento',
});
ok('Salvar perfil redireciona', salvarPerfil.status === 302 && (salvarPerfil.loc || '').includes('perfil_salvo'), salvarPerfil.loc);
const perfilSalvo = await get('/perfil?msg=perfil_salvo');
ok('Perfil salvo aparece no formulario', perfilSalvo.body.includes('Perfil salvo') && /value="canhoto" selected/.test(perfilSalvo.body));

// ---- 10. Planos e assinatura simulada ----
const planos = await get('/planos');
ok('Pagina de planos abre', planos.status === 200 && /19,90/.test(planos.body));
if (planos.body.includes('(simulado)')) {
  const idPlano = planos.body.match(/\/planos\/simular\/(\d+)/)?.[1];
  const abrirPlano = await post(`/planos/simular/${idPlano}`, { csrf: pegaCsrf(planos.body) });
  ok('Assinatura simulada abre confirmacao', abrirPlano.status === 200 && abrirPlano.body.includes('Confirmar pagamento simulado'));
  const confirmar = await post(`/planos/simular/${idPlano}/confirmar`, { csrf: pegaCsrf(abrirPlano.body) });
  ok('Confirmar assinatura simulada', confirmar.status === 302 && (confirmar.loc || '').includes('msg=simulado'), confirmar.loc);
  const planosDepois = await get('/planos');
  ok('Plano simulado fica ativo', /Seu plano agora:<\/strong>\s*Atleta/.test(planosDepois.body));
} else {
  console.log('INFO - Mercado Pago ativo: fluxo simulado nao aparece, pulando assinatura de teste');
}

// ---- 11. Privacidade e exemplo ----
const priv = await get('/privacidade');
ok('Pagina de privacidade abre', priv.status === 200);
const exem = await get('/exemplo');
ok('Pagina de exemplo abre', exem.status === 200);

console.log(falhas === 0 ? 'TUDO PASSOU' : `${falhas} FALHAS`);
