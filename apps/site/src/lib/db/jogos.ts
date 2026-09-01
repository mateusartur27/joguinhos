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
}

export async function buscarJogos(db: D1Database): Promise<Jogo[]> {
  const { results } = await db
    .prepare(
      `SELECT slug, title, tagline, emoji, kind, href
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
    }>();

  return results.map((linha) => ({
    slug: linha.slug,
    titulo: linha.title,
    chamada: linha.tagline,
    emoji: linha.emoji,
    tipo: linha.kind,
    href: linha.href,
  }));
}
