import { BUSINESS_UPGRADE_TRACKS } from '../../data/gameConfig';
import { upgradeCost, canUpgradeTrack, upgradeBlockReason } from '../../game/businessUpgrades';
import { businessArt } from '../../game/businessArt';
import { playKidsSound } from '../audio/kidsSoundEngine';

const TRACK_IDS = Object.keys(BUSINESS_UPGRADE_TRACKS);

/** One business's grow-it screen — the four upgrade tracks exactly as the
 * main game defines them (BUSINESS_UPGRADE_TRACKS, canUpgradeTrack,
 * upgradeBlockReason, upgradeCost all imported unmodified from game/), just
 * presented as big kid-sized buttons instead of a dense table. */
export default function KidsBusinessModal({ business, player, month, onUpgrade, onClose }) {
  const art = businessArt(business.name);
  return (
    <div className="kv-modal-backdrop" onClick={onClose}>
      <div className="kv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kv-modal__icon" aria-hidden="true">{art.hero}</div>
        <h2 className="kv-title" style={{ fontSize: '1.5em' }}>{business.name}</h2>
        <p className="kv-subtitle">Making ${business.income}/month right now!</p>

        <div className="kv-action-row">
          {TRACK_IDS.map((trackId) => {
            const track = BUSINESS_UPGRADE_TRACKS[trackId];
            const cost = upgradeCost(business, trackId);
            const allowed = canUpgradeTrack(business, trackId, month);
            const affordable = player.cash >= cost;
            const canBuy = allowed && affordable;
            const reason = !allowed ? upgradeBlockReason(business, trackId, month) : null;
            return (
              <div key={trackId}>
                <button
                  type="button"
                  className="kv-choice"
                  style={{ width: '100%' }}
                  disabled={!canBuy}
                  onClick={() => {
                    playKidsSound('levelUp');
                    onUpgrade(business.id, trackId);
                  }}
                >
                  <span className="kv-choice__icon" aria-hidden="true">{track.icon}</span>
                  {track.name}
                  <span className="kv-choice__sub">${cost}</span>
                </button>
                {reason && <div className="kv-block-reason">{!affordable && allowed ? "You need more money for this one!" : reason}</div>}
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
