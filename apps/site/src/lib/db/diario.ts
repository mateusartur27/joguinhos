/**
 * Acesso ao D1 do Jogo Diario.
 *
 * Diferente de todos os outros jogos, aqui NAO ha sorteio: todo mundo que
 * acessa no mesmo dia recebe o mesmo desafio (indice deterministico pelo dia
 * UTC). Isso e o que torna "melhor que X% dos jogadores de hoje" um dado de
 * verdade — comparar contra gente que jogou outra coisa nao faria sentido.
 */

export interface DesafioDoDia {
  id: number;
  categoria: string;
  resposta: string;
  respostasAceitas: string[];
  pistas: string[];
}

export async function desafioDeHoje(db: D1Database): Promise<DesafioDoDia | null> {
  const { results } = await db
    .prepare(
      `SELECT id, category, answer, accepted_answers_json, clues_json
         FROM daily_challenges
        WHERE status = 'published'
        ORDER BY id ASC`,
    )
    .all<{
      id: number;
      category: string;
      answer: string;
      accepted_answers_json: string;
      clues_json: string;
    }>();

  if (results.length === 0) return null;

  // Deterministico de proposito: e o que garante que todo mundo joga o mesmo
  // desafio no mesmo dia. Sortear tornaria o placar do dia sem sentido.
  const indiceDoDia = Math.floor(Date.now() / 86_400_000) % results.length;
  const linha = results[indiceDoDia]!;

  return {
    id: linha.id,
    categoria: linha.category,
    resposta: linha.answer,
    respostasAceitas: JSON.parse(linha.accepted_answers_json),
    pistas: JSON.parse(linha.clues_json),
  };
}

/** Data de hoje em UTC, formato 'YYYY-MM-DD' — chave de `daily_results`. */
export function dataDeHojeUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ResultadoTentativa = 1 | 2 | 3 | 4 | 5 | 'falhou';

/**
 * Registra a tentativa do dia. Upsert simples: a primeira jogada do dia cria
 * a linha, as seguintes so incrementam a coluna certa.
 */
export async function registrarTentativa(
  db: D1Database,
  playDate: string,
  challengeId: number,
  resultado: ResultadoTentativa,
): Promise<void> {
  const coluna = resultado === 'falhou' ? 'misses' : (`hits_${resultado}` as const);

  await db
    .prepare(
      `INSERT INTO daily_results (play_date, challenge_id, ${coluna})
       VALUES (?, ?, 1)
       ON CONFLICT (play_date) DO UPDATE SET ${coluna} = ${coluna} + 1`,
    )
    .bind(playDate, challengeId)
    .run();
}

export interface EstatisticasDoDia {
  /** hits[0] = acertos na pista 1, hits[4] = acertos na pista 5. */
  hits: number[];
  misses: number;
  total: number;
}

/** Abaixo disso o percentil ainda e ruido — mesmo principio de todo `%` do site. */
export const TENTATIVAS_MINIMAS_PARA_PERCENTIL = 20;

export async function estatisticasDoDia(
  db: D1Database,
  playDate: string,
): Promise<EstatisticasDoDia | null> {
  const linha = await db
    .prepare(
      `SELECT hits_1, hits_2, hits_3, hits_4, hits_5, misses
         FROM daily_results
        WHERE play_date = ?`,
    )
    .bind(playDate)
    .first<{
      hits_1: number;
      hits_2: number;
      hits_3: number;
      hits_4: number;
      hits_5: number;
      misses: number;
    }>();

  if (!linha) return null;

  const hits = [linha.hits_1, linha.hits_2, linha.hits_3, linha.hits_4, linha.hits_5];
  return {
    hits,
    misses: linha.misses,
    total: hits.reduce((soma, n) => soma + n, 0) + linha.misses,
  };
}

/**
 * Percentual de jogadores de hoje que se saíram pior que `pistaAcertada`
 * (acertaram numa pista depois, ou nem acertaram). `null` com amostra
 * pequena demais ou quando a propria pessoa nao acertou — nesse caso nao ha
 * "melhor que" para mostrar.
 */
export function percentilMelhorQue(
  estatisticas: EstatisticasDoDia,
  pistaAcertada: number,
): number | null {
  if (estatisticas.total < TENTATIVAS_MINIMAS_PARA_PERCENTIL) return null;

  const piores = estatisticas.hits.slice(pistaAcertada).reduce((soma, n) => soma + n, 0) +
    estatisticas.misses;

  return Math.round((piores / estatisticas.total) * 100);
}
