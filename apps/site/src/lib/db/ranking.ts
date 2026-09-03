/**
 * Acesso ao D1 do Ranking Coletivo.
 */

import { aplicarDuelo } from '../ranking/elo';

export interface Lista {
  slug: string;
  titulo: string;
  pergunta: string;
  emoji: string;
}

export interface Competidor {
  id: number;
  rotulo: string;
}

export interface Duelo {
  a: Competidor;
  b: Competidor;
}

export interface PosicaoRanking {
  id: number;
  rotulo: string;
  rating: number;
  duelos: number;
  vitorias: number;
}

export interface ResultadoDuelo {
  vencedor: PosicaoRanking & { posicao: number };
  /** Taxa do perdedor tambem volta, para a tela comparar os dois lados. */
  perdedor: PosicaoRanking;
  totalDuelos: number;
}

/**
 * Quantos competidores entram no sorteio do proximo duelo.
 *
 * O sorteio sai dos menos disputados, nao da lista inteira: o defeito que
 * aparece primeiro num ranking par a par nao e ordenacao ruim, e cobertura —
 * alguns itens aparecem dezenas de vezes enquanto outros nunca saem do 1500
 * inicial. Sortear dentro dos menos vistos corrige isso sem tornar a sequencia
 * previsivel (por isso um grupo, e nao "o menos disputado").
 */
const POOL_DE_SORTEIO = 8;

/** Abaixo disso a taxa de vitoria ainda e ruido, e a tela fala outra coisa. */
export const DUELOS_MINIMOS_PARA_TAXA = 10;

export async function buscarLista(db: D1Database, slug: string): Promise<Lista | null> {
  const linha = await db
    .prepare(
      `SELECT slug, title, question, emoji
         FROM ranking_lists
        WHERE slug = ? AND status = 'published'`,
    )
    .bind(slug)
    .first<{ slug: string; title: string; question: string; emoji: string }>();

  if (!linha) return null;
  return {
    slug: linha.slug,
    titulo: linha.title,
    pergunta: linha.question,
    emoji: linha.emoji,
  };
}

/** Sorteia dois competidores entre os menos disputados da lista. */
export async function sortearDuelo(db: D1Database, listaSlug: string): Promise<Duelo | null> {
  const { results } = await db
    .prepare(
      `SELECT id, label FROM (
         SELECT id, label, matches
           FROM ranking_entries
          WHERE list_slug = ? AND status = 'published'
          ORDER BY matches ASC
          LIMIT ?
       )
       ORDER BY RANDOM()
       LIMIT 2`,
    )
    .bind(listaSlug, POOL_DE_SORTEIO)
    .all<{ id: number; label: string }>();

  if (results.length < 2) return null;

  const [a, b] = results;
  return {
    a: { id: a!.id, rotulo: a!.label },
    b: { id: b!.id, rotulo: b!.label },
  };
}

/**
 * Registra o duelo e devolve o vencedor ja com rating, taxa e posicao novos.
 *
 * Diferente do voto de Escolhas Impossiveis, aqui nao da para incrementar
 * as cegas: o novo rating depende do rating dos dois. As duas escritas vao num
 * `batch()` (transacao), entao ninguem observa metade do duelo aplicada. Dois
 * duelos simultaneos envolvendo o mesmo competidor ainda podem se sobrepor e
 * causar um desvio pequeno de rating — aceitavel num ranking de opiniao, e o
 * custo de evitar seria serializar todos os duelos da lista.
 */
export async function registrarDuelo(
  db: D1Database,
  listaSlug: string,
  vencedorId: number,
  perdedorId: number,
): Promise<ResultadoDuelo | null> {
  if (vencedorId === perdedorId) return null;

  const { results } = await db
    .prepare(
      `SELECT id, label, rating, matches, wins
         FROM ranking_entries
        WHERE list_slug = ? AND status = 'published' AND id IN (?, ?)`,
    )
    .bind(listaSlug, vencedorId, perdedorId)
    .all<{ id: number; label: string; rating: number; matches: number; wins: number }>();

  // Os ids vem do cliente: so seguem se os dois existirem mesmo nesta lista.
  if (results.length !== 2) return null;

  const vencedor = results.find((linha) => linha.id === vencedorId);
  const perdedor = results.find((linha) => linha.id === perdedorId);
  if (!vencedor || !perdedor) return null;

  const novos = aplicarDuelo(vencedor.rating, perdedor.rating);

  await db.batch([
    db
      .prepare(
        `UPDATE ranking_entries
            SET rating = ?, matches = matches + 1, wins = wins + 1
          WHERE id = ?`,
      )
      .bind(novos.vencedor, vencedorId),
    db
      .prepare(
        `UPDATE ranking_entries
            SET rating = ?, matches = matches + 1
          WHERE id = ?`,
      )
      .bind(novos.perdedor, perdedorId),
  ]);

  const posicao = await db
    .prepare(
      `SELECT COUNT(*) + 1 AS posicao
         FROM ranking_entries
        WHERE list_slug = ? AND status = 'published' AND rating > ?`,
    )
    .bind(listaSlug, novos.vencedor)
    .first<{ posicao: number }>();

  const total = await db
    .prepare(
      `SELECT COALESCE(SUM(matches), 0) AS duelos
         FROM ranking_entries
        WHERE list_slug = ? AND status = 'published'`,
    )
    .bind(listaSlug)
    .first<{ duelos: number }>();

  return {
    vencedor: {
      id: vencedorId,
      rotulo: vencedor.label,
      rating: novos.vencedor,
      duelos: vencedor.matches + 1,
      vitorias: vencedor.wins + 1,
      posicao: posicao?.posicao ?? 1,
    },
    perdedor: {
      id: perdedorId,
      rotulo: perdedor.label,
      rating: novos.perdedor,
      duelos: perdedor.matches + 1,
      vitorias: perdedor.wins,
    },
    // Cada duelo conta em dois competidores; a metade e o numero de disputas.
    totalDuelos: Math.floor((total?.duelos ?? 0) / 2),
  };
}

export async function buscarRanking(
  db: D1Database,
  listaSlug: string,
): Promise<PosicaoRanking[]> {
  const { results } = await db
    .prepare(
      `SELECT id, label, rating, matches, wins
         FROM ranking_entries
        WHERE list_slug = ? AND status = 'published'
        ORDER BY rating DESC, wins DESC, label ASC`,
    )
    .bind(listaSlug)
    .all<{ id: number; label: string; rating: number; matches: number; wins: number }>();

  return results.map((linha) => ({
    id: linha.id,
    rotulo: linha.label,
    rating: linha.rating,
    duelos: linha.matches,
    vitorias: linha.wins,
  }));
}
