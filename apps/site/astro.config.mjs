// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// `output: 'server'` porque quase toda página depende do D1 em tempo de requisição:
// a primeira pergunta de cada jogo vai embutida no HTML, sem espera de `fetch` no
// cliente. Páginas que não dependem do banco marcam `export const prerender = true`.
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  site: 'https://joguinhos.workers.dev',
  build: {
    inlineStylesheets: 'always',
  },
});
