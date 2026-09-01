// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// `output: 'server'` porque quase toda página depende do D1 em tempo de requisição:
// a primeira pergunta de cada jogo vai embutida no HTML, sem espera de `fetch` no
// cliente. Páginas que não dependem do banco marcam `export const prerender = true`.
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  // Trocar por dominio proprio quando comprado — AdSense nao aprova
  // site hospedado em subdominio de plataforma.
  site: 'https://joguinhos.mateus2002ns.workers.dev',
  build: {
    inlineStylesheets: 'always',
  },
});
