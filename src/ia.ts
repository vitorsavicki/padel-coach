// Analise de video com Gemini, SEM armazenamento e SEM cartao.
//
// O video chega pelo form, vai para o Gemini como inline_data (base64),
// a analise volta e o arquivo e descartado. Nada de R2, nada de bucket.
//
// Duas formas de payload: a "cheia" (systemInstruction + responseMimeType)
// e a MINIMA, so com contents. Se o Google recusar a cheia com 400
// INVALID_ARGUMENT, a mesma chamada e refeita no formato minimo antes de
// desistir - foi o que o teste com um mp4 real exigiu.

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

const MODELOS_RESERVA = ['gemini-flash-latest', 'gemini-2.5-flash'];

export class IaFalha extends Error {
  status: number;
  detalhe: string;
  constructor(status: number, detalhe: string) {
    super(`Gemini ${status}: ${detalhe}`);
    this.name = 'IaFalha';
    this.status = status;
    this.detalhe = detalhe;
  }
}

export function iaConfigurada(env: Bindings): boolean {
  return Boolean(env.IA_API_KEY && env.IA_MODEL);
}

type Tentativa =
  | { ok: true; texto: string }
  | { ok: false; status: number; erro: string };

export async function analisarBytes(
  env: Bindings,
  bytes: Uint8Array,
  mime: string,
  systemPrompt: string,
): Promise<AnaliseCoach> {
  if (!env.IA_API_KEY || !env.IA_MODEL) {
    throw new IaFalha(0, 'IA nao configurada (falta IA_API_KEY ou IA_MODEL)');
  }
  if (bytes.byteLength === 0) throw new IaFalha(0, 'Arquivo vazio');
  if (bytes.byteLength > LIMITE_BYTES) throw new IaFalha(413, 'Video acima de 14MB');

  const base64 = bytesToBase64(bytes);
  const pedido = normalizarModelo(env.IA_MODEL);
  const modelos = [pedido, ...MODELOS_RESERVA.filter((m) => m !== pedido)];

  let ultima: { status: number; erro: string } | null = null;

  for (const modelo of modelos) {
    let r = await chamarGemini(env, modelo, base64, mime, systemPrompt);

    // 503/429 = capacidade temporaria do Google. Uma segunda tentativa no
    // mesmo modelo resolve a maioria; se nao resolver, tenta o proximo.
    if (!r.ok && (r.status === 503 || r.status === 429)) {
      await esperar(1500);
      r = await chamarGemini(env, modelo, base64, mime, systemPrompt);
    }

    if (r.ok) {
      const json = extrairJSON(r.texto);
      if (!json) throw new IaFalha(0, 'Gemini respondeu sem JSON valido');
      return normalizar(json);
    }

    ultima = { status: r.status, erro: r.erro };
    // 404 = modelo aposentado, 503 = modelo saturado: vale o proximo.
    if (r.status !== 404 && r.status !== 503) break;
  }

  throw new IaFalha(ultima?.status ?? 0, ultima?.erro ?? 'falha desconhecida');
}

// Formato "cheio" e formato minimo. O minimo existe porque o cheio pode
// ser recusado com 400 dependendo do modelo e do tipo de midia inline.
function montarCorpo(
  base64: string,
  mime: string,
  systemPrompt: string,
  minimal: boolean,
): Record<string, unknown> {
  const instrucao = minimal
    ? `${systemPrompt}\n\nResponda SOMENTE com JSON valido, sem texto fora dele, no formato:\n{"nota_geral":0-10,"resumo":"","pontos_fortes":[],"pontos_melhorar":[],"treino_sugerido":""}`
    : 'Analise este video de padel do aluno.';

  const corpo: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: instrucao },
          { inline_data: { mime_type: mime, data: base64 } },
        ],
      },
    ],
  };

  if (!minimal) {
    corpo.systemInstruction = { parts: [{ text: systemPrompt }] };
    corpo.generationConfig = { temperature: 0.4, responseMimeType: 'application/json' };
  }

  return corpo;
}

