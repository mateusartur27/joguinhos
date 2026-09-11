import type { Gemini } from '../gemini';
import type { ResultadoGeracao } from './dilemas';

/**
 * Quantos niveis de escolha existem antes de um final, no caminho MAIS
 * LONGO da arvore (nem todo caminho tem esse tamanho — ver PONTO SEM VOLTA
 * no schema abaixo).
 *
 * A arvore tem ATE 5 CAMADAS DE NO (raiz, nivel 2, nivel 3, nivel 4, final),
 * mas so 4 delas tem escolha — o final e so texto + resultado. E essa
 * contagem de "escolhas restantes", nao de "camadas restantes", que
 * `validaArvore` precisa, senao ela desce um nivel a mais do que o schema
 * realmente tem e rejeita toda arvore correta (bug real, pego revisando o
 * primeiro lote: ver README).
 *
 * Subiu de 3 para 4 a pedido do usuario ("10 rodadas", depois "5 rodadas").
 * Tentei subir para 5 escolhas reais e a API do Gemini rejeitou a chamada
 * inteira com HTTP 400 — o schema de saida estruturada tem um limite rigido
 * de profundidade de aninhamento, e 5 niveis de `noComOpcoes` estoura esse
 * limite (4 niveis funciona). Ficou em 4 — mas o usuario pediu pra nao
 * forcar TODO caminho a ter 4 escolhas: a terceira escolha pode pular a
 * quarta e ir direto pro final ("ponto sem volta", ver NO_NIVEL_3 e a
 * instrucao) quando o destino ja estiver selado, entao a arvore final e
 * quase sempre mais rasa que 4 em alguns ramos e o total de finais varia
 * (11 a 13, nao mais 16 fixo).
 */
const PROFUNDIDADE_DE_ESCOLHAS = 4;

