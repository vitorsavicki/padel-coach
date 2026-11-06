// Teste de analise REAL: cria conta, sobe um video de padel de verdade,
// espera a IA e imprime a analise completa para avaliacao de qualidade.
import puppeteer from 'puppeteer-core';

const BASE = 'https://padel-coach.vitorsavicki.workers.dev';
const VIDEO = process.argv[2] || process.env.TEMP + '\\padel-shots\\jogo-corte.webm';
const email = `coach.${Date.now()}@zeta.test`;
const senha = 'TesteZeta123';

const b = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

async function csrfDe(url) {
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  return p.$eval('input[name=csrf]', (el) => el.value);
}

// cadastro
const c1 = await csrfDe(BASE + '/cadastro');
await p.evaluate((c) => { document.querySelector('input[name=csrf]').value = c; }, c1);
await p.type('input[name=nome]', 'Bruno Teste');
await p.type('input[name=email]', email);
await p.type('input[name=senha]', senha);
await Promise.all([
  p.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
  p.click('button[type=submit]'),
]);
console.log('cadastro ok:', p.url());

// upload
await p.goto(BASE + '/videos/novo', { waitUntil: 'domcontentloaded' });
const input = await p.$('input[type=file]');
await input.uploadFile(VIDEO);
await p.type('input[name=titulo]', 'Treino em quadra (corte)');
console.log('enviando video (a IA pode levar ate 2 min)...');
const t0 = Date.now();
await p.click('button[type=submit]');

// a pagina redireciona sozinha para /videos/{id} quando a analise termina
await p.waitForFunction(() => /\/videos\/\d+/.test(location.pathname), { timeout: 240000, polling: 1000 });
console.log(`analise pronta em ${Math.round((Date.now() - t0) / 1000)}s ->`, p.url());
await p.waitForNetworkIdle({ idleTime: 1200, timeout: 20000 }).catch(() => {});

const texto = await p.evaluate(() => document.body.innerText);
console.log('\n========== ANALISE COMPLETA ==========\n');
console.log(texto.slice(0, 4000));
await p.screenshot({ path: process.env.TEMP + '\\padel-shots\\analise-nova.png', fullPage: true });
await b.close();
console.log('\nscreenshot: %TEMP%\\padel-shots\\analise-nova.png');
