// Small random-number helpers used throughout the game engine.
// Centralized here so the "randomness surface" is easy to find.
//
// Backed by a seedable deterministic PRNG (mulberry32) rather than raw
// Math.random(). Every exported function keeps its original signature, so
// nothing elsewhere in the engine had to change to pick this up — normal
// play self-seeds from real entropy at module load (see below) and behaves
// exactly as before. seedRng() lets a caller reset the sequence to a known
// starting point, which is what makes the Daily Challenge mode (see
// game/dailyChallenge.js) work: every player who plays "today's challenge"
// gets the identical weather timeline, fortune-card draws, and price-drift
// noise, so differences in the final score come from player choices, not
// random luck.
let state = seedFromEntropy();

function seedFromEntropy() {
  // No Math.random() ban here — this is the one place in the whole engine
  // that's allowed to touch real entropy, since it's just picking an
  // unpredictable STARTING point for the deterministic generator below, not
  // generating gameplay outcomes directly.
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

/** mulberry32 — small, fast, good-enough-for-a-kids'-board-game PRNG. */
function nextUint32() {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0);
}

/** A float in [0, 1) — the seedable stand-in for Math.random() used by
 * every helper below. */
function next() {
  return nextUint32() / 4294967296;
}

/** Reset the generator to a known starting point. Pass any finite number
 * (e.g. a hash of today's date — see game/dailyChallenge.js). Every random
 * call anywhere in the engine (weather duration, fortune-card draws, price
 * drift noise, business names, robot personality/skill rolls) flows through
 * this same generator, so seeding it once at the start of a game makes that
 * whole game's randomness reproducible. */
export function seedRng(seed) {
  state = (Math.floor(seed) || 0) >>> 0;
  // Run the generator forward once so a seed of 0 (or any value that would
  // otherwise produce a degenerate first output) still mixes properly.
  nextUint32();
}

export function randomInt(min, max) {
  return Math.floor(next() * (max - min + 1)) + min;
}

export function randomFloat(min, max) {
  return next() * (max - min) + min;
}

// Uniform noise in [-magnitude, +magnitude]
export function noise(magnitude) {
  return randomFloat(-magnitude, magnitude);
}

// True with probability `p` (0-1). Centralizing this (rather than every
// caller writing its own `Math.random() < p`) is what keeps every
// probabilistic decision in the engine part of the same seedable sequence.
export function chance(p) {
  return next() < p;
}

// Weighted pick from an object like { a: 0.7, b: 0.3 } -> 'a' | 'b'
export function weightedPick(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = next() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function pickRandom(arr) {
  return arr[randomInt(0, arr.length - 1)];
}
