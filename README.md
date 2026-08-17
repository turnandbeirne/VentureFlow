# VentureFlow

A kid-friendly financial-literacy board game. Grow your money over 24 in-game
months — buy assets, start businesses, learn skills, and ride a hidden
weather cycle that drives the market. Play solo against AI robots, or
pass-and-play hot-seat with up to 3 humans.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build
npm run lint     # oxlint
```

## Project structure

```
src/
  data/
    gameConfig.js     # EVERY tunable number, asset, deck card, badge, and
                       # weather-timing value lives here. Balance the whole
                       # game by editing this one file.
  game/                # Pure game logic — no React, fully testable.
    rng.js             # random helpers (swap for a seeded PRNG later)
    weather.js          # hidden-timer weather/market cycle state machine
    market.js            # asset price drift + one-off price bumps
    players.js            # player factory + net worth / passive income selectors
    decks.js                # fortune card draw + generic effect application
    badges.js                 # extensible badge/achievement checker registry
    actions.js                  # buy/sell/business/skill — the ONLY place money moves
    aiEngine.js                   # robot strategy (reuses actions.js)
    turnEngine.js                   # turn advance + full month-end resolution
    newGame.js                        # initial-state factory
    persistence.js                      # localStorage save/resume
    reducer.js                            # top-level (state, action) -> state
  hooks/
    useGame.js           # React glue: useReducer + persistence + AI auto-play
  components/            # UI only — reads state, calls the hook's action fns
  styles/                # theme.css (design tokens) + setup.css / game.css
```

The rule of thumb: **if it's a number, it goes in `gameConfig.js`. If it's a
rule, it goes in `game/`. If it's pixels, it goes in `components/` +
`styles/`.**

## Extending the game

- **New asset**: add an entry to `ASSETS` in `gameConfig.js`. Shop, pricing,
  and badges all pick it up automatically.
- **New fortune card**: add an entry to `OPPORTUNITY_DECK` or `SETBACK_DECK`.
  Effect types understood by the engine: `cash`, `cashPercent`,
  `assetPrice`, `skillToken`, `passiveBonus` (see `game/decks.js`).
- **New badge**: add an entry to `BADGES` with an existing `kind`
  (`passiveIncomeAtLeast`, `businessCountAtLeast`, `assetHoldingAtLeast`) and
  it just works. A genuinely new condition needs one checker function added
  to `CHECKERS` in `game/badges.js`.
- **New weather stage / deck** (Wildcard, Venture, Hardship, etc.): follow
  the same data-driven pattern — add to `WEATHER_STAGES`/`WEATHER_ORDER` or a
  new deck array, then teach the relevant engine file about the new id.

## Where future features hook in

- **Online multiplayer**: the reducer (`game/reducer.js`) is a pure
  `(state, action) => state` function with no direct DOM/React coupling —
  it's the natural seam for swapping local `dispatch` for a networked one
  (e.g. broadcast actions through a server/room and replay them through the
  same reducer on every client).
- **VentureScouts badge sync**: every player tracks `badgeEvents`
  (`{ badgeId, month }`), and `game/badges.js` exports
  `exportBadgeEvents(player)` to flatten that into a plain, serializable
  event list — ready to POST to an external service once that integration
  exists.
- **Venture scaling / bigger economy**: `BUSINESS_COST`,
  `BUSINESS_INCOME_MIN/MAX`, and friends are single constants in
  `gameConfig.js`; a scaling business tier can reuse `actions.js`'s
  `startBusiness` pattern with its own cost/income config.

## Save/resume

The whole game state is serialized to `localStorage` after every action
(`game/persistence.js`). Reloading the page resumes straight into the board;
"New Game" clears the save and returns to setup.
