import { useEffect, useRef } from 'react';
import { playSound } from '../audio/soundEngine';

// Log entry kind -> sound effect name. Anything not in this map (or with no
// kind at all) just stays silent — the log is used for plenty of things
// that don't need audio.
const KIND_SOUND = {
  buy: 'buy',
  sell: 'sell',
  business: 'business',
  skill: 'skill',
  endTurn: 'endTurn',
  payday: 'payday',
  fortuneGood: 'fortuneGood',
  fortuneBad: 'fortuneBad',
  badge: 'badge',
  weather: 'weather',
  gameover: 'gameover',
};

/**
 * Reactive sound layer: watches the shared event log and plays a sound for
 * every newly-appended entry whose `kind` maps to an effect. This keeps the
 * game engine (src/game/) completely unaware that audio exists — it just
 * tags entries with a `kind`, same as it always logged messages, and this
 * hook is the only thing that turns that into noise.
 *
 * Works uniformly for human and AI turns, and across every screen (mounted
 * once in App.jsx), so it doesn't matter who triggered the event.
 */
export function useGameSounds(log) {
  const seenCountRef = useRef(null);

  useEffect(() => {
    if (!log) {
      // No active game (setup screen, or just started a new one) — reset
      // so the next game doesn't think it's already "seen" old entries.
      seenCountRef.current = null;
      return;
    }

    if (seenCountRef.current === null) {
      // First time we see this game's log (fresh start OR resumed from
      // localStorage) — don't replay its whole history, just start
      // watching from here.
      seenCountRef.current = log.length;
      return;
    }

    if (log.length > seenCountRef.current) {
      const newEntries = log.slice(seenCountRef.current);
      for (const entry of newEntries) {
        const soundName = entry.kind && KIND_SOUND[entry.kind];
        if (soundName) playSound(soundName);
      }
      seenCountRef.current = log.length;
    } else if (log.length < seenCountRef.current) {
      // Log got trimmed/reset somehow — just resync quietly.
      seenCountRef.current = log.length;
    }
  }, [log]);
}
