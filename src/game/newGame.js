// ============================================================================
// New-game factory
// ============================================================================
import { GAME_LENGTH_MONTHS, getDifficulty, DEFAULT_DIFFICULTY_ID } from '../data/gameConfig';
import { createPlayerRoster } from './players';
import { createInitialPrices } from './market';
import { createWeatherState } from './weather';
import { getScenario, DEFAULT_SCENARIO_ID, scenarioStartingWeather } from './scenarios';

export function createNewGame(
  mode,
  humanNames = [],
  difficultyId = DEFAULT_DIFFICULTY_ID,
  botConfigs = [],
  scenarioId = DEFAULT_SCENARIO_ID,
  humanAvatars = []
) {
  const difficulty = getDifficulty(difficultyId);
  const scenario = getScenario(scenarioId);
  // Most scenarios use the normal opening weather (see weather.js's
  // createWeatherState); Survive the Crash overrides it to start mid-storm
  // instead — see game/scenarios.js.
  const weather = scenarioStartingWeather(scenario) || createWeatherState();
  return {
    status: 'playing', // 'playing' | 'monthRecap' | 'gameover'
    mode,
    difficultyId: difficulty.id,
    scenarioId: scenario.id,
    monthlyAllowance: difficulty.monthlyAllowance,
    month: 1,
    totalMonths: GAME_LENGTH_MONTHS,
    weather,
    assetPrices: createInitialPrices(),
    previousAssetPrices: createInitialPrices(),
    players: createPlayerRoster(mode, humanNames, difficulty, botConfigs, humanAvatars),
    activePlayerIndex: 0,
    log: [],
    chat: [], // bot personality chat feed — see game/chatEngine.js
    fortuneRecap: [],
    fortuneRecapIndex: 0,
    winnerId: null,
    seenLessons: [], // concept ids already shown this game — see game/lessons.js
  };
}
