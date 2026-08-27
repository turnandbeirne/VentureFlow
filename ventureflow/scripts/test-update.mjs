// ============================================================================
// Engine checks for this update — run with `node scripts/test-update.mjs`
// ----------------------------------------------------------------------------
// These exercise the ACTUAL exported engine functions (never a
// re-implementation of the rule under test), so a check can only pass if the
// shipped code behaves. Covers:
//   1. the Marketing campaign cap, including that the AI is bound by it
//   2. hold-to-repeat's guard contract on upgrade buttons (canUpgradeTrack
//      going false is what stops the repeat)
//   3. Piggy Bank interest — rate range, the occasional bonus month, and
//      that it actually reaches a player's cash at payday
//   4. business art resolving to a relevant picture for all 500 names
// ============================================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  canUpgradeTrack,
  applyUpgrade,
  marketingAllowance,
  marketingRemaining,
  marketingCampaignsUsed,
  upgradesNeededForNextCampaign,
  marketingUpkeepAvailable,
  pruneExpiredBoosts,
} from '../src/game/businessUpgrades.js';
import { upgradeBusiness, startBusiness } from '../src/game/actions.js';
import { gameReducer } from '../src/game/reducer.js';
import { createNewGame } from '../src/game/newGame.js';
import { rollMonthlyIncomeAmounts, perUnitIncome, passiveIncomeBreakdown, interestRateFor } from '../src/game/players.js';
import { rollBusinessExit } from '../src/game/businessExits.js';
import {
  ASSETS,
  MARKETING_CAMPAIGNS_PER_UPGRADE,
  MARKETING_FREE_CAMPAIGNS,
  MARKETING_BOOST_MONTHS,
  PIGGY_INTEREST_PCT_MIN,
  PIGGY_INTEREST_PCT_MAX,
  PIGGY_BONUS_PCT_MIN,
  PIGGY_BONUS_PCT_MAX,
  BUSINESS_NAMES,
} from '../src/data/gameConfig.js';
import { businessArt } from '../src/game/businessArt.js';

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function freshBusiness(overrides = {}) {
  return {
    id: 'b1',
    name: 'Test Co.',
    income: 50,
    totalInvested: 300,
    salesLevel: 0,
    opsLevel: 0,
    rndCount: 0,
    marketingCount: 0,
    tempBoosts: [],
    pendingRnd: [],
    startedMonth: 1,
    lastTendedMonth: 1,
    ...overrides,
  };
}

// --- 1. Marketing cap ------------------------------------------------------
console.log('\nMarketing campaign cap');

check(`a brand-new business allows exactly ${MARKETING_FREE_CAMPAIGNS} campaigns`, () => {
  let biz = freshBusiness();
  assert.equal(marketingAllowance(biz), MARKETING_FREE_CAMPAIGNS);
  for (let i = 0; i < MARKETING_FREE_CAMPAIGNS; i++) {
    assert.equal(canUpgradeTrack(biz, 'marketing'), true, `campaign ${i + 1} should be allowed`);
    biz = applyUpgrade(biz, 'marketing', 1).business;
  }
  assert.equal(canUpgradeTrack(biz, 'marketing'), false, 'the next campaign must be blocked');
  assert.equal(marketingRemaining(biz), 0);
});

check("the user's worked example: 2 R&D + 3 Ops + 1 Sales = 6 upgrades -> 12 campaigns", () => {
  const biz = freshBusiness({ rndCount: 2, opsLevel: 3, salesLevel: 1 });
  assert.equal(marketingAllowance(biz), 12);
});

check('0 upgrades -> 2, 3 upgrades -> 6, 6 upgrades -> 12', () => {
  assert.equal(marketingAllowance(freshBusiness()), 2);
  assert.equal(marketingAllowance(freshBusiness({ salesLevel: 3 })), 6);
  assert.equal(marketingAllowance(freshBusiness({ salesLevel: 3, opsLevel: 3 })), 12);
});

check('expired campaigns do NOT free up room (the exploit stays closed)', () => {
  let biz = freshBusiness();
  biz = applyUpgrade(biz, 'marketing', 1).business;
  biz = applyUpgrade(biz, 'marketing', 1).business;
  // Simulate month-end pruning every expired boost away.
  biz = { ...biz, tempBoosts: [] };
  assert.equal(marketingCampaignsUsed(biz), 2, 'the lifetime counter must survive pruning');
  assert.equal(canUpgradeTrack(biz, 'marketing'), false);
});

check('buying other tracks unlocks exactly the promised number of campaigns', () => {
  let biz = freshBusiness();
  biz = applyUpgrade(biz, 'marketing', 1).business;
  biz = applyUpgrade(biz, 'marketing', 1).business;
  assert.equal(canUpgradeTrack(biz, 'marketing'), false);
  const needed = upgradesNeededForNextCampaign(biz);
  // The advice the UI/error gives must actually be true: buying that many
  // other upgrades has to genuinely re-open Marketing.
  let stepped = biz;
  for (let i = 0; i < needed - 1; i++) {
    stepped = applyUpgrade(stepped, 'ops', 1).business;
    assert.equal(canUpgradeTrack(stepped, 'marketing'), false, 'must still be blocked before the promised count');
  }
  stepped = applyUpgrade(stepped, 'ops', 1).business;
  assert.equal(canUpgradeTrack(stepped, 'marketing'), true, 'must be unblocked after the promised count');
  assert.equal(marketingRemaining(stepped), MARKETING_CAMPAIGNS_PER_UPGRADE);
});

check('a save made before the cap existed is frozen, not retroactively punished', () => {
  // An old business with 9 stacked campaigns and no other upgrades: the new
  // rule blocks further campaigns but must not throw or go negative.
  const legacy = freshBusiness({ marketingCount: undefined, tempBoosts: Array.from({ length: 9 }, () => ({ amount: 5, expiresMonth: 99 })) });
  assert.equal(marketingCampaignsUsed(legacy), 9);
  assert.equal(marketingRemaining(legacy), 0);
  assert.equal(canUpgradeTrack(legacy, 'marketing'), false);
  assert.ok(upgradesNeededForNextCampaign(legacy) >= 1);
});

check('actions.upgradeBusiness allows the monthly upkeep campaign, then blocks with a helpful reason', () => {
  const state = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
  let s = { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, cash: 99999, skillTokens: 9 } : p)) };
  s = startBusiness(s, 'p1').state;
  const bizId = s.players[0].businesses[0].id;
  s = upgradeBusiness(s, 'p1', bizId, 'marketing').state;
  s = upgradeBusiness(s, 'p1', bizId, 'marketing').state;

  // Allowance spent — but the monthly upkeep campaign is always available.
  const upkeep = upgradeBusiness(s, 'p1', bizId, 'marketing');
  assert.equal(upkeep.ok, true, 'the upkeep campaign must go through');
  assert.match(upkeep.logEntry.message, /upkeep campaign/);
  s = upkeep.state;

  // ...but only once in the same month.
  const blocked = upgradeBusiness(s, 'p1', bizId, 'marketing');
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /upkeep campaign this month/);
  assert.equal(blocked.state.players[0].cash, s.players[0].cash, 'a blocked upgrade must not charge the player');

  // Next month it's available again.
  const nextMonth = upgradeBusiness({ ...s, month: s.month + 1 }, 'p1', bizId, 'marketing');
  assert.equal(nextMonth.ok, true, 'a new month must bring a new upkeep campaign');
});

