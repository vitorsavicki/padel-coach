// Analise do treino por QUADROS, nao pelo video inteiro.
//
// Video inline no Gemini e lento demais para uma requisicao sincrona: o
// teste com um mp4 real levou 129s e voltou 524 (timeout de borda). O
// navegador extrai 8 quadros do clipe e manda como imagens: a resposta
// volta em segundos, o video nunca sai do celular do aluno e nada fica
// guardado no servidor.

import type { Bindings } from './lib/bindings';

export type AnaliseCoach = {
  nota_geral: number;
  resumo: string;
  pontos_fortes: string[];
  pontos_melhorar: string[];
  treino_sugerido: string;
};

const MODELOS_RESERVA = ['gemini-flash-latest', 'gemini-2.5-flash'];
const MAX_QUADROS = 12;
const MAX_BYTES_QUADRO = 1_200_000;

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

// Os quadros chegam como data URL ("data:image/jpeg;base64,...").
export function quadrosValidos(valor: unknown): valor is string[] {
  if (!Array.isArray(valor)) return false;
  if (valor.length < 3 || valor.length > MAX_QUADROS) return false;
  return valor.every(
    (q) => typeof q === 'string' && q.startsWith('data:image/') && q.length <= MAX_BYTES_QUADRO,
  );
}

type Tentativa =
  | { ok: true; texto: string }
  | { ok: false; status: number; erro: string };

export async function analisarQuadros(
  env: Bindings,
  quadros: string[],
  systemPrompt: string,
): Promise<AnaliseCoach> {
  if (!env.IA_API_KEY || !env.IA_MODEL) {
    throw new IaFalha(0, 'IA nao configurada (falta IA_API_KEY ou IA_MODEL)');
  }

  const partes = quadros.map((dataUrl) => {
    const virgula = dataUrl.indexOf(',');
    const meta = dataUrl.slice(5, virgula);
    const mime = meta.split(';')[0] || 'image/jpeg';
    return { inline_data: { mime_type: mime, data: dataUrl.slice(virgula + 1) } };
  });

  const pedido = normalizarModelo(env.IA_MODEL);
  const modelos = [pedido, ...MODELOS_RESERVA.filter((m) => m !== pedido)];
  let ultima: { status: number; erro: string } | null = null;

  for (const modelo of modelos) {
    let r = await chamarGemini(env, modelo, partes, systemPrompt);

    // 503/429 = capacidade temporaria do Google. Uma segunda tentativa
    // apos 1,5s resolve a maioria.
    if (!r.ok && (r.status === 503 || r.status === 429)) {
      await esperar(1500);
      r = await chamarGemini(env, modelo, partes, systemPrompt);
    }

    // Abortou (status 0) com muitos quadros: tenta de novo com 3, que ja
    // mostram o gesto e respondem bem mais rapido.
    if (!r.ok && r.status === 0 && partes.length > 3) {
      r = await chamarGemini(env, modelo, partes.slice(0, 3), systemPrompt);
    }

    if (r.ok) {
      const json = extrairJSON(r.texto);
      if (!json) throw new IaFalha(0, 'Gemini respondeu sem JSON valido');
      return normalizar(json);
    }

    ultima = { status: r.status, erro: r.erro };
    if (r.status !== 404 && r.status !== 503) break;
  }

  throw new IaFalha(
    ultima?.status ?? 0,
    `${ultima?.erro ?? 'falha desconhecida'} [modelo: ${pedido}]`,
  );
}

