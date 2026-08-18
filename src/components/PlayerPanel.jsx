import { netWorth, passiveIncome } from '../game/players';
import { getBadgeInfo } from '../game/badges';
import { getSkillLevel } from '../data/gameConfig';

/** "🤖 GrumpyMommy · 🦈 Shark" for a robot with a known skill level, or a
 * plain "AI player" for one saved before this feature existed. */
function botTooltip(player) {
  if (!player.skillLevelId) return 'AI player';
  const skill = getSkillLevel(player.skillLevelId);
  return `${player.name} · ${skill.icon} ${skill.name}`;
}

function PlayerCard({ player, prices, allPlayers, month, weatherIncomeAmounts, isActive, onSelect }) {
  // A <button> can't legally contain another <button> (the invest CTA
  // below), so the whole-card tap target is a div with button semantics
  // bolted on (role/tabIndex/Enter+Space) instead of a real <button> — see
  // game.css's .vf-player-card, which was already styled generically
  // enough (appearance: none, cursor: pointer) not to depend on the tag.
  return (
    <div
      role="button"
      tabIndex={0}
      className={`vf-card vf-player-card ${isActive ? 'vf-player-card--active' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="vf-player-card__name">
        <span>{player.avatar}</span>
        <span>{player.name}</span>
        {player.type === 'ai' && <span title={botTooltip(player)}>🤖</span>}
      </div>
      <div className="vf-player-card__networth">${netWorth(player, prices).toLocaleString()}</div>
      <div className="vf-player-card__stat">💵 Cash: ${Math.round(player.cash).toLocaleString()}</div>
      <div className="vf-player-card__stat">
        🌱 Passive: ${passiveIncome(player, { allPlayers, prices, month, weatherIncomeAmounts })}/mo · 💡 {player.skillTokens}
      </div>
      {player.badges.length > 0 && (
        <div className="vf-player-card__badges">
          {player.badges.map((badgeId) => {
            const badge = getBadgeInfo(badgeId);
            if (!badge) return null;
            return (
              <span key={badgeId} className="vf-badge-chip" title={badge.description}>
                {badge.icon} {badge.name}
              </span>
            );
          })}
        </div>
      )}
      <div className="vf-player-card__tap-hint">🔍 Tap for portfolio details</div>
      <button
        type="button"
        className="vf-btn vf-btn--sm vf-btn--warm vf-btn--block vf-player-card__invest-btn"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        ⚙️ Invest in your businesses!
      </button>
    </div>
  );
}

export default function PlayerPanel({ players, prices, month, weatherIncomeAmounts, activePlayerIndex, onSelectPlayer }) {
  return (
    <div className="vf-players">
      {players.map((player, i) => (
        <PlayerCard
          key={player.id}
          player={player}
          prices={prices}
          allPlayers={players}
          month={month}
          weatherIncomeAmounts={weatherIncomeAmounts}
          isActive={i === activePlayerIndex}
          onSelect={() => onSelectPlayer(player.id)}
        />
      ))}
    </div>
  );
}
