import { useState } from 'react';
import '../styles/setup.css';
import { STARTING_CASH, MONTHLY_ALLOWANCE, STARTING_SKILL_TOKENS, GAME_LENGTH_MONTHS } from '../data/gameConfig';
import { playSound } from '../audio/soundEngine';
import VolumeControl from './VolumeControl';

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

  function handleStart() {
    playSound('business');
    if (modeId === 'solo') {
      onStart({ type: 'solo', aiCount }, [names[0] || 'You']);
    } else {
      onStart({ type: 'hotseat', humanCount }, names.slice(0, humanCount));
    }
  }

  return (
    <div className="vf-setup">
      <div className="vf-topbar-corner">
        <VolumeControl />
      </div>
      <div className="vf-setup__inner">
        <div className="vf-setup__logo">
          <h1>
            Venture<span>Flow</span>
          </h1>
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
                    <input
                      key={i}
                      className="vf-text-input"
                      type="text"
                      placeholder={`Player ${i + 1}`}
                      value={names[i]}
                      onChange={(e) => updateName(i, e.target.value)}
                      maxLength={16}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="vf-setup__starting-info">
          <span className="vf-pill">💵 Start with ${STARTING_CASH}</span>
          <span className="vf-pill">📅 ${MONTHLY_ALLOWANCE}/mo allowance</span>
          <span className="vf-pill">💡 {STARTING_SKILL_TOKENS} skill token</span>
        </div>

        <div className="vf-setup__start">
          <button type="button" className="vf-btn vf-btn--go vf-btn--lg" onClick={handleStart}>
            Let's Play! 🎉
          </button>
        </div>
      </div>
    </div>
  );
}
