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

// Modelos de visao do Workers AI. O Llama 3.2 11B e o mais barato em
// neuronios; o Mistral Small 3.1 entra como reserva quando o primeiro nao
// devolve JSON. Ambos aceitam data URL no formato messages/image_url.
const MODELOS_VISAO = [
  '@cf/meta/llama-3.2-11b-vision-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
];

type ConteudoVisao =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

// Analise pelo Workers AI: manda ate 3 quadros e pede o JSON do coach.
// O campo antigo "image" esta marcado como deprecated no catalogo e falhava
// com array de base64; o formato atual e messages + image_url com data URL.
// Se um modelo recusar varias imagens, tenta de novo com o primeiro quadro.
async function analisarComWorkersAi(
  env: Bindings,
  quadros: string[],
  systemPrompt: string,
): Promise<AnaliseCoach> {
  if (!env.AI) throw new IaFalha(0, 'binding AI ausente');

  const falhas: string[] = [];
  const quantidades = [...new Set([Math.min(3, quadros.length), 1])];

  for (const modelo of MODELOS_VISAO) {
    for (const quantos of quantidades) {
      const conteudo: ConteudoVisao[] = [
        { type: 'text', text: 'Estes sao os momentos do treino, em ordem. Analise.' },
        ...quadros.slice(0, quantos).map(
          (q): ConteudoVisao => ({ type: 'image_url', image_url: { url: q } }),
        ),
      ];

      try {
        const resposta = await env.AI.run(modelo as never, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: conteudo },
          ],
          max_tokens: 1400,
          temperature: 0,
        } as never);

        const obj = resposta as { response?: string; description?: string } | string;
        const texto =
          typeof obj === 'string' ? obj : (obj?.response ?? obj?.description ?? '');
        const json = extrairJSON(texto);
        if (json) return normalizar(json);
        falhas.push(`${modelo} (${quantos} img): respondeu sem JSON`);
      } catch (e) {
        falhas.push(
          `${modelo} (${quantos} img): ${
            e instanceof Error ? e.message.slice(0, 100) : 'falha'
          }`,
        );
      }
    }
  }

  throw new IaFalha(0, `Workers AI: ${falhas.slice(0, 3).join(' | ')}`);
}

