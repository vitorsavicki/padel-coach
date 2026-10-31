# Deixar 100% funcional - sem cartao, tudo em plano gratis

O site ja esta no ar. A analise **ja funciona sem chave externa** pelo
Cloudflare Workers AI (cota diaria gratis, sem cartao). As outras opcoes sao
reserva: se uma cair, a proxima assume.

## 1. Ordem dos provedores de IA

1. **Groq** (`GROQ_API_KEY`) - gratis, sem cartao. So entra se a chave existir.
2. **Workers AI** (`AI`) - ja ligado na conta Cloudflare. Sem chave e sem cartao.
3. **OpenRouter** (`OPENROUTER_API_KEY`) - modelos `:free` com visao.
4. **Mistral** (`MISTRAL_API_KEY`) - plano Experiment gratis (pede telefone).
5. **GitHub Models** (`GITHUB_MODELS_TOKEN`) - PAT gratis com escopo `models:read`.
6. **Gemini** (`IA_API_KEY` + `IA_MODEL`) - cota diaria gratis; ultimo da fila.

Cada provedor roda em try/catch: se um falhar, o próximo tenta. A analise so
para quando todos falham.

## 2. Alternativas gratis (opcionais)

Ative so as que voce tiver chave. Nenhuma pede cartao.

### OpenRouter

1. Crie a chave em https://openrouter.ai/keys.
2. Rode:

```
npx wrangler secret put OPENROUTER_API_KEY
```

Modelo padrao: `google/gemma-4-31b-it:free`. Para trocar:

```
npx wrangler secret put OPENROUTER_MODEL
```

### Mistral

1. Crie a chave em https://console.mistral.ai/api-keys (plano Experiment; pede telefone).
2. Rode:

```
npx wrangler secret put MISTRAL_API_KEY
```

Modelo padrao: `ministral-8b-2512`. Para trocar:

```
npx wrangler secret put MISTRAL_MODEL
```

### GitHub Models

1. Crie um PAT fine-grained em https://github.com/settings/tokens com a permissao `models:read`.
2. Rode:

```
npx wrangler secret put GITHUB_MODELS_TOKEN
```

Modelo padrao: `openai/gpt-4o`. Para trocar:

```
npx wrangler secret put GITHUB_MODEL
```

### Conferir se o Worker enxergou as chaves

Entre na sua conta e abra:

- `/saude/ia/provedores` - mostra quais estao configurados (nao chama API).
- `/saude/ia/testar` - faz uma geracao de 8 tokens em cada alternativa extra
  e mostra status/modelo/erro. Nao manda imagem.

## 3. Gemini (opcional, ultimo recurso)

1. Abra https://aistudio.google.com/apikey e clique em **Create API key**.
2. Rode:

```
npx wrangler secret put IA_API_KEY
npx wrangler secret put IA_MODEL
```

Valores: `IA_API_KEY` = a chave `AIza...`; `IA_MODEL` = `gemini-flash-latest`.
A cota diaria reseta a meia-noite do Pacifico (por volta de 04:00 ou 05:00 em
Brasilia, dependendo do horario de verao dos EUA).

## 4. Pagamento (opcional)

```
npx wrangler secret put MP_ACCESS_TOKEN
```

Webhook: `https://padel-coach.vitorsavicki.workers.dev/webhooks/mp`

Sem o token, `/planos` usa a assinatura simulada.

## Por que nao tem R2

O navegador extrai ate 6 quadros do video e envia so as imagens. O video
original **nunca sai do celular**. Isso dispensa bucket e e melhor para LGPD:
nao guardamos video, so a nota e o feedback.

## Recursos gratis que servem para esta ideia

| Recurso | Limite gratis | Para que serve |
|---|---|---|
| Cloudflare Workers | 100k req/dia | o site inteiro |
| Cloudflare D1 | 5GB + 5M leituras/dia | contas, notas, historico |
| Cloudflare Workers AI | cota diaria de neuronios | analise dos quadros |
| Groq | cota diaria gratis | analise dos quadros (reserva) |
| OpenRouter | modelos `:free` com limite diario | analise dos quadros (reserva) |
| Mistral | plano Experiment gratis | analise dos quadros (reserva) |
| GitHub Models | cota gratis por conta | analise dos quadros (reserva) |
| Gemini API (AI Studio) | cota diaria gratis do `flash` | ultimo recurso |
| Backblaze B2 | 10GB, sem cartao | se um dia quiser guardar video |
| Supabase | 500MB Postgres + 1GB storage | se sair do D1 |
| Vercel / Netlify | 100GB banda | se sair do Workers |
| Resend | 3k e-mails/mes | avisar quando a analise ficar pronta |
| Clarity / Umami | gratis | saber quantos cadastram |

## Ordem que eu recomendo

1. Nada: o Workers AI ja segura a analise.
2. Uma alternativa extra (OpenRouter ou GitHub Models) como reserva.
3. Umami ou Clarity para medir uso.
4. Resend para avisar quando a analise terminar.
5. Mercado Pago so quando houver gente usando.

## Conferir que ficou funcional

1. `/cadastro` cria conta -> `/painel`
2. `/videos/novo` envia um clipe; o navegador extrai os quadros -> analise
3. `/videos/:id` mostra nota, pontos fortes, melhorar e treino
4. `/painel` mostra o grafico de evolucao
5. `/privacidade` apaga um treino e a conta

## Funciona sem nenhuma chave externa

- cadastro, login, logout, sessao, CSRF, rate limit
- analise de verdade pelo Workers AI (sem chave e sem cartao)
- painel, historico, grafico de evolucao
- pagina de exemplo com analise completa (`/exemplo`)
- privacidade/LGPD e exclusao de dados
