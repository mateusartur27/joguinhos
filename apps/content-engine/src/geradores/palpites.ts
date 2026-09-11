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
    // Teste isolado (fora do pipeline, sem tocar D1) achou um lote no padrao
    // (minimal) com indiceCorreto apontando pra alternativa errada em
    // relacao a valorReal — nao reproduzido nas amostras em medium. Amostra
    // pequena (2 de cada), mas junto com `numeroMaisProximo` abaixo (que
    // pega esse mesmo tipo de erro no codigo, nao so no prompt), da pra
    // subir sem custar o dobro de latencia que 'high' custaria.
    thinkingLevel: 'medium',
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

/** Primeiro numero de um texto (formato BR: "." milhar, "," decimal), ou null. */
function numeroDoTexto(texto: string): number | null {
  const bruto = texto.match(/\d[\d.,]*/)?.[0];
  if (!bruto) return null;
  const normalizado = Number(bruto.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(normalizado) ? normalizado : null;
}

/**
 * Qual indice de `alternativas` tem o numero mais proximo do numero em
 * `valorReal`. Aproximado, nao exato, porque as alternativas sao faixas
 * arredondadas ("cerca de 6.900 km") e `valorReal` costuma ser o numero
 * preciso ("cerca de 6.992 km") — sao dois campos numericos, entao a
 * comparacao e sempre numero-a-numero, nunca texto-a-texto.
 */
function indiceMaisProximo(alternativas: string[], valorReal: string): number | null {
  const alvo = numeroDoTexto(valorReal);
  if (alvo === null) return null;

  let melhorIndice: number | null = null;
  let melhorDistancia = Infinity;
  alternativas.forEach((alternativa, indice) => {
    const numero = numeroDoTexto(alternativa);
    if (numero === null) return;
    const distancia = Math.abs(numero - alvo);
    if (distancia < melhorDistancia) {
      melhorDistancia = distancia;
      melhorIndice = indice;
    }
  });
  return melhorIndice;
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

  if (
    !Number.isInteger(candidato.indiceCorreto) ||
    candidato.indiceCorreto < 0 ||
    candidato.indiceCorreto > 3
  ) {
    return false;
  }

  // indiceCorreto e valorReal sao dois campos independentes que o modelo
  // pode desalinhar — achado real em teste isolado: um lote saiu com
  // indiceCorreto apontando pra "12" enquanto valorReal dizia "10 países".
  // Rejeita quando a alternativa numericamente mais proxima de valorReal
  // nao e a apontada por indiceCorreto (so quando da pra extrair numero dos
  // dois lados — senao, deixa passar em vez de rejeitar por falso negativo).
  const indiceEsperado = indiceMaisProximo(candidato.alternativas, candidato.valorReal);
  return indiceEsperado === null || indiceEsperado === candidato.indiceCorreto;
}
