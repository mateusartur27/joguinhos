/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

// Os bindings (`env.DB` e afins) vem de `import { env } from 'cloudflare:workers'`.
// `Astro.locals.runtime` deixou de existir no Astro 7 — nao voltar a usa-lo.
