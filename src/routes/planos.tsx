import { Hono } from 'hono';
import type { Vars } from '../lib/session';
import { emitirTokenCsrf, csrfValido } from '../lib/csrf';
import type { Bindings } from '../lib/bindings';
import { planoAtual, analisesNoMes, type Plano } from '../lib/plans';
import { PaginaPlanos } from '../pages/Planos';
import { Layout } from '../pages/Layout';

export const rotasPlanos = new Hono<{ Bindings: Bindings; Variables: Vars }>();

rotasPlanos.get('/', async (c) => {
  const planos = await c.env.DB
    .prepare(
      'SELECT id, nome, preco_centavos, videos_por_mes FROM plans WHERE ativo = 1 ORDER BY preco_centavos ASC',
    )
    .all<Plano>();

  const user = c.get('user');
  let uso: { planoId: number; usadas: number; limite: number } | undefined;
  if (user) {
    const plano = await planoAtual(c.env.DB, user.id);
    uso = {
      planoId: plano.id,
      usadas: await analisesNoMes(c.env.DB, user.id),
      limite: plano.videos_por_mes,
    };
  }

  return c.html(
    <PaginaPlanos
      user={user}
      planos={planos.results ?? []}
      msg={c.req.query('msg')}
      csrf={emitirTokenCsrf(c)}
      mpAtivo={Boolean(c.env.MP_ACCESS_TOKEN)}
      uso={uso}
    />,
  );
});

