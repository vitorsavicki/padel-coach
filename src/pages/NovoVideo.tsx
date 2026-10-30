import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';
import { Mascote } from './Mascote';

const CSS_NOVO = `
.passo{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}
.passo .n{flex:none;width:26px;height:26px;border-radius:50%;background:var(--bola);color:var(--quadra-esc);font-weight:800;display:flex;align-items:center;justify-content:center;font-size:.85rem}
.dica{background:#eef4f1;border-radius:12px;padding:16px 18px;margin:18px 0 22px;font-size:.93rem;text-align:left;color:#2c4740}
.dica strong{color:var(--quadra-esc)}
.limites{background:#fff;border:1px solid var(--borda);border-radius:14px;padding:16px 18px;margin:20px 0 8px;text-align:left}
.limites h3{font-size:.95rem;margin-bottom:8px;color:var(--quadra-esc)}
.limites ul{list-style:none;padding:0;margin:0;display:grid;gap:7px}
.limites li{font-size:.88rem;color:#2c4740}
.limites p{font-size:.82rem;color:var(--cinza);margin-top:10px;line-height:1.45}
.prev-box{display:none;margin:16px 0 6px}
.prev-box.on{display:block}
.prev{width:100%;max-height:340px;border-radius:14px;background:#000;display:block}
.prev-legenda{font-size:.82rem;color:var(--cinza);text-align:center;margin-top:6px}
.duvidas{margin-top:34px;text-align:left}
.duvidas h2{font-size:1.1rem;margin-bottom:12px;text-align:center}
.duvida{background:#fff;border:1px solid var(--borda);border-radius:12px;padding:14px 16px;margin-bottom:10px}
.duvida summary{cursor:pointer;font-weight:700;color:var(--quadra-esc);font-size:.95rem}
.duvida p{margin-top:8px;font-size:.92rem;color:#2c4740}
.setup{background:#fff8e1;border:1px solid #ecd27a;border-radius:12px;padding:16px 18px;margin:0 0 22px;text-align:left;font-size:.9rem;color:#7a5a00}
.setup code{display:block;background:#fff;border:1px solid #ecd27a;border-radius:8px;padding:10px 12px;margin:8px 0;font-size:.85rem;color:#5a4200;overflow-x:auto;white-space:pre}
.palco{display:none;margin:22px 0 6px;padding:22px 18px;border-radius:18px;background:linear-gradient(180deg,#eaf7f1,#f7fcfa);border:1px solid var(--borda)}
.palco.on{display:block}
.palco .mascote{margin-bottom:6px}
.fala{font-size:1rem;font-weight:700;color:var(--quadra-esc);min-height:1.4em}
.barra{max-width:280px;margin:12px auto 0;height:8px;border-radius:999px;background:#dcebe5;overflow:hidden}
.barra span{display:block;height:100%;width:0;background:var(--quadra);border-radius:999px;transition:width .6s ease}
.etapas{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:6px;text-align:left;max-width:320px;margin-left:auto;margin-right:auto}
.etapas li{font-size:.86rem;color:#7d938c;display:flex;gap:8px;align-items:center}
.etapas li.feito{color:var(--quadra-esc);font-weight:700}
.etapas li.atual{color:var(--quadra-esc);font-weight:700}
.etapas li::before{content:'';flex:none;width:8px;height:8px;border-radius:50%;background:#cfe2da}
.etapas li.feito::before,.etapas li.atual::before{background:var(--quadra)}
.etapas li.atual::before{box-shadow:0 0 0 3px rgba(15,118,110,.18)}
`;

