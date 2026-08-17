// ============================================================================
// Weather / market cycle engine
// ----------------------------------------------------------------------------
// A hidden-timer state machine. Players always see the current stage's
// name/icon, but never the countdown to the next flip — that's the point:
// it teaches that you can't perfectly time markets.
// ============================================================================
import { WEATHER_ORDER, WEATHER_STAGES } from '../data/gameConfig';
import { randomInt } from './rng';

/** Create the starting weather state (always begins on the first stage). */
export function createWeatherState() {
  const stageId = WEATHER_ORDER[0];
  const stage = WEATHER_STAGES[stageId];
  return {
    stageId,
    monthsInStage: 1,
    duration: randomInt(stage.minMonths, stage.maxMonths),
  };
}

/** Read-only lookup of the full stage definition for a weather state. */
export function getStageInfo(weatherState) {
  return WEATHER_STAGES[weatherState.stageId];
}

/**
 * Advance the weather by one month. Returns a new weather state, plus a
 * flag telling the caller whether the stage just changed (useful for a log
 * entry like "The weather shifted to Stormy Bust!").
 */
export function tickWeather(weatherState) {
  const monthsInStage = weatherState.monthsInStage + 1;

  if (monthsInStage > weatherState.duration) {
    const currentIndex = WEATHER_ORDER.indexOf(weatherState.stageId);
    const nextId = WEATHER_ORDER[(currentIndex + 1) % WEATHER_ORDER.length];
    const nextStage = WEATHER_STAGES[nextId];
    return {
      changed: true,
      previousStageId: weatherState.stageId,
      weather: {
        stageId: nextId,
        monthsInStage: 1,
        duration: randomInt(nextStage.minMonths, nextStage.maxMonths),
      },
    };
  }

  return {
    changed: false,
    previousStageId: weatherState.stageId,
    weather: { ...weatherState, monthsInStage },
  };
}
