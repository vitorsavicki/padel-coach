// Analise de video com Gemini, SEM armazenamento e SEM cartao.
//
// O video chega pelo form, vai para o Gemini como inline_data (base64),
// a analise volta e o arquivo e descartado. Nada de R2, nada de bucket.
// Usa o endpoint NATIVO do Gemini (generateContent), porque video em
// base64 so funciona por ali - o endpoint OpenAI-compatible nao aceita.

import type { Bindings } from './lib/bindings';

export type AnaliseCoach = {
  nota_geral: number;
  resumo: string;
  pontos_fortes: string[];
  pontos_melhorar: string[];
  treino_sugerido: string;
};

// O Gemini recusa inline_data acima de ~20MB de REQUISICAO, e base64
// infla o arquivo em ~33%. 14MB de video -> ~19MB de corpo, com folga.
export const LIMITE_BYTES = 14 * 1024 * 1024;

export function iaConfigurada(env: Bindings): boolean {
  return Boolean(env.IA_API_KEY && env.IA_MODEL);
}

export async function analisarBytes(
  env: Bindings,
  bytes: Uint8Array,
  mime: string,
  systemPrompt: string,
): Promise<AnaliseCoach> {
  if (!env.IA_API_KEY || !env.IA_MODEL) throw new Error('IA nao configurada');
  if (bytes.byteLength === 0) throw new Error('Arquivo vazio');
  if (bytes.byteLength > LIMITE_BYTES) throw new Error('Video grande demais');

  const base = env.IA_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  const url = `${base}/models/${env.IA_MODEL}:generateContent`;

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 120_000);

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.IA_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Analise este video de padel do aluno.' },
              { inline_data: { mime_type: mime, data: bytesToBase64(bytes) } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resposta.ok) {
    throw new Error(`Gemini respondeu ${resposta.status}`);
  }

  const dados = (await resposta.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const texto =
    dados.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

  const json = extrairJSON(texto);
  if (!json) throw new Error('Gemini nao retornou JSON valido');
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
