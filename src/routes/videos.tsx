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
// Mesmo teto do Gemini (inline_data): 14MB de video.
const LIMITE_MB = 14;

export type VideoRow = {
  id: number;
  titulo: string | null;
  status: string;
  enviado_em: string;
  erro_motivo: string | null;
};

export type AnaliseRow = {
  video_id: number;
  nota_geral: number | null;
  resumo: string | null;
  pontos_fortes: string | null;
  pontos_melhorar: string | null;
  treino_sugerido: string | null;
};

// A analise roda DEPOIS da resposta. Antes ela era aguardada no POST: um
// clipe de 2 minutos segurava o navegador e estourava o timeout do fetch
// ("The operation was aborted"). Agora o aluno cai na pagina do treino na
// hora e ela se atualiza sozinha enquanto o coach assiste.
async function processarVideo(
  env: Bindings,
  videoId: number,
  userId: number,
  bytes: Uint8Array,
  mime: string,
): Promise<void> {
  try {
    const analise = await analisarBytes(env, bytes, mime, COACH_SYSTEM_PROMPT);

    await env.DB.prepare('DELETE FROM analyses WHERE video_id = ?').bind(videoId).run();
    await env.DB
      .prepare(
        `INSERT INTO analyses (video_id, user_id, nota_geral, resumo, pontos_fortes, pontos_melhorar, treino_sugerido, modelo_usado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        videoId,
        userId,
        analise.nota_geral,
        analise.resumo,
        JSON.stringify(analise.pontos_fortes),
        JSON.stringify(analise.pontos_melhorar),
        analise.treino_sugerido,
        env.IA_MODEL ?? 'gemini',
      )
      .run();

    await env.DB
      .prepare("UPDATE videos SET status = 'analisado', erro_motivo = NULL WHERE id = ?")
      .bind(videoId)
      .run();
  } catch (e) {
    const motivo = e instanceof Error ? e.message.slice(0, 300) : 'falha desconhecida';
    await env.DB
      .prepare("UPDATE videos SET status = 'erro', erro_motivo = ? WHERE id = ?")
      .bind(motivo, videoId)
      .run();
  }
}

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

// Upload + inicio da analise. O video nao e guardado em lugar nenhum.
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

  // Os bytes saem do Request agora, porque depois da resposta ele nao existe.
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const mime = arquivo.type;

  // Aguardado aqui, nao em waitUntil: depois da resposta o runtime cancela
  // o fetch de saida e o erro virava "The operation was aborted". O POST
  // demora, mas o resultado chega.
  await processarVideo(c.env, videoId, user!.id, bytes, mime);

  return c.redirect(`/videos/${videoId}`);
});

rotasVideos.get('/:id', async (c) => {
  const user = c.get('user');
  const guarda = exigirLogin(user);
  if (guarda) return guarda;

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();

  const video = await c.env.DB
    .prepare('SELECT id, titulo, status, enviado_em, erro_motivo FROM videos WHERE id = ? AND user_id = ?')
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

// Refazer a analise de um treino que ja existe.
rotasVideos.post('/:id/reanalisar', async (c) => {
  const user = c.get('user');
  const guarda = exigirLogin(user);
  if (guarda) return guarda;

  const id = Number(c.req.param('id'));
  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) return c.redirect(`/videos/${id}?msg=csrf`);

  // Sem o arquivo guardado nao ha o que reanalisar: manda enviar de novo.
  return c.redirect('/videos/novo?msg=reenviar');
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
