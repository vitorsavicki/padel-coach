import { Hono } from 'hono';
import { hashSenha, verificarSenha } from '../lib/crypto';
import {
  criarSessao,
  gravarCookieSessao,
  encerrarSessao,
  limparCookieSessao,
  exigirLogin,
  type Vars,
} from '../lib/session';
import { emitirTokenCsrf, csrfValido } from '../lib/csrf';
import { limiteAuth } from '../lib/rate-limit';
import type { Bindings } from '../lib/bindings';
import { PaginaCadastro, PaginaEntrar } from '../pages/Auth';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const rotasAuth = new Hono<{ Bindings: Bindings; Variables: Vars }>();

rotasAuth.get('/cadastro', (c) => {
  if (c.get('user')) return c.redirect('/painel');
  const csrf = emitirTokenCsrf(c);
  return c.html(<PaginaCadastro msg={c.req.query('msg')} csrf={csrf} />);
});

rotasAuth.post('/cadastro', limiteAuth, async (c) => {
  const dado = (await c.req.parseBody()) as Record<string, string>;
  if (!csrfValido(c, dado.csrf)) return c.redirect('/cadastro?msg=csrf');

  const nome = (dado.nome ?? '').trim();
  const email = (dado.email ?? '').trim().toLowerCase();
  const senha = dado.senha ?? '';

  if (nome.length < 2 || !EMAIL_OK.test(email) || senha.length < 8) {
    return c.redirect('/cadastro?msg=dados');
  }

  const existe = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number }>();
  if (existe) return c.redirect('/cadastro?msg=email_usado');

  const senhaHash = await hashSenha(senha);
  let userId: number;
  try {
    const r = await c.env.DB
      .prepare('INSERT INTO users (email, senha_hash, nome) VALUES (?, ?, ?)')
      .bind(email, senhaHash, nome)
      .run();
    userId = r.meta.last_row_id as number;
  } catch {
    return c.redirect('/cadastro?msg=email_usado');
  }

  const token = await criarSessao(c.env.DB, userId);
  gravarCookieSessao(c, token);
  return c.redirect('/painel');
});

rotasAuth.get('/entrar', (c) => {
  if (c.get('user')) return c.redirect('/painel');
  const csrf = emitirTokenCsrf(c);
  return c.html(<PaginaEntrar msg={c.req.query('msg')} csrf={csrf} />);
});

rotasAuth.post('/entrar', limiteAuth, async (c) => {
  const dado = (await c.req.parseBody()) as Record<string, string>;
  if (!csrfValido(c, dado.csrf)) return c.redirect('/entrar?msg=csrf');

  const email = (dado.email ?? '').trim().toLowerCase();
  const senha = dado.senha ?? '';

  const row = await c.env.DB
    .prepare('SELECT id, email, nome, senha_hash FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number; email: string; nome: string; senha_hash: string }>();

  if (!row || !(await verificarSenha(senha, row.senha_hash))) {
    return c.redirect('/entrar?msg=senha_errada');
  }

  const token = await criarSessao(c.env.DB, row.id);
  gravarCookieSessao(c, token);
  return c.redirect('/painel');
});

rotasAuth.get('/sair', async (c) => {
  await encerrarSessao(c.env.DB, c.get('sessionId'));
  limparCookieSessao(c);
  return c.redirect('/?msg=saiu');
});

export { exigirLogin };