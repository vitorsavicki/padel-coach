import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';
import { Mascote } from './Mascote';

// Painel: a lista de treinos e o centro. Nota grande a esquerda, titulo no
// meio, acao a direita. No celular tudo empilha e o botao ocupa a largura.
const CSS_DASH = `
.painel{max-width:940px;margin:0 auto;padding:36px 20px 64px}
.painel-topo{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:26px}
.painel-topo h1{font-size:1.9rem;letter-spacing:-.02em;margin:0 0 4px}
.painel-topo p{margin:0;color:var(--cinza);font-size:.98rem}

.resumo{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:26px}
.bloco-num{background:#fff;border:1px solid var(--borda);border-radius:16px;padding:18px 16px;position:relative;overflow:hidden;box-shadow:var(--sombra-1)}
.bloco-num::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--quadra)}
.bloco-num .rotulo{display:block;font-size:.72rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#7d938c;margin-bottom:6px}
.bloco-num .valor{font-size:2.3rem;font-weight:800;line-height:1;letter-spacing:-.04em;color:var(--quadra-esc)}
.bloco-num .valor small{font-size:.85rem;font-weight:600;color:var(--cinza);letter-spacing:0}

.secao-titulo{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 0 12px}
.secao-titulo h2{font-size:1.12rem;margin:0;letter-spacing:-.01em}
.secao-titulo span{font-size:.84rem;color:var(--cinza)}

.treinos{display:grid;gap:12px}
.treino{display:grid;grid-template-columns:76px 1fr auto;align-items:center;gap:16px;background:#fff;border:1px solid var(--borda);border-radius:16px;padding:14px 16px;box-shadow:var(--sombra-1);transition:transform .15s ease,box-shadow .15s ease}
.treino:hover{transform:translateY(-2px);box-shadow:var(--sombra-2)}

.nota{width:76px;height:76px;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--quadra-clara);color:var(--quadra-esc);line-height:1}
.nota b{font-size:1.55rem;font-weight:800;letter-spacing:-.03em}
.nota i{font-style:normal;font-size:.62rem;font-weight:700;opacity:.75;margin-top:3px;letter-spacing:.04em;text-transform:uppercase}
.nota.vazia{background:#f1f5f3;color:#94a8a1}
.nota.falhou{background:#fdecec;color:#8f2626}

.treino-info{min-width:0}
.treino-info h3{margin:0 0 6px;font-size:1.02rem;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.82rem;color:var(--cinza)}
.selo{font-size:.68rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;border-radius:999px;background:#eef4f1;color:#2c4740}
.selo.analisado{background:#e8f8ef;color:#14663c}
.selo.erro{background:#fdecec;color:#8f2626}
.selo.processando{background:#fff8e1;color:#7a5a00}

.vazio{text-align:center;padding:34px 18px;background:#fff;border:1px dashed var(--borda);border-radius:18px}
.vazio p{color:var(--cinza);margin:10px 0 16px}

.grafico{background:#fff;border:1px solid var(--borda);border-radius:16px;padding:18px;margin-bottom:26px;box-shadow:var(--sombra-1)}
.grafico h2{font-size:1rem;margin:0 0 2px}
.grafico p{margin:0 0 8px;font-size:.84rem;color:var(--cinza)}

@media (max-width:640px){
  .painel{padding:24px 16px 48px}
  .resumo{grid-template-columns:1fr;gap:10px}
  .bloco-num{display:flex;align-items:center;justify-content:space-between;padding:14px 16px}
  .bloco-num .rotulo{margin:0}
  .bloco-num .valor{font-size:1.8rem}
  .treino{grid-template-columns:60px 1fr;gap:12px;padding:12px}
  .nota{width:60px;height:60px;border-radius:16px}
  .nota b{font-size:1.25rem}
  .treino .btn{grid-column:1 / -1;width:100%;margin-top:4px}
}
`;

export type PontoEvolucao = { rotulo: string; nota: number };

type VideoItem = {
  id: number;
  titulo: string | null;
  status: string;
  nota: number | null;
  enviado_em?: string;
};

const NOMES_STATUS: Record<string, string> = {
  analisado: 'analisado',
  erro: 'falhou',
  processando: 'analisando',
  enviado: 'enviado',
};

function dataCurta(iso?: string): string {
  if (!iso) return '';
  const p = iso.slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso.slice(0, 10);
}

function classeSelo(s: string): string {
  if (s === 'analisado') return 'selo analisado';
  if (s === 'erro') return 'selo erro';
  if (s === 'processando') return 'selo processando';
  return 'selo';
}

