// Analise de video com IA multimodal. O modelo precisa entender video
// nativamente (Gemini via endpoint compativel com chat/completions).

import type { Bindings } from './lib/bindings';

export type AnaliseCoach = {
  nota_geral: number;
  resumo: string;
  pontos_fortes: string[];
  pontos_melhorar: string[];
  treino_sugerido: string;
};

const LIMITE_BYTES = 20 * 1024 * 1024; // MVP: 20MB

export function iaConfigurada(env: Bindings): boolean {
  return Boolean(env.IA_BASE_URL && env.IA_API_KEY && env.IA_MODEL && env.VIDEOS);
}

export async function analisarVideo(
  env: Bindings,
  r2Key: string,
  systemPrompt: string,
): Promise<AnaliseCoach> {
  if (!env.VIDEOS) throw new Error('Armazenamento de video nao configurado');
  if (!env.IA_BASE_URL || !env.IA_API_KEY || !env.IA_MODEL) {
    throw new Error('IA nao configurada');
  }

  const objeto = await env.VIDEOS.get(r2Key);
  if (!objeto) throw new Error('Video nao encontrado');

  const bytes = new Uint8Array(await objeto.arrayBuffer());
  if (bytes.byteLength > LIMITE_BYTES) throw new Error('Video muito grande para analise');

  const base64 = bytesToBase64(bytes);

  const resposta = await fetch(`${env.IA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.IA_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.IA_MODEL,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analise este video de padel do aluno.' },
            { type: 'video_url', video_url: { url: `data:video/mp4;base64,${base64}` } },
          ],
        },
      ],
    }),
  });

  if (!resposta.ok) {
    throw new Error(`IA respondeu ${resposta.status}`);
  }

  const dados = (await resposta.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const texto = dados.choices?.[0]?.message?.content ?? '';
  const json = extrairJSON(texto);
  if (!json) throw new Error('IA nao retornou JSON valido');

  return normalizar(json);
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    bin += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(bin);
}

// Aceita JSON puro, com cercas ```json``` ou embutido em texto maior.
function extrairJSON(texto: string): unknown | null {
  const limpo = texto.replace(/```json/gi, '```').replace(/```/g, '').trim();
  const candidatos = [limpo];
  const bloco = limpo.match(/\{[\s\S]*\}/);
  if (bloco) candidatos.push(bloco[0]);

  for (const c of candidatos) {
    try {
      return JSON.parse(c);
    } catch {
      // tenta o proximo
    }
  }
  return null;
}

function listaDeTexto(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

// Fallback seguro: nunca deixa a pagina quebrar por um campo faltando.
function normalizar(obj: unknown): AnaliseCoach {
  const o = (obj ?? {}) as Record<string, unknown>;
  const nota = typeof o.nota_geral === 'number' ? o.nota_geral : Number(o.nota_geral);
  return {
    nota_geral: Number.isFinite(nota) ? Math.max(0, Math.min(10, nota)) : 0,
    resumo: typeof o.resumo === 'string' ? o.resumo : 'Analise indisponivel.',
    pontos_fortes: listaDeTexto(o.pontos_fortes),
    pontos_melhorar: listaDeTexto(o.pontos_melhorar),
    treino_sugerido: typeof o.treino_sugerido === 'string' ? o.treino_sugerido : '',
  };
}