// Roda no navegador. Le o arquivo local, extrai 6 quadros e envia so as
// imagens. Sem backticks e sem ${} aqui dentro: este texto vive em um
// template literal no servidor.
const SCRIPT = `
(function(){
  var form=document.getElementById('fvid');
  if(!form){return;}
  var inp=document.getElementById('arq');
  var hid=document.getElementById('quadros');
  var btn=document.getElementById('bt');
  var palco=document.getElementById('palco');
  var fala=document.getElementById('fala');
  var barra=document.getElementById('barra');
  var masc=document.getElementById('masc');
  var listas=document.querySelectorAll('#etapas li');
  function dizer(t){if(fala){fala.textContent=t;}}
  function humor(h){if(masc){masc.setAttribute('data-humor',h);}}
  function progresso(p){if(barra){barra.style.width=p+'%';}}
  function marcar(i){
    for(var k=0;k<listas.length;k++){
      listas[k].className=k<i?'feito':(k===i?'atual':'');
    }
  }
  function ler(file){
    return new Promise(function(resolve,reject){
      var v=document.createElement('video');
      v.muted=true;v.playsInline=true;v.preload='auto';
      var url=URL.createObjectURL(file);
      v.src=url;
      v.onloadedmetadata=function(){
        var dur=v.duration||0;
        if(!dur||!isFinite(dur)){URL.revokeObjectURL(url);reject(new Error('duracao'));return;}
        var total=6,largura=480,c=document.createElement('canvas'),ctx=c.getContext('2d'),out=[],i=0;
        function passo(){
          if(i>=total){URL.revokeObjectURL(url);resolve(out);return;}
          var t=dur*(0.08+0.84*(i/(total-1)));
          v.currentTime=Math.min(t,dur-0.05);
          dizer('Pegando o momento '+(i+1)+' de '+total+' do seu treino...');
          progresso(Math.round(((i+1)/total)*45));
          v.onseeked=function(){
            v.onseeked=null;
            var lv=v.videoWidth||largura,av=v.videoHeight||480;
            var esc=Math.min(1,largura/lv);
            c.width=Math.round(lv*esc);c.height=Math.round(av*esc);
            ctx.drawImage(v,0,0,c.width,c.height);
            out.push(c.toDataURL('image/jpeg',0.5));
            i++;passo();
          };
        }
        passo();
      };
      v.onerror=function(){URL.revokeObjectURL(url);reject(new Error('video'));};
    });
  }
  form.onsubmit=function(ev){
    ev.preventDefault();
    var f=inp&&inp.files&&inp.files[0];
    if(!f){dizer('Escolha um video primeiro.');return;}
    if(btn){btn.disabled=true;btn.textContent='Analisando...';}
    if(palco){palco.className='palco on';}
    humor('analisando');marcar(0);progresso(6);
    dizer('Abrindo o video aqui no seu aparelho...');
    ler(f).then(function(lista){
      hid.value=JSON.stringify(lista);
      marcar(1);progresso(55);
      dizer('Enviando as imagens para o coach...');
      var fd=new FormData(form);
      return fetch('/videos/novo',{method:'POST',body:fd,headers:{'x-async':'1'},credentials:'same-origin'});
    }).then(function(r){return r.json();}).then(function(j){
      marcar(2);progresso(80);
      dizer('O coach esta analisando seu posicionamento...');
      if(j&&j.ok&&j.id){
        progresso(100);marcar(3);humor('feliz');
        dizer('Pronto! Abrindo sua analise...');
        setTimeout(function(){location.href='/videos/'+j.id;},700);
      }else{
        humor('triste');marcar(1);
        if(btn){btn.disabled=false;btn.textContent='Tentar de novo';}
        dizer((j&&j.msg)?j.msg:'Nao conseguimos analisar agora. Tente de novo em alguns minutos.');
      }
    }).catch(function(){
      humor('triste');
      if(btn){btn.disabled=false;btn.textContent='Tentar de novo';}
      dizer('Nao consegui ler esse video. Tente outro arquivo mp4 ou mov.');
    });
  };

  var diag=document.getElementById('diag');
  if(diag){
    diag.onclick=function(){
      if(palco){palco.className='palco on';}
      humor('analisando');marcar(0);progresso(25);
      dizer('Testando a conexao com o coach...');
      fetch('/saude/ia',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(j){
        progresso(100);
        if(j&&j.ok){
          humor('feliz');marcar(3);
          dizer('Conexao ok: '+j.modelo+' respondeu em '+j.ms+' ms. Pode enviar seu video.');
        }else{
          humor('triste');marcar(1);
          dizer('A IA nao respondeu: '+((j&&j.detalhe)||'erro')+' (modelo: '+((j&&j.modelo)||'?')+')');
        }
      }).catch(function(){
        humor('triste');
        dizer('Nao consegui falar com o servidor.');
      });
    };
  }
})();
`;