/** Mesmo formato usado em `daily_results.play_date` (lib/db/diario.ts no site). */
function dataDeHojeUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export const CATEGORIAS = [
  'Mistério',
  'Terror',
  'Sobrevivência',
  'Romance',
  'Comédia',
  'Crime',
  'Ficção científica',
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

/**
 * Cor e emoji por categoria, curados a mao — a mesma regra do resto do site:
 * cor exige julgamento visual, nao e algo para o modelo escolher (ver
 * README, secao "Identidade visual").
 */
const IDENTIDADE_POR_CATEGORIA: Record<Categoria, { emoji: string; fundo: string; cartoes: [string, string] }> = {
  Terror: { emoji: '👻', fundo: '#7f1d1d', cartoes: ['#b45309', '#581c87'] },
  Mistério: { emoji: '🔍', fundo: '#4c1d95', cartoes: ['#b45309', '#0f766e'] },
  Sobrevivência: { emoji: '🏕️', fundo: '#14532d', cartoes: ['#b45309', '#7f1d1d'] },
  Romance: { emoji: '💕', fundo: '#9d174d', cartoes: ['#7c3aed', '#0f766e'] },
  Comédia: { emoji: '😂', fundo: '#b45309', cartoes: ['#db2777', '#2563eb'] },
  Crime: { emoji: '🕵️', fundo: '#1e293b', cartoes: ['#b45309', '#7f1d1d'] },
  'Ficção científica': { emoji: '🚀', fundo: '#1e3a8a', cartoes: ['#db2777', '#16a34a'] },
};

function instrucao(categoria: Categoria): string {
  return `Você escreve uma história interativa curta para um site brasileiro de
microjogos, na categoria "${categoria}": a pessoa lê uma cena e escolhe entre
duas opções, até chegar a um final classificado como vitória ou derrota.

Estrutura obrigatória (até 4 escolhas antes do final, sempre binário):
- Cena raiz: situação inicial, com exatamente 2 opções.
- Cada opção leva a uma segunda cena, também com exatamente 2 opções.
- Cada uma dessas leva a uma terceira cena, também com exatamente 2 opções.
- Cada opção dessa terceira cena leva a UMA de duas coisas — veja PONTO SEM
  VOLTA abaixo para quando usar cada uma:
  (a) uma quarta cena normal, também com 2 opções, terminando em 2 finais; ou
  (b) direto a um final de "derrota", pulando a quarta cena inteiramente.

Regras:
- Português do Brasil, coloquial, no tempo presente ou passado recente.
- Cada cena tem no máximo 3 frases curtas. É "história rápida", não conto.
- Mantenha o tom de "${categoria}" a história inteira.
- Os rótulos das opções são curtos (até 6 palavras), começando com um emoji
  relacionado à ação (ex.: "🚪 Abro a porta"). As DUAS opções precisam ser
  respostas plausíveis e conectadas à MESMA cena que acabou de ser descrita
  — nunca uma opção "óbvia" (a resposta técnica evidente pro que acabou de
  ser explicado) contra uma solta, sem relação clara com o que foi narrado.
  Se a cena menciona uma ameaça, um mecanismo ou um recurso específico, as
  DUAS opções devem responder a ELE de formas diferentes — nunca uma
  responder à ameaça e a outra introduzir algo que a cena nunca mencionou
  (ex. real, rejeitado: a cena descreve um campo magnético afetando o
  corpo, e uma opção é "reiniciar o gerador" sem nenhuma ligação explicada
  com esse perigo específico).
- Terror e Crime pedem tensão e sugestão, NUNCA descrição gráfica de
  violência, sangue ou ferimento — o susto vem da atmosfera, não de detalhe
  explícito. Isso vale mesmo puxando o gênero ao limite.
- Cada final tem um "resultado": "vitoria" quando a pessoa sobrevive, consegue
  o que queria ou resolve a situação a seu favor; "derrota" quando ela falha,
  a situação piora ou ela fica presa/perdida. Use os dois de forma equilibrada
  entre os finais que vêm de uma quarta cena normal.
- PONTO SEM VOLTA (regra central da história, não um detalhe — siga com
  atenção): a terceira cena tem 4 nós, cada um com 2 opções — 8 opções no
  total. Em 3 a 5 dessas 8 opções — nunca menos de 3, nunca mais de 5, CONTE
  antes de finalizar sua resposta — a opção deve levar DIRETO a um final de
  "derrota" (opção (b) acima), sem gerar uma quarta cena pra esse ramo: não
  há mais nada a pensar ali, a escolha da terceira cena já selou o destino,
  então nem invente uma quarta cena que não importa. Nas outras opções, use
  (a) normalmente. Não anuncie o ponto sem volta na cena (nada de "não há
  mais saída" ou parecido) — a cena mantém tensão normal e a opção parece
  uma escolha de verdade; só ao ver que perdeu é que dá pra perceber, olhando
  pra trás, que aquela escolha da terceira cena já tinha decidido tudo. Cada
  ponto sem volta precisa ser consequência lógica de uma decisão arriscada
  já tomada no caminho até ali, não parecer arbitrário nem repetir sempre o
  mesmo padrão de história pra história.
- O total de finais varia entre 11 e 13 dependendo de quantos pontos sem
  volta você usar (cada um reduz o total em 1, porque pula uma quarta cena
  que teria 2 finais e vira só 1). Os finais devem ser genuinamente
  diferentes entre si (não apenas o mesmo final com uma frase trocada).
- Nada de conteúdo sexual, drogas, automutilação, política partidária,
  religião ou ofensa a pessoas reais.
- Deixe a história carregar um aprendizado REAL e concreto sobre o mundo —
  não uma reflexão filosófica abstrata sobre valores da vida, e sim um
  fato, conceito ou técnica verdadeira, coerente com "${categoria}" (ex.:
  em Ficção científica, um conceito científico real pode aparecer já no
  primeiro enunciado; em Sobrevivência, uma técnica real de sobrevivência;
  em Crime, um método real de investigação; em Mistério/Terror, um fato
  real sobre o tipo de lugar, objeto ou fenômeno envolvido). O aprendizado
  entra dissolvido na cena, como parte natural do que está sendo narrado —
  nunca como explicação separada, aula ou nota de rodapé, e nunca virando
  o ponto principal da história (a trama e o susto/riso/suspense continuam
  sendo o que a pessoa está ali pra jogar). Só use um fato do qual você
  tenha certeza absoluta — errar um fato apresentado como verdadeiro é
  pior que não incluir nenhum. CUIDADO: um fato bem colocado não pode virar
  dica de qual opção é a certa — se ele deixa uma opção obviamente "a
  resposta inteligente" (ex. real, rejeitado: a cena explica que dados de
  antena revelam a localização de um celular, e uma das opções literalmente
  é "analisar dados da antena") contra outra sem nexo com a cena, isso
  quebra a regra das DUAS opções plausíveis (ver acima). O fato entra como
  contexto/ambientação da cena, nunca como pista de como resolvê-la.
- Não repita nem parafraseie histórias que já existem.`;
}

const NO_FINAL = {
  type: 'object',
  properties: {
    texto: { type: 'string' },
    resultado: { type: 'string', enum: ['vitoria', 'derrota'] },
  },
  required: ['texto', 'resultado'],
};

// `proximo` aceita qualquer schema (o nivel seguinte da arvore, que pode ser
// outro `noComOpcoes(...)` ou o `NO_FINAL`) — por isso o tipo solto em vez
// de `typeof NO_FINAL`, senao so o proprio `NO_FINAL` seria aceito aqui.
function noComOpcoes(proximo: Record<string, unknown>) {
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

const NO_NIVEL_4 = noComOpcoes(NO_FINAL);

// Nivel 3 (a "terceira escolha") e o unico onde uma opcao pode pular a
// quarta cena e ir direto pra um final — o "ponto sem volta" pedido pelo
// usuario ("o no da terceira ja deve me dizer que perdi", "nem precisa a
// IA pensar nas outras duas opcoes"). `anyOf` testado isolado antes de
// entrar aqui: a API aceita, e o modelo de fato usa a forma mais curta
// (NO_FINAL) sem gerar o NO_NIVEL_4 desperdicado pra esses ramos.
const PROXIMO_NIVEL_3 = { anyOf: [NO_NIVEL_4, NO_FINAL] };
const NO_NIVEL_3 = {
  type: 'object',
  properties: {
    texto: { type: 'string' },
    opcaoA: {
      type: 'object',
      properties: { rotulo: { type: 'string' }, proximo: PROXIMO_NIVEL_3 },
      required: ['rotulo', 'proximo'],
    },
    opcaoB: {
      type: 'object',
      properties: { rotulo: { type: 'string' }, proximo: PROXIMO_NIVEL_3 },
      required: ['rotulo', 'proximo'],
    },
  },
  required: ['texto', 'opcaoA', 'opcaoB'],
};

const NO_NIVEL_2 = noComOpcoes(NO_NIVEL_3);

const SCHEMA = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    ...noComOpcoes(NO_NIVEL_2).properties,
  },
  required: ['titulo', 'texto', 'opcaoA', 'opcaoB'],
};

