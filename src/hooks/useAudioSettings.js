import { useCallback, useEffect, useState } from 'react';
import {
  getAudioSettings,
  setVolume,
  toggleMuted,
  subscribeAudioSettings,
  playSound,
} from '../audio/soundEngine';

/** React glue for the volume/mute control — stays in sync across components. */
export function useAudioSettings() {
  const [settings, setSettings] = useState(getAudioSettings);

  useEffect(() => subscribeAudioSettings(setSettings), []);

  const changeVolume = useCallback((value) => {
    setVolume(value);
  }, []);

  const toggle = useCallback(() => {
    toggleMuted();
    // Give a little feedback tone right as you unmute so it's obvious it worked.
    setTimeout(() => playSound('click'), 0);
  }, []);

  return { ...settings, setVolume: changeVolume, toggleMuted: toggle };
}
