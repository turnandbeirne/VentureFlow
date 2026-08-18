import { netWorth, passiveIncome } from '../game/players';
import { getBadgeInfo } from '../game/badges';
import { getSkillLevel } from '../data/gameConfig';
import { businessHealthStatus } from '../game/businessUpgrades';

/** "🤖 GrumpyMommy · 🦈 Shark" for a robot with a known skill level, or a
 * plain "AI player" for one saved before this feature existed. */
function botTooltip(player) {
  if (!player.skillLevelId) return 'AI player';
  const skill = getSkillLevel(player.skillLevelId);
  return `${player.name} · ${skill.icon} ${skill.name}`;
}

// Worst business-health status across everything this player owns, for the
// invest CTA below to flag ('declining' beats 'warning' beats 'healthy') —
// a quick heads-up without having to open the portfolio to notice a
// business has gone untended (see game/businessUpgrades.js's
// businessHealthStatus / gameConfig.js's BUSINESS_DECLINE_* comment).
const HEALTH_RANK = { declining: 2, warning: 1, healthy: 0 };
function worstBusinessHealth(player, month) {
  let worst = 'healthy';
  for (const biz of player.businesses) {
    const status = businessHealthStatus(biz, month);
    if (HEALTH_RANK[status] > HEALTH_RANK[worst]) worst = status;
  }
  return worst;
}

function PlayerCard({ player, prices, allPlayers, month, weatherIncomeAmounts, isActive, onSelect }) {
  const worstHealth = worstBusinessHealth(player, month);
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
        className={`vf-btn vf-btn--sm vf-btn--block vf-player-card__invest-btn ${
          worstHealth === 'declining'
            ? 'vf-btn--danger'
            : worstHealth === 'warning'
            ? 'vf-player-card__invest-btn--warning'
            : 'vf-btn--warm'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {worstHealth === 'declining'
          ? '📉 A business is losing money — reinvest now!'
          : worstHealth === 'warning'
          ? '⚠️ A business needs attention soon'
          : '⚙️ Invest in your businesses!'}
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
