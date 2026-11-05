import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';

const CSS_PRIV = `
.privacidade{max-width:760px;margin:0 auto;padding:44px 20px 60px;text-align:left}
.privacidade h1{font-size:1.9rem;margin-bottom:6px;letter-spacing:-.02em}
.privacidade h2{font-size:1.15rem;margin:28px 0 8px}
.privacidade p,.privacidade li{color:#2c4740;font-size:.97rem}
.privacidade ul{padding-left:20px;display:grid;gap:6px;margin-top:8px}
.perigo{border:1px solid #efb1b1;background:#fdf4f4;border-radius:14px;padding:20px;margin-top:30px}
.perigo h2{color:#8f2626;margin-top:0}
`;

export function PaginaPrivacidade({
  user,
  csrf,
  msg,
}: {
  user: User | null;
  csrf: string;
  msg?: string;
}) {
  return (
    <Layout titulo="Privacidade e seus dados - Padel Coach IA" user={user} cssExtra={CSS_PRIV}>
      <section class="privacidade">
        <h1>Privacidade e seus dados</h1>
        <p class="sub">Em portugues claro: o que guardamos, por que, e como apagar.</p>
        {barraMsg(msg)}

        <h2>O que guardamos</h2>
        <ul>
          <li><strong>Seu cadastro:</strong> nome, e-mail e uma senha protegida (nunca guardamos a senha em texto).</li>
          <li><strong>As imagens dos momentos:</strong> o video nunca e enviado. O site le o arquivo no seu aparelho e manda so 4 imagens de momentos para a analise. Essas imagens ficam guardadas para voce rever o que o coach olhou.</li>
          <li><strong>As analises:</strong> nota, pontos fortes, pontos a melhorar e o treino sugerido.</li>
        </ul>

        <h2>Videos sao dados sensiveis</h2>
        <p>
          Um video mostra seu rosto, sua quadra e sua rotina. Por isso o arquivo do video nunca sai
          do seu aparelho: so as 4 imagens dos momentos sao enviadas. Nunca registramos o conteudo
          ou o endereco do video nos nossos logs, e voce pode apagar qualquer treino na hora, sem
          pedir autorizacao a ninguem.
        </p>

        <h2>Quem ve seus dados</h2>
        <p>
          Apenas voce e o servico de inteligencia artificial que faz a analise (e recebe as 4
          imagens). Nao vendemos, nao compartilhamos com anunciantes e nao usamos suas imagens para
          treinar modelos publicos.
        </p>

        <h2>Por quanto tempo</h2>
        <p>
          As imagens dos momentos e a analise ficam guardadas enquanto voce nao apagar o treino ou a
          conta. Apagar remove na hora, sem copia de seguranca separada.
        </p>

        <h2>Seus direitos (LGPD)</h2>
        <p>
          Voce pode ver, corrigir ou apagar seus dados quando quiser. Apagar a conta remove tudo:
          cadastro, imagens dos treinos, analises e sessoes abertas.
        </p>

        {user ? (
          <div class="perigo">
            <h2>Apagar minha conta e todos os treinos</h2>
            <p>
              Isso nao tem volta. Suas imagens de treino, analises e o cadastro sao removidos na hora.
              Escreva <strong>APAGAR</strong> para confirmar.
            </p>
            <form method="post" action="/conta/apagar" class="form" style="margin-top:14px">
              <input type="hidden" name="csrf" value={csrf} />
              <label class="campo">
                <span>Confirmacao</span>
                <input name="confirmar" required placeholder="APAGAR" autocomplete="off" />
              </label>
              <button class="btn btn-pri btn-largo" type="submit"
                onclick="return confirm('Apagar a conta e todos os treinos? Nao tem como recuperar.')">
                Apagar minha conta
              </button>
            </form>
          </div>
        ) : (
          <p class="troca">
            <a href="/cadastro">Criar conta</a> ou <a href="/entrar">entrar</a> para gerenciar seus dados.
          </p>
        )}

        <p class="troca"><a href="/">Voltar para o inicio</a></p>
      </section>
    </Layout>
  );
}
