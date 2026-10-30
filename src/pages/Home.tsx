import type { User } from '../lib/session';
import { Layout, barraMsg, BolaPadel } from './Layout';
import { Mascote } from './Mascote';

const CSS_HOME = `
.hero{position:relative;overflow:hidden;padding:84px 20px 64px;text-align:center;background:radial-gradient(120% 120% at 50% 0%,#d9f5ec 0%,#eef8f3 45%,var(--fundo) 100%)}
.hero::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(15,118,110,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(15,118,110,.07) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(70% 60% at 50% 30%,#000 30%,transparent 100%);-webkit-mask-image:radial-gradient(70% 60% at 50% 30%,#000 30%,transparent 100%);pointer-events:none}
.hero .wrap{position:relative;z-index:1}
.hero h1{font-size:clamp(2.1rem,5.4vw,3.6rem);line-height:1.05;letter-spacing:-.035em;margin-bottom:18px;font-weight:800}
.hero .selo-hero{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--borda);border-radius:999px;padding:6px 14px;font-size:.82rem;font-weight:700;color:var(--quadra-esc);margin-bottom:20px;box-shadow:0 1px 2px rgba(10,31,26,.05)}
.hero h1 em{color:var(--quadra);font-style:normal;position:relative;white-space:nowrap}
.hero h1 em::after{content:'';position:absolute;left:0;right:0;bottom:.06em;height:.28em;background:var(--bola);border-radius:3px;z-index:-1}
.hero p{font-size:1.1rem;color:var(--cinza);max-width:600px;margin:0 auto 28px}
.hero .acoes{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.quadra{max-width:640px;margin:40px auto 0}
.preco{font-size:2rem;font-weight:800;margin:6px 0 2px;letter-spacing:-.02em}
.preco small{font-size:.85rem;color:var(--cinza);font-weight:500}
.card.destaque{border:2px solid var(--quadra);position:relative;box-shadow:0 18px 40px -24px rgba(15,118,110,.55);transform:translateY(-4px)}
.grid .card{transition:transform .18s ease,box-shadow .18s ease}
.grid .card:hover{transform:translateY(-3px);box-shadow:0 14px 30px -22px rgba(10,31,26,.45)}
.tag{position:absolute;top:-12px;left:22px;background:var(--bola);color:var(--quadra-esc);font-size:.72rem;font-weight:800;letter-spacing:.04em;padding:4px 11px;border-radius:999px;text-transform:uppercase}
ul.feats{list-style:none;padding:0;margin:14px 0 20px;display:grid;gap:6px}
ul.feats li{padding-left:22px;position:relative;color:#2c4740;font-size:.93rem}
ul.feats li::before{content:'';position:absolute;left:0;top:6px;width:9px;height:9px;border-radius:50%;background:var(--bola);box-shadow:0 0 0 2px rgba(15,118,110,.25)}
.embreve{display:block;text-align:center;padding:11px;border-radius:10px;background:#eef4f1;color:#5b716b;font-weight:600;font-size:.9rem}
.passos{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.passos .card{position:relative;padding-top:28px}
.passos .n{position:absolute;top:-16px;left:22px}
.recebe{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}
.recebe .card{padding-top:20px}
.recebe .icone{display:inline-flex;width:30px;height:30px;border-radius:9px;background:var(--quadra);color:#fff;font-weight:800;font-size:.85rem;align-items:center;justify-content:center;margin-bottom:10px}
.rodape-cta{margin-top:52px;background:var(--quadra);color:#fff;border-radius:20px;padding:40px 26px;text-align:center}
.rodape-cta h2{color:#fff}
.rodape-cta p{color:#d3ece5;margin:8px auto 22px;max-width:460px}
.rodape-cta .btn-pri{background:var(--bola);color:var(--quadra-esc)}
.prova{display:flex;gap:26px;justify-content:center;flex-wrap:wrap;margin-top:26px;color:var(--cinza);font-size:.88rem}
.prova strong{color:var(--quadra-esc)}
`;

