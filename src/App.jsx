import { useGame } from './hooks/useGame';
import { useGameSounds } from './hooks/useGameSounds';
import { useChatSounds } from './hooks/useChatSounds';
import { useProfile } from './hooks/useProfile';
import SetupScreen from './components/SetupScreen';
import GameBoard from './components/GameBoard';
import GameOverScreen from './components/GameOverScreen';

export default function App() {
  const game = useGame();
  const { state } = game;
  // The unlockable board theme (see game/profile.js) is applied as a
  // data-theme attribute here at the root, so every screen picks it up
  // through theme.css's [data-theme='...'] overrides without each screen
  // needing to know cosmetics exist.
  const { profile, recordResult } = useProfile();

  // Mounted once at the top so they keep watching the event log and bot
  // chat feed (and stay in sync with the volume/mute setting) no matter
  // which screen shows.
  useGameSounds(state?.log);
  useChatSounds(state?.chat);

  return (
    <div data-theme={profile.selectedTheme}>
      {!state ? (
        <SetupScreen onStart={game.startGame} />
      ) : state.status === 'gameover' ? (
        <GameOverScreen state={state} onPlayAgain={game.newGame} onRecordProfileResult={recordResult} />
      ) : (
        <GameBoard game={game} />
      )}
    </div>
  );
}
