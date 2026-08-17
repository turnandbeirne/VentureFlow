// ============================================================================
// AI robot player logic
// ----------------------------------------------------------------------------
// A simple, tunable greedy strategy: robots read the current weather mood
// and repeatedly take the single best-scoring affordable action until
// nothing beneficial is left (or a safety cap is hit). In good weather they
// lean into growth (businesses, then risky/bouncy assets); in bad weather
// they retreat — selling off risky holdings and parking cash in Piggy Bank.
//
// Reuses the exact same action functions humans use (actions.js), so the
// robots can never break a rule a human couldn't also break.
// ============================================================================
import { buyAsset, sellAsset, startBusiness, learnSkill } from './actions';
import { BUSINESS_COST, BUSINESS_SKILL_COST, SKILL_COST } from '../data/gameConfig';
import { getStageInfo } from './weather';

const CASH_BUFFER = 20; // robots always keep a little cash on hand
const MAX_STEPS = 25; // loop guard

const GOOD_MOODS = new Set(['boom', 'peak', 'rebound']);

function isGoodWeather(weatherState) {
  return GOOD_MOODS.has(getStageInfo(weatherState).mood);
}

function findPlayer(state, playerId) {
  return state.players.find((p) => p.id === playerId);
}

function buildCandidates(state, playerId) {
  const player = findPlayer(state, playerId);
  const prices = state.assetPrices;
  const good = isGoodWeather(state.weather);
  const candidates = [];

  if (good) {
    if (player.cash >= BUSINESS_COST && player.skillTokens >= BUSINESS_SKILL_COST) {
      candidates.push({ score: 100, run: (s) => startBusiness(s, playerId) });
    }
    if (player.cash - CASH_BUFFER >= prices.treasure) {
      candidates.push({ score: 70, run: (s) => buyAsset(s, playerId, 'treasure', 1) });
    }
    if (player.cash - CASH_BUFFER >= prices.lemonade) {
      candidates.push({ score: 65, run: (s) => buyAsset(s, playerId, 'lemonade', 1) });
    }
    if (player.cash - CASH_BUFFER >= prices.treehouse) {
      candidates.push({ score: 55, run: (s) => buyAsset(s, playerId, 'treehouse', 1) });
    }
    if (player.cash >= SKILL_COST && player.skillTokens < 3) {
      candidates.push({ score: 45, run: (s) => learnSkill(s, playerId) });
    }
    if (player.cash - CASH_BUFFER >= prices.piggy) {
      candidates.push({ score: 20, run: (s) => buyAsset(s, playerId, 'piggy', 1) });
    }
  } else {
    // Storms / dips: retreat to safety first.
    if ((player.holdings.treasure || 0) > 0) {
      candidates.push({ score: 95, run: (s) => sellAsset(s, playerId, 'treasure', 1) });
    }
    if ((player.holdings.lemonade || 0) > 0) {
      candidates.push({ score: 85, run: (s) => sellAsset(s, playerId, 'lemonade', 1) });
    }
    if (player.cash - CASH_BUFFER >= prices.piggy) {
      candidates.push({ score: 60, run: (s) => buyAsset(s, playerId, 'piggy', 1) });
    }
    if (player.cash >= BUSINESS_COST && player.skillTokens >= BUSINESS_SKILL_COST) {
      candidates.push({ score: 15, run: (s) => startBusiness(s, playerId) });
    }
    if (player.cash >= SKILL_COST && player.skillTokens < 2) {
      candidates.push({ score: 10, run: (s) => learnSkill(s, playerId) });
    }
  }

  return candidates;
}

/**
 * Run a full AI turn: greedily apply the best-scoring action, over and
 * over, until nothing affordable/beneficial remains. Returns the updated
 * game state plus a list of log entries describing what happened.
 */
export function runAiTurn(state, playerId) {
  let currentState = state;
  const logEntries = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const candidates = buildCandidates(currentState, playerId);
    if (candidates.length === 0) break;

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const result = best.run(currentState);
    if (!result.ok) break; // shouldn't happen given our affordability checks, but stay safe

    currentState = result.state;
    if (result.logEntry) logEntries.push(result.logEntry);
  }

  return { state: currentState, logEntries };
}
