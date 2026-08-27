import { useEffect, useState } from 'react';
import { BUSINESS_COST, BUSINESS_SKILL_COST, SKILL_COST } from '../../data/gameConfig';
import { getStageInfo } from '../../game/weather';
import { businessArt } from '../../game/businessArt';
import { usePlaySpeed } from '../../hooks/usePlaySpeed';
import { playKidsSound } from '../audio/kidsSoundEngine';
import { useKidsChat } from '../hooks/useKidsChat';
import KidsShopModal from './KidsShopModal';
import KidsBusinessModal from './KidsBusinessModal';
import KidsChatPanel from './KidsChatPanel';
import KidsEventFeed from './KidsEventFeed';
import KidsFortuneCardModal from './KidsFortuneCardModal';
import KidsExitOfferModal from './KidsExitOfferModal';
import KidsStartupLaunchModal from './KidsStartupLaunchModal';

/**
 * The Kids Version's main play screen — same game state shape as the main
 * game's GameBoard.jsx (same reducer, same status machine: 'playing' /
 * 'monthRecap' / 'exitOffer'), just laid out around ONE big spotlighted
 * player card instead of a 2-5up grid. A young kid mostly cares about "what
 * can I do on MY turn" — the roster strip above the spotlight still shows
 * everyone else at a glance without competing for attention.
 */
