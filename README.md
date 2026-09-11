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
| História Interativa | `/historia`, `/historia/[categoria]` | Escolhe o tema, joga a história de hoje daquele tema — até 4 escolhas, 11 a 13 finais, vitória ou derrota |

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

Teste isolado (fora do pipeline, sem tocar D1) achou um bug real num lote no
padrão da API (`thinking_level` não setado): `indiceCorreto` apontava pra
"12" enquanto `valorReal` dizia "10 países" — dois campos que deveriam
concordar e não concordavam, e a validação antiga nunca cruzava um com o
outro. `valido()` ganhou `indiceMaisProximo()`: acha qual alternativa tem o
número mais próximo de `valorReal` (aproximado, não exato — alternativas
são faixas arredondadas, `valorReal` é o valor preciso) e rejeita se não
bater com `indiceCorreto`. O mesmo teste não reproduziu o erro em 2 amostras
com `thinking_level: 'medium'`, então o gerador também subiu pra medium —
evidência real (achado, não hipotético), mas amostra pequena.

## Calibração de `thinking_level` por gerador

Nenhum gerador tinha `thinking_level` setado até essa análise — todos
rodavam no padrão do `gemini-3.5-flash-lite` (nível mais baixo, "minimal").
Testado isolado (fora do pipeline, sem tocar D1) nos 5 geradores, minimal vs
medium vs high, comparando taxa de validade estrutural e revisando fatos à
mão (a única forma de checar correção factual — não é automatizável):

- **História Interativa → `high`**: único gerador com uma exigência de
  **contagem exata** (3 a 5 pontos sem volta de 8 nós). Teste isolado: high
  acertou 4/4 contra 3/4 no padrão; em produção, a taxa de aprovação subiu
  de ~43% pra 7/7 categorias na primeira execução com `high` ligado.
  Evidência forte, motivo específico (contagem, não só texto).
- **Adivinhe (palpites) → `medium`**: achou um bug de consistência real no
  padrão (ver acima), não reproduzido em medium. Evidência real mas amostra
  pequena (2 de cada; `high` não testado — a API respondeu "alta demanda"
  duas vezes nesse teste).
- **Quiz → sem mudança (minimal)**: factualmente correto nas amostras dos 3
  níveis testados (futebol — datas, contagens, sedes de Copa, fundação da
  FIFA, todos corretos). Apesar do histórico de ter inventado um apelido
  antes (ver acima), não achei evidência nessa rodada de que o padrão falha
  mais que os níveis mais altos — sem evidência, não subiu.
- **Jogo Diário (desafios-diários) → sem mudança (minimal)**: 3/3 válidos em
  todos os níveis, fatos checados à mão sem erro claro. Sem evidência de
  ganho.
- **Escolhas (dilemas) → sem mudança (minimal)**: tarefa sem checagem
  factual (dilema é opinião, não fato) e sem exigência de contagem — 8/8
  válidos em todos os níveis, qualidade/criatividade equivalente. Subir o
  nível aqui seria pagar latência sem ganho.

Custo: cada nível acima de minimal aproximadamente dobra a latência por
chamada (thinking tokens contam como saída). Aceitável em todos os casos
porque a geração é assíncrona (cron diário ou disparo manual), nunca
bloqueia usuário — mas é o motivo de não subir tudo pra `high` "por via das
dúvidas": sem uma exigência concreta (contagem, ou um bug real encontrado),
é custo sem benefício demonstrado.

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
ou "derrota"). Toda história tem **até 4 escolhas** antes do final — raiz +
3 níveis de escolha adicionais — mas nem todo caminho chega às 4: ver
"ponto sem volta" abaixo, que faz alguns caminhos terminarem na terceira.

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
não. Ficou em até 4 escolhas até existir uma forma de representar a árvore
sem essa explosão de aninhamento (schema recursivo via `$ref` é a via mais
provável, mas não testada nesta API de Interactions).

Depois de jogar, o usuário achou a interatividade rasa: não é sobre o rótulo
de uma opção "soar" certo ou errado, é que a estrutura toda é binária
vitória/derrota — não importa o caminho, no fim das contas você sempre
esbarra numa resposta "certa" e outra "errada", igual um teste de múltipla
escolha. Uma tentativa de resolver isso variando o tom das opções foi
revertida por não atacar o problema real.

A ideia que ficou foi outra: **ponto sem volta**. Isso quebra o binário
"essa opção certa, essa errada" de um jeito diferente: em vez de toda
escolha pesar igual até o final, algumas escolhas arriscadas já resolvem o
jogo mais cedo, e a pessoa só descobre depois.

A primeira versão fazia isso mantendo a árvore uniforme: um nó de última
escolha (o nó cujas duas opções levam direto a um final) tinha as DUAS
opções levando a "derrota" — mas isso obrigava a pessoa a jogar uma quarta
cena inteira, com uma escolha falsa entre duas derrotas, antes de descobrir
que já tinha perdido. O usuário apontou o problema: "não quero perder na
última rodada, o nó da terceira já deve me dizer que perdi" — e que talvez
nem precisasse a IA pensar nas outras duas opções daquela quarta cena.

