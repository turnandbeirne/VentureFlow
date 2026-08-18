// ============================================================================
// Turn / month-cycle engine
// ----------------------------------------------------------------------------
// Orchestrates what happens when a player ends their turn: advance to the
// next player, or — once everyone has gone — resolve the whole month
// (income, price drift, weather tick, fortune cards, badges) and either
// start the next month or end the game.
// ============================================================================
import { GAME_LENGTH_MONTHS, MONTHLY_ALLOWANCE } from '../data/gameConfig';
import { driftPrices } from './market';
import { tickWeather, getStageInfo } from './weather';
import { drawFortuneCard, applyCardEffect } from './decks';
import { evaluateBadges } from './badges';
import { netWorth, passiveIncome } from './players';

export function endTurn(state, playerId) {
  const currentIndex = state.players.findIndex((p) => p.id === playerId);
  const nextIndex = currentIndex + 1;

  if (nextIndex < state.players.length) {
    const nextPlayer = state.players[nextIndex];
    return {
      state: { ...state, activePlayerIndex: nextIndex },
      logEntries: [{ icon: '➡️', message: `Passed the turn to ${nextPlayer.name}.`, kind: 'endTurn', playerId: nextPlayer.id }],
    };
  }

  return resolveMonthEnd(state);
}

function resolveMonthEnd(state) {
  const logEntries = [];
  const month = state.month;

  // 1) Allowance + rent + business income + card bonuses. Allowance comes
  // from the difficulty preset chosen at setup (state.monthlyAllowance);
  // MONTHLY_ALLOWANCE is only a fallback for a game saved before difficulty
  // presets existed.
  const allowance = state.monthlyAllowance ?? MONTHLY_ALLOWANCE;
  let players = state.players.map((p) => {
    const income = allowance + passiveIncome(p);
    return { ...p, cash: p.cash + income };
  });
  logEntries.push({ icon: '💰', message: `Payday! Everyone collected their allowance and passive income.`, kind: 'payday' });

  // 2) Fortune cards — drawn using the weather that governed this month.
  const startingPrices = state.assetPrices;
  let prices = state.assetPrices;
  const fortuneRecap = [];
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const { deckId, card } = drawFortuneCard(state.weather);
    const applied = applyCardEffect(player, prices, card);
    players[i] = applied.player;
    prices = applied.prices;
    logEntries.push({
      icon: card.icon,
      message: `${player.name}: ${card.title} (${applied.description})`,
      playerId: player.id,
      kind: deckId === 'opportunity' ? 'fortuneGood' : 'fortuneBad',
    });
    fortuneRecap.push({
      playerId: player.id,
      playerName: player.name,
      avatar: player.avatar,
      deckId,
      card,
      description: applied.description,
    });
  }

  // 3) Price drift for the month that's ending.
  const drift = driftPrices(prices, state.weather);
  prices = drift.prices;

  // 4) Badges.
  const newlyEarnedLog = [];
  players = players.map((p) => {
    const { player, newlyEarned } = evaluateBadges(p, month);
    for (const badge of newlyEarned) {
      newlyEarnedLog.push({ icon: badge.icon, message: `${p.name} earned the ${badge.name} badge!`, playerId: p.id, kind: 'badge' });
    }
    return player;
  });
  logEntries.push(...newlyEarnedLog);

  // 5) Weather tick for the month ahead.
  const tick = tickWeather(state.weather);
  if (tick.changed) {
    const info = getStageInfo(tick.weather);
    logEntries.push({ icon: info.icon, message: `The weather shifted to ${info.name}!`, kind: 'weather' });
  }

  // 6) Advance the calendar.
  const nextMonth = month + 1;
  const isGameOver = nextMonth > GAME_LENGTH_MONTHS;

  let nextState = {
    ...state,
    players,
    assetPrices: prices,
    previousAssetPrices: startingPrices,
    weather: tick.weather,
    month: isGameOver ? state.month : nextMonth,
    activePlayerIndex: 0,
    status: isGameOver ? 'gameover' : 'monthRecap',
    fortuneRecap,
    fortuneRecapIndex: 0,
  };

  if (isGameOver) {
    const ranked = [...players].sort((a, b) => netWorth(b, prices) - netWorth(a, prices));
    nextState.winnerId = ranked[0].id;
    logEntries.push({ icon: '🏆', message: `Game over! ${ranked[0].name} wins with $${netWorth(ranked[0], prices)}!`, kind: 'gameover' });
  }

  return { state: nextState, logEntries };
}

/** Advance to the next queued fortune-card recap, or back to normal play. */
export function acknowledgeFortuneCard(state) {
  const nextIndex = state.fortuneRecapIndex + 1;
  if (nextIndex < state.fortuneRecap.length) {
    return { ...state, fortuneRecapIndex: nextIndex };
  }
  return { ...state, status: 'playing', fortuneRecap: [], fortuneRecapIndex: 0 };
}
