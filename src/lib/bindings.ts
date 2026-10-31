// Bindings do Worker. Os opcionais existem porque nem tudo esta ativado na
// conta Cloudflare ainda (R2 pede ativacao; IA/MP entram como secrets).
export type Bindings = {
  DB: D1Database;
  APP_NAME: string;
  // R2: ainda nao ativado. Enquanto faltar, o upload responde "em breve".
  VIDEOS?: R2Bucket;
  // Opcional: o padrao e o endpoint nativo do Gemini.
  IA_BASE_URL?: string;
  IA_API_KEY?: string;
  IA_MODEL?: string;
  // Groq: gratis, sem cartao, cota separada do Gemini.
  GROQ_API_KEY?: string;
  // Workers AI: roda na mesma conta, sem chave e sem cartao.
  AI?: Ai;
  // Alternativas gratis (APIs compativeis com OpenAI). Cada uma so entra
  // quando a chave existir; sem chave, o app ignora.
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  MISTRAL_API_KEY?: string;
  MISTRAL_MODEL?: string;
  GITHUB_MODELS_TOKEN?: string;
  GITHUB_MODEL?: string;
  // Mercado Pago: sem o token, /planos mostra "pagamento em breve".
  MP_ACCESS_TOKEN?: string;
};