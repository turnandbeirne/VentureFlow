import { useCallback } from 'react';
import { ASSETS } from '../data/gameConfig';
import { useHoldRepeat } from '../hooks/useHoldRepeat';

/** A quick 1-4 dot risk meter from an asset's volatility, paired with its
 * existing riskLabel text (gameConfig.js) — teaches the risk/reward
 * vocabulary right where the buy decision actually happens, instead of only
 * implicitly through how the asset behaves over time. */
function riskDots(volatility) {
  if (volatility <= 0.03) return 1;
  if (volatility <= 0.1) return 2;
  if (volatility <= 0.2) return 3;
  return 4;
}

function AssetCard({ asset, price, previousPrice, owned, cash, onBuy, onSell, disabled }) {
  const trendUp = price >= previousPrice;
  const trendPct = previousPrice ? Math.round(((price - previousPrice) / previousPrice) * 100) : 0;
  const canBuy = !disabled && cash >= price;
  const canSell = !disabled && owned > 0;

  // Buy/Sell support press-and-hold: hold past a second and it starts
  // auto-repeating, accelerating the longer it's held, so scooping up (or
  // unwinding) a big stack isn't a wall of individual taps. canBuy/canSell
  // are read fresh on every repeat tick via these callbacks so it stops the
  // instant cash or holdings run out, rather than hammering a no-op.
  const canBuyRef = useCallback(() => canBuy, [canBuy]);
  const canSellRef = useCallback(() => canSell, [canSell]);
  const buyHold = useHoldRepeat(onBuy, canBuyRef);
  const sellHold = useHoldRepeat(onSell, canSellRef);

  return (
    <div className="vf-card vf-asset-card">
      <span className="vf-asset-card__icon">{asset.icon}</span>
      <span className="vf-asset-card__name">{asset.name}</span>
      <span className="vf-asset-card__tagline">{asset.tagline}</span>
      <span className="vf-asset-card__risk" title={`Volatility: how much the price can swing in one month`}>
        <span className="vf-asset-card__risk-dots" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className={`vf-risk-dot ${i < riskDots(asset.volatility) ? 'vf-risk-dot--on' : ''}`} />
          ))}
        </span>
        {asset.riskLabel}
      </span>
      <span className="vf-asset-card__price">${price.toFixed(0)}</span>
      {previousPrice ? (
        <span className={`vf-asset-card__trend ${trendUp ? 'vf-asset-card__trend--up' : 'vf-asset-card__trend--down'}`}>
          {trendUp ? '▲' : '▼'} {Math.abs(trendPct)}%
        </span>
      ) : (
        <span className="vf-asset-card__trend">—</span>
      )}
      {asset.rentPerMonth > 0 && <span className="vf-asset-card__rent">+${asset.rentPerMonth}/mo each</span>}
      <span className="vf-asset-card__owned">You have: {owned}</span>
      <div className="vf-asset-card__actions">
        <button type="button" className="vf-btn vf-btn--go" disabled={!canBuy} {...buyHold}>
          Buy
        </button>
        <button type="button" className="vf-btn vf-btn--danger" disabled={!canSell} {...sellHold}>
          Sell
        </button>
      </div>
    </div>
  );
}

export default function AssetShop({ prices, previousPrices, player, disabled, onBuy, onSell }) {
  return (
    <div>
      <div className="vf-section-title">
        <span>🛒</span>
        <span>Buy things that grow</span>
        <span className="vf-section-title__hint">Hold Buy/Sell to go faster</span>
      </div>
      <div className="vf-shop-grid">
        {ASSETS.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            price={prices[asset.id]}
            previousPrice={previousPrices?.[asset.id]}
            owned={player.holdings[asset.id] || 0}
            cash={player.cash}
            disabled={disabled}
            onBuy={() => onBuy(asset.id)}
            onSell={() => onSell(asset.id)}
          />
        ))}
      </div>
    </div>
  );
}
