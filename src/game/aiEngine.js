// ============================================================================
// AI robot player logic
// ----------------------------------------------------------------------------
// A tunable greedy strategy: robots read the current weather mood and
// repeatedly take the single best-scoring affordable action until nothing
// beneficial is left (or a safety cap is hit). In good weather they lean
// into growth (businesses, then risky/bouncy assets); in bad weather they
// retreat — selling off risky holdings and parking cash in Piggy Bank.
//
// On top of that base behavior, every robot has a `strategyId` (from its
// BOT_PERSONALITIES entry, see gameConfig.js) and a `skillLevelId` — set at
// setup, either picked directly or rolled randomly — that reshape *how* it
// plays:
//   - strategyId picks a STRATEGIES entry below: a set of score multipliers
//     per move "kind" (plus a couple of behavior flags) that make e.g.
//     DaddyBigBux chase businesses, MrGrinch hoard cash, or GrumpyMommy play
//     the weather backwards on purpose.
//   - skillLevelId picks a SKILL_PROFILES entry: how much cash it's willing
//     to leave idle, how many moves it takes in a turn, and how often it
//     second-guesses its own best-scoring move (a "mistake" — picks a
//     random affordable move instead of the top one).
//
// Both ids are read straight off the player object rather than looked up
// live against BOT_PERSONALITIES, and fall back to 'balanced'/'sharp' if
// missing entirely — so games saved before this feature existed (whose AI
// players have neither field) keep playing exactly as they did before.
//
// Reuses the exact same action functions humans use (actions.js), so the
// robots can never break a rule a human couldn't also break.
// ============================================================================
import { buyAsset, sellAsset, startBusiness, learnSkill } from './actions';
import { BUSINESS_COST, BUSINESS_SKILL_COST, SKILL_COST } from '../data/gameConfig';
import { getStageInfo } from './weather';
import { chance, randomInt } from './rng';

const GOOD_MOODS = new Set(['boom', 'peak', 'rebound']);

const DEFAULT_STRATEGY_ID = 'balanced';
const DEFAULT_SKILL_ID = 'sharp';

// Per-move-"kind" score multipliers. Any kind not listed for a strategy
// defaults to 1 (unchanged from the base greedy behavior). Two behavior
// flags on top of the weights:
//   - ignoreWeatherRisk: always builds the "growth" candidate set, storms
//     or not — a reckless bot that never sees a reason to retreat.
//   - contrarian: flips which candidate set gets built — plays "growth"
//     moves during storms and "retreat" moves during booms.
const STRATEGIES = {
  balanced: {
    // MrB — the original, unweighted greedy behavior.
    weights: {},
  },
  reckless: {
    // Leeroy Jenkins — charges into risky/flashy plays and ignores storms.
    ignoreWeatherRisk: true,
    weights: { business: 1.2, treasure: 1.5, lemonade: 1.3, treehouse: 0.9, skill: 0.5, piggy: 0.1 },
  },
  flipper: {
    // BossEmby — chases the bouncy assets both in and out, skips slow ones.
    weights: {
      business: 0.6,
      treasure: 1.4,
      lemonade: 1.4,
      treehouse: 0.7,
      skill: 0.8,
      piggy: 0.3,
      sellTreasure: 1.3,
      sellLemonade: 1.3,
    },
  },
  hoarder: {
    // MrGrinch — every dollar saved is a dollar loved. Cash and rent over
    // anything risky, sells off risk fast in a storm.
    weights: {
      business: 0.5,
      treasure: 0.4,
      lemonade: 0.5,
      treehouse: 1.1,
      skill: 0.6,
      piggy: 2.5,
      sellTreasure: 1.1,
      sellLemonade: 1.1,
    },
  },
  tycoon: {
    // DaddyBigBux — businesses, businesses, and more businesses.
    weights: { business: 2.2, skill: 1.6, treasure: 0.6, lemonade: 0.6, treehouse: 0.8, piggy: 0.3 },
  },
  saver: {
    // MoneyMama — smart, patient, and always prepared, but not stingy.
    weights: { piggy: 1.6, treehouse: 1.3, skill: 1.1, treasure: 0.7, lemonade: 0.7, business: 0.9 },
  },
  contrarian: {
    // GrumpyMommy — buys the dip, sells the hype. Always keeps a rainy-day
    // fund on hand regardless of which way the market's going.
    contrarian: true,
    weights: { piggy: 1.2, business: 0.9 },
  },
};

function getStrategy(strategyId) {
  return STRATEGIES[strategyId] || STRATEGIES[DEFAULT_STRATEGY_ID];
}

// How efficiently/thoughtfully a bot plays, independent of its strategy.
//   - cashBuffer: how much cash it always leaves untouched (higher = more
//     conservative/wasteful with idle cash).
//   - maxSteps: how many moves it's willing to take in a single turn.
//   - mistakeChance: odds that, instead of its best-scoring move, it plays
//     a random affordable one — simulating a less-sharp player who doesn't
//     always spot the optimal play.
const SKILL_PROFILES = {
  rookie: { cashBuffer: 45, maxSteps: 10, mistakeChance: 0.35 },
  sharp: { cashBuffer: 20, maxSteps: 25, mistakeChance: 0.08 },
  shark: { cashBuffer: 8, maxSteps: 32, mistakeChance: 0 },
};

