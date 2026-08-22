import { ASSETS } from '../../data/gameConfig';
import { playKidsSound } from '../audio/kidsSoundEngine';

/** Simplified asset shop: one big card per asset, a round + to buy one and
 * a round - to sell one (no quantity picker — a kid tapping repeatedly IS
 * the interaction, and each tap gets its own satisfying sound). Reuses
 * ASSETS straight from gameConfig.js (icon/name/basePrice already exist
 * there and are already kid-friendly), so nothing about what's for sale or
 * what it costs is duplicated or re-decided here. */
export default function KidsShopModal({ player, prices, onBuy, onSell, onClose }) {
  return (
    <div className="kv-modal-backdrop" onClick={onClose}>
      <div className="kv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kv-modal__icon" aria-hidden="true">🛍️</div>
        <h2 className="kv-title" style={{ fontSize: '1.6em' }}>The Shop</h2>
        <p className="kv-subtitle">You have ${player.cash.toLocaleString()} to spend!</p>

        <div className="kv-shop-grid">
          {ASSETS.map((asset) => {
            const price = Math.round(prices[asset.id] ?? asset.basePrice);
            const owned = player.holdings[asset.id] || 0;
            const canBuy = player.cash >= price;
            return (
              <div key={asset.id} className="kv-shop-card">
                <div className="kv-shop-card__icon" aria-hidden="true">{asset.icon}</div>
                <div className="kv-shop-card__name">{asset.name}</div>
                <div className="kv-shop-card__price">${price} each</div>
                {owned > 0 && <div className="kv-shop-card__owned">You have {owned}!</div>}
                <div className="kv-shop-card__row">
                  <button
                    type="button"
                    className="kv-round-btn kv-round-btn--sell"
                    disabled={owned === 0}
                    title={`Sell one ${asset.name}`}
                    onClick={() => {
                      playKidsSound('sellWhoosh');
                      onSell(asset.id);
                    }}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="kv-round-btn"
                    disabled={!canBuy}
                    title={`Buy one ${asset.name}`}
                    onClick={() => {
                      playKidsSound('buySpark');
                      onBuy(asset.id);
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="kv-btn kv-btn--huge"
          style={{ marginTop: 20 }}
          onClick={() => {
            playKidsSound('tap');
            onClose();
          }}
        >
          ✅ All Done
        </button>
      </div>
    </div>
  );
}