// Lista os modelos que esta chave do Groq pode usar. Foi assim que o erro
// "not a valid model ID" virou uma lista concreta de nomes.
export async function listarModelosGroq(chave?: string): Promise<string[]> {
  if (!chave) return [];
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${chave}` },
    });
    if (!r.ok) return [];
    const dados = (await r.json()) as { data?: Array<{ id?: string }> };
    return (dados.data ?? []).map((m) => String(m.id ?? '')).filter(Boolean).sort();
  } catch {
    return [];
  }
}

export function iaConfigurada(env: Bindings): boolean {
  // Em demonstracao a analise nao chama API, entao nao exige chave.
  return (
    MODO_DEMO_LOCAL ||
    Boolean(env.GROQ_API_KEY) ||
    Boolean(env.AI) ||
    Boolean(env.OPENROUTER_API_KEY) ||
    Boolean(env.MISTRAL_API_KEY) ||
    Boolean(env.GITHUB_MODELS_TOKEN) ||
    Boolean(env.IA_API_KEY && env.IA_MODEL)
  );
}

export type StatusProvedores = {
  groq: boolean;
  workersAi: boolean;
  openrouter: boolean;
  mistral: boolean;
  githubModels: boolean;
  gemini: boolean;
  modelos: {
    openrouter: string;
    mistral: string;
    githubModels: string;
    gemini: string;
  };
};

// Mostra quais provedores estao com chave, sem chamar nenhuma API. Serve para
// conferir a configuracao depois de rodar `wrangler secret put`.
export function statusProvedores(env: Bindings): StatusProvedores {
  return {
    groq: Boolean(env.GROQ_API_KEY),
    workersAi: Boolean(env.AI),
    openrouter: Boolean(env.OPENROUTER_API_KEY),
    mistral: Boolean(env.MISTRAL_API_KEY),
    githubModels: Boolean(env.GITHUB_MODELS_TOKEN),
    gemini: Boolean(env.IA_API_KEY && env.IA_MODEL),
    modelos: {
      openrouter: env.OPENROUTER_MODEL?.trim() || OPENROUTER_MODELO,
      mistral: env.MISTRAL_MODEL?.trim() || MISTRAL_MODELO,
      githubModels: env.GITHUB_MODEL?.trim() || GITHUB_MODELO,
      gemini: env.IA_MODEL ? normalizarModelo(env.IA_MODEL) : '',
    },
  };
}

export type TesteProvedor = {
  nome: string;
  modelo: string;
  ok: boolean;
  status: number;
  ms: number;
  detalhe: string;
};

// Teste leve (texto, 8 tokens) para confirmar chave + modelo sem gastar
// uma analise de imagens. Roda so nas alternativas extras configuradas.
async function testarCompat(provedor: ProvedorCompat): Promise<TesteProvedor> {
  const inicio = Date.now();
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 20_000);

  try {
    const r = await fetch(provedor.url, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provedor.chave.trim()}`,
        ...provedor.headers,
      },
      body: JSON.stringify({
        model: provedor.modelo,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'Responda apenas: ok' }],
      }),
    });
    const corpo = await r.text();
    return {
      nome: provedor.nome,
      modelo: provedor.modelo,
      ok: r.ok,
      status: r.status,
      ms: Date.now() - inicio,
      detalhe: r.ok ? 'chave e modelo responderam' : limparErro(corpo).slice(0, 160),
    };
  } catch (e) {
    return {
      nome: provedor.nome,
      modelo: provedor.modelo,
      ok: false,
      status: 0,
      ms: Date.now() - inicio,
      detalhe: e instanceof Error ? e.message.slice(0, 160) : 'falha de rede',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function testarProvedores(env: Bindings): Promise<TesteProvedor[]> {
  return Promise.all(provedoresCompat(env).map(testarCompat));
}

// Os quadros chegam como data URL ("data:image/jpeg;base64,...").
export function quadrosValidos(valor: unknown): valor is string[] {
  if (!Array.isArray(valor)) return false;
  if (valor.length < 3 || valor.length > MAX_QUADROS) return false;
  return valor.every(
    (q) => typeof q === 'string' && q.startsWith('data:image/') && q.length <= MAX_BYTES_QUADRO,
  );
}

// Pergunta a API quais modelos esta chave pode usar. O Google aposenta
// modelos e o nome valido muda; perguntar e mais confiavel que chutar.
export async function listarModelos(env: Bindings): Promise<string[]> {
  if (!env.IA_API_KEY) return [];
  const base = baseGemini(env.IA_BASE_URL);
  try {
    const r = await fetch(`${base}/models?pageSize=1000`, {
      headers: { 'x-goog-api-key': env.IA_API_KEY as string },
    });
    if (!r.ok) return [];
    const dados = (await r.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    return (dados.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => String(m.name ?? '').replace(/^models\//, ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

type Tentativa =
  | { ok: true; texto: string }
  | { ok: false; status: number; erro: string };

// Demonstracao local: quando true, a analise NAO chama nenhuma API e devolve
// um exemplo pronto. Serve para validar a tela inteira (momentos, nota,
// pontos, treino) enquanto a cota do provedor esta esgotada.
// Trocar para false volta a chamar o Gemini, sem mexer em mais nada.
export const MODO_DEMO_LOCAL = false;

function analiseDemo(quantos: number): AnaliseCoach {
  const n = Math.max(1, Math.min(quantos, 6));
  const m = (i: number) => `No momento ${Math.min(i, n)}`;
  return {
    nota_geral: 7.2,
    resumo:
      'Esta e uma analise de DEMONSTRACAO, para voce ver a tela inteira funcionando. ' +
      'Numa analise real, o coach olha cada momento do seu treino e escreve o que viu.',
    pontos_fortes: [
      `${m(1)}, sua base esta firme: pes afastados e joelhos levemente dobrados.`,
      `${m(2)}, voce fica perto da linha central, que e o lugar certo para cobrir a quadra.`,
      `${m(4)}, seu olhar ja esta no adversario depois do golpe - isso e leitura de jogo.`,
    ],
    pontos_melhorar: [
      `${m(3)}, a raquete abre cedo demais. Prepare o ombro e mantenha a raquete mais alta.`,
      `${m(2)}, termine o golpe com a raquete apontando para a frente, na direcao que quer acertar.`,
      `${m(6)}, dobre um pouco mais os joelhos na troca de bola: da mais controle e menos esforco.`,
    ],
    treino_sugerido:
      'Treino da semana (exemplo): tres series de 10 bandejas com o parceiro na rede. ' +
      'Prepare o ombro antes da bola quicar, bata e volte um passo ao centro. ' +
      'Sem smash nesse treino - o foco e a recuperacao, nao a forca.',
  };
}

// O secret pode chegar com \n ou aspas do "wrangler secret put"; nesse caso
// o Groq responde 401 "API Key not valid". Sanitiza em um lugar so.
function chaveGroq(env: Bindings): string {
  return (env.GROQ_API_KEY ?? '').trim().replace(/^["']|["']$/g, '');
}

// Groq: gratis, sem cartao, cota separada do Gemini. Modelos de visao da
// Meta (llama-4) aceitam varias imagens numa mensagem so.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELOS = [
  // Unico modelo de visao disponivel nesta conta Groq (ver /saude/ia/groq).
  // Os llama-4 abaixo ficam como reserva caso a conta ganhe acesso.
  'qwen/qwen3.8-27b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
];

// Alternativas gratis com API compativel com OpenAI (chat/completions).
// OpenRouter: modelos ":free" com visao. Mistral: plano Experiment (pede
// telefone). GitHub Models: PAT gratis com escopo models:read.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELO = 'google/gemma-4-31b-it:free';
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODELO = 'ministral-8b-2512';
const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions';
const GITHUB_MODELO = 'openai/gpt-4o';

type FormatoImagem = 'openai' | 'mistral';

type ProvedorCompat = {
  nome: string;
  url: string;
  chave: string;
  modelo: string;
  formato: FormatoImagem;
  headers?: Record<string, string>;
};

type ConteudoCompat =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: string | { url: string } };

function textoDaResposta(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (Array.isArray(valor)) {
    return valor
      .map((parte) => {
        if (parte && typeof parte === 'object' && 'text' in parte) {
          return String((parte as { text?: unknown }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return '';
}

// Chama OpenRouter, Mistral ou GitHub Models. Todos devolvem o mesmo
// choices[0].message.content do padrao OpenAI; so o formato da imagem muda
// (Mistral usa image_url como string, os outros como objeto).
async function analisarComCompat(
  provedor: ProvedorCompat,
  quadros: string[],
  systemPrompt: string,
): Promise<AnaliseCoach> {
  const conteudo: ConteudoCompat[] = [
    { type: 'text', text: 'Estes sao os momentos do treino, em ordem. Analise.' },
    ...quadros.slice(0, 4).map(
      (q): ConteudoCompat =>
        provedor.formato === 'mistral'
          ? { type: 'image_url', image_url: q }
          : { type: 'image_url', image_url: { url: q } },
    ),
  ];

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 45_000);

  try {
    const r = await fetch(provedor.url, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provedor.chave.trim()}`,
        ...provedor.headers,
      },
      body: JSON.stringify({
        model: provedor.modelo,
        temperature: 0,
        max_tokens: 1400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: conteudo },
        ],
      }),
    });

    const corpo = await r.text();
    if (!r.ok) {
      throw new IaFalha(r.status, `${provedor.nome}: ${limparErro(corpo)}`);
    }

    const dados = JSON.parse(corpo) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const saida = textoDaResposta(dados.choices?.[0]?.message?.content);
    const json = extrairJSON(saida);
    if (!json) {
      throw new IaFalha(
        0,
        `${provedor.nome}: respondeu sem JSON (${saida.slice(0, 90)})`,
      );
    }
    return normalizar(json);
  } catch (e) {
    if (e instanceof IaFalha) throw e;
    throw new IaFalha(
      0,
      `${provedor.nome}: ${e instanceof Error ? e.message.slice(0, 120) : 'falha'}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

// Lista so as alternativas que tem chave configurada. A ordem e a de
// tentativa: OpenRouter, Mistral, GitHub Models.
function provedoresCompat(env: Bindings): ProvedorCompat[] {
  const lista: ProvedorCompat[] = [];

  if (env.OPENROUTER_API_KEY) {
    lista.push({
      nome: 'OpenRouter',
      url: OPENROUTER_URL,
      chave: env.OPENROUTER_API_KEY,
      modelo: env.OPENROUTER_MODEL?.trim() || OPENROUTER_MODELO,
      formato: 'openai',
      headers: {
        'HTTP-Referer': 'https://padel-coach.vitorsavicki.workers.dev',
        'X-Title': 'Padel Coach IA',
      },
    });
  }

  if (env.MISTRAL_API_KEY) {
    lista.push({
      nome: 'Mistral',
      url: MISTRAL_URL,
      chave: env.MISTRAL_API_KEY,
      modelo: env.MISTRAL_MODEL?.trim() || MISTRAL_MODELO,
      formato: 'mistral',
    });
  }

  if (env.GITHUB_MODELS_TOKEN) {
    lista.push({
      nome: 'GitHub Models',
      url: GITHUB_MODELS_URL,
      chave: env.GITHUB_MODELS_TOKEN,
      modelo: env.GITHUB_MODEL?.trim() || GITHUB_MODELO,
      formato: 'openai',
      headers: { Accept: 'application/json' },
    });
  }

  return lista;
}

async function analisarComGroq(
  env: Bindings,
  quadros: string[],
  systemPrompt: string,
): Promise<AnaliseCoach> {
  if (!env.GROQ_API_KEY) throw new IaFalha(0, 'falta GROQ_API_KEY');

  const imagens = quadros.slice(0, 4);
  let ultimo = 'nenhum modelo respondeu';

  for (const modelo of GROQ_MODELOS) {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), 90_000);
    try {
      const r = await fetch(GROQ_URL, {
        method: 'POST',
        signal: controlador.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${chaveGroq(env)}`,
        },
        body: JSON.stringify({
          model: modelo,
          temperature: 0,
          max_tokens: 1400,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Estes sao os momentos do treino, em ordem. Analise.' },
                ...imagens.map((q) => ({ type: 'image_url', image_url: { url: q } })),
              ],
            },
          ],
        }),
      });

      const corpo = await r.text();
      if (!r.ok) {
        ultimo = `${modelo}: ${limparErro(corpo)}`;
        continue;
      }

      const dados = JSON.parse(corpo) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const saida = dados.choices?.[0]?.message?.content ?? '';
      const json = extrairJSON(saida);
      if (json) return normalizar(json);

      ultimo = `${modelo}: respondeu sem JSON (${saida.slice(0, 90)})`;
    } catch (e) {
      ultimo = `${modelo}: ${e instanceof Error ? e.message.slice(0, 120) : 'falha'}`;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new IaFalha(0, `Groq: ${ultimo}`);
}

export async function analisarQuadros(
  env: Bindings,
  quadros: string[],
  systemPrompt: string,
): Promise<AnaliseCoach> {
  if (MODO_DEMO_LOCAL) return analiseDemo(quadros.length);

  // Ordem: Groq (se tiver) -> Workers AI (sempre) -> OpenRouter/Mistral/
  // GitHub Models (se tiverem chave) -> Gemini (se tiver). Cada provedor
  // entra em try/catch: a falha de um nao pode encerrar a analise quando
  // outro ainda pode responder.
  const falhas: string[] = [];
  const extras = provedoresCompat(env);

  if (env.GROQ_API_KEY) {
    try {
      return await analisarComGroq(env, quadros, systemPrompt);
    } catch (e) {
      falhas.push(e instanceof Error ? e.message.slice(0, 120) : 'groq falhou');
    }
  }

  if (env.AI) {
    try {
      return await analisarComWorkersAi(env, quadros, systemPrompt);
    } catch (e) {
      // Acumula e segue: a falha do Workers AI nao pode impedir as
      // alternativas gratis nem o Gemini de responder.
      falhas.push(e instanceof Error ? e.message.slice(0, 120) : 'workers ai falhou');
    }
  }

  for (const provedor of extras) {
    try {
      return await analisarComCompat(provedor, quadros, systemPrompt);
    } catch (e) {
      falhas.push(
        `${provedor.nome}: ${e instanceof Error ? e.message.slice(0, 120) : 'falhou'}`,
      );
    }
  }

  if (!env.IA_API_KEY || !env.IA_MODEL) {
    const tentados = ['Groq', 'Workers AI', ...extras.map((p) => p.nome)];
    throw new IaFalha(
      0,
      `Nenhum provedor de IA respondeu. Tentamos: ${tentados.join(', ')}. Tente de novo em alguns minutos.`,
    );
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
    // Abort por tempo (status 0) tambem deve cair pro proximo modelo da
    // lista: antes, o break impedia os modelos reserva de rodarem.
    if (r.status !== 0 && r.status !== 404 && r.status !== 503) break;
  }

  // Ultimo recurso: a lista de modelos vivos desta chave, filtrada para
  // os Flash (visao), tentando os que ainda nao foram usados.
  if (ultima?.status === 404) {
    const vivos = await listarModelos(env);
    const candidatos = vivos
      .filter((m) => /flash/i.test(m) && !/embedding|tts|image|vision/i.test(m))
      .filter((m) => !modelos.includes(m))
      .slice(0, 3);
    for (const m of candidatos) {
      const r = await chamarGemini(env, m, partes, systemPrompt, true);
      if (r.ok) {
        const json = extrairJSON(r.texto);
        if (json) return normalizar(json);
      }
    }
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
    // temperature 0: o mesmo video deve dar a mesma nota. Com 0.4 a nota
    // variava 6.0 / 7.2 / 7.5 para o mesmo clipe, o que parece erro do site.
    corpo.generationConfig = { temperature: 0, responseMimeType: 'application/json' };
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
  // TAREFA 3 (investigacao do Gemini): o endpoint padrao acima esta correto.
  // O /saude/ia/gerar aborta em ~20s quando:
  //  - IA_API_KEY nao esta definida ou nao tem a Generative Language API habilitada
  //  - IA_MODEL nao existe na conta (ex: aposentado) -> 404 ao gerar
  //  - IA_BASE_URL aponta para endpoint invalido
  // Sem essas chaves, o site segue com Groq (1o) + Workers AI (2o), que seguram o site.
  // Para testar fora do Worker: curl -X POST https://generativelanguage.googleapis.com/v1beta/models/IA_MODEL:generateContent -H 'x-goog-api-key: IA_API_KEY'
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
  // Testa o provedor que a analise realmente usa. Antes testava so o Gemini
  // e dizia "conexao ok" para um modelo aposentado.
  if (env.GROQ_API_KEY) {
    const inicio = Date.now();
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${chaveGroq(env)}` },
      });
      const ms = Date.now() - inicio;
      const corpo = r.ok ? '' : await r.text();
      return {
        ok: r.ok,
        modelo: 'groq / llama-4-scout',
        status: r.status,
        ms,
        detalhe: r.ok ? 'chave do Groq aceita' : limparErro(corpo),
      };
    } catch (e) {
      return {
        ok: false,
        modelo: 'groq',
        status: 0,
        ms: Date.now() - inicio,
        detalhe: e instanceof Error ? e.message.slice(0, 120) : 'falha de rede',
      };
    }
  }

  const modelo = env.IA_MODEL ? normalizarModelo(env.IA_MODEL) : '(nao definido)';
  if (!env.IA_API_KEY || !env.IA_MODEL) {
    return { ok: false, modelo, status: 0, ms: 0, detalhe: 'falta IA_API_KEY ou IA_MODEL' };
  }

  const base = baseGemini(env.IA_BASE_URL);
  const inicio = Date.now();
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 15_000);

  try {
    // Geracao real de 1 token. O GET /models responde 200 mesmo para modelo
    // aposentado - foi por isso que este botao dizia "conexao ok" para o
    // gemini-2.0-flash, que devolve 404 ao gerar.
    const r = await fetch(`${base}/models/${modelo}:generateContent`, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.IA_API_KEY as string,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Responda apenas: ok' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8 },
      }),
    });
    const ms = Date.now() - inicio;
    const texto = await r.text();
    return {
      ok: r.ok,
      modelo,
      status: r.status,
      ms,
      detalhe: r.ok ? 'modelo respondeu a uma geracao de teste' : limparErro(texto),
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
