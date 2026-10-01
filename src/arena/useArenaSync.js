// Remote hot-seat: at an arena table every browser runs the same pure
// gameReducer over the same ordered list of actions, so they all arrive at the
// same state. Moves are appended to the arena (vf_moves) through a signed
// edge function and read back by everyone. Nothing here runs unless the page
// was opened from the arena — see arenaBridge.js.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getArena, arenaSeats, playerIdForArenaUser } from './arenaBridge';
import { ARENA_MOVE_URL, ARENA_MOVES_REST, ARENA_PUBLISHABLE_KEY, ARENA_POLL_MS, ARENA_TRADE_BATCH_MS } from './arenaConfig';

// Actions that only matter to this browser and never go to the table.
const LOCAL_ONLY = new Set(['CLEAR_ERROR', 'NEW_GAME', 'LOAD_GAME']);

async function fetchMoves(tableId, afterSeq) {
  const res = await fetch(`${ARENA_MOVES_REST}?table_id=eq.${tableId}&seq=gt.${afterSeq}&order=seq.asc&select=seq,action`, {
    headers: { apikey: ARENA_PUBLISHABLE_KEY, Authorization: `Bearer ${ARENA_PUBLISHABLE_KEY}` },
  });
  if (!res.ok) throw new Error(`moves ${res.status}`);
  return res.json();
}

async function postMove(token, seq, action) {
  const res = await fetch(ARENA_MOVE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, seq, action }) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Wraps the reducer's dispatch. Returns the same `dispatch` when not at an
 * arena table; at a table, player actions go to the arena first and are
 * applied when they come back in order.
 */
