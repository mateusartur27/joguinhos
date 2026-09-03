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
  /**
   * "true" liga busca do Google nas perguntas de quiz. Exige faturamento
   * habilitado na conta Google (ver comentario em geradores/quiz.ts) — fica
   * "false" ate isso existir, senao a chamada falha com 429 e nenhuma
   * pergunta e gerada, o que e pior que gerar sem busca.
   */
  GEMINI_GROUNDING_ENABLED: string;
  /**
   * "true" publica direto, sem passar por rascunho. Decisao explicita do
   * dono do produto: e um jogo, nao noticia, e o erro observado (apelido de
   * personagem inventado) e menos grave que o custo de revisar toda vez.
   * "false" volta ao fluxo de rascunho + `scripts/conteudo.mjs`.
   */
  PUBLICAR_AUTOMATICO: string;
  ADMIN_TOKEN: string;
}

const DILEMAS_POR_EXECUCAO = 8;
const PERGUNTAS_POR_EXECUCAO = 5;

interface Relatorio {
  dilemas: ResultadoGeracao;
  quiz: (ResultadoGeracao & { tema: string })[];
}

/**
 * Uma execucao do motor de conteudo.
 *
 * `PUBLICAR_AUTOMATICO=true` (padrao) pula a fila de rascunho: o que o
 * Gemini gera vai direto ao ar. Decisao explicita do dono do produto — e um
 * jogo, nao noticia, e o erro real ja visto (apelido de personagem inventado
 * no quiz) e um resultado errado num microjogo, nao uma noticia falsa.
 *
 * O prompt do quiz (`geradores/quiz.ts`) ja pede fato objetivo e evita
 * apelido/epiteto de proposito por causa desse erro. O que a automacao total
 * NAO cobre e conteudo do dilema que viole politica do AdSense (o outro risco
 * documentado no README) — a instrucao do dilema ja proibe os temas
 * sensiveis, mas nada aqui verifica se o modelo obedeceu. Se um lote parecer
 * suspeito, `PUBLICAR_AUTOMATICO=false` volta ao fluxo de rascunho +
 * `scripts/conteudo.mjs`.
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

  const statusInicial = env.PUBLICAR_AUTOMATICO === 'true' ? 'published' : 'draft';
  const dilemas = await gerarDilemas(env.DB, gemini, DILEMAS_POR_EXECUCAO, statusInicial);

  const comBusca = env.GEMINI_GROUNDING_ENABLED === 'true';
  const temas = await temasPublicados(env.DB);
  const quiz: (ResultadoGeracao & { tema: string })[] = [];
  for (const tema of temas) {
    quiz.push({
      tema,
      ...(await gerarPerguntas(env.DB, gemini, tema, PERGUNTAS_POR_EXECUCAO, comBusca, statusInicial)),
    });
  }

  return { dilemas, quiz };
}

/**
 * Todos os temas de quiz publicados, para gerar pergunta nova em cada um
 * todo dia — nao so num tema por vez.
 *
 * Antes disso revezava um tema por dia (`diasDesdeEpoch % length`): com 3
 * temas, cada um so recebia lote a cada 3 dias, e o acervo ficava pequeno
 * demais para "jogar de novo" nao repetir pergunta na mesma sessao. Gerar
 * para todos e so 2 chamadas a mais ao Gemini por dia — sem custo real com
 * 3 temas.
 */
async function temasPublicados(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT slug FROM quiz_topics WHERE status = 'published' ORDER BY slug ASC")
    .all<{ slug: string }>();
  return results.map((linha) => linha.slug);
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
