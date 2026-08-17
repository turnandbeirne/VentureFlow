import { ASSETS } from '../data/gameConfig';

function AssetCard({ asset, price, previousPrice, owned, cash, onBuy, onSell, disabled }) {
  const trendUp = price >= previousPrice;
  const trendPct = previousPrice ? Math.round(((price - previousPrice) / previousPrice) * 100) : 0;
  const canBuy = !disabled && cash >= price;
  const canSell = !disabled && owned > 0;

  return (
    <div className="vf-card vf-asset-card">
      <span className="vf-asset-card__icon">{asset.icon}</span>
      <span className="vf-asset-card__name">{asset.name}</span>
      <span className="vf-asset-card__tagline">{asset.tagline}</span>
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
        <button type="button" className="vf-btn vf-btn--go" disabled={!canBuy} onClick={onBuy}>
          Buy
        </button>
        <button type="button" className="vf-btn vf-btn--danger" disabled={!canSell} onClick={onSell}>
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
