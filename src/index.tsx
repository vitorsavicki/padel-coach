import { Hono } from 'hono';

export type Bindings = {
  DB: D1Database;
  APP_NAME: string;
  IA_BASE_URL: string;
  IA_API_KEY: string;
  IA_MODEL: string;
  MP_ACCESS_TOKEN: string;
  SESSION_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/saude', (c) => c.json({ ok: true, app: c.env.APP_NAME }));

// Landing page do esqueleto (DeepSeek extrai p/ arquivo proprio na TAREFA 1).
// Copy leiga: o que e, como funciona, quanto custa.
const CSS = `
* { box-sizing: border-box; margin: 0 }
body { font-family: system-ui, sans-serif; color: #0f172a; background: #f8fafc; line-height: 1.55 }
.wrap { max-width: 960px; margin: 0 auto; padding: 0 20px }
header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 14px 0; font-weight: 700 }
.hero { text-align: center; padding: 64px 20px 48px }
.hero h1 { font-size: 2.4rem; line-height: 1.15; margin-bottom: 16px }
.hero h1 em { color: #1e4fd8; font-style: normal }
.hero p { font-size: 1.15rem; color: #475569; max-width: 620px; margin: 0 auto 28px }
.btn { display: inline-block; padding: 13px 26px; border-radius: 12px; font-weight: 700; text-decoration: none }
.btn-pri { background: #1e4fd8; color: #fff }
.btn-sec { border: 2px solid #1e4fd8; color: #1e4fd8; margin-left: 10px }
.sec { padding: 44px 0 }
.sec h2 { text-align: center; margin-bottom: 28px; font-size: 1.6rem }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px }
.card .n { display: inline-block; background: #f5b942; width: 34px; height: 34px; border-radius: 50%; text-align: center; line-height: 34px; font-weight: 800; margin-bottom: 10px }
.card h3 { margin-bottom: 6px }
.card p { color: #475569; font-size: .95rem }
.preco { font-size: 2rem; font-weight: 800; margin: 8px 0 }
.preco small { font-size: .9rem; color: #64748b; font-weight: 400 }
.card.destaque { border: 2px solid #1e4fd8 }
.tag { background: #1e4fd8; color: #fff; font-size: .75rem; padding: 3px 10px; border-radius: 999px; float: right }
ul.feats { list-style: none; padding: 0; margin: 12px 0 18px }
ul.feats li { padding: 4px 0; color: #334155; font-size: .95rem }
ul.feats li::before { content: "✓ "; color: #16a34a; font-weight: 700 }
.embreve { display: block; text-align: center; padding: 11px; border-radius: 10px; background: #e2e8f0; color: #64748b; font-weight: 600 }
footer { text-align: center; color: #94a3b8; font-size: .85rem; padding: 32px 0 }
`;

app.get('/', (c) =>
  c.html(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Padel Coach IA — seu coach de padel com inteligência artificial</title>
<meta name="description" content="Suba o vídeo do seu treino de padel e receba análise, nota e plano de evolução. Comece grátis.">
<style>${CSS}</style></head><body>
<header><div class="wrap">🎾 Padel Coach IA</div></header>
<section class="hero">
  <h1>Seu coach de padel<br>com <em>inteligência artificial</em>.</h1>
  <p>Suba o vídeo do seu treino ou jogo. A IA analisa, dá nota, mostra o que melhorar
  e monta o treino da sua semana. Você acompanha sua evolução a cada vídeo.</p>
  <a class="btn btn-pri" href="#planos">Começar grátis</a>
  <a class="btn btn-sec" href="#como">Como funciona</a>
</section>
<section class="sec" id="como"><div class="wrap">
  <h2>Como funciona</h2>
  <div class="grid">
    <div class="card"><span class="n">1</span><h3>Suba seu vídeo</h3>
      <p>Grave um treino ou jogo pelo celular e envie. Clipes de até 2 minutos já valem uma análise completa.</p></div>
    <div class="card"><span class="n">2</span><h3>A IA analisa</h3>
      <p>O coach assiste seu vídeo e avalia técnica, posicionamento e decisões — como um treinador de verdade.</p></div>
    <div class="card"><span class="n">3</span><h3>Evolua a cada treino</h3>
      <p>Receba nota, pontos fortes, o que melhorar e um treino sob medida. Veja suas notas subirem com o tempo.</p></div>
  </div>
</div></section>
<section class="sec" id="planos"><div class="wrap">
  <h2>Planos para cada momento</h2>
  <div class="grid">
    <div class="card"><h3>Grátis</h3><div class="preco">R$ 0</div>
      <ul class="feats"><li>2 análises por mês</li><li>Nota e feedback do coach</li><li>Treino sugerido</li></ul>
      <span class="embreve">Em breve</span></div>
    <div class="card destaque"><span class="tag">Popular</span><h3>Atleta</h3>
      <div class="preco">R$ 19,90<small>/mês</small></div>
      <ul class="feats"><li>20 análises por mês</li><li>Histórico e evolução das notas</li><li>Tudo do plano Grátis</li></ul>
      <span class="embreve">Em breve</span></div>
    <div class="card"><h3>Pro</h3><div class="preco">R$ 39,90<small>/mês</small></div>
      <ul class="feats"><li>Análises ilimitadas</li><li>Prioridade na fila de análise</li><li>Tudo do plano Atleta</li></ul>
      <span class="embreve">Em breve</span></div>
  </div>
  <p style="text-align:center;color:#64748b;margin-top:22px">Estamos montando a quadra 🚧 — o cadastro abre em breve. Pagamento via PIX ou cartão (Mercado Pago).</p>
</div></section>
<footer>Feito com IA + Cloudflare Workers · Padel Coach IA © 2026</footer>
</body></html>`),
);

// ROTAS A IMPLEMENTAR (ordem no BRIEFING-DEEPSEEK.md):
// auth:    GET/POST /cadastro, GET/POST /entrar, GET /sair
// aluno:   GET /painel (meus videos, notas, evolucao)
// videos:  GET/POST /videos/novo, GET /videos/:id (analise)
// ia:      POST /videos/:id/analisar
// planos:  POST /planos/:id/assinar (checkout Mercado Pago)
// webhook: POST /webhooks/mercadopago

export default app;
