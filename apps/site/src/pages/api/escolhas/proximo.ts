import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { sortearDilemas } from '../../../lib/db/dilemas';

/**
 * Proximos dilemas do loop.
 *
 * Devolve varios de uma vez porque o cliente faz prefetch: enquanto a pessoa
 * le o dilema atual, o proximo ja esta na memoria. O que mata o loop e a
 * espera de rede entre uma escolha e a seguinte.
 */
export const GET: APIRoute = async ({ url }) => {
  const vistos = (url.searchParams.get('vistos') ?? '')
    .split(',')
    .map((valor) => Number.parseInt(valor, 10))
    .filter(Number.isInteger);

  const limite = Math.min(Number.parseInt(url.searchParams.get('n') ?? '3', 10) || 3, 10);

  const dilemas = await sortearDilemas(env.DB, {
    excluir: vistos,
    limite,
  });

  return Response.json(
    { dilemas },
    { headers: { 'cache-control': 'no-store' } },
  );
};
