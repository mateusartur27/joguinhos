-- Esquema inicial do joguinhos.
--
-- Duas regras atravessam todas as tabelas:
--
-- 1. Agregados ficam em contadores na propria linha (`votes_a`, `times_shown`...),
--    nunca em linhas de voto contadas com COUNT(*). O incremento e um UPDATE
--    atomico do SQLite, entao uma votacao concorrente nao precisa de transacao.
--
-- 2. Todo conteudo tem `status`. Nada nasce visivel: o que o Gemini gerar entra
--    como 'draft' e so vai ao ar depois de revisado — publicar texto de LLM
--    automaticamente num site com AdSense e risco de violacao de politica.

-- Catalogo de jogos da home.
CREATE TABLE games (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  tagline     TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  kind        TEXT NOT NULL,                    -- 'escolhas' | 'ranking' | 'quiz'
  href        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',    -- 'draft' | 'published'
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Escolhas Impossiveis: um dilema por linha, com os dois contadores embutidos.
CREATE TABLE dilemmas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL,
  option_a    TEXT NOT NULL,
  option_b    TEXT NOT NULL,
  votes_a     INTEGER NOT NULL DEFAULT 0,
  votes_b     INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft',
  source      TEXT NOT NULL DEFAULT 'seed',     -- 'seed' | 'gemini'
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX dilemmas_status_idx ON dilemmas (status, category);

-- Ranking Coletivo: listas de disputa par a par.
CREATE TABLE ranking_lists (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  question    TEXT NOT NULL,                    -- "Quem e o maior jogador?"
  emoji       TEXT NOT NULL DEFAULT '🏆',
  status      TEXT NOT NULL DEFAULT 'draft',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- `rating` e Elo: comeca em 1500 e e recalculado a cada duelo.
CREATE TABLE ranking_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  list_slug   TEXT NOT NULL REFERENCES ranking_lists (slug) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  rating      REAL NOT NULL DEFAULT 1500,
  matches     INTEGER NOT NULL DEFAULT 0,
  wins        INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published'
);
CREATE INDEX ranking_entries_list_idx ON ranking_entries (list_slug, status);

-- Quiz rapido.
CREATE TABLE quiz_topics (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  difficulty  TEXT NOT NULL DEFAULT 'medio',    -- 'facil' | 'medio' | 'dificil' | 'impossivel'
  status      TEXT NOT NULL DEFAULT 'draft',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- `choices_json` e um array JSON de strings; `correct_index` aponta para ele.
-- Fica como texto porque a alternativa (tabela de alternativas) custaria um JOIN
-- por pergunta sem nunca precisar consultar uma alternativa isolada.
CREATE TABLE quiz_questions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_slug     TEXT NOT NULL REFERENCES quiz_topics (slug) ON DELETE CASCADE,
  prompt         TEXT NOT NULL,
  choices_json   TEXT NOT NULL,
  correct_index  INTEGER NOT NULL,
  explanation    TEXT,
  difficulty     TEXT NOT NULL DEFAULT 'medio',
  times_shown    INTEGER NOT NULL DEFAULT 0,
  times_correct  INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft',
  source         TEXT NOT NULL DEFAULT 'seed',
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX quiz_questions_topic_idx ON quiz_questions (topic_slug, status);

-- Reservas de vaga do limitador de chamadas a APIs externas.
-- Portado de gerador-de-video/src/modules/persistence/api-rate-limit-d1.ts:
-- o escopo da protecao precisa ser a conta inteira, e D1 e o unico estado que
-- todas as instancias ja compartilham.
CREATE TABLE api_rate_limits (
  binding            TEXT PRIMARY KEY,
  next_available_at  INTEGER NOT NULL
);
