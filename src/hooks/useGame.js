import { useEffect, useReducer, useRef, useCallback } from 'react';
import { gameReducer } from '../game/reducer';
import { saveGame, loadGame, clearSavedGame, hasSavedGame } from '../game/persistence';
import { usePlaySpeed } from './usePlaySpeed';

// A robot with a big cash pile can legitimately take a lot of moves in one
// turn (a shark's cap is 32). Pacing every one of them at the full step
// delay would make a rich late-game turn interminable, so each successive
// move in the SAME turn comes a little faster than the last, floored so it
// never becomes the instant burst this replaced. A typical 4-6 move turn
// barely notices; a 20-move turn stays watchable without being a wait.
const STEP_ACCELERATION = 0.82;
const STEP_FLOOR_FACTOR = 0.3;
const ABSOLUTE_STEP_FLOOR_MS = 110;

function stepDelayFor(baseMs, stepsTaken) {
  const floor = Math.max(ABSOLUTE_STEP_FLOOR_MS, baseMs * STEP_FLOOR_FACTOR);
  return Math.max(floor, Math.round(baseMs * STEP_ACCELERATION ** stepsTaken));
}

/**
 * React glue around the pure gameReducer: persists to localStorage on every
 * change, and plays robot turns out one decision at a time so their moves
 * are readable instead of instant.
 *
 * The pacing comes from the player's chosen play speed (game/playSpeed.js),
 * read live — change the slider mid-turn and the very next beat uses the new
 * timing, because this effect re-runs on every state change and reads the
 * current speed each time. Nothing about speed is stored in game state, so
 * it's never baked into a save.
 */
export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, null, () => loadGame());
  const aiTimeoutRef = useRef(null);
  const { speed } = usePlaySpeed();

  // Persist whenever state changes (and there's an active game).
  useEffect(() => {
    if (state) saveGame(state);
  }, [state]);

  // Drive the active robot's turn: one decision per beat, then hand off.
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
      dailyChallengeDate: options.dailyChallengeDate,
      turnTimer: !!options.turnTimer,
      weatherSeverityId: options.weatherSeverityId,
    });
  }, []);

  const newGame = useCallback(() => {
    clearSavedGame();
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

  const startTurnTimer = useCallback((deadlineAt) => {
    dispatch({ type: 'START_TURN_TIMER', deadlineAt });
  }, []);

  const extendTurn = useCallback((playerId) => {
    // Date.now() is read HERE, in the UI layer, and passed in — the reducer
    // stays a pure function of (state, action). See reducer.js's timer cases.
    dispatch({ type: 'EXTEND_TURN', playerId, now: Date.now() });
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
    hasSavedGame: hasSavedGame(),
    startGame,
    newGame,
    buyAsset,
    sellAsset,
    startBusiness,
    learnSkill,
    upgradeBusiness,
    endTurn,
    startTurnTimer,
    extendTurn,
    ackStartupLaunch,
    ackFortuneCard,
    resolveExitOffer,
    sendChat,
    clearError,
  };
}
