import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { sortearPalpites } from '../../../lib/db/guesses';

/**
 * Proximos palpites do loop — mesma forma de `/api/escolhas/proximo`.
 */
export const GET: APIRoute = async ({ url }) => {
  const vistos = (url.searchParams.get('vistos') ?? '')
    .split(',')
    .map((valor) => Number.parseInt(valor, 10))
    .filter(Number.isInteger);

  const limite = Math.min(Number.parseInt(url.searchParams.get('n') ?? '3', 10) || 3, 10);

  const palpites = await sortearPalpites(env.DB, { excluir: vistos, limite });

  return Response.json({ palpites }, { headers: { 'cache-control': 'no-store' } });
};
