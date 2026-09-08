-- Historia Interativa: arvore de nos (raiz -> 2 escolhas -> 2 escolhas cada
-- = ate 4 finais). Cada historia e uma linha propria em `games`, mesmo
-- padrao de cada lista de ranking/tema de quiz ter seu proprio cartao.
--
-- Sem `status` por no: o status e da historia inteira (`stories.status`) —
-- um no nunca existe fora do contexto de uma historia publicada ou nao.

CREATE TABLE stories (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,
  color       TEXT NOT NULL,
  card_colors TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE story_nodes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  story_slug        TEXT NOT NULL REFERENCES stories (slug) ON DELETE CASCADE,
  is_root           INTEGER NOT NULL DEFAULT 0,
  is_ending         INTEGER NOT NULL DEFAULT 0,
  text              TEXT NOT NULL,
  choice_a_label    TEXT,
  choice_a_next_id  INTEGER REFERENCES story_nodes (id),
  choice_b_label    TEXT,
  choice_b_next_id  INTEGER REFERENCES story_nodes (id),
  times_reached     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX story_nodes_story_idx ON story_nodes (story_slug);

INSERT INTO stories (slug, title, category, color, card_colors, status, sort_order) VALUES
('batidas-na-porta', 'Batidas na Porta', 'Terror', '#7f1d1d', '["#b45309","#581c87"]', 'published', 1),
('bilhete-na-biblioteca', 'O Bilhete na Biblioteca', 'Mistério', '#4c1d95', '["#b45309","#0f766e"]', 'published', 2);

INSERT INTO games (slug, title, tagline, emoji, kind, href, status, sort_order, color, card_colors) VALUES
('historia-batidas', 'Batidas na Porta', 'Uma história curta de terror. Suas escolhas decidem o final.', '🚪', 'historia', '/historia/batidas-na-porta', 'published', 9, '#7f1d1d', '["#b45309","#581c87"]'),
('historia-bilhete', 'O Bilhete na Biblioteca', 'Um mistério curto com 4 finais possíveis. Investigue com cuidado.', '📖', 'historia', '/historia/bilhete-na-biblioteca', 'published', 10, '#4c1d95', '["#b45309","#0f766e"]');

-- "Batidas na Porta" — insercao de baixo para cima: os 4 finais primeiro
-- (ids 1-4), depois os 2 nos intermediarios (5-6, referenciando os finais),
-- depois a raiz (7, referenciando os intermediarios). A ordem de insercao
-- e o que garante que os ids previstos abaixo batem com os de verdade.
INSERT INTO story_nodes (story_slug, is_ending, text) VALUES
('batidas-na-porta', 1, 'Uma voz sussurra seu nome do outro lado da linha — o mesmo nome que só sua família usa. A ligação cai. Você nunca mais soube quem tocou naquela porta.'),
('batidas-na-porta', 1, 'Você tranca a porta e finge que nada aconteceu. Na manhã seguinte, o celular já não está mais lá — e você nunca conta essa história a ninguém.'),
('batidas-na-porta', 1, 'Você encontra só silêncio e escuridão no corredor. Ao voltar, percebe que sua porta, que você tinha certeza de ter trancado, está entreaberta.'),
('batidas-na-porta', 1, 'O sol nasce e nada mais acontece. Você nunca saberá o que bateu na sua porta — e talvez seja melhor assim.');

INSERT INTO story_nodes (story_slug, text, choice_a_label, choice_a_next_id, choice_b_label, choice_b_next_id) VALUES
('batidas-na-porta', 'Você abre a porta. Não há ninguém. Mas existe um celular no chão, tocando.', '📞 Atender', 1, '🚶 Ignorar e fechar a porta', 2),
('batidas-na-porta', 'Você liga pro seu vizinho mais próximo. Ele diz que ouviu passos no corredor há uma hora, mas nada depois disso.', '🔦 Ir até o corredor checar', 3, '🔒 Trancar tudo e esperar o dia clarear', 4);

INSERT INTO story_nodes (story_slug, is_root, text, choice_a_label, choice_a_next_id, choice_b_label, choice_b_next_id) VALUES
('batidas-na-porta', 1, 'São 2h37 da manhã. Alguém bate na sua porta. Você olha pela câmera e não tem ninguém.', '🚪 Abro a porta', 5, '📱 Ligo para alguém', 6);

-- "O Bilhete na Biblioteca" — mesma ordem: finais (8-11), intermediarios
-- (12-13), raiz (14).
INSERT INTO story_nodes (story_slug, is_ending, text) VALUES
('bilhete-na-biblioteca', 1, 'No porão, você encontra décadas de registros escondidos: o prédio guardava documentos que a prefeitura queria apagados. Você virou, sem querer, a pessoa que expôs o segredo mais antigo da cidade.'),
('bilhete-na-biblioteca', 1, 'As fotos viram a maior pista de uma investigação que muda os rumos da cidade — mas ninguém nunca soube que foi você quem começou tudo.'),
('bilhete-na-biblioteca', 1, 'O número toca sem parar. Semanas depois, uma carta chega sem remetente: "Obrigado por não ter descido até o porão."'),
('bilhete-na-biblioteca', 1, 'Entre os papéis, você encontra uma versão do mapa que ele deixou de propósito para você achar. Ele queria que alguém continuasse o que ele começou.');

INSERT INTO story_nodes (story_slug, text, choice_a_label, choice_a_next_id, choice_b_label, choice_b_next_id) VALUES
('bilhete-na-biblioteca', 'Você entra no escritório trancado usando a chave reserva. Na gaveta, encontra um mapa antigo da cidade com um ponto marcado no porão do prédio.', '🔦 Descer até o porão agora', 8, '📸 Fotografar tudo e sair antes que alguém perceba', 9),
('bilhete-na-biblioteca', 'Na manhã seguinte, uma colega sussurra que o bibliotecário-chefe pediu demissão de repente, sem explicação, e sumiu da cidade.', '📞 Tentar contatá-lo mesmo assim', 10, '🗄️ Vasculhar os arquivos que ele deixou pra trás', 11);

INSERT INTO story_nodes (story_slug, is_root, text, choice_a_label, choice_a_next_id, choice_b_label, choice_b_next_id) VALUES
('bilhete-na-biblioteca', 1, 'Você está fechando a biblioteca da cidade quando encontra um bilhete anônimo escondido entre os livros: "Não confie no bibliotecário-chefe."', '🕵️ Investigar o escritório dele agora', 12, '📚 Perguntar pros outros funcionários amanhã', 13);
