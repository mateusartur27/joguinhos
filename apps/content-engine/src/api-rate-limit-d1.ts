import type { RateLimitReservationStore } from './rate-limited-fetch';

/**
 * Portado de gerador-de-video/src/modules/persistence/api-rate-limit-d1.ts.
 *
 * Numero maximo de tentativas do compare-and-swap.
 *
 * Cada perda de corrida significa que **outra** execucao reservou a vaga nesse
 * intervalo, entao a proxima tentativa parte de um estado mais recente e tende
 * a vencer. O teto existe para uma disputa patologica nao virar laco infinito;
 * ao estourar, quem chama degrada para o espacamento local.
 */
const MAX_ATTEMPTS = 8;

/**
 * Reservas de vaga compartilhadas por todas as execucoes.
 *
 * O limitador em memoria protege **uma** execucao; o cron e as chamadas
 * manuais podem se sobrepor, e cada uma acharia ser a unica usando a cota.
 * D1 e o unico estado que elas ja compartilham.
 *
 * A reserva e um **compare-and-swap**: le o valor, calcula o proximo e so
 * grava se o valor lido ainda for o corrente. Um `UPDATE` cego pareceria mais
 * simples e estaria errado no ponto que importa — sem saber **qual** vaga foi
 * reservada, duas execucoes concorrentes receberiam o mesmo instante de saida.
 */
export class D1RateLimitReservationStore implements RateLimitReservationStore {
  constructor(private readonly db: D1Database) {}

  async reserve(binding: string, intervalMs: number, now: number): Promise<number> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const row = await this.db
        .prepare('SELECT next_available_at FROM api_rate_limits WHERE binding = ?')
        .bind(binding)
        .first<{ next_available_at: number }>();

      if (!row) {
        // Primeira chamada desta cota. `ON CONFLICT DO NOTHING` porque outra
        // execucao pode inserir entre a leitura acima e esta gravacao; perder
        // essa corrida nao e erro, so manda reler o estado que a outra deixou.
        const inserted = await this.db
          .prepare(
            'INSERT INTO api_rate_limits (binding, next_available_at) VALUES (?, ?) ON CONFLICT DO NOTHING',
          )
          .bind(binding, now + intervalMs)
          .run();
        if (inserted.meta.changes === 1) return now;
        continue;
      }

      const scheduledAt = Math.max(now, row.next_available_at);
      const swapped = await this.db
        .prepare(
          'UPDATE api_rate_limits SET next_available_at = ? WHERE binding = ? AND next_available_at = ?',
        )
        .bind(scheduledAt + intervalMs, binding, row.next_available_at)
        .run();
      if (swapped.meta.changes === 1) return scheduledAt;
    }

    throw new Error(
      `Não foi possível reservar vaga de rate limit para "${binding}" em ${MAX_ATTEMPTS} tentativas`,
    );
  }
}
