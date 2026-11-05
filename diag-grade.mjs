// Grade de um quadro por video da pasta, para escolher um clipe bom de teste.
import puppeteer from 'puppeteer-core';
import { readdirSync, writeFileSync } from 'node:fs';

const dir = process.env.TEMP + '\\padel-shots\\pexels';
const arquivos = readdirSync(dir).filter((f) => f.endsWith('.mp4')).sort();
const b = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const p = await b.newPage();
await p.setContent('<input id="arq" type="file">');
const input = await p.$('#arq');
const quadros = [];
for (const nome of arquivos) {
  await input.uploadFile(dir + '\\' + nome);
  const q = await p.evaluate(async () => {
    const f = document.getElementById('arq').files[0];
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    const url = URL.createObjectURL(f);
    v.src = url;
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('video')); });
    const dur = v.duration;
    const t = Math.min(dur * 0.5, Math.max(0, dur - 0.1));
    await new Promise((res) => { v.onseeked = res; v.currentTime = t; });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const tw = 320, th = Math.round(tw * (v.videoHeight / v.videoWidth));
    const c = document.createElement('canvas');
    c.width = tw; c.height = th;
    const ctx = c.getContext('2d');
    ctx.drawImage(v, 0, 0, tw, th);
    const d = ctx.getImageData(0, 0, tw, th).data;
    let soma = 0, n = 0;
    for (let x = 0; x < d.length; x += 4 * 97) { soma += (d[x] + d[x + 1] + d[x + 2]) / 3; n++; }
    URL.revokeObjectURL(url);
    return { dur, w: v.videoWidth, h: v.videoHeight, media: Math.round(soma / n), data: c.toDataURL('image/jpeg', 0.6) };
  });
  quadros.push({ nome, ...q });
  console.log(`${nome}: ${q.dur.toFixed(1)}s ${q.w}x${q.h} luz=${q.media}`);
}
// monta a grade final no node (canvas nao existe): usa uma segunda pagina
const cols = 6;
const tw = 320, th = Math.round(tw * 0.5625);
const linhas = Math.ceil(quadros.length / cols);
const grade = await b.newPage();
await grade.setContent('<canvas id="c"></canvas>');
const data = await grade.evaluate(async (itens, cols, tw, th, linhas) => {
  const c = document.getElementById('c');
  c.width = cols * tw;
  c.height = linhas * (th + 22);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < itens.length; i++) {
    const img = new Image();
    img.src = itens[i].data;
    await img.decode();
    const x = (i % cols) * tw;
    const y = Math.floor(i / cols) * (th + 22);
    const h = Math.round(tw * (itens[i].h / itens[i].w));
    ctx.drawImage(img, x, y, tw, h);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(itens[i].nome.replace('.mp4', '') + ' ' + itens[i].dur.toFixed(0) + 's luz=' + itens[i].media, x + 4, y + h + 16);
  }
  return c.toDataURL('image/jpeg', 0.7);
}, quadros, cols, tw, th, linhas);
writeFileSync(process.env.TEMP + '\\padel-shots\\grade-pexels.jpg', Buffer.from(data.split(',')[1], 'base64'));
console.log('grade salva');
await b.close();
