import { Hono } from 'hono';
import { exigirLogin, type Vars } from '../lib/session';
import { emitirTokenCsrf, csrfValido } from '../lib/csrf';
import { analisarVideo, iaConfigurada } from '../ia';
import { podeAnalisar } from '../lib/plans';
import { COACH_SYSTEM_PROMPT } from '../prompt';
import type { Bindings } from '../lib/bindings';
import { PaginaNovoVideo } from '../pages/NovoVideo';
import { PaginaVideo } from '../pages/Video';

export const rotasVideos = new Hono<{ Bindings: Bindings; Variables: Vars }>();

const TIPOS_OK = new Set(['video/mp4', 'video/quicktime', 'video/x-m4v']);
const LIMITE_MB = 100;

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
      r2Ativo={Boolean(c.env.VIDEOS)}
    />,
  );
});

rotasVideos.post('/novo', async (c) => {
  const user = c.get('user');
  const guarda = exigirLogin(user);
  if (guarda) return guarda;

  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) return c.redirect('/videos/novo?msg=csrf');

  if (!c.env.VIDEOS) return c.redirect('/videos/novo?msg=r2_off');

  const arquivo = corpo['video'];
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return c.redirect('/videos/novo?msg=arquivo');
  }
  if (!TIPOS_OK.has(arquivo.type)) return c.redirect('/videos/novo?msg=tipo');
  if (arquivo.size > LIMITE_MB * 1024 * 1024) return c.redirect('/videos/novo?msg=tamanho');

  const titulo = String(corpo['titulo'] ?? '').trim().slice(0, 80) || 'Treino sem titulo';

  const inserido = await c.env.DB
    .prepare('INSERT INTO videos (user_id, r2_key, titulo, status) VALUES (?, ?, ?, ?)')
    .bind(user!.id, 'pendente', titulo, 'enviado')
    .run();
  const videoId = inserido.meta.last_row_id as number;
  const r2Key = `u${user!.id}/v${videoId}.mp4`;

  try {
    await c.env.VIDEOS.put(r2Key, arquivo.stream(), {
      httpMetadata: { contentType: arquivo.type },
    });
  } catch {
    await c.env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(videoId).run();
    return c.redirect('/videos/novo?msg=falhou');
  }

  await c.env.DB.prepare('UPDATE videos SET r2_key = ? WHERE id = ?').bind(r2Key, videoId).run();
  return c.redirect(`/videos/${videoId}`);
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
    .prepare('SELECT video_id, nota_geral, resumo, pontos_fortes, pontos_melhorar, treino_sugerido FROM analyses WHERE video_id = ?')
    .bind(id)
    .first<AnaliseRow>();

  return c.html(
    <PaginaVideo
      user={user!}
      video={video}
      analise={analise}
      msg={c.req.query('msg')}
      csrf={emitirTokenCsrf(c)}
      podeAnalisar={iaConfigurada(c.env)}
    />,
  );
});

rotasVideos.post('/:id/analisar', async (c) => {
  const user = c.get('user');
  const guarda = exigirLogin(user);
  if (guarda) return guarda;

  const id = Number(c.req.param('id'));
  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) return c.redirect(`/videos/${id}?msg=csrf`);

  const video = await c.env.DB
    .prepare('SELECT id, status FROM videos WHERE id = ? AND user_id = ?')
    .bind(id, user!.id)
    .first<{ id: number; status: string }>();
  if (!video) return c.redirect('/painel?msg=sem_video');
  if (video.status === 'processando') return c.redirect(`/videos/${id}?msg=processando`);

  if (!iaConfigurada(c.env)) return c.redirect(`/videos/${id}?msg=ia_off`);

  // Limite do plano: conta as analises do mes antes de gastar a chamada da IA.
  const limite = await podeAnalisar(c.env.DB, user!.id);
  if (!limite.ok) return c.redirect(`/videos/${id}?msg=limite`);

  await c.env.DB.prepare("UPDATE videos SET status = 'processando' WHERE id = ?").bind(id).run();

  try {
    const r2Key = await c.env.DB
      .prepare('SELECT r2_key FROM videos WHERE id = ?')
      .bind(id)
      .first<{ r2_key: string }>();
    if (!r2Key) throw new Error('r2_key ausente');

    const analise = await analisarVideo(c.env, r2Key.r2_key, COACH_SYSTEM_PROMPT);

    await c.env.DB.prepare('DELETE FROM analyses WHERE video_id = ?').bind(id).run();
    await c.env.DB
      .prepare(
        `INSERT INTO analyses (video_id, user_id, nota_geral, resumo, pontos_fortes, pontos_melhorar, treino_sugerido, modelo_usado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        user!.id,
        analise.nota_geral,
        analise.resumo,
        JSON.stringify(analise.pontos_fortes),
        JSON.stringify(analise.pontos_melhorar),
        analise.treino_sugerido,
        c.env.IA_MODEL ?? 'desconhecido',
      )
      .run();
    await c.env.DB.prepare("UPDATE videos SET status = 'analisado' WHERE id = ?").bind(id).run();

    return c.redirect(`/videos/${id}?msg=analisado`);
  } catch {
    await c.env.DB.prepare("UPDATE videos SET status = 'erro' WHERE id = ?").bind(id).run();
    return c.redirect(`/videos/${id}?msg=erro_ia`);
  }
});

// Apagar um video: sai do R2 e do banco na hora (dado sensivel, sem lixeira).
rotasVideos.post('/:id/apagar', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/entrar');

  const id = Number(c.req.param('id'));
  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) return c.redirect(`/videos/${id}?msg=csrf`);

  const video = await c.env.DB
    .prepare('SELECT r2_key FROM videos WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<{ r2_key: string }>();
  if (!video) return c.redirect('/painel?msg=sem_video');

  if (c.env.VIDEOS && video.r2_key && video.r2_key !== 'pendente') {
    try {
      await c.env.VIDEOS.delete(video.r2_key);
    } catch {
      // objeto pode ja ter sido removido; segue a limpeza do banco
    }
  }

  await c.env.DB.prepare('DELETE FROM analyses WHERE video_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(id).run();

  return c.redirect('/painel?msg=video_apagado');
});
