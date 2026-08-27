import { useCallback, useEffect, useRef, useState } from 'react';
import { JOKES } from '../jokes/jokeBank';
import { playKidsSound } from '../audio/kidsSoundEngine';

// ============================================================================
// The Kids Version's chat/joke layer
// ----------------------------------------------------------------------------
// The main game's bot chat (game/chatEngine.js) is left completely
// untouched and keeps running exactly as it always has — this hook just
// decides, on the KIDS UI side only, which of those lines actually get
// shown, and weaves in jokes from jokeBank.js the rest of the time. None of
// this reaches back into game state or the reducer, so it can't affect the
// main game even in principle.
//
// Two explicit product requirements from the brief this shipped under:
//   - "chat bots speaking less often" — see ENGINE_CHAT_SHOW_CHANCE below.
//   - "doesn't repeat a joke unless told in chat to repeat" — see the
//     shuffled no-repeat-until-exhausted queue + repeatLastJoke().
// ============================================================================

// Only about a third of the engine's own chat lines get shown as-is — the
// rest are either replaced with a joke or simply skipped, so the feed reads
// as "the bots talk sometimes" rather than a wall of text.
const ENGINE_CHAT_SHOW_CHANCE = 0.32;
// Of the engine lines that get skipped, this fraction turn into an
// unprompted joke from a friend instead of just vanishing.
const SKIPPED_LINE_BECOMES_JOKE_CHANCE = 0.4;

const MAX_FEED_ITEMS = 40;

/** Fisher-Yates shuffle of [0, count) — used to build the no-repeat draw
 * order. Re-shuffled (with a fresh permutation, not the same one) every
 * time the pool is exhausted, so 1131 jokes tell before ANY of them repeat
 * on their own, and even then the repeat order is different each lap. */
