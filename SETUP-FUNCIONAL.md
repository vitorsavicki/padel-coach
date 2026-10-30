# Deixar 100% funcional - sem cartao, tudo em plano gratis

O site ja esta no ar e cadastro/login/painel funcionam. Falta **uma**
chave para a analise de IA. Nao precisa de R2 nem de cartao.

## 1. Analise com IA (gratis, sem cartao)

1. Abra https://aistudio.google.com/apikey e clique em **Create API key**.
   A conta Google e gratis e nao pede cartao.
2. Rode, na pasta do projeto:

```
npx wrangler secret put IA_API_KEY
npx wrangler secret put IA_MODEL
npx wrangler deploy
```

Valores: `IA_API_KEY` = a chave `AIza...`; `IA_MODEL` = `gemini-2.0-flash`.

Pronto: `/videos/novo` passa a analisar de verdade.

## 2. Pagamento (opcional)

```
npx wrangler secret put MP_ACCESS_TOKEN
```

Webhook: `https://padel-coach.vitorsavicki.workers.dev/webhooks/mp`

## Por que nao tem R2

R2 exige ativar o faturamento no dashboard (pede cartao, code 10042).
Como o video agora vai **direto para o Gemini e e descartado**, nao existe
bucket no caminho. Isso ainda e melhor para LGPD: nao guardamos video.

---

# Recursos gratis que servem para esta ideia

## Ja usados aqui

| Recurso | Limite gratis | Para que serve |
|---|---|---|
| Cloudflare Workers | 100k req/dia | o site inteiro |
| Cloudflare D1 | 5GB + 5M leituras/dia | contas, notas, historico |
| Gemini API (AI Studio) | cota diaria gratis do `flash` | analise do video |
| GitHub | repositorio publico | codigo aberto |

## Alternativas gratis, sem cartao

| Recurso | Limite gratis | Quando usar |
|---|---|---|
| Backblaze B2 | 10GB, sem cartao | se um dia quiser guardar video |
| Supabase | 500MB Postgres + 1GB storage | se sair do D1 |
| Vercel / Netlify | 100GB banda | se sair do Workers |
| Cloudflare Pages | ilimitado (estatico) | landing separada |
| Resend | 3k e-mails/mes | avisar quando a analise ficar pronta |
| Cron Trigger (Workers) | incluso | limpar sessoes e videos antigos |
| Clarity / Umami | gratis | saber quantos cadastram |

## Ordem que eu recomendo

1. Chave do Gemini (desbloqueia o produto).
2. Umami ou Clarity (saber se alguem usa).
3. Resend (avisar por e-mail quando a analise terminar).
4. Mercado Pago so quando houver gente usando.

## Conferir que ficou funcional

1. `/cadastro` cria conta -> `/painel`
2. `/videos/novo` envia um clipe de ate 2 min -> analise na hora
3. `/videos/:id` mostra nota, pontos fortes, melhorar e treino
4. `/painel` mostra o grafico de evolucao
5. `/privacidade` apaga um treino e a conta

## Funciona sem nenhuma chave

- cadastro, login, logout, sessao, CSRF, rate limit
- painel, historico, grafico de evolucao
- pagina de exemplo com analise completa (`/exemplo`)
- privacidade/LGPD e exclusao de dados
