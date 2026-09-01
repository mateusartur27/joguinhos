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
apps/site/          Worker público: páginas + API dos jogos
  src/lib/db/       Acesso ao D1, um módulo por jogo
  src/lib/ranking/  Elo (lógica pura, com testes)
  src/pages/        Rotas; cada jogo é uma rota própria
db/migrations/      SQL versionado, incluindo o acervo inicial
```

O acervo inicial (dilemas, listas, perguntas) vai como migração, e não como
script de seed: um banco novo precisa nascer jogável.

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