function shuffledIndices(count) {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let nextFeedId = 1;
function feedId() {
  return `kf-${nextFeedId++}`;
}

const REPEAT_WORDS = ['again', 'repeat', 'once more', 'one more time', 'tell it again', 'say it again'];
const JOKE_REQUEST_WORDS = ['joke', 'riddle', 'knock knock', 'knock-knock', 'funny', 'make me laugh'];

function normalizeChatText(text) {
  return (text || '').toLowerCase().trim();
}

/**
 * `state` is the live game state from useKidsGame (or null before a game
 * starts). Returns the merged, kid-facing feed plus a couple of actions the
 * UI wires up to buttons/the chat box.
 */
export function useKidsChat(state) {
  const [feed, setFeed] = useState([]);
  const seenEngineChatCount = useRef(0);
  const jokeQueueRef = useRef([]);
  const lastJokeRef = useRef(null);
  const [lastJoke, setLastJoke] = useState(null);

  // A fresh game (or returning to the landing page) resets everything so
  // the previous game's chat history and joke position don't bleed in.
  useEffect(() => {
    if (!state) {
      seenEngineChatCount.current = 0;
      setFeed([]);
      return;
    }
    if (seenEngineChatCount.current === 0 && (state.chat || []).length === 0) {
      // Genuinely fresh game — nothing to reset, just make sure we're at 0.
      seenEngineChatCount.current = 0;
    }
  }, [state?.chat, state]);

  const drawNextJoke = useCallback(() => {
    if (jokeQueueRef.current.length === 0) {
      jokeQueueRef.current = shuffledIndices(JOKES.length);
    }
    const idx = jokeQueueRef.current.pop();
    return JOKES[idx];
  }, []);

  const pickFriend = useCallback(() => {
    const bots = (state?.players || []).filter((p) => p.type === 'ai');
    if (bots.length === 0) return null;
    return bots[Math.floor(Math.random() * bots.length)];
  }, [state]);

  const pushJoke = useCallback(
    (joke, { announce = true } = {}) => {
      if (!joke) return;
      const friend = pickFriend();
      const item = {
        id: feedId(),
        kind: 'joke',
        joke,
        speakerName: friend?.name || 'Your game friends',
        speakerAvatar: friend?.avatar || '🤖',
        revealed: joke.type !== 'riddle', // a riddle waits for a tap before showing the answer
      };
      lastJokeRef.current = item;
      setLastJoke(item);
      setFeed((prev) => [...prev.slice(-(MAX_FEED_ITEMS - 1)), item]);
      if (announce) {
        playKidsSound('jokeDing');
        if (joke.type === 'riddle') {
          setTimeout(() => playKidsSound('riddleHmm'), 250);
        } else {
          setTimeout(() => playKidsSound('giggle'), 350);
        }
      }
      return item;
    },
    [pickFriend]
  );

  /** Big "Tell me a joke!" button, or a recognized chat request. */
  const tellJoke = useCallback(() => {
    pushJoke(drawNextJoke());
  }, [drawNextJoke, pushJoke]);

  /** Explicit "tell it again" — replays the SAME joke object rather than
   * drawing a new one, and does not advance/consume the no-repeat queue. */
  const repeatLastJoke = useCallback(() => {
    if (!lastJokeRef.current) return;
    const { joke } = lastJokeRef.current;
    pushJoke(joke, { announce: true });
  }, [pushJoke]);

  /** Reveal a riddle's answer (tap-to-reveal, since a pre-reader can still
   * enjoy the pause-and-guess even if they can't read the question). */
  const revealJoke = useCallback((itemId) => {
    setFeed((prev) => prev.map((item) => (item.id === itemId ? { ...item, revealed: true } : item)));
    playKidsSound('answerReveal');
  }, []);

  /** A message typed into the kids chat box. Recognizes "tell me a joke"
   * and "again/repeat" as commands; anything else is just shown as the
   * kid's own chat bubble (the actual SEND_CHAT dispatch — which still
   * lets a real bot reply in character — is the caller's job, same as the
   * main game's ChatPanel). */
  const handleTypedMessage = useCallback(
    (rawText) => {
      const text = normalizeChatText(rawText);
      if (!text) return { handled: false };
      if (REPEAT_WORDS.some((w) => text.includes(w))) {
        if (lastJokeRef.current) {
          repeatLastJoke();
          return { handled: true, type: 'repeat' };
        }
        return { handled: false };
      }
      if (JOKE_REQUEST_WORDS.some((w) => text.includes(w))) {
        tellJoke();
        return { handled: true, type: 'joke' };
      }
      return { handled: false };
    },
    [repeatLastJoke, tellJoke]
  );

  // Watch the engine's real chat feed and decide, per new line, whether to
  // show it, drop it, or swap it for an unprompted joke.
  useEffect(() => {
    const chat = state?.chat;
    if (!chat) return;
    if (chat.length <= seenEngineChatCount.current) {
      if (chat.length < seenEngineChatCount.current) seenEngineChatCount.current = chat.length;
      return;
    }
    const newEntries = chat.slice(seenEngineChatCount.current);
    seenEngineChatCount.current = chat.length;

    const additions = [];
    for (const entry of newEntries) {
      // A human player's own typed line always shows — thinning only ever
      // applies to the bots' banter, never to what the kid (or another
      // human seat) actually said.
      if (entry.category === 'human') {
        additions.push({ id: feedId(), kind: 'engineChat', entry });
        continue;
      }
      const roll = Math.random();
      if (roll < ENGINE_CHAT_SHOW_CHANCE) {
        additions.push({ id: feedId(), kind: 'engineChat', entry });
      } else if (roll < ENGINE_CHAT_SHOW_CHANCE + (1 - ENGINE_CHAT_SHOW_CHANCE) * SKIPPED_LINE_BECOMES_JOKE_CHANCE) {
        const joke = drawNextJoke();
        const friend = state.players.find((p) => p.id === entry.speakerId) || null;
        const item = {
          id: feedId(),
          kind: 'joke',
          joke,
          speakerName: friend?.name || entry.speakerName || 'Your game friends',
          speakerAvatar: friend?.avatar || entry.speakerAvatar || '🤖',
          revealed: joke.type !== 'riddle',
        };
        lastJokeRef.current = item;
        additions.push(item);
      }
      // else: dropped entirely — the bot just stays quiet this time.
    }

    if (additions.length > 0) {
      const newLastJoke = [...additions].reverse().find((a) => a.kind === 'joke');
      if (newLastJoke) setLastJoke(newLastJoke);
      setFeed((prev) => [...prev.slice(-(MAX_FEED_ITEMS - additions.length)), ...additions]);
      for (const a of additions) {
        if (a.kind === 'joke') {
          playKidsSound('jokeDing');
        }
      }
    }
  }, [state?.chat, state?.players, drawNextJoke]);

  return { feed, tellJoke, repeatLastJoke, revealJoke, handleTypedMessage, lastJoke };
}
