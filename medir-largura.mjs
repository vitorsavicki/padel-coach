import puppeteer from 'puppeteer-core';
const BASE = 'https://padel-coach.vitorsavicki.workers.dev';
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await puppeteer.launch({ executablePath: edge, headless: 'new' });
for (const rota of ['/', '/exemplo', '/planos']) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(BASE + rota, { waitUntil: 'networkidle0' });
  const medida = await page.evaluate(() => {
    const iw = window.innerWidth;
    const sw = document.documentElement.scrollWidth;
    const estourados = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > iw + 2 && r.width > 40) {
        estourados.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
      }
    });
    return { iw, sw, estourados: estourados.slice(0, 8) };
  });
  console.log(`${rota}: viewport=${medida.iw} pagina=${medida.sw} ${medida.sw > medida.iw ? '*** ESTOURA ***' : 'ok'}`);
  medida.estourados.forEach((e) => console.log('   ' + e));
  await page.close();
}
await browser.close();
