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
  return audioContext;
}

function effectiveVolume() {
  return settings.muted ? 0 : settings.volume;
}

/** Play a named effect from soundLibrary.js. Silently no-ops if audio is unavailable. */
export function playSound(name) {
  const recipe = SOUNDS[name];
  if (!recipe) return;

  const ctx = ensureContext();
  if (!ctx) return;

  // Browsers suspend the context until a user gesture; every action that
  // triggers a sound IS a user gesture (a click), so this just resumes it.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (masterGain) masterGain.gain.value = effectiveVolume();
  if (effectiveVolume() <= 0) return;

  const now = ctx.currentTime;
  for (const n of recipe) {
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    osc.type = n.type;
    osc.frequency.value = n.freq;

    const startAt = now + n.start;
    const endAt = startAt + n.duration;
    // Quick attack, smooth release so notes don't click/pop.
    noteGain.gain.setValueAtTime(0, startAt);
    noteGain.gain.linearRampToValueAtTime(n.gain, startAt + 0.012);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    osc.connect(noteGain);
    noteGain.connect(masterGain);
    osc.start(startAt);
    osc.stop(endAt + 0.02);
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
