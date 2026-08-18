// ============================================================================
// Player model — factory + selectors
// ============================================================================
import {
  STARTING_CASH,
  STARTING_SKILL_TOKENS,
  ASSETS,
  PLAYER_AVATARS,
  BOT_PERSONALITIES,
  SKILL_LEVELS,
  getBotPersonality,
  BUSINESS_COST,
  getDifficulty,
  DEFAULT_DIFFICULTY_ID,
} from '../data/gameConfig';
import { pickRandom } from './rng';

export function createPlayer({
  id,
  name,
  avatar,
  type,
  startingCash = STARTING_CASH,
  startingSkillTokens = STARTING_SKILL_TOKENS,
  personalityId = null,
  strategyId = null,
  skillLevelId = null,
}) {
  const holdings = {};
  const purchaseStats = {};
  for (const asset of ASSETS) {
    holdings[asset.id] = 0;
    purchaseStats[asset.id] = { qty: 0, spent: 0 };
  }

  return {
    id,
    name,
    avatar,
    type, // 'human' | 'ai'
    // Robot-only identity: which named personality this bot is playing as
    // and the strategy/skill that drives its turns (game/aiEngine.js).
    // null for human players. See createPlayerRoster below for how these
    // get assigned at game start.
    personalityId,
    strategyId,
    skillLevelId,
    cash: startingCash,
    holdings, // { assetId: quantity currently owned }
    purchaseStats, // { assetId: { qty, spent } } — lifetime buys, for avg purchase price
    businesses: [], // [{ id, income }]
    skillTokens: startingSkillTokens,
    passiveBonus: 0, // permanent $/mo from fortune cards
    badges: [], // [badgeId]
    badgeEvents: [], // [{ badgeId, month }] — feeds future VentureScouts export
    turnComplete: false,
    scenarioGoalMonth: null, // month this player hit the scenario's objective, if any — see game/scenarios.js
    netWorthHistory: [], // [{ month, netWorth }] — one snapshot per completed month, see game/turnEngine.js
  };
}

/**
 * Resolve one robot's personality + skill level for roster creation.
 * `config` is `{ personalityId, skillLevelId }` from SetupScreen's bot
 * picker, where either field can be the literal 'random' (or simply
 * missing) to mean "roll it". `usedPersonalityIds` avoids handing two
 * robots at the same table the same named personality when rolling
 * randomly — a human-picked duplicate is left alone, since that's a
 * deliberate choice.
 */
function resolveBotConfig(config, usedPersonalityIds) {
  const requestedPersonalityId = config?.personalityId;
  let personality;
  if (requestedPersonalityId && requestedPersonalityId !== 'random') {
    personality = getBotPersonality(requestedPersonalityId);
  } else {
    const pool = BOT_PERSONALITIES.filter((p) => !usedPersonalityIds.has(p.id));
    personality = pickRandom(pool.length > 0 ? pool : BOT_PERSONALITIES);
  }
  usedPersonalityIds.add(personality.id);

  const requestedSkillLevelId = config?.skillLevelId;
  const skillLevelId =
    requestedSkillLevelId && requestedSkillLevelId !== 'random'
      ? requestedSkillLevelId
      : pickRandom(SKILL_LEVELS).id;

  return { personality, skillLevelId };
}

/**
 * Build the player roster for a given mode config. Every player — human or
 * robot — starts from the same `difficulty` preset (see gameConfig.js
 * DIFFICULTIES), so the challenge level is consistent across the table.
 * Defaults to the standard difficulty if none is passed (e.g. any direct
 * caller/test that predates difficulty presets).
 *
 * `botConfigs` is an optional array (one entry per robot, from
 * SetupScreen's bot picker) of `{ personalityId, skillLevelId }`, where
 * either field can be 'random'/missing to roll it — see resolveBotConfig
 * above. Omitting it entirely (e.g. an older direct caller) rolls every
 * robot at random, so nothing breaks for callers that predate this feature.
 */
export function createPlayerRoster(
  mode,
  humanNames = [],
  difficulty = getDifficulty(DEFAULT_DIFFICULTY_ID),
  botConfigs = [],
  humanAvatars = []
) {
  const startingCash = difficulty.startingCash;
  const startingSkillTokens = difficulty.startingSkillTokens;

  const players = [];
  if (mode.type === 'solo') {
    players.push(
      createPlayer({
        id: 'p1',
        name: humanNames[0] || 'You',
        avatar: humanAvatars[0] || PLAYER_AVATARS[0],
        type: 'human',
        startingCash,
        startingSkillTokens,
      })
    );
    const usedPersonalityIds = new Set();
    for (let i = 0; i < mode.aiCount; i++) {
      const { personality, skillLevelId } = resolveBotConfig(botConfigs[i], usedPersonalityIds);
      players.push(
        createPlayer({
          id: `ai${i + 1}`,
          name: personality.name,
          avatar: personality.avatar,
          type: 'ai',
          startingCash,
          startingSkillTokens,
          personalityId: personality.id,
          strategyId: personality.strategyId,
          skillLevelId,
        })
      );
    }
  } else if (mode.type === 'hotseat') {
    for (let i = 0; i < mode.humanCount; i++) {
      players.push(
        createPlayer({
          id: `p${i + 1}`,
          name: humanNames[i] || `Player ${i + 1}`,
          avatar: humanAvatars[i] || PLAYER_AVATARS[i] || '🙂',
          type: 'human',
          startingCash,
          startingSkillTokens,
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
  return player.businesses.length * BUSINESS_COST;
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

/**
 * Average price per unit a player has paid for an asset, across every
 * purchase made so far this game (not adjusted for later sales — this is a
 * "what have I typically paid" stat, not a remaining cost basis). Returns
 * null if they've never bought that asset.
 */
export function avgPurchasePrice(player, assetId) {
  const stats = player.purchaseStats?.[assetId];
  if (!stats || stats.qty === 0) return null;
  return stats.spent / stats.qty;
}

/**
 * A frozen "hard copy" of a player's portfolio at this exact moment: how
 * much of each asset they own and their lifetime average purchase price for
 * it, plus every business and its individual cash flow. Used to attach a
 * permanent snapshot to a leaderboard entry when a score is saved (see
 * game/leaderboard.js + GameOverScreen) — once saved it never changes
 * again, even if the player goes on to play (and sell everything in)
 * another game.
 */
export function snapshotPortfolio(player, prices) {
  return {
    cash: Math.round(player.cash),
    netWorth: netWorth(player, prices),
    assets: ASSETS.map((asset) => ({
      id: asset.id,
      name: asset.name,
      icon: asset.icon,
      qty: player.holdings[asset.id] || 0,
      avgPurchasePrice: avgPurchasePrice(player, asset.id),
      priceAtSave: prices[asset.id],
    })),
    businesses: player.businesses.map((b, i) => ({ id: b.id, index: i + 1, name: b.name || null, income: b.income })),
  };
}
