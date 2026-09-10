# joguinhos

Plataforma de microjogos rápidos em português. Cada jogo tem página e link
próprios: um vídeo do TikTok manda a pessoa direto para a atração que a fez
clicar, sem cadastro e sem navegação.

**Produção:** https://joguinhos.mateus2002ns.workers.dev

## O ciclo que o produto fecha

Pessoas jogam → o banco acumula agregados (porcentagens, rankings, taxa de
acerto) → os resultados curiosos viram vídeo → o vídeo traz gente nova.

Por isso os números não são enfeite: são o insumo do conteúdo. Duas regras
saem daí e valem em todo o código:

- **Nada de número inventado.** Enquanto a amostra é pequena, a tela diz outra
  coisa ("você é um dos primeiros a responder isso") em vez de mostrar "100%".
- **Contadores agregados na própria linha**, nunca `COUNT(*)` sobre linhas de
  voto. O incremento é um `UPDATE` atômico do SQLite, sem transação por voto.

## Jogos

| Jogo | Rota | Mecânica |
| --- | --- | --- |
| Escolhas Impossíveis | `/escolhas` | Dilema binário, revela a % coletiva depois do voto |
| Ranking Coletivo | `/ranking/[lista]` | Duelos par a par alimentando um ranking por Elo |
| Quiz rápido | `/quiz/[tema]` | 8 perguntas, feedback imediato, comparação com a média |
| Adivinhe Antes de Revelar | `/adivinhe` | Palpite de quantidade, revela o valor real e a taxa de acerto |
| Jogo Diário | `/diario` | Um desafio igual pra todo mundo por dia, 5 pistas, palpite em texto livre |
| História Interativa | `/historia`, `/historia/[categoria]` | Escolhe o tema, joga a história de hoje daquele tema — 4 escolhas, 16 finais, vitória ou derrota |

Quiz e Escolhas evitam repetir conteúdo já visto guardando os ids no
`localStorage` do navegador e mandando-os de volta como exclusão na próxima
rodada (`sortearRodada`/`sortearDilemas` aceitam uma lista de ids a pular).
Sem isso, um tema com poucas perguntas publicadas (o caso real: `futebol`
tinha 14 e a rodada sorteia 8 — "jogar de novo" caía quase sempre nas mesmas)
repetia quase todo "jogar de novo". Se a exclusão esgotar o acervo do tema, a
função cai para sorteio sem exclusão — repetir é melhor que tela vazia.

Adivinhe Antes de Revelar reaproveita os dois padrões ao mesmo tempo: fluxo
contínuo sem rodada fixa (como Escolhas) com botões de múltipla escolha
(como Quiz). A instrução do gerador (`geradores/palpites.ts`) proíbe fato
volátil (preço, cotação, população que muda todo ano) pelo mesmo motivo do
quiz — aqui o "valor real" é o próprio conteúdo do reveal, então errar o
número quebra o jogo de um jeito mais direto que uma alternativa errada.

Jogo Diário é o único jogo **sem sorteio**: todo mundo que acessa no mesmo
dia recebe o mesmo desafio (`desafioDeHoje` em `lib/db/diario.ts` pega o
índice pelo dia UTC, `indiceDoDia = hoje % totalPublicado` — determinístico
de propósito, senão "melhor que X% de hoje" não compararia gente que jogou
a mesma coisa). O motor de conteúdo não gera um lote por dia como os outros:
gera só quando o estoque cai abaixo de 30 (`ESTOQUE_MINIMO` em
`geradores/desafios-diarios.ts`), porque a seleção é por índice — estoque
raso faz o ciclo se repetir cedo demais. O palpite é texto livre, validado
no cliente contra `accepted_answers_json` (variantes aceitas, geradas junto
com o desafio) usando a mesma normalização sem acento da busca da home
(`lib/texto.ts`).

História Interativa é o primeiro conteúdo do site em **árvore**, não lista
plana: cada nó tem até duas escolhas apontando para outro nó
(`choice_a_next_id`/`choice_b_next_id`, auto-referência dentro de
`story_nodes`), até chegar num final (`is_ending`, com `outcome` = "vitoria"
ou "derrota"). Toda história tem **4 escolhas** antes do final — raiz + 3
níveis de escolha adicionais = 16 finais.

