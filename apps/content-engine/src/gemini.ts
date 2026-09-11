/**
 * Cliente da API Interactions do Gemini, nos moldes do
 * gerador-de-video/src/modules/production-planner/gemini-interactions.ts:
 * REST direto, sem SDK, com saida estruturada por schema.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export interface GeminiOptions {
  apiKey: string;
  model: string;
  /** Sempre o `fetch` limitado por cota — ver `createRateLimitedFetch`. */
  fetch: typeof fetch;
}

export interface PedidoEstruturado {
  instrucaoDeSistema: string;
  entrada: string;
  schema: unknown;
  /**
   * Liga busca do Google como ferramenta do modelo, nos moldes do
   * `groundingEnabled` de gerador-de-video/production-planner/gemini-interactions.ts.
   *
   * Existe porque um modelo pequeno (flash-lite) inventa fato com confianca —
   * o caso real foi um "apelido" de personagem de jogo que nao existe. Sem
   * busca, "nao tenho certeza absoluta" no prompt e so um pedido; com busca, o
   * modelo tem como checar antes de responder. Usar so onde a resposta e
   * verificavel (quiz), nunca em conteudo de opiniao (dilema).
   */
  fundamentado?: boolean;
  /**
   * "minimal" | "low" | "medium" | "high" — quanto o modelo "pensa" antes de
   * responder (tokens de raciocinio, cobrados como saida). Sem isso o
   * flash-lite roda no minimo ("minimal"). Testado isoladamente pra Historia
   * Interativa (unico gerador com uma restricao de CONTAGEM exata — 3 a 5
   * "pontos sem volta" — nao so texto solto): amostra pequena (4 tentativas
   * por lado) mas direcional, "high" acertou 4/4 vs 3/4 no padrao, custando
   * quase o dobro de latencia (~35s vs ~20s por chamada). Nao ligado nos
   * outros geradores (dilemas/quiz/palpites/desafios) por falta de evidencia
   * de que precisam — nenhum deles tem uma exigencia de contagem assim.
   */
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
}

/**
 * Extrai o texto da resposta.
 *
 * A resposta vem como uma lista de passos (o modelo pode emitir passos de
 * raciocinio antes do resultado), entao e preciso achar o `model_output` em
 * vez de assumir a primeira posicao.
 */
function textoDaResposta(resposta: unknown): string | undefined {
  if (!resposta || typeof resposta !== 'object') return undefined;
  const corpo = resposta as Record<string, unknown>;
  if (typeof corpo.output_text === 'string') return corpo.output_text;
  if (!Array.isArray(corpo.steps)) return undefined;

  for (const passo of corpo.steps) {
    if (!passo || typeof passo !== 'object') continue;
    const tipado = passo as Record<string, unknown>;
    if (tipado.type !== 'model_output' || !Array.isArray(tipado.content)) continue;
    for (const bloco of tipado.content) {
      if (!bloco || typeof bloco !== 'object') continue;
      const blocoTipado = bloco as Record<string, unknown>;
      if (blocoTipado.type === 'text' && typeof blocoTipado.text === 'string') {
        return blocoTipado.text;
      }
    }
  }
  return undefined;
}

export class Gemini {
  constructor(private readonly opcoes: GeminiOptions) {
    if (!opcoes.apiKey) throw new GeminiError('GEMINI_API_KEY ausente');
  }

  async gerar<T>(pedido: PedidoEstruturado): Promise<T> {
    const resposta = await this.opcoes.fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.opcoes.apiKey,
      },
      body: JSON.stringify({
        model: this.opcoes.model,
        system_instruction: pedido.instrucaoDeSistema,
        input: pedido.entrada,
        store: false,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: pedido.schema,
        },
        ...(pedido.fundamentado ? { tools: [{ type: 'google_search' }] } : {}),
        ...(pedido.thinkingLevel
          ? { generation_config: { thinking_level: pedido.thinkingLevel } }
          : {}),
      }),
    });

    if (!resposta.ok) {
      const detalhes = (await resposta.text()).slice(0, 500);
      throw new GeminiError(
        `Gemini respondeu HTTP ${resposta.status}: ${detalhes}`,
        resposta.status,
      );
    }

    const corpo: unknown = await resposta.json();
    const texto = textoDaResposta(corpo);
    if (!texto) throw new GeminiError('Resposta do Gemini sem saída de texto');

    try {
      return JSON.parse(texto) as T;
    } catch {
      throw new GeminiError('Saída estruturada do Gemini não era JSON válido');
    }
  }
}