export default function KidsBoard({ game, onExit }) {
  const { state } = game;
  const { players, activePlayerIndex, weather, assetPrices, month, totalMonths, log, status } = state;
  const activePlayer = players[activePlayerIndex];
  const isHumanTurn = status === 'playing' && activePlayer?.type === 'human';
  const humanPlayer = players.find((p) => p.type === 'human') || null;

  const { speed } = usePlaySpeed();
  const [showShop, setShowShop] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);

  const chat = useKidsChat(state);

  const stageInfo = getStageInfo(weather);
  const currentFortuneEntry = status === 'monthRecap' ? state.fortuneRecap[state.fortuneRecapIndex] : null;
  const currentFortunePlayer = currentFortuneEntry ? players.find((p) => p.id === currentFortuneEntry.playerId) : null;
  const showFortuneForHuman = currentFortuneEntry && currentFortunePlayer?.type === 'human';
  const pendingExitOffer = status === 'exitOffer' ? state.pendingExitOffer : null;
  const exitOfferPlayer = pendingExitOffer ? players.find((p) => p.id === pendingExitOffer.playerId) : null;
  const selectedBusiness = selectedBusinessId ? activePlayer?.businesses.find((b) => b.id === selectedBusinessId) : null;

  // Same auto-advance-past-a-robot's-own-fortune-card behavior as the main
  // game's GameBoard.jsx — a robot doesn't need to sit and watch its own
  // card, only a human player's does.
  useEffect(() => {
    if (status !== 'monthRecap' || !currentFortuneEntry) return;
    if (currentFortunePlayer?.type === 'ai') {
      const t = setTimeout(() => game.ackFortuneCard(), speed.recapAdvanceMs);
      return () => clearTimeout(t);
    }
  }, [status, currentFortuneEntry, currentFortunePlayer, game, speed]);

  useEffect(() => {
    if (!state.lastError) return;
    const t = setTimeout(() => game.clearError(), 2400);
    return () => clearTimeout(t);
  }, [state.lastError, game]);

  const canStartBusiness = isHumanTurn && activePlayer.cash >= BUSINESS_COST && activePlayer.skillTokens >= BUSINESS_SKILL_COST;
  const canLearnSkill = isHumanTurn && activePlayer.cash >= SKILL_COST;

  return (
    <div className="kv-board">
      <div className="kv-board__header">
        <div className="kv-board__header-left">🦊 VentureFlow Kids</div>
        <div className="kv-board__header-right">
          <button
            type="button"
            className="kv-btn kv-btn--ghost kv-btn--sm"
            onClick={() => {
              playKidsSound('tap');
              onExit();
            }}
          >
            🏠 New Game
          </button>
        </div>
      </div>

      <div className="kv-month">
        <span>Month {month} of {totalMonths}</span>
        <div className="kv-month__bar">
          <div className="kv-month__fill" style={{ width: `${(month / totalMonths) * 100}%` }} />
        </div>
      </div>

      <div className="kv-card kv-weather-banner">
        <span className="kv-weather-banner__icon" aria-hidden="true">{stageInfo.icon}</span>
        <div>
          <strong>{stageInfo.name}</strong> — {stageInfo.blurb}
        </div>
      </div>

      <div className="kv-roster">
        {players.map((p, i) => (
          <div key={p.id} className={`kv-roster__chip ${i === activePlayerIndex ? 'kv-roster__chip--active' : ''}`}>
            <span className="kv-roster__avatar" aria-hidden="true">{p.avatar}</span>
            <span>{p.name}</span>
          </div>
        ))}
      </div>

      <div className={`kv-turn-banner ${isHumanTurn ? '' : 'kv-turn-banner--ai'}`}>
        {status === 'exitOffer'
          ? `💼 ${exitOfferPlayer?.name || 'Someone'} has a big decision to make...`
          : status === 'monthRecap'
          ? '📬 Reading fortune cards...'
          : isHumanTurn
          ? `${activePlayer.avatar} It's your turn, ${activePlayer.name}!`
          : `🤖 ${activePlayer?.name} is taking a turn...`}
      </div>

      <div className="kv-card kv-player-spotlight">
        <div className="kv-player-spotlight__avatar" aria-hidden="true">{activePlayer.avatar}</div>
        <div>
          <div className="kv-player-spotlight__name">{activePlayer.name}</div>
          <div className="kv-player-spotlight__stats">
            <div className="kv-stat">
              <span className="kv-stat__value">${activePlayer.cash.toLocaleString()}</span>
              <span className="kv-stat__label">💵 Cash</span>
            </div>
            <div className="kv-stat">
              <span className="kv-stat__value">{activePlayer.skillTokens}</span>
              <span className="kv-stat__label">📚 Skill Tokens</span>
            </div>
            <div className="kv-stat">
              <span className="kv-stat__value">{activePlayer.businesses.length}</span>
              <span className="kv-stat__label">🏪 Businesses</span>
            </div>
          </div>
        </div>
      </div>

      {activePlayer.businesses.length > 0 && (
        <div>
          <div className="kv-setup__label">🏪 {activePlayer.name}'s Businesses</div>
          <div className="kv-biz-grid">
            {activePlayer.businesses.map((b) => {
              const art = businessArt(b.name);
              return (
                <button
                  key={b.id}
                  type="button"
                  className="kv-biz-card"
                  onClick={() => {
                    playKidsSound('tap');
                    setSelectedBusinessId(b.id);
                  }}
                >
                  <span className="kv-biz-card__icon" aria-hidden="true">{art.hero}</span>
                  <div>{b.name}</div>
                  <div className="kv-biz-card__income">+${b.income}/mo</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="kv-action-row">
        <button
          type="button"
          className="kv-btn kv-btn--huge"
          disabled={!isHumanTurn}
          onClick={() => {
            playKidsSound('tap');
            setShowShop(true);
          }}
        >
          🛍️ Shop
        </button>
        <button
          type="button"
          className="kv-btn kv-btn--huge kv-btn--accent"
          disabled={!canStartBusiness}
          title={!canStartBusiness && isHumanTurn ? `Needs $${BUSINESS_COST} and 1 skill token` : ''}
          onClick={() => {
            playKidsSound('businessLaunch');
            game.startBusiness(activePlayer.id);
          }}
        >
          🚀 Start a Business
        </button>
        <button
          type="button"
          className="kv-btn kv-btn--huge kv-btn--blue"
          disabled={!canLearnSkill}
          title={!canLearnSkill && isHumanTurn ? `Needs $${SKILL_COST}` : ''}
          onClick={() => {
            playKidsSound('levelUp');
            game.learnSkill(activePlayer.id);
          }}
        >
          📚 Learn a Skill
        </button>
        <button
          type="button"
          className="kv-btn kv-btn--huge kv-btn--green"
          disabled={!isHumanTurn}
          onClick={() => {
            playKidsSound('turnWhoosh');
            game.endTurn(activePlayer.id);
          }}
        >
          ✅ Done with My Turn
        </button>
      </div>

      <div className="kv-card">
        <KidsChatPanel
          feed={chat.feed}
          tellJoke={chat.tellJoke}
          repeatLastJoke={chat.repeatLastJoke}
          revealJoke={chat.revealJoke}
          handleTypedMessage={chat.handleTypedMessage}
          lastJoke={chat.lastJoke}
          humanPlayerId={humanPlayer?.id}
          onSendChat={game.sendChat}
        />
      </div>

      <div className="kv-card">
        <KidsEventFeed log={log} />
      </div>

      {showShop && isHumanTurn && (
        <KidsShopModal
          player={activePlayer}
          prices={assetPrices}
          onBuy={(assetId) => game.buyAsset(activePlayer.id, assetId, 1)}
          onSell={(assetId) => game.sellAsset(activePlayer.id, assetId, 1)}
          onClose={() => setShowShop(false)}
        />
      )}

      {selectedBusiness && (
        <KidsBusinessModal
          business={selectedBusiness}
          player={activePlayer}
          month={month}
          onUpgrade={(businessId, trackId) => game.upgradeBusiness(activePlayer.id, businessId, trackId)}
          onClose={() => setSelectedBusinessId(null)}
        />
      )}

      {showFortuneForHuman && <KidsFortuneCardModal entry={currentFortuneEntry} onContinue={game.ackFortuneCard} />}

      {pendingExitOffer && (
        <KidsExitOfferModal
          offer={pendingExitOffer}
          playerName={exitOfferPlayer?.name}
          playerAvatar={exitOfferPlayer?.avatar}
          onDecide={(accept) => game.resolveExitOffer(pendingExitOffer.playerId, accept)}
        />
      )}

      {state.pendingLaunch && <KidsStartupLaunchModal launch={state.pendingLaunch} onContinue={game.ackStartupLaunch} />}

      {state.lastError && <div className="kv-toast">{state.lastError}</div>}
    </div>
  );
}
