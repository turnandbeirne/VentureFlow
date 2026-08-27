import { useEffect } from 'react';
import { businessArt } from '../../game/businessArt';
import { playKidsSound } from '../audio/kidsSoundEngine';

/** Celebrates a human player starting a business — reuses the exact same
 * `state.pendingLaunch` the main game's StartupLaunchModal reads (set by
 * reducer.js's START_BUSINESS case, cleared by ACK_STARTUP_LAUNCH), so the
 * business name/income shown are always the real ones. */
export default function KidsStartupLaunchModal({ launch, onContinue }) {
  const art = businessArt(launch.businessName);

  useEffect(() => {
    playKidsSound('bigWin');
  }, []);

  return (
    <div className="kv-modal-backdrop">
      <div className="kv-modal">
        <div className="kv-modal__icon" style={{ fontSize: '4em' }} aria-hidden="true">{art.hero}</div>
        <h2 className="kv-title" style={{ fontSize: '1.5em' }}>
          {launch.playerName} started {launch.businessName}!
        </h2>
        <p className="kv-subtitle">It's already making ${launch.income}/month — every month, just for owning it!</p>
        <button
          type="button"
          className="kv-btn kv-btn--huge kv-btn--accent"
          onClick={() => {
            playKidsSound('tap');
            onContinue();
          }}
        >
          🎉 Woohoo!
        </button>
      </div>
    </div>
  );
}
