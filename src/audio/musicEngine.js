// ============================================================================
// Music engine — background music playback + volume/mute state
// ----------------------------------------------------------------------------
// Separate from soundEngine.js (which synthesizes short sound EFFECTS on the
// fly with the Web Audio API): this plays real recorded MUSIC tracks
// (bundled mp3s) through a single reused <audio> element, with its own
// independently adjustable volume/mute so a player can mix music down (or
// off) without losing sound effects, or vice versa.
//
// Two tracks, each with a different intended loudness ("normal" for the
// theme, "soft" for the in-game instrumental) baked in as a per-track gain
// multiplier — the user's volume slider scales on top of that, so the
// relative balance between the two stays sensible at any volume setting.
//
// This module is framework-free by design (same philosophy as src/game/ and
// soundEngine.js): React components read/write it through
// useMusicSettings.js.
// ============================================================================
import themeUrl from '../assets/audio/venture-forth-theme.mp3';
import backgroundUrl from '../assets/audio/relic-run-instrumental.mp3';

const STORAGE_KEY = 'ventureflow-music-v1';
const DEFAULT_VOLUME = 0.5;
const FADE_MS = 500;

// "theme" — the opening song, played at normal (full) relative loudness on
// the setup screen and again at game over.
// "background" — the instrumental, played softly under actual gameplay.
const TRACKS = {
  theme: { url: themeUrl, gain: 1 },
  background: { url: backgroundUrl, gain: 0.35 },
};

let audio = null;
let currentTrackId = null;
let fadeHandle = null;
let pendingResumeListenersAttached = false;

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
    // Storage unavailable — music still plays, it just won't remember next visit.
  }
}

function notify() {
  for (const listener of listeners) listener(settings);
}

function effectiveVolume() {
  return settings.muted ? 0 : settings.volume;
}

function targetVolumeFor(trackId) {
  const track = TRACKS[trackId];
  if (!track) return 0;
  return effectiveVolume() * track.gain;
}

function ensureAudio() {
  if (audio) return audio;
  if (typeof Audio === 'undefined') return null; // no audio support — no-ops everywhere below
  audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0;
  return audio;
}

function clearFade() {
  if (fadeHandle) {
    clearInterval(fadeHandle);
    fadeHandle = null;
  }
}

/** Smoothly ramp the element's volume to `target` over FADE_MS, then run `onDone` (if given). */
function fadeVolumeTo(el, target, onDone) {
  clearFade();
  const steps = 20;
  const stepMs = FADE_MS / steps;
  const start = el.volume;
  const delta = target - start;
  if (Math.abs(delta) < 0.001) {
    if (onDone) onDone();
    return;
  }
  let i = 0;
  fadeHandle = setInterval(() => {
    i += 1;
    const t = Math.min(1, i / steps);
    el.volume = Math.max(0, Math.min(1, start + delta * t));
    if (t >= 1) {
      clearFade();
      if (onDone) onDone();
    }
  }, stepMs);
}

/** Retry play() once the browser grants us a user gesture (autoplay policy). */
function attemptResumeOnNextGesture() {
  if (pendingResumeListenersAttached || typeof document === 'undefined') return;
  pendingResumeListenersAttached = true;
  const retry = () => {
    pendingResumeListenersAttached = false;
    document.removeEventListener('pointerdown', retry);
    document.removeEventListener('keydown', retry);
    document.removeEventListener('touchstart', retry);
    if (audio && currentTrackId) {
      audio.play().catch(() => {
        // Still blocked somehow — give up quietly rather than looping forever.
      });
    }
  };
  document.addEventListener('pointerdown', retry, { once: true });
  document.addEventListener('keydown', retry, { once: true });
  document.addEventListener('touchstart', retry, { once: true });
}

/**
 * Play a named track (see TRACKS above), fading out whatever's currently
 * playing first if it's a different track. Calling this with the track
 * that's already playing is a safe no-op (so mounting the same screen twice
 * — or "Play Again" going GameOver → Setup, both of which use "theme" —
 * doesn't restart the song from the top).
 */
export function playMusicTrack(trackId) {
  const track = TRACKS[trackId];
  if (!track) return;
  const el = ensureAudio();
  if (!el) return;

  if (currentTrackId === trackId) {
    // Already the active track — just make sure volume matches settings
    // (e.g. this call followed a mute/volume change) and that it's playing.
    fadeVolumeTo(el, targetVolumeFor(trackId));
    if (el.paused) el.play().catch(() => attemptResumeOnNextGesture());
    return;
  }

  const swapAndPlay = () => {
    currentTrackId = trackId;
    el.src = track.url;
    el.currentTime = 0;
    el.volume = 0;
    el.play()
      .then(() => fadeVolumeTo(el, targetVolumeFor(trackId)))
      .catch(() => attemptResumeOnNextGesture());
  };

  if (!el.paused && !el.ended) {
    fadeVolumeTo(el, 0, swapAndPlay);
  } else {
    swapAndPlay();
  }
}

/** Stop music entirely (fades out first). Not currently wired to any UI —
 * every screen has a track — but available for e.g. a future "silent mode". */
export function stopMusic() {
  if (!audio) return;
  fadeVolumeTo(audio, 0, () => {
    audio.pause();
    currentTrackId = null;
  });
}

export function getMusicSettings() {
  return settings;
}

export function setMusicVolume(volume) {
  settings = { ...settings, volume: Math.min(1, Math.max(0, volume)) };
  if (audio && currentTrackId) audio.volume = targetVolumeFor(currentTrackId);
  persistSettings();
  notify();
}

export function setMusicMuted(muted) {
  settings = { ...settings, muted };
  if (audio && currentTrackId) fadeVolumeTo(audio, targetVolumeFor(currentTrackId));
  persistSettings();
  notify();
}

export function toggleMusicMuted() {
  setMusicMuted(!settings.muted);
}

export function subscribeMusicSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
