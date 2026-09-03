/**
 * Acesso ao D1 do Quiz rapido.
 *
 * A rodada inteira sai do banco de uma vez e vai embutida no HTML — incluindo
 * a resposta certa. E uma troca deliberada: quem abrir o codigo-fonte consegue
 * colar, mas ninguem ganha nada com isso, e em troca o feedback de cada
 * resposta e instantaneo, sem ida de rede no meio da rodada. Latencia entre
 * responder e ver o resultado e o que quebra o ritmo do jogo.
 */

export interface Tema {
  slug: string;
  titulo: string;
  emoji: string;
  dificuldade: string;
  cor: string;
}

export interface Pergunta {
  id: number;
  enunciado: string;
  alternativas: string[];
  correta: number;
  explicacao: string | null;
  /** Taxa historica de acerto, ou `null` enquanto a amostra for pequena demais. */
  taxaAcerto: number | null;
}

/** Abaixo disso a taxa de acerto ainda e ruido e a tela nao mostra numero. */
export const RESPOSTAS_MINIMAS_PARA_TAXA = 20;

/** Perguntas por rodada. Curta o bastante para terminar; longa o bastante para engatar. */
export const PERGUNTAS_POR_RODADA = 8;

export async function buscarTema(db: D1Database, slug: string): Promise<Tema | null> {
  const linha = await db
    .prepare(
      `SELECT slug, title, emoji, difficulty, color
         FROM quiz_topics
        WHERE slug = ? AND status = 'published'`,
    )
    .bind(slug)
    .first<{ slug: string; title: string; emoji: string; difficulty: string; color: string }>();

  if (!linha) return null;
  return {
    slug: linha.slug,
    titulo: linha.title,
    emoji: linha.emoji,
    dificuldade: linha.difficulty,
    cor: linha.color,
  };
}

export async function sortearRodada(
  db: D1Database,
  temaSlug: string,
  quantidade: number = PERGUNTAS_POR_RODADA,
): Promise<Pergunta[]> {
  const { results } = await db
    .prepare(
      `SELECT id, prompt, choices_json, correct_index, explanation, times_shown, times_correct
         FROM quiz_questions
        WHERE topic_slug = ? AND status = 'published'
        ORDER BY RANDOM()
        LIMIT ?`,
    )
    .bind(temaSlug, quantidade)
    .all<{
      id: number;
      prompt: string;
      choices_json: string;
      correct_index: number;
      explanation: string | null;
      times_shown: number;
      times_correct: number;
    }>();

  return results.flatMap((linha) => {
    let alternativas: unknown;
    try {
      alternativas = JSON.parse(linha.choices_json);
    } catch {
      // Pergunta com JSON quebrado sai da rodada em vez de derrubar a pagina:
      // o conteudo vem de geracao automatica e um registro ruim nao pode
      // custar a rodada inteira.
      return [];
    }
    if (!Array.isArray(alternativas) || alternativas.length < 2) return [];

    return [
      {
        id: linha.id,
        enunciado: linha.prompt,
        alternativas: alternativas.map(String),
        correta: linha.correct_index,
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
 * Contabiliza uma resposta.
 *
 * Os dois contadores sobem no mesmo UPDATE atomico. O cliente informa se
 * acertou porque ele ja tem o gabarito (veio no HTML) — conferir de novo aqui
 * nao protegeria nada e custaria uma leitura.
 */
export async function registrarResposta(
  db: D1Database,
  id: number,
  acertou: boolean,
): Promise<boolean> {
  const resultado = await db
    .prepare(
      `UPDATE quiz_questions
          SET times_shown = times_shown + 1,
              times_correct = times_correct + ?
        WHERE id = ? AND status = 'published'`,
    )
    .bind(acertou ? 1 : 0, id)
    .run();

  return resultado.meta.changes === 1;
}
