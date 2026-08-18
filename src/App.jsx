import { useGame } from './hooks/useGame';
import { useGameSounds } from './hooks/useGameSounds';
import { useChatSounds } from './hooks/useChatSounds';
import SetupScreen from './components/SetupScreen';
import GameBoard from './components/GameBoard';
import GameOverScreen from './components/GameOverScreen';

export default function App() {
  const game = useGame();
  const { state } = game;

  // Mounted once at the top so they keep watching the event log and bot
  // chat feed (and stay in sync with the volume/mute setting) no matter
  // which screen shows.
  useGameSounds(state?.log);
  useChatSounds(state?.chat);

  if (!state) {
    return <SetupScreen onStart={game.startGame} />;
  }

  if (state.status === 'gameover') {
    return <GameOverScreen state={state} onPlayAgain={game.newGame} />;
  }

  return <GameBoard game={game} />;
}
