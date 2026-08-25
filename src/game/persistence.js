// ============================================================================
// Save / resume via localStorage
// ----------------------------------------------------------------------------
// Two jobs beyond plain read/write:
//
// 1. RNG CONTINUITY. The random streams (game/rng.js) live outside game
//    state, so before this a reload silently jumped to a fresh
//    entropy-seeded sequence. Harmless in a normal game, but it quietly
//    broke the Daily Challenge's whole promise: `seedRng()` only runs at
//    START_GAME, so anyone who reloaded mid-run continued on a different
//    weather/card timeline from everyone else and still saved into that
//    day's leaderboard segment. Both cursors are now saved and restored.
//
// 2. MIGRATION. Every field added since the first release is backfilled on
//    load by `normalizeState` below. This exists because the alternative —
//    scattering `|| []` at each read site — was already failing: a save
//    made before `netWorthHistory` existed crashed the game outright at the
//    first month-end, with no way back except clearing storage by hand.
//    Normalizing once, in one place, is both safer and easier to keep
//    honest as fields keep being added.
// ============================================================================
import { LOCAL_STORAGE_KEY, ASSETS, BUSINESS_COST } from '../data/gameConfig';
import { snapshotRng, restoreRng } from './rng';

// Bumped when a change needs a migration that normalizeState can't infer.
// Not currently used to gate anything — it's here so a future breaking
// change has somewhere to hang, and so a save can be identified at a glance.
const SAVE_VERSION = 2;

function normalizeBusiness(business) {
  return {
    salesLevel: 0,
    opsLevel: 0,
    rndCount: 0,
    totalInvested: BUSINESS_COST,
    ...business,
    tempBoosts: business.tempBoosts || [],
    pendingRnd: business.pendingRnd || [],
    // Backfilled ONCE, here, rather than left to a read-time fallback.
    // businessUpgrades.js's fallback reads `tempBoosts.length`, but
    // pruneExpiredBoosts deletes exactly that history every month-end — so a
    // legacy business's campaign count silently reset to 0 at the first
    // month boundary and handed back free campaigns, defeating the cap.
    // Reading it once at load, before any pruning can happen, is the only
    // point where that number is still recoverable.
    marketingCount: business.marketingCount ?? (business.tempBoosts || []).length,
  };
}

function normalizePlayer(player) {
  const holdings = { ...player.holdings };
  const purchaseStats = { ...player.purchaseStats };
  for (const asset of ASSETS) {
    if (typeof holdings[asset.id] !== 'number') holdings[asset.id] = 0;
    if (!purchaseStats[asset.id]) purchaseStats[asset.id] = { qty: 0, spent: 0 };
  }
  const businesses = (player.businesses || []).map(normalizeBusiness);
  return {
    ...player,
    holdings,
    purchaseStats,
    businesses,
    businessSeq: player.businessSeq ?? businesses.length,
    // Every array the engine spreads into. A missing one used to throw
    // ("p.netWorthHistory is not iterable") and take the whole game down.
    badges: player.badges || [],
    badgeEvents: player.badgeEvents || [],
    soldBusinesses: player.soldBusinesses || [],
    netWorthHistory: player.netWorthHistory || [],
    ledger: player.ledger || [],
    allowanceMods: player.allowanceMods || [],
    businessPauseUntilMonth: player.businessPauseUntilMonth || 0,
    passiveBonus: player.passiveBonus || 0,
    skillTokens: player.skillTokens || 0,
  };
}

/** Bring a state loaded from storage up to what the current code expects.
 * Additive only — it never changes a value that's already there, so
 * resuming a save made by this build is a no-op. */
export function normalizeState(state) {
  if (!state || !Array.isArray(state.players)) return null;
  return {
    ...state,
    players: state.players.map(normalizePlayer),
    log: state.log || [],
    chat: state.chat || [],
    seenLessons: state.seenLessons || [],
    fortuneRecap: state.fortuneRecap || [],
    fortuneRecapIndex: state.fortuneRecapIndex || 0,
    weatherIncomeAmounts: state.weatherIncomeAmounts || { interestRates: {}, interestBonus: {} },
    aiTurnSteps: state.aiTurnSteps || 0,
    aiTurnDone: !!state.aiTurnDone,
    pendingLaunch: state.pendingLaunch || null,
    turnTimer: state.turnTimer || null,
    // Deliberately cleared on load. The deadline is a wall-clock timestamp,
    // so a game resumed an hour later would otherwise open with the clock
    // already expired and instantly pass the player's turn. Resuming gives
    // a fresh 30 seconds, which is the only fair reading of "you closed the
    // tab and came back".
    turnDeadlineAt: null,
  };
}

export function saveGame(state) {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), rng: snapshotRng(), state })
    );
    return true;
  } catch (err) {
    // Most likely the storage quota. The PREVIOUS value survives, which
    // means a later reload would silently resume an out-of-date game — so
    // this is worth surfacing rather than only warning to the console.
    console.warn('VentureFlow: could not save game.', err);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = normalizeState(parsed?.state || null);
    if (!state) return null;
    // A finished game is not something to resume — the only thing waiting
    // on the other side of "gameover" is the New Game button, so a save
    // left in that state must not be handed back verbatim. Without this,
    // useGame's lazy useReducer init returns the stale gameover state on
    // the very first render, and App.jsx has no way to tell "resuming a
    // real game" from "resurrecting a finished one" — the player reopens
    // the app days later and is dropped right back on the OLD game's
    // final GameOverScreen instead of the landing screen.
    if (state.status === 'gameover') {
      clearSavedGame();
      return null;
    }
    // Resume the exact random sequence this game was on. A save from before
    // this existed simply has no `rng` and keeps the old behaviour.
    restoreRng(parsed?.rng);
    return state;
  } catch (err) {
    // A corrupt or unreadable save must never be fatal: returning null
    // sends the player to the landing screen with a fresh start available,
    // rather than crashing them into a white screen on every load.
    console.warn('VentureFlow: could not load saved game — starting fresh.', err);
    return null;
  }
}

export function clearSavedGame() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (err) {
    console.warn('VentureFlow: could not clear saved game.', err);
  }
}

export function hasSavedGame() {
  try {
    return !!localStorage.getItem(LOCAL_STORAGE_KEY);
  } catch {
    return false;
  }
}
