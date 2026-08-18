import { useCallback, useState } from 'react';
import {
  loadProfile,
  recordGameResult,
  setSelectedTheme,
  unlockedAvatars,
  unlockedThemes,
  avatarUnlockProgress,
  themeUnlockProgress,
} from '../game/profile';

/** React glue for the lifetime profile / cosmetic-unlock system — mirrors
 * useLeaderboard.js's pattern. */
export function useProfile() {
  const [profile, setProfile] = useState(loadProfile);

  const refresh = useCallback(() => {
    setProfile(loadProfile());
  }, []);

  const recordResult = useCallback((payload) => {
    const result = recordGameResult(payload);
    setProfile(result.profile);
    return result;
  }, []);

  const selectTheme = useCallback((themeId) => {
    setProfile(setSelectedTheme(themeId));
  }, []);

  return {
    profile,
    refresh,
    recordResult,
    selectTheme,
    avatars: unlockedAvatars(profile),
    themes: unlockedThemes(profile),
    avatarProgress: avatarUnlockProgress(profile),
    themeProgress: themeUnlockProgress(profile),
  };
}
