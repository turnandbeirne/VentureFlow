import { useRef, useState } from 'react';
import { playKidsSound } from '../audio/kidsSoundEngine';

function JokeCard({ item, onReveal }) {
  const { joke, revealed } = item;
  if (joke.type === 'knock-knock') {
    return (
      <div className="kv-joke">
        <div className="kv-joke__line">🚪 Knock knock!</div>
        <div className="kv-joke__line">Who's there?</div>
        <div className="kv-joke__line">{joke.name}.</div>
        <div className="kv-joke__line">{joke.name} who?</div>
        <div className="kv-joke__line">😂 {joke.punchline}</div>
      </div>
    );
  }
  if (joke.type === 'riddle') {
    return (
      <div className="kv-joke">
        <div className="kv-joke__line">🤔 {joke.question}</div>
        {revealed ? (
          <div className="kv-joke__line">💡 {joke.answer}</div>
        ) : (
          <button
            type="button"
            className="kv-btn kv-btn--sm kv-btn--accent kv-joke__reveal-btn"
            onClick={() => onReveal(item.id)}
          >
            🔍 Show the answer!
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="kv-joke">
      <div className="kv-joke__line">😂 {joke.text}</div>
    </div>
  );
}

/**
 * The Kids Version's chat feed — everything about WHO says WHAT and HOW
 * OFTEN lives in src/kids/hooks/useKidsChat.js; this component just renders
 * whatever it hands back and wires the two request paths (buttons + typed
 * chat) into it. `humanPlayerId` is null before a game exists, in which
 * case nothing here is interactive.
 */
export default function KidsChatPanel({ feed, tellJoke, repeatLastJoke, revealJoke, handleTypedMessage, lastJoke, humanPlayerId, onSendChat }) {
  const [text, setText] = useState('');
  const feedRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    const result = handleTypedMessage(trimmed);
    if (!result.handled && humanPlayerId) {
      onSendChat(humanPlayerId, trimmed);
    }
    setText('');
  }

  return (
    <div className="kv-chat">
      <div className="kv-setup__label">💬 Chat & Jokes</div>

      <div className="kv-chat__quick-row">
        <button
          type="button"
          className="kv-btn kv-btn--accent kv-btn--sm"
          onClick={() => {
            playKidsSound('tap');
            tellJoke();
          }}
        >
          😂 Tell me a joke!
        </button>
        {lastJoke && (
          <button
            type="button"
            className="kv-btn kv-btn--ghost kv-btn--sm"
            onClick={() => {
              playKidsSound('tap');
              repeatLastJoke();
            }}
          >
            🔁 Tell it again!
          </button>
        )}
      </div>

      <div className="kv-chat__feed kv-scroll" ref={feedRef}>
        {feed.length === 0 && (
          <p style={{ color: 'var(--kv-ink-soft)' }}>Your game friends will chat here — say hi, or ask for a joke!</p>
        )}
        {feed.map((item) => {
          if (item.kind === 'joke') {
            return (
              <div key={item.id} className="kv-bubble">
                <span className="kv-bubble__avatar" aria-hidden="true">{item.speakerAvatar}</span>
                <div style={{ flex: 1 }}>
                  <span className="kv-bubble__name">{item.speakerName}</span>
                  <JokeCard item={item} onReveal={revealJoke} />
                </div>
              </div>
            );
          }
          const { entry } = item;
          const isHuman = entry.category === 'human';
          return (
            <div key={item.id} className={`kv-bubble ${isHuman ? 'kv-bubble--human' : ''}`}>
              <span className="kv-bubble__avatar" aria-hidden="true">{entry.speakerAvatar}</span>
              <div className="kv-bubble__body">
                <span className="kv-bubble__name">{entry.speakerName}</span>
                {entry.message}
              </div>
            </div>
          );
        })}
      </div>

      <form className="kv-chat__input-row" onSubmit={handleSubmit}>
        <input
          className="kv-chat__input"
          value={text}
          maxLength={100}
          placeholder="Say something, or type 'joke'..."
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="kv-btn kv-btn--sm">Send</button>
      </form>
    </div>
  );
}
