import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';
import type { VideoRow, AnaliseRow } from '../routes/videos';

const CSS_VIDEO = `
.nota-grande{display:flex;align-items:baseline;gap:6px;justify-content:center;margin:18px 0}
.nota-grande strong{font-size:3.6rem;line-height:1;color:var(--quadra);letter-spacing:-.03em}
.nota-grande span{font-size:1.1rem;color:var(--cinza)}
.lista{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:8px}
.lista li{display:flex;gap:10px;font-size:.96rem;color:#2c4740}
.lista li::before{content:'';flex:none;width:8px;height:8px;border-radius:50%;margin-top:7px;background:var(--quadra)}
.lista.melhorar li::before{background:#e0a800}
.treino{background:var(--quadra-clara);border-radius:14px;padding:18px;margin-top:16px}
.status{display:inline-block;font-size:.78rem;font-weight:700;padding:4px 10px;border-radius:999px;background:#e8f0ed;color:#2c4740}
`;

function parseLista(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function PaginaVideo({
  user,
  video,
  analise,
  msg,
  csrf,
  podeAnalisar,
}: {
  user: User;
  video: VideoRow;
  analise: AnaliseRow | null;
  msg?: string;
  csrf: string;
  podeAnalisar: boolean;
}) {
  const fortes = parseLista(analise?.pontos_fortes ?? null);
  const melhorar = parseLista(analise?.pontos_melhorar ?? null);

  return (
    <Layout titulo={`${video.titulo ?? 'Treino'} - Padel Coach IA`} user={user} cssExtra={CSS_VIDEO}>
      <section class="pagina">
        <h1>{video.titulo ?? 'Treino'}</h1>
        <p class="sub">
          <span class="status">{video.status}</span> enviado em {video.enviado_em}
        </p>
        {barraMsg(msg)}

        {analise ? (
          <>
            <div class="nota-grande">
              <strong>{(analise.nota_geral ?? 0).toFixed(1)}</strong>
              <span>/ 10</span>
            </div>
            <p class="sub" style="text-align:center">{analise.resumo}</p>

            <div class="grid" style="margin-top:24px">
              <div class="card">
                <h3>Pontos fortes</h3>
                <ul class="lista">{fortes.map((p) => <li>{p}</li>)}</ul>
              </div>
              <div class="card">
                <h3>O que melhorar</h3>
                <ul class="lista melhorar">{melhorar.map((p) => <li>{p}</li>)}</ul>
              </div>
            </div>

            {analise.treino_sugerido ? (
              <div class="treino">
                <h3>Treino da semana</h3>
                <p>{analise.treino_sugerido}</p>
              </div>
            ) : null}

            <form method="post" action={`/videos/${video.id}/analisar`} style="margin-top:20px">
              <input type="hidden" name="csrf" value={csrf} />
              <button class="btn btn-sec" type="submit">Analisar de novo</button>
            </form>
          </>
        ) : (
          <>
            <p class="sub">
              {video.status === 'processando'
                ? 'O coach esta assistindo seu video. Isso leva alguns minutos.'
                : 'Seu video esta guardado. Peça a analise quando quiser.'}
            </p>
            {podeAnalisar ? (
              <form method="post" action={`/videos/${video.id}/analisar`}>
                <input type="hidden" name="csrf" value={csrf} />
                <button class="btn btn-pri btn-largo" type="submit" disabled={video.status === 'processando'}>
                  {video.status === 'processando' ? 'Analisando...' : 'Analisar com o coach'}
                </button>
              </form>
            ) : (
              <div class="flash">A analise automatica esta em finalizacao. Avisamos quando estiver pronta.</div>
            )}
          </>
        )}

        <form method="post" action={`/videos/${video.id}/apagar`} style="margin-top:10px">
          <input type="hidden" name="csrf" value={csrf} />
          <button class="btn btn-sec btn-mini" type="submit"
            onclick="return confirm('Apagar este video e a analise dele? Nao tem como recuperar depois.')">
            Apagar este video
          </button>
        </form>

        <p class="troca"><a href="/painel">Voltar para meus treinos</a></p>
      </section>
    </Layout>
  );
}
