import { useEffect, useReducer, useRef, useCallback } from 'react';
import { gameReducer } from '../../game/reducer';
import { usePlaySpeed } from '../../hooks/usePlaySpeed';

// ============================================================================
// The Kids Version's own game hook
// ----------------------------------------------------------------------------
// This is a DELIBERATE near-duplicate of hooks/useGame.js rather than a
// shared/refactored one, for one reason: the "Just for Kids" build is not
// allowed to touch anything under src/game/ or the main app's own hooks in
// any way that could change the main game's behavior (see the project brief
// this shipped under). gameReducer itself — the actual rules engine — is
// imported completely unmodified, so "same game logic" is literally true:
// every action type, every rule, every bit of randomness works exactly like
// the grown-up version. Only two things differ from useGame.js:
//
//   1. Persistence uses its OWN localStorage key (see KIDS_STORAGE_KEY
//      below) instead of game/persistence.js's LOCAL_STORAGE_KEY, so a kid
//      picking up "Just for Kids" never overwrites (or gets overwritten by)
//      a parent's in-progress main-game save, and vice versa. Implemented
//      inline here rather than parameterizing game/persistence.js, again to
//      avoid touching any shared game/ file.
//   2. The play-speed preference (hooks/usePlaySpeed.js) IS shared with the
//      main game on purpose — it's a device-wide preference already stored
//      outside game state, and there's no reason a family should have to
//      set "how fast do robots move" twice.
// ============================================================================

const KIDS_STORAGE_KEY = 'ventureflow-kids-save-v1';

function saveKidsGame(state) {
  try {
    localStorage.setItem(KIDS_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
  } catch (err) {
    console.warn('VentureFlow Kids: could not save game.', err);
  }
}

function loadKidsGame() {
  try {
    const raw = localStorage.getItem(KIDS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.state || null;
  } catch (err) {
    console.warn('VentureFlow Kids: could not load saved game.', err);
    return null;
  }
}

function clearKidsGame() {
  try {
    localStorage.removeItem(KIDS_STORAGE_KEY);
  } catch (err) {
    console.warn('VentureFlow Kids: could not clear saved game.', err);
  }
}

export function hasSavedKidsGame() {
  try {
    return !!localStorage.getItem(KIDS_STORAGE_KEY);
  } catch {
    return false;
  }
}

// Same acceleration curve as useGame.js, so a robot's turn in the Kids
// Version paces identically to the main game rather than surprising a kid
// who's played both.
const STEP_ACCELERATION = 0.82;
const STEP_FLOOR_FACTOR = 0.3;
const ABSOLUTE_STEP_FLOOR_MS = 110;

function stepDelayFor(baseMs, stepsTaken) {
  const floor = Math.max(ABSOLUTE_STEP_FLOOR_MS, baseMs * STEP_FLOOR_FACTOR);
  return Math.max(floor, Math.round(baseMs * STEP_ACCELERATION ** stepsTaken));
}

/** Same shape as hooks/useGame.js's return value (state + one callback per
 * action), so the kids UI layer dispatches through the identical action
 * vocabulary as the main game. */
export function useKidsGame() {
  const [state, dispatch] = useReducer(gameReducer, null, () => loadKidsGame());
  const aiTimeoutRef = useRef(null);
  const { speed } = usePlaySpeed();

  useEffect(() => {
    if (state) saveKidsGame(state);
  }, [state]);

  useEffect(() => {
    if (!state || state.status !== 'playing') return;
    const activePlayer = state.players[state.activePlayerIndex];
    if (!activePlayer || activePlayer.type !== 'ai') return;

    const stepsTaken = state.aiTurnSteps || 0;
    const finished = !!state.aiTurnDone;
    const delay = finished ? speed.turnHandoffMs : stepDelayFor(speed.aiStepMs, stepsTaken);

    aiTimeoutRef.current = setTimeout(() => {
      dispatch(
        finished
          ? { type: 'END_TURN', playerId: activePlayer.id }
          : { type: 'RUN_AI_STEP', playerId: activePlayer.id }
      );
    }, delay);

    return () => clearTimeout(aiTimeoutRef.current);
  }, [state, speed]);

  const startGame = useCallback((mode, humanNames, difficultyId, botConfigs, options = {}) => {
    dispatch({
      type: 'START_GAME',
      mode,
      humanNames,
      difficultyId,
      botConfigs,
      scenarioId: options.scenarioId,
      humanAvatars: options.humanAvatars,
    });
  }, []);

  const newGame = useCallback(() => {
    clearKidsGame();
    dispatch({ type: 'NEW_GAME' });
  }, []);

  const buyAsset = useCallback((playerId, assetId, qty = 1) => {
    dispatch({ type: 'BUY_ASSET', playerId, assetId, qty });
  }, []);

  const sellAsset = useCallback((playerId, assetId, qty = 1) => {
    dispatch({ type: 'SELL_ASSET', playerId, assetId, qty });
  }, []);

  const startBusiness = useCallback((playerId) => {
    dispatch({ type: 'START_BUSINESS', playerId });
  }, []);

  const learnSkill = useCallback((playerId) => {
    dispatch({ type: 'LEARN_SKILL', playerId });
  }, []);

  const upgradeBusiness = useCallback((playerId, businessId, trackId) => {
    dispatch({ type: 'UPGRADE_BUSINESS', playerId, businessId, trackId });
  }, []);

  const endTurn = useCallback((playerId) => {
    dispatch({ type: 'END_TURN', playerId });
  }, []);

  const ackStartupLaunch = useCallback(() => {
    dispatch({ type: 'ACK_STARTUP_LAUNCH' });
  }, []);

  const ackFortuneCard = useCallback(() => {
    dispatch({ type: 'ACK_FORTUNE_CARD' });
  }, []);

  const resolveExitOffer = useCallback((playerId, accept) => {
    dispatch({ type: 'RESOLVE_EXIT_OFFER', playerId, accept });
  }, []);

  const sendChat = useCallback((playerId, message, targetPlayerId) => {
    dispatch({ type: 'SEND_CHAT', playerId, message, targetPlayerId });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  return {
    state,
    hasSavedGame: hasSavedKidsGame(),
    startGame,
    newGame,
    buyAsset,
    sellAsset,
    startBusiness,
    learnSkill,
    upgradeBusiness,
    endTurn,
    ackStartupLaunch,
    ackFortuneCard,
    resolveExitOffer,
    sendChat,
    clearError,
  };
}
