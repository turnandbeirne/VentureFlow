// ============================================================================
// New-game factory
// ============================================================================
import { GAME_LENGTH_MONTHS, getDifficulty, DEFAULT_DIFFICULTY_ID } from '../data/gameConfig';
import { createPlayerRoster } from './players';
import { createInitialPrices } from './market';
import { createWeatherState } from './weather';

export function createNewGame(mode, humanNames = [], difficultyId = DEFAULT_DIFFICULTY_ID) {
  const difficulty = getDifficulty(difficultyId);
  return {
    status: 'playing', // 'playing' | 'monthRecap' | 'gameover'
    mode,
    difficultyId: difficulty.id,
    monthlyAllowance: difficulty.monthlyAllowance,
    month: 1,
    totalMonths: GAME_LENGTH_MONTHS,
    weather: createWeatherState(),
    assetPrices: createInitialPrices(),
    previousAssetPrices: createInitialPrices(),
    players: createPlayerRoster(mode, humanNames, difficulty),
    activePlayerIndex: 0,
    log: [],
    fortuneRecap: [],
    fortuneRecapIndex: 0,
    winnerId: null,
  };
}
