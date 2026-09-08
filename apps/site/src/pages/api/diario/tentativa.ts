import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import {
  dataDeHojeUTC,
  desafioDeHoje,
  estatisticasDoDia,
  registrarTentativa,
  type ResultadoTentativa,
} from '../../../lib/db/diario';

/**
 * Registra a tentativa do dia e devolve o agregado atualizado.
 *
 * O desafio de hoje e recalculado aqui, nunca recebido do cliente: se a
 * sessao ficar aberta passando da meia-noite UTC, o id que o cliente tem em
 * memoria pode nao ser mais "o de hoje". `desafioDeHoje()` e deterministico,
 * entao recalcular custa uma consulta e elimina essa classe de bug.
 */
export const POST: APIRoute = async ({ request }) => {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  const { resultado } = (corpo ?? {}) as { resultado?: unknown };
  const valido =
    resultado === 'falhou' || (Number.isInteger(resultado) && (resultado as number) >= 1 && (resultado as number) <= 5);

  if (!valido) {
    return Response.json({ erro: 'resultado inválido' }, { status: 400 });
  }

  const desafio = await desafioDeHoje(env.DB);
  if (!desafio) return Response.json({ erro: 'sem desafio hoje' }, { status: 404 });

  const playDate = dataDeHojeUTC();
  await registrarTentativa(env.DB, playDate, desafio.id, resultado as ResultadoTentativa);
  const estatisticas = await estatisticasDoDia(env.DB, playDate);

  return Response.json({ estatisticas }, { headers: { 'cache-control': 'no-store' } });
};
