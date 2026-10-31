# Padel Coach IA

Coach de padel com IA: o aluno envia um video curto do treino e recebe nota,
pontos fortes, o que melhorar e um treino para a semana. Stack: Cloudflare
Workers + Hono + D1 + JSX SSR. O navegador extrai ate 6 quadros do video no
celular; o video original nunca sobe.

## Como funciona

1. O aluno cria conta e escolhe um video curto.
2. O navegador extrai ate 6 quadros e envia so as imagens (data URLs).
3. A IA analisa os quadros e responde no formato do coach: nota 0-10, resumo,
   pontos fortes, pontos a melhorar e treino sugerido.
4. O painel mostra a evolucao das notas ao longo do tempo.
5. Planos: Gratis (2 analises/mes) | Atleta R$19,90 (20) | Pro R$39,90
   (ilimitado). Sem credencial de Mercado Pago, o fluxo de assinatura e
   simulado.

## Provedores de IA (todos gratis)

Ordem de tentativa:

1. Groq (`GROQ_API_KEY`, opcional)
2. Cloudflare Workers AI (`AI`, ja ligado, sem chave)
3. OpenRouter (`OPENROUTER_API_KEY`, opcional)
4. Mistral (`MISTRAL_API_KEY`, opcional)
5. GitHub Models (`GITHUB_MODELS_TOKEN`, opcional)
6. Gemini (`IA_API_KEY` + `IA_MODEL`, opcional, ultimo recurso)

Se um falhar, o proximo assume. Detalhes e como pegar cada chave:
`SETUP-FUNCIONAL.md`.

## Setup

```bash
npm install
npx wrangler d1 create padel_coach_db   # colar o database_id no wrangler.json
npx wrangler d1 execute padel_coach_db --file=schema.sql --remote
npm run dev
```

As chaves sao opcionais para rodar: o Workers AI ja atende a analise. Para
producao, use `npx wrangler secret put NOME`. R2 so e necessario se um dia
quisermos guardar o video; hoje nao guardamos.

## Onde esta o cerebro

- `src/prompt.ts` - prompt de producao do professor de padel.
- `COACH-SYSTEM-PROMPT.md` - o mesmo prompt documentado + contrato JSON.
- `src/ia.ts` - cadeia de provedores e parse da resposta.

## Teste

```bash
npx tsc --noEmit
node teste-usabilidade.mjs
```

O teste E2E precisa terminar com `TUDO PASSOU`.

## Limites honestos do free tier

- A analise usa quadros, nao o video inteiro; o coach e honesto quando a
  imagem nao permite avaliar.
- Cada provedor tem cota diaria gratuita. Se todos estourarem, a analise
  falha ate a cota renovar.
- Nao ha garantia de nota: o coach pode devolver 0 e pedir um video melhor se
  os quadros estiverem escuros, tremidos ou sem o jogador.
- O professor virtual nao substitui aula presencial, fisioterapia ou medico.
