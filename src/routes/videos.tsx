import { Hono } from 'hono';
import { exigirLogin, type User, type Vars } from '../lib/session';
import { emitirTokenCsrf, csrfValido } from '../lib/csrf';
import { analisarQuadros, quadrosValidos, iaConfigurada, dicaParaErro } from '../ia';
import { podeAnalisar } from '../lib/plans';
import { lerPerfil, perfilParaPrompt } from '../lib/perfil';
import { COACH_SYSTEM_PROMPT } from '../prompt';
import type { Bindings } from '../lib/bindings';
import { PaginaNovoVideo } from '../pages/NovoVideo';
import { PaginaVideo } from '../pages/Video';

export const rotasVideos = new Hono<{ Bindings: Bindings; Variables: Vars }>();

// Monta o system prompt do coach com contexto vivo: o perfil do jogador
// (coluna users.perfil, editavel em /perfil) e o historico recente de
// analises, para o coach comparar treinos e acompanhar a evolucao em vez de
// analisar cada video no escuro. Sem perfil ou sem historico, o prompt base
// continua valendo.
async function montarPromptComContexto(env: Bindings, user: User): Promise<string> {
  let prompt = COACH_SYSTEM_PROMPT;

  // Perfil por conta: nome da conta + dados tecnicos que o aluno preencheu
  // em /perfil. Nunca usar um perfil global, senao todo aluno vira a mesma
  // pessoa e o coach inventa mao, categoria e meta.
  prompt += `\n\nPERFIL DO JOGADOR\n${perfilParaPrompt(user.nome, lerPerfil(user.perfil))}`;

  try {
    const { results } = await env.DB.prepare(
      `SELECT a.nota_geral, a.pontos_melhorar, v.enviado_em
       FROM analyses a JOIN videos v ON v.id = a.video_id
       WHERE a.user_id = ? AND v.status = 'analisado'
       ORDER BY a.video_id DESC LIMIT 5`,
    )
      .bind(user.id)
      .all<{ nota_geral: number; pontos_melhorar: string; enviado_em: string | null }>();
    const linhas = (results ?? []).reverse().map((r) => {
      const partes = String(r.enviado_em ?? '').slice(0, 10).split('-');
      const data = partes.length === 3 ? `${partes[2]}/${partes[1]}` : 'sem data';
      let problema = '';
      try {
        const arr = JSON.parse(r.pontos_melhorar);
        if (Array.isArray(arr) && typeof arr[0] === 'string') {
          problema = ` Melhorar: ${arr[0].slice(0, 140)}`;
        }
      } catch {
        /* historico ilegivel nao quebra nada */
      }
      return `- ${data}: nota ${r.nota_geral}.${problema}`;
    });
    if (linhas.length > 0) {
      prompt += `\n\nHISTORICO RECENTE DO JOGADOR (do mais antigo ao mais novo)\n${linhas.join('\n')}`;
    }
  } catch {
    /* sem historico, o prompt base ja basta */
  }
  return prompt;
}

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
  if (!limite.ok) {
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
    const systemPrompt = await montarPromptComContexto(c.env, user!);
    const analise = await analisarQuadros(c.env, quadros, systemPrompt);

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
