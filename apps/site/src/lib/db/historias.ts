/**
 * Acesso ao D1 de Historia Interativa.
 *
 * Jogo unico com selecao por tema: a pessoa escolhe uma categoria e joga a
 * historia daquela categoria de hoje — mesmo truque de selecao
 * deterministica do Jogo Diario (`lib/db/diario.ts`), so que com um filtro
 * de categoria por cima. A arvore inteira de uma historia cabe numa leitura
 * so, entao sai do banco de uma vez — mesmo trade-off do Quiz embutir a
 * rodada inteira, aqui aplicado a arvore em vez de uma lista de perguntas.
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
  /** So preenchido quando `ehFinal` e verdadeiro. */
  resultado: 'vitoria' | 'derrota' | null;
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
  /** Quantas cenas ate um final, incluindo a raiz — varia por historia. */
  profundidadeTotal: number;
  nos: NoHistoria[];
}

interface LinhaNo {
  id: number;
  is_root: number;
  is_ending: number;
  text: string;
  outcome: string | null;
  choice_a_label: string | null;
  choice_a_next_id: number | null;
  choice_b_label: string | null;
  choice_b_next_id: number | null;
}

/** Sem acento e minusculo, para "Ficção científica" virar "ficcao-cientifica". */
export function slugCategoria(categoria: string): string {
  return categoria
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
      `SELECT id, is_root, is_ending, text, outcome, choice_a_label, choice_a_next_id,
              choice_b_label, choice_b_next_id
         FROM story_nodes
        WHERE story_slug = ?`,
    )
    .bind(slug)
    .all<LinhaNo>();

  const raiz = results.find((no) => no.is_root === 1);
  if (!raiz) return null;

  const nos: NoHistoria[] = results.map((no) => ({
    id: no.id,
    texto: no.text,
    ehFinal: no.is_ending === 1,
    resultado: no.outcome === 'vitoria' || no.outcome === 'derrota' ? no.outcome : null,
    opcaoA: no.choice_a_label
      ? { rotulo: no.choice_a_label, proximoId: no.choice_a_next_id! }
      : null,
    opcaoB: no.choice_b_label
      ? { rotulo: no.choice_b_label, proximoId: no.choice_b_next_id! }
      : null,
  }));

  return {
    slug: historia.slug,
    titulo: historia.title,
    categoria: historia.category,
    cor: historia.color,
    coresCartoes: parseCartoes(historia.card_colors),
    raizId: raiz.id,
    profundidadeTotal: calcularProfundidade(nos, raiz.id),
    nos,
  };
}

/**
 * Conta cenas da raiz ate um final, seguindo so um caminho (A, ou B se A nao
 * existir). A arvore e sempre uniforme em profundidade — todo caminho tem o
 * mesmo tamanho — entao um caminho so basta.
 */
function calcularProfundidade(nos: NoHistoria[], raizId: number): number {
  const porId = new Map(nos.map((no) => [no.id, no]));
  let atual = porId.get(raizId);
  let profundidade = 0;

  while (atual) {
    profundidade += 1;
    if (atual.ehFinal) break;
    const proximoId = atual.opcaoA?.proximoId ?? atual.opcaoB?.proximoId;
    atual = proximoId === undefined ? undefined : porId.get(proximoId);
  }

  return profundidade;
}

export interface CategoriaHistoria {
  categoria: string;
  slug: string;
  cor: string;
  coresCartoes: string[];
}

/**
 * Categorias com pelo menos uma historia publicada — alimenta a tela de
 * escolha de tema. `GROUP BY category` pega uma linha representativa de
 * cada categoria: todas as historias da mesma categoria tem a mesma
 * cor/card_colors (atribuidas por categoria no gerador, nao por historia).
 */
export async function categoriasComHistoria(db: D1Database): Promise<CategoriaHistoria[]> {
  const { results } = await db
    .prepare(
      `SELECT category, color, card_colors
         FROM stories
        WHERE status = 'published'
        GROUP BY category
        ORDER BY category`,
    )
    .all<{ category: string; color: string; card_colors: string }>();

  return results.map((linha) => ({
    categoria: linha.category,
    slug: slugCategoria(linha.category),
    cor: linha.color,
    coresCartoes: parseCartoes(linha.card_colors),
  }));
}

/**
 * Historia de hoje dentro de uma categoria — mesmo indice deterministico de
 * `desafioDeHoje` (`lib/db/diario.ts`), agora filtrado por categoria: todo
 * mundo que escolhe o mesmo tema no mesmo dia joga a mesma historia.
 */
export async function historiaDoDia(db: D1Database, categoriaSlug: string): Promise<Historia | null> {
  const { results } = await db
    .prepare("SELECT slug, category FROM stories WHERE status = 'published' ORDER BY slug ASC")
    .all<{ slug: string; category: string }>();

  const daCategoria = results.filter((linha) => slugCategoria(linha.category) === categoriaSlug);
  if (daCategoria.length === 0) return null;

  const indiceDoDia = Math.floor(Date.now() / 86_400_000) % daCategoria.length;
  return buscarHistoria(db, daCategoria[indiceDoDia]!.slug);
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
