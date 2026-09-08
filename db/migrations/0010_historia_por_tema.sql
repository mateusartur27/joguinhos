-- Consolida Historia Interativa num jogo so: a pessoa escolhe o tema ao
-- abrir, e cada tema tem uma historia nova por dia (mesmo padrao de selecao
-- deterministica do Jogo Diario, agora com filtro por categoria). Finais
-- ganham veredito (vitoria/derrota), nao so "4 finais diferentes" sem
-- resultado.

ALTER TABLE story_nodes ADD COLUMN outcome TEXT; -- 'vitoria' | 'derrota', so em is_ending = 1

-- Backfill dos 3 finais existentes, classificados pelo tom de cada um:
-- derrota = final em aberto/inquietante sem resolucao; vitoria = final
-- resolvido ou com desfecho positivo para quem joga.
UPDATE story_nodes SET outcome = 'derrota' WHERE id IN (1, 3, 10, 16, 18, 19);
UPDATE story_nodes SET outcome = 'vitoria' WHERE id IN (2, 4, 8, 9, 11, 15);

-- Um cartao so na home, no lugar dos 3 atuais.
DELETE FROM games WHERE slug IN ('historia-batidas', 'historia-bilhete', 'historia-o-ultimo-voo-de-marte');
INSERT INTO games (slug, title, tagline, emoji, kind, href, status, sort_order, color, card_colors)
VALUES (
  'historia',
  'História Interativa',
  'Escolha o tema. Uma história nova todo dia, com vitória ou derrota no final.',
  '📖',
  'historia',
  '/historia',
  'published',
  9,
  '#4c1d95',
  '["#b45309","#0f766e"]'
);
