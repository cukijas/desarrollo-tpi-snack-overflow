/**
 * Ranking by Rating Strategy
 * Sorts by calificacionPromedio DESC, then cantidadResenas DESC (RN-CAT-03).
 */

import { Injectable } from '@nestjs/common';
import {
  IRankingStrategy,
  RankingContext,
  RankingStrategyType,
} from '../ranking-strategy.interface.js';
import { PrestadorResumen } from '../../dto/prestador-resumen.dto.js';

@Injectable()
export class RankingPorCalificacionStrategy implements IRankingStrategy {
  readonly type: RankingStrategyType = 'calificacion';

  rank(
    prestadores: PrestadorResumen[],
    _context: RankingContext,
  ): Promise<PrestadorResumen[]> {
    // Create a new sorted array (don't mutate original)
    return Promise.resolve(
      [...prestadores].sort((a, b) => {
        // Primary: calificacionPromedio DESC
        if (b.calificacionPromedio !== a.calificacionPromedio) {
          return b.calificacionPromedio - a.calificacionPromedio;
        }
        // Secondary: cantidadResenas DESC (RN-CAT-03)
        return b.cantidadResenas - a.cantidadResenas;
      }),
    );
  }
}
