// VentureArena connection details. These are PUBLIC values (the arena's
// publishable key is safe in a browser: row-level security does the guarding).
export const ARENA_SUPABASE_URL = 'https://hyovqcgvqtdwzsizboim.supabase.co';
export const ARENA_PUBLISHABLE_KEY = 'sb_publishable_3j6g5S2_LdEos4QCkljK0g_VRMsY_uf';
export const ARENA_SITE_URL = 'https://venturearena.onrender.com';
export const ARENA_MOVE_URL = `${ARENA_SUPABASE_URL}/functions/v1/vf-move`;
export const ARENA_MOVES_REST = `${ARENA_SUPABASE_URL}/rest/v1/vf_moves`;
// How often a browser at an online table asks for moves it has not seen.
export const ARENA_POLL_MS = 1500;
// After this long without a move on a human's turn, the host may hand the
// seat to a robot (CONVERT_SEAT_TO_AI) so the table is never stuck.
// Stall ladder on a live human's turn, measured from the table's last move:
// a nudge for the player, then notice that the table may replace them, then
// (after the cure window) the other players may vote and the host may act.
export const ARENA_STALL_WARN_MS = 40 * 1000;
export const ARENA_STALL_NOTICE_MS = 60 * 1000;
export const ARENA_STALL_CURE_MS = 20 * 1000;   // vote opens at NOTICE + CURE
export const ARENA_STALL_MS = ARENA_STALL_NOTICE_MS + ARENA_STALL_CURE_MS;

// Trades fired within this window (a press-and-hold) are sent as one move.
export const ARENA_TRADE_BATCH_MS = 220;
