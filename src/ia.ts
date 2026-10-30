// Analise de video com Gemini, SEM armazenamento e SEM cartao.
//
// O video chega pelo form, vai para o Gemini como inline_data (base64),
// a analise volta e o arquivo e descartado. Nada de R2, nada de bucket.
// Usa o endpoint NATIVO do Gemini (generateContent): video em base64 so
// funciona por ali, o endpoint OpenAI-compatible nao aceita.
//
// Quando a chamada falha, o motivo REAL sobe junto (classe IaFalha), para
// a pagina mostrar o que o Google respondeu em vez de um "erro" generico.

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

// Modelos tentados em ordem quando o configurado nao existe mais: o Google
// aposenta modelos antigos e a chave passa a receber 404 NOT_FOUND.
const MODELOS_RESERVA = ['gemini-flash-latest', 'gemini-2.5-flash'];

// Falha vinda do Gemini, com o status HTTP e um trecho da mensagem dele.
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
    const r = await chamarGemini(env, modelo, base64, mime, systemPrompt);

    if (r.ok) {
      const json = extrairJSON(r.texto);
      if (!json) throw new IaFalha(0, 'Gemini respondeu sem JSON valido');
      return normalizar(json);
    }

    ultima = { status: r.status, erro: r.erro };
    // 404 = modelo inexistente: vale tentar o proximo. Outro erro nao melhora.
    if (r.status !== 404) break;
  }

  throw new IaFalha(ultima?.status ?? 0, ultima?.erro ?? 'falha desconhecida');
}

async function chamarGemini(
  env: Bindings,
  modelo: string,
  base64: string,
  mime: string,
  systemPrompt: string,
): Promise<Tentativa> {
  const base = baseGemini(env.IA_BASE_URL);
  const url = `${base}/models/${modelo}:generateContent`;

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 60_000);

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.IA_API_KEY as string,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Analise este video de padel do aluno.' },
              { inline_data: { mime_type: mime, data: base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
      }),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text();
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

// Traduz a resposta do Google para uma instrucao que o jogador entende.
// O detalhe cru continua guardado; isto e o que aparece em destaque.
export function dicaParaErro(motivo: string): string | null {
  const m = motivo.toLowerCase();
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
  if (m.includes('abort') || m.includes('rede') || m.includes('network') || m.includes('fetch')) {
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

// Nomes vindos de outros provedores chegam como "gemini/gemini-2.0-flash"
// ou "models/gemini-2.0-flash". O endpoint nativo quer so o nome final.
function normalizarModelo(nome: string): string {
  const semPrefixo = nome.includes('/') ? nome.split('/').pop() ?? nome : nome;
  return semPrefixo.trim();
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
