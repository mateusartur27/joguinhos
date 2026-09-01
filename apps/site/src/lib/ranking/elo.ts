/**
 * Elo para o Ranking Coletivo.
 *
 * O ranking nao pode ser "quem recebeu mais votos": cada item disputa um numero
 * diferente de duelos e contra adversarios de forca diferente. Elo resolve os
 * dois de uma vez — ganhar de um favorito vale mais do que ganhar de um
 * azarao, e a posicao nao depende de quantas vezes o item apareceu.
 */

/**
 * Quanto um duelo mexe no rating.
 *
 * 24 e um meio-termo deliberado: alto o bastante para o ranking sair do empate
 * inicial (todo mundo em 1500) depois de algumas centenas de duelos, e baixo o
 * bastante para uma zebra isolada nao virar o topo da tabela.
 */
export const K_PADRAO = 24;

/** Probabilidade de `ratingA` vencer `ratingB`, pela curva logistica do Elo. */
export function probabilidadeDeVitoria(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export interface ResultadoElo {
  vencedor: number;
  perdedor: number;
}

/**
 * Novos ratings depois de um duelo.
 *
 * O que o vencedor ganha e exatamente o que o perdedor perde: a soma dos
 * ratings da lista nunca muda, entao a tabela e sempre comparavel consigo
 * mesma, por mais duelos que aconteçam.
 */
export function aplicarDuelo(
  ratingVencedor: number,
  ratingPerdedor: number,
  k: number = K_PADRAO,
): ResultadoElo {
  const esperado = probabilidadeDeVitoria(ratingVencedor, ratingPerdedor);
  const ganho = k * (1 - esperado);

  return {
    vencedor: ratingVencedor + ganho,
    perdedor: ratingPerdedor - ganho,
  };
}
