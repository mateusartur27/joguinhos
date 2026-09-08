-- Jogo Diario: um desafio so por dia, igual para todo mundo (selecao
-- deterministica por indice do dia, nao aleatoria). 5 pistas progressivas,
-- palpite em texto livre. `daily_results` guarda o agregado do dia para
-- "melhor que X% dos jogadores de hoje".

CREATE TABLE daily_challenges (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  category               TEXT NOT NULL,
  answer                 TEXT NOT NULL,
  accepted_answers_json  TEXT NOT NULL,
  clues_json             TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'draft',
  source                 TEXT NOT NULL DEFAULT 'gemini',
  created_at             INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX daily_challenges_status_idx ON daily_challenges (status);

-- Uma linha por dia (UTC). Cada coluna hits_N conta quem acertou na pista N;
-- misses conta quem esgotou as 5 sem acertar.
CREATE TABLE daily_results (
  play_date     TEXT PRIMARY KEY,
  challenge_id  INTEGER NOT NULL,
  hits_1        INTEGER NOT NULL DEFAULT 0,
  hits_2        INTEGER NOT NULL DEFAULT 0,
  hits_3        INTEGER NOT NULL DEFAULT 0,
  hits_4        INTEGER NOT NULL DEFAULT 0,
  hits_5        INTEGER NOT NULL DEFAULT 0,
  misses        INTEGER NOT NULL DEFAULT 0
);

INSERT INTO games (slug, title, tagline, emoji, kind, href, status, sort_order, color, card_colors)
VALUES (
  'diario',
  'Jogo Diário',
  'Um desafio novo por dia. Descubra em até 5 pistas — todo mundo joga o mesmo hoje.',
  '🗓️',
  'diario',
  '/diario',
  'published',
  8,
  '#4338ca',
  '["#f59e0b","#ea580c"]'
);

-- Acervo inicial: pistas da mais vaga para a mais obvia, respostas aceitas
-- ja em variantes comuns (apelido, forma curta).
INSERT INTO daily_challenges (category, answer, accepted_answers_json, clues_json, status) VALUES
('jogador', 'Cristiano Ronaldo', '["Cristiano Ronaldo","CR7","Ronaldo","Cristiano"]',
 '["Nasci numa ilha portuguesa no meio do Atlântico.","Já vesti a camisa de Manchester United, Real Madrid, Juventus e Al-Nassr.","Um dos meus apelidos mais famosos é uma sigla com minhas iniciais e um número.","Sou o maior artilheiro da história de seleções nacionais de futebol.","Jogo com a camisa 7 e comemoro meus gols pulando e girando no ar."]',
 'published'),
('país', 'Japão', '["Japão"]',
 '["Sou um conjunto de ilhas no Oceano Pacífico.","Minha capital está entre as maiores áreas metropolitanas do mundo.","Sou conhecido por sushi, mangá e trens-bala superrápidos.","Fui o único país a sofrer ataques com bombas atômicas, em 1945.","Minha bandeira é branca com um círculo vermelho no centro."]',
 'published'),
('animal', 'Elefante', '["Elefante","Elefante Africano"]',
 '["Sou o maior animal terrestre vivo no planeta.","Minhas orelhas grandes me ajudam a perder calor do corpo.","Uso meu nariz comprido para beber água, comer e me comunicar.","Vivo em grupos liderados por uma fêmea mais velha, a matriarca.","Tenho presas de marfim que, infelizmente, atraem caçadores ilegais."]',
 'published'),
('filme', 'Titanic', '["Titanic"]',
 '["Sou um filme baseado numa tragédia real de 1912.","Minha história é sobre um casal de classes sociais diferentes.","Tenho uma cena famosa na proa de um navio, de braços abertos.","Meu navio bateu num iceberg no Oceano Atlântico Norte.","Minha canção-tema é cantada por Céline Dion."]',
 'published'),
('objeto', 'Guarda-chuva', '["Guarda-chuva","Guarda chuva","Sombrinha"]',
 '["Sou um objeto que você espera nunca precisar, mas é bom ter por perto.","Fico dobrado e guardado na maior parte do tempo.","Tenho hastes que se abrem formando um círculo.","Uso mais em dias nublados do que em dias de sol.","Te protejo da chuva quando abro por cima da sua cabeça."]',
 'published'),
('jogador', 'Michael Jordan', '["Michael Jordan","Jordan","MJ"]',
 '["Sou um ex-atleta americano considerado por muitos o maior da história do meu esporte.","Joguei a maior parte da carreira por um time de Chicago.","Ganhei seis títulos de campeão na década de 1990.","Tenho uma marca de tênis com meu nome e o símbolo de um salto.","Uso o número 23 e sou uma lenda do basquete."]',
 'published'),
('país', 'Brasil', '["Brasil"]',
 '["Sou o maior país da América do Sul.","Minha língua oficial é diferente da maioria dos meus vizinhos.","Tenho a maior floresta tropical do mundo dentro do meu território.","Sou pentacampeão mundial de futebol.","Minha bandeira é verde e amarela, com um círculo azul estrelado."]',
 'published'),
('animal', 'Girafa', '["Girafa"]',
 '["Sou o animal terrestre mais alto do mundo.","Meu pescoço comprido tem o mesmo número de vértebras que o seu: sete.","Vivo nas savanas da África.","Minha pele tem um padrão de manchas único, como uma impressão digital.","Uso minha língua escura e comprida para pegar folhas bem alto nas árvores."]',
 'published'),
('filme', 'Star Wars', '["Star Wars","Guerra nas Estrelas"]',
 '["Sou uma franquia de filmes que começou em 1977.","Minha história se passa \"há muito tempo, numa galáxia muito distante\".","Tenho cavaleiros que usam espadas de luz e sentem \"a Força\".","Um dos meus vilões mais famosos respira pesado e usa capacete preto.","Minha frase mais famosa é \"Que a Força esteja com você\"."]',
 'published'),
('personagem', 'Batman', '["Batman","Homem-Morcego","Bruce Wayne"]',
 '["Sou um herói de quadrinhos sem superpoderes, só muita tecnologia e treino.","De dia sou um bilionário; à noite, viro outra pessoa.","Moro numa mansão com um mordomo leal chamado Alfred.","Meu maior inimigo é um vilão de rosto pintado de branco que sempre sorri.","Uso uma capa preta e um símbolo de morcego no peito."]',
 'published');
