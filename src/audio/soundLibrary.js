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

// ============================================================================
// Per-asset sound POOLS — variety, so buying twenty of something doesn't
// play the identical blip twenty times
// ----------------------------------------------------------------------------
// Each buyable asset has a family of short character sounds rather than one
// fixed effect, picked fresh on every purchase. A `weight` biases the pick:
// the everyday sounds come up often, and the joke ones (the fart, the Tarzan
// yodel) are genuinely rare, which is what makes them land when they do.
//
// Randomness here is plain Math.random on purpose. Everything under
// src/game/ routes through the seeded PRNG because it affects game STATE and
// has to be reproducible; sound is pure presentation, never stored, and
// nothing downstream depends on which variant played.
// ============================================================================

/** Scale every note in a recipe — used so a sale reuses the buy pool at a
 * lower level rather than needing a second set of sounds. */
function quieter(recipe, factor) {
  return recipe.map((n) => ({ ...n, gain: (n.gain ?? 1) * factor }));
}

/** Pick one variant from a weighted pool and return its note list. */
function pickWeighted(pool) {
  const total = pool.reduce((sum, v) => sum + v.weight, 0);
  let roll = Math.random() * total;
  for (const variant of pool) {
    roll -= variant.weight;
    if (roll <= 0) return variant.build();
  }
  return pool[pool.length - 1].build();
}

// --- Piggy Bank: cute, greedy, a bit gross ---------------------------------
const PIGGY_SOUNDS = [
  {
    // Oink — two short nasal grunts, pitch dropping.
    weight: 22,
    build: () => [
      sweep(420, 300, 0, 0.09, 'sawtooth', 0.32),
      sweep(380, 250, 0.11, 0.11, 'sawtooth', 0.3),
    ],
  },
  {
    // Slurp — a wet rising suck that ends in a little pop.
    weight: 16,
    build: () => [
      noise(0, 0.18, { gain: 0.24, filterType: 'bandpass', filterFreq: 700, filterFreqEnd: 2600, filterQ: 4 }),
      note(rand(680, 820), 0.18, 0.05, 'sine', 0.35),
    ],
  },
  {
    // Bubble pop — a single round blip that snaps upward.
    weight: 18,
    build: () => [
      sweep(rand(300, 420), rand(900, 1200), 0, 0.06, 'sine', 0.4),
      noise(0.05, 0.03, { gain: 0.16, filterType: 'highpass', filterFreq: 2600, attack: 0.001 }),
    ],
  },
  {
    // A tiny cheer — two bright ascending notes.
    weight: 16,
    build: () => [note(660, 0, 0.07, 'triangle', 0.34), note(880, 0.07, 0.12, 'triangle', 0.32)],
  },
  {
    // Contented "ahhh" — a sighing fall.
    weight: 12,
    build: () => [sweep(520, 330, 0, 0.3, 'sine', 0.26)],
  },
  {
    // Munching — three quick chomps.
    weight: 12,
    build: () => [
      noise(0, 0.05, { gain: 0.22, filterType: 'lowpass', filterFreq: 900, attack: 0.001 }),
      noise(0.09, 0.05, { gain: 0.2, filterType: 'lowpass', filterFreq: 800, attack: 0.001 }),
      noise(0.18, 0.06, { gain: 0.18, filterType: 'lowpass', filterFreq: 700, attack: 0.001 }),
    ],
  },
  {
    // Belch.
    weight: 7,
    build: () => [
      sweep(150, 90, 0, 0.34, 'sawtooth', 0.32),
      noise(0, 0.34, { gain: 0.14, filterType: 'lowpass', filterFreq: 420, filterQ: 2, attack: 0.02 }),
    ],
  },
  {
    // Rare: the fart.
    weight: 2,
    build: () => [
      sweep(rand(105, 135), rand(58, 78), 0, 0.42, 'sawtooth', 0.34),
      noise(0, 0.42, { gain: 0.2, filterType: 'lowpass', filterFreq: 320, filterFreqEnd: 160, filterQ: 3, attack: 0.01 }),
    ],
  },
];

