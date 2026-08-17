// ============================================================================
// Leaderboard — persistent high-score list (separate from game save/resume)
// ----------------------------------------------------------------------------
// Stored in its own localStorage key so it survives "New Game" / "Play
// Again" and isn't tied to any single in-progress game. Entries are opt-in:
// nothing is saved here automatically when a game ends — a player chooses
// to add their result (see GameOverScreen).
//
// `email` is stored on the entry (so it's there if VentureMaker ever wants
// to follow up about a milestone, a future VentureScouts tie-in, etc.) but
// is NEVER read by any rendering code — see LeaderboardModal.jsx, which
// only ever reads name/avatar/netWorth/mode/playedAt off an entry.
// ============================================================================
import { LEADERBOARD_STORAGE_KEY, LEADERBOARD_MAX_ENTRIES } from '../data/gameConfig';

export function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(entries) {
  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable — the score just won't be remembered next visit.
  }
}

/**
 * Add a new leaderboard entry. Returns { entries, entry } — the updated,
 * sorted (desc by net worth), capped list, plus the entry just created (so
 * callers can e.g. highlight it without guessing at sort order/ties).
 * `email` is optional and private (see header).
 */
export function addLeaderboardEntry({ name, avatar, netWorth, mode, email }) {
  const entries = loadLeaderboard();
  const entry = {
    id: `lb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim().slice(0, 20),
    avatar: avatar || '🙂',
    netWorth: Math.round(netWorth),
    mode: mode || 'solo',
    email: email ? email.trim() : null,
    playedAt: Date.now(),
  };

  const next = [...entries, entry].sort((a, b) => b.netWorth - a.netWorth).slice(0, LEADERBOARD_MAX_ENTRIES);
  persist(next);
  return { entries: next, entry };
}

export function clearLeaderboard() {
  persist([]);
  return [];
}
