/** The story of the game so far — reuses each log entry's own `.icon`/
 * `.message` exactly as the main game's engine writes them (see
 * game/actions.js/turnEngine.js), just in a bigger, friendlier list. No
 * translation needed: those strings were already written in plain,
 * approachable language. */
export default function KidsEventFeed({ log }) {
  const recent = [...(log || [])].slice(-25).reverse();
  return (
    <div>
      <div className="kv-setup__label">📜 What's Happened</div>
      <div className="kv-feed kv-scroll">
        {recent.length === 0 && (
          <p style={{ color: 'var(--kv-ink-soft)' }}>Your adventure will show up here as you play!</p>
        )}
        {recent.map((entry) => (
          <div key={entry.id} className="kv-feed__entry">
            <span className="kv-feed__entry-icon" aria-hidden="true">{entry.icon}</span>
            <span>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
