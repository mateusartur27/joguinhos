import type { Gemini } from '../gemini';

const CATEGORIAS = [
  'dinheiro',
  'vida',
  'relacionamentos',
  'poderes',
  'absurdo',
  'futebol',
  'tecnologia',
  'medo',
] as const;

/**
 * Quantos dilemas ja publicados vao no prompt como "nao repita".
 *
 * O modelo nao tem memoria entre execucoes: sem essa lista ele reescreve os
 * mesmos classicos (milhao agora x renda mensal) toda vez. 60 e o que cabe no
 * prompt sem encarecer a chamada.
 */
const AMOSTRA_ANTI_REPETICAO = 60;

const INSTRUCAO = `Você escreve dilemas de escolha binária para um site brasileiro de microjogos.

Regras:
- Português do Brasil, linguagem coloquial e direta.
- Cada opção tem no máximo 70 caracteres. Sem ponto final.
- As duas opções precisam ser genuinamente difíceis de escolher: se a maioria
  esmagadora escolheria uma delas, o dilema não presta.
- Nada de conteúdo sexual, violência gráfica, drogas, automutilação, política
  partidária, religião ou ofensa a pessoas reais. O site exibe publicidade e
  esse tipo de conteúdo derruba a conta.
- Deixe cada dilema carregar, por trás da escolha, algum reflexo real sobre a
  vida ou sobre como as pessoas decidem — implícito na própria tensão da
  escolha, nunca como frase de moral separada ou explicação depois. Se a
  pessoa só perceber esse reflexo parando pra pensar depois de escolher, é
  o efeito certo; se o dilema parecer estar "ensinando algo", errou a mão.
- Não repita nem parafraseie dilemas que já existem.`;

const SCHEMA = {
  type: 'object',
  properties: {
    dilemas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          categoria: { type: 'string', enum: [...CATEGORIAS] },
          opcaoA: { type: 'string' },
          opcaoB: { type: 'string' },
        },
        required: ['categoria', 'opcaoA', 'opcaoB'],
      },
    },
  },
  required: ['dilemas'],
};

interface DilemaGerado {
  categoria: string;
  opcaoA: string;
  opcaoB: string;
}

export interface ResultadoGeracao {
  gerados: number;
  inseridos: number;
  descartados: number;
}

export async function gerarDilemas(
  db: D1Database,
  gemini: Gemini,
  quantidade: number,
  statusInicial: 'draft' | 'published',
): Promise<ResultadoGeracao> {
  const { results: existentes } = await db
    .prepare(
      `SELECT option_a, option_b FROM dilemmas
        ORDER BY id DESC LIMIT ?`,
    )
    .bind(AMOSTRA_ANTI_REPETICAO)
    .all<{ option_a: string; option_b: string }>();

  const jaExistem = existentes.map((d) => `- ${d.option_a} / ${d.option_b}`).join('\n');

  const resposta = await gemini.gerar<{ dilemas: DilemaGerado[] }>({
    instrucaoDeSistema: INSTRUCAO,
    entrada:
      `Gere ${quantidade} dilemas novos, variando as categorias.\n\n` +
      `Dilemas que já existem (não repita nem reformule):\n${jaExistem}`,
    schema: SCHEMA,
  });

  const candidatos = Array.isArray(resposta.dilemas) ? resposta.dilemas : [];
  let inseridos = 0;

  for (const candidato of candidatos) {
    if (!valido(candidato)) continue;

    // Checagem de duplicata no banco alem da instrucao do prompt: o modelo
    // ignora a lista com alguma frequencia, e um dilema repetido divide os
    // votos entre duas linhas — o agregado de cada uma fica errado.
    const duplicado = await db
      .prepare(
        `SELECT 1 FROM dilemmas
          WHERE lower(option_a) = lower(?) AND lower(option_b) = lower(?)`,
      )
      .bind(candidato.opcaoA.trim(), candidato.opcaoB.trim())
      .first();
    if (duplicado) continue;

    await db
      .prepare(
        `INSERT INTO dilemmas (category, option_a, option_b, status, source)
         VALUES (?, ?, ?, ?, 'gemini')`,
      )
      .bind(
        CATEGORIAS.includes(candidato.categoria as (typeof CATEGORIAS)[number])
          ? candidato.categoria
          : 'vida',
        candidato.opcaoA.trim(),
        candidato.opcaoB.trim(),
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

function valido(candidato: DilemaGerado): boolean {
  if (typeof candidato?.opcaoA !== 'string' || typeof candidato?.opcaoB !== 'string') {
    return false;
  }
  const a = candidato.opcaoA.trim();
  const b = candidato.opcaoB.trim();
  return (
    a.length > 2 &&
    b.length > 2 &&
    a.length <= 90 &&
    b.length <= 90 &&
    a.toLowerCase() !== b.toLowerCase()
  );
}
