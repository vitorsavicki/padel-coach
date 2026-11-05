import { Hono } from 'hono';
import type { Vars } from '../lib/session';
import { emitirTokenCsrf, csrfValido } from '../lib/csrf';
import type { Bindings } from '../lib/bindings';
import { lerPerfil, type PerfilDados } from '../lib/perfil';
import { PaginaPerfil } from '../pages/Perfil';

export const rotasPerfil = new Hono<{ Bindings: Bindings; Variables: Vars }>();

rotasPerfil.get('/', (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/entrar?msg=sessao');
  return c.html(
    <PaginaPerfil
      user={user}
      dados={lerPerfil(user.perfil)}
      msg={c.req.query('msg')}
      csrf={emitirTokenCsrf(c)}
    />,
  );
});

rotasPerfil.post('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/entrar?msg=sessao');

  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) return c.redirect('/perfil?msg=csrf');

  const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const mao = texto(corpo['mao'], 10);
  const categoria = texto(corpo['categoria'], 1);

  const dados: PerfilDados = {
    mao: mao === 'destro' || mao === 'canhoto' ? mao : '',
    categoria: /^[1-7]$/.test(categoria) ? categoria : '',
    meta: texto(corpo['meta'], 120),
    prioridades: texto(corpo['prioridades'], 400),
  };

  const vazio = !dados.mao && !dados.categoria && !dados.meta && !dados.prioridades;

  await c.env.DB
    .prepare('UPDATE users SET perfil = ? WHERE id = ?')
    .bind(vazio ? null : JSON.stringify(dados), user.id)
    .run();

  return c.redirect('/perfil?msg=perfil_salvo');
});
