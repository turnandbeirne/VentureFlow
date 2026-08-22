import { GAME_LENGTH_MONTHS } from '../../data/gameConfig';
import { playKidsSound } from '../audio/kidsSoundEngine';

const PITCH = [
  { icon: '🛍️', title: 'Buy fun stuff!', body: 'Piggy banks, lemonade stands, tree houses, and treasure — pick what you like!' },
  { icon: '🚀', title: 'Start a business!', body: 'Learn a skill, open your own shop, and watch it grow every month.' },
  { icon: '😂', title: 'Laugh with friends!', body: 'Your game friends tell knock-knock jokes and silly riddles as you play.' },
];

/**
 * The front door of the Kids Version — see src/kids/KidsApp.jsx for how
 * this fits into the tiny landing → setup → board → gameover flow (its own
 * copy of that flow, deliberately not sharing App.jsx's version — see
 * KidsApp.jsx's header comment for why).
 */
export default function KidsLanding({ onStart }) {
  return (
    <div className="kv-landing">
      <div className="kv-landing__mascot" aria-hidden="true">🦊</div>
      <h1 className="kv-landing__brand">VentureFlow: Just for Kids!</h1>
      <p className="kv-landing__tag">
        A {GAME_LENGTH_MONTHS}-month money adventure — buy things, start a business, and have some laughs
        with your game friends along the way!
      </p>

      <div className="kv-landing__cta">
        <button
          type="button"
          className="kv-btn kv-btn--huge"
          onClick={() => {
            playKidsSound('tap');
            onStart();
          }}
        >
          ⭐ Let's Play!
        </button>
      </div>

      <div className="kv-landing__grid">
        {PITCH.map((item) => (
          <div key={item.title} className="kv-card">
            <div style={{ fontSize: '2.2em' }} aria-hidden="true">{item.icon}</div>
            <div style={{ fontWeight: 700, margin: '6px 0 4px' }}>{item.title}</div>
            <div style={{ color: 'var(--kv-ink-soft)', fontSize: '0.9em' }}>{item.body}</div>
          </div>
        ))}
      </div>

      <a className="kv-landing__back" href="/">
        ⬅️ Back to the grown-up version
      </a>
    </div>
  );
}
