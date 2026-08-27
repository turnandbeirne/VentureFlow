import { useCallback, useState } from 'react';
import { useGame } from './hooks/useGame';
import { useGameSounds } from './hooks/useGameSounds';
import { useChatSounds } from './hooks/useChatSounds';
import { useProfile } from './hooks/useProfile';
import LandingScreen from './components/LandingScreen';
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

  // Which pre-game screen is showing. The landing page is the front door
  // (explains the game, shows the top 5, one-click Quick Play); "Customize"
  // steps forward to the full setup screen, and finishing or abandoning a
  // game comes back to the landing page. Deliberately local UI state rather
  // than anything in the game reducer — no game exists yet at this point.
  const [preGameScreen, setPreGameScreen] = useState('landing');
  // "🗺️ View Game Board" on the Game Over screen flips this on to show the
  // final board (read-only — see GameBoard.jsx's readOnly prop) instead of
  // the leaderboard/recap screen; "← Back to Recap" flips it back. Local UI
  // state, not game state — nothing about the finished game itself changes
  // while toggling between the two views.
  const [showBoardAfterGameOver, setShowBoardAfterGameOver] = useState(false);

  // Every path that ends a game returns to the front door rather than
  // dropping the player straight into a form.
  const newGame = useCallback(() => {
    setPreGameScreen('landing');
    setShowBoardAfterGameOver(false);
    game.newGame();
  }, [game]);

  // Mounted once at the top so they keep watching the event log and bot
  // chat feed (and stay in sync with the volume/mute setting) no matter
  // which screen shows.
  useGameSounds(state?.log);
  useChatSounds(state?.chat);

  function renderPreGame() {
    if (preGameScreen === 'setup') {
      return <SetupScreen onStart={game.startGame} onBack={() => setPreGameScreen('landing')} />;
    }
    return <LandingScreen onStart={game.startGame} onCustomize={() => setPreGameScreen('setup')} />;
  }

  return (
    <div data-theme={profile.selectedTheme}>
      {!state ? (
        renderPreGame()
      ) : state.status === 'gameover' && !showBoardAfterGameOver ? (
        <GameOverScreen
          state={state}
          onPlayAgain={newGame}
          onRecordProfileResult={recordResult}
          onViewBoard={() => setShowBoardAfterGameOver(true)}
        />
      ) : state.status === 'gameover' ? (
        <GameBoard
          game={{ ...game, newGame }}
          readOnly
          onExitReadOnly={() => setShowBoardAfterGameOver(false)}
        />
      ) : (
        <GameBoard game={{ ...game, newGame }} />
      )}
    </div>
  );
}
