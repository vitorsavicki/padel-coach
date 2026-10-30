import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';
import type { VideoRow, AnaliseRow } from '../routes/videos';
import { dicaParaErro } from '../ia';

const CSS_VIDEO = `
.nota-grande{display:flex;align-items:baseline;gap:8px;justify-content:center;margin:20px 0 6px}
.nota-grande strong{font-size:4.4rem;line-height:1;color:var(--quadra);letter-spacing:-.04em}
.nota-grande span{font-size:1.1rem;color:var(--cinza)}
.lista{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:9px}
.lista li{display:flex;gap:10px;font-size:.96rem;color:#2c4740}
.lista li::before{content:'';flex:none;width:8px;height:8px;border-radius:50%;margin-top:7px;background:var(--quadra)}
.lista.melhorar li::before{background:#e0a800}
.treino{background:var(--quadra-clara);border-radius:14px;padding:20px;margin-top:18px}
.status{display:inline-block;font-size:.76rem;font-weight:800;letter-spacing:.03em;padding:4px 11px;border-radius:999px;background:#eef4f1;color:#2c4740;text-transform:uppercase}
.status.analisado{background:#e8f8ef;color:#14663c}
.status.erro{background:#fdecec;color:#8f2626}
.status.processando{background:#fff8e1;color:#7a5a00}
.aguarde{text-align:center;padding:34px 16px}
.aguarde .bola{width:44px;height:44px;margin:0 auto 16px;border-radius:50%;border:4px solid var(--quadra-clara);border-top-color:var(--quadra);animation:gira 1s linear infinite}
@keyframes gira{to{transform:rotate(360deg)}}
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

function statusClasse(s: string): string {
  if (s === 'analisado') return 'status analisado';
  if (s === 'erro') return 'status erro';
  if (s === 'processando') return 'status processando';
  return 'status';
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
  const processando = video.status === 'processando';

  return (
    <Layout titulo={`${video.titulo ?? 'Treino'} - Padel Coach IA`} user={user} cssExtra={CSS_VIDEO}>
      <section class="pagina">
        {processando ? (
          <script
            dangerouslySetInnerHTML={{ __html: 'setTimeout(function(){location.reload()},6000)' }}
          />
        ) : null}

        <h1>{video.titulo ?? 'Treino'}</h1>
        <p class="sub">
          <span class={statusClasse(video.status)}>{video.status}</span>{' '}
          enviado em {video.enviado_em}
        </p>
        {barraMsg(msg)}

        {analise ? (
          <>
            <div class="nota-grande">
              <strong>{(analise.nota_geral ?? 0).toFixed(1)}</strong>
              <span>/ 10</span>
            </div>
            <p class="sub" style="text-align:center;max-width:560px;margin:0 auto">{analise.resumo}</p>

            <div class="grid" style="margin-top:26px;text-align:left">
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
              <div class="treino" style="text-align:left">
                <h3>Treino da semana</h3>
                <p>{analise.treino_sugerido}</p>
              </div>
            ) : null}
          </>
        ) : processando ? (
          <div class="aguarde">
            <div class="bola" />
            <p><strong>O coach esta assistindo seu video.</strong></p>
            <p class="sub">Leva de 30 segundos a 2 minutos. Esta pagina se atualiza sozinha.</p>
          </div>
        ) : (
          <>
            <p class="sub">
              {video.status === 'erro'
                ? 'Nao conseguimos analisar esse video.'
                : 'Esse treino ainda nao tem analise.'}
            </p>
            {video.status === 'erro' && video.erro_motivo ? (
              <div class="flash erro" style="text-align:left;font-size:.9rem">
                {dicaParaErro(video.erro_motivo) ? (
                  <>
                    <strong>O que fazer:</strong> {dicaParaErro(video.erro_motivo)}
                    <br />
                  </>
                ) : null}
                <span style="font-size:.78rem;opacity:.75">Detalhe tecnico: {video.erro_motivo}</span>
              </div>
            ) : null}
            {iaAtiva ? (
              <a class="btn btn-pri btn-largo" href="/videos/novo">Enviar de novo</a>
            ) : (
              <div class="flash">
                A analise automatica esta em finalizacao. Veja uma <a href="/exemplo">analise de exemplo</a>.
              </div>
            )}
          </>
        )}

        <p style="color:var(--cinza);font-size:.88rem;margin-top:24px">
          Seu video nao fica guardado: depois da analise, o arquivo e descartado.
        </p>

        <form method="post" action={`/videos/${video.id}/apagar`} style="margin-top:10px">
          <input type="hidden" name="csrf" value={csrf} />
          <button
            class="btn btn-sec btn-mini"
            type="submit"
            onclick="return confirm('Apagar esta analise? Nao tem como recuperar depois.')"
          >
            Apagar este treino
          </button>
        </form>

        <p class="troca"><a href="/painel">Voltar para meus treinos</a></p>
      </section>
    </Layout>
  );
}
