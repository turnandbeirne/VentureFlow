// ============================================================================
// Kids sound library — data-driven tone/noise "recipes", just for the Kids app
// ----------------------------------------------------------------------------
// This is the "Just for Kids" edition's OWN synthesized sound palette — a
// sibling of src/audio/soundLibrary.js, not a reskin of it. The main game's
// palette leans on square/sawtooth waveforms and bot-goofball noises aimed at
// older kids and adults; this one is built for players under 8, so every
// effect here is deliberately warmer, bouncier, and gentler:
//
//   - mostly sine/triangle "bell" and "marimba" timbres, short durations,
//     quick pentatonic-major arpeggios — nothing that can read as harsh
//   - no low sawtooth blasts, no shrieks/buzzers, no jump-scares — a wrong
//     move gets a soft cartoon "boop", never an error buzzer
//   - a shared C-major-pentatonic note palette (C D E G A across a couple of
//     octaves) so every effect, even played back to back, sounds like it
//     belongs to the same friendly toy
//
// Like the main library, every effect is just a tiny sequence of synthesized
// notes — no audio files to download, license, or ship. Two note shapes:
//
//   tone  { freq, start, duration, type, gain, freqEnd? }
//     freq      pitch in Hz
//     start     seconds after the sound begins
//     duration  seconds the note rings for
//     type      oscillator waveform: 'sine' | 'triangle' | 'square' | 'sawtooth'
//     gain      relative loudness, 0-1 (multiplied by master volume)
//     freqEnd   optional — sweeps from freq to freqEnd; omit for a flat pitch
//
//   noise { kind: 'noise', start, duration, gain, filterType?, filterFreq?,
//           filterFreqEnd?, filterQ?, attack? }
//     Filtered white noise — used for texture a pure oscillator can't make:
//     a die's rattle, a page's paper-flip, a confetti shimmer.
//
// A KIDS_SOUNDS entry is normally a static array of notes. `bigWin` — the
// biggest, most celebratory sound in the set — is instead a FUNCTION that
// generates a fresh, lightly-randomized note list every time it's called
// (same trick as the main game's gameover/fireworks), so it doesn't sound
// exactly the same on every win.
//
// This file is intentionally self-contained: it defines its own copies of
// the note/sweep/noise helpers rather than importing from src/audio/*, so
// the kids app's sound design can evolve independently of the main game's.
// ============================================================================

const note = (freq, start, duration, type = 'sine', gain = 1) => ({ freq, start, duration, type, gain });

// A tone that glides from `freq` to `freqEnd` — swooshes, boings, shimmers.
const sweep = (freq, freqEnd, start, duration, type = 'sine', gain = 1) => ({
  freq,
  freqEnd,
  start,
  duration,
  type,
  gain,
});

// A burst of filtered white noise — rattle, paper-flip, sparkle texture.
const noise = (
  start,
  duration,
  { gain = 0.4, filterType = 'bandpass', filterFreq = 1800, filterFreqEnd, filterQ = 1, attack = 0.008 } = {}
) => ({ kind: 'noise', start, duration, gain, filterType, filterFreq, filterFreqEnd, filterQ, attack });

const rand = (min, max) => min + Math.random() * (max - min);
const _pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// A shared C-major-pentatonic palette (no "wrong notes" possible when we mix
// and match across effects) spanning a couple of octaves. Not every note
// below is used by a shipped effect yet — kept here as the tuned palette to
// draw from when adding more.
const _C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const G4 = 392.0;
const _A4 = 440.0;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const C6 = 1046.5;
const D6 = 1174.66;
const E6 = 1318.51;
const G6 = 1567.98;

// One little "confetti sparkle" — a short high noise-burst with a sweeping
// filter, used to sprinkle texture over bigWin without ever getting harsh.
function sparkleBurst(startAt) {
  const centerFreq = rand(2600, 4200);
  return noise(startAt, rand(0.1, 0.18), {
    gain: rand(0.08, 0.14),
    filterType: 'bandpass',
    filterFreq: centerFreq,
    filterFreqEnd: centerFreq * rand(1.3, 1.8),
    filterQ: 2.2,
    attack: 0.004,
  });
}

