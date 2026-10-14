# joguinhos

Plataforma de microjogos rápidos em português, jogados direto no navegador,
sem cadastro. Ao final de cada jogada, a pessoa vê como se saiu em relação a
quem já jogou: porcentagem de cada escolha, ranking coletivo, taxa de acerto.

## Jogos

| Jogo | Rota | Mecânica |
| --- | --- | --- |
| Escolhas Impossíveis | `/escolhas` | Dilema binário, revela a % coletiva depois do voto |
| Ranking Coletivo | `/ranking/[lista]` | Duelos par a par alimentando um ranking por Elo |
| Quiz rápido | `/quiz/[tema]` | 8 perguntas, feedback imediato, comparação com a média |
| Adivinhe Antes de Revelar | `/adivinhe` | Palpite de quantidade, revela o valor real e a taxa de acerto |
| Jogo Diário | `/diario` | Um desafio igual pra todo mundo por dia, 5 pistas, palpite em texto livre |
| História Interativa | `/historia`, `/historia/[categoria]` | Escolhe o tema, joga a história de hoje daquele tema — até 4 escolhas, 11 a 13 finais, vitória ou derrota |

### Escolhas e Quiz

Os ids já vistos ficam no `localStorage` do navegador e voltam como exclusão
na rodada seguinte (`sortearRodada`/`sortearDilemas` aceitam uma lista de ids
a pular), para "jogar de novo" não repetir conteúdo. Se a exclusão esgotar o
acervo do tema, o sorteio ignora a exclusão — repetir é melhor que tela vazia.

Cada dilema carrega, por trás da escolha, algum reflexo real sobre como as
pessoas decidem — implícito na tensão do próprio dilema, nunca como frase de
moral separada.

### Adivinhe Antes de Revelar

Fluxo contínuo sem rodada fixa (como Escolhas) com botões de múltipla escolha
(como Quiz). O gerador evita fato volátil (preço, cotação, população que muda
todo ano), porque o "valor real" é o próprio conteúdo do reveal. A validação
(`indiceMaisProximo()` em `geradores/palpites.ts`) confere se a alternativa
marcada como correta é a mais próxima de `valorReal` e rejeita o item se não
for.

### Jogo Diário

Único jogo **sem sorteio**: todo mundo que acessa no mesmo dia recebe o mesmo
desafio (`desafioDeHoje` em `lib/db/diario.ts`, `indiceDoDia = hoje %
totalPublicado` pelo dia UTC), para que "melhor que X% de hoje" compare gente
que jogou a mesma coisa. O motor de conteúdo só gera desafios novos quando o
estoque cai abaixo de 30 (`ESTOQUE_MINIMO` em `geradores/desafios-diarios.ts`).
O palpite é texto livre, validado no cliente contra `accepted_answers_json`
(variantes aceitas) com a mesma normalização sem acento da busca da home
(`lib/texto.ts`).

### História Interativa

Conteúdo em **árvore**: cada nó tem até duas escolhas apontando para outro nó
(`choice_a_next_id`/`choice_b_next_id`, auto-referência em `story_nodes`), até
chegar num final (`is_ending`, com `outcome` = `vitoria` ou `derrota`).

- **Até 4 escolhas** por história (raiz + 3 níveis). O schema de saída
  estruturada do Gemini tem limite de profundidade de aninhamento, e a árvore
  é montada aninhando `noComOpcoes(...)` — 4 níveis é o máximo que cabe.
- **Ponto sem volta:** cada opção da terceira escolha leva a uma quarta cena
  normal (2 opções, 2 finais) ou **direto a um final de derrota**. Isso é um
  `anyOf` no schema (`PROXIMO_NIVEL_3` em `geradores/historias.ts`). A
  instrução pede 3 a 5 pontos sem volta; a contagem vai para o log, sem
  bloquear a inserção. Por isso o total de finais varia entre 11 e 13, e
  `calcularProfundidade` (`lib/db/historias.ts`) mede o maior caminho da
  árvore, não um caminho fixo.
- **Aprendizado implícito:** a história carrega um fato, conceito ou técnica
  real coerente com a categoria (ex.: um conceito científico em Ficção
  científica, um método de investigação em Crime), dentro da ação e em
  linguagem simples — termo técnico vem explicado na própria frase. As duas
  opções de cada cena usam a mesma informação como abordagens diferentes e
  plausíveis, para o fato não virar dica da opção "certa".
- **Uma história por tema por dia:** a pessoa escolhe o tema em `/historia` e
  joga a história gerada hoje para ele, ou a mais recente disponível
  (`historiaDoDia` em `lib/db/historias.ts`, coluna `stories.for_date`).
  Histórias antigas ficam no banco como pool de anti-repetição de título e
  como fallback.
- Cor e emoji são por **categoria** (Terror, Mistério, Sobrevivência, Romance,
  Comédia, Crime, Ficção científica), curados em `IDENTIDADE_POR_CATEGORIA`.
- A árvore inteira vai embutida no HTML (`buscarHistoria`): navegar entre nós
  é troca de estado no cliente, e só o final chama a API, para registrar
  `times_reached`.

## Números coletivos

Duas regras valem em todo o código:

- **Nada de número inventado.** Enquanto a amostra é pequena, a tela diz outra
  coisa ("você é um dos primeiros a responder isso") em vez de mostrar "100%".
- **Contadores agregados na própria linha**, nunca `COUNT(*)` sobre linhas de
  voto. O incremento é um `UPDATE` atômico do SQLite, sem transação por voto.

## Identidade visual

