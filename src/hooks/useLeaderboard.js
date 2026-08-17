import { useCallback, useState } from 'react';
import { loadLeaderboard, addLeaderboardEntry } from '../game/leaderboard';

export function useLeaderboard() {
  const [entries, setEntries] = useState(loadLeaderboard);

  const addEntry = useCallback((payload) => {
    const result = addLeaderboardEntry(payload);
    setEntries(result.entries);
    return result.entry;
  }, []);

  const refresh = useCallback(() => {
    setEntries(loadLeaderboard());
  }, []);

  return { entries, addEntry, refresh };
}
