// ============================================================================
// Turn / month-cycle engine
// ----------------------------------------------------------------------------
// Orchestrates what happens when a player ends their turn: advance to the
// next player, or — once everyone has gone — resolve the whole month
// (income, price drift, weather tick, fortune cards, business exit offers,
// badges) and either start the next month or end the game.
//
// Month-end resolution is a TWO-PHASE process when a business-exit buyout
// offer (see game/businessExits.js) lands on a HUMAN player: phase one
// (beginMonthEnd, below) resolves R&D/business-decline/the exit ROLL, then
// PAUSES — status becomes 'exitOffer' and nothing past that point (payday,
// fortune cards, badges, ...) has happened yet — so the player can actually
// decide whether to accept the buyout instead of it just auto-resolving.
// resolveExitOfferDecision() (called once the player picks) applies their
// choice and then runs the rest of the month (finishMonthEnd) to completion.
// An offer landing on an AI player never pauses — aiDecideExitOffer() below
// decides instantly and month-end resolution proceeds in one call, exactly
// like every other month-end step always has.
// ============================================================================
import {
  GAME_LENGTH_MONTHS,
  MONTHLY_ALLOWANCE,
  BUSINESS_EXIT_RARITY_LABELS,
} from '../data/gameConfig';
import { driftPrices } from './market';
import { tickWeather, getStageInfo } from './weather';
import { drawFortuneCard, applyCardEffect } from './decks';
import { evaluateBadges } from './badges';
import { netWorth, passiveIncome, rollWeatherIncomeAmounts } from './players';
import { getScenario, checkScenarioObjective } from './scenarios';
import { resolvePendingRnd, pruneExpiredBoosts, applyBusinessDecline } from './businessUpgrades';
import { rollBusinessExit } from './businessExits';

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

/**
 * Decide whether an AI-owned business accepts a buyout offer — instant,
 * deterministic, and personality-flavored rather than a coin flip, so it
 * never needs its own RNG draw (see businessExits.js's module comment on
 * why the environment stream's draw count/order can never depend on player
 * choices — this sidesteps the question entirely by not drawing at all).
 * A truly rich offer (10x/20x) is always taken — nobody turns down a
 * jackpot. Below that, it comes down to temperament: a tycoon (chasing
 * businesses, not cash-outs) holds out for at least 8x; a hoarder/saver
 * (cash now beats a maybe-better offer later) takes anything reasonable;
 * everyone else takes the common 5x/8x middle ground but shrugs off a
 * lowball 2x.
 */
function aiDecideExitOffer(player, exit) {
  if (exit.multiplier >= 10) return true;
  if (player?.strategyId === 'tycoon') return exit.multiplier >= 8;
  if (player?.strategyId === 'hoarder' || player?.strategyId === 'saver') return true;
  return exit.multiplier >= 5;
}

/**
 * Apply an already-made accept/decline decision on a rolled exit offer to
 * `players`, returning the updated roster plus a log entry and (for the
 * fortune-card-style recap modal) a matching recap card — same shape either
 * way so callers don't need to branch. Pure — does not touch `state`.
 */
function applyExitOutcome(players, exit, accepted, month) {
  const targetPlayer = players.find((p) => p.id === exit.playerId);
  const bizName = exit.business.name || 'a business';

  if (accepted) {
    const nextPlayers = players.map((p) => {
      if (p.id !== exit.playerId) return p;
      return {
        ...p,
        businesses: p.businesses.filter((b) => b.id !== exit.businessId),
        cash: p.cash + exit.payout,
        soldBusinesses: [
          ...p.soldBusinesses,
          { id: exit.businessId, name: exit.business.name, income: exit.income, multiplier: exit.multiplier, payout: exit.payout, month },
        ],
      };
    });
    const rarity = BUSINESS_EXIT_RARITY_LABELS[exit.multiplier] || 'rare';
    return {
      players: nextPlayers,
      logEntry: {
        icon: '💼',
        message: `${targetPlayer.name} sold ${bizName} for $${exit.payout} (${exit.multiplier}x monthly revenue, a ${rarity} offer)!`,
        kind: 'businessExit',
        playerId: exit.playerId,
      },
      fortuneRecapEntry: {
        playerId: targetPlayer.id,
        playerName: targetPlayer.name,
        avatar: targetPlayer.avatar,
        deckId: 'opportunity',
        card: {
          icon: '💼',
          title: 'Buyout Offer!',
          flavor: `A buyer wanted ${bizName} — and they weren't lowballing.`,
          why: 'Selling a business for a multiple of what it earns each month is called an "exit" — the more monthly income you had built up before the offer came, the bigger the payday.',
        },
        description: `Sold for $${exit.payout} (${exit.multiplier}x monthly revenue)!`,
      },
    };
  }

  return {
    players,
    logEntry: {
      icon: '🤝',
      message: `${targetPlayer.name} turned down a $${exit.payout} buyout offer for ${bizName} (${exit.multiplier}x monthly revenue) and kept building.`,
      kind: 'businessExitDeclined',
      playerId: exit.playerId,
    },
    fortuneRecapEntry: {
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      avatar: targetPlayer.avatar,
      deckId: 'risk',
      card: {
        icon: '🤝',
        title: 'Offer Declined',
        flavor: `${targetPlayer.name} turned down a buyer for ${bizName}, betting it's worth more kept.`,
        why: "Turning down cash now to keep growing something you own can pay off bigger later — but it's a real gamble; there's no guarantee a better offer ever comes again.",
      },
      description: `Declined a $${exit.payout} offer (${exit.multiplier}x monthly revenue).`,
    },
  };
}