// --- Lemonade Stands & More: a small service business at work ---------------
const LEMONADE_SOUNDS = [
  {
    // Service bell — bright strike with a long shimmering tail.
    weight: 20,
    build: () => [
      note(2093, 0, 0.5, 'sine', 0.3),
      note(3136, 0, 0.34, 'sine', 0.14),
      noise(0, 0.02, { gain: 0.12, filterType: 'highpass', filterFreq: 4000, attack: 0.001 }),
    ],
  },
  {
    // Cash register — the drawer clunk, then a two-note cha-ching.
    weight: 20,
    build: () => [
      noise(0, 0.05, { gain: 0.26, filterType: 'bandpass', filterFreq: 900, filterQ: 1.2, attack: 0.001 }),
      note(1318, 0.05, 0.14, 'triangle', 0.32),
      note(1760, 0.13, 0.26, 'triangle', 0.3),
    ],
  },
  {
    // Delivery horn — two short blasts.
    weight: 14,
    build: () => [note(392, 0, 0.11, 'square', 0.22), note(392, 0.15, 0.16, 'square', 0.2)],
  },
  {
    // Blender / smoothie machine spinning up and cutting out.
    weight: 12,
    build: () => [
      noise(0, 0.34, { gain: 0.2, filterType: 'bandpass', filterFreq: 600, filterFreqEnd: 1500, filterQ: 2, attack: 0.05 }),
      sweep(120, 190, 0, 0.34, 'sawtooth', 0.12),
    ],
  },
  {
    // "Order up!" — two quick counter dings.
    weight: 14,
    build: () => [note(1568, 0, 0.13, 'sine', 0.28), note(2093, 0.12, 0.22, 'sine', 0.26)],
  },
  {
    // Coins dropping into the tin.
    weight: 12,
    build: () => [
      note(rand(1500, 1900), 0, 0.07, 'triangle', 0.24),
      note(rand(1100, 1400), 0.08, 0.07, 'triangle', 0.22),
      note(rand(800, 1000), 0.15, 0.13, 'triangle', 0.2),
    ],
  },
  {
    // Ice into a cup — a bright rattle.
    weight: 8,
    build: () => [
      noise(0, 0.05, { gain: 0.2, filterType: 'highpass', filterFreq: 3800, attack: 0.001 }),
      noise(0.06, 0.05, { gain: 0.17, filterType: 'highpass', filterFreq: 4200, attack: 0.001 }),
      noise(0.13, 0.07, { gain: 0.14, filterType: 'highpass', filterFreq: 3400, attack: 0.001 }),
    ],
  },
];

