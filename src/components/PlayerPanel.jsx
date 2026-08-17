import { netWorth, passiveIncome } from '../game/players';
import { getBadgeInfo } from '../game/badges';

function PlayerCard({ player, prices, isActive }) {
  return (
    <div className={`vf-card vf-player-card ${isActive ? 'vf-player-card--active' : ''}`}>
      <div className="vf-player-card__name">
        <span>{player.avatar}</span>
        <span>{player.name}</span>
        {player.type === 'ai' && <span title="AI player">🤖</span>}
      </div>
      <div className="vf-player-card__networth">${netWorth(player, prices).toLocaleString()}</div>
      <div className="vf-player-card__stat">💵 Cash: ${Math.round(player.cash).toLocaleString()}</div>
      <div className="vf-player-card__stat">
        🌱 Passive: ${passiveIncome(player)}/mo · 💡 {player.skillTokens}
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
    </div>
  );
}

export default function PlayerPanel({ players, prices, activePlayerIndex }) {
  return (
    <div className="vf-players">
      {players.map((player, i) => (
        <PlayerCard key={player.id} player={player} prices={prices} isActive={i === activePlayerIndex} />
      ))}
    </div>
  );
}
