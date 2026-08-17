import { BUSINESS_COST, BUSINESS_SKILL_COST, SKILL_COST } from '../data/gameConfig';

export default function ActionBar({ player, disabled, onStartBusiness, onLearnSkill, onDone }) {
  const canStartBusiness = !disabled && player.cash >= BUSINESS_COST && player.skillTokens >= BUSINESS_SKILL_COST;
  const canLearnSkill = !disabled && player.cash >= SKILL_COST;

  return (
    <div>
      <div className="vf-action-bar">
        <button type="button" className="vf-btn vf-btn--warm" disabled={!canStartBusiness} onClick={onStartBusiness}>
          🚀 Start Business (${BUSINESS_COST} + {BUSINESS_SKILL_COST} 💡)
        </button>
        <button type="button" className="vf-btn vf-btn--warm" disabled={!canLearnSkill} onClick={onLearnSkill}>
          📚 Learn Skill (${SKILL_COST})
        </button>
      </div>
      <div className="vf-done-row" style={{ marginTop: '0.75rem' }}>
        <button type="button" className="vf-btn vf-btn--primary vf-btn--lg" disabled={disabled} onClick={onDone}>
          Done! Roll the weather 🎲
        </button>
      </div>
    </div>
  );
}