// Cria a preferencia de checkout no Mercado Pago e manda o aluno para la.
rotasPlanos.post('/:id/assinar', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/entrar?msg=sessao');

  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) return c.redirect('/planos?msg=csrf');

  const token = c.env.MP_ACCESS_TOKEN;
  if (!token) return c.redirect('/planos?msg=mp_off');

  const planoId = Number(c.req.param('id'));
  if (!Number.isInteger(planoId)) return c.redirect('/planos?msg=plano_invalido');

  const plano = await c.env.DB
    .prepare('SELECT id, nome, preco_centavos, videos_por_mes FROM plans WHERE id = ? AND ativo = 1')
    .bind(planoId)
    .first<Plano>();
  if (!plano) return c.redirect('/planos?msg=plano_invalido');
  if (plano.preco_centavos === 0) return c.redirect('/planos?msg=grato');

  const base = new URL(c.req.url).origin;

  const resposta = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items: [
        {
          title: `Padel Coach IA - ${plano.nome}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: plano.preco_centavos / 100,
        },
      ],
      payer: { email: user.email },
      back_urls: {
        success: `${base}/planos?msg=pago`,
        failure: `${base}/planos?msg=falhou`,
        pending: `${base}/planos?msg=pendente`,
      },
      auto_return: 'approved',
      external_reference: `${user.id}:${plano.id}`,
      notification_url: `${base}/webhooks/mp`,
    }),
  });

  if (!resposta.ok) return c.redirect('/planos?msg=falhou');

  const dados = (await resposta.json()) as { init_point?: string };
  if (!dados.init_point) return c.redirect('/planos?msg=falhou');

  return c.redirect(dados.init_point);
});

// Quando nao ha token do Mercado Pago, oferece um pagamento SIMULADO para
// testar o fluxo completo (assinatura ativa = videos_por_mes=20 no Atleta).
rotasPlanos.post('/simular/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/entrar?msg=sessao');

  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) return c.redirect('/planos?msg=csrf');

  const planoId = Number(c.req.param('id'));
  if (!Number.isInteger(planoId)) return c.redirect('/planos?msg=plano_invalido');

  const plano = await c.env.DB
    .prepare('SELECT id, nome, preco_centavos, videos_por_mes FROM plans WHERE id = ? AND ativo = 1')
    .bind(planoId)
    .first<Plano>();
  if (!plano) return c.redirect('/planos?msg=plano_invalido');
  if (plano.preco_centavos === 0) return c.redirect('/planos?msg=grato');

  const csrf = emitirTokenCsrf(c);
  return c.html(
    <Layout
      titulo="Simular pagamento - Padel Coach IA"
      user={user}
      descricao="Modo de teste: confirme o pagamento simulado para ativar sua assinatura."
    >
      <section class="planos">
        <h1>Simular pagamento</h1>
        <p class="sub">Este e um teste sem cobranca real. Confirme para ativar o plano <strong>{plano.nome}</strong>.</p>
        <div class="card plano">
          <h3>{plano.nome}</h3>
          <div class="preco">R$ {(plano.preco_centavos / 100).toFixed(2).replace('.', ',')}</div>
          <ul>
            <li>PIX ou cartao (simulado)</li>
            <li>{plano.videos_por_mes === 0 ? 'Analises ilimitadas' : `${plano.videos_por_mes} analises por mes`}</li>
          </ul>
          <form method="post" action={`/planos/simular/${plano.id}/confirmar`}>
            <input type="hidden" name="csrf" value={csrf} />
            <button class="btn btn-pri btn-largo" type="submit">Confirmar pagamento simulado</button>
          </form>
        </div>
        <p class="troca"><a href="/planos">Voltar para os planos</a></p>
      </section>
    </Layout>
  );
});

rotasPlanos.post('/simular/:id/confirmar', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/entrar?msg=sessao');

  const corpo = await c.req.parseBody();
  if (!csrfValido(c, corpo['csrf'])) return c.redirect('/planos?msg=csrf');

  const planoId = Number(c.req.param('id'));
  if (!Number.isInteger(planoId)) return c.redirect('/planos?msg=plano_invalido');

  const plano = await c.env.DB
    .prepare('SELECT id, nome, preco_centavos, videos_por_mes FROM plans WHERE id = ? AND ativo = 1')
    .bind(planoId)
    .first<Plano>();
  if (!plano) return c.redirect('/planos?msg=plano_invalido');
  if (plano.preco_centavos === 0) return c.redirect('/planos?msg=grato');

  const renova = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  await c.env.DB
    .prepare("UPDATE subscriptions SET status = 'vencido' WHERE user_id = ? AND status = 'ativo'")
    .bind(user.id)
    .run();

  await c.env.DB
    .prepare(
      `INSERT INTO subscriptions (user_id, plan_id, status, mp_payment_id, renova_em)
       VALUES (?, ?, 'ativo', ?, ?)`,
    )
    .bind(user.id, planoId, `simulado-${Date.now()}`, renova)
    .run();

  return c.redirect('/planos?msg=simulado');
});

export const rotasWebhooks = new Hono<{ Bindings: Bindings; Variables: Vars }>();

// Webhook do Mercado Pago: confirma o pagamento consultando a API com o
// nosso token (nunca confiando no corpo da notificacao).
rotasWebhooks.post('/mp', async (c) => {
  const token = c.env.MP_ACCESS_TOKEN;
  if (!token) return c.json({ ok: true });

  let pagamentoId = c.req.query('data.id') ?? c.req.query('id') ?? '';
  try {
    const corpo = (await c.req.json()) as { data?: { id?: string | number } };
    if (corpo?.data?.id !== undefined) pagamentoId = String(corpo.data.id);
  } catch {
    // notificacao por query string, sem corpo JSON
  }
  if (!pagamentoId) return c.json({ ok: true });

  const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${pagamentoId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resposta.ok) return c.json({ ok: false }, 502);

  const pagamento = (await resposta.json()) as {
    status?: string;
    external_reference?: string;
  };

  const [userIdStr, planoIdStr] = String(pagamento.external_reference ?? '').split(':');
  const userId = Number(userIdStr);
  const planoId = Number(planoIdStr);
  if (!Number.isInteger(userId) || !Number.isInteger(planoId)) return c.json({ ok: true });

  if (pagamento.status === 'approved') {
    const renova = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    await c.env.DB
      .prepare("UPDATE subscriptions SET status = 'vencido' WHERE user_id = ? AND status = 'ativo'")
      .bind(userId)
      .run();

    await c.env.DB
      .prepare(
        `INSERT INTO subscriptions (user_id, plan_id, status, mp_payment_id, renova_em)
         VALUES (?, ?, 'ativo', ?, ?)`,
      )
      .bind(userId, planoId, pagamentoId, renova)
      .run();
  }

  return c.json({ ok: true });
});
