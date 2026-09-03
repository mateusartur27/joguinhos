/**
 * Acesso ao D1 do Quiz rapido.
 *
 * A rodada inteira sai do banco de uma vez e vai embutida no HTML — incluindo
 * a resposta certa. E uma troca deliberada: quem abrir o codigo-fonte consegue
 * colar, mas ninguem ganha nada com isso, e em troca o feedback de cada
 * resposta e instantaneo, sem ida de rede no meio da rodada. Latencia entre
 * responder e ver o resultado e o que quebra o ritmo do jogo.
 */

import { parseCartoes } from './jogos';

export interface Tema {
  slug: string;
  titulo: string;
  emoji: string;
  dificuldade: string;
  cor: string;
  coresCartoes: string[];
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
      `SELECT slug, title, emoji, difficulty, color, card_colors
         FROM quiz_topics
        WHERE slug = ? AND status = 'published'`,
    )
    .bind(slug)
    .first<{
      slug: string;
      title: string;
      emoji: string;
      difficulty: string;
      color: string;
      card_colors: string;
    }>();

  if (!linha) return null;
  return {
    slug: linha.slug,
    titulo: linha.title,
    emoji: linha.emoji,
    dificuldade: linha.difficulty,
    cor: linha.color,
    coresCartoes: parseCartoes(linha.card_colors),
  };
}

interface LinhaPergunta {
  id: number;
  prompt: string;
  choices_json: string;
  correct_index: number;
  explanation: string | null;
  times_shown: number;
  times_correct: number;
}

async function buscarPerguntas(
  db: D1Database,
  temaSlug: string,
  quantidade: number,
  excluirIds: number[],
): Promise<LinhaPergunta[]> {
  // `IN ()` vazio e erro de sintaxe no SQLite, entao o filtro so entra na
  // query quando ha algo para excluir.
  const filtroExclusao = excluirIds.length > 0 ? `AND id NOT IN (${excluirIds.map(() => '?').join(',')})` : '';

  const { results } = await db
    .prepare(
      `SELECT id, prompt, choices_json, correct_index, explanation, times_shown, times_correct
         FROM quiz_questions
        WHERE topic_slug = ? AND status = 'published' ${filtroExclusao}
        ORDER BY RANDOM()
        LIMIT ?`,
    )
    .bind(temaSlug, ...excluirIds, quantidade)
    .all<LinhaPergunta>();

  return results;
}

/**
 * Sorteia uma rodada, evitando repetir perguntas ja vistas nesta sessao.
 *
 * `excluirIds` vem do cliente (localStorage, mesmo padrao de Escolhas
 * Impossiveis) — sem isso, "jogar de novo" sorteava de novo entre as mesmas
 * poucas perguntas do tema e caia quase sempre nas mesmas. Se a exclusao
 * esgotar o acervo do tema (`resultados.length === 0`), a funcao cai para o
 * sorteio sem exclusao: repetir e melhor que mostrar tela vazia para quem ja
 * viu tudo.
 */
export async function sortearRodada(
  db: D1Database,
  temaSlug: string,
  quantidade: number = PERGUNTAS_POR_RODADA,
  excluirIds: number[] = [],
): Promise<Pergunta[]> {
  const linhas = await buscarPerguntas(db, temaSlug, quantidade, excluirIds);
  const resultado = linhas.length > 0 || excluirIds.length === 0
    ? linhas
    : await buscarPerguntas(db, temaSlug, quantidade, []);

  return resultado.flatMap((linha) => {
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
