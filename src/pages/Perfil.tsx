import type { User } from '../lib/session';
import type { PerfilDados } from '../lib/perfil';
import { Layout, barraMsg } from './Layout';

const CSS_PERFIL = `
.perfil{max-width:620px;margin:0 auto;padding:40px 20px 64px;text-align:left}
.perfil h1,.perfil .sub{text-align:center}
.perfil .card{margin-top:20px}
.perfil .form{max-width:100%}
.perfil .campo select,.perfil .campo textarea{padding:12px;border:1px solid #c3d6cf;border-radius:10px;font-size:1rem;background:#fff;font-family:inherit}
.perfil .campo textarea{min-height:96px;resize:vertical}
.perfil .campo select:focus,.perfil .campo textarea:focus{outline:2px solid var(--quadra);border-color:transparent}
.perfil .dica{font-size:.82rem;color:var(--cinza);font-weight:500;margin-top:-2px}
`;

export function PaginaPerfil({
  user,
  dados,
  msg,
  csrf,
}: {
  user: User;
  dados: PerfilDados;
  msg?: string;
  csrf: string;
}) {
  return (
    <Layout
      titulo="Meu perfil - Padel Coach IA"
      descricao="Conte sua mao, categoria e meta para o coach calibrar a analise."
      user={user}
      cssExtra={CSS_PERFIL}
    >
      <section class="perfil">
        <h1>Meu perfil</h1>
        <p class="sub">
          O coach usa estas informacoes para calibrar a exigencia. Tudo e opcional.
        </p>
        {barraMsg(msg)}

        <form class="card form" method="post" action="/perfil">
          <input type="hidden" name="csrf" value={csrf} />

          <label class="campo">
            <span>Seu nome</span>
            <input value={user.nome} disabled />
            <span class="dica">O nome vem da sua conta e aparece no feedback do coach.</span>
          </label>

          <label class="campo">
            <span>Mao dominante</span>
            <select name="mao">
              <option value="" selected={!dados.mao}>Nao informar</option>
              <option value="destro" selected={dados.mao === 'destro'}>Destro</option>
              <option value="canhoto" selected={dados.mao === 'canhoto'}>Canhoto</option>
            </select>
          </label>

          <label class="campo">
            <span>Categoria atual</span>
            <select name="categoria">
              <option value="" selected={!dados.categoria}>Nao informar</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option value={String(n)} selected={dados.categoria === String(n)}>
                  {n}a categoria
                </option>
              ))}
            </select>
            <span class="dica">No padel, a 1a e a mais forte e a 7a e a de quem esta comecando.</span>
          </label>

          <label class="campo">
            <span>Meta</span>
            <input
              name="meta"
              maxlength={120}
              value={dados.meta ?? ''}
              placeholder="Ex: subir da 5a para a 4a categoria"
            />
          </label>

          <label class="campo">
            <span>O que voce quer melhorar primeiro</span>
            <textarea
              name="prioridades"
              maxlength={400}
              placeholder="Ex: bandeja, posicionamento, jogo de rede, reduzir erros nao forcados..."
            >{dados.prioridades ?? ''}</textarea>
          </label>

          <button class="btn btn-pri btn-largo" type="submit">Salvar perfil</button>
        </form>

        <p class="troca"><a href="/painel">Voltar para meus treinos</a></p>
      </section>
    </Layout>
  );
}
