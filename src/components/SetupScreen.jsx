import { useEffect, useMemo, useState } from 'react';
import '../styles/setup.css';
import { DIFFICULTIES, DEFAULT_DIFFICULTY_ID, GAME_LENGTH_MONTHS } from '../data/gameConfig';
import { playSound } from '../audio/soundEngine';
import { playMusicTrack } from '../audio/musicEngine';
import { isOffensiveName } from '../game/nameFilter';
import VolumeControl from './VolumeControl';
import MusicControl from './MusicControl';
import Brand from './Brand';
import LeaderboardModal from './LeaderboardModal';

const MODES = [
  {
    id: 'solo',
    icon: '🤖',
    title: 'Solo vs Robots',
    description: 'You against 1 or 2 AI robot players.',
  },
  {
    id: 'hotseat',
    icon: '🪑',
    title: 'Hot-Seat Party',
    description: '2-3 humans pass the device and take turns.',
  },
];

export default function SetupScreen({ onStart }) {
  const [modeId, setModeId] = useState('solo');
  const [aiCount, setAiCount] = useState(1);
  const [humanCount, setHumanCount] = useState(2);
  const [names, setNames] = useState(['', '', '']);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [difficultyId, setDifficultyId] = useState(DEFAULT_DIFFICULTY_ID);
  const difficulty = DIFFICULTIES.find((d) => d.id === difficultyId) || DIFFICULTIES[0];

  // The opening theme plays here at normal volume — same track picks back
  // up (no restart) if you land back here via "Play Again" from the
  // game-over screen, since that screen plays the same track.
  useEffect(() => {
    playMusicTrack('theme');
  }, []);

  const activeNameCount = modeId === 'solo' ? 1 : humanCount;
  const nameErrors = useMemo(
    () => names.map((n, i) => i < activeNameCount && n.trim() && isOffensiveName(n)),
    [names, activeNameCount]
  );
  const hasInvalidName = nameErrors.some(Boolean);

  function updateName(index, value) {
    setNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function selectMode(id) {
    playSound('click');
    setModeId(id);
  }

  function selectDifficulty(id) {
    playSound('click');
    setDifficultyId(id);
  }

  function handleStart() {
    if (hasInvalidName) {
      playSound('error');
      return;
    }
    playSound('business');
    if (modeId === 'solo') {
      onStart({ type: 'solo', aiCount }, [names[0] || 'You'], difficultyId);
    } else {
      onStart({ type: 'hotseat', humanCount }, names.slice(0, humanCount), difficultyId);
    }
  }

  function openLeaderboard() {
    playSound('click');
    setShowLeaderboard(true);
  }

  return (
    <div className="vf-setup">
      <div className="vf-topbar-corner">
        <VolumeControl />
        <MusicControl />
        <button type="button" className="vf-btn vf-btn--sm vf-btn--ghost" onClick={openLeaderboard}>
          🏆 Leaderboard
        </button>
      </div>
      <div className="vf-setup__inner">
        <div className="vf-setup__logo">
          <Brand size="lg" align="center" />
        </div>
        <p className="vf-setup__tagline">Grow your money over {GAME_LENGTH_MONTHS} months. Highest total wins!</p>

        <div className="vf-mode-grid">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`vf-card vf-mode-card ${modeId === mode.id ? 'vf-mode-card--active' : ''}`}
              onClick={() => selectMode(mode.id)}
            >
              <span className="vf-mode-card__icon">{mode.icon}</span>
              <h3>{mode.title}</h3>
              <p>{mode.description}</p>
            </button>
          ))}
        </div>

        <div className="vf-card vf-setup__options">
          {modeId === 'solo' ? (
            <>
              <div>
                <span className="vf-field-label">How many robot players?</span>
                <div className="vf-count-toggle">
                  {[1, 2].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`vf-btn ${aiCount === n ? 'vf-btn--primary' : 'vf-btn--ghost'}`}
                      onClick={() => {
                        playSound('click');
                        setAiCount(n);
                      }}
                    >
                      {n} {n === 1 ? 'Robot' : 'Robots'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="vf-field-label">Your name</span>
                <input
                  className="vf-text-input"
                  type="text"
                  placeholder="You"
                  value={names[0]}
                  onChange={(e) => updateName(0, e.target.value)}
                  maxLength={16}
                />
                {nameErrors[0] && <span className="vf-field-error">Please pick a different name.</span>}
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="vf-field-label">How many players?</span>
                <div className="vf-count-toggle">
                  {[2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`vf-btn ${humanCount === n ? 'vf-btn--primary' : 'vf-btn--ghost'}`}
                      onClick={() => {
                        playSound('click');
                        setHumanCount(n);
                      }}
                    >
                      {n} Players
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="vf-field-label">Player names</span>
                <div className="vf-name-inputs">
                  {Array.from({ length: humanCount }).map((_, i) => (
                    <div key={i}>
                      <input
                        className="vf-text-input"
                        type="text"
                        placeholder={`Player ${i + 1}`}
                        value={names[i]}
                        onChange={(e) => updateName(i, e.target.value)}
                        maxLength={16}
                      />
                      {nameErrors[i] && <span className="vf-field-error">Please pick a different name.</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div>
          <span className="vf-field-label">Challenge level</span>
          <div className="vf-difficulty-grid">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`vf-card vf-difficulty-card ${difficultyId === d.id ? 'vf-difficulty-card--active' : ''}`}
                onClick={() => selectDifficulty(d.id)}
              >
                <span className="vf-difficulty-card__icon">{d.icon}</span>
                <h3>{d.name}</h3>
                <p>{d.tagline}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="vf-setup__starting-info">
          <span className="vf-pill">💵 Start with ${difficulty.startingCash}</span>
          <span className="vf-pill">📅 ${difficulty.monthlyAllowance}/mo allowance</span>
          <span className="vf-pill">
            💡 {difficulty.startingSkillTokens} skill token{difficulty.startingSkillTokens === 1 ? '' : 's'}
          </span>
        </div>

        <div className="vf-setup__start">
          <button type="button" className="vf-btn vf-btn--go vf-btn--lg" onClick={handleStart} disabled={hasInvalidName}>
            Let's Play! 🎉
          </button>
        </div>
      </div>

      <LeaderboardModal open={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
    </div>
  );
}