// Quadra animada: quatro jogadores em movimento, raquetes batendo e a bola
// cruzando a rede. SVG inline com keyframes CSS, sem imagem externa.
function QuadraAnimada() {
  const JOGADORES = [
    { x: 150, y: 118, pulo: 'q-p1', raq: 'q-raq' },
    { x: 95, y: 163, pulo: 'q-p2', raq: 'q-raq2' },
    { x: 470, y: 150, pulo: 'q-p3', raq: 'q-raq3' },
    { x: 530, y: 108, pulo: 'q-p4', raq: 'q-raq4' },
  ];

  return (
    <div class="quadra">
      <style>{`
        .quadra svg{overflow:visible}
        .q-p{transform-box:fill-box;transform-origin:50% 100%}
        .q-p1{animation:q-pula 2.4s ease-in-out infinite}
        .q-p2{animation:q-pula 2.4s ease-in-out .55s infinite}
        .q-p3{animation:q-pula 2.1s ease-in-out .9s infinite}
        .q-p4{animation:q-pula 2.1s ease-in-out 1.45s infinite}
        .q-raq{transform-box:fill-box;transform-origin:0% 100%;animation:q-bate .9s ease-in-out infinite}
        .q-raq2{animation-delay:.35s}
        .q-raq3{animation-delay:.62s}
        .q-raq4{animation-delay:.18s}
        .q-bola{animation:q-vai 2.8s cubic-bezier(.42,0,.58,1) infinite}
        .q-sombra{transform-box:fill-box;transform-origin:50% 50%;animation:q-sombra 2.4s ease-in-out infinite}
        @keyframes q-pula{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes q-bate{0%,100%{transform:rotate(-28deg)}50%{transform:rotate(20deg)}}
        @keyframes q-sombra{0%,100%{transform:scale(1);opacity:.2}50%{transform:scale(.8);opacity:.1}}
        @keyframes q-vai{
          0%{transform:translate(0,0)}
          28%{transform:translate(142px,-30px)}
          56%{transform:translate(292px,14px)}
          82%{transform:translate(150px,-48px)}
          100%{transform:translate(0,0)}
        }
        @media (prefers-reduced-motion: reduce){
          .q-p,.q-raq,.q-bola,.q-sombra{animation:none !important}
        }
      `}</style>
      <svg viewBox="0 0 640 300" width="100%" role="img"
        aria-label="Quadra de padel com quatro jogadores em movimento e a bola cruzando a rede">
        <defs>
          <linearGradient id="piso" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#19a08f" />
            <stop offset="1" stop-color="#0f766e" />
          </linearGradient>
        </defs>

        <rect x="60" y="40" width="520" height="220" rx="10" fill="url(#piso)" />
        <rect x="60" y="40" width="520" height="220" rx="10" fill="none" stroke="#0a4f4a" stroke-width="3" />
        <line x1="320" y1="40" x2="320" y2="260" stroke="#e9fbf5" stroke-width="2" opacity=".75" />
        <line x1="60" y1="150" x2="580" y2="150" stroke="#e9fbf5" stroke-width="2" opacity=".55" />
        <line x1="190" y1="150" x2="450" y2="150" stroke="#e9fbf5" stroke-width="3" opacity=".9" />
        <line x1="60" y1="105" x2="60" y2="195" stroke="#e9fbf5" stroke-width="2" opacity=".55" />
        <line x1="580" y1="105" x2="580" y2="195" stroke="#e9fbf5" stroke-width="2" opacity=".55" />

        {JOGADORES.map((p) => (
          <g>
            <ellipse class="q-sombra" cx={p.x} cy={p.y + 52} rx="14" ry="4" fill="#0a4f4a" />
            <g class={`q-p ${p.pulo}`}>
              <circle cx={p.x} cy={p.y} r="8" fill="#0a4f4a" />
              <rect x={p.x - 6} y={p.y + 8} width="12" height="24" rx="5" fill="#0a4f4a" />
              <line x1={p.x - 2} y1={p.y + 32} x2={p.x - 7} y2={p.y + 50} stroke="#0a4f4a" stroke-width="4" stroke-linecap="round" />
              <line x1={p.x + 2} y1={p.y + 32} x2={p.x + 7} y2={p.y + 50} stroke="#0a4f4a" stroke-width="4" stroke-linecap="round" />
              <g class={`q-raq ${p.raq}`}>
                <line x1={p.x + 6} y1={p.y + 12} x2={p.x + 24} y2={p.y - 4} stroke="#0a4f4a" stroke-width="3.5" stroke-linecap="round" />
                <ellipse cx={p.x + 28} cy={p.y - 7} rx="7" ry="9" fill="none" stroke="#0a4f4a" stroke-width="2.5" />
              </g>
            </g>
          </g>
        ))}

        <g class="q-bola">
          <circle cx="172" cy="118" r="8" fill="#d9f24a" stroke="#0a4f4a" stroke-width="1.8" />
          <path d="M166 112c3 1 5 4 5 7" fill="none" stroke="#0a4f4a" stroke-width="1.2" />
          <path d="M178 112c-3 1-5 4-5 7" fill="none" stroke="#0a4f4a" stroke-width="1.2" />
        </g>
      </svg>
    </div>
  );
}