// --- Tree House: building it, and living around it -------------------------
const TREEHOUSE_SOUNDS = [
  {
    // Hammering — three wooden thwacks.
    weight: 20,
    build: () => [
      noise(0, 0.06, { gain: 0.3, filterType: 'bandpass', filterFreq: 500, filterQ: 1.4, attack: 0.001 }),
      noise(0.16, 0.06, { gain: 0.28, filterType: 'bandpass', filterFreq: 520, filterQ: 1.4, attack: 0.001 }),
      noise(0.32, 0.08, { gain: 0.26, filterType: 'bandpass', filterFreq: 470, filterQ: 1.4, attack: 0.001 }),
    ],
  },
  {
    // Handsaw — two rasping strokes.
    weight: 14,
    build: () => [
      noise(0, 0.22, { gain: 0.2, filterType: 'bandpass', filterFreq: 1400, filterFreqEnd: 2600, filterQ: 2.5, attack: 0.03 }),
      noise(0.26, 0.2, { gain: 0.18, filterType: 'bandpass', filterFreq: 2400, filterFreqEnd: 1300, filterQ: 2.5, attack: 0.03 }),
    ],
  },
  {
    // Paint roller — soft swishes.
    weight: 10,
    build: () => [
      noise(0, 0.2, { gain: 0.14, filterType: 'bandpass', filterFreq: 2200, filterQ: 0.8, attack: 0.06 }),
      noise(0.24, 0.2, { gain: 0.12, filterType: 'bandpass', filterFreq: 1900, filterQ: 0.8, attack: 0.06 }),
    ],
  },
  {
    // Doorbell — the classic ding-dong.
    weight: 14,
    build: () => [note(659.25, 0, 0.32, 'sine', 0.3), note(523.25, 0.3, 0.5, 'sine', 0.28)],
  },
  {
    // Lawnmower a few gardens away.
    weight: 10,
    build: () => [
      sweep(88, 104, 0, 0.5, 'sawtooth', 0.16),
      noise(0, 0.5, { gain: 0.12, filterType: 'lowpass', filterFreq: 700, filterQ: 1.5, attack: 0.08 }),
    ],
  },
  {
    // Bird in the branches.
    weight: 14,
    build: () => [
      sweep(2400, 3400, 0, 0.06, 'sine', 0.22),
      sweep(3200, 2500, 0.09, 0.06, 'sine', 0.2),
      sweep(2600, 3600, 0.2, 0.05, 'sine', 0.18),
    ],
  },
  {
    // Cat, unimpressed.
    weight: 10,
    build: () => [
      sweep(520, 780, 0, 0.16, 'sawtooth', 0.16),
      sweep(780, 430, 0.15, 0.3, 'sawtooth', 0.16),
    ],
  },
  {
    // Rare: the jungle yodel.
    weight: 3,
    build: () => [
      sweep(330, 620, 0, 0.18, 'sawtooth', 0.24),
      sweep(620, 460, 0.18, 0.1, 'sawtooth', 0.22),
      sweep(460, 700, 0.28, 0.1, 'sawtooth', 0.22),
      sweep(700, 480, 0.38, 0.12, 'sawtooth', 0.22),
      sweep(480, 760, 0.5, 0.1, 'sawtooth', 0.2),
      sweep(760, 330, 0.6, 0.32, 'sawtooth', 0.2),
    ],
  },
];

// --- Treasure Chest: speculative, glittery, slightly ominous ----------------
const TREASURE_SOUNDS = [
  {
    // Sparkle cascade.
    weight: 34,
    build: () => [
      note(880, 0, 0.06, 'sine', 0.3),
      note(1174, 0.05, 0.06, 'sine', 0.28),
      note(1568, 0.1, 0.06, 'sine', 0.26),
      note(2093, 0.15, 0.22, 'sine', 0.24),
    ],
  },
  {
    // Heavy lid creaking open.
    weight: 22,
    build: () => [
      sweep(180, 320, 0, 0.34, 'sawtooth', 0.12),
      noise(0, 0.34, { gain: 0.12, filterType: 'bandpass', filterFreq: 900, filterFreqEnd: 1800, filterQ: 3, attack: 0.05 }),
      note(1568, 0.3, 0.26, 'sine', 0.2),
    ],
  },
  {
    // Gems tumbling.
    weight: 24,
    build: () => [
      note(rand(1700, 2200), 0, 0.05, 'triangle', 0.22),
      note(rand(1300, 1700), 0.06, 0.05, 'triangle', 0.2),
      note(rand(2000, 2600), 0.12, 0.05, 'triangle', 0.2),
      note(rand(1500, 1900), 0.19, 0.14, 'triangle', 0.18),
    ],
  },
  {
    // A single deep, expensive-sounding chime.
    weight: 20,
    build: () => [note(1046.5, 0, 0.6, 'sine', 0.26), note(1567.98, 0.02, 0.45, 'sine', 0.12)],
  },
];