check('the AI is bound by the same cap (it builds candidates through canUpgradeTrack)', () => {
  // Give a robot an enormous cash pile and a business, then run many turns.
  // Because aiEngine builds its upgrade candidates via canUpgradeTrack, no
  // amount of money can push it past the allowance.
  let s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
  const botId = s.players[1].id;
  s = { ...s, players: s.players.map((p) => (p.id === botId ? { ...p, cash: 500000, skillTokens: 9 } : p)) };
  s = startBusiness(s, botId).state;
  for (let i = 0; i < 40; i++) {
    s = gameReducer({ ...s, activePlayerIndex: 1, status: 'playing' }, { type: 'RUN_AI_TURN', playerId: botId });
    if (s.status !== 'playing') s = { ...s, status: 'playing' };
  }
  for (const biz of s.players.find((p) => p.id === botId).businesses) {
    assert.ok(
      marketingCampaignsUsed(biz) <= marketingAllowance(biz),
      `bot exceeded the cap on ${biz.name}: ${marketingCampaignsUsed(biz)} > ${marketingAllowance(biz)}`
    );
  }
});

check('a fully-built business can always still be tended (the decline deadlock)', () => {
  // Sales 3/3, Ops 3/3, R&D 2/2 — every permanent track maxed — and all 16
  // earned campaigns spent. Without the upkeep rule there would be no legal
  // purchase left, and this business would decline forever with no remedy.
  const maxed = freshBusiness({ salesLevel: 3, opsLevel: 3, rndCount: 2, marketingCount: 16 });
  assert.equal(marketingAllowance(maxed), 16);
  assert.equal(marketingRemaining(maxed), 0);
  for (const track of ['sales', 'ops', 'rnd']) {
    assert.equal(canUpgradeTrack(maxed, track, 5), false, `${track} should be maxed`);
  }
  assert.equal(canUpgradeTrack(maxed, 'marketing', 5), true, 'upkeep must keep the business tendable');
});

check('the upkeep campaign resets the decline clock but never spends allowance', () => {
  let biz = freshBusiness({ salesLevel: 1, marketingCount: 2, lastTendedMonth: 1 });
  assert.equal(marketingRemaining(biz), 0);
  assert.equal(marketingUpkeepAvailable(biz, 9), true);

  const before = marketingCampaignsUsed(biz);
  biz = applyUpgrade(biz, 'marketing', 9).business;

  assert.equal(biz.lastTendedMonth, 9, 'upkeep must reset the neglect clock — that is its whole purpose');
  assert.equal(marketingCampaignsUsed(biz), before, 'upkeep must NOT eat earned campaign allowance');
  assert.equal(biz.lastMarketingUpkeepMonth, 9);
  assert.equal(biz.tempBoosts.length, 1, 'upkeep still pays a real boost');
});

check('upkeep is once per MONTH, so it cannot restore the stacking exploit', () => {
  // The exploit was stacking an unbounded number of campaigns inside one
  // turn to spike revenue right before a buyout. Replay a whole turn's worth
  // of attempts in a single month against the real guard: exactly one gets
  // through, no matter how many times it is tried or how much cash exists.
  let biz = freshBusiness({ marketingCount: 2 });
  let bought = 0;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (!canUpgradeTrack(biz, 'marketing', 4)) continue;
    biz = applyUpgrade(biz, 'marketing', 4).business;
    bought += 1;
  }
  assert.equal(bought, 1, `one upkeep campaign per month, got ${bought}`);

  // And across a long game, the number of boosts that can ever be live at
  // once from upkeep alone is bounded by how long a campaign lasts.
  let running = freshBusiness({ marketingCount: 2 });
  for (let month = 1; month <= 24; month++) {
    if (canUpgradeTrack(running, 'marketing', month)) running = applyUpgrade(running, 'marketing', month).business;
    running = pruneExpiredBoosts(running, month);
    assert.ok(
      (running.tempBoosts || []).length <= MARKETING_BOOST_MONTHS,
      `too many live boosts in month ${month}: ${(running.tempBoosts || []).length}`
    );
  }
});

check('a robot uses upkeep too, and still never exceeds its earned allowance', () => {
  let s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
  const botId = s.players[1].id;
  s = { ...s, players: s.players.map((p) => (p.id === botId ? { ...p, cash: 500000, skillTokens: 9 } : p)) };
  s = startBusiness(s, botId).state;
  // Walk the months forward so upkeep genuinely refreshes, the way real
  // play does, rather than hammering a single month.
  for (let month = 1; month <= 12; month++) {
    s = { ...s, month, activePlayerIndex: 1, status: 'playing' };
    s = gameReducer(s, { type: 'RUN_AI_TURN', playerId: botId });
    if (s.status !== 'playing') s = { ...s, status: 'playing' };
  }
  for (const biz of s.players.find((p) => p.id === botId).businesses) {
    assert.ok(
      marketingCampaignsUsed(biz) <= marketingAllowance(biz),
      `bot exceeded its earned allowance on ${biz.name}: ${marketingCampaignsUsed(biz)} > ${marketingAllowance(biz)}`
    );
  }
});

// --- 2. Hold-to-repeat guard ----------------------------------------------
console.log('\nHold-to-repeat guard on investment buttons');

check('repeating an upgrade stops exactly at the cap instead of erroring', () => {
  // useHoldRepeat re-checks canFire() before EVERY tick; the button's
  // canFire is `!capped && affordable`, i.e. canUpgradeTrack + cash. Replay
  // that loop against the real functions.
  let biz = freshBusiness();
  let cash = 100000;
  let bought = 0;
  const cost = 75;
  while (canUpgradeTrack(biz, 'marketing') && cash >= cost) {
    biz = applyUpgrade(biz, 'marketing', 1).business;
    cash -= cost;
    bought += 1;
    assert.ok(bought < 100, 'repeat loop must terminate');
  }
  assert.equal(bought, MARKETING_FREE_CAMPAIGNS);
});

check('repeating Sales stops at its own level cap', () => {
  let biz = freshBusiness();
  let bought = 0;
  while (canUpgradeTrack(biz, 'sales')) {
    biz = applyUpgrade(biz, 'sales', 1).business;
    bought += 1;
    assert.ok(bought < 100, 'repeat loop must terminate');
  }
  assert.equal(bought, 3);
});

// --- 3. Piggy Bank interest ------------------------------------------------
console.log('\nPiggy Bank interest');

const piggy = ASSETS.find((a) => a.id === 'piggy');

check('the Piggy Bank is flagged interest-bearing', () => {
  assert.equal(piggy.interestBearing, true);
});

