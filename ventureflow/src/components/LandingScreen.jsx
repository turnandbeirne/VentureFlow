import { useEffect, useState } from 'react';
import '../styles/setup.css';
import '../styles/landing.css';
import {
  GAME_LENGTH_MONTHS,
  HOW_TO_PLAY_VIDEO_URL,
  BUSINESS_COST,
  SKILL_COST,
  BOT_PERSONALITIES,
  SCENARIOS,
  getDifficulty,
} from '../data/gameConfig';
import { playSound } from '../audio/soundEngine';
import { playMusicTrack } from '../audio/musicEngine';
import { rollQuickPlaySetup } from '../game/quickPlay';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useProfile } from '../hooks/useProfile';
import Brand from './Brand';
import HeroGraphic from './HeroGraphic';
import RulebookTicker from './RulebookTicker';
import RulebookModal from './RulebookModal';
import LeaderboardModal from './LeaderboardModal';
import VolumeControl from './VolumeControl';
import MusicControl from './MusicControl';
import SpeedControl from './SpeedControl';
import VentureMakerLink from './VentureMakerLink';

const TOP_N = 5;
const MEDALS = ['🥇', '🥈', '🥉'];

/** The three-beat pitch. Numbers come from gameConfig so the landing page
 * can't advertise rules the game no longer has. */
const PITCH = [
  {
    icon: '🛒',
    title: 'Buy things that grow',
    body: 'Piggy banks, lemonade stands, tree houses, treasure chests — each with its own risk and its own way of paying you back.',
  },
  {
    icon: '🚀',
    title: 'Start real businesses',
    body: `Learn a skill for $${SKILL_COST}, start a business for $${BUSINESS_COST}, then grow it with marketing, sales, operations and R&D.`,
  },
  {
    icon: '🌦️',
    title: 'Ride the weather',
    body: 'A hidden economic cycle moves every price — booms, storms, and rebounds. The players who plan for both do best.',
  },
];

/**
 * The first thing anybody sees: what VentureFlow is, what the game looks
 * like, who's winning, and two ways in — one click to play, or open the full
 * setup and choose everything.
 *
 * The design brief this answers is "intuitive and clear to jump into a
 * game": Quick Play is the primary button and needs no decisions at all
 * (game/quickPlay.js rolls scenario, difficulty, and opponents), while
 * Customize leads to the existing setup screen for anyone who wants to pick.
 * Both routes call the same `onStart`, so there's one code path into a game.
 *
 * The opening theme starts here rather than on the setup screen, and
 * `playMusicTrack` is a no-op when the same track is already playing — so
 * moving Landing → Customize → back doesn't restart the song mid-phrase.
 */
