// ============================================================================
// Top-level game reducer
// ----------------------------------------------------------------------------
// The single place that turns an action into a new game state. Delegates
// the actual rules to actions.js / turnEngine.js / aiEngine.js and just
// handles wiring + the shared event log (and, on top of that, the bot chat
// feed — see chatEngine.js).
// ============================================================================
import { createNewGame } from './newGame';
import { buyAsset, sellAsset, startBusiness, learnSkill } from './actions';
import { endTurn, acknowledgeFortuneCard } from './turnEngine';
import { runAiTurn } from './aiEngine';
import {
  reactToLogEntries,
  generateGreeting,
  generateBotTurnFlavor,
  createHumanChatEntry,
  reactToHumanChat,
} from './chatEngine';
import { isOffensiveName } from './nameFilter';

const CHAT_MAX_LENGTH = 140;

let logCounter = 0;
function nextLogId() {
  logCounter += 1;
  return `log-${logCounter}-${Date.now()}`;
}

let chatCounter = 0;
function nextChatId() {
  chatCounter += 1;
  return `chat-${chatCounter}-${Date.now()}`;
}

function appendChat(state, entries) {
  if (!entries || entries.length === 0) return state;
  const stamped = entries.map((e) => ({ id: nextChatId(), month: state.month, ...e }));
  return { ...state, chat: [...(state.chat || []), ...stamped].slice(-60) };
}

// Every log entry that gets appended is also offered to the robots as a
// chance to react in character — this is the single choke point both human
// actions (dispatched one at a time below) and a whole robot turn's worth
// of actions (RUN_AI_TURN, which appends several log entries at once) flow
// through, so bot chat "just works" for both without extra wiring per case.
function appendLog(state, entries) {
  if (!entries || entries.length === 0) return state;
  const stamped = entries.map((e) => ({ id: nextLogId(), month: state.month, ...e }));
  const withLog = { ...state, log: [...state.log, ...stamped].slice(-200) };
  return appendChat(withLog, reactToLogEntries(withLog, stamped));
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
    case 'START_GAME': {
      const newState = createNewGame(action.mode, action.humanNames, action.difficultyId, action.botConfigs);
      return appendChat(newState, generateGreeting(newState));
    }

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
      let logged = appendLog(afterAi, logEntries);
      // Independent of whatever the bot actually did this turn, it gets a
      // separate small chance at a goof-off sound effect and/or a hype
      // quote — see chatEngine.js's generateBotTurnFlavor().
      logged = appendChat(logged, generateBotTurnFlavor(logged, action.playerId));
      const { state: nextState, logEntries: turnLog } = endTurn(logged, action.playerId);
      return appendLog(nextState, turnLog);
    }

    case 'ACK_FORTUNE_CARD': {
      const nextState = acknowledgeFortuneCard(state);
      // The transition from the month's fortune-card recap back to normal
      // play doesn't produce its own "passed the turn" log entry (that only
      // happens for a plain within-month hand-off — see turnEngine.js), so
      // give the new month's first player the same ambient chat chance by
      // hand — reusing the 'endTurn' reaction rather than duplicating it.
      if (nextState.status === 'playing' && state.status !== 'playing') {
        const firstPlayer = nextState.players[nextState.activePlayerIndex];
        const chat = firstPlayer
          ? reactToLogEntries(nextState, [{ kind: 'endTurn', playerId: firstPlayer.id }])
          : [];
        return appendChat(nextState, chat);
      }
      return nextState;
    }

    case 'SEND_CHAT': {
      // The composer (ChatPanel.jsx) already validates before dispatching,
      // but the reducer re-checks too — never trust the UI as the only
      // guard against an empty or offensive message slipping into
      // localStorage/the shared log.
      const sender = state.players.find((p) => p.id === action.playerId);
      const trimmed = (action.message || '').trim().slice(0, CHAT_MAX_LENGTH);
      if (!sender || !trimmed || isOffensiveName(trimmed)) return state;
      const humanEntry = createHumanChatEntry(sender, trimmed, action.targetPlayerId);
      let next = appendChat(state, [humanEntry]);
      // A targeted (or random) bot has a chance to chime back — see
      // chatEngine.js's reactToHumanChat for why this is a canned line, not
      // an actual understanding of what was typed.
      next = appendChat(next, reactToHumanChat(next, humanEntry));
      return next;
    }

    case 'CLEAR_ERROR':
      return { ...state, lastError: null };

    default:
      return state;
  }
}