check('rolled rates always land in the normal or bonus band, and bonuses occur', () => {
  let bonusMonths = 0;
  const weather = { stageId: 'sunnyBoom', monthsLeft: 2 };
  for (let i = 0; i < 3000; i++) {
    const rolled = rollMonthlyIncomeAmounts(weather);
    const rate = rolled.interestRates.piggy;
    const bonus = rolled.interestBonus.piggy;
    if (bonus) {
      bonusMonths += 1;
      assert.ok(rate >= PIGGY_BONUS_PCT_MIN && rate <= PIGGY_BONUS_PCT_MAX, `bonus rate out of band: ${rate}`);
    } else {
      assert.ok(rate >= PIGGY_INTEREST_PCT_MIN && rate <= PIGGY_INTEREST_PCT_MAX, `rate out of band: ${rate}`);
    }
  }
  // ~12% of 3000 months; a wide window, just proving bonuses are neither
  // impossible nor constant.
  assert.ok(bonusMonths > 200 && bonusMonths < 600, `bonus months looked wrong: ${bonusMonths}`);
});

check('per-unit interest scales with the live price, not the base price', () => {
  const amounts = { interestRates: { piggy: 0.004 }, interestBonus: { piggy: false } };
  assert.equal(perUnitIncome(piggy, { price: 50, weatherIncomeAmounts: amounts }), 0.2);
  assert.equal(perUnitIncome(piggy, { price: 100, weatherIncomeAmounts: amounts }), 0.4);
});

check('interest reaches passive income (and so payday) for a saver', () => {
  const amounts = { interestRates: { piggy: 0.005 }, interestBonus: { piggy: false } };
  const saver = {
    holdings: { piggy: 200, lemonade: 0, treehouse: 0, treasure: 0 },
    businesses: [],
    passiveBonus: 0,
  };
  const breakdown = passiveIncomeBreakdown(saver, {
    allPlayers: [saver],
    prices: { piggy: 50, lemonade: 75, treehouse: 250, treasure: 400 },
    month: 3,
    weatherIncomeAmounts: amounts,
  });
  // 200 units x $50 x 0.5% = $50/mo.
  assert.equal(breakdown.assetIncome, 50);
  assert.equal(breakdown.total, 50);
});

check('a player with no roll yet still sees a sane rate rather than 0%', () => {
  const rate = interestRateFor(piggy, undefined);
  assert.ok(rate >= PIGGY_INTEREST_PCT_MIN && rate <= PIGGY_INTEREST_PCT_MAX);
});

check('interest stays small — a piggy-only strategy cannot outrun a business', () => {
  // Worst case for balance: the maximum bonus rate, every month.
  const monthlyOnAThousandDollars = 1000 * PIGGY_BONUS_PCT_MAX;
  assert.ok(monthlyOnAThousandDollars < 35, `too generous: $${monthlyOnAThousandDollars}/mo on $1,000`);
});

// --- 4. Business launch art ------------------------------------------------
console.log('\nStartup launch art');

check('all 500 business names resolve to art, and almost none fall back', () => {
  let fallbacks = 0;
  for (const name of BUSINESS_NAMES) {
    const art = businessArt(name);
    assert.ok(art.hero && art.props.length === 2 && art.from && art.to, `bad art for ${name}`);
    if (art.hero === '🏪' && art.props[0] === '📈') fallbacks += 1;
  }
  assert.equal(fallbacks, 0, `${fallbacks} names fell back to the generic storefront`);
});

check('specific trades beat generic words inside the same name', () => {
  assert.equal(businessArt("Doodle's Zippy Cookie Company").hero, '🍪'); // not 'company'
  assert.equal(businessArt("Coach Fifi's Kayak Rental").hero, '🛶'); // not 'rental'
  assert.equal(businessArt('The Speedy Penguin Snowman Building').hero, '⛄'); // not 'building'
  assert.equal(businessArt("Auntie Betty's Bakery").hero, '🧁');
});

check('a human starting a business queues a launch celebration; a bot does not', () => {
  let s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
  s = { ...s, players: s.players.map((p) => ({ ...p, cash: 9999, skillTokens: 5 })) };
  const afterHuman = gameReducer(s, { type: 'START_BUSINESS', playerId: 'p1' });
  assert.ok(afterHuman.pendingLaunch, 'a human launch must be recorded');
  assert.equal(afterHuman.pendingLaunch.playerId, 'p1');
  assert.ok(afterHuman.pendingLaunch.income > 0);
  assert.equal(afterHuman.pendingLaunch.businessName, afterHuman.players[0].businesses[0].name);

  const cleared = gameReducer(afterHuman, { type: 'ACK_STARTUP_LAUNCH' });
  assert.equal(cleared.pendingLaunch, null);

  const botId = s.players[1].id;
  const afterBot = gameReducer(s, { type: 'START_BUSINESS', playerId: botId });
  assert.ok(!afterBot.pendingLaunch, 'a robot launch must NOT stop the table');
});

// --- 5. The bonus-interest callout actually reaches the event log ----------
// Appended as its own section because it needs a seeded RNG to force the
// ~12% branch deterministically rather than hoping for it.
console.log('\nBonus-interest month callout');

const { seedRng } = await import('../src/game/rng.js');
const { endTurn } = await import('../src/game/turnEngine.js');

check('a bonus month is logged when someone holds the asset, and only then', () => {
  // The ~12% bonus branch is environment-random, so rather than predicting
  // which seed produces one (month-end consumes several environment draws
  // before the interest roll — see turnEngine's beginMonthEnd), just play a
  // real month under successive seeds until one lands.
  function playOneMonth(seed, piggyHeld) {
    seedRng(seed);
    let s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
    s = {
      ...s,
      activePlayerIndex: s.players.length - 1,
      players: s.players.map((p, i) => (i === 0 ? { ...p, holdings: { ...p.holdings, piggy: piggyHeld } } : p)),
    };
    return endTurn(s, s.players[s.players.length - 1].id).logEntries;
  }

  let bonusSeed = null;
  for (let seed = 1; seed < 800 && bonusSeed === null; seed++) {
    if (playOneMonth(seed, 10).some((e) => e.kind === 'interestBonus')) bonusSeed = seed;
  }
  assert.notEqual(bonusSeed, null, 'no bonus month found in 800 seeded plays — is the callout wired up?');

  const entry = playOneMonth(bonusSeed, 10).find((e) => e.kind === 'interestBonus');
  assert.match(entry.message, /bonus rate/i);
  assert.match(entry.message, /\d+\.\d+%/, 'the callout must quote the actual rate');

  assert.ok(
    !playOneMonth(bonusSeed, 0).some((e) => e.kind === 'interestBonus'),
    'a table where nobody saves must not be told about a rate nobody earns'
  );
});

// --- 6. Play speed, stepped robot turns, and Quick Play --------------------
console.log('\nPacing and Quick Play');

const { PLAY_SPEEDS, DEFAULT_PLAY_SPEED_ID, getPlaySpeedConfig, playSpeedIndex } = await import(
  '../src/game/playSpeed.js'
);
const { rollQuickPlaySetup } = await import('../src/game/quickPlay.js');
const { runAiStep, aiMaxSteps } = await import('../src/game/aiEngine.js');
const { SCENARIOS, DIFFICULTIES, MAX_AI_PLAYERS } = await import('../src/data/gameConfig.js');

