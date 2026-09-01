-- Listas iniciais do Ranking Coletivo.
--
-- Cada lista e um jogo proprio no catalogo, com link direto: um video sobre
-- "maior jogador" manda para /ranking/jogadores, nao para a home.

INSERT INTO games (slug, title, tagline, emoji, kind, href, status, sort_order) VALUES
  ('ranking-jogadores', 'O Maior de Todos', 'Duelo a duelo, o público monta o ranking dos jogadores.', '⚽', 'ranking', '/ranking/jogadores', 'published', 2),
  ('ranking-comidas', 'Melhor Comida do Brasil', 'Escolha entre duas. Milhares de duelos definem o pódio.', '🍽️', 'ranking', '/ranking/comidas', 'published', 3);

INSERT INTO ranking_lists (slug, title, question, emoji, status, sort_order) VALUES
  ('jogadores', 'O Maior de Todos', 'Quem é o maior jogador da história?', '⚽', 'published', 1),
  ('comidas', 'Melhor Comida do Brasil', 'Qual é a melhor comida brasileira?', '🍽️', 'published', 2);

INSERT INTO ranking_entries (list_slug, label) VALUES
  ('jogadores', 'Pelé'),
  ('jogadores', 'Maradona'),
  ('jogadores', 'Messi'),
  ('jogadores', 'Cristiano Ronaldo'),
  ('jogadores', 'Ronaldo Fenômeno'),
  ('jogadores', 'Ronaldinho Gaúcho'),
  ('jogadores', 'Zidane'),
  ('jogadores', 'Romário'),
  ('jogadores', 'Neymar'),
  ('jogadores', 'Rivaldo'),
  ('jogadores', 'Kaká'),
  ('jogadores', 'Garrincha'),
  ('jogadores', 'Johan Cruyff'),
  ('jogadores', 'Beckenbauer'),
  ('jogadores', 'Mbappé'),
  ('jogadores', 'Haaland');

INSERT INTO ranking_entries (list_slug, label) VALUES
  ('comidas', 'Feijoada'),
  ('comidas', 'Coxinha'),
  ('comidas', 'Pão de queijo'),
  ('comidas', 'Brigadeiro'),
  ('comidas', 'Açaí'),
  ('comidas', 'Churrasco'),
  ('comidas', 'Moqueca'),
  ('comidas', 'Pastel de feira'),
  ('comidas', 'Tapioca'),
  ('comidas', 'Escondidinho'),
  ('comidas', 'Baião de dois'),
  ('comidas', 'Acarajé'),
  ('comidas', 'Bolo de rolo'),
  ('comidas', 'Vatapá'),
  ('comidas', 'Cuscuz'),
  ('comidas', 'Estrogonofe');
