import type { Gemini } from '../gemini';
import type { ResultadoGeracao } from './dilemas';

/**
 * Quantos niveis de escolha existem antes de um final.
 *
 * A arvore tem 3 CAMADAS DE NO (raiz, nivel 2, final), mas so 2 delas tem
 * escolha (raiz e nivel 2) — o final e so texto. E essa contagem de
 * "escolhas restantes", nao de "camadas restantes", que `validaArvore`
 * precisa, senao ela desce um nivel a mais do que o schema realmente tem e
 * rejeita toda arvore correta (bug real, pego revisando o primeiro lote).
 */
const PROFUNDIDADE_DE_ESCOLHAS = 2;

const CATEGORIAS = [
  'Mistério',
  'Terror',
  'Sobrevivência',
  'Romance',
  'Comédia',
  'Crime',
  'Ficção científica',
] as const;

/**
 * Cor e emoji por categoria, curados a mao — a mesma regra do resto do site:
 * cor exige julgamento visual, nao e algo para o modelo escolher (ver
 * README, secao "Identidade visual").
 */
const IDENTIDADE_POR_CATEGORIA: Record<(typeof CATEGORIAS)[number], { emoji: string; fundo: string; cartoes: [string, string] }> = {
  Terror: { emoji: '👻', fundo: '#7f1d1d', cartoes: ['#b45309', '#581c87'] },
  Mistério: { emoji: '🔍', fundo: '#4c1d95', cartoes: ['#b45309', '#0f766e'] },
  Sobrevivência: { emoji: '🏕️', fundo: '#14532d', cartoes: ['#b45309', '#7f1d1d'] },
  Romance: { emoji: '💕', fundo: '#9d174d', cartoes: ['#7c3aed', '#0f766e'] },
  Comédia: { emoji: '😂', fundo: '#b45309', cartoes: ['#db2777', '#2563eb'] },
  Crime: { emoji: '🕵️', fundo: '#1e293b', cartoes: ['#b45309', '#7f1d1d'] },
  'Ficção científica': { emoji: '🚀', fundo: '#1e3a8a', cartoes: ['#db2777', '#16a34a'] },
};

const INSTRUCAO = `Você escreve histórias interativas curtas para um site brasileiro de
microjogos: a pessoa lê uma cena e escolhe entre duas opções, até chegar a um final.

Estrutura obrigatória (sempre profundidade 3, sempre binário):
- Cena raiz: situação inicial, com exatamente 2 opções.
- Cada opção leva a uma segunda cena, também com exatamente 2 opções.
- Cada uma dessas leva a um final (4 finais no total).

Regras:
- Português do Brasil, coloquial, no tempo presente ou passado recente.
- Cada cena tem no máximo 3 frases curtas. É "história rápida", não conto.
- Escolha 1 categoria da lista e mantenha o tom dela a história inteira.
- Os rótulos das opções são curtos (até 6 palavras), começando com um emoji
  relacionado à ação (ex.: "🚪 Abro a porta").
- Terror e Crime pedem tensão e sugestão, NUNCA descrição gráfica de
  violência, sangue ou ferimento — o susto vem da atmosfera, não de detalhe
  explícito. Isso vale mesmo puxando o gênero ao limite.
- Os 4 finais devem ser genuinamente diferentes entre si (não apenas o mesmo
  final com uma frase trocada).
- Nada de conteúdo sexual, drogas, automutilação, política partidária,
  religião ou ofensa a pessoas reais.
- Não repita nem parafraseie histórias que já existem.`;

const NO_FINAL = {
  type: 'object',
  properties: { texto: { type: 'string' } },
  required: ['texto'],
};

function noComOpcoes(proximo: typeof NO_FINAL) {
  return {
    type: 'object',
    properties: {
      texto: { type: 'string' },
      opcaoA: {
        type: 'object',
        properties: { rotulo: { type: 'string' }, proximo },
        required: ['rotulo', 'proximo'],
      },
      opcaoB: {
        type: 'object',
        properties: { rotulo: { type: 'string' }, proximo },
        required: ['rotulo', 'proximo'],
      },
    },
    required: ['texto', 'opcaoA', 'opcaoB'],
  };
}

const NO_NIVEL_2 = noComOpcoes(NO_FINAL);

const SCHEMA = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    categoria: { type: 'string', enum: [...CATEGORIAS] },
    ...noComOpcoes(NO_NIVEL_2).properties,
  },
  required: ['titulo', 'categoria', 'texto', 'opcaoA', 'opcaoB'],
};

interface NoFinalGerado {
  texto: string;
}

interface NoComOpcoesGerado {
  texto: string;
  opcaoA: { rotulo: string; proximo: NoFinalGerado | NoComOpcoesGerado };
  opcaoB: { rotulo: string; proximo: NoFinalGerado | NoComOpcoesGerado };
}

interface HistoriaGerada extends NoComOpcoesGerado {
  titulo: string;
  categoria: string;
}