check('speeds are ordered slowest-to-fastest on every delay the slider controls', () => {
  const keys = ['aiStepMs', 'turnHandoffMs', 'recapAdvanceMs', 'spotlightMs'];
  for (const key of keys) {
    for (let i = 1; i < PLAY_SPEEDS.length; i++) {
      assert.ok(
        PLAY_SPEEDS[i][key] < PLAY_SPEEDS[i - 1][key],
        `${key} must decrease as the slider moves right: ${PLAY_SPEEDS[i - 1].id} -> ${PLAY_SPEEDS[i].id}`
      );
    }
  }
  // Every speed must actually pause. A zero would turn the stepped robot
  // turn back into the instant burst this whole feature replaced.
  for (const speed of PLAY_SPEEDS) {
    for (const key of keys) assert.ok(speed[key] > 0, `${speed.id}.${key} must be a real pause`);
  }
});

check('the default sits mid-slider, one notch slower than the old pace', () => {
  const index = playSpeedIndex(DEFAULT_PLAY_SPEED_ID);
  assert.ok(index > 0 && index < PLAY_SPEEDS.length - 1, 'the default must leave notches in both directions');
  // 'brisk' is documented as "closest to how the game used to play"; the
  // default must be slower than it, i.e. sit to its left.
  assert.ok(index < playSpeedIndex('brisk'), 'the default should be slower than the old pace');
});

check('an unknown or corrupt speed id falls back to the default', () => {
  assert.equal(getPlaySpeedConfig('nonsense').id, DEFAULT_PLAY_SPEED_ID);
  assert.equal(getPlaySpeedConfig(undefined).id, DEFAULT_PLAY_SPEED_ID);
});

check('runAiStep takes exactly one action per call and reports when it is done', () => {
  let s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
  const botId = s.players[1].id;
  s = { ...s, players: s.players.map((p) => (p.id === botId ? { ...p, cash: 4000, skillTokens: 3 } : p)) };

  let steps = 0;
  let logEntries = 0;
  for (let i = 0; i < 200; i++) {
    const before = s;
    const { state: after, logEntry, acted } = runAiStep(s, botId);
    if (!acted) break;
    steps += 1;
    if (logEntry) logEntries += 1;
    assert.notEqual(after, before, 'an action must actually change state');
    s = after;
    if (steps > aiMaxSteps(s.players[1])) break;
  }
  assert.ok(steps > 0, 'a cash-loaded robot should find something to do');
  assert.equal(logEntries, steps, 'every action must produce exactly one log entry to watch');
});

check('stepping a robot turn reaches the same kind of end state as running it whole', () => {
  // Not asserting identical outcomes — both paths consume the shared RNG, so
  // the actual choices legitimately differ. What must hold is that the
  // stepped path terminates on its own and spends money like the whole-turn
  // path does, rather than looping or stalling on the first action.
  function seedState() {
    let s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
    const botId = s.players[1].id;
    return {
      state: { ...s, players: s.players.map((p) => (p.id === botId ? { ...p, cash: 3000, skillTokens: 3 } : p)) },
      botId,
    };
  }

  const { state: whole, botId } = seedState();
  const afterWhole = gameReducer({ ...whole, activePlayerIndex: 1 }, { type: 'RUN_AI_TURN', playerId: botId });

  let { state: stepped } = seedState();
  stepped = { ...stepped, activePlayerIndex: 1 };
  let guard = 0;
  while (!stepped.aiTurnDone) {
    stepped = gameReducer(stepped, { type: 'RUN_AI_STEP', playerId: botId });
    guard += 1;
    assert.ok(guard < 200, 'the stepped turn must terminate');
  }
  assert.ok(guard > 1, 'a funded robot turn should take more than one step to play out');

  const botOf = (s) => s.players.find((p) => p.id === botId);
  assert.ok(botOf(afterWhole).cash < 3000, 'the whole-turn path should spend');
  assert.ok(botOf(stepped).cash < 3000, 'the stepped path should spend too');
  assert.ok(stepped.aiTurnSteps > 0 && stepped.aiTurnSteps <= aiMaxSteps(botOf(stepped)));
});

check('ending a turn clears the stepped-turn bookkeeping for the next player', () => {
  let s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
  s = { ...s, activePlayerIndex: 1, aiTurnSteps: 5, aiTurnDone: true };
  const after = gameReducer(s, { type: 'END_TURN', playerId: s.players[1].id });
  assert.equal(after.aiTurnSteps, 0);
  assert.equal(after.aiTurnDone, false);
});

check('RUN_AI_STEP is a no-op on a human seat', () => {
  const s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
  assert.equal(gameReducer(s, { type: 'RUN_AI_STEP', playerId: 'p1' }), s);
});

check('Quick Play always rolls a valid, playable setup', () => {
  const scenarioIds = new Set(SCENARIOS.map((x) => x.id));
  const difficultyIds = new Set(DIFFICULTIES.map((x) => x.id));
  const seenScenarios = new Set();
  const seenDifficulties = new Set();

  for (let i = 0; i < 400; i++) {
    const setup = rollQuickPlaySetup({ avatar: '🦊' });
    assert.equal(setup.mode.type, 'solo');
    assert.ok(setup.mode.aiCount >= 1 && setup.mode.aiCount <= MAX_AI_PLAYERS, 'opponent count out of range');
    assert.equal(setup.botConfigs.length, setup.mode.aiCount, 'one config per robot');
    assert.ok(difficultyIds.has(setup.difficultyId));
    assert.ok(scenarioIds.has(setup.options.scenarioId));
    assert.equal(setup.humanNames.length, 1);
    assert.equal(setup.humanNames[0], 'You');
    seenScenarios.add(setup.options.scenarioId);
    seenDifficulties.add(setup.difficultyId);
  }
  // "Randomized" has to mean it actually varies, not that it rolls once.
  assert.equal(seenScenarios.size, SCENARIOS.length, 'every scenario should be reachable from Quick Play');
  assert.equal(seenDifficulties.size, DIFFICULTIES.length, 'every difficulty should be reachable from Quick Play');
});

check('a Quick Play setup actually starts a game', () => {
  const setup = rollQuickPlaySetup({ playerName: '  Michael  ', avatar: '🐼' });
  const started = gameReducer(null, {
    type: 'START_GAME',
    mode: setup.mode,
    humanNames: setup.humanNames,
    difficultyId: setup.difficultyId,
    botConfigs: setup.botConfigs,
    scenarioId: setup.options.scenarioId,
    humanAvatars: setup.options.humanAvatars,
  });
  assert.equal(started.status, 'playing');
  assert.equal(started.players.length, 1 + setup.mode.aiCount);
  assert.equal(started.players[0].name, 'Michael', 'a supplied name should be trimmed and used');
  assert.equal(started.players[0].avatar, '🐼');
  // No two robots at the same table should share a personality.
  const bots = started.players.filter((p) => p.type === 'ai');
  assert.equal(new Set(bots.map((b) => b.personalityId)).size, bots.length);
});

