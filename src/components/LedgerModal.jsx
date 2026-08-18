import { playSound } from '../audio/soundEngine';

/**
 * The full cash-flow history for one player — every inflow (payday,
 * selling an asset, an accepted buyout, a lucky fortune card) and outflow
 * (buying an asset, starting/upgrading a business, learning a skill, an
 * unlucky fortune card) from the game's very first month through however
 * far the game has gotten, each with a source. Opened from a small "📒
 * Cash Ledger" button in PlayerDetailModal's header — read-only, safe to
 * open for any player (human or AI) at any point in the game, same as the
 * portfolio breakdown it lives inside.
 *
 * Entries come straight from `player.ledger` (see game/players.js's
 * createPlayer and every action/turnEngine.js site that actually moves
 * cash) — this component does no math of its own beyond the running
 * in/out totals, so what's shown here always matches what actually
 * happened to `player.cash`.
 */
export default function LedgerModal({ open, onClose, player }) {
  if (!open || !player) return null;

  // This modal nests INSIDE PlayerDetailModal's own overlay div (rather
  // than being a sibling at the top of GameBoard/GameOverScreen, the way
  // every other modal in this game is) — clicking the ledger's own dark
  // backdrop would otherwise bubble straight up to the portfolio's
  // overlay `onClick` and close BOTH modals in one click. stopPropagation
  // here keeps the click scoped to just this modal.
  function handleClose(e) {
    e?.stopPropagation();
    playSound('click');
    onClose();
  }

  const entries = player.ledger || [];
  const totalIn = entries.filter((e) => e.type === 'in').reduce((sum, e) => sum + e.amount, 0);
  const totalOut = entries.filter((e) => e.type === 'out').reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="vf-modal-overlay" onClick={handleClose}>
      <div className="vf-card vf-ledger" onClick={(e) => e.stopPropagation()}>
        <div className="vf-ledger__header">
          <span>
            📒 {player.avatar} {player.name}'s Cash Ledger
          </span>
          <button type="button" className="vf-btn vf-btn--sm vf-btn--ghost" onClick={handleClose}>
            Close
          </button>
        </div>

        <p className="vf-ledger__blurb">Every dollar in and out, month by month, from day one to right now.</p>

        <div className="vf-ledger__summary">
          <div className="vf-ledger__summary-stat vf-ledger__summary-stat--in">
            <span className="vf-ledger__summary-label">Total in</span>
            <span className="vf-ledger__summary-value">+${totalIn.toLocaleString()}</span>
          </div>
          <div className="vf-ledger__summary-stat vf-ledger__summary-stat--out">
            <span className="vf-ledger__summary-label">Total out</span>
            <span className="vf-ledger__summary-value">-${totalOut.toLocaleString()}</span>
          </div>
        </div>

        <div className="vf-ledger__rows vf-scroll">
          {entries.length === 0 ? (
            <p className="vf-ledger__empty">No cash has moved yet — take a turn!</p>
          ) : (
            entries.map((entry, i) => (
              <div key={i} className={`vf-ledger__row vf-ledger__row--${entry.type}`}>
                <span className="vf-ledger__row-month">Mo. {entry.month}</span>
                <span className="vf-ledger__row-icon">{entry.type === 'in' ? '📥' : '📤'}</span>
                <span className="vf-ledger__row-source">
                  {entry.source}
                  {entry.detail && <span className="vf-ledger__row-detail"> — {entry.detail}</span>}
                </span>
                <span className="vf-ledger__row-amount">
                  {entry.type === 'in' ? '+' : '-'}${entry.amount.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
