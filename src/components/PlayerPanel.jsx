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

function PlayerCard({ player, prices, allPlayers, month, isActive, onSelect }) {
  return (
    <button
      type="button"
      className={`vf-card vf-player-card ${isActive ? 'vf-player-card--active' : ''}`}
      onClick={onSelect}
    >
      <div className="vf-player-card__name">
        <span>{player.avatar}</span>
        <span>{player.name}</span>
        {player.type === 'ai' && <span title={botTooltip(player)}>🤖</span>}
      </div>
      <div className="vf-player-card__networth">${netWorth(player, prices).toLocaleString()}</div>
      <div className="vf-player-card__stat">💵 Cash: ${Math.round(player.cash).toLocaleString()}</div>
      <div className="vf-player-card__stat">
        🌱 Passive: ${passiveIncome(player, { allPlayers, prices, month })}/mo · 💡 {player.skillTokens}
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
    </button>
  );
}

export default function PlayerPanel({ players, prices, month, activePlayerIndex, onSelectPlayer }) {
  return (
    <div className="vf-players">
      {players.map((player, i) => (
        <PlayerCard
          key={player.id}
          player={player}
          prices={prices}
          allPlayers={players}
          month={month}
          isActive={i === activePlayerIndex}
          onSelect={() => onSelectPlayer(player.id)}
        />
      ))}
    </div>
  );
}
