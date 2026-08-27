import { useEffect } from 'react';
import { netWorth } from '../../game/players';
import { playKidsSound } from '../audio/kidsSoundEngine';

const RANK_ICONS = ['🥇', '🥈', '🥉', '🏅', '🏅'];

/**
 * The Kids Version's own game-over screen. Deliberately does NOT write to
 * the shared profile/leaderboard (game/profile.js, hooks/useLeaderboard.js)
 * that the main game's GameOverScreen feeds — a young kid's easy-mode
 * result showing up on the same competitive leaderboard a parent might be
 * chasing would be a real, if small, change to the main game's experience,
 * and the brief this shipped under asked for none of that. This screen is
 * just a celebration; nothing here persists beyond the kids save slot
 * itself (see useKidsGame.js).
 */
export default function KidsGameOverScreen({ state, onPlayAgain }) {
  const { players, assetPrices, winnerId } = state;
  const ranked = [...players].sort((a, b) => netWorth(b, assetPrices) - netWorth(a, assetPrices));
  const winner = players.find((p) => p.id === winnerId) || ranked[0];

  useEffect(() => {
    playKidsSound('bigWin');
  }, []);

  return (
    <div className="kv-gameover">
      <div className="kv-gameover__winner" aria-hidden="true">🎉</div>
      <h1 className="kv-title">{winner.avatar} {winner.name} wins!</h1>
      <p className="kv-subtitle">What an adventure! Here's how everyone did:</p>

      <div className="kv-standings">
        {ranked.map((p, i) => (
          <div key={p.id} className="kv-standings__row">
            <span className="kv-standings__rank" aria-hidden="true">{RANK_ICONS[i] || `#${i + 1}`}</span>
            <span aria-hidden="true">{p.avatar}</span>
            <span>{p.name}</span>
            <span className="kv-standings__value">${netWorth(p, assetPrices).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="kv-btn kv-btn--huge kv-btn--green"
        onClick={() => {
          playKidsSound('tap');
          onPlayAgain();
        }}
      >
        🔁 Play Again!
      </button>
    </div>
  );
}
