/**
 * Portado de gerador-de-video/src/modules/rate-limited-fetch.ts.
 *
 * Onde as reservas de vaga ficam guardadas.
 *
 * Existe como porta, e nao como detalhe interno, porque o escopo da protecao
 * **e** a escolha do adaptador: em memoria protege uma execucao; em D1 protege
 * todas as execucoes da conta, que e o unico escopo que corresponde ao limite
 * real da API.
 */
export interface RateLimitReservationStore {
  /**
   * Reserva a proxima vaga de `binding` e devolve o instante (epoch ms) em que
   * a chamada pode sair — `now` quando a vaga esta livre, um instante futuro
   * quando ha fila.
   *
   * A reserva e um efeito colateral de proposito: quem chama **ja consumiu** a
   * vaga ao perguntar, senao duas chamadas concorrentes leriam o mesmo estado
   * livre e sairiam juntas, que e exatamente o defeito a evitar.
   */
  reserve(binding: string, intervalMs: number, now: number): Promise<number>;
}

/**
 * Reservas na memoria do processo. Protege **uma** execucao.
 *
 * Todo o calculo acontece antes de qualquer `await` — o corpo e sincrono de
 * proposito, mesmo o metodo sendo `async`. E o que faz duas chamadas
 * concorrentes da mesma execucao se enfileirarem sem lock nenhum (JavaScript
 * so troca de tarefa num ponto de `await`).
 */
export class InMemoryRateLimitReservationStore implements RateLimitReservationStore {
  private readonly nextAvailableAt = new Map<string, number>();

  async reserve(binding: string, intervalMs: number, now: number): Promise<number> {
    const scheduledAt = Math.max(now, this.nextAvailableAt.get(binding) ?? 0);
    this.nextAvailableAt.set(binding, scheduledAt + intervalMs);
    return scheduledAt;
  }
}

export interface RateLimitedFetchOptions {
  callsPerMinute: number;
  /** Cota que este `fetch` consome. Nomes diferentes nao se afetam. */
  binding?: string;
  store?: RateLimitReservationStore;
  fetch?: typeof fetch;
  /** Chamado quando a reserva compartilhada falha e o espacamento cai para o escopo local. */
  onReservationError?: (error: unknown) => void;
}

const DEFAULT_BINDING = 'default';

/**
 * `fetch` que respeita um teto de chamadas por minuto, enfileirando qualquer
 * chamada que chegue cedo demais em vez de dispara-la e deixar o provedor
 * recusar com 429.
 *
 * **Falha de reserva degrada, nao derruba.** Se o armazenamento compartilhado
 * nao responder, o espacamento continua valendo no escopo local e a chamada
 * segue. A degradacao e sempre relatada por `onReservationError`.
 */
export function createRateLimitedFetch(options: RateLimitedFetchOptions): typeof fetch {
  if (!Number.isFinite(options.callsPerMinute) || options.callsPerMinute <= 0) {
    throw new RangeError('callsPerMinute must be a positive number');
  }
  const intervalMs = 60_000 / options.callsPerMinute;
  const fetcher = options.fetch ?? fetch;
  const binding = options.binding ?? DEFAULT_BINDING;
  const store = options.store ?? new InMemoryRateLimitReservationStore();
  // Instancia propria, nunca a de `store`: quando a reserva compartilhada
  // falha, o espacamento local precisa de um estado que nao dependa do que
  // acabou de falhar.
  const localFallback = new InMemoryRateLimitReservationStore();

  return (async (...args: Parameters<typeof fetch>) => {
    let scheduledAt: number;
    try {
      scheduledAt = await store.reserve(binding, intervalMs, Date.now());
    } catch (error) {
      options.onReservationError?.(error);
      scheduledAt = await localFallback.reserve(binding, intervalMs, Date.now());
    }

    const waitMs = scheduledAt - Date.now();
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    return fetcher(...args);
  }) as typeof fetch;
}
