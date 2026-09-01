import { D1RateLimitReservationStore } from './api-rate-limit-d1';
import { Gemini } from './gemini';
import { gerarDilemas, type ResultadoGeracao } from './geradores/dilemas';
import { gerarPerguntas } from './geradores/quiz';
import { createRateLimitedFetch } from './rate-limited-fetch';

interface Ambiente {
  DB: D1Database;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  GEMINI_CALLS_PER_MINUTE: string;
  ADMIN_TOKEN: string;
}

const DILEMAS_POR_EXECUCAO = 8;
const PERGUNTAS_POR_EXECUCAO = 5;

interface Relatorio {
  dilemas: ResultadoGeracao;
  quiz: (ResultadoGeracao & { tema: string }) | null;
}

/**
 * Uma execucao do motor de conteudo.
 *
 * Tudo que entra fica como `draft`. Publicar automaticamente texto de LLM num
 * site com AdSense e assumir dois riscos de uma vez: erro factual no quiz e
 * violacao de politica no dilema. A revisao e barata; a suspensao nao.
 */
async function executar(env: Ambiente): Promise<Relatorio> {
  const store = new D1RateLimitReservationStore(env.DB);

  const fetchLimitado = createRateLimitedFetch({
    callsPerMinute: Number.parseInt(env.GEMINI_CALLS_PER_MINUTE ?? '10', 10) || 10,
    // A cota do provedor e por chave, entao a fila tambem e.
    binding: 'GEMINI_API_KEY',
    store,
    onReservationError: (erro) => {
      console.warn('Reserva compartilhada falhou; espaçamento caiu para o escopo local', erro);
    },
  });

  const gemini = new Gemini({
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
    fetch: fetchLimitado,
  });

  const dilemas = await gerarDilemas(env.DB, gemini, DILEMAS_POR_EXECUCAO);

  const tema = await temaDoDia(env.DB);
  const quiz = tema
    ? {
        tema,
        ...(await gerarPerguntas(env.DB, gemini, tema, PERGUNTAS_POR_EXECUCAO)),
      }
    : null;

  return { dilemas, quiz };
}

/**
 * Reveza os temas de quiz pelo dia.
 *
 * Deterministico de proposito: duas execucoes no mesmo dia (o cron e uma
 * chamada manual) trabalham no mesmo tema, e a checagem de duplicata ja cobre
 * a sobreposicao. Sortear tema faria o acervo crescer torto, com temas
 * atendidos por acaso.
 */
async function temaDoDia(db: D1Database): Promise<string | null> {
  const { results } = await db
    .prepare("SELECT slug FROM quiz_topics WHERE status = 'published' ORDER BY slug ASC")
    .all<{ slug: string }>();

  if (results.length === 0) return null;

  const diasDesdeEpoch = Math.floor(Date.now() / 86_400_000);
  return results[diasDesdeEpoch % results.length]!.slug;
}

export default {
  async scheduled(_controller: ScheduledController, env: Ambiente): Promise<void> {
    const relatorio = await executar(env);
    console.log('Geração de conteúdo concluída', JSON.stringify(relatorio));
  },

  /**
   * Disparo manual, para nao depender de esperar o cron.
   *
   * Protegido por token em header (nunca em query string: query aparece em log
   * de acesso e em referer).
   */
  async fetch(request: Request, env: Ambiente): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/gerar') {
      return new Response('Not found', { status: 404 });
    }

    const autorizacao = request.headers.get('authorization');
    if (!env.ADMIN_TOKEN || autorizacao !== `Bearer ${env.ADMIN_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      return Response.json(await executar(env));
    } catch (erro) {
      console.error('Falha na geração de conteúdo', erro);
      return Response.json(
        { erro: erro instanceof Error ? erro.message : 'falha desconhecida' },
        { status: 500 },
      );
    }
  },
};
