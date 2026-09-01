import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { registrarVoto, type Escolha } from '../../../lib/db/dilemas';

/**
 * Registra um voto e devolve o agregado.
 *
 * Nao ha protecao contra alguem votar varias vezes no mesmo dilema: sem
 * cadastro, qualquer identificador vem do proprio cliente e seria trivial de
 * forjar. A defesa que vale a pena aqui e a de volume (rate limiting no
 * proprio Cloudflare), nao a de identidade — e ela entra quando houver
 * trafego real para medir. Ate la o dado e o que e: enquete aberta.
 */
export const POST: APIRoute = async ({ request }) => {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  const { id, escolha } = (corpo ?? {}) as { id?: unknown; escolha?: unknown };

  if (!Number.isInteger(id) || (escolha !== 'a' && escolha !== 'b')) {
    return Response.json({ erro: 'id ou escolha inválidos' }, { status: 400 });
  }

  const resultado = await registrarVoto(env.DB, id as number, escolha as Escolha);

  if (!resultado) {
    return Response.json({ erro: 'dilema não encontrado' }, { status: 404 });
  }

  return Response.json(resultado, { headers: { 'cache-control': 'no-store' } });
};
