// ============================================================================
// Player actions — pure state-transform helpers
// ----------------------------------------------------------------------------
// Each function takes the full game state + args and returns a new game
// state (plus ok/error/logEntry). These are the ONLY place player money
// actually moves, so both human dispatch (reducer.js) and the AI
// (aiEngine.js) call through here — one set of rules, two callers.
// ============================================================================
import { getAssetConfig } from './market';
import { BUSINESS_COST, BUSINESS_SKILL_COST, BUSINESS_INCOME_MIN, BUSINESS_INCOME_MAX, SKILL_COST } from '../data/gameConfig';
import { randomInt } from './rng';

function updatePlayer(state, playerId, updater) {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? updater(p) : p)),
  };
}

function findPlayer(state, playerId) {
  return state.players.find((p) => p.id === playerId);
}

export function buyAsset(state, playerId, assetId, qty = 1) {
  const player = findPlayer(state, playerId);
  const asset = getAssetConfig(assetId);
  if (!player || !asset || qty <= 0) return { state, ok: false, error: 'Invalid purchase.' };

  const price = state.assetPrices[assetId];
  const cost = Math.round(price * qty);
  if (player.cash < cost) return { state, ok: false, error: `Not enough cash for ${asset.name}.` };

  const nextState = updatePlayer(state, playerId, (p) => ({
    ...p,
    cash: p.cash - cost,
    holdings: { ...p.holdings, [assetId]: (p.holdings[assetId] || 0) + qty },
  }));

  return {
    state: nextState,
    ok: true,
    logEntry: { icon: asset.icon, message: `bought ${asset.name}`, kind: 'buy' },
  };
}

export function sellAsset(state, playerId, assetId, qty = 1) {
  const player = findPlayer(state, playerId);
  const asset = getAssetConfig(assetId);
  if (!player || !asset || qty <= 0) return { state, ok: false, error: 'Invalid sale.' };

  const owned = player.holdings[assetId] || 0;
  if (owned < qty) return { state, ok: false, error: `You don't own that many ${asset.name}.` };

  const price = state.assetPrices[assetId];
  const proceeds = Math.round(price * qty);

  const nextState = updatePlayer(state, playerId, (p) => ({
    ...p,
    cash: p.cash + proceeds,
    holdings: { ...p.holdings, [assetId]: owned - qty },
  }));

  return {
    state: nextState,
    ok: true,
    logEntry: { icon: asset.icon, message: `sold ${asset.name}`, kind: 'sell' },
  };
}

export function startBusiness(state, playerId) {
  const player = findPlayer(state, playerId);
  if (!player) return { state, ok: false, error: 'Invalid player.' };
  if (player.cash < BUSINESS_COST) return { state, ok: false, error: 'Not enough cash to start a business.' };
  if (player.skillTokens < BUSINESS_SKILL_COST) return { state, ok: false, error: 'Not enough skill tokens.' };

  const income = randomInt(BUSINESS_INCOME_MIN, BUSINESS_INCOME_MAX);
  const business = { id: `${playerId}-biz-${player.businesses.length + 1}`, income };

  const nextState = updatePlayer(state, playerId, (p) => ({
    ...p,
    cash: p.cash - BUSINESS_COST,
    skillTokens: p.skillTokens - BUSINESS_SKILL_COST,
    businesses: [...p.businesses, business],
  }));

  return {
    state: nextState,
    ok: true,
    logEntry: { icon: '🚀', message: `started a business (+$${income}/mo)`, kind: 'business' },
  };
}

export function learnSkill(state, playerId) {
  const player = findPlayer(state, playerId);
  if (!player) return { state, ok: false, error: 'Invalid player.' };
  if (player.cash < SKILL_COST) return { state, ok: false, error: 'Not enough cash to learn a skill.' };

  const nextState = updatePlayer(state, playerId, (p) => ({
    ...p,
    cash: p.cash - SKILL_COST,
    skillTokens: p.skillTokens + 1,
  }));

  return {
    state: nextState,
    ok: true,
    logEntry: { icon: '📚', message: 'learned a new skill', kind: 'skill' },
  };
}
