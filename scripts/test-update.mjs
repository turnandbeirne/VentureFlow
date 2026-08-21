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
const { SCENARIOS, DIFFICULTIES } = await import('../src/data/gameConfig.js');

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
    assert.ok(setup.mode.aiCount >= 1 && setup.mode.aiCount <= 2, 'opponent count out of range');
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

console.log(`\nAll ${passed} checks passed.\n`);
