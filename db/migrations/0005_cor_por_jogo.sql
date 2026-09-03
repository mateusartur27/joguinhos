-- Cor solida por jogo, em vez do ciclo de 3 tons por posicao na lista.
--
-- Pedido explicito: "O Maior de Todos deve ter o fundo vermelho vivo". Um
-- ciclo por indice (`--tom-${indice % 3}`) nunca garantiria isso — a cor de
-- um jogo mudaria toda vez que outro jogo fosse publicado antes dele na
-- ordenacao. A cor precisa ser dado do jogo, nao acidente de posicao.
--
-- Guardado como hex direto (nao nome de variavel CSS): e o valor mais
-- flexivel para o motor de conteudo atribuir cor a um jogo novo sem exigir
-- deploy, na mesma linha do resto do catalogo (games ja e lido do banco por
-- esse motivo).

ALTER TABLE games ADD COLUMN color TEXT NOT NULL DEFAULT '#7c3aed';
ALTER TABLE ranking_lists ADD COLUMN color TEXT NOT NULL DEFAULT '#7c3aed';
ALTER TABLE quiz_topics ADD COLUMN color TEXT NOT NULL DEFAULT '#7c3aed';

UPDATE games SET color = '#7c3aed' WHERE slug = 'escolhas';           -- roxo
UPDATE games SET color = '#dc2626' WHERE slug = 'ranking-jogadores';  -- vermelho
UPDATE games SET color = '#ea580c' WHERE slug = 'ranking-comidas';    -- laranja
UPDATE games SET color = '#16a34a' WHERE slug = 'quiz-futebol';       -- verde
UPDATE games SET color = '#2563eb' WHERE slug = 'quiz-geral';         -- azul
UPDATE games SET color = '#db2777' WHERE slug = 'quiz-games';         -- rosa

UPDATE ranking_lists SET color = '#dc2626' WHERE slug = 'jogadores';  -- vermelho
UPDATE ranking_lists SET color = '#ea580c' WHERE slug = 'comidas';    -- laranja

UPDATE quiz_topics SET color = '#16a34a' WHERE slug = 'futebol';      -- verde
UPDATE quiz_topics SET color = '#2563eb' WHERE slug = 'geral';        -- azul
UPDATE quiz_topics SET color = '#db2777' WHERE slug = 'games';        -- rosa
