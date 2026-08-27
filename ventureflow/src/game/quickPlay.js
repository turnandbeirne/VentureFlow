// ============================================================================
// Quick Play — "just start a game, surprise me"
// ----------------------------------------------------------------------------
// The landing screen's one-click path (components/LandingScreen.jsx): rolls a
// complete, valid setup — scenario, difficulty, opponent count, and each
// robot's personality and skill level — and hands back exactly the same
// argument shape SetupScreen passes to `onStart`, so the two entry points
// share one code path into the game and can never drift apart.
//
// Deliberately rolled on the DEFAULT rng stream (see game/rng.js): choosing
// your setup is a player-side choice, not part of the shared environment, so
// this must never consume draws from the environment stream that the Daily
// Challenge's fairness depends on. (Quick Play never starts a Daily
// Challenge run anyway — that has its own fixed configuration.)
// ============================================================================
import { SCENARIOS, DIFFICULTIES, PLAYER_AVATARS, MAX_AI_PLAYERS, WEATHER_SEVERITIES } from '../data/gameConfig';
import { pickRandom, randomInt } from './rng';

// Anywhere from one opponent to a full table. Part of the point of Quick
// Play is that the shape of the game varies run to run, and a 4-seat table
// is now supported everywhere else too (gameConfig.js's MAX_PLAYERS).
const QUICK_PLAY_MIN_BOTS = 1;
const QUICK_PLAY_MAX_BOTS = MAX_AI_PLAYERS;

/**
 * A randomized game setup. `playerName`/`avatar` are passed in (from the
 * saved profile, so a returning player keeps their name and unlocked
 * avatar) and fall back to the same defaults SetupScreen uses.
 *
 * Returns `{ mode, humanNames, difficultyId, botConfigs, options }` — spread
 * straight into `game.startGame(...)`. Robot configs are left as the literal
 * 'random' sentinel rather than resolved here, so game/players.js's
 * `resolveBotConfig` does the rolling in the one place that also guarantees
 * no two robots at the same table get the same personality.
 */
export function rollQuickPlaySetup({ playerName, avatar } = {}) {
  const aiCount = randomInt(QUICK_PLAY_MIN_BOTS, QUICK_PLAY_MAX_BOTS);
  return {
    mode: { type: 'solo', aiCount },
    humanNames: [playerName?.trim() || 'You'],
    difficultyId: pickRandom(DIFFICULTIES).id,
    botConfigs: Array.from({ length: aiCount }, () => ({ personalityId: 'random', skillLevelId: 'random' })),
    options: {
      scenarioId: pickRandom(SCENARIOS).id,
      humanAvatars: [avatar || PLAYER_AVATARS[0]],
      // Rolled like everything else — how wild the economy gets is part of
      // what makes one Quick Play run feel different from the last.
      weatherSeverityId: pickRandom(WEATHER_SEVERITIES).id,
      // Never rolled on: a one-click "just start" game should not surprise
      // anyone with a clock. The timer is an explicit setup choice.
      turnTimer: false,
    },
  };
}
