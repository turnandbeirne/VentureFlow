import { useEffect, useMemo, useState } from 'react';
import '../styles/setup.css';
import {
  DIFFICULTIES,
  DEFAULT_DIFFICULTY_ID,
  GAME_LENGTH_MONTHS,
  BOT_PERSONALITIES,
  SKILL_LEVELS,
  SCENARIOS,
  DEFAULT_SCENARIO_ID,
} from '../data/gameConfig';
import { playSound } from '../audio/soundEngine';
import { playMusicTrack } from '../audio/musicEngine';
import { isOffensiveName } from '../game/nameFilter';
import {
  todayChallengeDate,
  DAILY_CHALLENGE_BOT_CONFIGS,
  DAILY_CHALLENGE_DIFFICULTY_ID,
  DAILY_CHALLENGE_SCENARIO_ID,
} from '../game/dailyChallenge';
import { useProfile } from '../hooks/useProfile';
import VolumeControl from './VolumeControl';
import MusicControl from './MusicControl';
import Brand from './Brand';
import LeaderboardModal from './LeaderboardModal';
import InfoModal from './InfoModal';
import UnlocksModal from './UnlocksModal';

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
  const [botConfigs, setBotConfigs] = useState([
    { personalityId: 'random', skillLevelId: 'random' },
    { personalityId: 'random', skillLevelId: 'random' },
  ]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showUnlocks, setShowUnlocks] = useState(false);
  const [difficultyId, setDifficultyId] = useState(DEFAULT_DIFFICULTY_ID);
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const [infoScenarioId, setInfoScenarioId] = useState(null);
  const difficulty = DIFFICULTIES.find((d) => d.id === difficultyId) || DIFFICULTIES[0];
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
  const infoScenario = infoScenarioId ? SCENARIOS.find((s) => s.id === infoScenarioId) : null;

  const { profile, avatars, avatarProgress, themeProgress, selectTheme } = useProfile();
  const [avatarChoices, setAvatarChoices] = useState([avatars[0], avatars[1], avatars[2]]);

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

  function updateAvatar(index, avatar) {
    playSound('click');
    setAvatarChoices((prev) => {
      const next = [...prev];
      next[index] = avatar;
      return next;
    });
  }

  function updateBotConfig(index, field, value) {
    playSound('click');
    setBotConfigs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
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

  function selectScenario(id) {
    playSound('click');
    setScenarioId(id);
  }

  function openScenarioInfo(id) {
    playSound('click');
    setInfoScenarioId(id);
  }

  function handleStart() {
    if (hasInvalidName) {
      playSound('error');
      return;
    }
    playSound('business');
    if (modeId === 'solo') {
      onStart({ type: 'solo', aiCount }, [names[0] || 'You'], difficultyId, botConfigs.slice(0, aiCount), {
        scenarioId,
        humanAvatars: [avatarChoices[0]],
      });
    } else {
      onStart({ type: 'hotseat', humanCount }, names.slice(0, humanCount), difficultyId, [], {
        scenarioId,
        humanAvatars: avatarChoices.slice(0, humanCount),
      });
    }
  }

  function handleDailyChallenge() {
    playSound('business');
    onStart({ type: 'solo', aiCount: DAILY_CHALLENGE_BOT_CONFIGS.length }, [names[0] || 'You'], DAILY_CHALLENGE_DIFFICULTY_ID, DAILY_CHALLENGE_BOT_CONFIGS, {
      scenarioId: DAILY_CHALLENGE_SCENARIO_ID,
      humanAvatars: [avatarChoices[0]],
      dailyChallengeDate: todayChallengeDate(),
    });
  }

  function openLeaderboard() {
    playSound('click');
    setShowLeaderboard(true);
  }

  function openUnlocks() {
    playSound('click');
    setShowUnlocks(true);
  }

  return (
    <div className="vf-setup">
      <div className="vf-topbar-corner">
        <VolumeControl />
        <MusicControl />
        <button type="button" className="vf-btn vf-btn--sm vf-btn--ghost" onClick={openUnlocks}>
          🏅 Unlocks
        </button>
        <button type="button" className="vf-btn vf-btn--sm vf-btn--ghost" onClick={openLeaderboard}>
          🏆 Leaderboard
        </button>
      </div>
      <div className="vf-setup__inner">
        <div className="vf-setup__logo">
          <Brand size="lg" align="center" />
        </div>
        <p className="vf-setup__tagline">Grow your money over {GAME_LENGTH_MONTHS} months. Highest total wins!</p>

        <button type="button" className="vf-card vf-daily-challenge" onClick={handleDailyChallenge}>
          <span className="vf-daily-challenge__icon">🗓️</span>
          <span className="vf-daily-challenge__body">
            <span className="vf-daily-challenge__title">Today's Challenge</span>
            <span className="vf-daily-challenge__desc">
              Same weather and cards as everyone else playing today — see how you stack up!
            </span>
          </span>
          <span className="vf-daily-challenge__go">Play →</span>
        </button>

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
                <span className="vf-field-label">Choose your robots</span>
                <div className="vf-bot-picker">
                  {Array.from({ length: aiCount }).map((_, i) => (
                    <div key={i} className="vf-bot-picker__row">
                      <span className="vf-bot-picker__slot">Robot {i + 1}</span>
                      <select
                        className="vf-select"
                        value={botConfigs[i].personalityId}
                        onChange={(e) => updateBotConfig(i, 'personalityId', e.target.value)}
                        aria-label={`Robot ${i + 1} personality`}
                      >
                        <option value="random">🎲 Random</option>
                        {BOT_PERSONALITIES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.avatar} {p.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="vf-select"
                        value={botConfigs[i].skillLevelId}
                        onChange={(e) => updateBotConfig(i, 'skillLevelId', e.target.value)}
                        aria-label={`Robot ${i + 1} skill level`}
                      >
                        <option value="random">🎲 Random</option>
                        {SKILL_LEVELS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.icon} {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <p className="vf-bot-picker__hint">
                  Each robot has its own play style — leave on Random to be surprised!
                </p>
              </div>
              <div>
                <span className="vf-field-label">Your avatar</span>
                <div className="vf-avatar-picker">
                  {avatars.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={`vf-avatar-picker__option ${avatarChoices[0] === a ? 'vf-avatar-picker__option--active' : ''}`}
                      onClick={() => updateAvatar(0, a)}
                      aria-label={`Pick avatar ${a}`}
                    >
                      {a}
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
                <span className="vf-field-label">Player names & avatars</span>
                <div className="vf-name-inputs">
                  {Array.from({ length: humanCount }).map((_, i) => (
                    <div key={i} className="vf-name-inputs__row">
                      <input
                        className="vf-text-input"
                        type="text"
                        placeholder={`Player ${i + 1}`}
                        value={names[i]}
                        onChange={(e) => updateName(i, e.target.value)}
                        maxLength={16}
                      />
                      <div className="vf-avatar-picker vf-avatar-picker--compact">
                        {avatars.map((a) => (
                          <button
                            key={a}
                            type="button"
                            className={`vf-avatar-picker__option ${avatarChoices[i] === a ? 'vf-avatar-picker__option--active' : ''}`}
                            onClick={() => updateAvatar(i, a)}
                            aria-label={`Player ${i + 1} avatar ${a}`}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                      {nameErrors[i] && <span className="vf-field-error">Please pick a different name.</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div>
          <span className="vf-field-label">Your goal this game</span>
          <div className="vf-scenario-grid">
            {SCENARIOS.map((s) => (
              <div
                key={s.id}
                className={`vf-card vf-scenario-card ${scenarioId === s.id ? 'vf-scenario-card--active' : ''}`}
              >
                <button type="button" className="vf-scenario-card__pick" onClick={() => selectScenario(s.id)}>
                  <span className="vf-scenario-card__icon">{s.icon}</span>
                  <h3>{s.name}</h3>
                  <p>{s.tagline}</p>
                </button>
                <button
                  type="button"
                  className="vf-scenario-card__info"
                  onClick={() => openScenarioInfo(s.id)}
                  aria-label={`What does ${s.name} mean?`}
                  title="What does this mean?"
                >
                  ⓘ
                </button>
              </div>
            ))}
          </div>
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
          <span className="vf-pill">
            {scenario.icon} {scenario.name}
          </span>
        </div>

        <div className="vf-setup__start">
          <button type="button" className="vf-btn vf-btn--go vf-btn--lg" onClick={handleStart} disabled={hasInvalidName}>
            Let's Play! 🎉
          </button>
        </div>
      </div>

      <LeaderboardModal open={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <UnlocksModal
        open={showUnlocks}
        onClose={() => setShowUnlocks(false)}
        profile={profile}
        avatarProgress={avatarProgress}
        themeProgress={themeProgress}
        onSelectTheme={selectTheme}
      />
      <InfoModal
        open={Boolean(infoScenario)}
        icon={infoScenario?.icon}
        title={infoScenario?.name}
        body={infoScenario?.details}
        onClose={() => setInfoScenarioId(null)}
      />
    </div>
  );
}
