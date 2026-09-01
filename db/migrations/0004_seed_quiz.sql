-- Temas e perguntas iniciais do Quiz rapido.
--
-- Cada tema e um jogo proprio no catalogo, com link direto: um video sobre
-- futebol manda para /quiz/futebol.

INSERT INTO games (slug, title, tagline, emoji, kind, href, status, sort_order) VALUES
  ('quiz-futebol', 'Você conhece futebol?', '8 perguntas. A maioria não passa de 5.', '⚽', 'quiz', '/quiz/futebol', 'published', 4),
  ('quiz-geral', 'Cultura Geral', 'Oito perguntas rápidas para medir o básico.', '🧠', 'quiz', '/quiz/geral', 'published', 5),
  ('quiz-games', 'Você jogou mesmo?', 'Prove que você entende de videogame.', '🎮', 'quiz', '/quiz/games', 'published', 6);

INSERT INTO quiz_topics (slug, title, emoji, difficulty, status, sort_order) VALUES
  ('futebol', 'Você conhece futebol?', '⚽', 'medio', 'published', 1),
  ('geral', 'Cultura Geral', '🧠', 'medio', 'published', 2),
  ('games', 'Você jogou mesmo?', '🎮', 'medio', 'published', 3);

INSERT INTO quiz_questions (topic_slug, prompt, choices_json, correct_index, explanation, status, source) VALUES
  ('futebol', 'Quantas Copas do Mundo o Brasil venceu?', '["3","4","5","6"]', 2, 'Brasil é pentacampeão: 1958, 1962, 1970, 1994 e 2002.', 'published', 'seed'),
  ('futebol', 'Em que ano o Brasil venceu a Copa pela última vez?', '["1994","1998","2002","2006"]', 2, 'Foi em 2002, na Copa da Coreia do Sul e Japão.', 'published', 'seed'),
  ('futebol', 'Quem marcou os dois gols do Brasil na final da Copa de 2002?', '["Rivaldo","Ronaldinho Gaúcho","Ronaldo","Cafu"]', 2, 'Ronaldo marcou os dois gols contra a Alemanha.', 'published', 'seed'),
  ('futebol', 'Qual seleção venceu a Copa do Mundo de 2018?', '["Croácia","França","Alemanha","Bélgica"]', 1, 'A França venceu a Croácia por 4 a 2 na final.', 'published', 'seed'),
  ('futebol', 'Qual país sediou a Copa do Mundo de 2014?', '["África do Sul","Rússia","Brasil","Catar"]', 2, 'O Brasil sediou a Copa de 2014.', 'published', 'seed'),
  ('futebol', 'Quantos jogadores de cada time começam em campo?', '["9","10","11","12"]', 2, 'São 11 por time, incluindo o goleiro.', 'published', 'seed'),
  ('futebol', 'Quem é o maior artilheiro da história das Copas do Mundo?', '["Pelé","Miroslav Klose","Ronaldo","Gerd Müller"]', 1, 'Klose marcou 16 gols em Copas.', 'published', 'seed'),
  ('futebol', 'Em que ano aconteceu o Maracanaço, a derrota do Brasil para o Uruguai?', '["1938","1950","1954","1962"]', 1, 'Foi na final da Copa de 1950, no Maracanã.', 'published', 'seed'),
  ('futebol', 'Qual jogador tem mais Bolas de Ouro na história?', '["Cristiano Ronaldo","Messi","Platini","Johan Cruyff"]', 1, 'Messi é quem mais venceu o prêmio.', 'published', 'seed'),
  ('futebol', 'Quantos minutos tem cada tempo de uma partida oficial?', '["30","40","45","50"]', 2, 'São dois tempos de 45 minutos.', 'published', 'seed'),

  ('geral', 'Qual é o maior planeta do Sistema Solar?', '["Saturno","Júpiter","Netuno","Urano"]', 1, 'Júpiter é o maior, com massa maior que a de todos os outros planetas somados.', 'published', 'seed'),
  ('geral', 'Qual é a capital da Austrália?', '["Sydney","Melbourne","Camberra","Perth"]', 2, 'A capital é Camberra, não Sydney.', 'published', 'seed'),
  ('geral', 'Quantos ossos tem o corpo humano adulto?', '["186","206","226","246"]', 1, 'São 206 ossos no adulto; o bebê nasce com mais.', 'published', 'seed'),
  ('geral', 'Qual metal é líquido à temperatura ambiente?', '["Chumbo","Mercúrio","Alumínio","Zinco"]', 1, 'O mercúrio é o único metal líquido nessas condições.', 'published', 'seed'),
  ('geral', 'Quem pintou a Mona Lisa?', '["Michelangelo","Rafael","Leonardo da Vinci","Van Gogh"]', 2, 'A obra é de Leonardo da Vinci.', 'published', 'seed'),
  ('geral', 'Qual é o maior oceano do planeta?', '["Atlântico","Índico","Ártico","Pacífico"]', 3, 'O Pacífico é o maior e o mais profundo.', 'published', 'seed'),
  ('geral', 'Em que ano o homem pisou na Lua pela primeira vez?', '["1961","1965","1969","1972"]', 2, 'A Apollo 11 pousou em julho de 1969.', 'published', 'seed'),
  ('geral', 'Qual é o símbolo químico do ouro?', '["Ou","Au","Ag","Go"]', 1, 'Au, do latim aurum.', 'published', 'seed'),
  ('geral', 'Quantos estados tem o Brasil?', '["24","25","26","27"]', 2, 'São 26 estados mais o Distrito Federal.', 'published', 'seed'),
  ('geral', 'Qual planeta é conhecido como planeta vermelho?', '["Vênus","Marte","Mercúrio","Júpiter"]', 1, 'Marte, pela cor do óxido de ferro no solo.', 'published', 'seed'),

  ('games', 'Qual é o nome do encanador mais famoso dos videogames?', '["Luigi","Mario","Wario","Toad"]', 1, 'Mario, da Nintendo.', 'published', 'seed'),
  ('games', 'Em qual série de jogos aparece o Master Chief?', '["Gears of War","Halo","Doom","Destiny"]', 1, 'Master Chief é o protagonista de Halo.', 'published', 'seed'),
  ('games', 'Qual empresa criou o PlayStation?', '["Microsoft","Nintendo","Sony","Sega"]', 2, 'O PlayStation é da Sony.', 'published', 'seed'),
  ('games', 'Qual é o jogo mais vendido de todos os tempos?', '["Tetris","GTA V","Minecraft","Wii Sports"]', 2, 'Minecraft lidera as vendas históricas.', 'published', 'seed'),
  ('games', 'Qual é o nome do ouriço azul da Sega?', '["Knuckles","Tails","Sonic","Shadow"]', 2, 'Sonic the Hedgehog.', 'published', 'seed'),
  ('games', 'Em qual série de jogos o protagonista se chama Link?', '["Final Fantasy","The Legend of Zelda","Castlevania","Metroid"]', 1, 'Link é o herói de The Legend of Zelda.', 'published', 'seed'),
  ('games', 'Qual é o nome da protagonista de Tomb Raider?', '["Samus Aran","Lara Croft","Jill Valentine","Chun-Li"]', 1, 'Lara Croft.', 'published', 'seed'),
  ('games', 'Qual estúdio desenvolve a série GTA?', '["Ubisoft","Rockstar Games","EA","Bethesda"]', 1, 'GTA é da Rockstar Games.', 'published', 'seed'),
  ('games', 'Wii Sports foi lançado junto com qual console?', '["Nintendo 64","GameCube","Nintendo Wii","Nintendo Switch"]', 2, 'Veio junto com o Nintendo Wii.', 'published', 'seed'),
  ('games', 'Qual é o nome do irmão do Mario?', '["Wario","Yoshi","Luigi","Waluigi"]', 2, 'Luigi é o irmão do Mario.', 'published', 'seed');
