// ============================================================================
// Business upgrades — Marketing / Sales / Operations / R&D
// ----------------------------------------------------------------------------
// Pure logic for the four ways a player can keep investing in a business
// after starting it (see gameConfig.js's BUSINESS_UPGRADE_TRACKS for the
// costs/flavor and a one-line explanation of why each track behaves
// differently). Nothing here touches game state directly — actions.js's
// upgradeBusiness() calls into this to compute cost/effect, and
// turnEngine.js calls resolvePendingRnd() at month-end.
// ============================================================================
import {
  BUSINESS_UPGRADE_TRACKS,
  MARKETING_BOOST_PCT_MIN,
  MARKETING_BOOST_PCT_MAX,
  MARKETING_BOOST_MONTHS,
  SALES_BOOST_PCT_MIN,
  SALES_BOOST_PCT_MAX,
  SALES_MAX_LEVEL,
  OPS_DISCOUNT_PER_LEVEL,
  OPS_MAX_LEVEL,
  RND_DELAY_MONTHS,
  RND_MAX_PROJECTS,
  RND_BIG_PAYOFF_CHANCE,
  RND_SMALL_PAYOFF_PCT_MIN,
  RND_SMALL_PAYOFF_PCT_MAX,
  RND_BIG_PAYOFF_PCT_MIN,
  RND_BIG_PAYOFF_PCT_MAX,
  BUSINESS_DECLINE_GRACE_MONTHS,
  BUSINESS_DECLINE_WARNING_MONTHS,
  BUSINESS_DECLINE_INTERVAL_MONTHS,
  BUSINESS_DECLINE_PCT_MIN,
  BUSINESS_DECLINE_PCT_MAX,
  BUSINESS_DECLINE_INCOME_FLOOR,
} from '../data/gameConfig';
import { chance, randomFloat } from './rng';

/** A random $ amount that's `pctMin`-`pctMax` of `income`, rounded to a
 * whole dollar — the shared building block behind Marketing, Sales, and
 * R&D's payouts (see the module comment above and gameConfig.js's
 * BUSINESS_UPGRADE_TRACKS comment for why this replaced flat $ amounts).
 * Drawn from the DEFAULT rng stream (player-choice-driven — buying an
 * upgrade is a choice — not the environment stream; see rng.js's module
 * comment). Never rounds to $0 as long as `income` is at least
 * BUSINESS_INCOME_MIN and pctMin stays at its current 0.08 floor. */
function percentOfIncome(income, pctMin, pctMax) {
  const pct = randomFloat(pctMin, pctMax);
  return { amount: Math.round(income * pct), pct };
}

const MAX_OPS_DISCOUNT = 0.9;

/**
 * What buying one more level of `trackId` would currently cost THIS
 * business, after its own Operations discount — Operations makes every
 * OTHER track cheaper for the business it was bought on, but never
 * discounts itself (otherwise it'd be strictly better than every other
 * track, which defeats the point of four distinct choices).
 */
export function upgradeCost(business, trackId) {
  const base = BUSINESS_UPGRADE_TRACKS[trackId]?.cost ?? 0;
  if (trackId === 'ops') return base;
  const discount = Math.min(MAX_OPS_DISCOUNT, (business.opsLevel || 0) * OPS_DISCOUNT_PER_LEVEL);
  return Math.round(base * (1 - discount));
}

/**
 * Whether `trackId` has more room to grow for this business. Sales and
 * Operations cap out at a few levels each (steady, bounded climbs, so
 * income can't spiral); R&D caps at a couple of projects (each is a slow,
 * meaningful bet, not something to spam); Marketing has no cap of its own
 * since every purchase costs real cash and only ever helps for a few
 * months at a time.
 */
export function canUpgradeTrack(business, trackId) {
  if (trackId === 'sales') return (business.salesLevel || 0) < SALES_MAX_LEVEL;
  if (trackId === 'ops') return (business.opsLevel || 0) < OPS_MAX_LEVEL;
  if (trackId === 'rnd') return (business.rndCount || 0) < RND_MAX_PROJECTS;
  if (trackId === 'marketing') return true;
  return false;
}

/**
 * Sum of every currently-active Marketing boost on a business for a given
 * month — this is what game/players.js's businessMonthlyIncome() (and so
 * passiveIncome()/payday) actually reads.
 */
export function activeMarketingBoostTotal(business, month) {
  if (month == null) return 0;
  return (business.tempBoosts || []).reduce((sum, b) => (month <= b.expiresMonth ? sum + b.amount : sum), 0);
}