interface NoFinalGerado {
  texto: string;
  resultado: string;
}

interface NoComOpcoesGerado {
  texto: string;
  opcaoA: { rotulo: string; proximo: NoFinalGerado | NoComOpcoesGerado };
  opcaoB: { rotulo: string; proximo: NoFinalGerado | NoComOpcoesGerado };
}

interface HistoriaGerada extends NoComOpcoesGerado {
  titulo: string;
}

export async function gerarHistoria(
  db: D1Database,
  gemini: Gemini,
  categoria: Categoria,
  statusInicial: 'draft' | 'published',
): Promise<ResultadoGeracao> {
  const { results: existentes } = await db
    .prepare('SELECT title FROM stories WHERE category = ? ORDER BY rowid DESC LIMIT 20')
    .bind(categoria)
    .all<{ title: string }>();
  const jaExistem = existentes.map((h) => `- ${h.title}`).join('\n');

  const resposta = await gemini.gerar<HistoriaGerada>({
    instrucaoDeSistema: instrucao(categoria),
    entrada: `Gere uma história nova de "${categoria}".\n\nHistórias dessa categoria que já existem (não repita nem reformule):\n${jaExistem}`,
    schema: SCHEMA,
    // Unico gerador com uma exigencia de CONTAGEM exata (3 a 5 pontos sem
    // volta) — teste isolado mostrou "high" ajudando nisso especificamente
    // (ver comentario em gemini.ts). Custa quase o dobro de latencia, mas
    // aceitavel: geracao e assincrona (cron/disparo manual), nunca bloqueia
    // usuario.
    thinkingLevel: 'high',
  });

  if (!validaArvore(resposta, PROFUNDIDADE_DE_ESCOLHAS)) {
    return { gerados: 1, inseridos: 0, descartados: 1 };
  }

  // A instrucao pede 3 a 5 "pontos sem volta" (ver acima) e ja passou por
  // uma fase em que isso descartava a historia fora da faixa — o usuario
  // pediu pra reforcar a instrucao mas parar de descartar por causa dela:
  // so registra no log pra acompanhamento manual, nunca rejeita a insercao.
  console.log(
    `Historia "${categoria}": ${contarPontosSemVolta(resposta, PROFUNDIDADE_DE_ESCOLHAS)} pontos sem volta (pedido: 3-5)`,
  );

  const duplicado = await db
    .prepare('SELECT 1 FROM stories WHERE lower(title) = lower(?)')
    .bind(resposta.titulo.trim())
    .first();
  if (duplicado) return { gerados: 1, inseridos: 0, descartados: 1 };

  const identidade = IDENTIDADE_POR_CATEGORIA[categoria];
  const slug = await slugDisponivel(db, resposta.titulo);

  await db
    .prepare(
      `INSERT INTO stories (slug, title, category, color, card_colors, status, sort_order, for_date)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM stories), ?)`,
    )
    .bind(
      slug,
      resposta.titulo.trim(),
      categoria,
      identidade.fundo,
      JSON.stringify(identidade.cartoes),
      statusInicial,
      dataDeHojeUTC(),
    )
    .run();

  await inserirNo(db, slug, resposta, true);

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
      .prepare(`INSERT INTO story_nodes (story_slug, is_ending, text, outcome) VALUES (?, 1, ?, ?)`)
      .bind(storySlug, no.texto.trim(), no.resultado)
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

/**
 * Conta os "pontos sem volta": opcoes da TERCEIRA escolha que levam direto
 * a um final em vez de a uma quarta cena. `profundidadeRestante` segue a
 * mesma contagem de `validaArvore` (chamada inicial com
 * PROFUNDIDADE_DE_ESCOLHAS) — so na profundidade 2 (a propria terceira
 * escolha) e que "proximo ser um final" conta como ponto sem volta; em
 * qualquer outra profundidade isso nao pode acontecer (o schema so permite
 * `anyOf` nesse nivel), entao o check e inofensivo se nunca disparar ali.
 */
function contarPontosSemVolta(no: NoFinalGerado | NoComOpcoesGerado, profundidadeRestante: number): number {
  if (!('opcaoA' in no)) return 0;

  const contarOpcao = (proximo: NoFinalGerado | NoComOpcoesGerado): number => {
    const pontoSemVolta = profundidadeRestante === 2 && !('opcaoA' in proximo) ? 1 : 0;
    return pontoSemVolta + contarPontosSemVolta(proximo, profundidadeRestante - 1);
  };

  return contarOpcao(no.opcaoA.proximo) + contarOpcao(no.opcaoB.proximo);
}

/**
 * Confere que a arvore tem a profundidade esperada e nada vazio.
 *
 * Um final pode aparecer com profundidadeRestante 0 (o caso normal, final
 * depois da quarta escolha) OU 1 (ponto sem volta: a terceira escolha pulou
 * a quarta cena) — mas nunca em profundidade maior que isso, ou a arvore
 * estaria terminando cedo demais (ex.: raiz ou segunda escolha indo direto
 * pra um final, que o schema nao pede e a instrucao nao permite).
 */
function validaArvore(no: unknown, profundidadeRestante: number): no is HistoriaGerada {
  if (!no || typeof no !== 'object') return false;
  const objeto = no as Record<string, unknown>;

  if (typeof objeto.texto !== 'string' || objeto.texto.trim().length < 4) return false;

  const ehNoFinal = 'resultado' in objeto;

  if (ehNoFinal) {
    if (profundidadeRestante > 1) return false; // final antecipado demais
    return (
      (objeto.resultado === 'vitoria' || objeto.resultado === 'derrota') &&
      !objeto.opcaoA &&
      !objeto.opcaoB
    );
  }

  if (profundidadeRestante === 0) return false; // esperava final, veio no de escolha

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
