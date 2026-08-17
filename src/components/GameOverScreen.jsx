import '../styles/game.css';
import { netWorth } from '../game/players';
import { playSound } from '../audio/soundEngine';
import VolumeControl from './VolumeControl';

export default function GameOverScreen({ state, onPlayAgain }) {
  const { players, assetPrices, winnerId } = state;
  const ranked = [...players].sort((a, b) => netWorth(b, assetPrices) - netWorth(a, assetPrices));
  const winner = players.find((p) => p.id === winnerId) || ranked[0];

  function handlePlayAgain() {
    playSound('click');
    onPlayAgain();
  }

  return (
    <div className="vf-gameover">
      <div className="vf-topbar-corner">
        <VolumeControl />
      </div>
      <div className="vf-card vf-gameover__inner">
        <div className="vf-gameover__trophy">🏆</div>
        <h1>Game Over!</h1>
        <div className="vf-gameover__winner">
          {winner.avatar} {winner.name} {winner.name.toLowerCase() === 'you' ? 'win' : 'wins'} with $
          {netWorth(winner, assetPrices).toLocaleString()}!
        </div>

        <div className="vf-standings">
          {ranked.map((player, i) => (
            <div key={player.id} className={`vf-standing-row ${player.id === winnerId ? 'vf-standing-row--winner' : ''}`}>
              <span className="vf-standing-row__rank">{i + 1}</span>
              <span>
                {player.avatar} {player.name}
              </span>
              <span>${netWorth(player, assetPrices).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <button type="button" className="vf-btn vf-btn--go vf-btn--lg" onClick={handlePlayAgain}>
          Play Again 🔁
        </button>
      </div>
    </div>
  );
}
