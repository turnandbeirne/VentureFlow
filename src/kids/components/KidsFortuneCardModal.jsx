import { playKidsSound } from '../audio/kidsSoundEngine';

/** Kid-styled fortune card reveal. `entry`/`description`/`card.why` all
 * come straight from game/turnEngine.js's fortuneRecapEntry, already
 * written in plain, friendly language (see gameConfig.js's OPPORTUNITY_DECK
 * /SETBACK_DECK) — nothing here rewrites the content, just the chrome
 * around it. */
export default function KidsFortuneCardModal({ entry, onContinue }) {
  if (!entry) return null;
  const { playerName, avatar, deckId, card, description } = entry;
  const good = deckId === 'opportunity';

  function handleContinue() {
    playKidsSound(good ? 'coinPlink' : 'oops');
    onContinue();
  }

  return (
    <div className="kv-modal-backdrop">
      <div className="kv-modal">
        <div style={{ fontWeight: 700, color: 'var(--kv-ink-soft)' }}>
          {avatar} {playerName}'s Fortune Card
        </div>
        <div className="kv-modal__icon" aria-hidden="true">{card.icon}</div>
        <h2 className="kv-title" style={{ fontSize: '1.5em' }}>{card.title}</h2>
        <p>{card.flavor}</p>
        <div className="kv-pill" style={{ fontSize: '1.1em', margin: '8px 0' }}>{description}</div>
        <p className="kv-block-reason" style={{ fontSize: '0.95em' }}>
          <strong>Why? </strong>
          {card.why}
        </p>
        <button type="button" className="kv-btn kv-btn--huge" style={{ marginTop: 14 }} onClick={handleContinue}>
          👍 Got it!
        </button>
      </div>
    </div>
  );
}