A versão atual muda a estrutura de verdade: a árvore deixou de ter
profundidade uniforme. Cada opção da terceira escolha pode levar a UMA de
duas coisas — uma quarta cena normal (2 opções, 2 finais), ou **direto a um
final de derrota**, pulando a quarta cena inteiramente. Isso é um schema com
`anyOf` (`PROXIMO_NIVEL_3` em `geradores/historias.ts`) — testado isolado
antes de entrar em produção, porque schema fora do comum já mordeu antes
(ver limite de aninhamento acima). Funcionou de primeira: a API aceita, e o
modelo de fato usa a forma mais curta pros ramos sem volta, sem gastar
tokens gerando uma quarta cena que ninguém vai ver.

Consequência: o total de finais deixou de ser fixo em 16 — cada ponto sem
volta reduz o total em 1 (uma quarta cena com 2 finais vira 1 final direto),
então uma história com 3 a 5 pontos sem volta tem entre 11 e 13 finais. O
site lida com isso automaticamente: `calcularProfundidade` (`lib/db/historias.ts`)
mede o MAIOR caminho da árvore, não um caminho fixo, porque agora nem todo
caminho tem o mesmo tamanho; e a tela de final (`[slug].astro`) já mostrava
"Final" no lugar de um número de cena, então um caminho mais curto só chega
lá uma cena mais cedo, sem precisar de nenhuma mudança de UI.

A instrução pede 3 a 5 pontos sem volta (subiu de 1-2 a pedido do usuário) e
não é mais validada no código: uma versão anterior tinha uma checagem
(`contarPontosSemVolta` em `geradores/historias.ts`) que descartava a
história fora da faixa, mas o usuário pediu pra reforçar a instrução em vez
disso e parar de descartar por essa causa — a contagem continua calculada e
vai pro log (`console.log` em `gerarHistoria`) só pra acompanhamento manual,
nunca bloqueia a inserção.

Esse gerador é o único com `thinkingLevel: 'high'` ligado (`gemini.ts` /
`geradores/historias.ts`) — todos os outros rodam no padrão do
`gemini-3.5-flash-lite` (nível "minimal", o mais baixo). Teste isolado fora
do pipeline (4 chamadas de cada lado, mesmo schema/instrução, sem tocar no
D1): "high" passou a validação de estrutura + faixa de pontos sem volta em
4/4 tentativas contra 3/4 no padrão, custando quase o dobro de latência
(~35s vs ~20s por chamada). Amostra pequena, mas a direção faz sentido:
história é o único gerador com uma exigência de **contagem exata** (3 a 5
de 8), não só texto solto — os outros (dilemas, quiz, palpites, desafios)
não têm essa restrição e não foram testados, então não têm motivo pra pagar
o custo extra de latência sem evidência de que precisam.

É um jogo só, não um por história: a pessoa escolhe o **tema** em
`/historia` e joga a história daquele tema **de hoje**. A seleção mudou de
"rotação por índice do dia" pra "a que foi gerada hoje, senão a mais
recente disponível" (`historiaDoDia` em `lib/db/historias.ts`, coluna
`stories.for_date` desde a migração `0011`) — a rotação antiga passava por
TODAS as histórias já publicadas da categoria em ordem alfabética, então
gerar uma história nova não garantia jogá-la tão cedo (o índice só cai nela
quando o cálculo calhar de apontar pra posição alfabética dela, o que podia
levar semanas). O usuário notou o problema testando Crime: o dia caiu numa
história de antes do "ponto sem volta" existir, mesmo tendo uma nova
gerada na hora. Trade-off aceito: se a geração do dia falhar a validação (é
comum, a faixa de pontos sem volta descarta bastante), a categoria repete a
história mais recente em vez de rotacionar pra outra antiga — perde
variedade em dias ruins, ganha "hoje é hoje mesmo" nos bons. Histórias não
são deletadas (ficam como pool de anti-repetição de título e como
fallback); antigas ficam com `for_date NULL`, que o SQLite ordena por
último. Antes disso cada história era uma página fixa e permanente com seu
próprio cartão na home; ficou parecido demais com Jogo Diário sem ser um
jogo novo de verdade, então virou o mesmo padrão de seleção diária.

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

`Gemini.gerar()` (`gemini.ts`) reten­ta até 3 vezes em erro 5xx ("alta
demanda", indisponibilidade momentânea) com espera crescente (3s, 6s) antes
de desistir — nunca retenta 4xx (ex.: o limite de profundidade de schema,
que falha do mesmo jeito sempre). Descoberto num dia real de testes: o
`/gerar` completo faz ~13 chamadas em sequência (dilemas + quiz + palpites +
desafios + 7 histórias), e sem retry um único 5xx em qualquer uma delas
derrubava a geração do dia inteira — mesmo com cada chamada isolada quase
sempre funcionando de primeira.

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
