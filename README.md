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

Roda todo dia às 9h UTC e grava **tudo como rascunho**. Publicar texto de LLM
automaticamente num site com AdSense assume dois riscos de uma vez: erro
factual no quiz e violação de política no dilema.

Isso não é precaução teórica — no primeiro lote real, 2 de 8 dilemas não
prestavam e 1 de 5 perguntas trazia uma alternativa em espanhol
("Jogo peligroso"). Um lote seguinte trouxe uma pergunta afirmando que Kratos
é "conhecido como o Bom de Guerra" — apelido que não existe (o real é
"Fantasma de Esparta"). Padrão claro: o risco concentra no quiz (fato
verificável), não no dilema (opinião não tem como estar "errada").

A instrução do quiz agora pede fatos objetivos (nome, data, quantidade,
mecânica) e evita de propósito apelido, epíteto ou frase atribuída — é
exatamente o tipo de "fato" que o modelo inventa com confiança. O gerador já
tem suporte pronto para busca do Google como reforço (`GEMINI_GROUNDING_ENABLED`
em `apps/content-engine/wrangler.jsonc`), mas ligar isso quebra a geração
inteira com 429 até a conta Google ter faturamento habilitado — mesmo
obstáculo já visto na geração de música. Fica `false` até isso existir.

Toda chamada ao Gemini passa pelo `createRateLimitedFetch` com reserva em D1,
portado do `gerador-de-video`: o escopo da proteção precisa ser a conta
inteira, e o D1 é o único estado que as execuções já compartilham.

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
