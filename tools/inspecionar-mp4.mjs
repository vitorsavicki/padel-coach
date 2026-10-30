// Le um MP4 local e reporta container, duracao e codec de video.
// Serve para saber se o navegador consegue decodificar o arquivo antes de
// culpar a analise: HEVC/AV1 em alguns navegadores falham no canvas.

import { readFileSync } from 'node:fs';

const caminho = process.argv[2];
if (!caminho) {
  console.error('uso: node tools/inspecionar-mp4.mjs <arquivo.mp4>');
  process.exit(1);
}

const b = readFileSync(caminho);
const ascii = (o, n) => b.toString('latin1', o, o + n);

// Caixas de nivel superior: size(4) + type(4)
const caixas = [];
let off = 0;
while (off + 8 <= b.length) {
  let size = b.readUInt32BE(off);
  const type = ascii(off + 4, 4);
  if (size === 1 && off + 16 <= b.length) size = Number(b.readBigUInt64BE(off + 8));
  if (size < 8) break;
  caixas.push({ type, size, off });
  off += size;
}

// ftyp
let marca = null;
let compativeis = [];
const ftyp = caixas.find((c) => c.type === 'ftyp');
if (ftyp) {
  marca = ascii(ftyp.off + 8, 4);
  for (let p = ftyp.off + 16; p + 4 <= ftyp.off + ftyp.size; p += 4) {
    compativeis.push(ascii(p, 4));
  }
}

// mvhd -> duracao
let duracaoS = null;
const posMvhd = b.indexOf('mvhd');
if (posMvhd > 0) {
  const versao = b[posMvhd + 4];
  if (versao === 0) {
    const escala = b.readUInt32BE(posMvhd + 16);
    const dur = b.readUInt32BE(posMvhd + 20);
    if (escala > 0) duracaoS = Math.round((dur / escala) * 100) / 100;
  } else {
    const escala = b.readUInt32BE(posMvhd + 24);
    const dur = Number(b.readBigUInt64BE(posMvhd + 28));
    if (escala > 0) duracaoS = Math.round((dur / escala) * 100) / 100;
  }
}

// codecs conhecidos presentes no arquivo
const CODECS = {
  avc1: 'H.264 (avc1)',
  avc3: 'H.264 (avc3)',
  hvc1: 'HEVC/H.265 (hvc1)',
  hev1: 'HEVC/H.265 (hev1)',
  av01: 'AV1 (av01)',
  vp09: 'VP9 (vp09)',
  mp4v: 'MPEG-4 (mp4v)',
};
const codecs = [];
for (const [chave, nome] of Object.entries(CODECS)) {
  if (b.indexOf(chave) >= 0) codecs.push(nome);
}

// moov no inicio (faststart) ou no fim
const ordemMoov = caixas.findIndex((c) => c.type === 'moov');
const ordemMdat = caixas.findIndex((c) => c.type === 'mdat');
const faststart = ordemMoov >= 0 && ordemMdat >= 0 && ordemMoov < ordemMdat;

console.log(
  JSON.stringify(
    {
      arquivo: caminho.split(/[\\/]/).pop(),
      bytes: b.length,
      marca,
      compativeis: [...new Set(compativeis)].slice(0, 8),
      duracaoS,
      codecs: codecs.length ? codecs : ['(nenhum codec reconhecido - pode ser GIF animado em mp4)'],
      faststart,
      caixas: caixas.map((c) => c.type).slice(0, 10),
    },
    null,
    2,
  ),
);