Pediram 10 rodadas inicialmente. Árvore binária pura em 10 níveis geraria
512 finais únicos numa chamada só (raiz + 9 níveis de escolha) — schema
gigante, custo alto e risco real de qualidade/token numa história só. A
alternativa seria convergir caminhos (várias escolhas levando ao mesmo nó
adiante), mas o usuário preferiu manter árvore binária pura e reduzir a
profundidade em vez disso, pra 5 rodadas — só que a tela de final foi
contada por engano como uma "rodada" a mais, resultando em 4 escolhas reais
em vez de 5.

Tentativa de corrigir para 5 escolhas reais (32 finais): a API do Gemini
rejeitou a chamada inteira com HTTP 400 antes de gerar qualquer coisa. O
schema de saída estruturada (`response_format.schema`) tem um **limite
rígido de profundidade de aninhamento**, e a árvore é montada aninhando
literalmente um `noComOpcoes(...)` dentro do outro (sem `$ref`/schema
recursivo, decisão original de simplicidade) — 4 níveis cabe no limite, 5
não. Ficou em 4 escolhas / 16 finais até existir uma forma de representar a
árvore sem essa explosão de aninhamento (schema recursivo via `$ref` é a
via mais provável, mas não testada nesta API de Interactions).

Depois de jogar, o usuário achou a interatividade rasa: não é sobre o rótulo
de uma opção "soar" certo ou errado, é que a estrutura toda é binária
vitória/derrota — não importa o caminho, no fim das contas você sempre
esbarra numa resposta "certa" e outra "errada", igual um teste de múltipla
escolha. Uma tentativa de resolver isso variando o tom das opções foi
revertida por não atacar o problema real.

A ideia que ficou foi outra: **ponto sem volta**. Dos 8 nós de última
escolha (o nó cujas duas opções levam direto a um final), 1 ou 2 têm as
DUAS opções finais como derrota — a escolha anterior (a terceira) já selou
o destino, a pessoa só descobre ao chegar lá. A cena não anuncia isso (sem
"não há mais saída"), então a tensão continua normal. Isso quebra o binário
"essa opção certa, essa errada" de um jeito diferente: em vez de toda
escolha pesar igual até o final, algumas escolhas arriscadas já resolvem o
jogo mais cedo, e a pessoa só descobre depois.

A instrução sozinha não segurou a quantidade de forma confiável — testado
em produção, saiu de 1 a 5 pontos sem volta por história (uma chegou a ter
5 dos 8 nós finais já decididos, bem mais que o pedido). Por isso a
contagem é validada no código (`contarPontosSemVolta` em
`geradores/historias.ts`), não só confiada ao prompt: fora da faixa 1-2, a
história é descartada como qualquer outra falha de validação.

É um jogo só, não um por história: a pessoa escolhe o **tema** em
`/historia` e joga a história daquele tema **de hoje** — mesma seleção
deterministica do Jogo Diário (`historiaDoDia` em `lib/db/historias.ts`,
índice pelo dia % histórias daquela categoria), só que filtrada por
categoria em vez de global. Antes disso cada história era uma página fixa e
permanente com seu próprio cartão na home; ficou parecido demais com Jogo
Diário sem ser um jogo novo de verdade, então virou o mesmo padrão.

Cor e emoji são por **categoria** (Terror, Mistério, Sobrevivência, Romance,
Comédia, Crime, Ficção científica) — todas as histórias da mesma categoria
compartilham cor, curada à mão no gerador (`IDENTIDADE_POR_CATEGORIA` em
`geradores/historias.ts`) pela mesma razão do resto do site: cor exige
julgamento visual, não é escolha do modelo. A árvore inteira sai do banco de
uma vez e vai embutida no HTML (`lib/db/historias.ts`, `buscarHistoria`):
navegar de nó em nó é só troca de estado no cliente, sem fetch — só o final
chama a API, pra registrar `times_reached`. Gera uma história nova **por
categoria, todo dia** (7 chamadas ao Gemini, uma por categoria, em loop —
não uma chamada só pedindo várias árvores, que tende a homogeneizar o
resultado) — antes era uma história por semana no total; ficou mais caro
(7x mais chamadas) mas ainda trivial pro rate limit, e necessário pra "um
tema por dia" fazer sentido pras 7 categorias ao mesmo tempo.

