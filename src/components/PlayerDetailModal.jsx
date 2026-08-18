import { ASSETS, BUSINESS_UPGRADE_TRACKS, getBotPersonality, getSkillLevel } from '../data/gameConfig';
import {
  assetValue,
  businessValue,
  netWorth,
  passiveIncome,
  avgPurchasePrice,
  effectiveRentPerUnit,
  totalUnitsOwned,
  businessMonthlyIncome,
} from '../game/players';
import { upgradeCost, canUpgradeTrack, activeMarketingBoostTotal } from '../game/businessUpgrades';
import { playSound } from '../audio/soundEngine';

const UPGRADE_TRACK_ORDER = ['marketing', 'sales', 'ops', 'rnd'];

/** A business's upgrade section: read-only level/status chips always show
 * (so anyone glancing at this business — including from the game-over
 * screen — can see how it was grown), and the four action buttons only
 * appear when `canUpgrade` is true (this player's own live turn). */
function BusinessUpgrades({ business, month, cash, canUpgrade, onUpgrade }) {
  const activeBoost = activeMarketingBoostTotal(business, month);
  const pendingRnd = (business.pendingRnd || []).length;

  return (
    <div className="vf-biz-upgrades">
      <div className="vf-biz-upgrades__status">
        {activeBoost > 0 && (
          <span className="vf-biz-upgrades__chip vf-biz-upgrades__chip--active">📣 +${activeBoost}/mo campaign live</span>
        )}
        <span className="vf-biz-upgrades__chip">🤝 Sales Lv{business.salesLevel || 0}/3</span>
        <span className="vf-biz-upgrades__chip">⚙️ Ops Lv{business.opsLevel || 0}/3</span>
        <span className="vf-biz-upgrades__chip">
          🔬 R&D {business.rndCount || 0}/2{pendingRnd > 0 && ` (${pendingRnd} pending)`}
        </span>
      </div>
      {canUpgrade && (
        <div className="vf-biz-upgrades__actions">
          {UPGRADE_TRACK_ORDER.map((trackId) => {
            const track = BUSINESS_UPGRADE_TRACKS[trackId];
            const capped = !canUpgradeTrack(business, trackId);
            const cost = upgradeCost(business, trackId);
            const affordable = cash >= cost;
            return (
              <button
                key={trackId}
                type="button"
                className="vf-btn vf-btn--sm vf-btn--ghost vf-biz-upgrades__btn"
                disabled={capped || !affordable}
                title={track.blurb}
                onClick={() => onUpgrade(business.id, trackId)}
              >
                {track.icon} {track.name} {capped ? '(maxed)' : `$${cost}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Full portfolio breakdown for one player — opened by tapping their card in
 * PlayerPanel (live game) or a standings row on the game-over screen.
 * Shows quantity owned + lifetime average purchase price per asset (via
 * avgPurchasePrice in game/players.js), current value and gain/loss vs.
 * that average, plus each business, its current income, and how it's been
 * grown so far. Actionable (the four business-upgrade buttons) only when
 * `canUpgrade` is true — otherwise this is read-only and safe to open for
 * any player, including AI, at any time, even mid-turn or after the game
 * has ended.
 */
export default function PlayerDetailModal({ player, prices, allPlayers, month, canUpgrade = false, onUpgradeBusiness, onClose }) {
  if (!player) return null;

  function handleClose() {
    playSound('click');
    onClose();
  }

  function handleUpgrade(businessId, trackId) {
    playSound('click');
    onUpgradeBusiness?.(player.id, businessId, trackId);
  }

  const totalAssetValue = assetValue(player, prices);
  const totalBusinessValue = businessValue(player);
  const totalBusinessIncome = player.businesses.reduce((sum, b) => sum + businessMonthlyIncome(b, month), 0);

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
              <span className="vf-portfolio__summary-value">${passiveIncome(player, { allPlayers, prices, month })}</span>
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
                const rentPerUnit = asset.rentPerMonth > 0 ? effectiveRentPerUnit(asset, currentPrice, totalUnitsOwned(allPlayers, asset.id)) : 0;

                if (qty === 0 && avgPrice === null) {
                  return (
                    <div key={asset.id} className="vf-portfolio__asset-row vf-portfolio__asset-row--empty">
                      <span className="vf-portfolio__asset-icon">{asset.icon}</span>
                      <div>
                        <div className="vf-portfolio__asset-name">{asset.name}</div>
                        <div className="vf-portfolio__asset-detail">
                          Never bought{asset.rentPerMonth === 0 && ' · price only, no monthly income'}
                        </div>
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
                        {asset.rentPerMonth > 0 && qty > 0 && rentPerUnit > 0 && (
                          <> · +${(qty * rentPerUnit).toFixed(0)}/mo rent</>
                        )}
                        {asset.rentPerMonth === 0 && <> · price only, no monthly income</>}
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
                  <div key={biz.id} className="vf-portfolio__business-card">
                    <div className="vf-portfolio__business-row">
                      <span>🚀 {biz.name || `Business #${i + 1}`}</span>
                      <span className="vf-portfolio__business-income">+${businessMonthlyIncome(biz, month)}/mo</span>
                    </div>
                    <BusinessUpgrades
                      business={biz}
                      month={month}
                      cash={player.cash}
                      canUpgrade={canUpgrade}
                      onUpgrade={handleUpgrade}
                    />
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
