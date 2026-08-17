export default function EventLog({ log }) {
  const recent = [...log].slice(-40).reverse();
  return (
    <div>
      <div className="vf-section-title">
        <span>📜</span>
        <span>What's happened</span>
      </div>
      <div className="vf-card vf-log vf-scroll">
        {recent.length === 0 && <span className="vf-log__empty">The story of your months will show up here...</span>}
        {recent.map((entry) => (
          <div key={entry.id} className="vf-log__entry">
            <span>{entry.icon}</span>
            <span>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