export async function gerarHistoria(
  db: D1Database,
  gemini: Gemini,
  statusInicial: 'draft' | 'published',
): Promise<ResultadoGeracao> {
  const { results: existentes } = await db
    .prepare('SELECT title FROM stories ORDER BY rowid DESC LIMIT 30')
    .all<{ title: string }>();
  const jaExistem = existentes.map((h) => `- ${h.title}`).join('\n');

  const resposta = await gemini.gerar<HistoriaGerada>({
    instrucaoDeSistema: INSTRUCAO,
    entrada: `Gere uma história nova, variando a categoria.\n\nHistórias que já existem (não repita nem reformule):\n${jaExistem}`,
    schema: SCHEMA,
  });

  if (!validaArvore(resposta, PROFUNDIDADE_DE_ESCOLHAS)) {
    return { gerados: 1, inseridos: 0, descartados: 1 };
  }

  const categoria = CATEGORIAS.includes(resposta.categoria as (typeof CATEGORIAS)[number])
    ? (resposta.categoria as (typeof CATEGORIAS)[number])
    : 'Mistério';
  const identidade = IDENTIDADE_POR_CATEGORIA[categoria];

  const slug = await slugDisponivel(db, resposta.titulo);

  const duplicado = await db
    .prepare('SELECT 1 FROM stories WHERE lower(title) = lower(?)')
    .bind(resposta.titulo.trim())
    .first();
  if (duplicado) return { gerados: 1, inseridos: 0, descartados: 1 };

  await db
    .prepare(
      `INSERT INTO stories (slug, title, category, color, card_colors, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM stories))`,
    )
    .bind(slug, resposta.titulo.trim(), categoria, identidade.fundo, JSON.stringify(identidade.cartoes), statusInicial)
    .run();

  await inserirNo(db, slug, resposta, true);

  await db
    .prepare(
      `INSERT INTO games (slug, title, tagline, emoji, kind, href, status, sort_order, color, card_colors)
       VALUES (?, ?, ?, ?, 'historia', ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM games), ?, ?)`,
    )
    .bind(
      `historia-${slug}`,
      resposta.titulo.trim(),
      `Uma história interativa de ${categoria.toLowerCase()}. Suas escolhas decidem o final.`,
      identidade.emoji,
      `/historia/${slug}`,
      statusInicial,
      identidade.fundo,
      JSON.stringify(identidade.cartoes),
    )
    .run();

  return { gerados: 1, inseridos: 1, descartados: 0 };
}

/**
 * Insere a arvore de baixo para cima: os filhos precisam existir (e ter id)
 * antes do pai poder referencia-los em `choice_a_next_id`/`choice_b_next_id`.
 */
async function inserirNo(
  db: D1Database,
  storySlug: string,
  no: NoFinalGerado | NoComOpcoesGerado,
  ehRaiz: boolean,
): Promise<number> {
  if (!('opcaoA' in no)) {
    const resultado = await db
      .prepare(`INSERT INTO story_nodes (story_slug, is_ending, text) VALUES (?, 1, ?)`)
      .bind(storySlug, no.texto.trim())
      .run();
    return resultado.meta.last_row_id!;
  }

  const idA = await inserirNo(db, storySlug, no.opcaoA.proximo, false);
  const idB = await inserirNo(db, storySlug, no.opcaoB.proximo, false);

  const resultado = await db
    .prepare(
      `INSERT INTO story_nodes
         (story_slug, is_root, text, choice_a_label, choice_a_next_id, choice_b_label, choice_b_next_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      storySlug,
      ehRaiz ? 1 : 0,
      no.texto.trim(),
      no.opcaoA.rotulo.trim(),
      idA,
      no.opcaoB.rotulo.trim(),
      idB,
    )
    .run();
  return resultado.meta.last_row_id!;
}

/** Slugifica o titulo e acrescenta um sufixo numerico se ja existir. */
async function slugDisponivel(db: D1Database, titulo: string): Promise<string> {
  const base = titulo
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  let slug = base || 'historia';
  for (let sufixo = 2; ; sufixo += 1) {
    const existe = await db.prepare('SELECT 1 FROM stories WHERE slug = ?').bind(slug).first();
    if (!existe) return slug;
    slug = `${base}-${sufixo}`;
  }
}

/** Confere que a arvore tem exatamente a profundidade esperada e nada vazio. */
function validaArvore(no: unknown, profundidadeRestante: number): no is HistoriaGerada {
  if (!no || typeof no !== 'object') return false;
  const objeto = no as Record<string, unknown>;

  if (typeof objeto.texto !== 'string' || objeto.texto.trim().length < 4) return false;

  if (profundidadeRestante === 0) {
    // Final: nao pode ter opcoes.
    return !objeto.opcaoA && !objeto.opcaoB;
  }

  for (const chave of ['opcaoA', 'opcaoB'] as const) {
    const opcao = objeto[chave];
    if (!opcao || typeof opcao !== 'object') return false;
    const tipada = opcao as Record<string, unknown>;
    if (typeof tipada.rotulo !== 'string' || tipada.rotulo.trim().length === 0) return false;
    if (!validaArvore(tipada.proximo, profundidadeRestante - 1)) return false;
  }

  if (profundidadeRestante === PROFUNDIDADE_DE_ESCOLHAS) {
    return typeof (no as HistoriaGerada).titulo === 'string' && (no as HistoriaGerada).titulo.trim().length > 0;
  }

  return true;
}