// The big-win fanfare: a joyful ascending run up the pentatonic scale that
// lands on a bright held chord-ish tail, plus a scattering of sparkle bursts
// layered on top — regenerated fresh (timing + sparkle count) every call.
function buildBigWin() {
  const run = [C5, D5, E5, G5, A5, C6];
  const notes = [];
  let t = 0;
  for (let i = 0; i < run.length; i++) {
    notes.push(note(run[i], t, 0.14, 'triangle', 0.5 + i * 0.02));
    t += rand(0.075, 0.1);
  }
  // A little bright chord to land on.
  notes.push(note(C6, t, 0.4, 'sine', 0.5));
  notes.push(note(E6, t + 0.03, 0.4, 'sine', 0.4));
  notes.push(note(G6, t + 0.06, 0.45, 'sine', 0.42));

  const sparkleCount = 6 + Math.floor(Math.random() * 4); // 6-9 sparkles
  for (let i = 0; i < sparkleCount; i++) {
    notes.push(sparkleBurst(rand(0, t + 0.5)));
  }
  return notes;
}

export const KIDS_SOUNDS = {
  // A tiny, soft UI tap for buttons — light enough to not get old after the
  // hundredth press.
  tap: [note(700, 0, 0.045, 'sine', 0.3), note(900, 0.03, 0.13, 'sine', 0.12)],

  // Earning cash — a bright little coin "cha-ching."
  coinPlink: [
    note(D6, 0, 0.05, 'sine', 0.45),
    note(G6, 0.04, 0.07, 'sine', 0.4),
    note(C6, 0.02, 0.16, 'triangle', 0.3),
  ],

  // Buying something in the shop — a cheerful ascending sparkle.
  buySpark: [
    note(C5, 0, 0.07, 'triangle', 0.5),
    note(E5, 0.06, 0.07, 'triangle', 0.48),
    note(G5, 0.12, 0.07, 'triangle', 0.5),
    note(C6, 0.18, 0.16, 'sine', 0.5),
  ],

  // Selling something — a soft downward whoosh with a little chime on top.
  sellWhoosh: [
    sweep(1400, 500, 0, 0.22, 'sine', 0.18),
    note(A5, 0.16, 0.16, 'triangle', 0.35),
  ],

  // Starting a business — a small triumphant fanfare, distinct from (and
  // gentler/less grand than) bigWin.
  businessLaunch: [
    note(C5, 0, 0.1, 'triangle', 0.5),
    note(E5, 0.09, 0.1, 'triangle', 0.5),
    note(G5, 0.18, 0.16, 'triangle', 0.55),
    note(C6, 0.32, 0.22, 'sine', 0.5),
  ],

  // Learning a skill / leveling up — a bouncy ascending arpeggio.
  levelUp: [
    note(C5, 0, 0.08, 'sine', 0.5),
    note(D5, 0.07, 0.08, 'sine', 0.5),
    note(E5, 0.14, 0.08, 'sine', 0.5),
    note(G5, 0.21, 0.08, 'sine', 0.52),
    note(C6, 0.28, 0.2, 'sine', 0.55),
  ],

  // A die tumbling — a handful of quick, soft rattly taps of filtered noise.
  diceRoll: [
    noise(0, 0.05, { gain: 0.22, filterType: 'bandpass', filterFreq: 1200, filterQ: 2.5, attack: 0.002 }),
    noise(0.07, 0.05, { gain: 0.2, filterType: 'bandpass', filterFreq: 1500, filterQ: 2.5, attack: 0.002 }),
    noise(0.14, 0.045, { gain: 0.2, filterType: 'bandpass', filterFreq: 1100, filterQ: 2.5, attack: 0.002 }),
    noise(0.2, 0.045, { gain: 0.18, filterType: 'bandpass', filterFreq: 1700, filterQ: 2.5, attack: 0.002 }),
    noise(0.26, 0.06, { gain: 0.2, filterType: 'bandpass', filterFreq: 1300, filterQ: 2.2, attack: 0.002 }),
    note(A5, 0.32, 0.1, 'triangle', 0.3),
  ],

  // The turn spotlight sliding to the next player — a light, quick swoosh.
  turnWhoosh: [sweep(500, 1300, 0, 0.18, 'sine', 0.16)],

  // A cute doorbell/bicycle-bell "ding!" cueing a joke is coming.
  jokeDing: [note(E6, 0, 0.05, 'sine', 0.45), note(C6, 0.03, 0.22, 'sine', 0.4)],

  // A playful "tee-hee" bouncy blip sequence for after a joke lands.
  giggle: [
    note(E5, 0, 0.06, 'triangle', 0.4),
    note(G5, 0.07, 0.06, 'triangle', 0.4),
    note(E5, 0.14, 0.05, 'triangle', 0.35),
    note(A5, 0.21, 0.06, 'triangle', 0.4),
    note(G5, 0.28, 0.09, 'triangle', 0.38),
  ],

  // A riddle being posed — a short curious "hmm," descending then settling
  // flat, like a thoughtful little shrug.
  riddleHmm: [
    note(G5, 0, 0.14, 'sine', 0.3),
    note(E5, 0.16, 0.14, 'sine', 0.28),
    note(E5, 0.32, 0.22, 'sine', 0.26),
  ],

  // A riddle's answer being revealed — one satisfying little chime.
  answerReveal: [
    note(G5, 0, 0.09, 'sine', 0.4),
    note(C6, 0.08, 0.1, 'sine', 0.42),
    note(E6, 0.17, 0.22, 'sine', 0.4),
  ],

  // An invalid/blocked action — a gentle, funny cartoon "boing," never a
  // harsh error buzzer. Soft and a little silly, so a mis-tap feels like a
  // joke, not a scold.
  oops: [
    sweep(500, 260, 0, 0.14, 'sine', 0.3),
    sweep(260, 340, 0.13, 0.12, 'sine', 0.22),
  ],

  // Achievement unlocked — a bright chime, same triumphant spirit as the
  // main game's badge sound but its own original shape.
  badgeChime: [
    note(D5, 0, 0.09, 'triangle', 0.42),
    note(G5, 0.08, 0.09, 'triangle', 0.44),
    note(D6, 0.16, 0.09, 'triangle', 0.46),
    note(G6, 0.25, 0.26, 'sine', 0.48),
  ],

  // The game's weather changing — a soft ambient shimmer, nothing sudden.
  weatherChange: [
    note(A5, 0, 0.16, 'sine', 0.22),
    note(C6, 0.1, 0.16, 'sine', 0.22),
    note(E6, 0.2, 0.24, 'sine', 0.24),
  ],

  // A fortune card appearing — a quick soft paper-flip tap.
  cardFlip: [
    noise(0, 0.09, { gain: 0.22, filterType: 'highpass', filterFreq: 2200, filterQ: 0.6, attack: 0.002 }),
    note(A5, 0.03, 0.06, 'triangle', 0.2),
    note(C6, 0.09, 0.09, 'sine', 0.15),
  ],

  // Game-over win — the biggest, most celebratory sound in the set: a joyful
  // ascending fanfare landing on a bright chord, with a scattering of
  // confetti-sparkle noise layered on top. Regenerated fresh every call
  // (like the main game's gameover/fireworks) so it varies a little each win.
  bigWin: buildBigWin,

  // A kid losing a small moment (e.g. an AI player wins a round instead) —
  // silly, not sad. A gentle descending trio that reads as a cartoon "aww,
  // shucks" rather than anything upsetting.
  sadTrombone: [
    note(G4, 0, 0.16, 'triangle', 0.35),
    note(E4, 0.15, 0.16, 'triangle', 0.32),
    note(D4, 0.3, 0.26, 'triangle', 0.3),
  ],

  // Switching screens / a modal opening — a quick, soft noise-burst page turn.
  pageTurn: [
    noise(0, 0.1, { gain: 0.18, filterType: 'highpass', filterFreq: 1800, filterQ: 0.5, attack: 0.003 }),
    note(A5, 0.08, 0.09, 'sine', 0.14),
  ],
};