async function chamarGemini(
  env: Bindings,
  modelo: string,
  partes: Array<Record<string, unknown>>,
  systemPrompt: string,
  minimal = false,
): Promise<Tentativa> {
  const base = baseGemini(env.IA_BASE_URL);
  const url = `${base}/models/${modelo}:generateContent`;

  const instrucao = minimal
    ? `${systemPrompt}\n\nResponda SOMENTE com JSON valido no formato {"nota_geral":0-10,"resumo":"","pontos_fortes":[],"pontos_melhorar":[],"treino_sugerido":""}`
    : 'Estes quadros sao de um treino de padel do aluno, em ordem. Analise.';

  const corpo: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: instrucao }, ...partes] }],
  };
  if (!minimal) {
    corpo.systemInstruction = { parts: [{ text: systemPrompt }] };
    corpo.generationConfig = { temperature: 0.4, responseMimeType: 'application/json' };
  }

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 90_000);

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.IA_API_KEY as string,
      },
      body: JSON.stringify(corpo),
    });

    if (!resposta.ok) {
      const texto = await resposta.text();
      if (resposta.status === 400 && !minimal) {
        return chamarGemini(env, modelo, partes, systemPrompt, true);
      }
      return { ok: false, status: resposta.status, erro: limparErro(texto) };
    }

    const dados = (await resposta.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const saida =
      dados.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return { ok: true, texto: saida };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'falha de rede';
    return { ok: false, status: 0, erro: msg.slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

// Instrucao em PT-BR claro para cada tipo de falha conhecida.
export function dicaParaErro(motivo: string): string | null {
  const m = motivo.toLowerCase();
  if (m.includes('503') || m.includes('unavailable') || m.includes('high demand')) {
    return 'O servico do Google esta sobrecarregado agora. Tente de novo em alguns minutos.';
  }
  if (m.includes('524') || m.includes('timeout') || m.includes('abort')) {
    return 'O coach demorou mais que o normal para responder. Tente de novo - se repetir, envie um clipe de ate 1 minuto.';
  }
  if (m.includes('invalid_argument') || m.includes('400')) {
    return 'Nao consegui ler os quadros deste video. Tente enviar em mp4 ou mov.';
  }
  if (m.includes('api key') || m.includes('401') || m.includes('403') || m.includes('permission')) {
    return 'A chave da IA foi recusada. Gere outra em aistudio.google.com/apikey e atualize IA_API_KEY.';
  }
  if (m.includes('not found') || m.includes('404')) {
    return 'O modelo configurado nao existe mais. Atualize IA_MODEL (por exemplo: gemini-2.5-flash).';
  }
  if (m.includes('quota') || m.includes('429') || m.includes('resource_exhausted')) {
    return 'A cota gratuita do Gemini acabou por hoje. Tente de novo amanha.';
  }
  if (m.includes('rede') || m.includes('network') || m.includes('fetch')) {
    return 'A conexao caiu antes da resposta. Tente de novo.';
  }
  return null;
}

function baseGemini(configurado?: string): string {
  const padrao = 'https://generativelanguage.googleapis.com/v1beta';
  if (!configurado) return padrao;
  if (!configurado.startsWith('https://')) return padrao;
  if (!configurado.includes('googleapis.com')) return padrao;
  return configurado.replace(/\/$/, '');
}

function normalizarModelo(nome: string): string {
  const semPrefixo = nome.includes('/') ? nome.split('/').pop() ?? nome : nome;
  return semPrefixo.trim();
}

export type DiagnosticoIa = {
  ok: boolean;
  modelo: string;
  status: number;
  ms: number;
  detalhe: string;
};

// Testa a conexao com o Google SEM enviar video. Isola o provedor do fluxo:
// se isto falhar, o problema e chave/modelo, nunca o video do aluno.
export async function diagnosticarIa(env: Bindings): Promise<DiagnosticoIa> {
  const modelo = env.IA_MODEL ? normalizarModelo(env.IA_MODEL) : '(nao definido)';
  if (!env.IA_API_KEY || !env.IA_MODEL) {
    return { ok: false, modelo, status: 0, ms: 0, detalhe: 'falta IA_API_KEY ou IA_MODEL' };
  }

  const base = baseGemini(env.IA_BASE_URL);
  const inicio = Date.now();
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 15_000);

  try {
    const r = await fetch(`${base}/models/${modelo}`, {
      signal: controlador.signal,
      headers: { 'x-goog-api-key': env.IA_API_KEY as string },
    });
    const ms = Date.now() - inicio;
    const texto = await r.text();
    return {
      ok: r.ok,
      modelo,
      status: r.status,
      ms,
      detalhe: r.ok ? 'modelo disponivel para esta chave' : limparErro(texto),
    };
  } catch (e) {
    const ms = Date.now() - inicio;
    const msg = e instanceof Error ? e.message : 'falha de rede';
    return { ok: false, modelo, status: 0, ms, detalhe: msg.slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

export type DiagnosticoGeracao = {
  texto: { ok: boolean; status: number; ms: number; detalhe: string };
  imagem: { ok: boolean; status: number; ms: number; detalhe: string };
  modelo: string;
};

// Testa o POST que realmente analisa: primeiro so texto, depois texto + uma
// imagem minuscula. Isola "generateContent nao responde" de "payload grande".
async function tentarGeracao(
  env: Bindings,
  modelo: string,
  comImagem: boolean,
): Promise<{ ok: boolean; status: number; ms: number; detalhe: string }> {
  const base = baseGemini(env.IA_BASE_URL);
  const partes: Array<Record<string, unknown>> = [{ text: 'Responda apenas: ok' }];
  if (comImagem) {
    partes.push({
      inline_data: {
        mime_type: 'image/jpeg',
        data: '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
      },
    });
  }

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 20_000);
  const inicio = Date.now();

  try {
    const r = await fetch(`${base}/models/${modelo}:generateContent`, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.IA_API_KEY as string,
      },
      body: JSON.stringify({ contents: [{ role: 'user', parts: partes }] }),
    });
    const ms = Date.now() - inicio;
    const texto = await r.text();
    return {
      ok: r.ok,
      status: r.status,
      ms,
      detalhe: r.ok ? texto.slice(0, 120) : limparErro(texto),
    };
  } catch (e) {
    const ms = Date.now() - inicio;
    const msg = e instanceof Error ? e.message : 'falha de rede';
    return { ok: false, status: 0, ms, detalhe: msg.slice(0, 120) };
  } finally {
    clearTimeout(timer);
  }
}

export async function diagnosticarGeracao(env: Bindings): Promise<DiagnosticoGeracao> {
  const modelo = env.IA_MODEL ? normalizarModelo(env.IA_MODEL) : '(nao definido)';
  if (!env.IA_API_KEY || !env.IA_MODEL) {
    const vazio = { ok: false, status: 0, ms: 0, detalhe: 'falta IA_API_KEY ou IA_MODEL' };
    return { texto: vazio, imagem: vazio, modelo };
  }
  const texto = await tentarGeracao(env, modelo, false);
  const imagem = await tentarGeracao(env, modelo, true);
  return { texto, imagem, modelo };
}

function esperar(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

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