/**
 * Apply one purchase of `trackId` to a business, returning the updated
 * business object, the cash actually spent (net of the Operations
 * discount), and a short log-friendly description. `currentMonth` is
 * whatever month is currently in play (state.month at the moment of
 * purchase) — Marketing's boost window and R&D's delayed resolution are
 * both anchored to it.
 *
 * Marketing and R&D don't change `income` immediately: Marketing adds a
 * time-boxed boost that businessMonthlyIncome() picks up on its own and
 * that expires on its own; R&D just queues a delayed resolution (see
 * resolvePendingRnd below) — the cash is spent now, but the payoff, big or
 * small but never nothing, lands a couple of months later. That delay is
 * the point: R&D is a slower, less certain bet than Sales.
 */
export function applyUpgrade(business, trackId, currentMonth) {
  const cost = upgradeCost(business, trackId);
  const totalInvested = (business.totalInvested || 0) + cost;
  // Buying ANY upgrade — even just one Marketing campaign — counts as
  // "tending" the business and resets the business-decline clock (see
  // applyBusinessDecline below and gameConfig.js's BUSINESS_DECLINE_*
  // comment). Deliberately stamped at PURCHASE time, not later — an R&D
  // project's eventual payoff (resolvePendingRnd, which runs automatically
  // at month-end with no further player action) does NOT re-stamp it;
  // only an actual decision to invest does.
  const lastTendedMonth = currentMonth;

  if (trackId === 'marketing') {
    // % of the business's current PERMANENT income (business.income) —
    // deliberately NOT including any other still-active Marketing boost,
    // so stacking campaigns can't inflate each other's roll.
    const { amount, pct } = percentOfIncome(business.income, MARKETING_BOOST_PCT_MIN, MARKETING_BOOST_PCT_MAX);
    const boost = { amount, expiresMonth: currentMonth + MARKETING_BOOST_MONTHS - 1 };
    return {
      business: { ...business, totalInvested, lastTendedMonth, tempBoosts: [...(business.tempBoosts || []), boost] },
      cost,
      description: `ran a Marketing campaign for ${business.name} (+$${amount}/mo, ${Math.round(pct * 100)}% of revenue, for ${MARKETING_BOOST_MONTHS} months)`,
    };
  }
  if (trackId === 'sales') {
    // % of current income too, but PERMANENT — and since it's a % of
    // whatever income already includes (prior Sales bumps, R&D payoffs),
    // each successive Sales purchase compounds on a bigger base.
    const { amount, pct } = percentOfIncome(business.income, SALES_BOOST_PCT_MIN, SALES_BOOST_PCT_MAX);
    return {
      business: {
        ...business,
        totalInvested,
        lastTendedMonth,
        salesLevel: (business.salesLevel || 0) + 1,
        income: business.income + amount,
      },
      cost,
      description: `grew Sales at ${business.name} (+$${amount}/mo, ${Math.round(pct * 100)}% increase, permanent)`,
    };
  }
  if (trackId === 'ops') {
    return {
      business: { ...business, totalInvested, lastTendedMonth, opsLevel: (business.opsLevel || 0) + 1 },
      cost,
      description: `streamlined Operations at ${business.name} (future upgrades here cost less)`,
    };
  }
  if (trackId === 'rnd') {
    const resolveMonth = currentMonth + RND_DELAY_MONTHS;
    return {
      business: {
        ...business,
        totalInvested,
        lastTendedMonth,
        rndCount: (business.rndCount || 0) + 1,
        pendingRnd: [...(business.pendingRnd || []), { resolveMonth }],
      },
      cost,
      description: `started an R&D project at ${business.name} (result in ${RND_DELAY_MONTHS} months)`,
    };
  }
  return { business, cost: 0, description: '' };
}

/**
 * Roll and apply every R&D project on `business` whose delay is up as of
 * `month`, returning the updated business plus one result per project that
 * resolved ({ big, amount, pct }). There's always SOME payoff — see
 * RND_BIG_PAYOFF_CHANCE — meant to feel like a risk worth taking, not a
 * trap. Like Marketing/Sales, the payoff is now a % of the business's
 * current income rather than a flat $ figure (see percentOfIncome above);
 * a big payoff draws from a distinctly higher sub-range than a small one
 * so "big" always actually reads as bigger. No-ops (same business back,
 * empty results) if nothing's due yet. If multiple projects resolve in the
 * same call, each one's % is computed against the RUNNING (already-bumped)
 * income, so they compound within the same month too.
 */