// Ilustracao da quadra de padel, em SVG inline (sem imagem externa).
function Quadra() {
  return (
    <div class="quadra">
      <svg viewBox="0 0 640 300" width="100%" role="img" aria-label="Quadra de padel com jogadores e bola">
        <defs>
          <linearGradient id="piso" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#19a08f" />
            <stop offset="1" stop-color="#0f766e" />
          </linearGradient>
        </defs>
        <rect x="60" y="40" width="520" height="220" rx="10" fill="url(#piso)" />
        <rect x="60" y="40" width="520" height="220" rx="10" fill="none" stroke="#0a4f4a" stroke-width="3" />
        <line x1="320" y1="40" x2="320" y2="260" stroke="#e9fbf5" stroke-width="2" opacity=".75" />
        <line x1="60" y1="150" x2="580" y2="150" stroke="#e9fbf5" stroke-width="2" opacity=".55" />
        <line x1="190" y1="150" x2="450" y2="150" stroke="#e9fbf5" stroke-width="3" opacity=".9" />
        <line x1="60" y1="105" x2="60" y2="195" stroke="#e9fbf5" stroke-width="2" opacity=".55" />
        <line x1="580" y1="105" x2="580" y2="195" stroke="#e9fbf5" stroke-width="2" opacity=".55" />
        <g fill="#0a4f4a" opacity=".9">
          <circle cx="150" cy="120" r="9" />
          <rect x="146" y="130" width="8" height="26" rx="4" />
          <circle cx="485" cy="185" r="9" />
          <rect x="481" y="195" width="8" height="26" rx="4" />
        </g>
        <g stroke="#0a4f4a" stroke-width="3" stroke-linecap="round">
          <line x1="167" y1="126" x2="186" y2="112" />
          <line x1="464" y1="192" x2="447" y2="207" />
        </g>
        <ellipse cx="336" cy="96" rx="15" ry="15" fill="#d9f24a" stroke="#0a4f4a" stroke-width="1.6" />
        <path d="M327 88c5 2 8 6 9 12" fill="none" stroke="#0a4f4a" stroke-width="1.2" />
        <path d="M345 88c-5 2-8 6-9 12" fill="none" stroke="#0a4f4a" stroke-width="1.2" />
      </svg>
    </div>
  );
}

const PLANOS = [
  {
    nome: 'Gratis',
    preco: 'R$ 0',
    periodo: '',
    feats: ['2 analises por mes', 'Nota e feedback do coach', 'Treino sugerido da semana'],
    destaque: false,
  },
  {
    nome: 'Atleta',
    preco: 'R$ 19,90',
    periodo: '/mes',
    feats: ['20 analises por mes', 'Historico e evolucao das notas', 'Tudo do plano Gratis'],
    destaque: true,
  },
  {
    nome: 'Pro',
    preco: 'R$ 39,90',
    periodo: '/mes',
    feats: ['Analises ilimitadas', 'Prioridade na fila de analise', 'Tudo do plano Atleta'],
    destaque: false,
  },
];

