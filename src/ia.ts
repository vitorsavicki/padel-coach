import type { Bindings } from './index';

// Analise de video com IA multimodal (Gemini entende video nativamente).
// Fluxo: video no R2 -> base64/URL -> chat completions com o system prompt
// do coach (COACH-SYSTEM-PROMPT.md, embutido no build ou lido do D1).
// Limite honesto do free tier: videos CURTOS (ate ~2 min). Validar duracao
// e tamanho ANTES de chamar a IA para nao queimar cota a toa.

export type AnaliseCoach = {
  nota_geral: number;
  resumo: string;
  pontos_fortes: string[];
  pontos_melhorar: string[];
  treino_sugerido: string;
};

export async function analisarVideo(
  env: Bindings,
  r2Key: string,
  systemPrompt: string,
): Promise<AnaliseCoach> {
  // TODO(DeepSeek):
  // 1. env.VIDEOS.get(r2Key) -> bytes do video (rejeitar > 20MB no MVP)
  // 2. POST {env.IA_BASE_URL}/chat/completions
  //    model: env.IA_MODEL
  //    messages: [
  //      { role: 'system', content: systemPrompt },
  //      { role: 'user', content: [
  //        { type: 'text', text: 'Analise este video de padel do aluno.' },
  //        { type: 'video_url', video_url: { url: 'data:video/mp4;base64,...' } },
  //      ]},
  //    ]
  //    Authorization: Bearer env.IA_API_KEY
  // 3. Extrair o JSON da resposta (tolerante a ```json fences), validar com
  //    fallback seguro, retornar. Timeout + 1 retry com backoff.
  throw new Error('analisarVideo: implementar (ver BRIEFING-DEEPSEEK.md)');
}
