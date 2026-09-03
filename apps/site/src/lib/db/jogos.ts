/**
 * Catalogo de jogos da home.
 *
 * A home le a tabela em vez de ter a lista escrita no template porque cada
 * jogo novo (ou cada lista de ranking, ou cada tema de quiz) precisa aparecer
 * no catalogo sem exigir deploy — o motor de conteudo publica no banco.
 */

export interface Jogo {
  slug: string;
  titulo: string;
  chamada: string;
  emoji: string;
  tipo: string;
  href: string;
  cor: string;
}

export interface CoresDoJogo {
  /** Cor solida de fundo da pagina inteira. */
  fundo: string;
  /** Cores dos cartoes/botoes por cima do fundo — nunca a mesma cor do fundo. */
  cartoes: string[];
}

const CORES_PADRAO: CoresDoJogo = { fundo: '#7c3aed', cartoes: ['#f59e0b', '#2563eb'] };

/**
 * Cores de um unico jogo pelo slug em `games`.
 *
 * Existe para paginas que sao um jogo so (Escolhas Impossiveis nao tem uma
 * tabela por item, e um dilema so tem categoria) e ainda assim precisam da
 * cor vir do banco, nao hardcoded na pagina — a mesma regra do catalogo da
 * home vale aqui: cor e dado do jogo, nao decisao do template.
 */
export async function buscarCoresDoJogo(db: D1Database, slug: string): Promise<CoresDoJogo> {
  const linha = await db
    .prepare(`SELECT color, card_colors FROM games WHERE slug = ? AND status = 'published'`)
    .bind(slug)
    .first<{ color: string; card_colors: string }>();

  if (!linha) return CORES_PADRAO;
  return { fundo: linha.color, cartoes: parseCartoes(linha.card_colors) };
}

/** JSON quebrado ou vazio cai nas cores padrao em vez de derrubar a pagina. */
export function parseCartoes(json: string): string[] {
  try {
    const valor: unknown = JSON.parse(json);
    return Array.isArray(valor) && valor.every((v) => typeof v === 'string') && valor.length > 0
      ? valor
      : CORES_PADRAO.cartoes;
  } catch {
    return CORES_PADRAO.cartoes;
  }
}

export async function buscarJogos(db: D1Database): Promise<Jogo[]> {
  const { results } = await db
    .prepare(
      `SELECT slug, title, tagline, emoji, kind, href, color
         FROM games
        WHERE status = 'published'
        ORDER BY sort_order ASC, title ASC`,
    )
    .all<{
      slug: string;
      title: string;
      tagline: string;
      emoji: string;
      kind: string;
      href: string;
      color: string;
    }>();

  return results.map((linha) => ({
    slug: linha.slug,
    titulo: linha.title,
    chamada: linha.tagline,
    emoji: linha.emoji,
    tipo: linha.kind,
    href: linha.href,
    cor: linha.color,
  }));
}
