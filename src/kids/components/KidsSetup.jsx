import { useState } from 'react';
import { PLAYER_AVATARS, DIFFICULTIES, BOT_PERSONALITIES } from '../../data/gameConfig';
import { playKidsSound } from '../audio/kidsSoundEngine';

// Only two of the three difficulties are offered here — 'hard' ($300 to
// start, no free skill token) is a tight-budget challenge mode aimed at
// players who already know the game; a first-time under-8 player doesn't
// need that decision put in front of them. Nothing about the engine
// changes — 'hard' still exists and is one tap away in the main game.
const KID_DIFFICULTY_IDS = ['easy', 'medium'];

const FRIEND_COUNTS = [1, 2, 3];

/** A friendly preview strip of bot avatars, just so "3 friends" doesn't
 * feel abstract — the ACTUAL personalities/skills are still rolled
 * randomly by game/players.js's resolveBotConfig, exactly like Quick Play. */
function friendPreview(count) {
  return BOT_PERSONALITIES.slice(0, count).map((p) => p.avatar);
}

export default function KidsSetup({ onStart, onBack }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(PLAYER_AVATARS[0]);
  const [friendCount, setFriendCount] = useState(2);
  const [difficultyId, setDifficultyId] = useState('easy');

  const difficulties = DIFFICULTIES.filter((d) => KID_DIFFICULTY_IDS.includes(d.id));

  function handleStart() {
    playKidsSound('businessLaunch');
    const mode = { type: 'solo', aiCount: friendCount };
    const humanNames = [name.trim() || 'Explorer'];
    const botConfigs = Array.from({ length: friendCount }, () => ({
      personalityId: 'random',
      skillLevelId: 'random',
    }));
    onStart(mode, humanNames, difficultyId, botConfigs, {
      scenarioId: 'classic',
      humanAvatars: [avatar],
    });
  }

  return (
    <div className="kv-setup">
      <h1 className="kv-title">Let's set up your game!</h1>
      <p className="kv-subtitle">Just a few quick choices, then you're off.</p>

      <div className="kv-setup__step">
        <div className="kv-setup__label">✏️ What's your name?</div>
        <input
          className="kv-setup__name-input"
          value={name}
          maxLength={18}
          placeholder="Type your name..."
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="kv-setup__step">
        <div className="kv-setup__label">🎭 Pick your avatar</div>
        <div className="kv-choice-grid">
          {PLAYER_AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              className={`kv-choice ${avatar === a ? 'kv-choice--selected' : ''}`}
              onClick={() => {
                playKidsSound('tap');
                setAvatar(a);
              }}
            >
              <span className="kv-choice__icon" aria-hidden="true">{a}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="kv-setup__step">
        <div className="kv-setup__label">🤖 How many game friends?</div>
        <div className="kv-choice-grid">
          {FRIEND_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              className={`kv-choice ${friendCount === count ? 'kv-choice--selected' : ''}`}
              onClick={() => {
                playKidsSound('tap');
                setFriendCount(count);
              }}
            >
              <span className="kv-choice__icon" aria-hidden="true">{friendPreview(count).join(' ')}</span>
              {count} friend{count === 1 ? '' : 's'}
            </button>
          ))}
        </div>
      </div>

      <div className="kv-setup__step">
        <div className="kv-setup__label">💰 How much money to start?</div>
        <div className="kv-choice-grid">
          {difficulties.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`kv-choice ${difficultyId === d.id ? 'kv-choice--selected' : ''}`}
              onClick={() => {
                playKidsSound('tap');
                setDifficultyId(d.id);
              }}
            >
              <span className="kv-choice__icon" aria-hidden="true">{d.icon}</span>
              ${d.startingCash}
              <span className="kv-choice__sub">{d.tagline}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="kv-landing__cta">
        <button
          type="button"
          className="kv-btn kv-btn--ghost"
          onClick={() => {
            playKidsSound('tap');
            onBack();
          }}
        >
          ⬅️ Back
        </button>
        <button type="button" className="kv-btn kv-btn--huge kv-btn--green" onClick={handleStart}>
          🚀 Start Playing!
        </button>
      </div>
    </div>
  );
}