/**
 * Phase one of month-end resolution: R&D payoffs, expired-boost pruning,
 * business-decline decay (all business-level and unaffected by any exit
 * decision), then the exit-offer roll. Returns either a PAUSED result
 * (`{ paused: true, state, logEntries }`, when the offer lands on a human
 * and needs their decision) or a ready-to-finish one (`{ paused: false,
 * players, logEntries, month, scenario, leaderBefore, extraFortuneRecap }`).
 */
function beginMonthEnd(state) {
  const logEntries = [];
  const month = state.month;
  const scenario = getScenario(state.scenarioId);
  const leaderBefore = currentLeaderId(state.players, state.assetPrices, month);

  // 1) Resolve any R&D projects whose delay is up, drop expired Marketing
  // boosts, and apply business-decline decay for every business — BEFORE
  // payday, so a project that resolves this month already counts toward
  // this month's paycheck instead of showing up a month late, and a
  // decline this month is reflected in THIS month's income too. See
  // game/businessUpgrades.js.
  let players = state.players.map((p) => {
    const businesses = p.businesses.map((b) => {
      const { business: afterRnd, results } = resolvePendingRnd(b, month);
      for (const r of results) {
        logEntries.push({
          icon: '🔬',
          message: `R&D paid off for ${afterRnd.name} — ${r.big ? 'a big breakthrough' : 'a modest improvement'} (+$${r.amount}/mo, ${Math.round(r.pct * 100)}% of revenue, permanent)!`,
          kind: 'businessRnd',
          playerId: p.id,
        });
      }
      const pruned = pruneExpiredBoosts(afterRnd, month);
      const { business: afterDecline, declined, loss } = applyBusinessDecline(pruned, month);
      if (declined) {
        logEntries.push({
          icon: '📉',
          message: `${afterDecline.name} has gone untended too long and lost $${loss}/mo in revenue (down to $${afterDecline.income}/mo) — reinvest to turn it around!`,
          kind: 'businessDecline',
          playerId: p.id,
        });
      }
      return afterDecline;
    });
    return { ...p, businesses };
  });

  // 2) Business exit offers — roughly once every ~6 months (a per-month
  // coin flip, not a fixed schedule), one random player — if they own any
  // business — gets a buyout offer for a multiple of their most lucrative
  // business's current monthly income. A HUMAN target gets to decide
  // (see resolveExitOfferDecision below); an AI target decides instantly
  // (aiDecideExitOffer) and resolution continues in this same call, same
  // as before this round. Resolved BEFORE payday so a sold business
  // doesn't also collect this month's regular income on top of its
  // lump-sum payout. See game/businessExits.js for exactly why every draw
  // here is unconditional/fixed-order on the environment stream.
  const exit = rollBusinessExit(players, month);
  let extraFortuneRecap = null;
  if (exit) {
    const targetPlayer = players.find((p) => p.id === exit.playerId);
    if (targetPlayer?.type === 'human') {
      const bizName = exit.business.name || 'a business';
      logEntries.push({
        icon: '💼',
        message: `${targetPlayer.name} got a buyout offer for ${bizName} — $${exit.payout} (${exit.multiplier}x monthly revenue)! Decide before the month wraps up.`,
        kind: 'businessExitOffer',
        playerId: exit.playerId,
      });
      return {
        paused: true,
        state: {
          ...state,
          players,
          pendingExitOffer: exit,
          pendingMonthEnd: { leaderBefore },
          status: 'exitOffer',
        },
        logEntries,
      };
    }
    const accepted = aiDecideExitOffer(targetPlayer, exit);
    const outcome = applyExitOutcome(players, exit, accepted, month);
    players = outcome.players;
    logEntries.push(outcome.logEntry);
    extraFortuneRecap = outcome.fortuneRecapEntry;
  }

  return { paused: false, players, logEntries, month, scenario, leaderBefore, extraFortuneRecap };
}