export const SOUNDS = {
  // Soft UI tap — mode selection, dismiss buttons, generic clicks.
  click: [note(520, 0, 0.06, 'triangle', 0.5)],

  // A bot chat bubble popping in — quick, light, unobtrusive (this can fire
  // several times in a row during a lively exchange, so it stays tiny).
  chat: [note(740, 0, 0.045, 'sine', 0.3), note(950, 0.04, 0.05, 'sine', 0.22)],

  // Generic buy/sell fallback — used only if an asset added later (see
  // gameConfig.js ASSETS) doesn't have its own buy_<id>/sell_<id> below.
  buy: [note(660, 0, 0.09, 'triangle', 0.7), note(880, 0.06, 0.11, 'triangle', 0.6)],
  sell: [note(700, 0, 0.08, 'triangle', 0.6), note(520, 0.06, 0.1, 'triangle', 0.5)],

  // Piggy Bank — cute, soft, safe. A gentle double "boop."
  // Each asset draws from its own pool of character sounds (see the
  // *_SOUNDS pools above) rather than repeating one fixed blip. Selling
  // reuses the same pool at a lower gain, so an asset still SOUNDS like
  // itself on the way out without the sale feeling like a celebration.
  buy_piggy: () => pickWeighted(PIGGY_SOUNDS),
  sell_piggy: () => quieter(pickWeighted(PIGGY_SOUNDS), 0.6),
  buy_lemonade: () => pickWeighted(LEMONADE_SOUNDS),
  sell_lemonade: () => quieter(pickWeighted(LEMONADE_SOUNDS), 0.6),
  buy_treehouse: () => pickWeighted(TREEHOUSE_SOUNDS),
  sell_treehouse: () => quieter(pickWeighted(TREEHOUSE_SOUNDS), 0.6),
  buy_treasure: () => pickWeighted(TREASURE_SOUNDS),
  sell_treasure: () => quieter(pickWeighted(TREASURE_SOUNDS), 0.6),

  // The physical feel of the button itself — a very short, punchy "thock"
  // played on every press, including each repeat of a press-and-hold. It's
  // deliberately tiny and low: it has to survive being fired ten times a
  // second without becoming noise, which the asset character sounds above
  // would not. Paired with the border flash in game.css.
  buttonPress: [
    note(190, 0, 0.035, 'square', 0.3),
    note(95, 0.012, 0.05, 'sine', 0.26),
    noise(0, 0.02, { gain: 0.12, filterType: 'lowpass', filterFreq: 1400, attack: 0.001 }),
  ],

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

  // Business exit / buyout offer — a "cha-ching!" jackpot: a quick cash-
  // register-ish double ding followed by a bright ascending flourish, bigger
  // than the badge fanfare since a 20x offer is the rarest payday in the
  // game.
  businessExit: [
    note(1046.5, 0, 0.07, 'square', 0.5),
    note(1318.51, 0.06, 0.09, 'square', 0.5),
    note(659.25, 0.16, 0.09, 'sine', 0.5),
    note(880, 0.24, 0.09, 'sine', 0.55),
    note(1108.73, 0.32, 0.1, 'sine', 0.58),
    note(1567.98, 0.41, 0.26, 'sine', 0.6),
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

  // ---------------------------------------------------------------------
  // Bot goof-off sound effects — see game/chatEngine.js's
  // generateBotTurnFlavor() and gameConfig.js BOT_PERSONALITIES' sfxPool.
  // Each robot has a chance, on its own turn, to play one of these silly
  // noises instead of (or alongside) a spoken line. All original
  // synthesized bits — no sampled/licensed audio — just built to hit the
  // same goofy notes as a fart, a burp, a hype shout, a groan, a "take
  // that back!", a cartoon laugh, a screech, a mock-dramatic hero sting, a
  // hiccup, a chicken squawk, an airhorn blast, a smooch, a mic drop, and a
  // sneeze.
  // ---------------------------------------------------------------------
  botFart: [
    note(150, 0, 0.06, 'sawtooth', 0.45),
    note(110, 0.05, 0.06, 'sawtooth', 0.45),
    note(90, 0.1, 0.08, 'sawtooth', 0.4),
    note(70, 0.17, 0.14, 'sawtooth', 0.35),
    noise(0, 0.32, { gain: 0.28, filterType: 'lowpass', filterFreq: 500, filterFreqEnd: 150, filterQ: 1, attack: 0.005 }),
  ],
  botBurp: [
    sweep(220, 90, 0, 0.28, 'sawtooth', 0.5),
    noise(0, 0.12, { gain: 0.22, filterType: 'lowpass', filterFreq: 600, filterQ: 0.8, attack: 0.003 }),
  ],
  botOhYeah: [
    sweep(300, 700, 0, 0.22, 'sawtooth', 0.5),
    note(880, 0.2, 0.12, 'triangle', 0.45),
    note(660, 0.3, 0.12, 'triangle', 0.4),
  ],
  botGroan: [sweep(300, 150, 0, 0.5, 'sawtooth', 0.4), sweep(280, 140, 0.05, 0.5, 'triangle', 0.25)],
  botTakeItBack: [sweep(500, 900, 0, 0.15, 'square', 0.4), note(200, 0.16, 0.14, 'square', 0.45)],
  botLaugh: [
    note(440, 0, 0.08, 'square', 0.4),
    note(370, 0.09, 0.08, 'square', 0.4),
    note(440, 0.19, 0.08, 'square', 0.4),
    note(370, 0.28, 0.08, 'square', 0.4),
    note(490, 0.38, 0.12, 'square', 0.42),
  ],
  botScreech: [noise(0, 0.35, { gain: 0.4, filterType: 'bandpass', filterFreq: 2600, filterFreqEnd: 3400, filterQ: 6, attack: 0.01 })],
  botHeroSting: [
    note(196, 0, 0.14, 'sawtooth', 0.5),
    note(196, 0.16, 0.14, 'sawtooth', 0.5),
    sweep(220, 440, 0.32, 0.24, 'sawtooth', 0.55),
  ],
  // A sudden interrupted little "hic!"
  botHiccup: [note(300, 0, 0.05, 'square', 0.4), note(520, 0.09, 0.045, 'square', 0.45)],
  // A chicken-ish squawk — perfect for Leeroy's avatar.
  botSquawk: [
    note(600, 0, 0.05, 'sawtooth', 0.4),
    note(750, 0.04, 0.05, 'sawtooth', 0.42),
    note(550, 0.09, 0.05, 'sawtooth', 0.4),
    note(800, 0.13, 0.07, 'sawtooth', 0.45),
    noise(0, 0.22, { gain: 0.2, filterType: 'bandpass', filterFreq: 1800, filterFreqEnd: 2400, filterQ: 3, attack: 0.005 }),
  ],
  // A hype airhorn blast — two slightly-detuned tones beating against each
  // other for texture, with a little pitch droop at the end.
  botAirhorn: [
    note(220, 0, 0.4, 'sawtooth', 0.55),
    note(221, 0, 0.4, 'square', 0.3),
    sweep(220, 190, 0.25, 0.2, 'sawtooth', 0.4),
  ],
  // A quick, cute "mwah!"
  botKiss: [sweep(500, 900, 0, 0.08, 'sine', 0.4), sweep(900, 500, 0.08, 0.1, 'sine', 0.35)],
  // A confident low thud, like dropping a mic.
  botMicDrop: [note(90, 0, 0.18, 'sine', 0.5), noise(0, 0.15, { gain: 0.3, filterType: 'lowpass', filterFreq: 300, filterQ: 0.7, attack: 0.002 })],
  // Building sniffle, then the "AH-CHOO!" release.
  botSneeze: [
    sweep(300, 500, 0, 0.18, 'sawtooth', 0.35),
    noise(0.18, 0.15, { gain: 0.4, filterType: 'highpass', filterFreq: 1200, filterQ: 0.6, attack: 0.001 }),
  ],

  // Something couldn't be done (reserved for future use).
  error: [note(220, 0, 0.12, 'square', 0.35)],
};
