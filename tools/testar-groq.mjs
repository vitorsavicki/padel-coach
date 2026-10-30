// Testa os modelos do Groq na SUA maquina, sem deploy.
//
// Le a chave de .dev.vars (ou da variavel de ambiente GROQ_API_KEY), lista
// os modelos que a chave enxerga e tenta uma chamada minima em cada modelo
// de visao candidato. Imprime status e corpo de cada tentativa.
//
// Uso: node tools/testar-groq.mjs

import { readFileSync, existsSync } from 'node:fs';

function lerChave() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY.trim();
  for (const arquivo of ['.dev.vars', '.env']) {
    if (!existsSync(arquivo)) continue;
    const texto = readFileSync(arquivo, 'utf8');
    for (const linha of texto.split(/\r?\n/)) {
      const m = linha.match(/^\s*GROQ_API_KEY\s*=\s*(.+)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return '';
}

const chave = lerChave();
if (!chave) {
  console.log('SEM CHAVE LOCAL.');
  console.log('Crie um arquivo .dev.vars na raiz do projeto com a linha:');
  console.log('  GROQ_API_KEY=gsk_...');
  console.log('(ou rode: GROQ_API_KEY=gsk_... node tools/testar-groq.mjs)');
  process.exit(0);
}

console.log('chave: ' + chave.slice(0, 6) + '...' + chave.slice(-4) + ' (' + chave.length + ' caracteres)');
if (chave.length < 40) console.log('AVISO: chave curta demais para ser valida.');

const h = { Authorization: 'Bearer ' + chave };

const lista = await fetch('https://api.groq.com/openai/v1/models', { headers: h });
const corpoLista = await lista.text();
console.log('\n== GET /models == status ' + lista.status);
if (!lista.ok) {
  console.log('corpo: ' + corpoLista.slice(0, 200));
  process.exit(0);
}

let ids = [];
try {
  ids = (JSON.parse(corpoLista).data ?? []).map((m) => m.id).filter(Boolean).sort();
} catch {
  console.log('corpo nao e JSON: ' + corpoLista.slice(0, 120));
  process.exit(0);
}
console.log('total de modelos: ' + ids.length);
console.log(ids.join('\n'));

const visao = ids.filter((id) => /vision|llama-4|scout|maverick|qwen|pixtral/i.test(id));
console.log('\n== candidatos com visao: ' + (visao.length ? visao.join(', ') : 'nenhum'));

// JPEG 1x1 valido, so para exercitar o campo de imagem.
const img =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

async function tentar(id, comImagem) {
  const conteudo = comImagem
    ? [{ type: 'text', text: 'Responda apenas: ok' }, { type: 'image_url', image_url: { url: img } }]
    : 'Responda apenas: ok';
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify({
        model: id,
        max_tokens: 16,
        temperature: 0,
        messages: [{ role: 'user', content: conteudo }],
      }),
    });
    const texto = await r.text();
    const trecho = texto.replace(/\s+/g, ' ').slice(0, 150);
    console.log('  ' + id + ' imagem=' + comImagem + ' -> ' + r.status + ' ' + trecho);
  } catch (e) {
    console.log('  ' + id + ' imagem=' + comImagem + ' -> EXCECAO ' + (e.message ?? '').slice(0, 100));
  }
}

console.log('\n== tentativas ==');
for (const id of visao.slice(0, 4)) {
  await tentar(id, true);
}

const texto = ids.find((id) => /llama-3\.1-8b-instant|llama-3\.3-70b/i.test(id));
if (texto) {
  console.log('\n== controle (so texto) ==');
  await tentar(texto, false);
}