export function useArenaSync(localDispatch, state) {
  const arena = getArena();
  const active = !!arena;
  const seqRef = useRef(0);          // highest seq applied locally
  const seatsRef = useRef(null);     // seat list from the START_GAME action
  const busyRef = useRef(false);
  const [status, setStatus] = useState(active ? 'connecting' : 'off');
  const [lastMoveAt, setLastMoveAt] = useState(Date.now());
  const [error, setError] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const startingRef = useRef(0);   // timestamp of the last START_GAME attempt

  const applyIncoming = useCallback(async () => {
    if (!arena || busyRef.current) return;
    busyRef.current = true;
    try {
      const rows = await fetchMoves(arena.tableId, seqRef.current);
      for (const row of rows) {
        if (row.seq !== seqRef.current + 1) continue; // gap: wait for the next poll
        if (row.action.type === 'START_GAME') seatsRef.current = row.action.mode.seats;
        localDispatch(row.action);
        seqRef.current = row.seq;
        setLastMoveAt(Date.now());
      }
      setStatus(seqRef.current === 0 ? 'waiting' : 'synced');
      setError(null);
      setPollCount((n) => n + 1);
    } catch (e) {
      setStatus('offline');
      setError(e.message);
    } finally {
      busyRef.current = false;
    }
  }, [arena, localDispatch]);

  // Poll for moves the whole time the page is open at a table.
  useEffect(() => {
    if (!active) return undefined;
    applyIncoming();
    const t = setInterval(applyIncoming, ARENA_POLL_MS);
    return () => clearInterval(t);
  }, [active, applyIncoming]);

  // A slow tick so time-based UI (the host's "hand this seat to a robot"
  // offer after a long silence) shows up without waiting for a move.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [active]);

  const send = useCallback(
    async (action) => {
      const res = await postMove(arena.token, seqRef.current + 1, action);
      if (res.ok) { await applyIncoming(); return true; }
      if (res.status === 409) { await applyIncoming(); return false; } // someone moved first; caller may retry
      setError(res.data?.error || `move rejected (${res.status})`);
      return false;
    },
    [arena, applyIncoming]
  );

  // Trades are coalesced: a press-and-hold fires BUY_ASSET many times a
  // second, and sending each one as its own round trip is what made bulk
  // buying crawl online. Same asset + same direction within a short window
  // becomes ONE action with a summed qty, clamped to what the player can
  // actually afford/sell at flush time so the table never sees a failing move.
  const stateRef = useRef(state); stateRef.current = state;
  const tradeRef = useRef(null);      // { playerId, assetId, type, qty }
  const tradeTimer = useRef(null);
  const [pendingTrade, setPendingTrade] = useState(null);
  const flushTrade = useCallback(async () => {
    const t = tradeRef.current; tradeRef.current = null; tradeTimer.current = null; setPendingTrade(null);
    if (!t) return;
    const st = stateRef.current; const player = st?.players?.find((p) => p.id === t.playerId); const price = st?.assetPrices?.[t.assetId] || 0;
    let qty = t.qty;
    if (player) qty = t.type === 'BUY_ASSET' ? Math.min(qty, price > 0 ? Math.floor(player.cash / price) : 0) : Math.min(qty, player.holdings?.[t.assetId] || 0);
    if (qty <= 0) return;
    const ok = await send({ type: t.type, playerId: t.playerId, assetId: t.assetId, qty });
    if (!ok) await send({ type: t.type, playerId: t.playerId, assetId: t.assetId, qty });   // one retry after a 409 re-sync
  }, [send]);
  const queueTrade = useCallback((action) => {
    const cur = tradeRef.current;
    const same = cur && cur.playerId === action.playerId && cur.assetId === action.assetId && cur.type === action.type;
    if (cur && !same) { if (tradeTimer.current) clearTimeout(tradeTimer.current); void flushTrade(); }
    const qty = (same ? cur.qty : 0) + (action.qty || 1);
    tradeRef.current = { playerId: action.playerId, assetId: action.assetId, type: action.type, qty };
    setPendingTrade({ assetId: action.assetId, type: action.type, qty });
    if (tradeTimer.current) clearTimeout(tradeTimer.current);
    tradeTimer.current = setTimeout(flushTrade, ARENA_TRADE_BATCH_MS);
  }, [flushTrade]);

  const dispatch = useCallback(
    (action) => {
      if (!active || LOCAL_ONLY.has(action.type)) return localDispatch(action);
      if (action.type === 'BUY_ASSET' || action.type === 'SELL_ASSET') { queueTrade(action); return undefined; }
      // anything else (end turn, start business…) goes after any trade still queued
      if (tradeRef.current) { if (tradeTimer.current) clearTimeout(tradeTimer.current); void flushTrade().then(() => send(action)); return undefined; }
      void send(action);
      return undefined;
    },
    [active, localDispatch, send, queueTrade, flushTrade]
  );

  // The host creates the game once; everyone else just receives it.
  const startIfHost = useCallback(() => {
    if (!arena || !arena.isHost || seqRef.current > 0) return;
    if (Date.now() - startingRef.current < 4000) return;   // one attempt at a time; retried on a later poll if it failed
    startingRef.current = Date.now();
    const seats = arenaSeats(arena);
    const s = arena.settings;
    void send({
      type: 'START_GAME',
      mode: { type: 'online', seats, tableId: arena.tableId },
      humanNames: seats.filter((x) => x.type === 'human').map((x) => x.name),
      difficultyId: s.difficultyId || 'medium',
      botConfigs: seats.filter((x) => x.type === 'ai').map((x) => ({ personalityId: x.personalityId, skillLevelId: x.skillLevelId })),
      scenarioId: s.scenarioId || 'classic',
      humanAvatars: seats.filter((x) => x.type === 'human').map((x) => x.avatar),
      turnTimer: s.turnTimer !== false,
      weatherSeverityId: s.weatherSeverityId || 'normal',
      seed: Number(s.seed) || 1,
    });
  }, [arena, send]);

  const seats = seatsRef.current || (arena ? arenaSeats(arena) : null);
  const localPlayerId = arena && arena.me && seats ? playerIdForArenaUser(seats, arena.me.id) : null;

  return {
    active,
    arena,
    dispatch,
    status,
    error,
    lastMoveAt,
    isHost: !!arena?.isHost,
    isObserver: !!arena?.isObserver,
    localPlayerId,
    seats,
    startIfHost,
    pollCount,
    pendingTrade,
    seq: seqRef.current,
  };
}