Observação da primeira leva: os 8 finais de uma história de Romance saíram
7 vitória e 1 derrota — a instrução pede "nem todos podem ser só um dos
dois", o que tecnicamente foi seguido, mas o gênero puxa naturalmente pra
final feliz. Não é erro de conteúdo, é um desbalanceamento que pode valer a
pena reforçar na instrução se se repetir.

As 3 histórias escritas à mão na versão anterior (profundidade 3, 4 finais)
continuam no ar dentro da categoria que já tinham — não foram descartadas,
só ganharam `outcome` retroativo (migração `0010_historia_por_tema.sql`)
pra não aparecer em branco na tela de final. Ficam mais curtas que as novas,
o que não quebra nada: a árvore de cada história é lida isoladamente, sem
precisar bater profundidade com as outras da mesma categoria.

## Identidade visual

Tema claro único, cor sólida e dominante — cada jogo tem sua própria cor
(`games.color`, e a mesma coluna em `ranking_lists`/`quiz_topics` para a
tela de jogo em si), não um ciclo de 3 tons por posição na lista. Cor é dado
do jogo, não acidente de ordenação: se um jogo novo entrasse antes de outro
no `sort_order`, um ciclo por índice mudaria a cor de um jogo existente sem
ninguém pedir isso. Guardado como hex direto na tabela — o motor de conteúdo
(ou uma tela de admin futura) pode atribuir cor a um jogo novo sem deploy.

`color` virou especificamente a cor de **fundo da página inteira** (via
prop `corFundo` em `Base.astro`, que sobrescreve o `background` do `body`
inline). Os cartões/botões por cima usam `card_colors` — outra coluna JSON,
sempre com cores diferentes da de fundo, senão o cartão some contra a
própria página. Curado à mão por jogo (não calculado automaticamente): a
tarefa é "que fique bonito", que exige julgamento visual, não fórmula.

## Stack

- **Astro 7** com `@astrojs/cloudflare`, `output: 'server'`
- **Cloudflare Workers** com static assets (não Pages — a Cloudflare recomenda
  Workers para projetos novos)
- **D1** para todo o estado agregado
- Sem framework de UI e sem webfont: quem chega de link do TikTok está em 4G

Bindings vêm de `import { env } from 'cloudflare:workers'`.
`Astro.locals.runtime` **não existe** no Astro 7.

## Estrutura

```
apps/site/            Worker público: páginas + API dos jogos
  src/lib/db/         Acesso ao D1, um módulo por jogo
  src/lib/ranking/    Elo (lógica pura, com testes)
  src/pages/          Rotas; cada jogo é uma rota própria
apps/content-engine/  Worker de cron: gera conteúdo novo via Gemini
db/migrations/        SQL versionado, incluindo o acervo inicial
scripts/conteudo.mjs  Revisão do que o Gemini gerou
```

São dois Workers porque o adapter do Astro é dono do entry point e não expõe
handler `scheduled`, e porque a chave do Gemini não precisa existir no Worker
que atende tráfego público.

## Motor de conteúdo

Roda todo dia às 9h UTC e **publica direto** (`PUBLICAR_AUTOMATICO=true` em
`apps/content-engine/wrangler.jsonc`). Decisão explícita do dono do produto:
é um jogo, não notícia, e o custo de revisar todo lote manualmente pesava mais
que o risco de um resultado errado num microjogo.

Isso já mostrou dois tipos de erro reais, e vale saber a diferença:

- **Fato errado no quiz** — no primeiro lote, 1 de 5 perguntas trazia uma
  alternativa em espanhol ("Jogo peligroso"); num lote seguinte, uma pergunta
  afirmava que Kratos é "conhecido como o Bom de Guerra" — apelido que não
  existe (o real é "Fantasma de Esparta"). A instrução do quiz agora pede
  fatos objetivos (nome, data, quantidade, mecânica) e evita de propósito
  apelido, epíteto ou frase atribuída — é exatamente o tipo de "fato" que o
  modelo inventa com confiança. Reduz bastante, não elimina: sem verificação
  externa, uma resposta errada ocasional ainda pode ir ao ar.
