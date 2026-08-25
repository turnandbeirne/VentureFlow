import { useEffect, useState } from 'react';
import '../styles/game.css';
import { getDifficulty } from '../data/gameConfig';
import { usePlaySpeed } from '../hooks/usePlaySpeed';
import { turnOrdinal, currentTurnTally } from '../game/turnClock';
import { playSound } from '../audio/soundEngine';
import { playMusicTrack } from '../audio/musicEngine';
import WeatherBadge from './WeatherBadge';
import WeatherCard from './WeatherCard';
import MonthProgress from './MonthProgress';
import PlayerPanel from './PlayerPanel';
import AssetShop from './AssetShop';
import ActionBar from './ActionBar';
import EventLog from './EventLog';
import ChatPanel from './ChatPanel';
import FortuneCardModal from './FortuneCardModal';
import BusinessExitOfferModal from './BusinessExitOfferModal';
import VolumeControl from './VolumeControl';
import MusicControl from './MusicControl';
import Brand from './Brand';
import LeaderboardModal from './LeaderboardModal';
import RulebookModal from './RulebookModal';
import SpeedControl from './SpeedControl';
import TurnTimer from './TurnTimer';
import StartupLaunchModal from './StartupLaunchModal';
import PlayerDetailModal from './PlayerDetailModal';
import StatsHUD from './StatsHUD';

