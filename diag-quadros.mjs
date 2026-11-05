import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const dir = process.env.TEMP + '\\padel-shots';
const video = dir + '\\treino-real.webm';
const b = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const p = await b.newPage();
await p.goto('file:///' + dir.replace(/\\/g, '/') + '/extrair.html');
const input = await p.$('#arq');
await input.uploadFile(video);
await p.waitForFunction(() => window.__frames !== null, { timeout: 120000 });
const info = await p.evaluate(() => window.__info);
const frames = await p.evaluate(() => window.__frames.map((f) => ({ t: f.t, media: f.media, data: f.data })));
console.log('INFO', JSON.stringify(info));
for (let i = 0; i < frames.length; i++) {
  const base64 = frames[i].data.split(',')[1];
  const file = `${dir}\\quadro-${i + 1}.jpg`;
  writeFileSync(file, Buffer.from(base64, 'base64'));
  console.log(`quadro ${i + 1}: t=${frames[i].t}s media=${frames[i].media} -> ${file}`);
}
await b.close();
