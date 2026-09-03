-- Cores dos cartoes, separadas da cor de fundo.
--
-- Pedido: o fundo da tela vira a cor solida do jogo (ja em `color`), e os
-- cartoes/botoes por cima usam OUTRAS cores, escolhidas para combinar com
-- aquele fundo especifico — card da mesma cor do fundo some visualmente.
--
-- `card_colors` e JSON (array de hex) porque quiz precisa de 4 (uma por
-- alternativa) e escolhas/ranking precisam de 2 (uma por lado) — coluna
-- unica com array cobre os dois casos sem tabela nova, mesmo padrao de
-- `choices_json` em quiz_questions.

ALTER TABLE games ADD COLUMN card_colors TEXT NOT NULL DEFAULT '["#f59e0b","#2563eb"]';
ALTER TABLE ranking_lists ADD COLUMN card_colors TEXT NOT NULL DEFAULT '["#f59e0b","#2563eb"]';
ALTER TABLE quiz_topics ADD COLUMN card_colors TEXT NOT NULL DEFAULT '["#f59e0b","#2563eb","#16a34a","#db2777"]';

-- Escolhas Impossiveis: fundo roxo -> cartoes amarelo e vermelho.
UPDATE games SET card_colors = '["#f59e0b","#dc2626"]' WHERE slug = 'escolhas';

-- O Maior de Todos: fundo vermelho -> cartoes amarelo e azul (trio primario).
UPDATE games SET card_colors = '["#f59e0b","#2563eb"]' WHERE slug = 'ranking-jogadores';
UPDATE ranking_lists SET card_colors = '["#f59e0b","#2563eb"]' WHERE slug = 'jogadores';

-- Melhor Comida do Brasil: fundo laranja -> cartoes verde e rosa.
UPDATE games SET card_colors = '["#16a34a","#db2777"]' WHERE slug = 'ranking-comidas';
UPDATE ranking_lists SET card_colors = '["#16a34a","#db2777"]' WHERE slug = 'comidas';

-- Voce conhece futebol?: fundo verde -> alternativas em amarelo/azul/rosa/laranja.
UPDATE games SET card_colors = '["#f59e0b","#2563eb","#db2777","#ea580c"]' WHERE slug = 'quiz-futebol';
UPDATE quiz_topics SET card_colors = '["#f59e0b","#2563eb","#db2777","#ea580c"]' WHERE slug = 'futebol';

-- Cultura Geral: fundo azul -> alternativas em amarelo/rosa/verde/laranja.
UPDATE games SET card_colors = '["#f59e0b","#db2777","#16a34a","#ea580c"]' WHERE slug = 'quiz-geral';
UPDATE quiz_topics SET card_colors = '["#f59e0b","#db2777","#16a34a","#ea580c"]' WHERE slug = 'geral';

-- Voce jogou mesmo?: fundo rosa -> alternativas em amarelo/azul/verde/roxo.
UPDATE games SET card_colors = '["#f59e0b","#2563eb","#16a34a","#7c3aed"]' WHERE slug = 'quiz-games';
UPDATE quiz_topics SET card_colors = '["#f59e0b","#2563eb","#16a34a","#7c3aed"]' WHERE slug = 'games';
