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
