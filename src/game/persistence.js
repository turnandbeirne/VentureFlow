// ============================================================================
// Save / resume via localStorage
// ============================================================================
import { LOCAL_STORAGE_KEY } from '../data/gameConfig';

export function saveGame(state) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
    return true;
  } catch (err) {
    console.warn('VentureFlow: could not save game.', err);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state || null;
  } catch (err) {
    console.warn('VentureFlow: could not load saved game.', err);
    return null;
  }
}

export function clearSavedGame() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (err) {
    console.warn('VentureFlow: could not clear saved game.', err);
  }
}

export function hasSavedGame() {
  try {
    return !!localStorage.getItem(LOCAL_STORAGE_KEY);
  } catch {
    return false;
  }
}
