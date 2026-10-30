import { Hono } from 'hono';
import { middlewareSessao, limparCookieSessao, type Vars } from './lib/session';
import { protecaoOrigem, emitirTokenCsrf, csrfValido } from './lib/csrf';
import type { Bindings } from './lib/bindings';
import { rotasAuth } from './routes/auth';
import { rotasVideos } from './routes/videos';
import { rotasPlanos, rotasWebhooks } from './routes/planos';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { PaginaPrivacidade } from './pages/Privacidade';
import { PaginaExemplo } from './pages/Exemplo';
import { diagnosticarIa, diagnosticarGeracao, listarModelos } from './ia';

export type { Bindings } from './lib/bindings';

const app = new Hono<{ Bindings: Bindings; Variables: Vars }>();

app.use('*', middlewareSessao);
app.use('*', protecaoOrigem);

app.get('/saude', (c) => c.json({ ok: true, app: c.env.APP_NAME }));

// Diagnostico da IA: responde em segundos se a chave e o modelo funcionam.
// Exige login para nao expor configuracao do projeto.
app.get('/saude/ia', async (c) => {
  if (!c.get('user')) return c.json({ ok: false, detalhe: 'entre na sua conta' }, 401);
  return c.json(await diagnosticarIa(c.env));
});

// Teste do POST de analise: texto puro e texto + imagem de 1x1 px.
app.get('/saude/ia/gerar', async (c) => {
  if (!c.get('user')) return c.json({ ok: false, detalhe: 'entre na sua conta' }, 401);
  return c.json(await diagnosticarGeracao(c.env));
});

// Lista os modelos que ESTA chave pode usar. O Google aposenta modelos e o
// nome valido muda; perguntar a API e mais confiavel que chutar.
app.get('/saude/ia/modelos', async (c) => {
  if (!c.get('user')) return c.json({ ok: false, detalhe: 'entre na sua conta' }, 401);
  const modelos = await listarModelos(c.env);
  return c.json({ ok: modelos.length > 0, total: modelos.length, modelos });
});

app.get('/', (c) => c.html(<Home user={c.get('user')} msg={c.req.query('msg')} />));

app.route('/', rotasAuth);
app.route('/videos', rotasVideos);
app.route('/planos', rotasPlanos);
app.route('/webhooks', rotasWebhooks);

app.get('/painel', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/entrar');

  const videos = await c.env.DB
    .prepare(
      `SELECT v.id, v.titulo, v.status, v.enviado_em, a.nota_geral AS nota
       FROM videos v LEFT JOIN analyses a ON a.video_id = v.id
       WHERE v.user_id = ? ORDER BY v.enviado_em DESC, v.id DESC`,
    )
    .bind(user!.id)
    .all<{ id: number; titulo: string | null; status: string; enviado_em: string; nota: number | null }>();

  const pontos = await c.env.DB
    .prepare(
      `SELECT a.nota_geral AS nota, a.criado_em AS quando
       FROM analyses a WHERE a.user_id = ? AND a.nota_geral IS NOT NULL
       ORDER BY a.criado_em ASC LIMIT 30`,
    )
    .bind(user!.id)
    .all<{ nota: number; quando: string }>();

  // Numero de analises do cliente, para mostrar no painel.
  const uso = await c.env.DB
    .prepare('SELECT COUNT(*) AS n FROM analyses WHERE user_id = ?')
    .bind(user!.id)
    .first<{ n: number }>();

  return c.html(
    <Dashboard
      user={user!}
      videos={videos.results ?? []}
      pontos={(pontos.results ?? []).map((p) => ({ rotulo: p.quando, nota: p.nota }))}
      usadas={uso?.n ?? 0}
      msg={c.req.query('msg')}
    />,
  );
});

app.get('/exemplo', (c) => c.html(<PaginaExemplo user={c.get('user')} />));

app.get('/privacidade', (c) =>
  c.html(
    <PaginaPrivacidade
      user={c.get('user')}
      csrf={emitirTokenCsrf(c)}
      msg={c.req.query('msg')}
    />,
  ),
);

// LGPD: apagar a conta remove analises, sessoes e o cadastro.
// Nao ha video guardado: o arquivo e descartado apos a analise.
app.post('/conta/apagar', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/entrar');

  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) return c.redirect('/privacidade?msg=csrf');
  if (String(corpo['confirmar'] ?? '').trim().toUpperCase() !== 'APAGAR') {
    return c.redirect('/privacidade?msg=confirmar');
  }

  if (c.env.VIDEOS) {
    const chaves = await c.env.DB
      .prepare('SELECT r2_key FROM videos WHERE user_id = ?')
      .bind(user.id)
      .all<{ r2_key: string }>();
    for (const k of chaves.results ?? []) {
      if (k.r2_key && k.r2_key !== 'pendente') {
        try {
          await c.env.VIDEOS.delete(k.r2_key);
        } catch {
          // objeto pode ja ter sido removido; segue a limpeza do banco
        }
      }
    }
  }

  await c.env.DB.prepare('DELETE FROM analyses WHERE user_id = ?').bind(user.id).run();
  await c.env.DB.prepare('DELETE FROM videos WHERE user_id = ?').bind(user.id).run();
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

  limparCookieSessao(c);
  return c.redirect('/?msg=conta_apagada');
});

export default app;
