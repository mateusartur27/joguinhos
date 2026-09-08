/**
 * Acesso ao D1 do jogo Adivinhe Antes de Revelar.
 *
 * Continuo, sem rodada fixa nem tela final — mesmo formato de Escolhas
 * Impossiveis, so que com 4 alternativas em vez de 2 (por isso a taxa de
 * acerto ja vem pronta no sorteio, no molde do Quiz: e mais simples do que
 * recalcular o agregado a cada resposta como Escolhas faz).
 */

export interface Palpite {
  id: number;
  categoria: string;
  prompt: string;
  alternativas: string[];
  correta: number;
  valorReal: string;
  explicacao: string | null;
  /** Taxa historica de acerto, ou `null` enquanto a amostra for pequena demais. */
  taxaAcerto: number | null;
}

/** Abaixo disso a taxa de acerto ainda e ruido e a tela nao mostra numero. */
export const RESPOSTAS_MINIMAS_PARA_TAXA = 20;

/** Mesmo teto de Escolhas Impossiveis — ver `lib/db/dilemas.ts`. */
const MAX_EXCLUSOES = 150;

function normalizarExclusoes(ids: readonly number[]): number[] {
  const validos = ids.filter((id) => Number.isInteger(id) && id > 0);
  return validos.slice(-MAX_EXCLUSOES);
}

/**
 * Sorteia palpites publicados que a pessoa ainda nao viu.
 *
 * Quando o acervo acaba, a exclusao e ignorada em vez de devolver lista
 * vazia — mesma regra de `sortearDilemas`.
 */
export async function sortearPalpites(
  db: D1Database,
  { excluir = [], limite = 3 }: { excluir?: readonly number[]; limite?: number } = {},
): Promise<Palpite[]> {
  const exclusoes = normalizarExclusoes(excluir);

  const linhas = await consultar(db, exclusoes, limite);
  if (linhas.length > 0) return linhas;
  return exclusoes.length > 0 ? consultar(db, [], limite) : [];
}

interface LinhaPalpite {
  id: number;
  category: string;
  prompt: string;
  choices_json: string;
  correct_index: number;
  real_value: string;
  explanation: string | null;
  times_shown: number;
  times_correct: number;
}

async function consultar(db: D1Database, exclusoes: number[], limite: number): Promise<Palpite[]> {
  const filtro =
    exclusoes.length > 0 ? `AND id NOT IN (${exclusoes.map(() => '?').join(',')})` : '';

  const { results } = await db
    .prepare(
      `SELECT id, category, prompt, choices_json, correct_index, real_value, explanation,
              times_shown, times_correct
         FROM guesses
        WHERE status = 'published' ${filtro}
        ORDER BY RANDOM()
        LIMIT ?`,
    )
    .bind(...exclusoes, limite)
    .all<LinhaPalpite>();

  return results.flatMap((linha) => {
    let alternativas: unknown;
    try {
      alternativas = JSON.parse(linha.choices_json);
    } catch {
      // Registro com JSON quebrado sai da fila em vez de derrubar a pagina —
      // o conteudo vem de geracao automatica.
      return [];
    }
    if (!Array.isArray(alternativas) || alternativas.length < 2) return [];

    return [
      {
        id: linha.id,
        categoria: linha.category,
        prompt: linha.prompt,
        alternativas: alternativas.map(String),
        correta: linha.correct_index,
        valorReal: linha.real_value,
        explicacao: linha.explanation,
        taxaAcerto:
          linha.times_shown >= RESPOSTAS_MINIMAS_PARA_TAXA
            ? linha.times_correct / linha.times_shown
            : null,
      },
    ];
  });
}

/**
 * Contabiliza um palpite.
 *
 * O cliente informa se acertou porque ele ja tem o gabarito (embutido no
 * HTML/fetch, mesmo trade-off do Quiz) — conferir nao protegeria nada.
 */
export async function registrarPalpite(
  db: D1Database,
  id: number,
  acertou: boolean,
): Promise<boolean> {
  const resultado = await db
    .prepare(
      `UPDATE guesses
          SET times_shown = times_shown + 1,
              times_correct = times_correct + ?
        WHERE id = ? AND status = 'published'`,
    )
    .bind(acertou ? 1 : 0, id)
    .run();

  return resultado.meta.changes === 1;
}
