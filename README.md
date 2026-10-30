# Padel Coach IA ??

Coach de padel com IA: o aluno sobe videos dos treinos/jogos e recebe
analise, notas e plano de evolucao. Esqueleto open source (mesma stack do
projeto frete): Cloudflare Workers + Hono + D1 + R2 + LLM free (Gemini
multimodal via OmniRoute/OpenRouter).

## Como funciona

1. Aluno cria conta e sobe um video curto (ate ~2 min)
2. O video vai para o R2 (armazenamento, 10GB gratis)
3. A IA (Gemini multimodal) "assiste" e responde no formato do coach
   (nota 0-10, pontos fortes, o que melhorar, treino da semana)
4. O dashboard mostra a evolucao das notas ao longo do tempo
5. Planos: Gratis (2 analises/mes) | Atleta R$19,90 (20) | Pro R$39,90
   (ilimitado) — cobranca via Mercado Pago (PIX/cartao, sem mensalidade)

## Setup

```bash
npm install
npx wrangler d1 create padel_coach_db   # colar o database_id no wrangler.json
npx wrangler r2 bucket create padel-videos
cp .dev.vars.example .dev.vars           # preencher as chaves
npx wrangler d1 execute padel_coach_db --file=schema.sql --remote
npm run dev
```

## Onde esta o cerebro

`COACH-SYSTEM-PROMPT.md` — cole ali as instrucoes do GPT original. O resto
do sistema le esse texto e usa como personalidade/rubrica do coach.

## Ordem de construcao

Ver `BRIEFING-DEEPSEEK.md`. Stack e regras: `AGENTS.md`.

## Limites honestos do free tier

- Videos curtos (MVP: ate ~2 min e ~20MB por analise)
- Cota diaria do Gemini free: suficiente p/ MVP e primeiros usuarios;
  estourando, entra fila ou upgrade de plano de API (barato por uso)
- R2: 10GB gratis (milhares de clipes de 2 min)
