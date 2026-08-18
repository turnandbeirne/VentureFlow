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
  MARKETING_BOOST_AMOUNT,
  MARKETING_BOOST_MONTHS,
  SALES_BOOST_AMOUNT,
  SALES_MAX_LEVEL,
  OPS_DISCOUNT_PER_LEVEL,
  OPS_MAX_LEVEL,
  RND_DELAY_MONTHS,
  RND_MAX_PROJECTS,
  RND_BIG_PAYOFF_CHANCE,
  RND_BIG_PAYOFF_AMOUNT,
  RND_SMALL_PAYOFF_AMOUNT,
} from '../data/gameConfig';
import { chance } from './rng';

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

  if (trackId === 'marketing') {
    const boost = { amount: MARKETING_BOOST_AMOUNT, expiresMonth: currentMonth + MARKETING_BOOST_MONTHS - 1 };
    return {
      business: { ...business, totalInvested, tempBoosts: [...(business.tempBoosts || []), boost] },
      cost,
      description: `ran a Marketing campaign for ${business.name} (+$${MARKETING_BOOST_AMOUNT}/mo for ${MARKETING_BOOST_MONTHS} months)`,
    };
  }
  if (trackId === 'sales') {
    return {
      business: {
        ...business,
        totalInvested,
        salesLevel: (business.salesLevel || 0) + 1,
        income: business.income + SALES_BOOST_AMOUNT,
      },
      cost,
      description: `grew Sales at ${business.name} (+$${SALES_BOOST_AMOUNT}/mo, permanent)`,
    };
  }
  if (trackId === 'ops') {
    return {
      business: { ...business, totalInvested, opsLevel: (business.opsLevel || 0) + 1 },
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
 * resolved ({ big, amount }). There's always SOME payoff — see
 * RND_BIG_PAYOFF_CHANCE — meant to feel like a risk worth taking, not a
 * trap. No-ops (same business back, empty results) if nothing's due yet.
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
    const amount = big ? RND_BIG_PAYOFF_AMOUNT : RND_SMALL_PAYOFF_AMOUNT;
    income += amount;
    results.push({ big, amount });
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