export default function GameBoard({ game }) {
  const { state } = game;
  const {
    players,
    activePlayerIndex,
    weather,
    assetPrices,
    previousAssetPrices,
    month,
    totalMonths,
    log,
    chat,
    status,
    weatherIncomeAmounts,
  } = state;
  const difficulty = getDifficulty(state.difficultyId);
  // Read live so a mid-game change to the slider takes effect on the very
  // next beat — including the robot-recap auto-advance below.
  const { speed } = usePlaySpeed();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showRulebook, setShowRulebook] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const activePlayer = players[activePlayerIndex];
  // What the active player has bought during THIS turn — the shop uses it to
  // warn that selling those units back carries the same-turn resale fee,
  // rather than letting the player discover it from the receipt. Declared
  // after `activePlayer`, which it reads.
  const sameTurnBuys = currentTurnTally(activePlayer?.turnBuys, turnOrdinal(state));
  // "You," for the persistent stats strip below: the active player when
  // it's a human's turn (so hotseat pass-and-play always shows whoever's
  // actually holding the device), otherwise the first human in the roster
  // (so solo mode still shows YOUR numbers while a robot plays, instead of
  // the robot's) — see StatsHUD.jsx.
  const hudPlayer = activePlayer?.type === 'human' ? activePlayer : players.find((p) => p.type === 'human') || null;

  // The soft instrumental plays for the whole time the board is up —
  // through every month, every turn, fortune-card recaps included — since
  // this component stays mounted for all of that; only game-over (a
  // different screen) swaps back to the theme song.
  useEffect(() => {
    playMusicTrack('background');
  }, []);
  const selectedPlayer = selectedPlayerId ? players.find((p) => p.id === selectedPlayerId) : null;
  const isHumanTurn = status === 'playing' && activePlayer?.type === 'human';
  const currentFortuneEntry = status === 'monthRecap' ? state.fortuneRecap[state.fortuneRecapIndex] : null;
  const currentFortunePlayer = currentFortuneEntry
    ? players.find((p) => p.id === currentFortuneEntry.playerId)
    : null;
  const showModalForHuman = currentFortuneEntry && currentFortunePlayer?.type === 'human';
  const pendingExitOffer = status === 'exitOffer' ? state.pendingExitOffer : null;
  const exitOfferPlayer = pendingExitOffer ? players.find((p) => p.id === pendingExitOffer.playerId) : null;

  // Robots don't need to see their own fortune-card recap — auto-advance
  // past their entries so only human players' cards pause the game.
  useEffect(() => {
    if (status !== 'monthRecap') return;
    if (!currentFortuneEntry) return;
    if (currentFortunePlayer?.type === 'ai') {
      const t = setTimeout(() => game.ackFortuneCard(), speed.recapAdvanceMs);
      return () => clearTimeout(t);
    }
    // Depends on the STABLE useCallback, not the whole `game` object: App
    // rebuilds that object on every one of its renders, so listing it here
    // cleared and restarted this timer each time. Harmless only because
    // nothing currently re-renders App during a recap — but at the fastest
    // speed (200ms) any future ticking state in App would restart the timer
    // faster than it could fire and hang the game on the recap screen.
  }, [status, currentFortuneEntry, currentFortunePlayer, game.ackFortuneCard, speed]);

  // Auto-dismiss error toasts.
  useEffect(() => {
    if (!state.lastError) return;
    const t = setTimeout(() => game.clearError(), 2400);
    return () => clearTimeout(t);
  }, [state.lastError, game.clearError]);

  return (
    <div className="vf-page">
      <div className="vf-board-layout">
        <div className="vf-card vf-board">
          <StatsHUD
            player={hudPlayer}
            prices={assetPrices}
            allPlayers={players}
            month={month}
            weatherIncomeAmounts={weatherIncomeAmounts}
            onOpenPortfolio={(playerId) => {
              setSelectedPlayerId(playerId);
            }}
          />

          <div className="vf-header">
            <Brand size="sm" align="left" />
            <div className="vf-header__right">
              <VolumeControl />
              <MusicControl />
              {/* Play speed lives in the board header, not just on setup,
                  because the whole point is being able to slow the table
                  down the moment it starts moving faster than you can
                  follow — mid-turn if need be. */}
              <SpeedControl />
              {/* Only renders when this game was started with the timer on
                  and it's a human's live turn — see TurnTimer.jsx. */}
              <TurnTimer
                enabled={!!state.turnTimer && isHumanTurn}
                deadlineAt={state.turnDeadlineAt}
                player={activePlayer}
                onStart={game.startTurnTimer}
                onExtend={() => game.extendTurn(activePlayer.id)}
                onExpire={() => game.endTurn(activePlayer.id)}
              />
              <button
                type="button"
                className="vf-btn vf-btn--sm vf-btn--ghost"
                title="Leaderboard"
                onClick={() => {
                  playSound('click');
                  setShowLeaderboard(true);
                }}
              >
                🏆
              </button>
              {/* Sits right next to the leaderboard so the rules are always
                  one tap away, on every screen size, at any point in a game
                  — see components/RulebookModal.jsx. */}
              <button
                type="button"
                className="vf-btn vf-btn--sm vf-btn--ghost"
                title="Rulebook — how everything works"
                onClick={() => {
                  playSound('click');
                  setShowRulebook(true);
                }}
              >
                📖
              </button>
              <span className="vf-pill" title={difficulty.tagline}>
                {difficulty.icon} {difficulty.name}
              </span>
              <WeatherBadge weather={weather} />
              <button
                type="button"
                className="vf-btn vf-btn--sm vf-btn--ghost"
                onClick={() => {
                  playSound('click');
                  game.newGame();
                }}
              >
                New Game
              </button>
            </div>
          </div>

          <MonthProgress month={month} totalMonths={totalMonths} />

          <PlayerPanel
            players={players}
            prices={assetPrices}
            month={month}
            weatherIncomeAmounts={weatherIncomeAmounts}
            activePlayerIndex={activePlayerIndex}
            spotlightMs={speed.spotlightMs}
            onSelectPlayer={(playerId) => {
              playSound('click');
              setSelectedPlayerId(playerId);
            }}
          />

          <div className={`vf-turn-banner ${isHumanTurn ? '' : 'vf-turn-banner--ai'}`}>
            <span className="vf-turn-banner__text">
              {status === 'exitOffer'
                ? `💼 ${exitOfferPlayer?.name || 'Someone'} has a buyout offer to decide on...`
                : status === 'monthRecap'
                ? '📬 Reading this month\'s fortune cards...'
                : isHumanTurn
                ? `${activePlayer.avatar} ${
                    activePlayer.name.toLowerCase() === 'you' ? 'Your' : `${activePlayer.name}'s`
                  } turn — what will you do?`
                : `🤖 ${activePlayer?.name} is thinking...`}
            </span>
            {/* A second "Done!" button, mirroring ActionBar's, so a human
                who's ready to pass can end their turn from up here without
                scrolling past the shop first — see ActionBar.jsx for the
                original at the bottom of the board, which stays in place
                for anyone who scrolls down anyway. Same enable condition,
                same handler; this is a duplicate control, not a new one. */}
            {isHumanTurn && (
              <button
                type="button"
                className="vf-btn vf-btn--primary vf-btn--sm vf-turn-banner__end-btn"
                onClick={() => game.endTurn(activePlayer.id)}
              >
                Done! Roll the weather 🎲
              </button>
            )}
          </div>

          <AssetShop
            prices={assetPrices}
            previousPrices={previousAssetPrices}
            player={activePlayer}
            allPlayers={players}
            weather={weather}
            weatherIncomeAmounts={weatherIncomeAmounts}
            sameTurnBuys={sameTurnBuys}
            disabled={!isHumanTurn}
            onBuy={(assetId) => game.buyAsset(activePlayer.id, assetId, 1)}
            onSell={(assetId) => game.sellAsset(activePlayer.id, assetId, 1)}
          />

          <ActionBar
            player={activePlayer}
            disabled={!isHumanTurn}
            onStartBusiness={() => game.startBusiness(activePlayer.id)}
            onLearnSkill={() => game.learnSkill(activePlayer.id)}
            onDone={() => game.endTurn(activePlayer.id)}
          />
        </div>

        {/* Sidebar: weather detail, the event log, and chat all stay in view
            at once on wider screens (sticky) instead of requiring scrolling
            past the board below them — falls back to stacking under the
            board on narrow screens, see game.css's .vf-board-layout.
            EventLog sits above ChatPanel: what actually happened this
            month is the thing you want to catch up on first, with the
            robots' in-character banter as a lower-priority feed below it. */}
        <div className="vf-board-sidebar">
          <WeatherCard
            weather={weather}
            weatherIncomeAmounts={weatherIncomeAmounts}
            weatherSeverityId={state.weatherSeverityId}
          />
          <EventLog log={log} />
          <ChatPanel chat={chat} players={players} onSendChat={game.sendChat} />
        </div>
      </div>

      {showModalForHuman && (
        <FortuneCardModal entry={currentFortuneEntry} onContinue={game.ackFortuneCard} />
      )}

      {pendingExitOffer && (
        <BusinessExitOfferModal
          offer={pendingExitOffer}
          playerName={exitOfferPlayer?.name}
          playerAvatar={exitOfferPlayer?.avatar}
          onDecide={(accept) => game.resolveExitOffer(pendingExitOffer.playerId, accept)}
        />
      )}

      <LeaderboardModal open={showLeaderboard} onClose={() => setShowLeaderboard(false)} />

      <RulebookModal
        open={showRulebook}
        difficultyId={state.difficultyId}
        scenarioId={state.scenarioId}
        weatherSeverityId={state.weatherSeverityId}
        turnTimer={!!state.turnTimer}
        onClose={() => setShowRulebook(false)}
      />

      {/* Launch celebration for a business a human just started. Rendered
          last so it sits above the portfolio modal the player almost
          certainly has open behind it. */}
      {state.pendingLaunch && (
        <StartupLaunchModal launch={state.pendingLaunch} onContinue={game.ackStartupLaunch} />
      )}

      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          prices={assetPrices}
          allPlayers={players}
          month={month}
          weather={weather}
          weatherIncomeAmounts={weatherIncomeAmounts}
          // Upgrade buttons only appear when viewing YOUR OWN active turn —
          // opening any other player's card (including mid-turn, including
          // AI) stays read-only, same as it always has been.
          canUpgrade={isHumanTurn && selectedPlayer.id === activePlayer?.id}
          onUpgradeBusiness={(playerId, businessId, trackId) => game.upgradeBusiness(playerId, businessId, trackId)}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {state.lastError && <div className="vf-toast">{state.lastError}</div>}
    </div>
  );
}