// --- 7. Round 5: cards, balance, weather, timer, chat cooldown -------------
console.log('\nCards, balance, weather and the turn timer');

const { applyCardEffect } = await import('../src/game/decks.js');
const { driftPrices } = await import('../src/game/market.js');
const { normalizeState } = await import('../src/game/persistence.js');
const {
  OPPORTUNITY_DECK,
  SETBACK_DECK,
  WEATHER_SEVERITIES,
  WEATHER_STAGES,
  MAX_PLAYERS,
  TURN_EXTENSIONS_PER_PLAYER,
  BUSINESS_DECLINE_INCOME_FLOOR,
  severityScaled,
} = await import('../src/data/gameConfig.js');
const { businessWeatherPercent, allowanceModifierPercent, businessPauseStatus } = await import(
  '../src/game/players.js'
);

function testPlayer(overrides = {}) {
  return {
    id: 'p1',
    name: 'Tester',
    cash: 1000,
    skillTokens: 1,
    passiveBonus: 0,
    holdings: { piggy: 0, lemonade: 0, treehouse: 0, treasure: 0 },
    businesses: [],
    allowanceMods: [],
    businessPauseUntilMonth: 0,
    ...overrides,
  };
}
const PRICES = { piggy: 50, lemonade: 75, treehouse: 250, treasure: 100 };
const cardById = (id) => [...OPPORTUNITY_DECK, ...SETBACK_DECK].find((c) => c.id === id);

check('no card hands out flat cash for an asset the player does not own', () => {
  // The specific bug: "Tree House Tourists, +$50" used to pay somebody who
  // had never bought a Tree House. Any card whose effects mention an asset
  // must express that through an ownership-scaled effect, not flat cash.
  for (const card of [...OPPORTUNITY_DECK, ...SETBACK_DECK]) {
    const effects = card.effects || (card.effect ? [card.effect] : []);
    const namesAnAsset = effects.some((e) => e.assetId && e.assetId !== 'all');
    if (!namesAnAsset) continue;
    for (const effect of effects) {
      assert.ok(
        effect.type !== 'cash' && effect.type !== 'cashPercent',
        `${card.id} mixes flat cash with an asset-specific effect — a non-owner would be paid for nothing`
      );
    }
  }
});

check('an asset card pays a holder, and explains itself to a non-holder', () => {
  const card = cardById('season-lease'); // per-unit Tree House payout
  const holder = testPlayer({ holdings: { piggy: 0, lemonade: 0, treehouse: 2, treasure: 0 } });
  const paid = applyCardEffect(holder, PRICES, card, 4);
  assert.equal(paid.player.cash, 1000 + 2 * card.effect.amount);
  assert.match(paid.description, /Tree House/);

  const nobody = testPlayer();
  const skipped = applyCardEffect(nobody, PRICES, card, 4);
  assert.equal(skipped.player.cash, 1000, 'a non-owner must not be paid');
  assert.match(skipped.description, /no effect/i);
  assert.notEqual(skipped.description.trim(), '', 'the log line must never be blank');
});

check('a bank failure takes actual units, never below zero, never from a non-saver', () => {
  const card = cardById('bank-fails');
  const saver = testPlayer({ holdings: { piggy: 20, lemonade: 0, treehouse: 0, treasure: 0 } });
  const hit = applyCardEffect(saver, PRICES, card, 4);
  assert.equal(hit.player.holdings.piggy, 20 - Math.ceil(20 * 0.12));
  assert.ok(hit.player.holdings.piggy < 20 && hit.player.holdings.piggy > 0);

  // Rounds away from zero: a small holding still feels it rather than
  // silently rounding down to nothing.
  const small = testPlayer({ holdings: { piggy: 3, lemonade: 0, treehouse: 0, treasure: 0 } });
  assert.equal(applyCardEffect(small, PRICES, card, 4).player.holdings.piggy, 2);

  const none = testPlayer();
  const missed = applyCardEffect(none, PRICES, card, 4);
  assert.equal(missed.player.holdings.piggy, 0);
  assert.match(missed.description, /no effect/i);
});

check('a partnership split halves one business permanently, floored', () => {
  const card = cardById('partner-fallout');
  const owner = testPlayer({
    businesses: [
      { id: 'b1', name: 'Big Co', income: 100 },
      { id: 'b2', name: 'Small Co', income: 20 },
    ],
  });
  const after = applyCardEffect(owner, PRICES, card, 4).player;
  assert.equal(after.businesses[0].income, 50, 'hits the most valuable business');
  assert.equal(after.businesses[1].income, 20, 'leaves the others alone');

  // Never reduces a business to nothing.
  const tiny = testPlayer({ businesses: [{ id: 'b1', name: 'Tiny', income: BUSINESS_DECLINE_INCOME_FLOOR }] });
  const floored = applyCardEffect(tiny, PRICES, card, 4).player;
  assert.equal(floored.businesses[0].income, BUSINESS_DECLINE_INCOME_FLOOR);

  const noBusiness = applyCardEffect(testPlayer(), PRICES, card, 4);
  assert.match(noBusiness.description, /no effect/i);
});

check('equipment failure zeroes business income for exactly one payday', () => {
  const card = cardById('equipment-failure');
  const owner = testPlayer({ businesses: [{ id: 'b1', name: 'Co', income: 100 }] });
  // The card resolves during month 5's month-end, AFTER month 5's payday and
  // just before the calendar advances — so the first payday it can affect is
  // month 6's, and it must affect only that one. (Nothing ever renders at
  // month 5 after this point: turnEngine advances `state.month` to 6 in the
  // same resolution pass.)
  const after = applyCardEffect(owner, PRICES, card, 5).player;
  const pause = businessPauseStatus(after, 6);
  assert.ok(pause, 'the next payday must be paused');
  assert.equal(pause.monthsLeft, 1, 'and it must report exactly one month left');
  assert.equal(businessPauseStatus(after, 7), null, 'and only that one');

  const paused = passiveIncomeBreakdown(after, { allPlayers: [after], prices: PRICES, month: 6 });
  assert.equal(paused.businessIncome, 0);
  const resumed = passiveIncomeBreakdown(after, { allPlayers: [after], prices: PRICES, month: 7 });
  assert.equal(resumed.businessIncome, 100);
});

check('allowance modifiers stack and expire', () => {
  const card = cardById('route-lost'); // -50% for 2 months
  const p = applyCardEffect(testPlayer(), PRICES, card, 3).player;
  assert.equal(allowanceModifierPercent(p, 4), -50);
  assert.equal(allowanceModifierPercent(p, 5), -50);
  assert.equal(allowanceModifierPercent(p, 6), 0, 'must expire on its own');

  const doubled = applyCardEffect(p, PRICES, card, 3).player;
  assert.equal(allowanceModifierPercent(doubled, 4), -100, 'two overlapping modifiers stack');
});

