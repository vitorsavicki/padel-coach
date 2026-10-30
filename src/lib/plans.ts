// Regras de plano: qual plano o aluno tem agora e quantas analises ele ja
// usou no mes corrente. O limite e checado ANTES de chamar a IA, para nao
// queimar cota de um plano que o aluno nao pagou.

import { MODO_DEMO_LOCAL } from '../ia';

export type Plano = {
  id: number;
  nome: string;
  preco_centavos: number;
  videos_por_mes: number; // 0 = ilimitado
};

const PLANO_GRATIS: Plano = {
  id: 1,
  nome: 'Gratis',
  preco_centavos: 0,
  videos_por_mes: 2,
};

// Inicio do mes corrente em ISO (UTC), no formato que o D1 compara.
function inicioDoMes(): string {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
}

// Plano vigente: assinatura ativa mais recente; sem assinatura, o Gratis.
export async function planoAtual(db: D1Database, userId: number): Promise<Plano> {
  const row = await db
    .prepare(
      `SELECT p.id, p.nome, p.preco_centavos, p.videos_por_mes
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = ? AND s.status = 'ativo' AND p.ativo = 1
       ORDER BY s.id DESC LIMIT 1`,
    )
    .bind(userId)
    .first<Plano>();

  return row ?? PLANO_GRATIS;
}

// Quantas analises o aluno ja fez no mes corrente.
export async function analisesNoMes(db: D1Database, userId: number): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM analyses WHERE user_id = ? AND criado_em >= ?')
    .bind(userId, inicioDoMes())
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// Pode analisar agora? Devolve o motivo quando nao pode, para a copy da pagina.
export async function podeAnalisar(
  db: D1Database,
  userId: number,
): Promise<{ ok: boolean; plano: Plano; usadas: number; limite: number }> {
  const plano = await planoAtual(db, userId);
  const usadas = await analisesNoMes(db, userId);
  const limite = plano.videos_por_mes;

  // Em demonstracao o limite nao se aplica: o dono testa a tela inteira.
  return { ok: MODO_DEMO_LOCAL || limite === 0 || usadas < limite, plano, usadas, limite };
}
