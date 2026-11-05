// Grade de fotos baixadas da Pexels para escolher quadros de teste.
import puppeteer from 'puppeteer-core';
import { readdirSync, writeFileSync, readFileSync } from 'node:fs';

const dir = process.env.TEMP + '\\padel-shots\\fotos';
const arquivos = readdirSync(dir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f)).sort();
const itens = arquivos.map((nome) => {
  const b = readFileSync(dir + '\\' + nome);
  return { nome, data: 'data:image/jpeg;base64,' + b.toString('base64') };
});
const cols = 5, tw = 300;
const b = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const p = await b.newPage();
await p.setContent('<canvas id="c"></canvas>');
const data = await p.evaluate(async (itens, cols, tw) => {
  const c = document.getElementById('c');
  const th = tw;
  const linhas = Math.ceil(itens.length / cols);
  c.width = cols * tw;
  c.height = linhas * (th + 20);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < itens.length; i++) {
    const img = new Image();
    img.src = itens[i].data;
    await img.decode();
    const x = (i % cols) * tw;
    const y = Math.floor(i / cols) * (th + 20);
    ctx.drawImage(img, x, y, tw, th);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(itens[i].nome.replace(/\.[^.]+$/, ''), x + 6, y + th + 16);
  }
  return c.toDataURL('image/jpeg', 0.7);
}, itens, cols, tw);
writeFileSync(process.env.TEMP + '\\padel-shots\\grade-fotos.jpg', Buffer.from(data.split(',')[1], 'base64'));
console.log('ok');
await b.close();
