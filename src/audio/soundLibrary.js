// ============================================================================
// Sound library — data-driven tone "recipes"
// ----------------------------------------------------------------------------
// Every effect is a tiny sequence of synthesized notes (no audio files to
// load or license). Each note is { freq, start, duration, type, gain }:
//   freq      pitch in Hz
//   start     seconds after the sound begins
//   duration  seconds the note rings for
//   type      oscillator waveform: 'sine' | 'triangle' | 'square' | 'sawtooth'
//   gain      relative loudness of this note, 0-1 (multiplied by master volume)
//
// Tune the whole game's audio feel by editing this file — nothing else
// needs to change.
// ============================================================================

const note = (freq, start, duration, type = 'sine', gain = 1) => ({ freq, start, duration, type, gain });

export const SOUNDS = {
  // Soft UI tap — mode selection, dismiss buttons, generic clicks.
  click: [note(520, 0, 0.06, 'triangle', 0.5)],

  // Buying something that grows — a cheerful little "cha-ching" blip pair.
  buy: [note(660, 0, 0.09, 'triangle', 0.7), note(880, 0.06, 0.11, 'triangle', 0.6)],

  // Selling — a soft descending pair (not sad, just distinct from buy).
  sell: [note(700, 0, 0.08, 'triangle', 0.6), note(520, 0.06, 0.1, 'triangle', 0.5)],

  // Starting a business — an ascending "whoosh" sweep of three notes.
  business: [
    note(420, 0, 0.09, 'sawtooth', 0.45),
    note(560, 0.07, 0.09, 'sawtooth', 0.5),
    note(760, 0.14, 0.14, 'sawtooth', 0.55),
  ],

  // Learning a skill — a clean bell-like ding.
  skill: [note(880, 0, 0.14, 'sine', 0.6), note(1320, 0.02, 0.18, 'sine', 0.3)],

  // Ending a turn / rolling the weather — a couple of short percussive taps.
  endTurn: [note(300, 0, 0.05, 'square', 0.35), note(340, 0.07, 0.05, 'square', 0.3)],

  // Payday — a light double coin clink.
  payday: [note(990, 0, 0.06, 'triangle', 0.4), note(1180, 0.05, 0.08, 'triangle', 0.4)],

  // Opportunity fortune card — a bright ascending major arpeggio.
  fortuneGood: [
    note(523.25, 0, 0.1, 'sine', 0.55),
    note(659.25, 0.09, 0.1, 'sine', 0.55),
    note(783.99, 0.18, 0.16, 'sine', 0.6),
  ],

  // Setback fortune card — a gentle "womp womp", never scary.
  fortuneBad: [note(392, 0, 0.14, 'triangle', 0.45), note(311.13, 0.12, 0.22, 'triangle', 0.45)],

  // Weather flip — a magical ascending shimmer.
  weather: [
    note(660, 0, 0.08, 'sine', 0.3),
    note(880, 0.05, 0.08, 'sine', 0.3),
    note(1108.73, 0.1, 0.08, 'sine', 0.3),
    note(1318.51, 0.15, 0.2, 'sine', 0.35),
  ],

  // Badge earned — a short triumphant fanfare.
  badge: [
    note(523.25, 0, 0.11, 'square', 0.4),
    note(659.25, 0.1, 0.11, 'square', 0.4),
    note(783.99, 0.2, 0.11, 'square', 0.42),
    note(1046.5, 0.3, 0.26, 'square', 0.48),
  ],

  // Game over — a longer victory-style flourish.
  gameover: [
    note(523.25, 0, 0.12, 'triangle', 0.5),
    note(659.25, 0.11, 0.12, 'triangle', 0.5),
    note(783.99, 0.22, 0.12, 'triangle', 0.5),
    note(1046.5, 0.33, 0.14, 'triangle', 0.55),
    note(1318.51, 0.47, 0.32, 'triangle', 0.6),
  ],

  // Something couldn't be done (reserved for future use).
  error: [note(220, 0, 0.12, 'square', 0.35)],
};