check('a full month-end applies allowance and pause shocks to real cash', () => {
  let s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
  const allowance = s.monthlyAllowance;
  const month = s.month;
  s = {
    ...s,
    activePlayerIndex: s.players.length - 1,
    players: s.players.map((p, i) =>
      i === 0
        ? {
            ...p,
            cash: 0,
            businesses: [{ id: 'b1', name: 'Co', income: 100, tempBoosts: [], pendingRnd: [] }],
            allowanceMods: [{ percent: -50, expiresMonth: month }],
            businessPauseUntilMonth: month,
          }
        : p
    ),
  };
  const after = endTurn(s, s.players[s.players.length - 1].id).state;
  const me = after.players[0];
  const payday = (me.ledger || []).find((e) => e.source === 'Payday');
  assert.ok(payday, 'a payday entry must exist');
  assert.match(payday.detail, /-50% this month/);
  assert.match(payday.detail, /business income paused/);
  // Halved allowance, zero business income. Asset income is 0 (owns nothing)
  // and there's no card bonus, so payday is exactly the halved allowance.
  assert.equal(payday.amount, Math.round(allowance * 0.5));
  assert.equal(me.allowanceMods.length, 0, 'the expired modifier is pruned after payday');
});

check('weather now moves business revenue, scaled by the chosen severity', () => {
  const storm = { stageId: 'stormyBust', monthsLeft: 2 };
  const gentle = rollMonthlyIncomeAmounts(storm, 'gentle');
  const severe = rollMonthlyIncomeAmounts(storm, 'severe');
  assert.ok(businessWeatherPercent(gentle) < 0, 'a storm must hurt business revenue');
  assert.ok(
    businessWeatherPercent(severe) < businessWeatherPercent(gentle),
    'severe weather must hurt more than gentle'
  );

  const boom = rollMonthlyIncomeAmounts({ stageId: 'sunnyBoom', monthsLeft: 2 }, 'severe');
  assert.ok(businessWeatherPercent(boom) > 0, 'a boom must help');

  // And it must reach actual income.
  const owner = testPlayer({ businesses: [{ id: 'b1', name: 'Co', income: 100 }] });
  const context = { allPlayers: [owner], prices: PRICES, month: 3 };
  const stormy = passiveIncomeBreakdown(owner, { ...context, weatherIncomeAmounts: severe });
  const sunny = passiveIncomeBreakdown(owner, { ...context, weatherIncomeAmounts: boom });
  assert.ok(stormy.businessIncome < 100 && sunny.businessIncome > 100);
  // No weather info at all (an old save) must behave exactly as before.
  assert.equal(passiveIncomeBreakdown(owner, context).businessIncome, 100);
});

check('severity scales price moves without ever flipping their direction', () => {
  for (const stageId of Object.keys(WEATHER_STAGES)) {
    const drift = WEATHER_STAGES[stageId].marketDrift;
    for (const severity of WEATHER_SEVERITIES) {
      const scaled = severityScaled(drift, severity.id);
      assert.equal(Math.sign(scaled), Math.sign(drift), `${stageId}/${severity.id} flipped direction`);
      assert.ok(Math.abs(scaled) <= Math.abs(drift) * 2.5 + 1e-9);
    }
  }
  // A severe storm must actually move prices further than a gentle one.
  const prices = { piggy: 50, lemonade: 75, treehouse: 250, treasure: 100 };
  const storm = { stageId: 'stormyBust', monthsLeft: 2 };
  let gentleTotal = 0;
  let severeTotal = 0;
  for (let i = 0; i < 400; i++) {
    gentleTotal += driftPrices(prices, storm, 'gentle').prices.treasure;
    severeTotal += driftPrices(prices, storm, 'severe').prices.treasure;
  }
  assert.ok(severeTotal < gentleTotal, 'severe storms must drag prices down harder on average');
});

check('lemonade income is skewed low but can still surge', () => {
  const sunny = { stageId: 'sunnyBoom', monthsLeft: 2 };
  const [min, max] = ASSETS.find((a) => a.id === 'lemonade').weatherIncomeRange.sunnyBoom;
  const rolls = [];
  for (let i = 0; i < 4000; i++) rolls.push(rollMonthlyIncomeAmounts(sunny, 'normal').lemonade);
  const mean = rolls.reduce((a, b) => a + b, 0) / rolls.length;
  const midpoint = (min + max) / 2;
  assert.ok(rolls.every((v) => v >= min && v <= max), 'every roll must stay in range');
  assert.ok(mean < midpoint, `typical month must sit below the midpoint (mean ${mean.toFixed(1)} vs ${midpoint})`);
  assert.ok(rolls.some((v) => v >= max - 1), 'the surge must still be reachable');
  // The old uniform average was ~26/mo on a $75 asset. Anything near that is
  // a regression back to lemonade dominating every other asset.
  assert.ok(mean < 21, `still too generous: mean ${mean.toFixed(1)}`);
});

check('buyout offers ignore temporary marketing boosts', () => {
  // A business with a big live campaign must be valued the same as one
  // without — otherwise a campaign bought the turn before an offer inflates
  // the payout by twelve times the multiplier.
  const withBoost = {
    id: 'b1',
    name: 'Co',
    income: 100,
    tempBoosts: [{ amount: 90, expiresMonth: 99 }],
    pendingRnd: [],
  };
  const players = [{ id: 'p1', type: 'human', businesses: [withBoost] }];
  let sawOffer = false;
  for (let seed = 1; seed <= 300 && !sawOffer; seed++) {
    seedRng(seed);
    const exit = rollBusinessExit(players);
    if (!exit) continue;
    sawOffer = true;
    assert.equal(exit.income, 100, 'valuation must use permanent income only');
    assert.equal(exit.annualIncome, 1200);
    assert.equal(exit.payout, 1200 * exit.multiplier);
  }
  assert.ok(sawOffer, 'no offer fired in 300 seeded attempts');
});

check('repeated trades collapse into one growing log line', () => {
  let s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
  s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, cash: 100000 } : p)) };
  const before = s.log.length;
  for (let i = 0; i < 20; i++) s = gameReducer(s, { type: 'BUY_ASSET', playerId: 'p1', assetId: 'piggy', qty: 1 });
  for (let i = 0; i < 5; i++) s = gameReducer(s, { type: 'BUY_ASSET', playerId: 'p1', assetId: 'lemonade', qty: 1 });
  // Interleave, to prove it merges across the turn and not just consecutively.
  s = gameReducer(s, { type: 'BUY_ASSET', playerId: 'p1', assetId: 'piggy', qty: 1 });

  const added = s.log.slice(before);
  assert.equal(added.length, 2, `26 purchases should read as 2 lines, got ${added.length}`);
  const piggyLine = added.find((e) => e.kind === 'buy_piggy');
  assert.equal(piggyLine.qty, 21);
  assert.match(piggyLine.message, /bought 21 Piggy Banks/);
  assert.equal(s.players[0].holdings.piggy, 21, 'every purchase still actually happened');

  // A different seat's identical purchase must NOT merge into it.
  const otherSeat = gameReducer({ ...s, activePlayerIndex: 1 }, {
    type: 'BUY_ASSET',
    playerId: s.players[1].id,
    assetId: 'piggy',
    qty: 1,
  });
  assert.equal(otherSeat.log.length, s.log.length + 1);
});

