import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { registrarPalpite } from '../../../lib/db/guesses';

/**
 * Contabiliza um palpite. Sem protecao contra reenvio — mesma politica de
 * `/api/escolhas/voto`: sem cadastro, identidade seria trivial de forjar.
 */
export const POST: APIRoute = async ({ request }) => {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  const { id, acertou } = (corpo ?? {}) as { id?: unknown; acertou?: unknown };

  if (!Number.isInteger(id) || typeof acertou !== 'boolean') {
    return Response.json({ erro: 'id ou acertou inválidos' }, { status: 400 });
  }

  const ok = await registrarPalpite(env.DB, id as number, acertou);
  if (!ok) return Response.json({ erro: 'palpite não encontrado' }, { status: 404 });

  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
};
