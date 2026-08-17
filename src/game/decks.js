// ============================================================================
// Fortune card decks
// ----------------------------------------------------------------------------
// Drawing is weighted by the current weather stage (see gameConfig
// WEATHER_STAGES[...].deckWeight). Applying a card's effect is generic over
// the small set of effect "type"s so new cards never need engine changes.
// ============================================================================
import { OPPORTUNITY_DECK, SETBACK_DECK } from '../data/gameConfig';
import { weightedPick, pickRandom } from './rng';
import { getStageInfo } from './weather';
import { bumpPrice } from './market';

const DECKS = {
  opportunity: OPPORTUNITY_DECK,
  setback: SETBACK_DECK,
};

/** Draw a single fortune card, biased by the current weather stage. */
export function drawFortuneCard(weatherState) {
  const stage = getStageInfo(weatherState);
  const deckId = weightedPick(stage.deckWeight);
  const card = pickRandom(DECKS[deckId]);
  return { deckId, card };
}

/**
 * Apply a card's effect to a single player + the shared asset price table.
 * Returns { player, prices, description } — description is a short string
 * for the event log (e.g. "+$40" or "Lemonade Co. +12%").
 */
export function applyCardEffect(player, prices, card) {
  const effect = card.effect;
  let nextPlayer = { ...player };
  let nextPrices = prices;
  let description = '';

  switch (effect.type) {
    case 'cash': {
      nextPlayer.cash = Math.max(0, Math.round(nextPlayer.cash + effect.amount));
      description = `${effect.amount >= 0 ? '+' : ''}$${effect.amount}`;
      break;
    }
    case 'cashPercent': {
      const delta = Math.round((nextPlayer.cash * effect.percent) / 100);
      nextPlayer.cash = Math.max(0, nextPlayer.cash + delta);
      description = `${effect.percent >= 0 ? '+' : ''}${effect.percent}% cash`;
      break;
    }
    case 'assetPrice': {
      nextPrices = bumpPrice(prices, effect.assetId, effect.percent);
      description = `${effect.assetId === 'all' ? 'All assets' : effect.assetId} ${effect.percent >= 0 ? '+' : ''}${effect.percent}%`;
      break;
    }
    case 'skillToken': {
      nextPlayer.skillTokens = Math.max(0, nextPlayer.skillTokens + effect.amount);
      description = `${effect.amount >= 0 ? '+' : ''}${effect.amount} skill token`;
      break;
    }
    case 'passiveBonus': {
      nextPlayer.passiveBonus = (nextPlayer.passiveBonus || 0) + effect.amount;
      description = `${effect.amount >= 0 ? '+' : ''}$${effect.amount}/mo`;
      break;
    }
    default:
      break;
  }

  return { player: nextPlayer, prices: nextPrices, description };
}
