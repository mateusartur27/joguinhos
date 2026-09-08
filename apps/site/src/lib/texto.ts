/**
 * Normalizacao de texto compartilhada entre a busca da home e a comparacao de
 * palpite do Jogo Diario.
 */

/** Remove acento para "voce"/"crstiano ronaldo" combinarem com a grafia correta. */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
