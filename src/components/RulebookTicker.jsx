import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRulebook } from '../data/rulebook';

const SCROLL_PX_PER_TICK = 0.35;
const TICK_MS = 30;
const LOOP_PAUSE_MS = 1200;

/**
 * A small window on the rulebook that scrolls itself, on the landing screen.
 *
 * The point is discovery, not reference: a newcomer who hasn't clicked
 * anything yet still sees real rules drifting past — "a business costs $300
 * plus a skill token", "leave a business alone for six months and it starts
 * to slide" — so the game explains itself before they commit to a click. The
 * full, tabbed rulebook is one button away for anyone who wants it.
 *
 * Content is flattened out of the SAME `buildRulebook()` data the rulebook
 * modal renders (data/rulebook.js), so every number here is still read live
 * from gameConfig.js and can't drift from the actual rules.
 *
 * Auto-scroll pauses whenever a pointer is over the panel or focus is inside
 * it, so it never fights someone who has started reading or scrolling it
 * themselves — and it stops completely for anyone who prefers reduced motion.
 */
export default function RulebookTicker({ onOpenFull }) {
  const scrollerRef = useRef(null);
  const [paused, setPaused] = useState(false);

  const lines = useMemo(() => {
    const out = [];
    for (const section of buildRulebook()) {
      out.push({ kind: 'heading', text: `${section.icon} ${section.title}` });
      for (const block of section.blocks) {
        if (block.type === 'p') out.push({ kind: 'line', text: block.text });
        else if (block.type === 'list') for (const item of block.items) out.push({ kind: 'line', text: item });
        else if (block.type === 'rows')
          for (const row of block.rows) out.push({ kind: 'row', label: row.label, text: row.detail });
      }
    }
    return out;
  }, []);

  useEffect(() => {
    if (paused) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let holdUntil = 0;
    const id = setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      if (Date.now() < holdUntil) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) return;
      if (el.scrollTop >= maxScroll - 1) {
        // Reached the end: hold a beat so the last line is readable, then
        // start over from the top rather than snapping mid-sentence.
        holdUntil = Date.now() + LOOP_PAUSE_MS;
        el.scrollTop = 0;
        return;
      }
      el.scrollTop += SCROLL_PX_PER_TICK;
    }, TICK_MS);

    return () => clearInterval(id);
  }, [paused]);

  return (
    <div className="vf-card vf-ticker">
      <div className="vf-ticker__header">
        <span className="vf-ticker__title">📖 How it works</span>
        <button type="button" className="vf-btn vf-btn--sm vf-btn--ghost" onClick={onOpenFull}>
          Full rulebook
        </button>
      </div>
      <div
        ref={scrollerRef}
        className="vf-ticker__scroller vf-scroll"
        tabIndex={0}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onPointerDown={() => setPaused(true)}
      >
        {lines.map((line, i) =>
          line.kind === 'heading' ? (
            <div key={i} className="vf-ticker__heading">
              {line.text}
            </div>
          ) : line.kind === 'row' ? (
            <div key={i} className="vf-ticker__row">
              <span className="vf-ticker__row-label">{line.label}</span>
              <span>{line.text}</span>
            </div>
          ) : (
            <p key={i} className="vf-ticker__line">
              {line.text}
            </p>
          )
        )}
      </div>
    </div>
  );
}
