import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { registrarDuelo } from '../../../../lib/db/ranking';

export const POST: APIRoute = async ({ params, request }) => {
  const lista = params.lista;
  if (!lista) return Response.json({ erro: 'lista inválida' }, { status: 400 });

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  const { vencedorId, perdedorId } = (corpo ?? {}) as {
    vencedorId?: unknown;
    perdedorId?: unknown;
  };

  if (!Number.isInteger(vencedorId) || !Number.isInteger(perdedorId)) {
    return Response.json({ erro: 'ids inválidos' }, { status: 400 });
  }

  const resultado = await registrarDuelo(
    env.DB,
    lista,
    vencedorId as number,
    perdedorId as number,
  );

  if (!resultado) {
    return Response.json({ erro: 'duelo inválido' }, { status: 404 });
  }

  return Response.json(resultado, { headers: { 'cache-control': 'no-store' } });
};
