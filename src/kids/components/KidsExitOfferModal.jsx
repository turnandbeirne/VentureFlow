import { BUSINESS_EXIT_RARITY_LABELS } from '../../data/gameConfig';
import { playKidsSound } from '../audio/kidsSoundEngine';

/** Kid-styled buyout decision — same underlying offer object and the same
 * two-choice decision as the main game's BusinessExitOfferModal, just
 * simplified copy (no annual-revenue-multiplier math shown) since that
 * level of detail isn't the point for this audience; the choice itself
 * (take the cash now, or keep the business) still teaches the same idea. */
export default function KidsExitOfferModal({ offer, playerName, playerAvatar, onDecide }) {
  if (!offer) return null;
  const rarity = BUSINESS_EXIT_RARITY_LABELS[offer.multiplier] || 'rare';
  const bizName = offer.business?.name || 'this business';

  return (
    <div className="kv-modal-backdrop">
      <div className="kv-modal">
        <div style={{ fontWeight: 700, color: 'var(--kv-ink-soft)' }}>
          {playerAvatar} {playerName}'s Big Decision
        </div>
        <div className="kv-modal__icon" aria-hidden="true">💼</div>
        <h2 className="kv-title" style={{ fontSize: '1.4em' }}>Someone wants to buy {bizName}!</h2>
        <p>
          They're offering <strong>${offer.payout.toLocaleString()}</strong> cash right now (that's a {rarity} good
          offer!). You can take the money, or say no thanks and keep growing {bizName} yourself.
        </p>
        <div className="kv-pill" style={{ fontSize: '1.1em', margin: '8px 0' }}>
          Offer: ${offer.payout.toLocaleString()}
        </div>
        <div className="kv-landing__cta" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="kv-btn kv-btn--ghost kv-btn--huge"
            onClick={() => {
              playKidsSound('tap');
              onDecide(false);
            }}
          >
            🤝 Keep It
          </button>
          <button
            type="button"
            className="kv-btn kv-btn--green kv-btn--huge"
            onClick={() => {
              playKidsSound('coinPlink');
              onDecide(true);
            }}
          >
            💰 Take the Cash!
          </button>
        </div>
      </div>
    </div>
  );
}
