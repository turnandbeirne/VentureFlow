// ============================================================================
// New-game factory
// ============================================================================
import { GAME_LENGTH_MONTHS } from '../data/gameConfig';
import { createPlayerRoster } from './players';
import { createInitialPrices } from './market';
import { createWeatherState } from './weather';

export function createNewGame(mode, humanNames = []) {
  return {
    status: 'playing', // 'playing' | 'monthRecap' | 'gameover'
    mode,
    month: 1,
    totalMonths: GAME_LENGTH_MONTHS,
    weather: createWeatherState(),
    assetPrices: createInitialPrices(),
    previousAssetPrices: createInitialPrices(),
    players: createPlayerRoster(mode, humanNames),
    activePlayerIndex: 0,
    log: [],
    fortuneRecap: [],
    fortuneRecapIndex: 0,
    winnerId: null,
  };
}
