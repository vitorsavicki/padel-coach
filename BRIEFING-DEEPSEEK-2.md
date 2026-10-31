# BRIEFING DEEPSEEK 2 — deixar o Padel Coach 100% funcional com coisas grátis

> Estado em 31/10/2026: o fluxo inteiro PASSA no teste E2E (node teste-usabilidade.mjs).
> Cadastro, login, análise real com IA grátis (Groq qwen3.8-27b, nota de verdade),
> painel, apagar treino, planos, privacidade. Cadeia: Groq -> Workers AI -> Gemini.
> Este arquivo substitui o BRIEFING-DEEPSEEK.md antigo (tarefas 1-4 ja feitas).

## Como usar com o DeepSeek (web, grátis)

Cole o bloco de CONTEXTO abaixo na conversa, depois cole UMA tarefa por vez.
Depois de cada tarefa: `npx tsc --noEmit` (tem que dar zero erro), `npx wrangler deploy`
e `node teste-usabilidade.mjs` (tem que terminar "TUDO PASSOU").

### Bloco de CONTEXTO (cole primeiro)

```
Voce e desenvolvedor senior. Projeto: Padel Coach IA — app de analise de treino
de padel com IA. Stack: Cloudflare Workers + Hono + D1 (SQLite), TypeScript com
JSX (hono/jsx), sem banco de arquivos: o navegador do aluno extrai ate 6 quadros
do video no celular dele e envia so as imagens (data URLs) — o video nunca sobe.
Arquivos principais:
- src/ia.ts — cadeia de provedores de visao (Groq -> Workers AI -> Gemini) e
  parse do JSON do coach
- src/routes/videos.tsx — POST /videos/novo (recebe quadros + csrf, salva em D1,
  chama a analise, mostra resultado)
- src/pages/NovoVideo.tsx — tela de upload (JS inline extrai os quadros do video)
- src/lib/plans.ts — limite de analises por plano
Regras: tudo em portugues, sem dependencia paga, deploy com `npx wrangler deploy`.
Escreva o codigo completo dos arquivos que mudar, sem placeholders.
```

---

## TAREFA 1 — Religar o limite do plano gratis (bloqueado para testes)

[Cole src/routes/videos.tsx e src/lib/plans.ts]

No POST /videos/novo existe `if (false && !limite.ok)` — o limite esta DESLIGADO
para testes. Religue: `if (!limite.ok) { ... }` mantendo a mensagem amigavel que
ja existe. Depois verifique em src/lib/plans.ts se o plano gratis esta com
videos_por_mes = 2. Teste: conta nova faz 2 analises, a 3a mostra o aviso de
limite e NAO cria linha no banco.

## TAREFA 2 — A espera de ~75s precisa de feedback de verdade

[Cole src/pages/NovoVideo.tsx]

A analise demora 60-90s e hoje so existe uma mensagem parada. Melhore sem mexer
no backend: barra de progresso animada (CSS puro) + mensagens que trocam a cada
~15s ("Extraindo os melhores momentos..." -> "O coach esta assistindo..." ->
"Escrevendo sua analise..."). Bonus: no cliente, enviar 4 quadros em vez de 6
(o Groq so usa 4 mesmo — fica mais rapido e gasta menos cota).

## TAREFA 3 — Investigar o Gemini (3o da cadeia, hoje trava em 20s)

[Cole src/ia.ts]

O teste /saude/ia/gerar aborta em 20s com QUALQUER modelo (texto e imagem),
mesmo com gemini-flash-latest. Suspeitas: IA_BASE_URL errado (deve ser
https://generativelanguage.googleapis.com/v1beta), chave do AI Studio sem a
Generative Language API habilitada, ou modelo regional. Descubra testando com
curl fora do Worker. Se nao resolver, ok: Groq (1o) + Workers AI (2o) seguram o
site — mas documente o que achou em comentario no ia.ts.

## TAREFA 4 — Workers AI (2o da cadeia): modelos de visao vivos em 2026?

[Cole src/ia.ts]

Rode `npx wrangler ai models` e veja quais modelos de visao (image-to-text)
ainda existem. A lista em analisarComWorkersAi pode ter modelos aposentados
(llava, qwen). Atualize para os vivos, na ordem: mais rapido primeiro.
Se nenhum aceitar multi-imagem, mande 1 quadro representativo e diga no prompt
que e um momento do treino.

## TAREFA 5 — Pagamento sem custo fixo: Mercado Pago (plano Atleta R$ 19,90)

[Cole src/routes/planos.tsx e o schema.sql]

Ja existe rotasWebhooks. Integre o checkout do Mercado Pago (criar preferencia ->
redirect -> webhook que confirma e ativa videos_por_mes=20 na subscriptions).
Sem custo fixo (MP so cobra por transacao). PIX primeiro, cartao depois.
Use o sandbox do MP para testar o fluxo inteiro antes de trocar as credenciais.

## TAREFA 6 — Usabilidade no celular (onde o aluno realmente esta)

Abra o site no DevTools em modo mobile (390x844) e confira: home, cadastro,
painel, novo video, planos. Procurar: botao primario alcançavel com o polegar,
sem scroll horizontal, texto legivel, o input de video GRANDE e obvio
("Toque para escolher o video"). Liste os problemas e proponha os ajustes CSS
(CSS_BASE esta em src/pages/Layout.tsx).

---

## Regras de ouro (vale para toda tarefa)

1. `npx tsc --noEmit` zero erro ANTES de commitar (o hook .claude/hooks ja exige).
2. `node teste-usabilidade.mjs` termina "TUDO PASSOU" antes do deploy.
3. Nunca commitar .dev.vars nem chaves. Segredos vivem em `npx wrangler secret put`.
4. Uma tarefa por conversa com o DeepSeek — contexto pequeno, respostas melhores.
5. Se o Groq responder 429 (cota do dia), o site NAO pode quebrar: a mensagem
   amigavel ja existe, so conferir.