check('the turn timer only runs for the seat on the clock', () => {
  let s = createNewGame({ type: 'hotseat', humanCount: 2 }, ['A', 'B'], undefined, [], undefined, [], {
    turnTimer: true,
  });
  assert.ok(s.turnTimer, 'the timer must be recorded in game state, not a device setting');
  assert.equal(s.turnDeadlineAt, null);

  const deadline = 1000000;
  s = gameReducer(s, { type: 'START_TURN_TIMER', deadlineAt: deadline });
  assert.equal(s.turnDeadlineAt, deadline);
  // A second start must not silently hand out more time.
  s = gameReducer(s, { type: 'START_TURN_TIMER', deadlineAt: deadline + 99999 });
  assert.equal(s.turnDeadlineAt, deadline);

  // Only the active seat can spend an extension.
  const before = s.players[1].turnExtensionsLeft;
  const wrongSeat = gameReducer(s, { type: 'EXTEND_TURN', playerId: s.players[1].id, now: deadline - 5000 });
  assert.equal(wrongSeat.players[1].turnExtensionsLeft, before, 'a player off the clock cannot extend');
  assert.equal(wrongSeat.turnDeadlineAt, deadline);

  const extended = gameReducer(s, { type: 'EXTEND_TURN', playerId: s.players[0].id, now: deadline - 5000 });
  assert.ok(extended.turnDeadlineAt > deadline, 'the clock must actually move');
  assert.equal(extended.players[0].turnExtensionsLeft, TURN_EXTENSIONS_PER_PLAYER - 1);
});

check('extensions run out after the allowance, per player', () => {
  let s = createNewGame({ type: 'hotseat', humanCount: 2 }, ['A', 'B'], undefined, [], undefined, [], {
    turnTimer: true,
  });
  s = gameReducer(s, { type: 'START_TURN_TIMER', deadlineAt: 1000 });
  for (let i = 0; i < TURN_EXTENSIONS_PER_PLAYER; i++) {
    s = gameReducer(s, { type: 'EXTEND_TURN', playerId: 'p1', now: 1000 });
  }
  assert.equal(s.players[0].turnExtensionsLeft, 0);
  const denied = gameReducer(s, { type: 'EXTEND_TURN', playerId: 'p1', now: 1000 });
  assert.match(denied.lastError || '', /extensions left/i);
  // The other player's pool is untouched — it's per player, not per table.
  assert.equal(denied.players[1].turnExtensionsLeft, TURN_EXTENSIONS_PER_PLAYER);
});

check('ending a turn clears the clock for the next seat', () => {
  let s = createNewGame({ type: 'hotseat', humanCount: 2 }, ['A', 'B'], undefined, [], undefined, [], {
    turnTimer: true,
  });
  s = gameReducer(s, { type: 'START_TURN_TIMER', deadlineAt: 1000 });
  const after = gameReducer(s, { type: 'END_TURN', playerId: 'p1' });
  assert.equal(after.turnDeadlineAt, null);
  assert.equal(after.activePlayerIndex, 1);
});

check('a table seats up to MAX_PLAYERS in either mode', () => {
  const hotseat = createNewGame({ type: 'hotseat', humanCount: MAX_PLAYERS }, ['A', 'B', 'C', 'D']);
  assert.equal(hotseat.players.length, MAX_PLAYERS);
  assert.equal(new Set(hotseat.players.map((p) => p.id)).size, MAX_PLAYERS);

  const solo = createNewGame({ type: 'solo', aiCount: MAX_PLAYERS - 1 }, ['You']);
  assert.equal(solo.players.length, MAX_PLAYERS);
  const bots = solo.players.filter((p) => p.type === 'ai');
  assert.equal(new Set(bots.map((b) => b.personalityId)).size, bots.length, 'no duplicate personalities');
  for (const p of solo.players) assert.equal(p.turnExtensionsLeft, TURN_EXTENSIONS_PER_PLAYER);
});

check('END_TURN is idempotent and ignores a stale seat', () => {
  // A repeated dispatch — a double-click, or duplicate delivery once actions
  // are broadcast — used to run month-end twice: two paydays, two card
  // rounds, the calendar jumping two months.
  let s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
  const last = s.players[s.players.length - 1].id;
  s = { ...s, activePlayerIndex: s.players.length - 1 };
  const once = gameReducer(s, { type: 'END_TURN', playerId: last });
  const twice = gameReducer(once, { type: 'END_TURN', playerId: last });
  assert.equal(twice.month, once.month, 'a repeated END_TURN must not advance the calendar again');
  assert.equal(twice.players[0].cash, once.players[0].cash, 'and must not pay a second time');

  const stale = gameReducer(s, { type: 'END_TURN', playerId: 'nobody' });
  assert.equal(stale.activePlayerIndex, s.activePlayerIndex, 'an unknown seat must not reset the turn order');
});

check('a save from an older build loads and survives a month-end', () => {
  // The exact shape that used to crash: no netWorthHistory, no badgeEvents,
  // no soldBusinesses, no ledger, and a business with no marketingCount.
  const legacy = {
    status: 'playing',
    mode: { type: 'solo', aiCount: 1 },
    month: 3,
    totalMonths: 24,
    monthlyAllowance: 150,
    weather: { stageId: 'sunnyBoom', monthsLeft: 2 },
    assetPrices: { ...PRICES },
    previousAssetPrices: { ...PRICES },
    activePlayerIndex: 1,
    log: [],
    players: [
      {
        id: 'p1',
        name: 'Old',
        avatar: '🦊',
        type: 'human',
        cash: 500,
        skillTokens: 1,
        holdings: { piggy: 2 },
        businesses: [{ id: 'b1', name: 'Old Co', income: 60, tempBoosts: [{ amount: 5, expiresMonth: 99 }] }],
      },
      { id: 'ai1', name: 'Bot', avatar: '🤖', type: 'ai', cash: 500, skillTokens: 1, holdings: {}, businesses: [] },
    ],
  };

  const migrated = normalizeState(legacy);
  assert.deepEqual(migrated.players[0].netWorthHistory, []);
  assert.deepEqual(migrated.players[0].badgeEvents, []);
  assert.equal(migrated.players[0].holdings.treasure, 0, 'missing assets are filled in');
  // The campaign count is recovered from the boost history HERE, before any
  // month-end pruning can destroy it.
  assert.equal(migrated.players[0].businesses[0].marketingCount, 1);

  // The thing that used to throw: resolving a month end.
  const resolved = endTurn(migrated, 'ai1');
  assert.ok(resolved.state.players[0].netWorthHistory.length > 0, 'month-end completed and recorded history');
});

check('a legacy business does not get free campaigns back after pruning', () => {
  const legacy = normalizeState({
    status: 'playing',
    month: 1,
    players: [
      {
        id: 'p1',
        type: 'human',
        cash: 0,
        holdings: {},
        businesses: [
          {
            id: 'b1',
            name: 'Old Co',
            income: 50,
            tempBoosts: [
              { amount: 5, expiresMonth: 2 },
              { amount: 5, expiresMonth: 2 },
            ],
          },
        ],
      },
    ],
  });
  let biz = legacy.players[0].businesses[0];
  assert.equal(marketingCampaignsUsed(biz), 2);
  assert.equal(marketingRemaining(biz), 0);
  // Month-end prunes the expired boosts; the count must survive it.
  biz = pruneExpiredBoosts(biz, 5);
  assert.equal(biz.tempBoosts.length, 0);
  assert.equal(marketingCampaignsUsed(biz), 2, 'pruning must not hand back free campaigns');
  assert.equal(marketingRemaining(biz), 0);
});

