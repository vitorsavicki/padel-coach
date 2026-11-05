import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';
import { Mascote, type Humor } from './Mascote';
import type { VideoRow, AnaliseRow } from '../routes/videos';
import { dicaParaErro } from '../ia';

const CSS_VIDEO = `
.topo-analise{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:16px;align-items:center;margin:8px 0 4px}
.mascote-avatar{display:flex;flex-direction:column;align-items:center;gap:2px;flex:none}
.mascote-nome{font-size:.68rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--quadra-esc);opacity:.75}
.mascote-balao{position:relative;background:#fff;border:1px solid var(--borda);border-radius:16px;padding:14px 18px;text-align:left;box-shadow:0 10px 24px rgba(10,31,26,.08);min-width:0}
.mascote-balao::before{content:'';position:absolute;left:-7px;top:28px;width:13px;height:13px;background:#fff;border-left:1px solid var(--borda);border-bottom:1px solid var(--borda);transform:rotate(45deg)}
.mascote-fala{font-size:1rem;color:var(--tinta);line-height:1.5;margin:0}
.mascote-fala p{margin:0 0 8px}
.mascote-controles{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:10px}
.mascote-controles[hidden]{display:none}
.mascote-contador{font-size:.78rem;font-weight:800;color:var(--cinza);min-width:54px;text-align:center}
.lista li.destaque{background:#fff8e1;border-radius:10px;padding:6px 8px;margin-left:-8px;box-shadow:0 0 0 1px #f0d98a inset}
@media (max-width:640px){
  .topo-analise{grid-template-columns:1fr;gap:12px}
  .mascote-balao::before{left:50%;top:-7px;transform:translateX(-50%) rotate(45deg);border-left:1px solid var(--borda);border-top:1px solid var(--borda);border-bottom:0;border-right:0}
  .nota-caixa{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}
  .nota-caixa .num{font-size:3rem}
  .nota-caixa .de{margin:0}
  .nota-caixa .etiqueta{margin:0}
}
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
.momentos{margin-top:24px;text-align:left}
.momentos h3{font-size:1rem;margin-bottom:4px}
.momentos p{margin:0 0 10px;font-size:.86rem;color:var(--cinza)}
.tira{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.quadro{margin:0;border-radius:12px;overflow:hidden;border:1px solid var(--borda);background:#000}
.quadro img{display:block;width:100%;height:auto}
.quadro figcaption{background:#fff;color:var(--quadra-esc);font-size:.76rem;font-weight:800;text-align:center;padding:5px 4px}
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

// Os quadros vem como JSON de data URLs. Um valor invalido nao derruba a
// pagina: a tira de momentos simplesmente nao aparece.
function parseQuadros(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.startsWith('data:image/'))
      : [];
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

function falaDoMascote(nota: number, humor: Humor): string {
  if (nota >= 7) {
    return 'Otimo! O coach gostou do que viu. Voce esta no caminho certo - confira abaixo o que vai bem e o que treinar na semana.';
  }
  if (nota >= 5) {
    return 'Voce esta na media. Tem pontos fortes para manter e outros para melhorar - veja o feedback do coach abaixo.';
  }
  return 'Nao desanime! Todo mundo comeca assim. O coach apontou o que treinar primeiro - confira abaixo e volte em breve.';
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
  const quadros = parseQuadros(video.quadros);
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
              <div class="mascote-avatar">
                <Mascote humor={humor} size={110} />
                <span class="mascote-nome">Professor Padel</span>
              </div>
              <div class="mascote-balao">
                <p class="mascote-fala" id="mascote-fala" aria-live="polite">{falaDoMascote(nota, humor)}</p>
                <div class="mascote-controles" id="mascote-controles" hidden>
                  <button type="button" class="btn btn-sec btn-mini" id="mascote-anterior">Anterior</button>
                  <span class="mascote-contador" id="mascote-contador">1 de 1</span>
                  <button type="button" class="btn btn-sec btn-mini" id="mascote-proximo">Proximo</button>
                  <button type="button" class="btn btn-pri btn-mini" id="mascote-ouvir">Ouvir</button>
                </div>
              </div>
              <div class="nota-caixa">
                <div class="num">{nota.toFixed(1)}</div>
                <div class="de">de 10</div>
                <div class="etiqueta">{etiquetaNota(nota)}</div>
              </div>
            </div>
            <p class="resumo">{analise.resumo}</p>

            {quadros.length > 0 ? (
              <div class="momentos">
                <h3>Os momentos do seu treino que o coach olhou</h3>
                <p>Cada comentario abaixo se refere a um destes momentos.</p>
                <div class="tira">
                  {quadros.map((q, i) => (
                    <figure class="quadro">
                      <img src={q} alt={`Momento ${i + 1} do seu treino`} loading="lazy" />
                      <figcaption>Momento {i + 1}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ) : null}

            <div class="card bloco">
              <h3><span class="marca" /> Pontos fortes</h3>
              <ul class="lista">{fortes.map((p) => <li>{p}</li>)}</ul>
            </div>

            <div class="card bloco melhorar">
              <h3><span class="marca" /> O que melhorar</h3>
              <ul class="lista" id="lista-melhorar">
                {melhorar.map((p, i) => <li data-ponto={i}>{p}</li>)}
              </ul>
            </div>

            <script dangerouslySetInnerHTML={{ __html: `
(function(){
  var lista = document.getElementById('lista-melhorar');
  if (!lista) return;
  var itens = Array.prototype.slice.call(lista.querySelectorAll('li'));
  if (!itens.length) return;
  var falas = itens.map(function(li){ return li.textContent.trim(); });
  var indice = 0;
  var fala = document.getElementById('mascote-fala');
  var controles = document.getElementById('mascote-controles');
  var contador = document.getElementById('mascote-contador');
  var anterior = document.getElementById('mascote-anterior');
  var proximo = document.getElementById('mascote-proximo');
  var ouvir = document.getElementById('mascote-ouvir');
  if (!fala || !controles || !contador || !anterior || !proximo || !ouvir) return;
  controles.hidden = false;
  function mostra(){
    fala.textContent = 'Ponto ' + (indice + 1) + ' de ' + falas.length + ': ' + falas[indice];
    contador.textContent = (indice + 1) + ' de ' + falas.length;
    anterior.disabled = indice === 0;
    proximo.disabled = indice === falas.length - 1;
    itens.forEach(function(li, n){ li.classList.toggle('destaque', n === indice); });
  }
  anterior.addEventListener('click', function(){ if (indice > 0) { indice -= 1; mostra(); } });
  proximo.addEventListener('click', function(){ if (indice < falas.length - 1) { indice += 1; mostra(); } });
  ouvir.addEventListener('click', function(){
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      ouvir.textContent = 'Audio indisponivel';
      setTimeout(function(){ ouvir.textContent = 'Ouvir'; }, 1800);
      return;
    }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(falas[indice]);
    u.lang = 'pt-BR';
    u.rate = 1.02;
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  });
  mostra();
})();
` }} />

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
          Seu video nao fica guardado: ele nunca saiu do seu aparelho. Guardamos as 4 imagens dos momentos e o feedback, e voce pode apagar tudo aqui.
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
