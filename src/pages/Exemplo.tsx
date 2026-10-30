import type { User } from '../lib/session';
import { Layout } from './Layout';

// Pagina de exemplo: mostra o produto inteiro (nota, pontos, treino,
// evolucao) sem depender de R2 nem da chave da IA. Marcada como exemplo
// em todo lugar, para nao passar por analise real de um aluno.

const CSS_EXEMPLO = `
.exemplo{max-width:820px;margin:0 auto;padding:44px 20px 64px}
.exemplo h1{font-size:1.9rem;margin-bottom:6px;letter-spacing:-.02em}
.selo{display:inline-block;background:#fff8e1;border:1px solid #ecd27a;color:#7a5a00;font-size:.8rem;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:16px}
.nota{display:flex;align-items:baseline;gap:8px;justify-content:center;margin:22px 0 6px}
.nota strong{font-size:4rem;line-height:1;color:var(--quadra);letter-spacing:-.04em}
.nota span{font-size:1.05rem;color:var(--cinza)}
.resumo{text-align:center;color:#2c4740;max-width:560px;margin:0 auto 26px}
.colunas{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.lista{list-style:none;padding:0;margin:10px 0 0;display:grid;gap:8px}
.lista li{display:flex;gap:10px;font-size:.95rem;color:#2c4740}
.lista li::before{content:'';flex:none;width:8px;height:8px;border-radius:50%;margin-top:7px;background:var(--quadra)}
.lista.melhorar li::before{background:#e0a800}
.treino{background:var(--quadra-clara);border-radius:14px;padding:18px;margin-top:16px}
.cta{margin-top:30px;text-align:center}
`;

const FORTES = [
  'Boa leitura da bola na rede: voce fecha o angulo antes do adversario bater.',
  'Empunhadura firme na bandeja, com o punho estavel no momento do contato.',
  'Deslocamento lateral constante, sem ficar plantado no fundo da quadra.',
];

const MELHORAR = [
  'Sua preparacao comeca tarde no smash: gire o ombro assim que a bola subir.',
  'Depois de subir a rede, volte um passo ao centro - voce ficou aberto duas vezes.',
  'Use mais a parede no fundo: em tres bolas voce tentou resolver de primeira.',
];

export function PaginaExemplo({ user }: { user: User | null }) {
  return (
    <Layout
      titulo="Exemplo de analise - Padel Coach IA"
      descricao="Veja como e a analise do coach: nota, pontos fortes, o que melhorar e o treino da semana."
      user={user}
      cssExtra={CSS_EXEMPLO}
    >
      <section class="exemplo">
        <span class="selo">Exemplo - nao e um video seu</span>
        <h1>Analise de um treino de bandeja</h1>
        <p class="sub">Treino de 2 minutos, gravado de lado da quadra.</p>

        <div class="nota"><strong>7.5</strong><span>/ 10</span></div>
        <p class="resumo">
          Voce tem uma base solida de rede e le bem a bola curta. O que segura a nota
          e a preparacao do smash e a recuperacao depois de subir. Corrigindo esses dois
          pontos, a nota sobe rapido.
        </p>

        <div class="colunas">
          <div class="card">
            <h3>Pontos fortes</h3>
            <ul class="lista">{FORTES.map((p) => <li>{p}</li>)}</ul>
          </div>
          <div class="card">
            <h3>O que melhorar</h3>
            <ul class="lista melhorar">{MELHORAR.map((p) => <li>{p}</li>)}</ul>
          </div>
        </div>

        <div class="treino">
          <h3>Treino da semana</h3>
          <p>
            Tres series de 10 bandejas com o parceiro na rede: prepare o ombro antes da
            bola quicar, bata e volte um passo ao centro. Sem smash nesse treino -
            o foco e a recuperacao, nao a forca.
          </p>
        </div>

        <div class="cta">
          {user ? (
            <a class="btn btn-pri" href="/videos/novo">Enviar meu video</a>
          ) : (
            <>
              <a class="btn btn-pri" href="/cadastro">Criar conta gratis</a>
              <a class="btn btn-sec" href="/planos" style="margin-left:10px">Ver planos</a>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