export function resolvePendingRnd(business, month) {
  const pending = business.pendingRnd || [];
  const due = pending.filter((p) => p.resolveMonth <= month);
  if (due.length === 0) return { business, results: [] };

  const remaining = pending.filter((p) => p.resolveMonth > month);
  let income = business.income;
  const results = [];
  for (let i = 0; i < due.length; i++) {
    const big = chance(RND_BIG_PAYOFF_CHANCE);
    const { amount, pct } = big
      ? percentOfIncome(income, RND_BIG_PAYOFF_PCT_MIN, RND_BIG_PAYOFF_PCT_MAX)
      : percentOfIncome(income, RND_SMALL_PAYOFF_PCT_MIN, RND_SMALL_PAYOFF_PCT_MAX);
    income += amount;
    results.push({ big, amount, pct });
  }
  return { business: { ...business, income, pendingRnd: remaining }, results };
}

/** Drop any Marketing boosts that have already expired as of `month` — keeps
 * a business's tempBoosts array from growing forever with dead entries.
 * Purely tidying; activeMarketingBoostTotal() already ignores expired ones
 * even without this. */
export function pruneExpiredBoosts(business, month) {
  const tempBoosts = (business.tempBoosts || []).filter((b) => b.expiresMonth >= month);
  if (tempBoosts.length === (business.tempBoosts || []).length) return business;
  return { ...business, tempBoosts };
}

/** How many months it's been since `business` was last purchased an
 * upgrade for (or started, if never upgraded) — the shared basis for both
 * the decline decay below and the UI's health-status coloring. Falls back
 * to `month` itself (i.e. "just tended") for a business saved before either
 * field existed, so an old save doesn't suddenly show as neglected. */
function monthsSinceTended(business, month) {
  const lastTended = business.lastTendedMonth ?? business.startedMonth ?? month;
  return Math.max(0, month - lastTended);
}

/**
 * A business's neglect status for the current month — purely a read, no
 * mutation — for the UI (PlayerDetailModal.jsx) to color a business's name:
 * 'healthy' (nothing to worry about), 'warning' (within
 * BUSINESS_DECLINE_WARNING_MONTHS of decline actually starting — the
 * "yellow name" state), or 'declining' (past the grace period and actively
 * losing income — the "red name" state). `month == null` (context not
 * available) always reads as healthy rather than guessing.
 */
export function businessHealthStatus(business, month) {
  if (month == null) return 'healthy';
  const months = monthsSinceTended(business, month);
  if (months >= BUSINESS_DECLINE_GRACE_MONTHS) return 'declining';
  if (months >= BUSINESS_DECLINE_GRACE_MONTHS - BUSINESS_DECLINE_WARNING_MONTHS) return 'warning';
  return 'healthy';
}

/**
 * Apply one month's worth of neglect decay to `business`, if it's due.
 * Nothing happens until BUSINESS_DECLINE_GRACE_MONTHS have passed with no
 * upgrade purchase (see applyUpgrade's lastTendedMonth stamp above); after
 * that, income takes a random 5%-10% hit every
 * BUSINESS_DECLINE_INTERVAL_MONTHS months — a slow fade, not a monthly
 * cliff, and floored at BUSINESS_DECLINE_INCOME_FLOOR so a neglected
 * business becomes a bad deal, never a worthless one. Rolled on the
 * DEFAULT rng stream, like every other upgrade-adjacent roll (see
 * percentOfIncome above) — whether this fires at all is a direct
 * consequence of the player's own choice not to reinvest, so (unlike
 * weather/cards/business-exits) there's no Daily-Challenge-fairness reason
 * to route it through the environment stream instead; see rng.js's module
 * comment and businessExits.js's for the distinction this is following.
 * Returns `{ business, declined, loss }` — `declined`/`loss` are only
 * meaningful when true/set; the business is returned unchanged (same
 * reference) when nothing happened this month.
 */
export function applyBusinessDecline(business, month) {
  const months = monthsSinceTended(business, month);
  if (months < BUSINESS_DECLINE_GRACE_MONTHS) return { business, declined: false };

  const monthsIntoDecline = months - BUSINESS_DECLINE_GRACE_MONTHS;
  if (monthsIntoDecline % BUSINESS_DECLINE_INTERVAL_MONTHS !== 0) return { business, declined: false };
  if (business.income <= BUSINESS_DECLINE_INCOME_FLOOR) return { business, declined: false };

  const pct = randomFloat(BUSINESS_DECLINE_PCT_MIN, BUSINESS_DECLINE_PCT_MAX);
  const rawLoss = Math.max(1, Math.round(business.income * pct));
  const nextIncome = Math.max(BUSINESS_DECLINE_INCOME_FLOOR, business.income - rawLoss);
  const loss = business.income - nextIncome;
  if (loss <= 0) return { business, declined: false };

  return { business: { ...business, income: nextIncome }, declined: true, loss };
}
