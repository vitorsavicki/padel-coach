import type { User } from '../lib/session';
import { Layout, barraMsg } from './Layout';

export function PaginaNovoVideo({
  user,
  msg,
  csrf,
  r2Ativo,
}: {
  user: User;
  msg?: string;
  csrf: string;
  r2Ativo: boolean;
}) {
  return (
    <Layout titulo="Enviar video - Padel Coach IA" user={user}>
      <section class="pagina">
        <h1>Enviar video do treino</h1>
        <p class="sub">Grave pelo celular. Clipes de ate 2 minutos ja valem uma analise completa.</p>
        {barraMsg(msg)}

        {!r2Ativo ? (
          <div class="flash">
            O envio de video esta em finalizacao. Estamos ligando o armazenamento na nuvem -
            volta em breve e voce ja podera mandar seu primeiro treino.
          </div>
        ) : (
          <form class="form" method="post" enctype="multipart/form-data">
            <input type="hidden" name="csrf" value={csrf} />
            <label class="campo">
              <span>Titulo do treino</span>
              <input name="titulo" maxlength={80} placeholder="Ex: Treino de saque 12/11" />
            </label>
            <label class="campo">
              <span>Video (mp4 ou mov, ate 100MB)</span>
              <input name="video" type="file" accept="video/mp4,video/quicktime,video/x-m4v" required />
            </label>
            <button class="btn btn-pri btn-largo" type="submit">Enviar video</button>
          </form>
        )}

        <p class="troca"><a href="/painel">Voltar para meus treinos</a></p>
      </section>
    </Layout>
  );
}