export function Dashboard({
  user,
  videos,
  pontos,
  usadas,
  msg,
}: {
  user: User;
  videos: VideoItem[];
  pontos: PontoEvolucao[];
  usadas?: number;
  csrf?: string;
  msg?: string;
}) {
  const analisados = videos.filter((v) => v.nota !== null).length;
  const media = pontos.length > 0 ? pontos.reduce((s, p) => s + p.nota, 0) / pontos.length : 0;

  return (
    <Layout titulo="Meus treinos - Padel Coach IA" user={user} cssExtra={CSS_DASH}>
      <section class="painel">
        <div class="painel-topo">
          <div>
            <h1>Oi, {user.nome.split(' ')[0]}!</h1>
            <p>Seu progresso na quadra, treino a treino.</p>
          </div>
          <a class="btn btn-pri" href="/videos/novo">+ Novo treino</a>
        </div>
        {barraMsg(msg)}

        <div class="resumo">
          <div class="bloco-num">
            <span class="rotulo">Treinos</span>
            <span class="valor">{videos.length}</span>
          </div>
          <div class="bloco-num">
            <span class="rotulo">Analisados</span>
            <span class="valor">{analisados}</span>
          </div>
          <div class="bloco-num">
            <span class="rotulo">Analises</span>
            <span class="valor">{usadas ?? 0}</span>
          </div>
          <div class="bloco-num">
            <span class="rotulo">Nota media</span>
            <span class="valor">
              {media > 0 ? media.toFixed(1) : '—'}
              {media > 0 ? <small> /10</small> : null}
            </span>
          </div>
        </div>

        {pontos.length > 1 ? <GraficoEvolucao pontos={pontos} /> : null}

        <div class="secao-titulo">
          <h2>Seus treinos</h2>
          {videos.length > 0 ? <span>{videos.length} no total</span> : null}
        </div>

        {videos.length === 0 ? (
          <div class="vazio">
            <Mascote humor="feliz" size={88} />
            <p>Nenhum treino enviado ainda. O primeiro leva menos de 2 minutos.</p>
            <a class="btn btn-pri" href="/videos/novo">Enviar meu primeiro video</a>
          </div>
        ) : (
          <div class="treinos">
            {videos.map((v) => {
              const semNota = v.nota === null;
              const classeNota = semNota
                ? v.status === 'erro'
                  ? 'nota falhou'
                  : 'nota vazia'
                : 'nota';
              return (
                <article class="treino">
                  <div class={classeNota}>
                    <b>{semNota ? '—' : v.nota!.toFixed(1)}</b>
                    <i>{semNota ? 'sem nota' : 'de 10'}</i>
                  </div>
                  <div class="treino-info">
                    <h3>{v.titulo ?? 'Treino'}</h3>
                    <div class="meta">
                      <span class={classeSelo(v.status)}>
                        {NOMES_STATUS[v.status] ?? v.status}
                      </span>
                      {v.enviado_em ? <span>{dataCurta(v.enviado_em)}</span> : null}
                    </div>
                  </div>
                  <a class="btn btn-sec btn-mini" href={`/videos/${v.id}`}>
                    {v.status === 'processando' ? 'Acompanhar' : 'Abrir'}
                  </a>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </Layout>
  );
}

// Grafico simples em SVG inline, sem lib pesada.
function GraficoEvolucao({ pontos }: { pontos: PontoEvolucao[] }) {
  const W = 620;
  const H = 160;
  const PAD = 26;
  const passoX = pontos.length > 1 ? (W - PAD * 2) / (pontos.length - 1) : 0;

  const coords = pontos.map((p, i) => ({
    x: PAD + i * passoX,
    y: H - PAD - (p.nota / 10) * (H - PAD * 2),
  }));
  const linha = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const ultimo = coords[coords.length - 1];
  const area = `${PAD},${H - PAD} ${linha} ${ultimo ? ultimo.x.toFixed(1) : PAD},${H - PAD}`;

  return (
    <div class="grafico">
      <h2>Evolucao da nota</h2>
      <p>Cada ponto e um treino analisado, do mais antigo ao mais recente.</p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="160" role="img"
        aria-label="Grafico de evolucao das notas, de 0 a 10">
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#d7e5df" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#d7e5df" />
        {[0, 5, 10].map((n) => {
          const y = H - PAD - (n / 10) * (H - PAD * 2);
          return (
            <g>
              <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#eef4f1" />
              <text x={2} y={y + 4} font-size="10" fill="#7d938c">{n}</text>
            </g>
          );
        })}
        <polygon points={area} fill="rgba(15,118,110,.12)" />
        <polyline points={linha} fill="none" stroke="#0f766e" stroke-width="2.5"
          stroke-linejoin="round" stroke-linecap="round" />
        {coords.map((c) => (
          <circle cx={c.x} cy={c.y} r="4" fill="#d9f24a" stroke="#0f766e" stroke-width="2" />
        ))}
      </svg>
    </div>
  );
}
