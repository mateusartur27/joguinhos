import type { Gemini } from '../gemini';
import type { ResultadoGeracao } from './dilemas';

/**
 * Estoque minimo antes de gerar mais.
 *
 * A selecao do desafio de hoje e deterministica (indice do dia % total) —
 * ver `lib/db/diario.ts` no site. Com menos que isso em estoque, o ciclo se
 * repete rapido demais (dia N e dia N+total caem no mesmo desafio).
 */
const ESTOQUE_MINIMO = 30;

/** Quantos desafios novos por execucao, quando o estoque esta baixo. */
const DESAFIOS_POR_EXECUCAO = 3;

const INSTRUCAO = `Você escreve desafios do "Jogo Diário" de um site brasileiro de
microjogos: a pessoa recebe pistas progressivas (da mais vaga para a mais óbvia) e
tenta descobrir quem ou o que é, uma pista de cada vez.

Regras:
- Português do Brasil, pistas curtas e diretas, escritas na primeira pessoa
  (o próprio assunto "se descrevendo").
- Exatamente 5 pistas por desafio, em ordem crescente de obviedade: a pista 1
  precisa ser genuinamente difícil (só quem já sabe a resposta reconhece), e a
  pista 5 precisa deixar a resposta quase óbvia.
- O assunto pode ser qualquer coisa amplamente conhecida no Brasil: atleta,
  país, animal, filme, personagem, objeto do dia a dia, invenção. Evite pessoa
  viva controversa ou ligada a política partidária.
- Use apenas fatos estáveis e verificáveis nas pistas — nada que dependa do
  ano corrente ou de estatística que muda (recorde, título mais recente).
- "respostasAceitas" é uma lista de 2 a 4 variantes que contam como acerto
  (nome completo, apelido comum, forma curta) — sem isso um acerto correto
  seria rejeitado por não bater a grafia exata.
- Se você não tem certeza absoluta de algum fato usado numa pista, não
  escreva o desafio.
- Nada de conteúdo sexual, violência gráfica, drogas, política partidária,
  religião ou ofensa a pessoas reais.
- Não repita nem parafraseie desafios que já existem.`;

const SCHEMA = {
  type: 'object',
  properties: {
    desafios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          categoria: { type: 'string' },
          resposta: { type: 'string' },
          respostasAceitas: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 4,
          },
          pistas: {
            type: 'array',
            items: { type: 'string' },
            minItems: 5,
            maxItems: 5,
          },
        },
        required: ['categoria', 'resposta', 'respostasAceitas', 'pistas'],
      },
    },
  },
  required: ['desafios'],
};

interface DesafioGerado {
  categoria: string;
  resposta: string;
  respostasAceitas: string[];
  pistas: string[];
}

export async function gerarDesafiosDiarios(
  db: D1Database,
  gemini: Gemini,
  statusInicial: 'draft' | 'published',
): Promise<ResultadoGeracao> {
  const { count } = (await db
    .prepare("SELECT count(*) AS count FROM daily_challenges WHERE status = 'published'")
    .first<{ count: number }>()) ?? { count: 0 };

  if (count >= ESTOQUE_MINIMO) {
    return { gerados: 0, inseridos: 0, descartados: 0 };
  }

  const { results: existentes } = await db
    .prepare('SELECT answer FROM daily_challenges ORDER BY id DESC LIMIT 60')
    .all<{ answer: string }>();

  const jaExistem = existentes.map((d) => `- ${d.answer}`).join('\n');

  const resposta = await gemini.gerar<{ desafios: DesafioGerado[] }>({
    instrucaoDeSistema: INSTRUCAO,
    entrada:
      `Gere ${DESAFIOS_POR_EXECUCAO} desafios novos, variando as categorias.\n\n` +
      `Respostas que já existem (não repita):\n${jaExistem}`,
    schema: SCHEMA,
  });

  const candidatos = Array.isArray(resposta.desafios) ? resposta.desafios : [];
  let inseridos = 0;

  for (const candidato of candidatos) {
    if (!valido(candidato)) continue;

    const duplicado = await db
      .prepare('SELECT 1 FROM daily_challenges WHERE lower(answer) = lower(?)')
      .bind(candidato.resposta.trim())
      .first();
    if (duplicado) continue;

    await db
      .prepare(
        `INSERT INTO daily_challenges
           (category, answer, accepted_answers_json, clues_json, status, source)
         VALUES (?, ?, ?, ?, ?, 'gemini')`,
      )
      .bind(
        candidato.categoria.trim(),
        candidato.resposta.trim(),
        JSON.stringify(candidato.respostasAceitas.map((a) => a.trim())),
        JSON.stringify(candidato.pistas.map((p) => p.trim())),
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

function valido(candidato: DesafioGerado): boolean {
  if (typeof candidato?.resposta !== 'string' || candidato.resposta.trim().length === 0) {
    return false;
  }
  if (!Array.isArray(candidato.respostasAceitas) || candidato.respostasAceitas.length === 0) {
    return false;
  }
  if (candidato.respostasAceitas.some((a) => typeof a !== 'string' || a.trim().length === 0)) {
    return false;
  }
  if (!Array.isArray(candidato.pistas) || candidato.pistas.length !== 5) return false;
  if (candidato.pistas.some((p) => typeof p !== 'string' || p.trim().length < 8)) return false;

  return typeof candidato.categoria === 'string' && candidato.categoria.trim().length > 0;
}
