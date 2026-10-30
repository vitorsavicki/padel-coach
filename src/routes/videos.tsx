import { Hono } from 'hono';
import { exigirLogin, type Vars } from '../lib/session';
import { emitirTokenCsrf, csrfValido } from '../lib/csrf';
import { analisarQuadros, quadrosValidos, iaConfigurada, dicaParaErro } from '../ia';
import { podeAnalisar } from '../lib/plans';
import { COACH_SYSTEM_PROMPT } from '../prompt';
import type { Bindings } from '../lib/bindings';
import { PaginaNovoVideo } from '../pages/NovoVideo';
import { PaginaVideo } from '../pages/Video';

export const rotasVideos = new Hono<{ Bindings: Bindings; Variables: Vars }>();

export type VideoRow = {
  id: number;
  titulo: string | null;
  status: string;
  enviado_em: string;
  erro_motivo: string | null;
  // JSON com os quadros (data URLs) que o coach olhou, para o aluno ver
  // exatamente quais momentos geraram cada comentario.
  quadros: string | null;
};

export type AnaliseRow = {
  video_id: number;
  nota_geral: number | null;
  resumo: string | null;
  pontos_fortes: string | null;
  pontos_melhorar: string | null;
  treino_sugerido: string | null;
};

// O formulario com JS manda este cabecalho e espera JSON, para mostrar o
// progresso sem sair da pagina. Sem JS, o mesmo POST redireciona.
function querJson(c: { req: { header: (n: string) => string | undefined } }): boolean {
  return c.req.header('x-async') === '1';
}

const MSG_PADRAO = 'Nao conseguimos analisar agora. Tente de novo em alguns minutos.';

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

// O video NAO sobe. O navegador le o arquivo, extrai 6 quadros e manda so
// as imagens. O arquivo fica no celular do aluno.
rotasVideos.post('/novo', async (c) => {
  const json = querJson(c);
  const user = c.get('user');
  const guarda = exigirLogin(user);
  if (guarda) return guarda;

  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) {
    return json ? c.json({ ok: false, msg: 'Sua sessao expirou. Recarregue a pagina.' }) : c.redirect('/videos/novo?msg=csrf');
  }
  if (!iaConfigurada(c.env)) {
    return json ? c.json({ ok: false, msg: 'A analise ainda nao esta ligada.' }) : c.redirect('/videos/novo?msg=ia_off');
  }

  let quadros: unknown = null;
  try {
    quadros = JSON.parse(String(corpo['quadros'] ?? '[]'));
  } catch {
    quadros = null;
  }
  if (!quadrosValidos(quadros)) {
    return json
      ? c.json({ ok: false, msg: 'Nao consegui ler os quadros deste video. Tente outro arquivo mp4 ou mov.' })
      : c.redirect('/videos/novo?msg=quadros');
  }

  const titulo = String(corpo['titulo'] ?? '').trim().slice(0, 80) || 'Treino sem titulo';

  const limite = await podeAnalisar(c.env.DB, user!.id);
  // LIMITE DESLIGADO PARA TESTES. Para religar, troque por: if (!limite.ok) {
  if (false && !limite.ok) {
    return json
      ? c.json({ ok: false, msg: 'Voce chegou ao limite de analises do seu plano neste mes.' })
      : c.redirect('/videos/novo?msg=limite');
  }

  const inserido = await c.env.DB
    .prepare('INSERT INTO videos (user_id, r2_key, titulo, status, quadros) VALUES (?, ?, ?, ?, ?)')
    .bind(user!.id, 'so-quadros', titulo, 'processando', JSON.stringify(quadros))
    .run();
  const videoId = inserido.meta.last_row_id as number;

  try {
    const analise = await analisarQuadros(c.env, quadros, COACH_SYSTEM_PROMPT);

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
        c.env.IA_MODEL ?? 'gemini',
      )
      .run();

    await c.env.DB
      .prepare("UPDATE videos SET status = 'analisado', erro_motivo = NULL WHERE id = ?")
      .bind(videoId)
      .run();

    return json ? c.json({ ok: true, id: videoId }) : c.redirect(`/videos/${videoId}?msg=analisado`);
  } catch (e) {
    const motivo = e instanceof Error ? e.message.slice(0, 300) : 'falha desconhecida';

    // Analise que falhou NAO fica salva: o registro sai do banco para nao
    // poluir a lista de treinos com linhas "sem nota / falhou". O motivo
    // ainda chega ao aluno pela resposta, e ele pode enviar de novo.
    await c.env.DB.prepare('DELETE FROM analyses WHERE video_id = ?').bind(videoId).run();
    await c.env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(videoId).run();

    const aviso = dicaParaErro(motivo) ?? MSG_PADRAO;
    if (json) return c.json({ ok: false, msg: aviso });
    return c.redirect(`/videos/novo?msg=erro_ia`);
  }
});

rotasVideos.get('/:id', async (c) => {
  const user = c.get('user');
  const guarda = exigirLogin(user);
  if (guarda) return guarda;

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.notFound();

  const video = await c.env.DB
    .prepare('SELECT id, titulo, status, enviado_em, erro_motivo, quadros FROM videos WHERE id = ? AND user_id = ?')
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
