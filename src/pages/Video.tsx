import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';
import { Mascote, type Humor } from './Mascote';
import type { VideoRow, AnaliseRow } from '../routes/videos';
import { dicaParaErro } from '../ia';

const CSS_VIDEO = `
.topo-analise{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;margin:8px 0 4px}
.nota-caixa{text-align:center}
.nota-caixa .num{font-size:4.6rem;line-height:.9;font-weight:800;color:var(--quadra);letter-spacing:-.05em}
.nota-caixa .de{font-size:.95rem;color:var(--cinza);font-weight:600;margin-top:2px}
.nota-caixa .etiqueta{display:inline-block;margin-top:8px;font-size:.78rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:4px 11px;border-radius:999px;background:var(--quadra-clara);color:var(--quadra-esc)}
.resumo{text-align:center;max-width:560px;margin:16px auto 0;color:#2c4740;font-size:1.02rem}
.bloco{text-align:left;margin-top:22px}
.bloco h3{display:flex;align-items:center;gap:8px;font-size:1.02rem;margin-bottom:8px}
.bloco h3 .marca{width:10px;height:10px;border-radius:50%;background:var(--quadra)}
.bloco.melhorar h3 .marca{background:#e0a800}
.lista{list-style:none;padding:0;margin:0;display:grid;gap:9px}
.lista li{display:flex;gap:10px;font-size:.96rem;color:#2c4740;line-height:1.5}
.lista li::before{content:'';flex:none;width:7px;height:7px;border-radius:50%;margin-top:8px;background:var(--quadra)}
.bloco.melhorar .lista li::before{background:#e0a800}
.treino{background:var(--quadra-clara);border-radius:16px;padding:20px;margin-top:22px;text-align:left}
.treino h3{margin-bottom:6px}
.status{display:inline-block;font-size:.74rem;font-weight:800;letter-spacing:.04em;padding:4px 11px;border-radius:999px;background:#eef4f1;color:#2c4740;text-transform:uppercase}
.status.analisado{background:#e8f8ef;color:#14663c}
.status.erro{background:#fdecec;color:#8f2626}
.status.processando{background:#fff8e1;color:#7a5a00}
.aguarde{text-align:center;padding:26px 12px}
.aguarde .bola{width:42px;height:42px;margin:0 auto 14px;border-radius:50%;border:4px solid var(--quadra-clara);border-top-color:var(--quadra);animation:gira 1s linear infinite}
@keyframes gira{to{transform:rotate(360deg)}}
.acoes{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:26px}
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

function classeStatus(s: string): string {
  if (s === 'analisado') return 'status analisado';
  if (s === 'erro') return 'status erro';
  if (s === 'processando') return 'status processando';
  return 'status';
}

function etiquetaNota(nota: number): string {
  if (nota >= 8) return 'Jogo forte';
  if (nota >= 6.5) return 'Bom caminho';
  if (nota >= 5) return 'Na media';
  return 'Para treinar';
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
  const nota = analise?.nota_geral ?? 0;
  const humor: Humor = analise ? (nota >= 7 ? 'feliz' : nota >= 5 ? 'neutro' : 'triste') : processando ? 'analisando' : 'triste';

  return (
    <Layout titulo={`${video.titulo ?? 'Treino'} - Padel Coach IA`} user={user} cssExtra={CSS_VIDEO}>
      <section class="pagina" style="max-width:760px">
        {processando ? (
          <script dangerouslySetInnerHTML={{ __html: 'setTimeout(function(){location.reload()},6000)' }} />
        ) : null}

        <h1 style="text-align:center">{video.titulo ?? 'Treino'}</h1>
        <p class="sub" style="text-align:center">
          <span class={classeStatus(video.status)}>{video.status === 'erro' ? 'falhou' : video.status}</span>{' '}
          enviado em {video.enviado_em}
        </p>
        {barraMsg(msg)}

        {analise ? (
          <>
            <div class="topo-analise">
              <Mascote humor={humor} size={110} />
              <div class="nota-caixa">
                <div class="num">{nota.toFixed(1)}</div>
                <div class="de">de 10</div>
                <div class="etiqueta">{etiquetaNota(nota)}</div>
              </div>
            </div>
            <p class="resumo">{analise.resumo}</p>

            <div class="card bloco">
              <h3><span class="marca" /> Pontos fortes</h3>
              <ul class="lista">{fortes.map((p) => <li>{p}</li>)}</ul>
            </div>

            <div class="card bloco melhorar">
              <h3><span class="marca" /> O que melhorar</h3>
              <ul class="lista">{melhorar.map((p) => <li>{p}</li>)}</ul>
            </div>

            {analise.treino_sugerido ? (
              <div class="treino">
                <h3>Treino da semana</h3>
                <p>{analise.treino_sugerido}</p>
              </div>
            ) : null}
          </>
        ) : processando ? (
          <div class="aguarde">
            <Mascote humor="analisando" size={100} />
            <p style="margin-top:10px"><strong>O coach esta assistindo seu treino.</strong></p>
            <p class="sub">Esta pagina se atualiza sozinha.</p>
          </div>
        ) : (
          <>
            <div style="display:flex;justify-content:center;margin:18px 0">
              <Mascote humor="triste" size={104} />
            </div>
            <p class="sub" style="text-align:center">
              {video.status === 'erro' ? 'Nao conseguimos analisar esse treino.' : 'Esse treino ainda nao tem analise.'}
            </p>
            {video.status === 'erro' && video.erro_motivo ? (
              <div class="flash erro" style="text-align:left;font-size:.9rem">
                {dicaParaErro(video.erro_motivo) ? (
                  <><strong>O que fazer:</strong> {dicaParaErro(video.erro_motivo)}<br /></>
                ) : null}
                <span style="font-size:.78rem;opacity:.75">Detalhe tecnico: {video.erro_motivo}</span>
              </div>
            ) : null}
            {iaAtiva ? (
              <div class="acoes">
                <a class="btn btn-pri" href="/videos/novo">Enviar de novo</a>
              </div>
            ) : (
              <div class="flash">A analise automatica esta em finalizacao. Veja uma <a href="/exemplo">analise de exemplo</a>.</div>
            )}
          </>
        )}

        <p style="color:var(--cinza);font-size:.86rem;margin-top:26px;text-align:center">
          Seu video nao fica guardado: ele nunca saiu do seu aparelho. Guardamos so a nota e o feedback.
        </p>

        <div class="acoes">
          <a class="btn btn-sec btn-mini" href="/painel">Meus treinos</a>
          <form method="post" action={`/videos/${video.id}/apagar`} style="display:inline">
            <input type="hidden" name="csrf" value={csrf} />
            <button class="btn btn-sec btn-mini" type="submit"
              onclick="return confirm('Apagar esta analise? Nao tem como recuperar depois.')">
              Apagar
            </button>
          </form>
        </div>
      </section>
    </Layout>
  );
}
