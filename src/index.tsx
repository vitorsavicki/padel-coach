import { Hono } from 'hono';

export type Bindings = {
  DB: D1Database;
  VIDEOS: R2Bucket;
  APP_NAME: string;
  // secrets (.dev.vars local / wrangler secret put em producao):
  IA_BASE_URL: string;   // ex.: http://localhost:20128/v1 (OmniRoute) ou https://openrouter.ai/api/v1
  IA_API_KEY: string;
  IA_MODEL: string;      // ex.: 'gemini/gemini-2.0-flash' — multimodal, entende video
  MP_ACCESS_TOKEN: string; // Mercado Pago
  SESSION_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/saude', (c) => c.json({ ok: true, app: c.env.APP_NAME }));

// ROTAS A IMPLEMENTAR (ordem no BRIEFING-DEEPSEEK.md):
// auth:    GET/POST /cadastro, GET/POST /entrar, GET /sair
// aluno:   GET / (dashboard: meus videos, notas, evolucao)
// videos:  GET/POST /videos/novo (upload direto p/ R2), GET /videos/:id (analise)
// ia:      POST /videos/:id/analisar (marca processando -> chama ia.ts -> salva analyses)
// planos:  GET /planos, POST /planos/:id/assinar (checkout Mercado Pago)
// webhook: POST /webhooks/mercadopago (confirma pagamento -> ativa subscription)

export default app;
