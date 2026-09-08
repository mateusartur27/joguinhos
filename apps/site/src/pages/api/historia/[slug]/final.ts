import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { registrarFinal } from '../../../../lib/db/historias';

/**
 * Registra a chegada a um final da historia. Sem timer envolvido — o clique
 * na ultima escolha e que dispara isso.
 */
export const POST: APIRoute = async ({ params, request }) => {
  const slug = params.slug;
  if (!slug) return Response.json({ erro: 'história inválida' }, { status: 400 });

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  const { nodeId } = (corpo ?? {}) as { nodeId?: unknown };
  if (!Number.isInteger(nodeId)) {
    return Response.json({ erro: 'nodeId inválido' }, { status: 400 });
  }

  const resultado = await registrarFinal(env.DB, slug, nodeId as number);
  if (!resultado) return Response.json({ erro: 'final não encontrado' }, { status: 404 });

  return Response.json(resultado, { headers: { 'cache-control': 'no-store' } });
};
