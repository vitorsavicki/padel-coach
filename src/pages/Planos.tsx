import type { User } from '../lib/session';
import type { Plano } from '../lib/plans';
import { Layout, barraMsg } from './Layout';

const CSS_PLANOS = `
.planos{max-width:980px;margin:0 auto;padding:44px 20px 64px;text-align:center}
.planos h1{font-size:1.9rem;margin-bottom:6px;letter-spacing:-.02em}
.card.plano{display:flex;flex-direction:column;text-align:left;position:relative}
.card.plano.destaque{border:2px solid var(--quadra)}
.plano .preco{font-size:2rem;font-weight:800;letter-spacing:-.02em;margin:4px 0 2px}
.plano .preco small{font-size:.85rem;color:var(--cinza);font-weight:500}
.plano ul{list-style:none;padding:0;margin:14px 0 22px;display:grid;gap:7px;flex:1}
.plano ul li{padding-left:22px;position:relative;font-size:.93rem;color:#2c4740}
.plano ul li::before{content:'';position:absolute;left:0;top:6px;width:9px;height:9px;border-radius:50%;background:var(--bola);box-shadow:0 0 0 2px rgba(15,118,110,.25)}
.plano .tag{position:absolute;top:-12px;left:22px;background:var(--bola);color:var(--quadra-esc);font-size:.72rem;font-weight:800;letter-spacing:.04em;padding:4px 11px;border-radius:999px;text-transform:uppercase}
.atual{display:inline-block;font-size:.75rem;font-weight:800;padding:3px 10px;border-radius:999px;background:var(--quadra-clara);color:var(--quadra-esc);margin-bottom:8px}
.uso{max-width:460px;margin:0 auto 26px;background:var(--papel);border:1px solid var(--borda);border-radius:14px;padding:16px 20px;text-align:left}
.uso strong{color:var(--quadra-esc)}
.barra{height:9px;background:#e8f0ed;border-radius:999px;margin-top:10px;overflow:hidden}
.barra span{display:block;height:100%;background:var(--quadra);border-radius:999px}
`;

function featsDe(p: Plano): string[] {
  if (p.videos_por_mes === 0) {
    return ['Analises ilimitadas', 'Prioridade na fila de analise', 'Historico e evolucao das notas'];
  }
  const base = [`${p.videos_por_mes} analises por mes`, 'Nota e feedback do coach', 'Treino sugerido da semana'];
  return p.preco_centavos > 0 ? [...base, 'Historico e evolucao das notas'] : base;
}

export function PaginaPlanos({
  user,
  planos,
  msg,
  csrf,
  mpAtivo,
  uso,
}: {
  user: User | null;
  planos: Plano[];
  msg?: string;
  csrf: string;
  mpAtivo: boolean;
  uso?: { planoId: number; usadas: number; limite: number };
}) {
  const gratis = planos.find((p) => p.preco_centavos === 0);

  return (
    <Layout
      titulo="Planos - Padel Coach IA"
      descricao="Comece gratis e pague so se quiser analisar mais treinos. PIX ou cartao via Mercado Pago."
      user={user}
      cssExtra={CSS_PLANOS}
    >
      <section class="planos">
        <h1>Planos para cada momento</h1>
        <p class="sub">Comece gratis. Pague so se quiser analisar mais.</p>
        {barraMsg(msg)}

        {user && uso ? (
          <div class="uso">
            <strong>Seu plano agora:</strong>{' '}
            {planos.find((p) => p.id === uso.planoId)?.nome ?? 'Gratis'}
            <div style="margin-top:4px;font-size:.9rem;color:var(--cinza)">
              {uso.limite === 0
                ? `${uso.usadas} analises neste mes - sem limite`
                : `${uso.usadas} de ${uso.limite} analises usadas neste mes`}
            </div>
            {uso.limite > 0 ? (
              <div class="barra">
                <span style={`width:${Math.min(100, Math.round((uso.usadas / uso.limite) * 100))}%`} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div class="grid">
          {planos.map((p) => {
            const destaque = p.preco_centavos > 0 && p.videos_por_mes === 20;
            const eGratis = p.preco_centavos === 0;
            const eAtual = uso?.planoId === p.id;
            const preco = (p.preco_centavos / 100).toFixed(2).replace('.', ',');

            return (
              <div class={destaque ? 'card plano destaque' : 'card plano'}>
                {destaque ? <span class="tag">Mais escolhido</span> : null}
                {eAtual ? <span class="atual">Seu plano</span> : null}
                <h3>{p.nome}</h3>
                <div class="preco">
                  {eGratis ? 'R$ 0' : `R$ ${preco}`}
                  {eGratis ? null : <small>/mes</small>}
                </div>
                <ul>
                  {featsDe(p).map((f) => <li>{f}</li>)}
                </ul>

                {eGratis ? (
                  user ? (
                    <a class="btn btn-sec btn-largo" href="/videos/novo">Enviar um video</a>
                  ) : (
                    <a class="btn btn-sec btn-largo" href="/cadastro">Criar conta gratis</a>
                  )
                ) : !user ? (
                  <a class="btn btn-pri btn-largo" href="/cadastro">Criar conta para assinar</a>
                ) : !mpAtivo ? (
                  <span class="embreve">Pagamento em breve</span>
                ) : eAtual ? (
                  <span class="embreve">Plano ativo</span>
                ) : (
                  <form method="post" action={`/planos/${p.id}/assinar`}>
                    <input type="hidden" name="csrf" value={csrf} />
                    <button class="btn btn-pri btn-largo" type="submit">Assinar {p.nome}</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        <p style="color:var(--cinza);font-size:.9rem;margin-top:24px">
          Pagamento por PIX ou cartao, via Mercado Pago. Cancele quando quiser.
          {gratis ? ' O plano Gratis nao pede cartao.' : ''}
        </p>
      </section>
    </Layout>
  );
}