Tema claro único, cor sólida e dominante, uma por jogo. `games.color` (e a
mesma coluna em `ranking_lists`/`quiz_topics`) é a cor de **fundo da página
inteira**, aplicada pela prop `corFundo` de `Base.astro`. Cartões e botões por
cima usam `card_colors`, uma lista JSON sempre diferente da cor de fundo. As
cores ficam no banco, então um jogo novo ganha cor sem deploy.

## Stack

- **Astro 7** com `@astrojs/cloudflare`, `output: 'server'`
- **Cloudflare Workers** com static assets
- **D1** para todo o estado agregado
- Sem framework de UI e sem webfont, para carregar rápido no celular

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
db/export/            Snapshot do banco com todo o conteúdo já gerado
scripts/conteudo.mjs  Revisão do que o Gemini gerou
```

São dois Workers porque o adapter do Astro é dono do entry point e não expõe
handler `scheduled`, e porque a chave do Gemini não precisa existir no Worker
que atende tráfego público.

## Motor de conteúdo

Roda todo dia às 9h UTC e gera dilemas, perguntas de quiz, palpites, desafios
diários e uma história por categoria. Com `PUBLICAR_AUTOMATICO=true`
(`apps/content-engine/wrangler.jsonc`) o conteúdo vai direto ao ar; com
`false`, entra como rascunho para revisão:

```bash
npm run content:rascunhos               # lista o que está esperando revisão
npm run content:publicar dilema 61 62   # aprova
npm run content:descartar quiz 40       # rejeita
```

Disparo manual, sem esperar o cron:

```bash
curl -X POST https://<worker-de-conteudo>/gerar -H "Authorization: Bearer $ADMIN_TOKEN"
```

Regras de conteúdo nas instruções dos geradores:

- **Quiz** pede fatos objetivos (nome, data, quantidade, mecânica) e evita
  apelido, epíteto ou frase atribuída — o tipo de "fato" que o modelo inventa
  com confiança.
- **Dilemas** não podem tocar em tema sexual, violência, drogas, política
  partidária, religião ou ofensa a pessoa real.

`thinking_level` por gerador: História Interativa usa `high` (é o único com
exigência de contagem exata, os pontos sem volta), Adivinhe usa `medium`
(reduz inconsistência entre `indiceCorreto` e `valorReal`), e os demais usam o
padrão do `gemini-3.5-flash-lite`. Cada nível acima do mínimo aproximadamente
dobra a latência por chamada, aceitável porque a geração é assíncrona.

Suporte a busca do Google como reforço de fato (`GEMINI_GROUNDING_ENABLED`)
está pronto, mas exige faturamento habilitado na conta Google; sem isso a
geração falha com 429.

Toda chamada ao Gemini passa pelo `createRateLimitedFetch` com reserva em D1:
o escopo da proteção precisa ser a conta inteira, e o D1 é o único estado que
as execuções compartilham. `Gemini.gerar()` (`gemini.ts`) retenta até 3 vezes
em erro 5xx com espera crescente (3s, 6s) e nunca retenta 4xx.

Os segredos (`GEMINI_API_KEY`, `ADMIN_TOKEN`) vivem em
`apps/content-engine/.dev.vars` no local — arquivo fora do git — e como
secrets do Worker em produção.

O acervo inicial (dilemas, listas, perguntas) vai como migração, e não como
script de seed: um banco novo nasce jogável.

## Publicação

1. Criar o D1 e colocar o `database_id` em `apps/site/wrangler.jsonc` e
   `apps/content-engine/wrangler.jsonc`:
   ```bash
   npx wrangler d1 create joguinhos
   ```
2. Popular o banco com **uma** das opções:
   - **Acervo inicial**, só pelas migrações:
     ```bash
     npm run db:migrate:remote
     ```
   - **Snapshot completo** (660 dilemas, 713 perguntas, 348 histórias, votos e
     rankings). O arquivo já traz as tabelas e o registro das migrações:
     ```bash
     npx wrangler d1 execute joguinhos --remote --file db/export/joguinhos-2026-10-13.sql
     ```
3. Definir os segredos do motor de conteúdo com `npx wrangler secret put`
   dentro de `apps/content-engine`.
4. Publicar os dois Workers:
   ```bash
   npm run deploy
   npm run content:deploy
   ```

Para deploy automático via Workers Builds, um gatilho por worker apontando
para este repo:

| Worker | Build | Deploy |
| --- | --- | --- |
| `joguinhos` | `npm run build --workspace apps/site` | `npm run deploy:only --workspace apps/site` |
| `joguinhos-content` | `npm run check --workspace apps/content-engine` | `npm run deploy --workspace apps/content-engine` |

`deploy:only` existe porque `wrangler deploy` precisa rodar com o cwd em
`apps/site` — é de lá que o adapter do Astro resolve `assets.directory`.

`npm run deploy` limpa o `dist/` antes de construir: um arquivo
pré-renderizado esquecido no `dist/` é servido como asset estático e ganha do
Worker, mantendo a página antiga no ar.

## Anúncios

Os `<AdSlot />` só renderizam com `PUBLIC_ADSENSE_CLIENT` definido. Ficam só
em pontos de pausa (fim do quiz, tela de ranking, rodapé da home), nunca ao
lado dos botões de jogo, para evitar clique acidental. O AdSense não aprova
site em subdomínio de plataforma (`*.workers.dev`), então isso exige domínio
próprio.

## Comandos

```bash
npm run dev                  # servidor local com bindings do D1
npm run check                # tipos (astro check)
npm test                     # lógica pura (Elo)
npm run db:migrate:local     # aplica migrações no D1 local
npm run db:migrate:remote    # aplica migrações no D1 de produção
npm run deploy               # build limpo + wrangler deploy
```
