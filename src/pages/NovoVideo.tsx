import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';

const CSS_NOVO = `
.passo{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}
.passo .n{flex:none;width:26px;height:26px;border-radius:50%;background:var(--bola);color:var(--quadra-esc);font-weight:800;display:flex;align-items:center;justify-content:center;font-size:.85rem}
.dica{background:#eef4f1;border-radius:12px;padding:16px 18px;margin:18px 0 22px;font-size:.93rem;text-align:left;color:#2c4740}
.dica strong{color:var(--quadra-esc)}
.status-envio{min-height:22px;font-size:.9rem;font-weight:700;color:var(--quadra-esc);text-align:center;margin-top:6px}
.setup{background:#fff8e1;border:1px solid #ecd27a;border-radius:12px;padding:16px 18px;margin:0 0 22px;text-align:left;font-size:.9rem;color:#7a5a00}
.setup code{display:block;background:#fff;border:1px solid #ecd27a;border-radius:8px;padding:10px 12px;margin:8px 0;font-size:.85rem;color:#5a4200;overflow-x:auto;white-space:pre}
`;

// Le o video no aparelho do aluno e devolve 8 quadros JPEG em data URL.
// Sem backticks e sem ${} aqui: este texto vive dentro de um template.
const SCRIPT_QUADROS = `
(function(){
  var form=document.getElementById('fvid');
  if(!form){return;}
  var inp=document.getElementById('arq');
  var hid=document.getElementById('quadros');
  var msg=document.getElementById('st');
  var btn=document.getElementById('bt');
  function dizer(t){if(msg){msg.textContent=t;}}
  function ler(file){
    return new Promise(function(resolve,reject){
      var v=document.createElement('video');
      v.muted=true; v.playsInline=true; v.preload='auto';
      var url=URL.createObjectURL(file);
      v.src=url;
      v.onloadedmetadata=function(){
        var dur=v.duration||0;
        if(!dur||!isFinite(dur)){URL.revokeObjectURL(url);reject(new Error('duracao'));return;}
        var total=8, largura=640, c=document.createElement('canvas'), ctx=c.getContext('2d'), out=[], i=0;
        function passo(){
          if(i>=total){URL.revokeObjectURL(url);resolve(out);return;}
          var t=dur*(0.06+0.88*(i/(total-1)));
          v.currentTime=Math.min(t,dur-0.05);
          dizer('Lendo o video no seu aparelho... '+(i+1)+' de '+total);
          v.onseeked=function(){
            v.onseeked=null;
            var lv=v.videoWidth||largura, av=v.videoHeight||480;
            var esc=Math.min(1,largura/lv);
            c.width=Math.round(lv*esc); c.height=Math.round(av*esc);
            ctx.drawImage(v,0,0,c.width,c.height);
            out.push(c.toDataURL('image/jpeg',0.6));
            i++; passo();
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
    if(btn){btn.disabled=true;}
    dizer('Preparando o video...');
    ler(f).then(function(lista){
      hid.value=JSON.stringify(lista);
      dizer('Enviando para o coach...');
      form.submit();
    }).catch(function(){
      if(btn){btn.disabled=false;}
      dizer('Nao consegui ler esse video. Tente outro arquivo mp4 ou mov.');
    });
  };
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
        <h1>Analisar meu treino</h1>
        <p class="sub">Escolha um video do celular. Ele e lido aqui no seu aparelho - o arquivo nao sai de onde esta.</p>
        {barraMsg(msg)}

        <div class="dica">
          <div class="passo"><span class="n">1</span>
            <span>Grave de lado da quadra, com o celular apoiado. Da para ver seu posicionamento.</span></div>
          <div class="passo"><span class="n">2</span>
            <span>De 30 segundos a 2 minutos ja bastam. Nao precisa ser o jogo inteiro.</span></div>
          <div class="passo"><span class="n">3</span>
            <span><strong>O video fica no seu celular.</strong> So as imagens dos momentos vao para o coach. Guardamos a nota e o feedback.</span></div>
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
            <input id="arq" name="video" type="file" accept="video/mp4,video/quicktime,video/x-m4v" required />
          </label>
          <button class="btn btn-pri btn-largo" id="bt" type="submit" disabled={!iaAtiva}>
            {iaAtiva ? 'Analisar meu treino' : 'Analise em finalizacao'}
          </button>
          <div class="status-envio" id="st" />
        </form>

        <p class="troca"><a href="/painel">Voltar para meus treinos</a></p>
      </section>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_QUADROS }} />
    </Layout>
  );
}
