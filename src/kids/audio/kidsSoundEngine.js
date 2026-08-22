// ============================================================================
// Kids sound engine — Web Audio playback for the "Just for Kids" edition
// ----------------------------------------------------------------------------
// Plays effects from kidsSoundLibrary.js. Structurally this mirrors
// src/audio/soundEngine.js's ensureContext/playToneNote/playNoiseNote/
// playSound (same synthesis approach: zero audio files, everything generated
// from oscillators + filtered noise at play time), simplified down to just
// what the kids app needs — no localStorage, no volume/mute setters, no
// subscriber bookkeeping of its own.
//
// Volume and mute are intentionally NOT duplicated here: the kids app shares
// the ONE audio setting the main game already owns (src/audio/soundEngine.js)
// so a parent only ever has a single mute toggle to find, and switching
// between the main game and the kids app never surprises anyone with a
// different volume. This module reads that shared setting fresh on every
// play via getAudioSettings().
// ============================================================================
import { getAudioSettings } from '../../audio/soundEngine';
import { KIDS_SOUNDS } from './kidsSoundLibrary';

let audioContext = null;
let masterGain = null;
let noiseBuffer = null;

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
 * from (at a random offset) for every noise-based note — dice rattle, page
 * turns, sparkle texture, etc. */
function createNoiseBuffer(ctx) {
  const duration = 2;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function effectiveVolume() {
  const { volume, muted } = getAudioSettings();
  return muted ? 0 : volume;
}

/** A pitched note: sine/triangle/square/sawtooth oscillator, optionally
 * sweeping from `freq` to `freqEnd`. */
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

/** An unpitched burst: filtered white noise, used for anything a pure
 * oscillator can't convincingly make — dice rattle, paper-flip, sparkle. */
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
 * Play a named effect from kidsSoundLibrary.js. Silently no-ops if the name
 * is unknown or audio is unavailable. Most entries in KIDS_SOUNDS are a
 * static array of notes; `bigWin` is a function that generates a fresh,
 * lightly-randomized note list on every call so the game's biggest moment
 * doesn't sound identical every time.
 */
export function playKidsSound(name) {
  const raw = KIDS_SOUNDS[name];
  if (!raw) return;

  const ctx = ensureContext();
  if (!ctx) return;

  // Browsers suspend the context until a user gesture; every action that
  // triggers a sound IS a user gesture (a tap), so this just resumes it.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const volume = effectiveVolume();
  masterGain.gain.value = volume;
  if (volume <= 0) return;

  const recipe = typeof raw === 'function' ? raw() : raw;
  const now = ctx.currentTime;
  for (const n of recipe) {
    if (n.kind === 'noise') playNoiseNote(ctx, n, now);
    else playToneNote(ctx, n, now);
  }
}
