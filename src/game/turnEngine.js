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
import { netWorth, passiveIncome, rollWeatherIncomeAmounts } from './players';
import { getScenario, checkScenarioObjective } from './scenarios';
import { resolvePendingRnd, pruneExpiredBoosts } from './businessUpgrades';

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

/** Who's currently ahead by net worth, or null if there's no meaningful
 * leader yet (a single-player game, or the very first month — everyone
 * starts from the same difficulty preset, so "the leader" at that point is
 * just whoever happens to be first in the array, not a real lead). Used to
 * detect a lead change at month-end below. */
function currentLeaderId(players, prices, month) {
  if (players.length < 2 || month <= 1) return null;
  const ranked = [...players].sort((a, b) => netWorth(b, prices) - netWorth(a, prices));
  return ranked[0].id;
}

function resolveMonthEnd(state) {
  const logEntries = [];
  const month = state.month;
  const scenario = getScenario(state.scenarioId);
  const leaderBefore = currentLeaderId(state.players, state.assetPrices, month);

  // 1) Resolve any R&D projects whose delay is up, and drop expired
  // Marketing boosts, for every business — BEFORE payday, so a project that
  // resolves this month already counts toward this month's paycheck
  // instead of showing up a month late. See game/businessUpgrades.js.
  let players = state.players.map((p) => {
    const businesses = p.businesses.map((b) => {
      const { business: afterRnd, results } = resolvePendingRnd(b, month);
      for (const r of results) {
        logEntries.push({
          icon: '🔬',
          message: `R&D paid off for ${afterRnd.name} — ${r.big ? 'a big breakthrough' : 'a modest improvement'} (+$${r.amount}/mo, permanent)!`,
          kind: 'businessRnd',
          playerId: p.id,
        });
      }
      return pruneExpiredBoosts(afterRnd, month);
    });
    return { ...p, businesses };
  });

  // 2) Roll this month's weather-driven per-unit income (Lemonade Stand —
  // see players.js's rollWeatherIncomeAmounts) using the CURRENT (pre-tick)
  // weather stage, since this is the income for the month that's ending.
  // Stored on nextState below so the UI shows a stable already-rolled
  // figure until the next month-end reroll, instead of re-rolling on every
  // render.
  const weatherIncomeAmounts = rollWeatherIncomeAmounts(state.weather);

  // 3) Allowance + rent + business income + weather-driven asset income +
  // card bonuses. Allowance comes from the difficulty preset chosen at
  // setup (state.monthlyAllowance); MONTHLY_ALLOWANCE is only a fallback
  // for a game saved before difficulty presets existed. passiveIncome()
  // needs the whole table (not just this player), the live pre-drift
  // prices, and this month's weatherIncomeAmounts now, since Tree House
  // rent is dynamic and Lemonade Stand income is rolled — see players.js's
  // effectiveRentPerUnit/perUnitIncome.
  const allowance = state.monthlyAllowance ?? MONTHLY_ALLOWANCE;
  const incomeContext = { allPlayers: players, prices: state.assetPrices, month, weatherIncomeAmounts };
  players = players.map((p) => {
    const income = allowance + passiveIncome(p, incomeContext);
    return { ...p, cash: p.cash + income };
  });
  logEntries.push({ icon: '💰', message: `Payday! Everyone collected their allowance and passive income.`, kind: 'payday' });

  // 4) Fortune cards — drawn using the weather that governed this month.
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

  // 5) Price drift for the month that's ending.
  const drift = driftPrices(prices, state.weather);
  prices = drift.prices;

  // 6) Badges — passiveIncomeAtLeast needs the same allPlayers/prices/
  // weatherIncomeAmounts context passiveIncome() takes everywhere else now
  // (dynamic Tree House rent + rolled Lemonade Stand income); use the
  // post-drift prices since that's the live figure going forward into next
  // month.
  const badgeContext = { allPlayers: players, prices, weatherIncomeAmounts };
  const newlyEarnedLog = [];
  players = players.map((p) => {
    const { player, newlyEarned } = evaluateBadges(p, month, badgeContext);
    for (const badge of newlyEarned) {
      // badgeId lets game/lessons.js teach a MORE specific concept than
      // the generic "badges track good habits" lesson for a badge that
      // deserves its own (currently just balancedInvestor -> the
      // diversification lesson) — see lessons.js's CONCEPT_BY_BADGE_ID.
      newlyEarnedLog.push({ icon: badge.icon, message: `${p.name} earned the ${badge.name} badge!`, playerId: p.id, kind: 'badge', badgeId: badge.id });
    }
    return player;
  });
  logEntries.push(...newlyEarnedLog);

  // 7) Scenario objective check (Passive Income Race / Business Sprint —
  // Classic Growth and Survive the Crash have no objective and no-op here).
  // Uses this month's post-income/post-badge numbers, same as everything
  // else below. See game/scenarios.js.
  const objectiveCheck = checkScenarioObjective(scenario, state.difficultyId, players, month, prices, weatherIncomeAmounts);
  players = objectiveCheck.players;
  logEntries.push(...objectiveCheck.logEntries);

  // 8) Weather tick for the month ahead.
  const tick = tickWeather(state.weather);
  if (tick.changed) {
    const info = getStageInfo(tick.weather);
    logEntries.push({ icon: info.icon, message: `The weather shifted to ${info.name}!`, kind: 'weather' });
  }

  // 9) Net worth history snapshot — one point per completed month, used by
  // the game-over screen's growth chart (see components/NetWorthChart.jsx).
  players = players.map((p) => ({
    ...p,
    netWorthHistory: [...p.netWorthHistory, { month, netWorth: netWorth(p, prices) }],
  }));

  // 10) Lead-change callout — a bit of extra excitement when the standings
  // actually flip (skipped in a solo/no-real-leader-yet situation — see
  // currentLeaderId above). Reacted to by game/chatEngine.js and given its
  // own celebratory sound by hooks/useGameSounds.js.
  const leaderAfter = currentLeaderId(players, prices, month);
  if (leaderAfter && leaderBefore && leaderAfter !== leaderBefore) {
    const newLeader = players.find((p) => p.id === leaderAfter);
    if (newLeader) {
      logEntries.push({
        icon: '📈',
        message: `${newLeader.name} took the lead!`,
        kind: 'leadChange',
        playerId: newLeader.id,
      });
    }
  }

  // 11) Advance the calendar.
  const nextMonth = month + 1;
  const isGameOver = nextMonth > GAME_LENGTH_MONTHS;

  let nextState = {
    ...state,
    players,
    assetPrices: prices,
    previousAssetPrices: startingPrices,
    weather: tick.weather,
    weatherIncomeAmounts,
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
