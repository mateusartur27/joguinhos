import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { registrarResposta } from '../../../lib/db/quiz';

export const POST: APIRoute = async ({ request }) => {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  const { id, acertou } = (corpo ?? {}) as { id?: unknown; acertou?: unknown };

  if (!Number.isInteger(id) || typeof acertou !== 'boolean') {
    return Response.json({ erro: 'id ou resultado inválidos' }, { status: 400 });
  }

  const ok = await registrarResposta(env.DB, id as number, acertou);
  if (!ok) return Response.json({ erro: 'pergunta não encontrada' }, { status: 404 });

  return new Response(null, { status: 204 });
};
