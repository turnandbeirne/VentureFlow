import { useEffect, useRef, useState } from 'react';
import '../styles/game.css';
import { LEADERBOARD_TOP_HIGHLIGHT, getScenario } from '../data/gameConfig';
import { netWorth, passiveIncome, snapshotPortfolio } from '../game/players';
import { isOffensiveName } from '../game/nameFilter';
import { playSound } from '../audio/soundEngine';
import { playMusicTrack } from '../audio/musicEngine';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { buildInsights } from '../game/insights';
import VolumeControl from './VolumeControl';
import MusicControl from './MusicControl';
import Brand from './Brand';
import LeaderboardModal from './LeaderboardModal';
import Fireworks from './Fireworks';
import { ChatEntryRow } from './ChatPanel';
import NetWorthChart from './NetWorthChart';
import FamilyRecapModal from './FamilyRecapModal';
import PlayerDetailModal from './PlayerDetailModal';

export default function GameOverScreen({ state, onPlayAgain, onRecordProfileResult }) {
  const { players, assetPrices, winnerId, mode, difficultyId, scenarioId, dailyChallengeDate, month } = state;
  const ranked = [...players].sort((a, b) => netWorth(b, assetPrices) - netWorth(a, assetPrices));
  const winner = players.find((p) => p.id === winnerId) || ranked[0];
  const scenario = getScenario(scenarioId);

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
  const [showRecap, setShowRecap] = useState(false);
  const [unlockCelebration, setUnlockCelebration] = useState(null);
  // Which standings row (if any) has its full portfolio breakdown open —
  // read-only here (game's over, nothing left to upgrade), but this is
  // exactly what makes it possible to see at a glance how much a specific
  // holding (lemonade's price swings, a business's upgrades, etc.) actually
  // contributed, instead of only ever seeing the final net-worth total.
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const selectedPlayer = selectedPlayerId ? players.find((p) => p.id === selectedPlayerId) : null;

  const insights = buildInsights(winner, assetPrices);

  // Whichever human player did best this game "counts" toward the lifetime
  // profile (see game/profile.js) — the natural choice in solo mode (only
  // one human); in hot-seat, the best-performing human of the table. Fires
  // exactly once, when this screen first shows for a finished game. The
  // recordedRef guard (rather than relying on the empty dep array alone)
  // is what actually makes that true: React 18 StrictMode intentionally
  // double-invokes mount effects in development to surface exactly this
  // kind of non-idempotent side effect, which would otherwise double-count
  // gamesPlayed/badgesEarned for every game in dev builds.
  const recordedRef = useRef(false);
  useEffect(() => {
    if (recordedRef.current) return;
    const humans = players.filter((p) => p.type === 'human');
    if (humans.length === 0 || !onRecordProfileResult) return;
    recordedRef.current = true;
    const bestHuman = [...humans].sort((a, b) => netWorth(b, assetPrices) - netWorth(a, assetPrices))[0];
    const result = onRecordProfileResult({
      netWorth: netWorth(bestHuman, assetPrices),
      passiveIncome: passiveIncome(bestHuman, { allPlayers: players, prices: assetPrices, month, weatherIncomeAmounts: state.weatherIncomeAmounts }),
      badgesEarnedThisGame: bestHuman.badges.length,
    });
    if (result && (result.newlyUnlockedAvatars.length > 0 || result.newlyUnlockedThemes.length > 0)) {
      setUnlockCelebration(result);
      playSound('badge');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      dailyChallengeDate: dailyChallengeDate || null,
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

  function openRecap() {
    playSound('click');
    setShowRecap(true);
  }

  // Which players (if any) hit the scenario's objective — see
  // game/scenarios.js; Classic Growth and Survive the Crash have none.
  const objectiveAchievers = scenario.objective ? players.filter((p) => p.scenarioGoalMonth != null) : [];
  const survivedCrash = scenario.id === 'survivalCrash' ? netWorth(winner, assetPrices) > winner.cash : false;

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

        <div className="vf-gameover__scenario-pill">
          <span className="vf-pill">
            {scenario.icon} {scenario.name}
            {dailyChallengeDate && ' · 🗓️ Today\'s Challenge'}
          </span>
        </div>

        {scenario.objective && (
          <p className="vf-gameover__objective">
            {objectiveAchievers.length > 0
              ? `🎯 Goal reached! ${objectiveAchievers.map((p) => `${p.avatar} ${p.name}`).join(', ')} hit the scenario objective.`
              : "🎯 Nobody quite reached this scenario's goal this time — give it another shot!"}
          </p>
        )}
        {scenario.id === 'survivalCrash' && (
          <p className="vf-gameover__objective">
            {survivedCrash
              ? `⛈️ You started this game in a storm and still grew your money — nice recovery!`
              : `⛈️ Starting in a storm is tough — you finished lower than you started this time. Try again?`}
          </p>
        )}

        {unlockCelebration && (
          <div className="vf-gameover__unlock">
            🎉 New unlock!{' '}
            {unlockCelebration.newlyUnlockedAvatars.map((a) => (
              <span key={a}>{a} </span>
            ))}
            {unlockCelebration.newlyUnlockedThemes.map((t) => (
              <span key={t.id}>
                {t.icon} {t.name} theme{' '}
              </span>
            ))}
            — check "🏅 Unlocks" on the setup screen!
          </div>
        )}

        <div className="vf-standings">
          {ranked.map((player, i) => (
            <button
              key={player.id}
              type="button"
              className={`vf-standing-row ${player.id === winnerId ? 'vf-standing-row--winner' : ''}`}
              onClick={() => {
                playSound('click');
                setSelectedPlayerId(player.id);
              }}
              title="Tap for a full portfolio breakdown"
            >
              <span className="vf-standing-row__rank">{i + 1}</span>
              <span>
                {player.avatar} {player.name}
              </span>
              <span>${netWorth(player, assetPrices).toLocaleString()}</span>
            </button>
          ))}
        </div>
        <p className="vf-gameover__standings-hint">🔍 Tap a player for their full portfolio breakdown</p>

        <div className="vf-card vf-gameover__chart-card">
          <div className="vf-section-title">
            <span>📊</span>
            <span>How your money grew</span>
          </div>
          <NetWorthChart players={players} />
          {insights.length > 0 && (
            <div className="vf-gameover__insights">
              {insights.map((insight) => (
                <p key={insight.text} className="vf-gameover__insight">
                  {insight.icon} {insight.text}
                </p>
              ))}
            </div>
          )}
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

        <div className="vf-gameover__actions">
          <button type="button" className="vf-btn vf-btn--ghost" onClick={openRecap}>
            📋 Family Recap
          </button>
          <button type="button" className="vf-btn vf-btn--go vf-btn--lg" onClick={handlePlayAgain}>
            Play Again 🔁
          </button>
        </div>
      </div>

      <LeaderboardModal open={showLeaderboard} onClose={() => setShowLeaderboard(false)} highlightId={savedEntryId} />
      <FamilyRecapModal open={showRecap} onClose={() => setShowRecap(false)} state={state} prices={assetPrices} />
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          prices={assetPrices}
          allPlayers={players}
          month={month}
          weather={state.weather}
          weatherIncomeAmounts={state.weatherIncomeAmounts}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  );
}
