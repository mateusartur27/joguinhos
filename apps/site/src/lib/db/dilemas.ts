/**
 * Acesso ao D1 do jogo Escolhas Impossiveis.
 *
 * O agregado que a pessoa ve depois de votar e o mesmo numero que vira video
 * depois ("71% escolheram X"), entao ele sai sempre do banco, nunca de uma
 * contagem otimista no cliente.
 */

export interface Dilema {
  id: number;
  categoria: string;
  opcaoA: string;
  opcaoB: string;
}

export interface ResultadoDilema {
  id: number;
  votosA: number;
  votosB: number;
  total: number;
}

export type Escolha = 'a' | 'b';

/**
 * Teto de ids que aceitamos excluir do sorteio.
 *
 * A lista de vistos vive no `localStorage` e cresce para sempre; sem teto, uma
 * pessoa que jogou muito mandaria uma query com milhares de parametros a cada
 * rodada. Cortar nos mais recentes preserva o que importa (nao repetir o que
 * acabou de sair) e mantem a consulta previsivel.
 */
const MAX_EXCLUSOES = 150;

function normalizarExclusoes(ids: readonly number[]): number[] {
  const validos = ids.filter((id) => Number.isInteger(id) && id > 0);
  return validos.slice(-MAX_EXCLUSOES);
}

/**
 * Sorteia dilemas publicados que a pessoa ainda nao viu.
 *
 * Quando o acervo acaba (viu todos), a exclusao e ignorada em vez de devolver
 * lista vazia: repetir um dilema e muito melhor que a tela morrer no meio do
 * loop — o jogo nao tem fim por definicao.
 */
export async function sortearDilemas(
  db: D1Database,
  { excluir = [], limite = 3 }: { excluir?: readonly number[]; limite?: number } = {},
): Promise<Dilema[]> {
  const exclusoes = normalizarExclusoes(excluir);

  const linhas = await consultar(db, exclusoes, limite);
  if (linhas.length > 0) return linhas;
  return exclusoes.length > 0 ? consultar(db, [], limite) : [];
}

async function consultar(
  db: D1Database,
  exclusoes: number[],
  limite: number,
): Promise<Dilema[]> {
  const filtro =
    exclusoes.length > 0 ? `AND id NOT IN (${exclusoes.map(() => '?').join(',')})` : '';

  const { results } = await db
    .prepare(
      `SELECT id, category, option_a, option_b
         FROM dilemmas
        WHERE status = 'published' ${filtro}
        ORDER BY RANDOM()
        LIMIT ?`,
    )
    .bind(...exclusoes, limite)
    .all<{ id: number; category: string; option_a: string; option_b: string }>();

  return results.map((linha) => ({
    id: linha.id,
    categoria: linha.category,
    opcaoA: linha.option_a,
    opcaoB: linha.option_b,
  }));
}

/**
 * Registra o voto e devolve o agregado ja atualizado.
 *
 * Um unico UPDATE com RETURNING: o incremento e atomico no SQLite (nao ha
 * leitura antes da escrita para duas pessoas concorrentes disputarem) e o
 * resultado ja volta com os contadores frescos, sem segunda consulta.
 *
 * Devolve `null` quando o dilema nao existe ou nao esta publicado — o cliente
 * manda o id, entao ele nao e confiavel.
 */
export async function registrarVoto(
  db: D1Database,
  id: number,
  escolha: Escolha,
): Promise<ResultadoDilema | null> {
  const coluna = escolha === 'a' ? 'votes_a' : 'votes_b';

  const linha = await db
    .prepare(
      `UPDATE dilemmas
          SET ${coluna} = ${coluna} + 1
        WHERE id = ? AND status = 'published'
    RETURNING id, votes_a, votes_b`,
    )
    .bind(id)
    .first<{ id: number; votes_a: number; votes_b: number }>();

  if (!linha) return null;

  return {
    id: linha.id,
    votosA: linha.votes_a,
    votosB: linha.votes_b,
    total: linha.votes_a + linha.votes_b,
  };
}
