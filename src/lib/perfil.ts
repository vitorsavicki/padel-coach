// Perfil tecnico do jogador, salvo por conta. O coach usa esses dados para
// calibrar a exigencia; sem perfil, ele nao deve inventar categoria ou mao.

export type PerfilDados = {
  mao?: string;
  categoria?: string;
  meta?: string;
  prioridades?: string;
};

export function lerPerfil(json: string | null | undefined): PerfilDados {
  if (!json) return {};
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    if (!v || typeof v !== 'object') return {};
    const texto = (x: unknown) => (typeof x === 'string' ? x : '');
    return {
      mao: texto(v.mao),
      categoria: texto(v.categoria),
      meta: texto(v.meta),
      prioridades: texto(v.prioridades),
    };
  } catch {
    return {};
  }
}

// Monta o bloco que entra no system prompt. O nome vem da conta, nao do
// perfil, para o coach falar com a pessoa certa em qualquer analise.
export function perfilParaPrompt(nome: string, perfil: PerfilDados): string {
  const linhas = [`Nome: ${nome}`];
  if (perfil.mao) linhas.push(`Mao dominante: ${perfil.mao}`);
  if (perfil.categoria) linhas.push(`Categoria atual: ${perfil.categoria}a`);
  if (perfil.meta) linhas.push(`Meta: ${perfil.meta}`);
  if (perfil.prioridades) linhas.push(`Prioridades: ${perfil.prioridades}`);
  if (linhas.length === 1) {
    linhas.push('Sem perfil tecnico informado: nao invente mao, categoria, meta ou historico.');
  }
  return linhas.join('\n');
}
