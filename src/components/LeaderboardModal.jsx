import { useEffect } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { playSound } from '../audio/soundEngine';

const MODE_LABEL = { solo: '🤖 Solo', hotseat: '🪑 Hot-Seat' };

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function LeaderboardModal({ open, onClose, highlightId }) {
  const { entries, refresh } = useLeaderboard();

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!open) return null;

  function handleClose() {
    playSound('click');
    onClose();
  }

  return (
    <div className="vf-modal-overlay" onClick={handleClose}>
      <div className="vf-card vf-leaderboard" onClick={(e) => e.stopPropagation()}>
        <div className="vf-leaderboard__header">
          <span>🏆 Leaderboard</span>
          <button type="button" className="vf-btn vf-btn--sm vf-btn--ghost" onClick={handleClose}>
            Close
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="vf-log__empty">No scores saved yet — finish a game and add yours!</p>
        ) : (
          <div className="vf-leaderboard__list vf-scroll">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className={`vf-leaderboard__row ${entry.id === highlightId ? 'vf-leaderboard__row--highlight' : ''}`}
              >
                <span className="vf-leaderboard__rank">{i + 1}</span>
                <span className="vf-leaderboard__avatar">{entry.avatar}</span>
                <span className="vf-leaderboard__name">{entry.name}</span>
                <span className="vf-leaderboard__mode">{MODE_LABEL[entry.mode] || entry.mode}</span>
                <span className="vf-leaderboard__date">{formatDate(entry.playedAt)}</span>
                <span className="vf-leaderboard__score">${entry.netWorth.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
