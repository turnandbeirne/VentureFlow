// ============================================================================
// Player model — factory + selectors
// ============================================================================
import {
  STARTING_CASH,
  STARTING_SKILL_TOKENS,
  ASSETS,
  PLAYER_AVATARS,
  AI_NAMES,
} from '../data/gameConfig';

export function createPlayer({ id, name, avatar, type }) {
  const holdings = {};
  for (const asset of ASSETS) holdings[asset.id] = 0;

  return {
    id,
    name,
    avatar,
    type, // 'human' | 'ai'
    cash: STARTING_CASH,
    holdings, // { assetId: quantity }
    businesses: [], // [{ id, income }]
    skillTokens: STARTING_SKILL_TOKENS,
    passiveBonus: 0, // permanent $/mo from fortune cards
    badges: [], // [badgeId]
    badgeEvents: [], // [{ badgeId, month }] — feeds future VentureScouts export
    turnComplete: false,
  };
}

/** Build the player roster for a given mode config. */
export function createPlayerRoster(mode, humanNames = []) {
  const players = [];
  if (mode.type === 'solo') {
    players.push(createPlayer({ id: 'p1', name: humanNames[0] || 'You', avatar: PLAYER_AVATARS[0], type: 'human' }));
    for (let i = 0; i < mode.aiCount; i++) {
      players.push(
        createPlayer({
          id: `ai${i + 1}`,
          name: AI_NAMES[i] || `Robot ${i + 1}`,
          avatar: '🤖',
          type: 'ai',
        })
      );
    }
  } else if (mode.type === 'hotseat') {
    for (let i = 0; i < mode.humanCount; i++) {
      players.push(
        createPlayer({
          id: `p${i + 1}`,
          name: humanNames[i] || `Player ${i + 1}`,
          avatar: PLAYER_AVATARS[i] || '🙂',
          type: 'human',
        })
      );
    }
  }
  return players;
}

export function assetValue(player, prices) {
  return ASSETS.reduce((sum, asset) => sum + (player.holdings[asset.id] || 0) * prices[asset.id], 0);
}

export function businessValue(player) {
  // Simple valuation: a business is "worth" what you put into it.
  return player.businesses.length * 300;
}

export function netWorth(player, prices) {
  return Math.round(player.cash + assetValue(player, prices) + businessValue(player));
}

export function passiveIncome(player) {
  const rent = ASSETS.filter((a) => a.rentPerMonth > 0).reduce(
    (sum, a) => sum + (player.holdings[a.id] || 0) * a.rentPerMonth,
    0
  );
  const businessIncome = player.businesses.reduce((sum, b) => sum + b.income, 0);
  return rent + businessIncome + (player.passiveBonus || 0);
}
