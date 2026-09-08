import type { Gemini } from '../gemini';
import type { ResultadoGeracao } from './dilemas';

/** Quantos palpites ja existentes vao no prompt como "nao repita". */
const AMOSTRA_ANTI_REPETICAO = 40;

const INSTRUCAO = `Você escreve perguntas de "adivinhe antes de revelar" para um site
brasileiro de microjogos: a pessoa escolhe um palpite de quantidade e depois vê o
valor real.

Regras:
- Português do Brasil, pergunta curta e direta ("Quantos...", "Qual...", "Quanto...").
- Exatamente 4 alternativas de quantidade, plausíveis e bem espaçadas entre si
  (se duas alternativas forem quase iguais, a pergunta não presta).
- Use apenas fatos fixos e verificáveis: medidas físicas, contagens biológicas,
  distâncias, durações históricas, recordes de natureza. NUNCA preço, cotação,
  população que muda todo ano, ranking de temporada ou qualquer coisa que
  dependa do ano corrente.
- Evite apelido, epíteto ou frase atribuída a alguém — prefira o que é checável
  de forma objetiva.
- Se você não tem certeza absoluta do valor real, não escreva a pergunta.
- "valorReal" é uma string curta mostrada no reveal, ex.: "cerca de 6 toneladas".
- Explicação de no máximo uma frase.
- Nada de conteúdo sexual, violência gráfica, drogas, política partidária,
  religião ou ofensa a pessoas reais.
- Não repita nem parafraseie perguntas que já existem.`;

const SCHEMA = {
  type: 'object',
  properties: {
    palpites: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          categoria: { type: 'string' },
          pergunta: { type: 'string' },
          alternativas: {
            type: 'array',
            items: { type: 'string' },
            minItems: 4,
            maxItems: 4,
          },
          indiceCorreto: { type: 'integer' },
          valorReal: { type: 'string' },
          explicacao: { type: 'string' },
        },
        required: ['categoria', 'pergunta', 'alternativas', 'indiceCorreto', 'valorReal', 'explicacao'],
      },
    },
  },
  required: ['palpites'],
};

interface PalpiteGerado {
  categoria: string;
  pergunta: string;
  alternativas: string[];
  indiceCorreto: number;
  valorReal: string;
  explicacao: string;
}

export async function gerarPalpites(
  db: D1Database,
  gemini: Gemini,
  quantidade: number,
  statusInicial: 'draft' | 'published',
): Promise<ResultadoGeracao> {
  const { results: existentes } = await db
    .prepare('SELECT prompt FROM guesses ORDER BY id DESC LIMIT ?')
    .bind(AMOSTRA_ANTI_REPETICAO)
    .all<{ prompt: string }>();

  const jaExistem = existentes.map((p) => `- ${p.prompt}`).join('\n');

  const resposta = await gemini.gerar<{ palpites: PalpiteGerado[] }>({
    instrucaoDeSistema: INSTRUCAO,
    entrada:
      `Gere ${quantidade} perguntas novas, variando as categorias.\n\n` +
      `Perguntas que já existem (não repita nem reformule):\n${jaExistem}`,
    schema: SCHEMA,
  });

  const candidatos = Array.isArray(resposta.palpites) ? resposta.palpites : [];
  let inseridos = 0;

  for (const candidato of candidatos) {
    if (!valido(candidato)) continue;

    const duplicado = await db
      .prepare('SELECT 1 FROM guesses WHERE lower(prompt) = lower(?)')
      .bind(candidato.pergunta.trim())
      .first();
    if (duplicado) continue;

    await db
      .prepare(
        `INSERT INTO guesses
           (category, prompt, choices_json, correct_index, real_value, explanation, status, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'gemini')`,
      )
      .bind(
        candidato.categoria.trim(),
        candidato.pergunta.trim(),
        JSON.stringify(candidato.alternativas.map((a) => a.trim())),
        candidato.indiceCorreto,
        candidato.valorReal.trim(),
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

function valido(candidato: PalpiteGerado): boolean {
  if (typeof candidato?.pergunta !== 'string' || candidato.pergunta.trim().length <= 8) {
    return false;
  }
  if (typeof candidato?.valorReal !== 'string' || candidato.valorReal.trim().length === 0) {
    return false;
  }
  if (!Array.isArray(candidato.alternativas) || candidato.alternativas.length !== 4) {
    return false;
  }
  if (candidato.alternativas.some((a) => typeof a !== 'string' || a.trim().length === 0)) {
    return false;
  }
  const unicas = new Set(candidato.alternativas.map((a) => a.trim().toLowerCase()));
  if (unicas.size !== 4) return false;

  return (
    Number.isInteger(candidato.indiceCorreto) &&
    candidato.indiceCorreto >= 0 &&
    candidato.indiceCorreto <= 3
  );
}
