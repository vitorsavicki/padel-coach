// Diagnostico: captura os quadros que o formulario de producao realmente envia,
// mede a luminosidade de cada um e salva em disco. Nao chama a IA.
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://padel-coach.vitorsavicki.workers.dev';
const VIDEO = process.argv[2];
const dir = process.env.TEMP + '\\padel-shots';
const email = `diag.${Date.now()}@zeta.test`;
const senha = 'TesteZeta123';

const b = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

// cadastro
await p.goto(BASE + '/cadastro', { waitUntil: 'domcontentloaded' });
await p.type('input[name=nome]', 'Diag Quadros');
await p.type('input[name=email]', email);
await p.type('input[name=senha]', senha);
await Promise.all([
  p.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
  p.click('button[type=submit]'),
]);

// intercepta o fetch antes de qualquer envio
await p.goto(BASE + '/videos/novo', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => {
  window.__capturado = null;
  const orig = window.fetch;
  window.fetch = function (url, opts) {
    if (String(url).includes('/videos/novo')) {
      window.__capturado = opts.body;
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, id: 1 }), { headers: { 'content-type': 'application/json' } }),
      );
    }
    return orig.apply(this, arguments);
  };
});

const input = await p.$('input[type=file]');
await input.uploadFile(VIDEO);
await p.type('input[name=titulo]', 'Diag quadros');
await p.click('button[type=submit]');
await p.waitForFunction(() => window.__capturado !== null, { timeout: 120000 });

const quadros = await p.evaluate(async () => {
  const fd = window.__capturado;
  const lista = JSON.parse(fd.get('quadros'));
  const medidas = [];
  for (let i = 0; i < lista.length; i++) {
    const img = new Image();
    img.src = lista[i];
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let soma = 0;
    let n = 0;
    for (let x = 0; x < d.length; x += 4 * 97) {
      soma += (d[x] + d[x + 1] + d[x + 2]) / 3;
      n++;
    }
    medidas.push({ i: i + 1, w: img.width, h: img.height, media: Math.round(soma / n), data: lista[i] });
  }
  return medidas;
});

console.log('quadros capturados: ' + quadros.length);
for (const q of quadros) {
  const arq = `${dir}\\app-quadro-${q.i}.jpg`;
  writeFileSync(arq, Buffer.from(q.data.split(',')[1], 'base64'));
  console.log(`quadro ${q.i}: ${q.w}x${q.h} luminosidade media=${q.media} -> ${arq}`);
}
await b.close();
