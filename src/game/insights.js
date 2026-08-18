// ============================================================================
// Game-over insight callouts
// ----------------------------------------------------------------------------
// A couple of plain-language observations built from a player's OWN
// playthrough (net worth history + final holdings) — meant to reinforce the
// "why" lessons (see game/lessons.js) with something concrete and personal
// rather than a generic tip. Heuristic, not financial advice — phrased as
// observations about what happened, not judgments about what should have.
// ============================================================================
import { ASSETS } from '../data/gameConfig';

function biggestSwing(history) {
  let best = null;
  for (let i = 1; i < history.length; i++) {
    const delta = history[i].netWorth - history[i - 1].netWorth;
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { month: history[i].month, delta };
    }
  }
  return best;
}

function diversityCount(player) {
  return ASSETS.filter((a) => (player.holdings[a.id] || 0) > 0).length;
}

/**
 * Build up to a couple of observations about one player's playthrough.
 * Returns an array of `{ icon, text }`. Deliberately modest in scope (a
 * biggest-swing note + a diversification note) — this reflects the
 * player's own numbers back at them rather than trying to be a full
 * analysis engine.
 */
export function buildInsights(player) {
  const insights = [];
  const history = player.netWorthHistory || [];
  if (history.length < 2) return insights;

  const swing = biggestSwing(history);
  if (swing && swing.delta > 0) {
    insights.push({
      icon: '📈',
      text: `Your best month was month ${swing.month}, when your net worth jumped by $${swing.delta.toLocaleString()}.`,
    });
  } else if (swing && swing.delta < 0) {
    insights.push({
      icon: '📉',
      text: `Month ${swing.month} was your toughest, dropping $${Math.abs(swing.delta).toLocaleString()} — a good reminder that spreading your money across a few different things can help soften a rough month.`,
    });
  }

  const diversity = diversityCount(player);
  if (diversity >= 3) {
    insights.push({
      icon: '🧺',
      text: `You held ${diversity} different kinds of assets by the end — that spread-out approach is called diversification, and it helps protect you if any one thing drops.`,
    });
  } else if (diversity <= 1) {
    insights.push({
      icon: '🎯',
      text: `You mostly stuck to one kind of asset this game. That can pay off, but spreading out across a few (diversifying) usually lowers your risk.`,
    });
  }

  return insights.slice(0, 2);
}
