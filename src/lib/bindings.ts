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
  // Mercado Pago: sem o token, /planos mostra "pagamento em breve".
  MP_ACCESS_TOKEN?: string;
};