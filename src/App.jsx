import { useGame } from './hooks/useGame';
import SetupScreen from './components/SetupScreen';
import GameBoard from './components/GameBoard';
import GameOverScreen from './components/GameOverScreen';

export default function App() {
  const game = useGame();
  const { state } = game;

  if (!state) {
    return <SetupScreen onStart={game.startGame} />;
  }

  if (state.status === 'gameover') {
    return <GameOverScreen state={state} onPlayAgain={game.newGame} />;
  }

  return <GameBoard game={game} />;
}