export function PaginaNovoVideo({
  user,
  msg,
  csrf,
  iaAtiva,
}: {
  user: User;
  msg?: string;
  csrf: string;
  iaAtiva: boolean;
}) {
  return (
    <Layout titulo="Analisar meu treino - Padel Coach IA" user={user} cssExtra={CSS_NOVO}>
      <section class="pagina">
        <div style="display:flex;gap:14px;align-items:center;justify-content:center;margin-bottom:6px">
          <Mascote humor="feliz" size={64} />
          <h1 style="margin:0;text-align:left">Analisar meu treino</h1>
        </div>
        <p class="sub">Escolha um video do celular. Ele e lido aqui no seu aparelho - o arquivo nao sai de onde esta.</p>
        {barraMsg(msg)}

        <div class="dica">
          <div class="passo"><span class="n">1</span>
            <span>Grave de lado da quadra, com o celular apoiado. Da para ver seu posicionamento.</span></div>
          <div class="passo"><span class="n">2</span>
            <span>De 30 segundos a 2 minutos ja bastam. Limite: 2 minutos e 100MB por arquivo.</span></div>
          <div class="passo"><span class="n">3</span>
            <span><strong>O video fica no seu celular.</strong> So as imagens dos momentos vao para o coach.</span></div>
        </div>

        {!iaAtiva ? (
          <div class="setup">
            <strong>A analise ainda nao esta ligada.</strong>
            Falta a chave do Google (gratis, sem cartao). No terminal do projeto:
            <code>npx wrangler secret put IA_API_KEY</code>
            <code>npx wrangler secret put IA_MODEL</code>
            Depois <code style="display:inline;padding:2px 6px">npx wrangler deploy</code>.
            Enquanto isso, veja uma <a href="/exemplo">analise de exemplo</a>.
          </div>
        ) : null}

        <form class="form" id="fvid" method="post" enctype="multipart/form-data">
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="quadros" id="quadros" value="" />
          <label class="campo">
            <span>Titulo do treino</span>
            <input name="titulo" maxlength={80} placeholder="Ex: Treino de saque 12/11" />
          </label>
          <label class="campo">
            <span>Video do celular (mp4 ou mov)</span>
            <input id="arq" type="file" accept="video/mp4,video/quicktime,video/x-m4v" required />
          </label>
          <button class="btn btn-pri btn-largo" id="bt" type="submit" disabled={!iaAtiva}>
            {iaAtiva ? 'Analisar meu treino' : 'Analise em finalizacao'}
          </button>
        </form>

        <div class="limites">
          <h3>Limites do video</h3>
          <ul>
            <li><strong>Tempo: ate 2 minutos</strong> por treino. De 30 segundos a 2 minutos ja da uma analise completa.</li>
            <li><strong>Tamanho: ate 100MB</strong> por arquivo. O video nao e enviado para o Google - o coach recebe so 6 imagens de momentos, menos de 300KB.</li>
            <li><strong>Analises: 2 por mes</strong> no plano Gratis (20 no Atleta, ilimitado no Pro).</li>
          </ul>
          <p>
            Por que tao curto? Com 6 momentos o coach avalia tecnica e posicionamento
            sem gastar a cota gratuita do Google em um jogo inteiro. Se o video for
            maior que 2 minutos, o proprio site usa apenas os momentos principais.
          </p>
        </div>

        <button class="btn btn-sec btn-largo" id="diag" type="button" style="margin-top:10px">
          Testar a conexao com a IA
        </button>

        <div class="prev-box" id="prevbox">
          <video class="prev" id="prev" controls playsinline />
          <p class="prev-legenda">Confira o treino antes de analisar. Este video nao sai do seu aparelho.</p>
        </div>

        <div class="palco" id="palco">
          <span id="masc"><Mascote humor="analisando" size={92} /></span>
          <div class="fala" id="fala">Preparando...</div>
          <div class="barra"><span id="barra" /></div>
          <ul class="etapas" id="etapas">
            <li class="atual">Ler o video no seu aparelho</li>
            <li>Enviar as imagens para o coach</li>
            <li>O coach analisa seu jogo</li>
            <li>Montar o treino da semana</li>
          </ul>
        </div>

        <div class="duvidas">
          <h2>Duvidas de quem esta chegando agora</h2>
          <details class="duvida">
            <summary>Meu video fica guardado no site?</summary>
            <p>Nao. O video e lido no seu proprio celular e nao e enviado. So as imagens de alguns momentos vao para o coach. Guardamos a nota e o feedback.</p>
          </details>
          <details class="duvida">
            <summary>Preciso instalar algum aplicativo?</summary>
            <p>Nao. E so abrir o site no navegador do celular, escolher o video e esperar. Nada para baixar.</p>
          </details>
          <details class="duvida">
            <summary>Quanto tempo leva a analise?</summary>
            <p>Normalmente de 30 segundos a 2 minutos. O mascote mostra em que etapa esta, do primeiro ao ultimo passo.</p>
          </details>
          <details class="duvida">
            <summary>Como gravar um video que o coach consiga avaliar?</summary>
            <p>Apoie o celular de lado da quadra, na altura do peito, e grave de 30 segundos a 2 minutos de um treino ou jogo. Nao precisa de camera profissional.</p>
          </details>
          <details class="duvida">
            <summary>E se der erro?</summary>
            <p>O mascote explica o que aconteceu e o botao vira "Tentar de novo". Seu video continua no celular - nada se perde.</p>
          </details>
        </div>

        <p class="troca"><a href="/painel">Voltar para meus treinos</a></p>
      </section>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </Layout>
  );
}
