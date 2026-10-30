# BRIEFING � Padel Coach IA (construir nesta ordem)

> Stack = mesma do projeto frete (Workers + Hono + D1 + JSX SSR + R2).
> Reaproveite PADROES do frete: auth PBKDF2 + sessao em cookie, CSRF token,
> rate limit no login, flash ?msg=, copy em PT-BR leigo, testes vitest.
> Leia o AGENTS.md. Nao invente stack nova. Rode `npx tsc --noEmit` antes de
> cada commit. Teste o fluxo no navegador antes de dizer "pronto".

## TAREFA 1 � Auth + layout base (copiar padroes do frete)
Cadastro/entrar/sair, sessao em cookie HttpOnly, CSRF, layout com nav.
Copy leiga: "Suba o video do seu treino e receba a analise do coach".

## TAREFA 2 � Upload de video (R2)
> NOTA DE ESTADO (30/10): R2 AINDA NAO ATIVADO na conta Cloudflare (dashboard pede cartao). Se `npx wrangler r2 bucket create padel-videos` falhar (code 10042): faca so a TAREFA 1, PULE a 2 (deixe o form de upload com stub/mensagem "em breve") e siga na 3 com um video de exemplo fixo. Voltamos na 2 quando o dono ativar R2 ou escolher Backblaze B2 (10GB gratis, sem cartao).
/videos/novo: form com validacao (mp4/mov, <= 100MB, avisar "ate ~2 min").
Upload via presigned URL ou PUT direto ao Worker (stream para o R2).
Status do video: enviado.

## TAREFA 3 � Analise com IA (o coracao)
POST /videos/:id/analisar: status processando -> implementar src/ia.ts
(Gemini multimodal) -> salvar em analyses -> status analisado.
System prompt = COACH-SYSTEM-PROMPT.md (carregar como texto embutido).
Pagina /videos/:id mostra nota grande, pontos fortes/melhorar, treino.
Falha da IA -> status erro com mensagem amigavel, sem travar o site.

## TAREFA 4 � Evolucao do aluno
Dashboard: lista de videos com notas + grafico simples da nota_geral ao
longo do tempo (SVG inline, sem lib pesada). Frase de progresso do coach.

## TAREFA 5 � Planos e Mercado Pago
/planos: 3 cards (Gratis 2 videos/mes, Atleta R$19,90 20/mes, Pro R$39,90
ilimitado). Checkout MP (preferencia + back_urls) -> webhook confirma ->
subscription ativa. Enforce: contar analyses do mes vs limite do plano.
Copy: "Comece gratis. Pague so se quiser analisar mais."

## TAREFA 6 � Polish
OG image, favicon, termos/privacidade (LGPD: videos sao dados sensiveis �
pagina clara de como apagar conta e videos), README final.
