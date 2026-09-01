-- Acervo inicial de Escolhas Impossiveis.
--
-- Vai como migracao, e nao como script de seed avulso, porque o jogo nao
-- funciona com a tabela vazia: sem acervo nao ha loop, e sem loop nao ha
-- produto. Um banco novo precisa nascer jogavel.
--
-- Estes entram direto como 'published' por serem escritos a mao. O que o
-- Gemini gerar depois entra como 'draft' e passa por revisao.

INSERT INTO games (slug, title, tagline, emoji, kind, href, status, sort_order) VALUES
  ('escolhas', 'Escolhas Impossíveis', 'Decida o indecidível e veja o que o Brasil escolheu.', '⚖️', 'escolhas', '/escolhas', 'published', 1);

INSERT INTO dilemmas (category, option_a, option_b, status, source) VALUES
  -- dinheiro
  ('dinheiro', 'R$ 5 milhões agora', 'R$ 50 mil por mês para sempre', 'published', 'seed'),
  ('dinheiro', 'R$ 1 milhão hoje', 'R$ 10 milhões daqui a 10 anos', 'published', 'seed'),
  ('dinheiro', 'Nunca mais pagar contas de casa', 'Nunca mais pagar por comida', 'published', 'seed'),
  ('dinheiro', 'Você ganhar R$ 100 mil', 'Quem você não suporta perder R$ 500 mil', 'published', 'seed'),
  ('dinheiro', 'Salário dobrado trabalhando 12h por dia', 'Salário de hoje trabalhando 4h por dia', 'published', 'seed'),
  ('dinheiro', '50% de chance de ganhar R$ 10 milhões', '100% de chance de ganhar R$ 500 mil', 'published', 'seed'),
  ('dinheiro', 'Receber R$ 20 mil por mês sem nunca trabalhar', 'Receber R$ 60 mil por mês no emprego dos sonhos', 'published', 'seed'),

  -- vida
  ('vida', 'Voltar aos 15 anos sabendo o que sabe hoje', 'Saber exatamente como será sua vida daqui a 20 anos', 'published', 'seed'),
  ('vida', 'Viver 150 anos com saúde mediana', 'Viver 70 anos com saúde perfeita', 'published', 'seed'),
  ('vida', 'Nunca mais sentir dor física', 'Nunca mais sentir tristeza', 'published', 'seed'),
  ('vida', 'Apagar uma lembrança sua', 'Apagar uma lembrança que alguém tem de você', 'published', 'seed'),
  ('vida', 'Trabalhar com o que ama ganhando pouco', 'Odiar o trabalho ganhando muito', 'published', 'seed'),
  ('vida', 'Refazer uma escolha do seu passado', 'Ver o que teria acontecido se tivesse escolhido diferente', 'published', 'seed'),
  ('vida', 'Ser lembrado por 500 anos depois que morrer', 'Ser muito feliz e esquecido em 5 anos', 'published', 'seed'),

  -- relacionamentos
  ('relacionamentos', 'Saber sempre quando estão mentindo para você', 'Nunca mais ser enganado, sem nunca saber por quem', 'published', 'seed'),
  ('relacionamentos', 'Três amigos de verdade', 'Trezentos amigos de festa', 'published', 'seed'),
  ('relacionamentos', 'Ler a mente de quem você ama', 'Nunca mais duvidar do que sentem por você', 'published', 'seed'),
  ('relacionamentos', 'Ver tudo que já falaram de você pelas suas costas', 'Nunca mais saber o que falam de você', 'published', 'seed'),
  ('relacionamentos', 'Amar muito e não ser correspondido', 'Ser muito amado sem sentir o mesmo', 'published', 'seed'),

  -- poderes
  ('poderes', 'Voar', 'Ficar invisível', 'published', 'seed'),
  ('poderes', 'Teletransporte para qualquer lugar', 'Parar o tempo por 10 minutos por dia', 'published', 'seed'),
  ('poderes', 'Falar todas as línguas do mundo', 'Conversar com animais', 'published', 'seed'),
  ('poderes', 'Nunca mais precisar dormir', 'Nunca mais precisar comer', 'published', 'seed'),
  ('poderes', 'Voltar 10 segundos no tempo, uma vez por dia', 'Saber a resposta certa de qualquer pergunta, uma vez por dia', 'published', 'seed'),

  -- absurdo
  ('absurdo', 'Ter mãos no lugar dos pés', 'Ter pés no lugar das mãos', 'published', 'seed'),
  ('absurdo', 'Espirrar a cada 5 minutos por um ano', 'Nunca mais conseguir espirrar', 'published', 'seed'),
  ('absurdo', 'Só comer doce pelo resto da vida', 'Só comer salgado pelo resto da vida', 'published', 'seed'),
  ('absurdo', 'Cantar tudo que você fala', 'Dançar o tempo todo enquanto anda', 'published', 'seed'),
  ('absurdo', 'Wi-Fi lento mas que nunca cai', 'Wi-Fi rapidíssimo que cai toda hora', 'published', 'seed'),
  ('absurdo', 'Falar tudo que pensa por um dia', 'Ouvir tudo que pensam de você por um dia', 'published', 'seed'),

  -- futebol
  ('futebol', 'Seu time campeão da Libertadores', 'Seu maior rival rebaixado', 'published', 'seed'),
  ('futebol', 'Seu time ganha tudo por 5 anos e depois some', 'Seu time nunca ganha nada mas nunca cai', 'published', 'seed'),
  ('futebol', 'Messi no auge no seu time por 1 ano', 'Neymar no auge no seu time por 3 anos', 'published', 'seed'),
  ('futebol', 'Brasil hexacampeão sem você ver nenhum jogo', 'Ver todos os jogos e o Brasil cair nas oitavas', 'published', 'seed'),

  -- tecnologia
  ('tecnologia', 'Perder todas as fotos do seu celular', 'Perder todos os seus contatos', 'published', 'seed'),
  ('tecnologia', 'Um ano sem internet', 'Um ano sem sair de casa, com internet', 'published', 'seed'),
  ('tecnologia', 'Nunca mais usar redes sociais', 'Nunca mais assistir a vídeos', 'published', 'seed'),
  ('tecnologia', 'Seu histórico de pesquisa exposto', 'Suas conversas privadas expostas', 'published', 'seed'),

  -- medo
  ('medo', 'Saber o dia exato da sua morte', 'Saber a causa da sua morte', 'published', 'seed'),
  ('medo', 'Uma noite sozinho em um hospital abandonado', 'Uma noite sozinho em um cemitério', 'published', 'seed'),
  ('medo', 'Descobrir que fantasmas existem', 'Descobrir que alienígenas existem', 'published', 'seed'),
  ('medo', 'Ouvir alguém andando na sua casa toda madrugada', 'Nunca mais conseguir se olhar no espelho', 'published', 'seed');
