import { Layout, barraMsg } from './Layout';

export function PaginaCadastro({ msg, csrf }: { msg?: string; csrf: string }) {
  return (
    <Layout
      titulo="Criar conta - Padel Coach IA"
      descricao="Crie sua conta gratis e receba a analise do coach no seu primeiro treino."
      user={null}
      corpo={
        <section class="pagina">
          <h1>Criar sua conta</h1>
          <p class="sub">Gratis. Seu primeiro treino analisado em minutos.</p>
          {barraMsg(msg)}
          <form class="form" method="post">
            <input type="hidden" name="csrf" value={csrf} />
            <label class="campo"><span>Seu nome</span>
              <input name="nome" required minlength={2} autocomplete="name" /></label>
            <label class="campo"><span>E-mail</span>
              <input name="email" type="email" required autocomplete="email" /></label>
            <label class="campo"><span>Senha (minimo 8)</span>
              <input name="senha" type="password" required minlength={8} autocomplete="new-password" /></label>
            <button class="btn btn-pri btn-largo" type="submit">Criar conta gratis</button>
          </form>
          <p class="troca">Ja tem conta? <a href="/entrar">Entrar</a></p>
        </section>
      }
    />
  );
}

export function PaginaEntrar({ msg, csrf }: { msg?: string; csrf: string }) {
  return (
    <Layout
      titulo="Entrar - Padel Coach IA"
      user={null}
      corpo={
        <section class="pagina">
          <h1>Entrar</h1>
          <p class="sub">Bom te ver de volta na quadra.</p>
          {barraMsg(msg)}
          <form class="form" method="post">
            <input type="hidden" name="csrf" value={csrf} />
            <label class="campo"><span>E-mail</span>
              <input name="email" type="email" required autocomplete="email" /></label>
            <label class="campo"><span>Senha</span>
              <input name="senha" type="password" required autocomplete="current-password" /></label>
            <button class="btn btn-pri btn-largo" type="submit">Entrar</button>
          </form>
          <p class="troca">Nao tem conta? <a href="/cadastro">Criar gratis</a></p>
        </section>
      }
    />
  );
}
