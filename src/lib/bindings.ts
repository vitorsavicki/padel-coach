// Bindings do Worker. Os opcionais existem porque nem tudo esta ativado na
// conta Cloudflare ainda (R2 pede ativacao; IA/MP entram como secrets).
export type Bindings = {
  DB: D1Database;
  APP_NAME: string;
  // R2: ainda nao ativado. Enquanto faltar, o upload responde "em breve".
  VIDEOS?: R2Bucket;
  IA_BASE_URL?: string;
  IA_API_KEY?: string;
  IA_MODEL?: string;
  // Mercado Pago: sem o token, /planos mostra "pagamento em breve".
  MP_ACCESS_TOKEN?: string;
};