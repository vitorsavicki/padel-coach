import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';

const CSS_DASH = `
.dash-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.dash-head h1{margin:0}
.metricas{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px}
.metrica{text-align:center;padding:18px 12px}
.metrica h3{color:var(--cinza);font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
.metrica .num{font-size:2.2rem;font-weight:800;color:var(--quadra);letter-spacing:-.03em;line-height:1}
.metrica .num small{font-size:.9rem;color:var(--cinza);font-weight:600}
.lista-videos{display:grid;gap:12px;margin-top:12px}
.linha{display:flex;align-items:center;gap:16px;text-align:left;padding:14px 18px}
.nota-badge{flex:none;width:60px;height:60px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--quadra-clara);border:2px solid var(--quadra);color:var(--quadra-esc);line-height:1}
.nota-badge b{font-size:1.25rem;font-weight:800;letter-spacing:-.02em}
.nota-badge i{font-style:normal;font-size:.62rem;opacity:.7;margin-top:2px}
.nota-badge.vazia{background:#eef4f1;border-color:var(--borda);color:#94a8a1}
.linha .info{flex:1;min-width:0}
.linha .info h3{margin:0 0 3px;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.linha .meta{color:var(--cinza);font-size:.82rem;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.chip{font-size:.68rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:3px 9px;border-radius:999px;background:#eef4f1;color:#2c4740}
.chip.analisado{background:#e8f8ef;color:#14663c}
.chip.erro{background:#fdecec;color:#8f2626}
.chip.processando{background:#fff8e1;color:#7a5a00}
.vazio{text-align:center;padding:34px 16px;color:var(--cinza)}
.grafico{margin-top:8px}
@media (max-width:640px){
  .metricas{grid-template-columns:1fr;gap:10px}
  .linha{padding:12px 14px;gap:12px}
  .nota-badge{width:52px;height:52px}
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

function dataCurta(s?: string): string {
  if (!s) return '';
  const partes = s.slice(0, 10).split('-');
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : s.slice(0, 10);
}

function chipClasse(s: string): string {
  if (s === 'analisado') return 'chip analisado';
  if (s === 'erro') return 'chip erro';
  if (s === 'processando') return 'chip processando';
  return 'chip';
}

const NOMES_STATUS: Record<string, string> = {
  analisado: 'analisado',
  erro: 'falhou',
  processando: 'analisando',
  enviado: 'enviado',
};

export function Dashboard({
  user,
  videos,
  pontos,
  msg,
}: {
  user: User;
  videos: VideoItem[];
  pontos: PontoEvolucao[];
  msg?: string;
}) {
  const analisados = videos.filter((v) => v.nota !== null).length;
  const media = pontos.length > 0 ? pontos.reduce((s, p) => s + p.nota, 0) / pontos.length : 0;

  return (
    <Layout titulo="Meus treinos - Padel Coach IA" user={user} cssExtra={CSS_DASH}>
      <section class="pagina" style="max-width:900px">
        <div class="dash-head">
          <div>
            <h1>Oi, {user.nome}!</h1>
            <p class="sub" style="margin:4px 0 0">Seu progresso na quadra, treino a treino.</p>
          </div>
          <a class="btn btn-pri" href="/videos/novo">+ Novo treino</a>
        </div>
        {barraMsg(msg)}

        <div class="metricas">
          <div class="card metrica">
            <h3>Treinos</h3>
            <div class="num">{videos.length}</div>
          </div>
          <div class="card metrica">
            <h3>Analisados</h3>
            <div class="num">{analisados}</div>
          </div>
          <div class="card metrica">
            <h3>Nota media</h3>
            <div class="num">
              {media > 0 ? media.toFixed(1) : '-'}
              {media > 0 ? <small>/10</small> : null}
            </div>
          </div>
        </div>

        {pontos.length > 1 ? <GraficoEvolucao pontos={pontos} /> : null}

        <h2 style="text-align:left;margin:26px 0 4px;font-size:1.15rem">Seus videos</h2>
        {videos.length === 0 ? (
          <div class="vazio">
            <p>Nenhum treino enviado ainda.</p>
            <a class="btn btn-pri" href="/videos/novo" style="margin-top:14px">Enviar meu primeiro video</a>
          </div>
        ) : (
          <div class="lista-videos">
            {videos.map((v) => (
              <div class="card linha">
                <div class={v.nota !== null ? 'nota-badge' : 'nota-badge vazia'}>
                  <b>{v.nota !== null ? v.nota.toFixed(1) : '-'}</b>
                  <i>{v.nota !== null ? 'de 10' : 'sem nota'}</i>
                </div>
                <div class="info">
                  <h3>{v.titulo ?? 'Treino'}</h3>
                  <div class="meta">
                    <span class={chipClasse(v.status)}>{NOMES_STATUS[v.status] ?? v.status}</span>
                    {v.enviado_em ? <span>{dataCurta(v.enviado_em)}</span> : null}
                  </div>
                </div>
                <a class="btn btn-sec btn-mini" href={`/videos/${v.id}`}>
                  {v.status === 'processando' ? 'Acompanhar' : 'Abrir'}
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}

// Grafico simples em SVG inline, sem lib pesada.
function GraficoEvolucao({ pontos }: { pontos: PontoEvolucao[] }) {
  const W = 620;
  const H = 170;
  const PAD = 28;
  const max = 10;
  const passoX = pontos.length > 1 ? (W - PAD * 2) / (pontos.length - 1) : 0;

  const coords = pontos.map((p, i) => ({
    x: PAD + i * passoX,
    y: H - PAD - (p.nota / max) * (H - PAD * 2),
  }));

  const linha = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const ultimo = coords[coords.length - 1];
  const area = `${PAD},${H - PAD} ${linha} ${ultimo ? ultimo.x.toFixed(1) : PAD},${H - PAD}`;

  return (
    <div class="card grafico">
      <h3 style="margin-bottom:6px">Evolucao da nota</h3>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="170" role="img" aria-label="Grafico de evolucao das notas">
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#d7e5df" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#d7e5df" />
        {[0, 5, 10].map((n) => {
          const y = H - PAD - (n / max) * (H - PAD * 2);
          return (
            <g>
              <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#eef4f1" />
              <text x={4} y={y + 4} font-size="10" fill="#7d938c">{n}</text>
            </g>
          );
        })}
        <polygon points={area} fill="rgba(15,118,110,.12)" />
        <polyline points={linha} fill="none" stroke="#0f766e" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        {coords.map((c) => (
          <circle cx={c.x} cy={c.y} r="4" fill="#d9f24a" stroke="#0f766e" stroke-width="2" />
        ))}
      </svg>
    </div>
  );
}
