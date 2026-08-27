/**
 * The VentureFlow hero illustration — one inline SVG, gently animated.
 *
 * Drawn by hand rather than shipped as an image file for three reasons that
 * matter to this app specifically: the game bundles no raster art at all and
 * makes no network requests (it has to work on classroom wifi, offline,
 * after first load), an SVG stays crisp on a projector and on a phone from
 * the same few kilobytes, and every colour here is a theme token — so the
 * hero reskins itself along with the unlockable board themes instead of
 * sitting there as a fixed picture that no longer matches.
 *
 * What it shows is deliberately the game's actual loop rather than generic
 * "business" clip-art: the weather overhead driving the market, a rising
 * chart of net worth, three little storefronts (the businesses you start),
 * and coins accumulating — the same four ideas the board itself is built on.
 *
 * All motion is slow, looping, and dropped entirely under
 * `prefers-reduced-motion` (see game.css) — it's a backdrop, not a
 * distraction from the buttons in front of it.
 */
export default function HeroGraphic({ className = '' }) {
  return (
    <svg
      className={`vf-hero-art ${className}`.trim()}
      viewBox="0 0 640 320"
      role="img"
      aria-label="A rising chart over three small shops, under sun, clouds and rain — the VentureFlow money cycle."
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="vf-hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--vf-hero-sky-top)" />
          <stop offset="100%" stopColor="var(--vf-hero-sky-bottom)" />
        </linearGradient>
        <linearGradient id="vf-hero-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--vf-teal)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--vf-teal)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="vf-hero-clip">
          <rect x="0" y="0" width="640" height="320" rx="26" />
        </clipPath>
      </defs>

      <g clipPath="url(#vf-hero-clip)">
        <rect x="0" y="0" width="640" height="320" fill="url(#vf-hero-sky)" />

        {/* --- weather: the hidden cycle that drives every price --- */}
        <g className="vf-hero-sun">
          <circle cx="86" cy="70" r="26" fill="var(--vf-yellow)" />
          {[...Array(8)].map((_, i) => {
            const angle = (Math.PI * 2 * i) / 8;
            const x1 = 86 + Math.cos(angle) * 34;
            const y1 = 70 + Math.sin(angle) * 34;
            const x2 = 86 + Math.cos(angle) * 44;
            const y2 = 70 + Math.sin(angle) * 44;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--vf-yellow)"
                strokeWidth="6"
                strokeLinecap="round"
              />
            );
          })}
        </g>

        <g className="vf-hero-cloud vf-hero-cloud--a" fill="var(--vf-white)">
          <ellipse cx="250" cy="62" rx="42" ry="24" />
          <ellipse cx="290" cy="70" rx="34" ry="20" />
          <ellipse cx="216" cy="72" rx="30" ry="18" />
        </g>
        <g className="vf-hero-cloud vf-hero-cloud--b" fill="var(--vf-white)" opacity="0.9">
          <ellipse cx="486" cy="52" rx="36" ry="21" />
          <ellipse cx="520" cy="60" rx="28" ry="17" />
          <ellipse cx="458" cy="60" rx="25" ry="15" />
        </g>
        {/* A little rain under the second cloud — the market doesn't only
            ever go up, and the art shouldn't pretend it does. */}
        <g stroke="var(--vf-blue)" strokeWidth="5" strokeLinecap="round" opacity="0.8">
          {[470, 492, 514].map((x, i) => (
            <line key={x} className="vf-hero-rain" style={{ '--drop': i }} x1={x} y1="76" x2={x - 4} y2="94" />
          ))}
        </g>

        {/* --- the rising line: net worth over the months --- */}
        <path
          d="M30 224 L110 210 L190 216 L270 186 L350 196 L440 148 L512 158 L600 90 L600 300 L30 300 Z"
          fill="url(#vf-hero-fill)"
        />
        <path
          className="vf-hero-line"
          d="M30 224 L110 210 L190 216 L270 186 L350 196 L440 148 L512 158 L600 90"
          fill="none"
          stroke="var(--vf-teal)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {[
          [110, 210],
          [270, 186],
          [440, 148],
          [600, 90],
        ].map(([cx, cy], i) => (
          <circle
            key={cx}
            className="vf-hero-node"
            style={{ '--node': i }}
            cx={cx}
            cy={cy}
            r="8"
            fill="var(--vf-white)"
            stroke="var(--vf-teal-dark)"
            strokeWidth="4"
          />
        ))}
        {/* The arrowhead at the top of the climb. */}
        <path
          d="M582 86 L600 90 L596 108"
          fill="none"
          stroke="var(--vf-teal-dark)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* --- ground --- */}
        <rect x="0" y="286" width="640" height="34" fill="var(--vf-hero-ground)" />

        {/* --- three little businesses you started --- */}
        {[
          { x: 78, roof: 'var(--vf-orange)', sign: '🍋' },
          { x: 226, roof: 'var(--vf-red)', sign: '🧁' },
          { x: 374, roof: 'var(--vf-purple)', sign: '🛠️' },
        ].map((shop, i) => (
          <g key={shop.x} className="vf-hero-shop" style={{ '--shop': i }}>
            <rect
              x={shop.x}
              y="252"
              width="72"
              height="34"
              rx="8"
              fill="var(--vf-white)"
              stroke="var(--vf-ink)"
              strokeWidth="4"
            />
            <path
              d={`M${shop.x - 8} 252 L${shop.x + 36} 230 L${shop.x + 80} 252 Z`}
              fill={shop.roof}
              stroke="var(--vf-ink)"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <rect x={shop.x + 26} y="266" width="20" height="20" rx="3" fill="var(--vf-ink)" opacity="0.75" />
            <text x={shop.x + 36} y="249" textAnchor="middle" fontSize="15">
              {shop.sign}
            </text>
          </g>
        ))}

        {/* --- coins stacking up --- */}
        {[
          { cx: 520, cy: 274, d: 0 },
          { cx: 552, cy: 268, d: 1 },
          { cx: 584, cy: 262, d: 2 },
        ].map((coin) => (
          <g key={coin.cx} className="vf-hero-coin" style={{ '--coin': coin.d }}>
            <ellipse cx={coin.cx} cy={coin.cy} rx="17" ry="17" fill="var(--vf-yellow)" stroke="var(--vf-ink)" strokeWidth="4" />
            <text x={coin.cx} y={coin.cy + 6} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--vf-ink)">
              $
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
