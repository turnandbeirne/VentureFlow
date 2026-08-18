// ============================================================================
// Sound library — data-driven tone/noise "recipes"
// ----------------------------------------------------------------------------
// Every effect is a tiny sequence of synthesized notes (no audio files to
// load or license). Two kinds of note:
//
//   tone  { freq, start, duration, type, gain, freqEnd? }
//     freq      pitch in Hz
//     start     seconds after the sound begins
//     duration  seconds the note rings for
//     type      oscillator waveform: 'sine' | 'triangle' | 'square' | 'sawtooth'
//     gain      relative loudness, 0-1 (multiplied by master volume)
//     freqEnd   optional — sweeps from freq to freqEnd (firework whistles,
//               crowd "whoops"); omit for a flat pitch
//
//   noise { kind: 'noise', start, duration, gain, filterType?, filterFreq?,
//           filterFreqEnd?, filterQ?, attack? }
//     Filtered white noise — used for anything a pure oscillator can't
//     convincingly make: firework crackle, applause claps, crowd texture.
//
// A SOUNDS entry is normally a static array of notes. A few big one-off
// celebration sounds (fireworks/cheering/applause, and gameover which layers
// them in) are instead a FUNCTION that generates a fresh randomized note
// list every time it's called, so they don't sound identical on every game.
//
// Tune the whole game's audio feel by editing this file — nothing else
// needs to change.
// ============================================================================

const note = (freq, start, duration, type = 'sine', gain = 1) => ({ freq, start, duration, type, gain });

// A tone that sweeps from `freq` up/down to `freqEnd` — firework whistles,
// crowd "whoop"s.
const sweep = (freq, freqEnd, start, duration, type = 'sine', gain = 1) => ({
  freq,
  freqEnd,
  start,
  duration,
  type,
  gain,
});

// A burst of filtered white noise — crackle, claps, murmur.
const noise = (
  start,
  duration,
  { gain = 0.4, filterType = 'bandpass', filterFreq = 1800, filterFreqEnd, filterQ = 1, attack = 0.008 } = {}
) => ({ kind: 'noise', start, duration, gain, filterType, filterFreq, filterFreqEnd, filterQ, attack });

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// One firework shell: a rising whistle as it launches, then a crackly
// noise-burst "boom" with a couple of high sparkly crackle tails.
function fireworkShell(startAt) {
  const launchDur = rand(0.3, 0.55);
  const boomDelay = launchDur * 0.85;
  const boomDur = rand(0.35, 0.65);
  const boomFreq = rand(700, 1600);
  return [
    sweep(rand(450, 650), rand(1300, 1900), startAt, launchDur, 'sine', 0.22),
    noise(startAt + boomDelay, boomDur, {
      gain: 0.5,
      filterType: 'bandpass',
      filterFreq: boomFreq,
      filterFreqEnd: boomFreq * 0.3,
      filterQ: 0.7,
      attack: 0.002,
    }),
    noise(startAt + boomDelay + 0.06, boomDur * 0.6, {
      gain: 0.26,
      filterType: 'highpass',
      filterFreq: 3200,
      filterQ: 0.5,
      attack: 0.001,
    }),
  ];
}

function buildFireworks() {
  const shellCount = 4 + Math.floor(Math.random() * 2); // 4-5 shells
  const notes = [];
  let t = 0;
  for (let i = 0; i < shellCount; i++) {
    notes.push(...fireworkShell(t));
    t += rand(0.4, 0.75);
  }
  return notes;
}

// A crowd cheer: several staggered "whoop" voices sweeping upward, over a
// soft filtered-noise murmur bed.
function buildCheer() {
  const voiceCount = 6 + Math.floor(Math.random() * 4); // 6-9 whoops
  const notes = [
    noise(0, 1.7, { gain: 0.09, filterType: 'bandpass', filterFreq: 1100, filterQ: 0.4, attack: 0.12 }),
  ];
  for (let i = 0; i < voiceCount; i++) {
    const base = rand(240, 480);
    notes.push(sweep(base, base + rand(200, 420), rand(0, 1.3), rand(0.45, 0.85), pick(['sawtooth', 'triangle']), rand(0.14, 0.22)));
  }
  return notes;
}

