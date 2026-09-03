import type { Gemini } from '../gemini';
import type { ResultadoGeracao } from './dilemas';

/** Enunciados ja existentes do tema que vao no prompt como "nao repita". */
const AMOSTRA_ANTI_REPETICAO = 40;

/**
 * Monta a instrucao com base em se a busca do Google esta disponivel nesta
 * chamada.
 *
 * A busca (`fundamentado: true` em `Gemini.gerar`) exige faturamento
 * habilitado na conta Google — sem isso a chamada falha com 429 mesmo dentro
 * da cota gratuita nominal (o mesmo obstaculo ja visto na geracao de musica
 * deste projeto). Ate o faturamento existir, `comBusca` fica falso: a
 * instrucao entao NAO afirma que ha busca disponivel, porque dizer isso ao
 * modelo sem a ferramenta de fato ligada e pior que nao dizer nada — ele
 * passaria a citar uma "pesquisa" que nunca aconteceu.
 */
function instrucao(comBusca: boolean): string {
  return `Você escreve perguntas de quiz para um site brasileiro de microjogos.

Regras:
- Português do Brasil, enunciado curto e direto.
- Exatamente 4 alternativas, e apenas uma correta.
- As alternativas erradas precisam ser plausíveis; alternativa obviamente
  absurda estraga a pergunta.
- Use apenas fatos estáveis e verificáveis. Nada que dependa do ano corrente,
  de recordes que mudam, de rankings de temporada ou de dados recentes.
- Evite apelidos, epítetos, frases atribuídas a alguém ou qualquer "curiosidade"
  de trivia — é exatamente o tipo de fato que um modelo inventa com confiança
  sem perceber, mesmo quando soa familiar. Prefira o que é checável de forma
  objetiva: nome, data, quantidade, definição, mecânica de jogo, resultado de
  evento específico.
${comBusca ? '- Você tem busca do Google disponível. Use-a para confirmar cada fato antes de escrever a pergunta — não responda de memória.\n' : ''}- Se você não tem certeza absoluta da resposta, não escreva a pergunta.
- Explicação de no máximo uma frase.
- Nada de conteúdo sexual, violência gráfica, drogas, política partidária,
  religião ou ofensa a pessoas reais.
- Não repita nem parafraseie perguntas que já existem.`;
}

const SCHEMA = {
  type: 'object',
  properties: {
    perguntas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          enunciado: { type: 'string' },
          alternativas: {
            type: 'array',
            items: { type: 'string' },
            minItems: 4,
            maxItems: 4,
          },
          indiceCorreto: { type: 'integer' },
          explicacao: { type: 'string' },
        },
        required: ['enunciado', 'alternativas', 'indiceCorreto', 'explicacao'],
      },
    },
  },
  required: ['perguntas'],
};

interface PerguntaGerada {
  enunciado: string;
  alternativas: string[];
  indiceCorreto: number;
  explicacao: string;
}

export async function gerarPerguntas(
  db: D1Database,
  gemini: Gemini,
  temaSlug: string,
  quantidade: number,
  comBusca: boolean,
  statusInicial: 'draft' | 'published',
): Promise<ResultadoGeracao> {
  const tema = await db
    .prepare('SELECT slug, title FROM quiz_topics WHERE slug = ?')
    .bind(temaSlug)
    .first<{ slug: string; title: string }>();

  if (!tema) return { gerados: 0, inseridos: 0, descartados: 0 };

  const { results: existentes } = await db
    .prepare('SELECT prompt FROM quiz_questions WHERE topic_slug = ? ORDER BY id DESC LIMIT ?')
    .bind(temaSlug, AMOSTRA_ANTI_REPETICAO)
    .all<{ prompt: string }>();

  const jaExistem = existentes.map((p) => `- ${p.prompt}`).join('\n');

  const resposta = await gemini.gerar<{ perguntas: PerguntaGerada[] }>({
    instrucaoDeSistema: instrucao(comBusca),
    entrada:
      `Tema: "${tema.title}" (identificador: ${tema.slug}).\n` +
      `Gere ${quantidade} perguntas novas sobre esse tema.\n\n` +
      `Perguntas que já existem (não repita nem reformule):\n${jaExistem}`,
    schema: SCHEMA,
    fundamentado: comBusca,
  });

  const candidatos = Array.isArray(resposta.perguntas) ? resposta.perguntas : [];
  let inseridos = 0;

  for (const candidato of candidatos) {
    if (!valido(candidato)) continue;

    const duplicado = await db
      .prepare(
        'SELECT 1 FROM quiz_questions WHERE topic_slug = ? AND lower(prompt) = lower(?)',
      )
      .bind(temaSlug, candidato.enunciado.trim())
      .first();
    if (duplicado) continue;

    await db
      .prepare(
        `INSERT INTO quiz_questions
           (topic_slug, prompt, choices_json, correct_index, explanation, status, source)
         VALUES (?, ?, ?, ?, ?, ?, 'gemini')`,
      )
      .bind(
        temaSlug,
        candidato.enunciado.trim(),
        JSON.stringify(candidato.alternativas.map((a) => a.trim())),
        candidato.indiceCorreto,
        candidato.explicacao.trim(),
        statusInicial,
      )
      .run();
    inseridos += 1;
  }

  return {
    gerados: candidatos.length,
    inseridos,
    descartados: candidatos.length - inseridos,
  };
}

function valido(candidato: PerguntaGerada): boolean {
  if (typeof candidato?.enunciado !== 'string') return false;
  if (!Array.isArray(candidato.alternativas) || candidato.alternativas.length !== 4) {
    return false;
  }
  if (candidato.alternativas.some((a) => typeof a !== 'string' || a.trim().length === 0)) {
    return false;
  }
  // Alternativa repetida deixa a pergunta sem resposta certa unica.
  const unicas = new Set(candidato.alternativas.map((a) => a.trim().toLowerCase()));
  if (unicas.size !== 4) return false;

  return (
    Number.isInteger(candidato.indiceCorreto) &&
    candidato.indiceCorreto >= 0 &&
    candidato.indiceCorreto <= 3 &&
    candidato.enunciado.trim().length > 8
  );
}
