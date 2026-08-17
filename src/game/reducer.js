// ============================================================================
// Top-level game reducer
// ----------------------------------------------------------------------------
// The single place that turns an action into a new game state. Delegates
// the actual rules to actions.js / turnEngine.js / aiEngine.js and just
// handles wiring + the shared event log.
// ============================================================================
import { createNewGame } from './newGame';
import { buyAsset, sellAsset, startBusiness, learnSkill } from './actions';
import { endTurn, acknowledgeFortuneCard } from './turnEngine';
import { runAiTurn } from './aiEngine';

let logCounter = 0;
function nextLogId() {
  logCounter += 1;
  return `log-${logCounter}-${Date.now()}`;
}

function appendLog(state, entries) {
  if (!entries || entries.length === 0) return state;
  const stamped = entries.map((e) => ({ id: nextLogId(), month: state.month, ...e }));
  return { ...state, log: [...state.log, ...stamped].slice(-200) };
}

function withResult(result) {
  // actions.js helpers return { state, ok, error, logEntry }
  if (!result.ok) {
    return { ...result.state, lastError: result.error };
  }
  const entries = result.logEntry ? [result.logEntry] : [];
  return appendLog({ ...result.state, lastError: null }, entries);
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'START_GAME':
      return createNewGame(action.mode, action.humanNames);

    case 'LOAD_GAME':
      return action.state;

    case 'NEW_GAME':
      return null;

    case 'BUY_ASSET':
      return withResult(buyAsset(state, action.playerId, action.assetId, action.qty));

    case 'SELL_ASSET':
      return withResult(sellAsset(state, action.playerId, action.assetId, action.qty));

    case 'START_BUSINESS':
      return withResult(startBusiness(state, action.playerId));

    case 'LEARN_SKILL':
      return withResult(learnSkill(state, action.playerId));

    case 'END_TURN': {
      const { state: nextState, logEntries } = endTurn(state, action.playerId);
      return appendLog(nextState, logEntries);
    }

    case 'RUN_AI_TURN': {
      const { state: afterAi, logEntries } = runAiTurn(state, action.playerId);
      const logged = appendLog(afterAi, logEntries);
      const { state: nextState, logEntries: turnLog } = endTurn(logged, action.playerId);
      return appendLog(nextState, turnLog);
    }

    case 'ACK_FORTUNE_CARD':
      return acknowledgeFortuneCard(state);

    case 'CLEAR_ERROR':
      return { ...state, lastError: null };

    default:
      return state;
  }
}