// Thunderous applause: a cluster of individual noise-burst "claps" plus a
// low rumble underneath to give it weight.
function buildApplause() {
  const clapCount = 26 + Math.floor(Math.random() * 12); // 26-37 claps
  const notes = [
    note(70, 0, 1.7, 'sine', 0.22),
    note(55, 0.15, 1.5, 'sine', 0.16),
  ];
  for (let i = 0; i < clapCount; i++) {
    notes.push(
      noise(rand(0, 1.6), rand(0.045, 0.08), {
        gain: rand(0.3, 0.48),
        filterType: 'bandpass',
        filterFreq: rand(1400, 2900),
        filterQ: 0.9,
        attack: 0.001,
      })
    );
  }
  return notes;
}

// The musical fanfare that plays on every game over, before fireworks/cheer
// get layered on top of it in SOUNDS.gameover below.
const GAMEOVER_FANFARE = [
  note(523.25, 0, 0.12, 'triangle', 0.5),
  note(659.25, 0.11, 0.12, 'triangle', 0.5),
  note(783.99, 0.22, 0.12, 'triangle', 0.5),
  note(1046.5, 0.33, 0.14, 'triangle', 0.55),
  note(1318.51, 0.47, 0.32, 'triangle', 0.6),
];

export const SOUNDS = {
  // Soft UI tap — mode selection, dismiss buttons, generic clicks.
  click: [note(520, 0, 0.06, 'triangle', 0.5)],

  // Generic buy/sell fallback — used only if an asset added later (see
  // gameConfig.js ASSETS) doesn't have its own buy_<id>/sell_<id> below.
  buy: [note(660, 0, 0.09, 'triangle', 0.7), note(880, 0.06, 0.11, 'triangle', 0.6)],
  sell: [note(700, 0, 0.08, 'triangle', 0.6), note(520, 0.06, 0.1, 'triangle', 0.5)],

  // Piggy Bank — cute, soft, safe. A gentle double "boop."
  buy_piggy: [note(440, 0, 0.08, 'sine', 0.5), note(440, 0.09, 0.11, 'sine', 0.45)],
  sell_piggy: [note(392, 0, 0.13, 'sine', 0.4)],

  // Lemonade Co. — bright and bouncy, like a little "sproing."
  buy_lemonade: [
    note(660, 0, 0.06, 'triangle', 0.55),
    note(830, 0.05, 0.06, 'triangle', 0.5),
    note(990, 0.1, 0.13, 'triangle', 0.55),
  ],
  sell_lemonade: [note(700, 0, 0.07, 'triangle', 0.45), note(550, 0.06, 0.1, 'triangle', 0.4)],

  // Tree House — warm and cozy, a little wooden chime.
  buy_treehouse: [
    note(392, 0, 0.09, 'triangle', 0.45),
    note(494, 0.08, 0.09, 'triangle', 0.48),
    note(587.33, 0.16, 0.15, 'triangle', 0.52),
  ],
  sell_treehouse: [note(440, 0, 0.06, 'square', 0.3), note(370, 0.06, 0.11, 'square', 0.3)],

  // Treasure Chest — shimmery and exciting, big risk energy.
  buy_treasure: [
    note(523.25, 0, 0.06, 'sawtooth', 0.35),
    note(659.25, 0.05, 0.06, 'sawtooth', 0.35),
    note(783.99, 0.1, 0.06, 'sawtooth', 0.4),
    note(1046.5, 0.15, 0.2, 'sine', 0.5),
  ],
  sell_treasure: [note(880, 0, 0.05, 'sine', 0.4), note(660, 0.05, 0.05, 'sine', 0.35), note(440, 0.1, 0.13, 'sine', 0.35)],

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

  // Game over — the victory fanfare plus a fresh, randomized burst of
  // fireworks and crowd cheering layered on top every time.
  gameover: () => [...GAMEOVER_FANFARE, ...buildFireworks(), ...buildCheer()],

  // Available standalone too (e.g. a future "watch the fireworks again"
  // replay button) — same generators the gameover sound uses.
  fireworks: buildFireworks,
  cheering: buildCheer,

  // Thunderous applause — played when a saved score lands in the Top 20.
  applause: buildApplause,

  // Something couldn't be done (reserved for future use).
  error: [note(220, 0, 0.12, 'square', 0.35)],
};
