import puppeteer from 'puppeteer-core';

const BASE = 'https://padel-coach.vitorsavicki.workers.dev';
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const dir = process.env.TEMP + '\\padel-shots';
const email = `cliente.${Date.now()}@zeta.test`;
const caminhoVideo = process.env.TEMP + '\\treino-real.webm';
let falhas = 0;
const ok = (n, c, extra = '') => { console.log(`${c ? 'PASS' : 'FAIL'} - ${n}${extra ? ' | ' + extra : ''}`); if (!c) falhas++; };

const browser = await puppeteer.launch({ executablePath: edge, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });

// 1. Cadastro
await page.goto(BASE + '/cadastro', { waitUntil: 'networkidle0' });
await page.type('input[name="nome"]', 'Cliente Real');
await page.type('input[name="email"]', email);
await page.type('input[name="senha"]', 'TesteZeta123');
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')]);
ok('cadastro leva ao painel', page.url().includes('/painel'));

// 2. Upload de video REAL de tenis (drive com bola)
await page.goto(BASE + '/videos/novo', { waitUntil: 'networkidle0' });
const input = await page.$('input[type="file"]');
ok('input de video existe', !!input);
await input.uploadFile(caminhoVideo);
await page.type('input[name="titulo"]', 'Treino de drive');
const t0 = Date.now();
await Promise.all([
  page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 300000 }),
  page.click('button[type="submit"]'),
]);
const segundos = Math.round((Date.now() - t0) / 1000);
const urlFinal = page.url();
ok('analise concluiu e abriu pagina do treino', /\/videos\/\d+/.test(urlFinal), `${segundos}s | ${urlFinal}`);
if (!/\/videos\/\d+/.test(urlFinal)) {
  const fala = await page.evaluate(() => document.getElementById('fala')?.textContent ?? '(sem fala)');
  console.log('FALA DA PAGINA: ' + fala);
  await page.screenshot({ path: dir + '\\falha-upload.png' });
}

// 3. Resultado
const resultado = await page.evaluate(() => ({
  nota: document.body.textContent.match(/(\d{1,2}[.,]\d)\s*(?:\/|de)\s*10/)?.[1] ?? null,
  mascote: document.querySelector('.mascote-fala')?.textContent?.trim() ?? null,
  pontosFortes: document.body.textContent.includes('Pontos fortes'),
  treino: /treino/i.test(document.body.textContent),
}));
ok('nota do coach aparece', !!resultado.nota, resultado.nota ?? '-');
ok('mascote fala do resultado', !!resultado.mascote, (resultado.mascote ?? '').slice(0, 90));
ok('pontos fortes + treino presentes', resultado.pontosFortes && resultado.treino);
await page.screenshot({ path: dir + '\\analise-real.png' });

// 4. Painel
await page.goto(BASE + '/painel', { waitUntil: 'networkidle0' });
const painelTem = await page.evaluate(() => document.body.textContent.includes('Treino de drive'));
ok('painel lista o treino', painelTem);
await page.screenshot({ path: dir + '\\painel-com-treino.png' });

console.log(falhas === 0 ? 'CLIENTE REAL: TUDO PASSOU' : `${falhas} FALHAS`);
await browser.close();
