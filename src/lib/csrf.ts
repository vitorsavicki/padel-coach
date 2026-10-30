// CSRF para app SSR same-origin, em duas camadas:
// 1) Cookie de sessao SameSite=Lax (nao viaja em POST cross-site).
// 2) Token por sessao: cookie HttpOnly + campo oculto no form, comparados
//    em tempo constante. O valor chega ao form pelo servidor, entao o
//    cookie pode ficar HttpOnly (mais seguro que o double-submit classico).
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

export const COOKIE_CSRF = 'padel_csrf';
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

function tokenAleatorio(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Garante um token no cookie e devolve o valor para embutir no form.
export function emitirTokenCsrf(c: Context): string {
  const atual = getCookie(c, COOKIE_CSRF);
  if (atual && /^[0-9a-f]{64}$/.test(atual)) return atual;
  const token = tokenAleatorio();
  setCookie(c, COOKIE_CSRF, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 24 * 3600,
  });
  return token;
}

// Comparacao em tempo constante entre o token do form e o do cookie.
export function csrfValido(c: Context, doForm: unknown): boolean {
  const doCookie = getCookie(c, COOKIE_CSRF);
  if (!doCookie || typeof doForm !== 'string' || doForm.length !== doCookie.length) return false;
  let diff = 0;
  for (let i = 0; i < doCookie.length; i++) diff |= doCookie.charCodeAt(i) ^ doForm.charCodeAt(i);
  return diff === 0;
}

// Camada 1: recusa POST vindo de outra origem (defesa em profundidade,
// o token da camada 2 e a protecao principal).
export const protecaoOrigem = createMiddleware(async (c, next) => {
  if (METODOS_SEGUROS.has(c.req.method)) return next();

  const fetchSite = c.req.header('Sec-Fetch-Site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') {
    return c.text('Origem nao permitida.', 403);
  }

  const origin = c.req.header('Origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(c.req.url).host) {
        return c.text('Origem nao permitida.', 403);
      }
    } catch {
      return c.text('Origem nao permitida.', 403);
    }
  }

  return next();
});