export function Home({ user, msg }: { user: User | null; msg?: string }) {
  return (
    <Layout
      titulo="Padel Coach IA - seu coach de padel com inteligencia artificial"
      descricao="Suba o video do seu treino de padel e receba analise, nota e plano de evolucao. Comece gratis."
      user={user}
      cssExtra={CSS_HOME}
      corpo={
        <>
          <section class="hero">
            <div class="wrap">
              {barraMsg(msg)}
              <div style="display:flex;justify-content:center;margin-bottom:10px">
                <Mascote humor="feliz" size={96} />
              </div>
              <span class="selo-hero"><BolaPadel size={16} /> Analise do seu treino em minutos, de onde voce estiver</span>
              <h1>
                Seu coach de padel<br />no seu ritmo, com <em>inteligencia artificial</em>.
              </h1>
              <p>
                Suba o video do seu treino ou jogo. O coach assiste, da a nota, mostra o que
                melhorar e monta o treino da sua semana. Voce ve sua evolucao a cada video.
              </p>
              <div class="acoes">
                {user ? (
                  <a class="btn btn-pri" href="/painel">Ver meu painel</a>
                ) : (
                  <a class="btn btn-pri" href="/cadastro">Comecar gratis</a>
                )}
                <a class="btn btn-sec" href="#como">Como funciona</a>
              </div>
              <div class="prova">
                <span><strong>2 min</strong> de video ja vale uma analise</span>
                <span><strong>Nota de 0 a 10</strong> a cada treino</span>
                <span><strong>Treino</strong> pronto para a semana</span>
              </div>
              <QuadraAnimada />
            </div>
          </section>

          <section class="sec" id="como">
            <div class="wrap">
              <h2>Como funciona</h2>
              <p class="sub-sec">Tres passos, do celular para a quadra.</p>
              <div class="passos">
                <div class="card">
                  <span class="n">1</span>
                  <h3>Grave e envie</h3>
                  <p>Filme um treino ou um jogo pelo celular e mande pelo site. Clipes de ate 2 minutos ja bastam.</p>
                </div>
                <div class="card">
                  <span class="n">2</span>
                  <h3>O coach analisa</h3>
                  <p>Tecnica, posicionamento e decisao de jogo avaliados como um treinador faria na beira da quadra.</p>
                </div>
                <div class="card">
                  <span class="n">3</span>
                  <h3>Volte melhor</h3>
                  <p>Receba nota, pontos fortes, o que corrigir e um treino sob medida. Suas notas sobem com o tempo.</p>
                </div>
              </div>
            </div>
          </section>

          <section class="sec" id="recebe" style="background:#fff;border-top:1px solid var(--borda);border-bottom:1px solid var(--borda)">
            <div class="wrap">
              <h2>O que voce recebe depois de enviar</h2>
              <p class="sub-sec">Um retorno curto e direto, feito para o seu proximo treino.</p>
              <div class="recebe">
                <div class="card">
                  <span class="icone">1</span>
                  <h3>Nota de 0 a 10</h3>
                  <p>Com o que puxou a nota para cima e o que puxou para baixo.</p>
                </div>
                <div class="card">
                  <span class="icone">2</span>
                  <h3>O que voce fez bem</h3>
                  <p>Tres ou quatro pontos concretos, cada um ligado a um momento do video.</p>
                </div>
                <div class="card">
                  <span class="icone">3</span>
                  <h3>O que corrigir</h3>
                  <p>O erro e o que fazer no lugar, na mesma frase. Sem teoria solta.</p>
                </div>
                <div class="card">
                  <span class="icone">4</span>
                  <h3>Treino da semana</h3>
                  <p>Um treino pratico, com series e foco, para a sua proxima ida a quadra.</p>
                </div>
              </div>
            </div>
          </section>

          <section class="sec" id="planos">
            <div class="wrap">
              <h2>Planos para cada momento</h2>
              <p class="sub-sec">Comece gratis. Pague so se quiser analisar mais.</p>
              <div class="grid">
                {PLANOS.map((p) => (
                  <div class={p.destaque ? 'card destaque' : 'card'}>
                    {p.destaque ? <span class="tag">Mais escolhido</span> : null}
                    <h3>{p.nome}</h3>
                    <div class="preco">{p.preco}<small>{p.periodo}</small></div>
                    <ul class="feats">
                      {p.feats.map((f) => <li>{f}</li>)}
                    </ul>
                    <span class="embreve">Pagamento em breve</span>
                  </div>
                ))}
              </div>
              <p style="text-align:center;color:var(--cinza);margin-top:22px;font-size:.9rem">
                Pagamento por PIX ou cartao, via Mercado Pago. Cancele quando quiser.
              </p>
            </div>
          </section>

          <section class="wrap">
            <div class="rodape-cta">
              <BolaPadel size={30} />
              <h2>Pronto para o proximo treino?</h2>
              <p>Crie sua conta gratis e mande o primeiro video. O coach responde em minutos.</p>
              <a class="btn btn-pri" href={user ? '/videos/novo' : '/cadastro'}>
                {user ? 'Enviar video' : 'Criar conta gratis'}
              </a>
            </div>
          </section>
        </>
      }
    />
  );
}
