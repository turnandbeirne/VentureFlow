// ============================================================================
// Badge / achievement engine — extensible by design
// ----------------------------------------------------------------------------
// Badge DATA lives in gameConfig.js. This file just knows how to check a
// small set of generic "kind"s against a player's state. Adding a badge
// that fits an existing kind (passiveIncomeAtLeast, businessCountAtLeast,
// assetHoldingAtLeast, ...) requires ZERO changes here — just add an entry
// to BADGES in gameConfig.js.
//
// `badgeEvents` on each player ({ badgeId, month }) is the hook future
// VentureScouts integration can read from to sync earned badges externally
// — see exportBadgeEvents() below.
// ============================================================================
import { BADGES } from '../data/gameConfig';
import { passiveIncome } from './players';

const CHECKERS = {
  passiveIncomeAtLeast: (player, badge, context) => passiveIncome(player, context) >= badge.value,
  businessCountAtLeast: (player, badge) => player.businesses.length >= badge.value,
  assetHoldingAtLeast: (player, badge) => (player.holdings[badge.assetId] || 0) >= badge.value,
};

/**
 * Evaluate all badges for a player, returning a new player object with any
 * newly-earned badges appended (and logged into badgeEvents with the month
 * they were earned). Non-mutating. `context` (optional — { allPlayers,
 * prices }) is passed straight through to passiveIncome() for the
 * passiveIncomeAtLeast check, which now needs to know everyone's Tree House
 * holdings and current prices to compute dynamic rent (see players.js).
 */
export function evaluateBadges(player, month, context = {}) {
  const earnedSet = new Set(player.badges);
  const newlyEarned = [];
  const fullContext = { ...context, month };

  for (const badge of BADGES) {
    if (earnedSet.has(badge.id)) continue;
    const checker = CHECKERS[badge.kind];
    if (!checker) continue;
    if (checker(player, badge, fullContext)) {
      earnedSet.add(badge.id);
      newlyEarned.push(badge);
    }
  }

  if (newlyEarned.length === 0) return { player, newlyEarned };

  return {
    player: {
      ...player,
      badges: Array.from(earnedSet),
      badgeEvents: [
        ...player.badgeEvents,
        ...newlyEarned.map((b) => ({ badgeId: b.id, month })),
      ],
    },
    newlyEarned,
  };
}

/** Registry lookup for rendering (icon/name/description) by id. */
export function getBadgeInfo(badgeId) {
  return BADGES.find((b) => b.id === badgeId);
}

/**
 * Extension point for VentureScouts: flatten a player's badge history into
 * a plain, serializable event list ready to sync/export elsewhere.
 */
export function exportBadgeEvents(player) {
  return player.badgeEvents.map((event) => ({
    playerId: player.id,
    playerName: player.name,
    badgeId: event.badgeId,
    month: event.month,
  }));
}
