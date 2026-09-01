import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { sortearDuelo } from '../../../../lib/db/ranking';

/** Proximo duelo da lista. O cliente pede um por vez enquanto revela o anterior. */
export const GET: APIRoute = async ({ params }) => {
  const lista = params.lista;
  if (!lista) return Response.json({ erro: 'lista inválida' }, { status: 400 });

  const duelo = await sortearDuelo(env.DB, lista);
  if (!duelo) return Response.json({ erro: 'lista sem competidores' }, { status: 404 });

  return Response.json({ duelo }, { headers: { 'cache-control': 'no-store' } });
};
