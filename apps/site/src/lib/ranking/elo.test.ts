import { describe, expect, it } from 'vitest';
import { aplicarDuelo, K_PADRAO, probabilidadeDeVitoria } from './elo';

describe('probabilidadeDeVitoria', () => {
  it('da 50% para ratings iguais', () => {
    expect(probabilidadeDeVitoria(1500, 1500)).toBeCloseTo(0.5);
  });

  it('cresce com a diferenca de rating', () => {
    expect(probabilidadeDeVitoria(1700, 1500)).toBeGreaterThan(0.7);
    expect(probabilidadeDeVitoria(1500, 1700)).toBeLessThan(0.3);
  });
});

describe('aplicarDuelo', () => {
  it('conserva a soma dos ratings', () => {
    const { vencedor, perdedor } = aplicarDuelo(1600, 1450);
    expect(vencedor + perdedor).toBeCloseTo(1600 + 1450);
  });

  it('mexe pouco quando o favorito ganha', () => {
    const { vencedor } = aplicarDuelo(1800, 1400);
    expect(vencedor - 1800).toBeLessThan(K_PADRAO * 0.15);
  });

  it('mexe muito quando a zebra ganha', () => {
    const { vencedor } = aplicarDuelo(1400, 1800);
    expect(vencedor - 1400).toBeGreaterThan(K_PADRAO * 0.85);
  });

  it('divide igual quando os dois estao empatados', () => {
    const { vencedor, perdedor } = aplicarDuelo(1500, 1500);
    expect(vencedor - 1500).toBeCloseTo(K_PADRAO / 2);
    expect(1500 - perdedor).toBeCloseTo(K_PADRAO / 2);
  });
});
