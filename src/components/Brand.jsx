import { BRAND_TAGLINE } from '../data/gameConfig';

/** VentureFlow wordmark + "A VentureMaker™ game" tagline — used on every screen. */
export default function Brand({ size = 'md', align = 'center' }) {
  return (
    <div className={`vf-brand vf-brand--${size} vf-brand--${align}`}>
      <div className="vf-brand__logo">
        Venture<span>Flow</span>
      </div>
      <div className="vf-brand__tag">{BRAND_TAGLINE}</div>
    </div>
  );
}
