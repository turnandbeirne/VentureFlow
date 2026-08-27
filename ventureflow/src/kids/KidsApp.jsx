import { useCallback, useState } from 'react';
import './styles/kids.css';
import { useKidsGame } from './hooks/useKidsGame';
import KidsLanding from './components/KidsLanding';
import KidsSetup from './components/KidsSetup';
import KidsBoard from './components/KidsBoard';
import KidsGameOverScreen from './components/KidsGameOverScreen';

// ============================================================================
// VentureFlow: Just for Kids — top-level app
// ----------------------------------------------------------------------------
// A sibling to src/App.jsx, not a variant of it: same overall shape
// (landing → setup → board → gameover, driven by a game hook around the
// same reducer), but its own file, because the brief this shipped under is
// explicit that the main game must not change in any way other than
// gaining one link to get here (see components/LandingScreen.jsx). Sharing
// App.jsx would have meant branching it internally on some "kids mode"
// flag — a real, ongoing risk of kids-only logic leaking into the main
// experience every time either one gets touched later. Two small,
// independent files with zero shared UI code (only the pure engine in
// game/ is shared) makes that impossible by construction.
//
// See main.jsx for how this gets mounted instead of App.jsx — a simple
// path check on `/kids`, no router dependency added.
// ============================================================================
export default function KidsApp() {
  const game = useKidsGame();
  const { state } = game;
  const [screen, setScreen] = useState('landing'); // 'landing' | 'setup'

  const goToSetup = useCallback(() => setScreen('setup'), []);
  const goToLanding = useCallback(() => setScreen('landing'), []);

  const startGame = useCallback(
    (mode, humanNames, difficultyId, botConfigs, options) => {
      game.startGame(mode, humanNames, difficultyId, botConfigs, options);
    },
    [game]
  );

  const newGame = useCallback(() => {
    setScreen('landing');
    game.newGame();
  }, [game]);

  return (
    <div className="kv-app">
      {!state ? (
        screen === 'setup' ? (
          <KidsSetup onStart={startGame} onBack={goToLanding} />
        ) : (
          // Note: if a kids save already exists, useKidsGame's initial reducer
          // state loads it immediately (same pattern as hooks/useGame.js), so
          // `state` is already non-null and this landing screen is skipped
          // entirely in favor of KidsBoard below — exactly like the main
          // game's App.jsx. Nothing extra is needed here to "resume."
          <KidsLanding onStart={goToSetup} />
        )
      ) : state.status === 'gameover' ? (
        <KidsGameOverScreen state={state} onPlayAgain={newGame} />
      ) : (
        <KidsBoard game={game} onExit={newGame} />
      )}
    </div>
  );
}
