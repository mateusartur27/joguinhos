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
  /** Maior numero de cenas de escolha ate um final, entre todos os caminhos da arvore. */
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
 * Maior numero de cenas de escolha entre a raiz e um final, em QUALQUER
 * caminho da arvore. O final NAO entra na contagem: ele nao e uma escolha, e
 * a UI mostra "Final" no lugar de um numero de cena ([slug].astro).
 *
 * Precisa ser o MAIOR caminho, nao um caminho qualquer: desde o "ponto sem
 * volta" (geradores/historias.ts no content-engine), a arvore deixou de ter
 * profundidade uniforme — alguns ramos terminam na terceira escolha, pulando
 * a quarta. Seguir so o caminho de opcaoA (como antes) podia calhar de medir
 * um ramo curto e legendar "Cena 1 de 3" pra gente que esta, na verdade, numa
 * historia de 4 cenas — o denominador errado pra quem nao pegou aquele ramo.
 */
function calcularProfundidade(nos: NoHistoria[], raizId: number): number {
  const porId = new Map(nos.map((no) => [no.id, no]));

  function maiorCaminho(id: number): number {
    const no = porId.get(id);
    if (!no || no.ehFinal) return 0;

    const proximos = [no.opcaoA?.proximoId, no.opcaoB?.proximoId].filter(
      (proximoId): proximoId is number => proximoId !== undefined,
    );
    const maiorFilho = proximos.length > 0 ? Math.max(...proximos.map(maiorCaminho)) : 0;
    return 1 + maiorFilho;
  }

  return maiorCaminho(raizId);
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
 * Historia de hoje dentro de uma categoria: a que foi gerada hoje, se
 * existir; senao, a mais recente disponivel daquela categoria.
 *
 * Antes disso a selecao era uma rotacao por indice do dia sobre TODAS as
 * historias ja publicadas (`dia % total`, mesmo truque de `desafioDeHoje`
 * em `lib/db/diario.ts`) — mas isso significava que gerar uma historia nova
 * nao garantia joga-la tao cedo: o indice so cai nela quando o calculo
 * calhar de apontar pra posicao alfabetica dela, o que pode levar dias ou
 * semanas dependendo do tamanho do acervo da categoria. O usuario apontou
 * que isso nao fazia sentido (gerar hoje, jogar uma historia antiga).
 *
 * `ORDER BY for_date DESC, rowid DESC` sozinho ja resolve os dois casos: se
 * existe uma historia com `for_date` de hoje, ela e a mais recente possivel
 * e vem primeiro; senao, a consulta cai naturalmente na mais recente
 * disponivel (incluindo as historias antigas, com `for_date` NULL, que o
 * SQLite ordena por ultimo em DESC).
 */
export async function historiaDoDia(db: D1Database, categoriaSlug: string): Promise<Historia | null> {
  const { results } = await db
    .prepare(
      `SELECT slug, category FROM stories
        WHERE status = 'published'
        ORDER BY for_date DESC, rowid DESC`,
    )
    .all<{ slug: string; category: string }>();

  const daCategoria = results.filter((linha) => slugCategoria(linha.category) === categoriaSlug);
  if (daCategoria.length === 0) return null;

  return buscarHistoria(db, daCategoria[0]!.slug);
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
