import puppeteer from 'puppeteer-core';
const BASE = 'https://padel-coach.vitorsavicki.workers.dev';
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const dir = process.env.TEMP + '\\padel-shots';
const email = `visual.${Date.now()}@zeta.test`;
const browser = await puppeteer.launch({ executablePath: edge, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });

// 1. Cadastro via formulario de verdade
await page.goto(BASE + '/cadastro', { waitUntil: 'networkidle0' });
await page.type('input[name="nome"]', 'Zeta Visual');
await page.type('input[name="email"]', email);
await page.type('input[name="senha"]', 'TesteZeta123');
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')]);
console.log('LOGADO EM: ' + page.url());

// 2. Painel (estado vazio com mascote)
await page.goto(BASE + '/painel', { waitUntil: 'networkidle0' });
const textoVazio = await page.evaluate(() => document.querySelector('.vazio')?.textContent?.trim() ?? '(sem estado vazio)');
console.log('MASCOTE DIZ: ' + textoVazio.slice(0, 120));
await page.screenshot({ path: dir + '\\painel-vazio.png' });

// 3. Tela de upload (o coracao)
await page.goto(BASE + '/videos/novo', { waitUntil: 'networkidle0' });
const temInput = await page.evaluate(() => !!document.querySelector('input[type="file"]'));
console.log('TELA UPLOAD: input de arquivo = ' + temInput);
await page.screenshot({ path: dir + '\\novo-video.png' });

// 4. Planos logado
await page.goto(BASE + '/planos', { waitUntil: 'networkidle0' });
await page.screenshot({ path: dir + '\\planos-logado.png' });

await browser.close();
console.log('SHOTS SALVOS');
