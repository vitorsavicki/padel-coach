import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const dir = process.env.TEMP + '\\padel-shots';
const video = process.argv[2] ? process.argv[2] : dir + '\\treino-real.webm';
const nome = video.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
const b = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const p = await b.newPage();
await p.setContent('<input id="arq" type="file"><canvas id="c"></canvas>');
const input = await p.$('#arq');
await input.uploadFile(video);
const resultado = await p.evaluate(async () => {
  const f = document.getElementById('arq').files[0];
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  const url = URL.createObjectURL(f);
  v.src = url;
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('video')); });
  const dur = v.duration;
  const total = 20, cols = 4, tw = 320, th = Math.round(tw * (v.videoHeight / v.videoWidth));
  const c = document.getElementById('c');
  c.width = cols * tw; c.height = Math.ceil(total / cols) * th;
  const ctx = c.getContext('2d');
  const marcas = [];
  for (let i = 0; i < total; i++) {
    const t = Math.min(dur * ((i + 0.5) / total), dur - 0.05);
    await new Promise((res) => { v.onseeked = res; v.currentTime = t; });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
    ctx.drawImage(v, x, y, tw, th);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x, y, 64, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(Math.round(t) + 's', x + 4, y + 15);
    marcas.push(Math.round(t));
  }
  URL.revokeObjectURL(url);
  return { dur, marcas, data: c.toDataURL('image/jpeg', 0.6) };
});
writeFileSync(dir + '\\contato-' + nome + '.jpg', Buffer.from(resultado.data.split(',')[1], 'base64'));
console.log('duracao', resultado.dur, 'marcas', resultado.marcas.join(','));
console.log('arquivo', dir + '\\contato-' + nome + '.jpg');
await b.close();