- **Dilema fora de política** (sexual, violência, drogas, política partidária,
  religião, ofensa a pessoa real) — a instrução já proíbe esses temas, mas com
  publicação automática nada verifica se o modelo obedeceu. Esse é o risco que
  importa mais: um resultado de quiz errado incomoda; uma violação de política
  pode custar a conta de anúncio inteira depois que o AdSense for aprovado.

O gerador tem suporte pronto para busca do Google como reforço de fato
(`GEMINI_GROUNDING_ENABLED`), mas ligar isso quebra a geração inteira com 429
até a conta Google ter faturamento habilitado — mesmo obstáculo já visto na
geração de música. Fica `false` até isso existir.

Toda chamada ao Gemini passa pelo `createRateLimitedFetch` com reserva em D1,
portado do `gerador-de-video`: o escopo da proteção precisa ser a conta
inteira, e o D1 é o único estado que as execuções já compartilham.

Se um lote parecer suspeito (ou perto da aprovação do AdSense, quando o risco
de política pesa mais), `PUBLICAR_AUTOMATICO=false` volta ao fluxo de rascunho:

```bash
npm run content:rascunhos               # lista o que está esperando revisão
npm run content:publicar dilema 61 62   # aprova
npm run content:descartar quiz 40       # rejeita
npm run content:deploy                  # publica o worker de cron
```

Disparo manual, sem esperar o cron:

```bash
curl -X POST https://joguinhos-content.mateus2002ns.workers.dev/gerar -H "Authorization: Bearer $ADMIN_TOKEN"
```

Os segredos (`GEMINI_API_KEY`, `ADMIN_TOKEN`) vivem em
`apps/content-engine/.dev.vars` no local — arquivo fora do git — e como
secrets do Worker em produção.

O acervo inicial (dilemas, listas, perguntas) vai como migração, e não como
script de seed: um banco novo precisa nascer jogável.

## Deploy automático

Push em `main` publica sozinho via Workers Builds (dois gatilhos, um por
worker, ambos apontando pro mesmo repo):

| Worker | Build | Deploy |
| --- | --- | --- |
| `joguinhos` | `npm run build --workspace apps/site` | `npm run deploy:only --workspace apps/site` |
| `joguinhos-content` | `npm run check --workspace apps/content-engine` | `npm run deploy --workspace apps/content-engine` |

`deploy:only` existe porque `wrangler deploy` precisa rodar com o cwd em
`apps/site` — é de lá que o adapter do Astro resolve `assets.directory`;
chamado da raiz do repo com `--config`, falha com configuração incompleta.

## Comandos

```bash
npm run dev                  # servidor local com bindings do D1
npm run check                # tipos (astro check)
npm test                     # lógica pura (Elo)
npm run db:migrate:local     # aplica migrações no D1 local
npm run db:migrate:remote    # aplica migrações no D1 de produção
npm run deploy               # build limpo + wrangler deploy
```

### Cuidado ao publicar

`npm run deploy` limpa o `dist/` antes de construir. Isso importa: um arquivo
pré-renderizado esquecido no `dist/` é servido como asset estático e ganha do
Worker, então a página antiga continua no ar mesmo depois do deploy. Foi o que
aconteceu com a home entre as fases 0 e 4.

## Pendências fora do código

1. **Rotacionar a chave do Gemini** que foi compartilhada em texto puro.
2. **Comprar um domínio próprio.** O AdSense não aprova site em subdomínio de
   plataforma (`*.workers.dev`).
3. Depois da aprovação, definir `PUBLIC_ADSENSE_CLIENT`. Enquanto estiver
   vazio, nenhum `<AdSlot />` renderiza. Os slots ficam só em pontos de pausa
   (fim do quiz, tela de ranking, rodapé da home) — nunca ao lado dos botões
   de jogo, porque clique acidental é o caminho mais curto para suspensão.
