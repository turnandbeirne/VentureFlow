// Small random-number helpers used throughout the game engine.
// Centralized here so the "randomness surface" is easy to find, and so we
// could later swap in a seeded PRNG (for replay/testing) without touching
// any other file.

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// Uniform noise in [-magnitude, +magnitude]
export function noise(magnitude) {
  return randomFloat(-magnitude, magnitude);
}

// Weighted pick from an object like { a: 0.7, b: 0.3 } -> 'a' | 'b'
export function weightedPick(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function pickRandom(arr) {
  return arr[randomInt(0, arr.length - 1)];
}
