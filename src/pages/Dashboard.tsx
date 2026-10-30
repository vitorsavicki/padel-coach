import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';

const CSS_DASH = `
.metrica .preco{font-size:2.4rem;font-weight:800;color:var(--quadra);letter-spacing:-.02em}
.metrica h3{color:var(--cinza);font-size:.9rem;font-weight:600}
.linha-video{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
.linha-video h3{margin:0}
.mini-nota{font-weight:800;color:var(--quadra);font-size:1.25rem}
.grafico{margin-top:10px}
.curso{text-align:center;color:var(--cinza);padding:26px 0}
`;

export type PontoEvolucao = { rotulo: string; nota: number };

export function Dashboard({
  user,
  videos,
  pontos,
  msg,
}: {
  user: User;
  videos: Array<{ id: number; titulo: string | null; status: string; nota: number | null }>;
  pontos: PontoEvolucao[];
  msg?: string;
}) {
  const analisados = videos.filter((v) => v.nota !== null).length;
  const media =
    analisados > 0
      ? pontos.reduce((s, p) => s + p.nota, 0) / pontos.length
      : 0;

  return (
    <Layout titulo="Meus treinos - Padel Coach IA" user={user} cssExtra={CSS_DASH}>
      <section class="pagina" style="max-width:980px">
        <h1>Oi, {user.nome}!</h1>
        <p class="sub">Seu progresso na quadra, treino a treino.</p>
        {barraMsg(msg)}

        <div class="grid" style="margin-bottom:28px">
          <div class="card metrica">
            <h3>Treinos enviados</h3>
            <div class="preco">{videos.length}</div>
          </div>
          <div class="card metrica">
            <h3>Analisados</h3>
            <div class="preco">{analisados}</div>
          </div>
          <div class="card metrica">
            <h3>Nota media</h3>
            <div class="preco">{media > 0 ? media.toFixed(1) : '-'}</div>
          </div>
        </div>

        {pontos.length > 0 ? <GraficoEvolucao pontos={pontos} /> : null}

        <h2 style="text-align:left;margin:28px 0 14px;font-size:1.25rem">Seus videos</h2>
        {videos.length === 0 ? (
          <div class="curso">
            <p>Nenhum treino enviado ainda.</p>
            <a class="btn btn-pri" href="/videos/novo" style="margin-top:14px">Enviar meu primeiro video</a>
          </div>
        ) : (
          <div style="display:grid;gap:12px">
            {videos.map((v) => (
              <div class="card linha-video">
                <div>
                  <h3>{v.titulo ?? 'Treino'}</h3>
                  <p style="font-size:.85rem">Status: {v.status}</p>
                </div>
                <div style="display:flex;align-items:center;gap:16px">
                  {v.nota !== null ? <span class="mini-nota">{v.nota.toFixed(1)}</span> : null}
                  <a class="btn btn-sec btn-mini" href={`/videos/${v.id}`}>Abrir</a>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style="margin-top:26px">
          <a class="btn btn-pri" href="/videos/novo">Enviar novo video</a>
        </div>
      </section>
    </Layout>
  );
}

// Grafico simples em SVG inline, sem lib pesada.
function GraficoEvolucao({ pontos }: { pontos: PontoEvolucao[] }) {
  const W = 620;
  const H = 180;
  const PAD = 28;
  const max = 10;
  const passoX = pontos.length > 1 ? (W - PAD * 2) / (pontos.length - 1) : 0;

  const coords = pontos.map((p, i) => ({
    x: PAD + i * passoX,
    y: H - PAD - (p.nota / max) * (H - PAD * 2),
  }));

  const linha = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${PAD},${H - PAD} ${linha} ${coords[coords.length - 1]?.x ?? PAD},${H - PAD}`;

  return (
    <div class="card grafico">
      <h3>Evolucao da nota</h3>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="180" role="img" aria-label="Grafico de evolucao das notas">
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
        {coords.map((c, i) => (
          <circle cx={c.x} cy={c.y} r="4" fill="#d9f24a" stroke="#0f766e" stroke-width="2" />
        ))}
      </svg>
    </div>
  );
}