function getSkillProfile(skillLevelId) {
  return SKILL_PROFILES[skillLevelId] || SKILL_PROFILES[DEFAULT_SKILL_ID];
}

function isGoodWeather(weatherState) {
  return GOOD_MOODS.has(getStageInfo(weatherState).mood);
}

function findPlayer(state, playerId) {
  return state.players.find((p) => p.id === playerId);
}

function weighted(strategy, kind, score) {
  const multiplier = strategy.weights[kind] ?? 1;
  return { score: score * multiplier, kind };
}

function buildCandidates(state, playerId, strategy, cashBuffer) {
  const player = findPlayer(state, playerId);
  const prices = state.assetPrices;
  const actuallyGood = isGoodWeather(state.weather);
  const good = strategy.ignoreWeatherRisk ? true : strategy.contrarian ? !actuallyGood : actuallyGood;
  const candidates = [];

  if (good) {
    if (player.cash >= BUSINESS_COST && player.skillTokens >= BUSINESS_SKILL_COST) {
      candidates.push({ ...weighted(strategy, 'business', 100), run: (s) => startBusiness(s, playerId) });
    }
    if (player.cash - cashBuffer >= prices.treasure) {
      candidates.push({ ...weighted(strategy, 'treasure', 70), run: (s) => buyAsset(s, playerId, 'treasure', 1) });
    }
    if (player.cash - cashBuffer >= prices.lemonade) {
      candidates.push({ ...weighted(strategy, 'lemonade', 65), run: (s) => buyAsset(s, playerId, 'lemonade', 1) });
    }
    if (player.cash - cashBuffer >= prices.treehouse) {
      candidates.push({ ...weighted(strategy, 'treehouse', 55), run: (s) => buyAsset(s, playerId, 'treehouse', 1) });
    }
    if (player.cash >= SKILL_COST && player.skillTokens < 3) {
      candidates.push({ ...weighted(strategy, 'skill', 45), run: (s) => learnSkill(s, playerId) });
    }
    if (player.cash - cashBuffer >= prices.piggy) {
      candidates.push({ ...weighted(strategy, 'piggy', 20), run: (s) => buyAsset(s, playerId, 'piggy', 1) });
    }
  } else {
    // Storms / dips: retreat to safety first.
    if ((player.holdings.treasure || 0) > 0) {
      candidates.push({ ...weighted(strategy, 'sellTreasure', 95), run: (s) => sellAsset(s, playerId, 'treasure', 1) });
    }
    if ((player.holdings.lemonade || 0) > 0) {
      candidates.push({ ...weighted(strategy, 'sellLemonade', 85), run: (s) => sellAsset(s, playerId, 'lemonade', 1) });
    }
    if (player.cash - cashBuffer >= prices.piggy) {
      candidates.push({ ...weighted(strategy, 'piggy', 60), run: (s) => buyAsset(s, playerId, 'piggy', 1) });
    }
    if (player.cash >= BUSINESS_COST && player.skillTokens >= BUSINESS_SKILL_COST) {
      candidates.push({ ...weighted(strategy, 'business', 15), run: (s) => startBusiness(s, playerId) });
    }
    if (player.cash >= SKILL_COST && player.skillTokens < 2) {
      candidates.push({ ...weighted(strategy, 'skill', 10), run: (s) => learnSkill(s, playerId) });
    }
  }

  return candidates;
}

/**
 * Pick which candidate to play: normally the best-scoring one, but a bot
 * below "shark" sharpness occasionally (per its mistakeChance) plays a
 * random affordable move instead — a human-like slip-up rather than a
 * hard-coded "always optimal" AI.
 */
function chooseMove(candidates, skill) {
  candidates.sort((a, b) => b.score - a.score);
  // Routed through game/rng.js (rather than a raw Math.random()) so a
  // robot's "mistakes" are part of the same seedable sequence as
  // everything else in the engine — see rng.js's header comment for why
  // that matters for Daily Challenge mode.
  if (candidates.length > 1 && chance(skill.mistakeChance)) {
    return candidates[randomInt(0, candidates.length - 1)];
  }
  return candidates[0];
}

/**
 * Run a full AI turn: greedily apply the best-scoring (strategy-weighted)
 * action, over and over, until nothing affordable/beneficial remains or the
 * bot's skill-level step cap is hit. Returns the updated game state plus a
 * list of log entries describing what happened.
 */
export function runAiTurn(state, playerId) {
  const player = findPlayer(state, playerId);
  const strategy = getStrategy(player?.strategyId);
  const skill = getSkillProfile(player?.skillLevelId);

  let currentState = state;
  const logEntries = [];

  for (let step = 0; step < skill.maxSteps; step++) {
    const candidates = buildCandidates(currentState, playerId, strategy, skill.cashBuffer);
    if (candidates.length === 0) break;

    const chosen = chooseMove(candidates, skill);
    const result = chosen.run(currentState);
    if (!result.ok) break; // shouldn't happen given our affordability checks, but stay safe

    currentState = result.state;
    if (result.logEntry) logEntries.push(result.logEntry);
  }

  return { state: currentState, logEntries };
}
