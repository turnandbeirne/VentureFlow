import { useEffect, useState } from 'react';
import '../styles/game.css';
import { LEADERBOARD_TOP_HIGHLIGHT } from '../data/gameConfig';
import { netWorth, snapshotPortfolio } from '../game/players';
import { isOffensiveName } from '../game/nameFilter';
import { playSound } from '../audio/soundEngine';
import { playMusicTrack } from '../audio/musicEngine';
import { useLeaderboard } from '../hooks/useLeaderboard';
import VolumeControl from './VolumeControl';
import MusicControl from './MusicControl';
import Brand from './Brand';
import LeaderboardModal from './LeaderboardModal';
import Fireworks from './Fireworks';
import { ChatEntryRow } from './ChatPanel';

export default function GameOverScreen({ state, onPlayAgain }) {
  const { players, assetPrices, winnerId, mode, difficultyId } = state;
  const ranked = [...players].sort((a, b) => netWorth(b, assetPrices) - netWorth(a, assetPrices));
  const winner = players.find((p) => p.id === winnerId) || ranked[0];

  // The robots' closing thoughts — gloating if one of them won, applauding
  // whoever did (see game/chatEngine.js's 'gameover' reaction). Naturally
  // the most recent chat entries, since they're generated the instant the
  // game ends.
  const closingChat = (state.chat || []).filter((c) => c.category === 'gloat' || c.category === 'applause').slice(-4);

  const { addEntry } = useLeaderboard();
  const [scoreName, setScoreName] = useState(winner.name);
  const [scoreEmail, setScoreEmail] = useState('');
  const [nameError, setNameError] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState(null);
  const [savedRank, setSavedRank] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Back to the opening theme for the big finish — same track SetupScreen
  // uses, so "Play Again" (GameOver → Setup) doesn't restart it.
  useEffect(() => {
    playMusicTrack('theme');
  }, []);

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
      difficultyId,
      email: scoreEmail,
      // A frozen "hard copy" of exactly what the winner owned when they
      // saved — see game/players.js snapshotPortfolio + game/leaderboard.js.
      portfolio: snapshotPortfolio(winner, assetPrices),
    });
    setSavedEntryId(entry.id);
    setSavedRank(entry.rank);
    // A Top 20 finish gets the bigger celebration; everyone else still gets
    // the regular save-confirmation chime.
    if (entry.rank >= 1 && entry.rank <= LEADERBOARD_TOP_HIGHLIGHT) {
      playSound('applause');
    } else {
      playSound('badge');
    }
  }

  return (
    <div className="vf-gameover">
      <Fireworks />
      <div className="vf-topbar-corner">
        <VolumeControl />
        <MusicControl />
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

        {closingChat.length > 0 && (
          <div className="vf-card vf-gameover__chat">
            {closingChat.map((c) => (
              <ChatEntryRow key={c.id} entry={c} />
            ))}
          </div>
        )}

        <div className="vf-card vf-save-score">
          <div className="vf-save-score__title">
            {savedEntryId ? '🎉 Added to the Leaderboard!' : `🏆 ${winner.avatar} Add your win to the Leaderboard!`}
          </div>

          {savedEntryId ? (
            <>
              <p className="vf-save-score__success">Nice work, {scoreName}! Your score is saved.</p>
              {savedRank >= 1 && savedRank <= LEADERBOARD_TOP_HIGHLIGHT && (
                <p className="vf-save-score__top20">
                  👏 Top {LEADERBOARD_TOP_HIGHLIGHT}! You landed at #{savedRank} on the Leaderboard!
                </p>
              )}
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
