import { useEffect } from 'react';
import '../styles/game.css';
import WeatherBadge from './WeatherBadge';
import MonthProgress from './MonthProgress';
import PlayerPanel from './PlayerPanel';
import AssetShop from './AssetShop';
import ActionBar from './ActionBar';
import EventLog from './EventLog';
import FortuneCardModal from './FortuneCardModal';

export default function GameBoard({ game }) {
  const { state } = game;
  const { players, activePlayerIndex, weather, assetPrices, previousAssetPrices, month, totalMonths, log, status } = state;
  const activePlayer = players[activePlayerIndex];
  const isHumanTurn = status === 'playing' && activePlayer?.type === 'human';
  const currentFortuneEntry = status === 'monthRecap' ? state.fortuneRecap[state.fortuneRecapIndex] : null;
  const currentFortunePlayer = currentFortuneEntry
    ? players.find((p) => p.id === currentFortuneEntry.playerId)
    : null;
  const showModalForHuman = currentFortuneEntry && currentFortunePlayer?.type === 'human';

  // Robots don't need to see their own fortune-card recap — auto-advance
  // past their entries so only human players' cards pause the game.
  useEffect(() => {
    if (status !== 'monthRecap') return;
    if (!currentFortuneEntry) return;
    if (currentFortunePlayer?.type === 'ai') {
      const t = setTimeout(() => game.ackFortuneCard(), 400);
      return () => clearTimeout(t);
    }
  }, [status, currentFortuneEntry, currentFortunePlayer, game]);

  // Auto-dismiss error toasts.
  useEffect(() => {
    if (!state.lastError) return;
    const t = setTimeout(() => game.clearError(), 2400);
    return () => clearTimeout(t);
  }, [state.lastError, game]);

  return (
    <div className="vf-page">
      <div className="vf-card vf-board">
        <div className="vf-header">
          <div className="vf-header__logo">
            Venture<span>Flow</span>
          </div>
          <div className="vf-header__right">
            <WeatherBadge weather={weather} />
            <button type="button" className="vf-btn vf-btn--sm vf-btn--ghost" onClick={game.newGame}>
              New Game
            </button>
          </div>
        </div>

        <MonthProgress month={month} totalMonths={totalMonths} />

        <PlayerPanel players={players} prices={assetPrices} activePlayerIndex={activePlayerIndex} />

        <div className={`vf-turn-banner ${isHumanTurn ? '' : 'vf-turn-banner--ai'}`}>
          {status === 'monthRecap'
            ? '📬 Reading this month\'s fortune cards...'
            : isHumanTurn
            ? `${activePlayer.avatar} ${
                activePlayer.name.toLowerCase() === 'you' ? 'Your' : `${activePlayer.name}'s`
              } turn — what will you do?`
            : `🤖 ${activePlayer?.name} is thinking...`}
        </div>

        <AssetShop
          prices={assetPrices}
          previousPrices={previousAssetPrices}
          player={activePlayer}
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

        <EventLog log={log} />
      </div>

      {showModalForHuman && (
        <FortuneCardModal entry={currentFortuneEntry} onContinue={game.ackFortuneCard} />
      )}

      {state.lastError && <div className="vf-toast">{state.lastError}</div>}
    </div>
  );
}