async function chamarGemini(
  env: Bindings,
  modelo: string,
  base64: string,
  mime: string,
  systemPrompt: string,
  minimal = false,
): Promise<Tentativa> {
  const base = baseGemini(env.IA_BASE_URL);
  const url = `${base}/models/${modelo}:generateContent`;

  const controlador = new AbortController();
  // Video inline demora: 3 minutos antes de desistir. Antes eram 60s e o
  // abort virava "The operation was aborted" na cara do aluno.
  const timer = setTimeout(() => controlador.abort(), 180_000);

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.IA_API_KEY as string,
      },
      body: JSON.stringify(montarCorpo(base64, mime, systemPrompt, minimal)),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text();
      if (resposta.status === 400 && !minimal) {
        return chamarGemini(env, modelo, base64, mime, systemPrompt, true);
      }
      return { ok: false, status: resposta.status, erro: limparErro(corpo) };
    }

    const dados = (await resposta.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const texto =
      dados.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return { ok: true, texto };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'falha de rede';
    return { ok: false, status: 0, erro: msg.slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

// Traduz a resposta do Google para uma instrucao que o jogador entende.
export function dicaParaErro(motivo: string): string | null {
  const m = motivo.toLowerCase();
  if (m.includes('503') || m.includes('unavailable') || m.includes('high demand')) {
    return 'O servico do Google esta sobrecarregado agora. Envie de novo em alguns minutos - costuma passar rapido e seu treino nao fica guardado em lugar nenhum.';
  }
  if (m.includes('invalid_argument') || m.includes('400')) {
    return 'O Google recusou o formato deste video. Converta para MP4 (H.264) - no iPhone, Ajustes > Camera > Formatos > Mais compativel - e envie de novo.';
  }
  if (m.includes('api key') || m.includes('401') || m.includes('403') || m.includes('permission')) {
    return 'A chave da IA foi recusada. Confira IA_API_KEY em wrangler secret list e gere outra em aistudio.google.com/apikey.';
  }
  if (m.includes('not found') || m.includes('404')) {
    return 'O modelo configurado nao existe mais. Atualize IA_MODEL (por exemplo: gemini-2.5-flash).';
  }
  if (m.includes('quota') || m.includes('429') || m.includes('resource_exhausted')) {
    return 'A cota gratuita do Gemini acabou por hoje. Tente de novo amanha ou use outra chave.';
  }
  if (m.includes('abort')) {
    return 'O Google demorou mais de 3 minutos para responder. Envie um clipe de 30 a 60 segundos - o coach ja consegue avaliar bem.';
  }
  if (m.includes('rede') || m.includes('network') || m.includes('fetch')) {
    return 'A conexao com o Google caiu antes da resposta. Tente de novo com um clipe menor.';
  }
  return null;
}

// O endpoint so aceita o host do Google. Um IA_BASE_URL apontando para
// localhost (comum em exemplos de OmniRoute) faria o Worker falhar em rede.
function baseGemini(configurado?: string): string {
  const padrao = 'https://generativelanguage.googleapis.com/v1beta';
  if (!configurado) return padrao;
  if (!configurado.startsWith('https://')) return padrao;
  if (!configurado.includes('googleapis.com')) return padrao;
  return configurado.replace(/\/$/, '');
}

// Nomes de outros provedores chegam como "gemini/gemini-2.0-flash" ou
// "models/gemini-2.0-flash". O endpoint nativo quer so o nome final.
function normalizarModelo(nome: string): string {
  const semPrefixo = nome.includes('/') ? nome.split('/').pop() ?? nome : nome;
  return semPrefixo.trim();
}

function esperar(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// Trecho legivel da resposta de erro do Google, sem nada sensivel.
function limparErro(corpo: string): string {
  const texto = corpo.replace(/\s+/g, ' ').trim();
  try {
    const json = JSON.parse(corpo) as { error?: { message?: string; status?: string } };
    const msg = json.error?.message ?? texto;
    const st = json.error?.status ? ` [${json.error.status}]` : '';
    return `${msg.slice(0, 200)}${st}`;
  } catch {
    return texto.slice(0, 200);
  }
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
