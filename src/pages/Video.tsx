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
  iaAtiva,
}: {
  user: User;
  video: VideoRow;
  analise: AnaliseRow | null;
  msg?: string;
  csrf: string;
  iaAtiva: boolean;
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
          </>
        ) : (
          <>
            <p class="sub">
              {video.status === 'processando'
                ? 'O coach esta assistindo seu video.'
                : video.status === 'erro'
                  ? 'Nao conseguimos analisar esse video. Tente enviar de novo.'
                  : 'Esse treino ainda nao tem analise.'}
            </p>
            {iaAtiva ? (
              <a class="btn btn-pri btn-largo" href="/videos/novo">Enviar outro video</a>
            ) : (
              <div class="flash">A analise automatica esta em finalizacao. Veja uma <a href="/exemplo">analise de exemplo</a>.</div>
            )}
          </>
        )}

        <p style="color:var(--cinza);font-size:.88rem;margin-top:22px">
          Seu video nao fica guardado: depois da analise, o arquivo e descartado.
        </p>

        <form method="post" action={`/videos/${video.id}/apagar`} style="margin-top:10px">
          <input type="hidden" name="csrf" value={csrf} />
          <button class="btn btn-sec btn-mini" type="submit"
            onclick="return confirm('Apagar esta analise? Nao tem como recuperar depois.')">
            Apagar este treino
          </button>
        </form>

        <p class="troca"><a href="/painel">Voltar para meus treinos</a></p>
      </section>
    </Layout>
  );
}
