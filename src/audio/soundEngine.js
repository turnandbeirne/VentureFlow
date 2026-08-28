// ============================================================================
// Sound engine — Web Audio playback + volume/mute state
// ----------------------------------------------------------------------------
// Every effect is synthesized on the fly from soundLibrary.js, so there are
// no audio files to download or license — this keeps VentureFlow lightweight
// and works offline once loaded (good for classroom wifi).
//
// This module is framework-free by design (same philosophy as src/game/):
// React components read/write it through useAudioSettings.js.
// ============================================================================
import { SOUNDS } from './soundLibrary';

const STORAGE_KEY = 'ventureflow-audio-v1';
const DEFAULT_VOLUME = 0.6;

let audioContext = null;
let masterGain = null;
let noiseBuffer = null;

let settings = loadSettings();
const listeners = new Set();

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { volume: DEFAULT_VOLUME, muted: false };
    const parsed = JSON.parse(raw);
    return {
      volume: typeof parsed.volume === 'number' ? parsed.volume : DEFAULT_VOLUME,
      muted: !!parsed.muted,
    };
  } catch {
    return { volume: DEFAULT_VOLUME, muted: false };
  }
}

function persistSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable — audio still works, it just won't remember next visit.
  }
}

function notify() {
  for (const listener of listeners) listener(settings);
}

function ensureContext() {
  if (audioContext) return audioContext;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null; // very old / unsupported browser — sounds simply won't play
  audioContext = new Ctx();
  masterGain = audioContext.createGain();
  masterGain.gain.value = effectiveVolume();
  masterGain.connect(audioContext.destination);
  noiseBuffer = createNoiseBuffer(audioContext);
  return audioContext;
}

/** A couple seconds of white noise, generated once per context and sliced
 * from (at a random offset) for every noise-based note — crackle, applause,
 * crowd murmur, etc. Cheaper than generating fresh noise per note, and a
 * random offset keeps repeated bursts from sounding identical. */
function createNoiseBuffer(ctx) {
  const duration = 2;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function effectiveVolume() {
  return settings.muted ? 0 : settings.volume;
}

/** A pitched note: sine/triangle/square/sawtooth oscillator, optionally
 * sweeping from `freq` to `freqEnd` (used for firework whistles, cheer
 * "whoops"). */
function playToneNote(ctx, n, now) {
  const osc = ctx.createOscillator();
  const noteGain = ctx.createGain();
  osc.type = n.type;

  const startAt = now + n.start;
  const endAt = startAt + n.duration;

  if (n.freqEnd) {
    osc.frequency.setValueAtTime(n.freq, startAt);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, n.freqEnd), endAt);
  } else {
    osc.frequency.value = n.freq;
  }

  // Quick attack, smooth release so notes don't click/pop.
  noteGain.gain.setValueAtTime(0, startAt);
  noteGain.gain.linearRampToValueAtTime(n.gain, startAt + 0.012);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  osc.connect(noteGain);
  noteGain.connect(masterGain);
  osc.start(startAt);
  osc.stop(endAt + 0.02);
}

/** An unpitched burst: filtered white noise, used for firework crackle,
 * applause claps, and crowd-cheer texture — things a pure oscillator can't
 * convincingly make. */
function playNoiseNote(ctx, n, now) {
  const startAt = now + n.start;
  const endAt = startAt + n.duration;

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = n.filterType || 'bandpass';
  filter.Q.value = n.filterQ ?? 1;
  if (n.filterFreqEnd) {
    filter.frequency.setValueAtTime(n.filterFreq, startAt);
    filter.frequency.linearRampToValueAtTime(n.filterFreqEnd, endAt);
  } else {
    filter.frequency.value = n.filterFreq ?? 1800;
  }

  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(0, startAt);
  noteGain.gain.linearRampToValueAtTime(n.gain, startAt + (n.attack ?? 0.008));
  noteGain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  src.connect(filter);
  filter.connect(noteGain);
  noteGain.connect(masterGain);

  const maxOffset = Math.max(0, noiseBuffer.duration - n.duration - 0.01);
  const offset = Math.random() * maxOffset;
  src.start(startAt, offset, n.duration);
  src.stop(endAt + 0.02);
}

/**
 * Play a named effect from soundLibrary.js. Silently no-ops if audio is
 * unavailable. Most entries in SOUNDS are a static array of notes; a few
 * (fireworks, cheering, applause) are a function that GENERATES a fresh
 * randomized note list on every call, so those big celebratory moments
 * don't sound exactly the same twice.
 */
export function playSound(name) {
  const raw = SOUNDS[name];
  if (!raw) return;

  const ctx = ensureContext();
  if (!ctx) return;

  // Browsers suspend the context until a user gesture; every action that
  // triggers a sound IS a user gesture (a click), so this just resumes it.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (masterGain) masterGain.gain.value = effectiveVolume();
  if (effectiveVolume() <= 0) return;

  const recipe = typeof raw === 'function' ? raw() : raw;
  const now = ctx.currentTime;
  for (const n of recipe) {
    if (n.kind === 'noise') playNoiseNote(ctx, n, now);
    else playToneNote(ctx, n, now);
  }
}

export function getAudioSettings() {
  return settings;
}

export function setVolume(volume) {
  settings = { ...settings, volume: Math.min(1, Math.max(0, volume)) };
  if (masterGain) masterGain.gain.value = effectiveVolume();
  persistSettings();
  notify();
}

export function setMuted(muted) {
  settings = { ...settings, muted };
  if (masterGain) masterGain.gain.value = effectiveVolume();
  persistSettings();
  notify();
}

export function toggleMuted() {
  setMuted(!settings.muted);
}

export function subscribeAudioSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