const { reactToLogEntries } = await import('../src/game/chatEngine.js');

check('bot chat does not repeat a line within the cooldown window', () => {
  let s = createNewGame({ type: 'solo', aiCount: 2 }, ['Tester']);
  // Drive a long run of the same kind of event and collect what was said.
  const said = [];
  for (let month = 1; month <= 30; month++) {
    for (let seat = 0; seat < s.players.length; seat++) {
      s = { ...s, month, activePlayerIndex: seat };
      const entries = reactToLogEntries(s, [{ kind: 'business', playerId: 'p1' }]);
      if (entries.length > 0) {
        s = { ...s, chat: [...s.chat, ...entries.map((e) => ({ ...e, month }))] };
        for (const e of entries) said.push({ text: e.message, turn: (month - 1) * s.players.length + seat });
      }
    }
  }
  assert.ok(said.length > 8, `not enough chat generated to test (${said.length})`);
  const lastSeen = new Map();
  let violations = 0;
  for (const { text, turn } of said) {
    if (lastSeen.has(text) && turn - lastSeen.get(text) < 6) violations += 1;
    lastSeen.set(text, turn);
  }
  assert.equal(violations, 0, `${violations} lines repeated inside the 6-turn cooldown`);
});

check('chat is generated from the seeded stream, not Math.random', () => {
  // Strip comments first — the file explains at length WHY it doesn't use
  // Math.random, and that explanation shouldn't fail its own test.
  const source = readFileSync(new URL('../src/game/chatEngine.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/Math\.random\(/.test(source),
    'chatEngine must not use Math.random — chat lives in game state and has to be reproducible'
  );
});

// --- 8. Same-turn resale penalty and the sound pools -----------------------
console.log('\nResale penalty and sound variety');

const { SAME_TURN_SELL_PENALTY } = await import('../src/data/gameConfig.js');
const { buyAsset, sellAsset } = await import('../src/game/actions.js');
const { SOUNDS } = await import('../src/audio/soundLibrary.js');

function fundedGame(cash = 100000) {
  const s = createNewGame({ type: 'solo', aiCount: 1 }, ['Tester']);
  return { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, cash } : p)) };
}

check('selling something bought this turn returns 10% less', () => {
  let s = fundedGame();
  const price = s.assetPrices.piggy;
  const cashBefore = s.players[0].cash;

  s = buyAsset(s, 'p1', 'piggy', 4).state;
  const spent = cashBefore - s.players[0].cash;
  const sold = sellAsset(s, 'p1', 'piggy', 4);
  s = sold.state;

  const back = s.players[0].cash - (cashBefore - spent);
  const expected = Math.round(price * 4) - Math.round(price * 4 * SAME_TURN_SELL_PENALTY);
  assert.equal(back, expected, 'the penalty must come off the proceeds');
  assert.ok(back < spent, 'a round trip inside one turn must never be free');
  assert.match(sold.logEntry.message, /resale fee/);
});

check('units held since an earlier turn sell at full price', () => {
  let s = fundedGame();
  const price = s.assetPrices.piggy;
  s = buyAsset(s, 'p1', 'piggy', 5).state;
  // Move to a later turn. The tally is stamped with the turn it belongs to,
  // so it goes stale on its own rather than needing to be reset.
  s = { ...s, month: s.month + 1 };

  const cashBefore = s.players[0].cash;
  const sold = sellAsset(s, 'p1', 'piggy', 5);
  assert.equal(sold.state.players[0].cash - cashBefore, Math.round(price * 5), 'no penalty on an older holding');
  assert.ok(!/resale fee/.test(sold.logEntry.message));
});

check('a mixed sale penalises only the units bought this turn', () => {
  let s = fundedGame();
  const price = s.assetPrices.piggy;
  s = buyAsset(s, 'p1', 'piggy', 6).state; // held from earlier
  s = { ...s, month: s.month + 1 };
  s = buyAsset(s, 'p1', 'piggy', 2).state; // bought right now

  const cashBefore = s.players[0].cash;
  s = sellAsset(s, 'p1', 'piggy', 8).state;
  const back = s.players[0].cash - cashBefore;
  const expected = Math.round(price * 8) - Math.round(price * 2 * SAME_TURN_SELL_PENALTY);
  assert.equal(back, expected);
});

check('the same units cannot be penalised twice', () => {
  let s = fundedGame();
  const price = s.assetPrices.piggy;
  s = buyAsset(s, 'p1', 'piggy', 2).state;
  s = sellAsset(s, 'p1', 'piggy', 2).state; // both penalised, both gone

  // Buy from scratch again in the same turn and sell only one of them: the
  // earlier, already-sold units must not still be sitting in the tally.
  const cashBefore = s.players[0].cash;
  s = buyAsset(s, 'p1', 'piggy', 1).state;
  s = sellAsset(s, 'p1', 'piggy', 1).state;
  const net = s.players[0].cash - cashBefore;
  assert.equal(net, -Math.round(price * SAME_TURN_SELL_PENALTY), 'exactly one unit of penalty, not two');
});

check('every asset has a varied sound pool, and the rare ones stay rare', () => {
  for (const asset of ASSETS) {
    for (const prefix of ['buy_', 'sell_']) {
      const entry = SOUNDS[`${prefix}${asset.id}`];
      assert.equal(typeof entry, 'function', `${prefix}${asset.id} should draw from a pool`);
      const shapes = new Set();
      for (let i = 0; i < 300; i++) {
        const recipe = entry();
        assert.ok(Array.isArray(recipe) && recipe.length > 0, 'every variant must produce notes');
        for (const n of recipe) {
          assert.ok(typeof n.start === 'number' && n.start >= 0, 'a note needs a valid start');
          assert.ok(typeof n.duration === 'number' && n.duration > 0, 'a note needs a real duration');
          assert.ok(n.gain > 0 && n.gain <= 1, `gain out of range: ${n.gain}`);
        }
        shapes.add(recipe.length + ':' + Math.round((recipe[0].freq || 0) / 50));
      }
      assert.ok(shapes.size >= 3, `${prefix}${asset.id} barely varies (${shapes.size} shapes)`);
    }
  }
  assert.ok(Array.isArray(SOUNDS.buttonPress) && SOUNDS.buttonPress.length > 0, 'the press sound must exist');
  // Punchy means SHORT — this fires on every repeat of a press-and-hold.
  const longest = Math.max(...SOUNDS.buttonPress.map((n) => n.start + n.duration));
  assert.ok(longest <= 0.12, `the button press is too long to repeat (${longest}s)`);
});

console.log(`\nAll ${passed} checks passed.\n`);
