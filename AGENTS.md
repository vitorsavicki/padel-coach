# Regras para agentes de IA

1. Ler BRIEFING-DEEPSEEK.md e seguir a ordem das tarefas.
2. Stack fixa: Cloudflare Workers + Hono + D1 + R2 + JSX SSR. Nada de framework novo.
3. Seguranca herdada do projeto frete: sessao HttpOnly, CSRF, rate limit, senha PBKDF2.
4. Copy PT-BR leigo, direto, sem jargao de IA. Usuario = jogador amador de padel.
5. Antes de commit: `npx tsc --noEmit` + testar fluxo no navegador.
6. Videos sao dados sensiveis: nunca logar URLs/conteudo, sempre permitir apagar.
