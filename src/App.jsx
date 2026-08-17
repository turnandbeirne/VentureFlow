import { useGame } from './hooks/useGame';
import { useGameSounds } from './hooks/useGameSounds';
import SetupScreen from './components/SetupScreen';
import GameBoard from './components/GameBoard';
import GameOverScreen from './components/GameOverScreen';

export default function App() {
  const game = useGame();
  const { state } = game;

  // Mounted once at the top so it keeps watching the event log (and stays
  // in sync with the volume/mute setting) no matter which screen shows.
  useGameSounds(state?.log);

  if (!state) {
    return <SetupScreen onStart={game.startGame} />;
  }

  if (state.status === 'gameover') {
    return <GameOverScreen state={state} onPlayAgain={game.newGame} />;
  }

  return <GameBoard game={game} />;
}