/**
 * Phase two: everything from the weather-driven income roll through
 * advancing the calendar / ending the game — steps 3-12, unchanged in
 * substance from before this round, just now parameterized so both the
 * single-call path (no exit offer, or one an AI resolved instantly) and the
 * resumed-after-a-human-decision path share the exact same logic.
 */
function finishMonthEnd(state, players, logEntries, month, scenario, leaderBefore, extraFortuneRecap) {
  const fortuneRecap = extraFortuneRecap ? [extraFortuneRecap] : [];

  // 3) Roll this month's weather-driven per-unit income (Lemonade Stand —
  // see players.js's rollWeatherIncomeAmounts) using the CURRENT (pre-tick)
  // weather stage, since this is the income for the month that's ending.
  // Stored on nextState below so the UI shows a stable already-rolled
  // figure until the next month-end reroll, instead of re-rolling on every
  // render.
  const weatherIncomeAmounts = rollWeatherIncomeAmounts(state.weather);

  // 4) Allowance + rent + business income + weather-driven asset income +
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

  // 5) Fortune cards — drawn using the weather that governed this month.
  const startingPrices = state.assetPrices;
  let prices = state.assetPrices;
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

  // 6) Price drift for the month that's ending.
  const drift = driftPrices(prices, state.weather);
  prices = drift.prices;

  // 7) Badges — passiveIncomeAtLeast needs the same allPlayers/prices/
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

  // 8) Scenario objective check (Passive Income Race / Business Sprint —
  // Classic Growth and Survive the Crash have no objective and no-op here).
  // Uses this month's post-income/post-badge numbers, same as everything
  // else below. See game/scenarios.js.
  const objectiveCheck = checkScenarioObjective(scenario, state.difficultyId, players, month, prices, weatherIncomeAmounts);
  players = objectiveCheck.players;
  logEntries.push(...objectiveCheck.logEntries);

  // 9) Weather tick for the month ahead.
  const tick = tickWeather(state.weather);
  if (tick.changed) {
    const info = getStageInfo(tick.weather);
    logEntries.push({ icon: info.icon, message: `The weather shifted to ${info.name}!`, kind: 'weather' });
  }

  // 10) Net worth history snapshot — one point per completed month, used by
  // the game-over screen's growth chart (see components/NetWorthChart.jsx).
  players = players.map((p) => ({
    ...p,
    netWorthHistory: [...p.netWorthHistory, { month, netWorth: netWorth(p, prices) }],
  }));

  // 11) Lead-change callout — a bit of extra excitement when the standings
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

  // 12) Advance the calendar.
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
    pendingExitOffer: null,
    pendingMonthEnd: null,
  };

  if (isGameOver) {
    const ranked = [...players].sort((a, b) => netWorth(b, prices) - netWorth(a, prices));
    nextState.winnerId = ranked[0].id;
    logEntries.push({ icon: '🏆', message: `Game over! ${ranked[0].name} wins with $${netWorth(ranked[0], prices)}!`, kind: 'gameover' });
  }

  return { state: nextState, logEntries };
}

function resolveMonthEnd(state) {
  const begun = beginMonthEnd(state);
  if (begun.paused) return { state: begun.state, logEntries: begun.logEntries };
  return finishMonthEnd(state, begun.players, begun.logEntries, begun.month, begun.scenario, begun.leaderBefore, begun.extraFortuneRecap);
}

/**
 * Apply a human player's accept/decline decision on `state.pendingExitOffer`
 * (set by beginMonthEnd above when an offer landed on them) and run the
 * rest of month-end resolution to completion. A no-op (returns `state`
 * unchanged) if there's no matching pending offer — guards against a stale
 * double-dispatch (e.g. a double-click) re-resolving an already-decided
 * offer.
 */
export function resolveExitOfferDecision(state, playerId, accept) {
  const offer = state.pendingExitOffer;
  if (!offer || offer.playerId !== playerId || state.status !== 'exitOffer') {
    return { state, logEntries: [] };
  }
  const month = state.month;
  const scenario = getScenario(state.scenarioId);
  const leaderBefore = state.pendingMonthEnd?.leaderBefore ?? currentLeaderId(state.players, state.assetPrices, month);
  const outcome = applyExitOutcome(state.players, offer, accept, month);
  return finishMonthEnd(state, outcome.players, [outcome.logEntry], month, scenario, leaderBefore, outcome.fortuneRecapEntry);
}

/** Advance to the next queued fortune-card recap, or back to normal play. */
export function acknowledgeFortuneCard(state) {
  const nextIndex = state.fortuneRecapIndex + 1;
  if (nextIndex < state.fortuneRecap.length) {
    return { ...state, fortuneRecapIndex: nextIndex };
  }
  return { ...state, status: 'playing', fortuneRecap: [], fortuneRecapIndex: 0 };
}
