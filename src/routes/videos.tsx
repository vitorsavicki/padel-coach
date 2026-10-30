import { Hono } from 'hono';
import { exigirLogin, type Vars } from '../lib/session';
import { emitirTokenCsrf, csrfValido } from '../lib/csrf';
import { analisarBytes, iaConfigurada } from '../ia';
import { podeAnalisar } from '../lib/plans';
import { COACH_SYSTEM_PROMPT } from '../prompt';
import type { Bindings } from '../lib/bindings';
import { PaginaNovoVideo } from '../pages/NovoVideo';
import { PaginaVideo } from '../pages/Video';

export const rotasVideos = new Hono<{ Bindings: Bindings; Variables: Vars }>();

const TIPOS_OK = new Set(['video/mp4', 'video/quicktime', 'video/x-m4v']);
const LIMITE_MB = 60;

export type VideoRow = {
  id: number;
  titulo: string | null;
  status: string;
  enviado_em: string;
};

export type AnaliseRow = {
  video_id: number;
  nota_geral: number | null;
  resumo: string | null;
  pontos_fortes: string | null;
  pontos_melhorar: string | null;
  treino_sugerido: string | null;
};

rotasVideos.get('/novo', (c) => {
  const user = c.get('user');
  const guarda = exigirLogin(user);
  if (guarda) return guarda;
  return c.html(
    <PaginaNovoVideo
      user={user!}
      msg={c.req.query('msg')}
      csrf={emitirTokenCsrf(c)}
      iaAtiva={iaConfigurada(c.env)}
    />,
  );
});

// Upload + analise num passo so: o video nao e guardado em lugar nenhum.
// Ele vai para o Gemini, a analise volta, e o arquivo e descartado.
rotasVideos.post('/novo', async (c) => {
  const user = c.get('user');
  const guarda = exigirLogin(user);
  if (guarda) return guarda;

  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) return c.redirect('/videos/novo?msg=csrf');
  if (!iaConfigurada(c.env)) return c.redirect('/videos/novo?msg=ia_off');

  const arquivo = corpo['video'];
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return c.redirect('/videos/novo?msg=arquivo');
  }
  if (!TIPOS_OK.has(arquivo.type)) return c.redirect('/videos/novo?msg=tipo');
  if (arquivo.size > LIMITE_MB * 1024 * 1024) return c.redirect('/videos/novo?msg=tamanho');

  const titulo = String(corpo['titulo'] ?? '').trim().slice(0, 80) || 'Treino sem titulo';

  // Limite do plano e checado ANTES de gastar cota da IA.
  const limite = await podeAnalisar(c.env.DB, user!.id);
  if (!limite.ok) return c.redirect('/videos/novo?msg=limite');

  const inserido = await c.env.DB
    .prepare('INSERT INTO videos (user_id, r2_key, titulo, status) VALUES (?, ?, ?, ?)')
    .bind(user!.id, 'nao-armazenado', titulo, 'processando')
    .run();
  const videoId = inserido.meta.last_row_id as number;

  try {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const analise = await analisarBytes(c.env, bytes, arquivo.type, COACH_SYSTEM_PROMPT);

    await c.env.DB.prepare('DELETE FROM analyses WHERE video_id = ?').bind(videoId).run();
    await c.env.DB
      .prepare(
        `INSERT INTO analyses (video_id, user_id, nota_geral, resumo, pontos_fortes, pontos_melhorar, treino_sugerido, modelo_usado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        videoId,
        user!.id,
        analise.nota_geral,
        analise.resumo,
        JSON.stringify(analise.pontos_fortes),
        JSON.stringify(analise.pontos_melhorar),
        analise.treino_sugerido,
        c.env.IA_MODEL ?? 'gemini-2.0-flash',
      )
      .run();

    await c.env.DB.prepare("UPDATE videos SET status = 'analisado' WHERE id = ?").bind(videoId).run();

    return c.redirect(`/videos/${videoId}?msg=analisado`);
  } catch {
    // Sem guardar nada: o registro fica so como historico do erro.
    await c.env.DB.prepare("UPDATE videos SET status = 'erro' WHERE id = ?").bind(videoId).run();
    return c.redirect(`/videos/${videoId}?msg=erro_ia`);
  }
});

rotasVideos.get('/:id', async (c) => {
  const user = c.get('user');
  const guarda = exigirLogin(user);
  if (guarda) return guarda;

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();

  const video = await c.env.DB
    .prepare('SELECT id, titulo, status, enviado_em FROM videos WHERE id = ? AND user_id = ?')
    .bind(id, user!.id)
    .first<VideoRow>();
  if (!video) return c.redirect('/painel?msg=sem_video');

  const analise = await c.env.DB
    .prepare(
      'SELECT video_id, nota_geral, resumo, pontos_fortes, pontos_melhorar, treino_sugerido FROM analyses WHERE video_id = ?',
    )
    .bind(id)
    .first<AnaliseRow>();

  return c.html(
    <PaginaVideo
      user={user!}
      video={video}
      analise={analise}
      msg={c.req.query('msg')}
      csrf={emitirTokenCsrf(c)}
      iaAtiva={iaConfigurada(c.env)}
    />,
  );
});

// Apagar: sem arquivo guardado, some o registro e a analise.
rotasVideos.post('/:id/apagar', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/entrar');

  const id = Number(c.req.param('id'));
  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) return c.redirect(`/videos/${id}?msg=csrf`);

  const video = await c.env.DB
    .prepare('SELECT id FROM videos WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<{ id: number }>();
  if (!video) return c.redirect('/painel?msg=sem_video');

  await c.env.DB.prepare('DELETE FROM analyses WHERE video_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(id).run();

  return c.redirect('/painel?msg=video_apagado');
});