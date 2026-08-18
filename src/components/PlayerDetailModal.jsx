import { ASSETS, getBotPersonality, getSkillLevel } from '../data/gameConfig';
import { assetValue, businessValue, netWorth, passiveIncome, avgPurchasePrice } from '../game/players';
import { playSound } from '../audio/soundEngine';

/**
 * Full portfolio breakdown for one player — opened by tapping their card in
 * PlayerPanel. Shows quantity owned + lifetime average purchase price per
 * asset (via avgPurchasePrice in game/players.js), current value and
 * gain/loss vs. that average, plus each business and its individual cash
 * flow. Read-only: no actions can be taken from here, so it's safe to open
 * for any player (including AI) at any time, even mid-turn.
 */
export default function PlayerDetailModal({ player, prices, onClose }) {
  if (!player) return null;

  function handleClose() {
    playSound('click');
    onClose();
  }

  const totalAssetValue = assetValue(player, prices);
  const totalBusinessValue = businessValue(player);
  const totalBusinessIncome = player.businesses.reduce((sum, b) => sum + b.income, 0);

  return (
    <div className="vf-modal-overlay" onClick={handleClose}>
      <div className="vf-card vf-portfolio" onClick={(e) => e.stopPropagation()}>
        <div className="vf-portfolio__header">
          <div className="vf-portfolio__who">
            <span>{player.avatar}</span>
            <span>{player.name}</span>
            {player.type === 'ai' && <span title="AI player">🤖</span>}
          </div>
          <button type="button" className="vf-btn vf-btn--sm vf-btn--ghost" onClick={handleClose}>
            Close
          </button>
        </div>

        {player.type === 'ai' && player.personalityId && (
          <div className="vf-portfolio__bot-tag">
            <span>💬 "{getBotPersonality(player.personalityId).blurb}"</span>
            {player.skillLevelId && (
              <span className="vf-portfolio__bot-skill">
                {getSkillLevel(player.skillLevelId).icon} {getSkillLevel(player.skillLevelId).name}
              </span>
            )}
          </div>
        )}

        <div className="vf-portfolio__body vf-scroll">
          <div className="vf-portfolio__summary">
            <div className="vf-portfolio__summary-stat">
              <span className="vf-portfolio__summary-label">Net Worth</span>
              <span className="vf-portfolio__summary-value">${netWorth(player, prices).toLocaleString()}</span>
            </div>
            <div className="vf-portfolio__summary-stat">
              <span className="vf-portfolio__summary-label">Cash</span>
              <span className="vf-portfolio__summary-value">${Math.round(player.cash).toLocaleString()}</span>
            </div>
            <div className="vf-portfolio__summary-stat">
              <span className="vf-portfolio__summary-label">Assets Worth</span>
              <span className="vf-portfolio__summary-value">${Math.round(totalAssetValue).toLocaleString()}</span>
            </div>
            <div className="vf-portfolio__summary-stat">
              <span className="vf-portfolio__summary-label">Passive / mo</span>
              <span className="vf-portfolio__summary-value">${passiveIncome(player)}</span>
            </div>
          </div>

          <div>
            <div className="vf-portfolio__section-title">📦 Assets</div>
            <div className="vf-portfolio__assets">
              {ASSETS.map((asset) => {
                const qty = player.holdings[asset.id] || 0;
                const avgPrice = avgPurchasePrice(player, asset.id);
                const currentPrice = prices[asset.id];
                const currentValue = qty * currentPrice;
                const gainPct = avgPrice ? ((currentPrice - avgPrice) / avgPrice) * 100 : null;

                if (qty === 0 && avgPrice === null) {
                  return (
                    <div key={asset.id} className="vf-portfolio__asset-row vf-portfolio__asset-row--empty">
                      <span className="vf-portfolio__asset-icon">{asset.icon}</span>
                      <div>
                        <div className="vf-portfolio__asset-name">{asset.name}</div>
                        <div className="vf-portfolio__asset-detail">Never bought</div>
                      </div>
                      <span className="vf-portfolio__asset-value">—</span>
                    </div>
                  );
                }

                return (
                  <div key={asset.id} className="vf-portfolio__asset-row">
                    <span className="vf-portfolio__asset-icon">{asset.icon}</span>
                    <div>
                      <div className="vf-portfolio__asset-name">
                        {asset.name} · {qty} owned
                      </div>
                      <div className="vf-portfolio__asset-detail">
                        Avg paid: {avgPrice !== null ? `$${avgPrice.toFixed(2)}` : '—'} · Now: $
                        {currentPrice.toFixed(2)}
                        {asset.rentPerMonth > 0 && qty > 0 && <> · +${qty * asset.rentPerMonth}/mo rent</>}
                      </div>
                    </div>
                    <div>
                      <div className="vf-portfolio__asset-value">${Math.round(currentValue).toLocaleString()}</div>
                      {gainPct !== null && (
                        <div
                          className={`vf-portfolio__asset-gain ${
                            gainPct >= 0 ? 'vf-portfolio__asset-gain--up' : 'vf-portfolio__asset-gain--down'
                          }`}
                        >
                          {gainPct >= 0 ? '▲' : '▼'} {Math.abs(gainPct).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="vf-portfolio__section-title">
              🚀 Businesses ({player.businesses.length}) — ${Math.round(totalBusinessValue).toLocaleString()} value,
              ${totalBusinessIncome}/mo
            </div>
            {player.businesses.length === 0 ? (
              <p className="vf-portfolio__empty">No businesses started yet.</p>
            ) : (
              <div className="vf-portfolio__businesses">
                {player.businesses.map((biz, i) => (
                  <div key={biz.id} className="vf-portfolio__business-row">
                    <span>🚀 {biz.name || `Business #${i + 1}`}</span>
                    <span className="vf-portfolio__business-income">+${biz.income}/mo</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
