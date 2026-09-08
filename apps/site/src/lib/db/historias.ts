/**
 * Acesso ao D1 de Historia Interativa.
 *
 * Primeiro conteudo do site em arvore, nao lista plana: cada no tem ate duas
 * escolhas que levam a outro no, ate chegar num final. A arvore inteira cabe
 * numa historia curta, entao sai do banco de uma vez so — mesmo trade-off do
 * Quiz embutir a rodada inteira, aqui aplicado a arvore inteira em vez de
 * uma lista de perguntas.
 */

import { parseCartoes } from './jogos';

export interface OpcaoNo {
  rotulo: string;
  proximoId: number;
}

export interface NoHistoria {
  id: number;
  texto: string;
  ehFinal: boolean;
  opcaoA: OpcaoNo | null;
  opcaoB: OpcaoNo | null;
}

export interface Historia {
  slug: string;
  titulo: string;
  categoria: string;
  cor: string;
  coresCartoes: string[];
  raizId: number;
  nos: NoHistoria[];
}

interface LinhaNo {
  id: number;
  is_root: number;
  is_ending: number;
  text: string;
  choice_a_label: string | null;
  choice_a_next_id: number | null;
  choice_b_label: string | null;
  choice_b_next_id: number | null;
}

export async function buscarHistoria(db: D1Database, slug: string): Promise<Historia | null> {
  const historia = await db
    .prepare(
      `SELECT slug, title, category, color, card_colors
         FROM stories
        WHERE slug = ? AND status = 'published'`,
    )
    .bind(slug)
    .first<{ slug: string; title: string; category: string; color: string; card_colors: string }>();

  if (!historia) return null;

  const { results } = await db
    .prepare(
      `SELECT id, is_root, is_ending, text, choice_a_label, choice_a_next_id,
              choice_b_label, choice_b_next_id
         FROM story_nodes
        WHERE story_slug = ?`,
    )
    .bind(slug)
    .all<LinhaNo>();

  const raiz = results.find((no) => no.is_root === 1);
  if (!raiz) return null;

  return {
    slug: historia.slug,
    titulo: historia.title,
    categoria: historia.category,
    cor: historia.color,
    coresCartoes: parseCartoes(historia.card_colors),
    raizId: raiz.id,
    nos: results.map((no) => ({
      id: no.id,
      texto: no.text,
      ehFinal: no.is_ending === 1,
      opcaoA: no.choice_a_label
        ? { rotulo: no.choice_a_label, proximoId: no.choice_a_next_id! }
        : null,
      opcaoB: no.choice_b_label
        ? { rotulo: no.choice_b_label, proximoId: no.choice_b_next_id! }
        : null,
    })),
  };
}

/** Abaixo disso o percentual entre finais ainda e ruido. */
const CHEGADAS_MINIMAS_PARA_PERCENTUAL = 20;

/**
 * Registra a chegada a um final e devolve quantas vezes esse final
 * especifico foi alcancado e o percentual sobre todos os finais da mesma
 * historia — "X% dos jogadores chegaram aqui".
 */
export async function registrarFinal(
  db: D1Database,
  storySlug: string,
  nodeId: number,
): Promise<{ vezes: number; percentual: number | null } | null> {
  const linha = await db
    .prepare(
      `UPDATE story_nodes
          SET times_reached = times_reached + 1
        WHERE id = ? AND story_slug = ? AND is_ending = 1
    RETURNING times_reached`,
    )
    .bind(nodeId, storySlug)
    .first<{ times_reached: number }>();

  if (!linha) return null;

  const total = await db
    .prepare(
      `SELECT COALESCE(SUM(times_reached), 0) AS total
         FROM story_nodes
        WHERE story_slug = ? AND is_ending = 1`,
    )
    .bind(storySlug)
    .first<{ total: number }>();

  const totalizado = total?.total ?? 0;

  return {
    vezes: linha.times_reached,
    percentual:
      totalizado >= CHEGADAS_MINIMAS_PARA_PERCENTUAL
        ? Math.round((linha.times_reached / totalizado) * 100)
        : null,
  };
}
