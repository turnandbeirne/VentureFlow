import { useEffect, useReducer, useRef, useCallback } from 'react';
import { gameReducer } from '../game/reducer';
import { saveGame, loadGame, clearSavedGame, hasSavedGame } from '../game/persistence';

const AI_TURN_DELAY_MS = 700;

/**
 * React glue around the pure gameReducer: persists to localStorage on every
 * change, and auto-plays AI turns after a short delay so robot moves are
 * readable instead of instant.
 */
export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, null, () => loadGame());
  const aiTimeoutRef = useRef(null);

  // Persist whenever state changes (and there's an active game).
  useEffect(() => {
    if (state) saveGame(state);
  }, [state]);

  // Auto-play the active player's turn if it's a robot.
  useEffect(() => {
    if (!state || state.status !== 'playing') return;
    const activePlayer = state.players[state.activePlayerIndex];
    if (!activePlayer || activePlayer.type !== 'ai') return;

    aiTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'RUN_AI_TURN', playerId: activePlayer.id });
    }, AI_TURN_DELAY_MS);

    return () => clearTimeout(aiTimeoutRef.current);
  }, [state]);

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

  const endTurn = useCallback((playerId) => {
    dispatch({ type: 'END_TURN', playerId });
  }, []);

  const ackFortuneCard = useCallback(() => {
    dispatch({ type: 'ACK_FORTUNE_CARD' });
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
    endTurn,
    ackFortuneCard,
    sendChat,
    clearError,
  };
}
