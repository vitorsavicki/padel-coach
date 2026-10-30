import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';

const CSS_NOVO = `
.passo{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}
.passo .n{flex:none;width:26px;height:26px;border-radius:50%;background:var(--bola);color:var(--quadra-esc);font-weight:800;display:flex;align-items:center;justify-content:center;font-size:.85rem}
.dica{background:#eef4f1;border-radius:12px;padding:14px 16px;margin:18px 0;font-size:.92rem;color:#2c4740}
.dica strong{color:var(--quadra-esc)}
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
    <Layout titulo="Enviar video - Padel Coach IA" user={user} cssExtra={CSS_NOVO}>
      <section class="pagina">
        <h1>Enviar video do treino</h1>
        <p class="sub">O coach assiste e responde na hora. Seu video nao fica guardado.</p>
        {barraMsg(msg)}

        <div class="dica">
          <div class="passo"><span class="n">1</span>
            <span>Grave de lado da quadra, com o celular apoiado. Ajuda o coach a ver seu posicionamento.</span></div>
          <div class="passo"><span class="n">2</span>
            <span>Um clipe de 1 a 2 minutos ja basta. Nao precisa ser o jogo inteiro.</span></div>
          <div class="passo"><span class="n">3</span>
            <span><strong>Seu video e descartado depois da analise.</strong> Guardamos so a nota e o feedback.</span></div>
        </div>

        {!iaAtiva ? (
          <div class="flash">
            A analise automatica esta em finalizacao - falta ligar a chave da IA.
            Enquanto isso, veja uma <a href="/exemplo">analise de exemplo</a>.
          </div>
        ) : (
          <form class="form" method="post" enctype="multipart/form-data">
            <input type="hidden" name="csrf" value={csrf} />
            <label class="campo">
              <span>Titulo do treino</span>
              <input name="titulo" maxlength={80} placeholder="Ex: Treino de saque 12/11" />
            </label>
            <label class="campo">
              <span>Video (mp4 ou mov, ate 14MB - cerca de 2 minutos)</span>
              <input name="video" type="file" accept="video/mp4,video/quicktime,video/x-m4v" required />
            </label>
            <button class="btn btn-pri btn-largo" type="submit">Analisar meu treino</button>
          </form>
        )}

        <p class="troca"><a href="/painel">Voltar para meus treinos</a></p>
      </section>
    </Layout>
  );
}
