import { useState } from 'react';
import '../styles/game.css';
import { netWorth } from '../game/players';
import { isOffensiveName } from '../game/nameFilter';
import { playSound } from '../audio/soundEngine';
import { useLeaderboard } from '../hooks/useLeaderboard';
import VolumeControl from './VolumeControl';
import Brand from './Brand';
import LeaderboardModal from './LeaderboardModal';

export default function GameOverScreen({ state, onPlayAgain }) {
  const { players, assetPrices, winnerId, mode } = state;
  const ranked = [...players].sort((a, b) => netWorth(b, assetPrices) - netWorth(a, assetPrices));
  const winner = players.find((p) => p.id === winnerId) || ranked[0];

  const { addEntry } = useLeaderboard();
  const [scoreName, setScoreName] = useState(winner.name);
  const [scoreEmail, setScoreEmail] = useState('');
  const [nameError, setNameError] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  function handlePlayAgain() {
    playSound('click');
    onPlayAgain();
  }

  function handleSaveScore() {
    const trimmed = scoreName.trim();
    if (!trimmed || isOffensiveName(trimmed)) {
      setNameError(true);
      playSound('error');
      return;
    }
    setNameError(false);
    const entry = addEntry({
      name: trimmed,
      avatar: winner.avatar,
      netWorth: netWorth(winner, assetPrices),
      mode: mode?.type,
      email: scoreEmail,
    });
    setSavedEntryId(entry.id);
    playSound('badge');
  }

  return (
    <div className="vf-gameover">
      <div className="vf-topbar-corner">
        <VolumeControl />
      </div>
      <div className="vf-card vf-gameover__inner">
        <Brand size="md" align="center" />
        <div className="vf-gameover__trophy">🏆</div>
        <h1>Game Over!</h1>
        <div className="vf-gameover__winner">
          {winner.avatar} {winner.name} {winner.name.toLowerCase() === 'you' ? 'win' : 'wins'} with $
          {netWorth(winner, assetPrices).toLocaleString()}!
        </div>

        <div className="vf-standings">
          {ranked.map((player, i) => (
            <div key={player.id} className={`vf-standing-row ${player.id === winnerId ? 'vf-standing-row--winner' : ''}`}>
              <span className="vf-standing-row__rank">{i + 1}</span>
              <span>
                {player.avatar} {player.name}
              </span>
              <span>${netWorth(player, assetPrices).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="vf-card vf-save-score">
          <div className="vf-save-score__title">
            {savedEntryId ? '🎉 Added to the Leaderboard!' : `🏆 ${winner.avatar} Add your win to the Leaderboard!`}
          </div>

          {savedEntryId ? (
            <>
              <p className="vf-save-score__success">Nice work, {scoreName}! Your score is saved.</p>
              <button
                type="button"
                className="vf-btn vf-btn--primary vf-btn--block"
                onClick={() => {
                  playSound('click');
                  setShowLeaderboard(true);
                }}
              >
                View Leaderboard
              </button>
            </>
          ) : (
            <>
              <div>
                <span className="vf-field-label">Name to show on the Leaderboard</span>
                <input
                  className="vf-text-input"
                  type="text"
                  value={scoreName}
                  onChange={(e) => {
                    setScoreName(e.target.value);
                    if (nameError) setNameError(false);
                  }}
                  maxLength={20}
                />
                {nameError && <span className="vf-field-error">Please pick a different name.</span>}
              </div>
              <div>
                <span className="vf-field-label">Email (optional)</span>
                <input
                  className="vf-text-input"
                  type="email"
                  placeholder="you@example.com"
                  value={scoreEmail}
                  onChange={(e) => setScoreEmail(e.target.value)}
                  maxLength={80}
                />
                <span className="vf-save-score__hint">Never shown on the Leaderboard — just kept private.</span>
              </div>
              <button type="button" className="vf-btn vf-btn--go vf-btn--block" onClick={handleSaveScore}>
                Save My Score
              </button>
            </>
          )}
        </div>

        <button type="button" className="vf-btn vf-btn--go vf-btn--lg" onClick={handlePlayAgain}>
          Play Again 🔁
        </button>
      </div>

      <LeaderboardModal open={showLeaderboard} onClose={() => setShowLeaderboard(false)} highlightId={savedEntryId} />
    </div>
  );
}
