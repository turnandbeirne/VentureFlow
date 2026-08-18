const DEFAULT_CHAT_COLOR = '#868e96';

/** One chat bubble — color-coded to the speaking bot's personality (falls
 * back to a neutral gray for an entry saved before personality colors
 * existed) on top of its avatar icon, so who's talking is clear even at a
 * glance. A `category: 'sfx'` entry (a goof-off sound effect — see
 * game/chatEngine.js's generateBotTurnFlavor) gets a slightly different
 * treatment (dashed border, italic) to read as "a noise", not a sentence.
 * Exported so GameOverScreen's closing-chat section can reuse the exact
 * same look for its gloat/applause lines. */
export function ChatEntryRow({ entry }) {
  const color = entry.color || DEFAULT_CHAT_COLOR;
  const isSfx = entry.category === 'sfx';
  return (
    <div className={`vf-chat__entry ${isSfx ? 'vf-chat__entry--sfx' : ''}`}>
      <span className="vf-chat__avatar" title={entry.speakerName}>
        {entry.speakerAvatar}
      </span>
      <div className="vf-chat__bubble" style={{ '--bot-color': color }}>
        <span className="vf-chat__name" style={{ color }}>
          {entry.speakerName}
        </span>
        <span className="vf-chat__message">{entry.message}</span>
      </div>
    </div>
  );
}

// Bot personality chat feed — see game/chatEngine.js for when each entry
// gets generated. Purely a read-only display; robots are the only ones who
// "speak" here, the human player just reads along (and gets teased,
// questioned, challenged, complimented — and occasionally serenaded with a
// fart noise — in the process).
export default function ChatPanel({ chat }) {
  const recent = [...(chat || [])].slice(-30).reverse();

  return (
    <div>
      <div className="vf-section-title">
        <span>💬</span>
        <span>Robot Chat</span>
      </div>
      <div className="vf-card vf-chat vf-scroll">
        {recent.length === 0 && (
          <span className="vf-log__empty">The robots will start chatting once the game gets going...</span>
        )}
        {recent.map((entry) => (
          <ChatEntryRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