export default function LandingScreen({ onStart, onCustomize }) {
  const { entries } = useLeaderboard();
  // Only the unlocked-avatar list is needed here — the profile stores
  // cosmetics and lifetime totals, not a saved player name, so Quick Play
  // uses the same "You" default the setup screen does.
  const { avatars } = useProfile();
  const [showRulebook, setShowRulebook] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    playMusicTrack('theme');
  }, []);

  const top = [...entries].sort((a, b) => b.netWorth - a.netWorth).slice(0, TOP_N);

  function handleQuickPlay() {
    playSound('business');
    const setup = rollQuickPlaySetup({ avatar: avatars[0] });
    onStart(setup.mode, setup.humanNames, setup.difficultyId, setup.botConfigs, setup.options);
  }

  function handleCustomize() {
    playSound('click');
    onCustomize();
  }

  return (
    <div className="vf-landing">
      <div className="vf-topbar-corner">
        <VolumeControl />
        <MusicControl />
        <SpeedControl compact={false} />
      </div>

      <div className="vf-landing__inner">
        <header className="vf-landing__hero">
          <div className="vf-landing__hero-art">
            <HeroGraphic />
          </div>
          <div className="vf-landing__hero-copy">
            <Brand size="lg" align="left" />
            <p className="vf-landing__lede">
              A money game you can actually learn from. Take {GAME_LENGTH_MONTHS} months, turn a small allowance into
              businesses and investments, and see whose plan holds up when the weather turns.
            </p>
            <div className="vf-landing__cta">
              <button type="button" className="vf-btn vf-btn--primary vf-btn--lg" onClick={handleQuickPlay}>
                ⚡ Quick Play
              </button>
              <button type="button" className="vf-btn vf-btn--warm vf-btn--lg" onClick={handleCustomize}>
                🎛️ Customize a game
              </button>
            </div>
            <p className="vf-landing__cta-hint">
              Quick Play rolls the scenario, difficulty and robot opponents for you — nothing to decide, straight into
              month 1.
            </p>
            {/* A separate, simpler edition built for players under 8 — see
                src/kids/KidsApp.jsx. It's a standalone static entry point
                (main.jsx's tiny `/kids` route), not a mode of THIS app, so
                it links out via a plain <a> rather than onStart. Kept
                visually distinct (its own candy-bright class, not vf-btn)
                so it reads as "a different, kid-sized game" rather than one
                more option among Quick Play / Customize. */}
            <a href="/kids" className="vf-kids-link" onClick={() => playSound('click')}>
              <span className="vf-kids-link__icon">🧒</span>
              Play the Kids Version
            </a>
            {HOW_TO_PLAY_VIDEO_URL && (
              <a
                className="vf-landing__video"
                href={HOW_TO_PLAY_VIDEO_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                ▶️ Watch how to play
              </a>
            )}
          </div>
        </header>

        <section className="vf-landing__pitch">
          {PITCH.map((item) => (
            <div key={item.title} className="vf-card vf-landing__pitch-card">
              <span className="vf-landing__pitch-icon">{item.icon}</span>
              <h3 className="vf-landing__pitch-title">{item.title}</h3>
              <p className="vf-landing__pitch-body">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="vf-landing__columns">
          <div className="vf-card vf-landing__board">
            <div className="vf-ticker__header">
              <span className="vf-ticker__title">🏆 Top {TOP_N}</span>
              <button
                type="button"
                className="vf-btn vf-btn--sm vf-btn--ghost"
                onClick={() => {
                  playSound('click');
                  setShowLeaderboard(true);
                }}
              >
                Full leaderboard
              </button>
            </div>
            {top.length === 0 ? (
              <p className="vf-landing__empty">
                No scores saved yet — the first name here could be yours. Finish a game and add your result.
              </p>
            ) : (
              <ol className="vf-landing__scores">
                {top.map((entry, i) => (
                  <li key={entry.id || `${entry.name}-${i}`} className="vf-landing__score-row">
                    <span className="vf-landing__score-rank">{MEDALS[i] || `#${i + 1}`}</span>
                    <span className="vf-landing__score-who">
                      <span aria-hidden="true">{entry.avatar}</span> {entry.name}
                    </span>
                    <span
                      className="vf-landing__score-diff"
                      title={entry.difficultyId ? getDifficulty(entry.difficultyId).name : 'Difficulty not recorded'}
                    >
                      {entry.difficultyId ? getDifficulty(entry.difficultyId).icon : ''}
                    </span>
                    <span className="vf-landing__score-value">${entry.netWorth.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <RulebookTicker
            onOpenFull={() => {
              playSound('click');
              setShowRulebook(true);
            }}
          />
        </section>

        <section className="vf-landing__meta">
          <div className="vf-landing__meta-item">
            <strong>{SCENARIOS.length} scenarios</strong>
            <span>Classic growth, a passive-income race, a mid-crash survival run, or a business sprint.</span>
          </div>
          <div className="vf-landing__meta-item">
            <strong>{BOT_PERSONALITIES.length} robot rivals</strong>
            <span>Each with its own strategy, its own skill level, and a lot of opinions in the chat.</span>
          </div>
          <div className="vf-landing__meta-item">
            <strong>Play at your pace</strong>
            <span>Use the speed slider above — or change it mid-game — to watch every move land one at a time.</span>
          </div>
        </section>

        <VentureMakerLink className="vf-landing__vm" />
      </div>

      <RulebookModal open={showRulebook} onClose={() => setShowRulebook(false)} />
      <LeaderboardModal open={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
    </div>
  );
}
