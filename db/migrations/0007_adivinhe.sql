-- Adivinhe antes de revelar: pergunta de quantidade, 4 alternativas, revela o
-- valor real depois da escolha. Continuo (sem rodada fixa, sem tela final) —
-- mesmo padrao de dilemmas, nao o de quiz_topics/quiz_questions.

CREATE TABLE guesses (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category       TEXT NOT NULL,
  prompt         TEXT NOT NULL,
  choices_json   TEXT NOT NULL,
  correct_index  INTEGER NOT NULL,
  real_value     TEXT NOT NULL,
  explanation    TEXT,
  times_shown    INTEGER NOT NULL DEFAULT 0,
  times_correct  INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft',
  source         TEXT NOT NULL DEFAULT 'seed',
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX guesses_status_idx ON guesses (status);

INSERT INTO games (slug, title, tagline, emoji, kind, href, status, sort_order, color, card_colors)
VALUES (
  'adivinhe',
  'Adivinhe Antes de Revelar',
  'Escolha um palpite e veja se chegou perto do valor real.',
  '👀',
  'adivinhe',
  '/adivinhe',
  'published',
  7,
  '#d97706',
  '["#db2777","#7c3aed"]'
);

-- Acervo inicial: fatos fixos e verificaveis, nunca preco/cotacao/recorde que
-- muda — mesma regra do prompt do quiz, pelo mesmo motivo.
INSERT INTO guesses (category, prompt, choices_json, correct_index, real_value, explanation, status) VALUES
('geografia', 'Quantos habitantes tem o Brasil, segundo o Censo de 2022?', '["100 milhões","203 milhões","150 milhões","280 milhões"]', 1, '203,1 milhões de habitantes', 'O Brasil é o 7º país mais populoso do mundo.', 'published'),
('espaço', 'Qual é a distância média da Terra até a Lua?', '["150 mil km","384 mil km","800 mil km","1,5 milhão de km"]', 1, '384.400 km em média', 'A distância varia porque a órbita da Lua não é um círculo perfeito.', 'published'),
('natureza', 'Qual é a altura do Monte Everest?', '["6.190 m","7.200 m","8.849 m","9.500 m"]', 2, '8.849 metros', 'É o ponto mais alto da Terra acima do nível do mar.', 'published'),
('história', 'Quanto tempo durou a Segunda Guerra Mundial?', '["3 anos","4 anos","6 anos","10 anos"]', 2, '6 anos (1939–1945)', 'Começou com a invasão da Polônia e terminou com a rendição do Japão.', 'published'),
('natureza', 'Qual é o peso médio de um elefante-africano adulto?', '["1 tonelada","3 toneladas","6 toneladas","12 toneladas"]', 2, 'cerca de 6 toneladas', 'É o maior mamífero terrestre vivo.', 'published'),
('geografia', 'Qual é a extensão do Rio Amazonas?', '["2.800 km","4.300 km","6.400 km","9.000 km"]', 2, 'cerca de 6.400 km', 'Disputa com o Nilo o título de rio mais longo do mundo.', 'published'),
('espaço', 'Quanto tempo a luz do Sol leva para chegar à Terra?', '["8 segundos","8 minutos","8 horas","8 dias"]', 1, 'cerca de 8 minutos e 20 segundos', 'A luz viaja a 300 mil km/s, e o Sol está a 150 milhões de km.', 'published'),
('corpo humano', 'Quantos ossos tem o corpo humano adulto?', '["106","156","206","306"]', 2, '206 ossos', 'Um recém-nascido tem cerca de 270, que se fundem com o crescimento.', 'published'),
('natureza', 'Qual é a velocidade máxima de uma chita?', '["50 km/h","70 km/h","110 km/h","150 km/h"]', 2, 'cerca de 110 km/h', 'É o animal terrestre mais rápido do mundo.', 'published'),
('geografia', 'Qual é a profundidade máxima da Fossa das Marianas?', '["2 mil metros","6 mil metros","11 mil metros","15 mil metros"]', 2, 'cerca de 11.000 metros', 'É o ponto mais profundo já registrado nos oceanos.', 'published'),
('história', 'Há quanto tempo os dinossauros foram extintos?', '["6,5 mil anos","650 mil anos","6,5 milhões de anos","66 milhões de anos"]', 3, 'cerca de 66 milhões de anos', 'Um asteroide gigante é a explicação mais aceita para a extinção.', 'published'),
('ciência', 'Quantos litros de sangue tem, em média, um adulto?', '["2 litros","5 litros","8 litros","12 litros"]', 1, 'cerca de 5 litros', 'O volume varia com o peso e a altura da pessoa.', 'published'),
('geografia', 'Qual é a área territorial da Rússia, o maior país do mundo?', '["8 milhões de km²","12 milhões de km²","17 milhões de km²","22 milhões de km²"]', 2, 'cerca de 17 milhões de km²', 'A Rússia é tão grande que atravessa 11 fusos horários.', 'published'),
('natureza', 'Quantos corações tem um polvo?', '["1","2","3","4"]', 2, '3 corações', 'Dois bombeiam sangue para as brânquias e um para o resto do corpo.', 'published'),
('corpo humano', 'Quanto tempo, em média, uma pessoa passa dormindo durante a vida?', '["10 anos","18 anos","25 anos","35 anos"]', 2, 'cerca de 25 anos', 'É por volta de um terço da vida inteira.', 'published');
