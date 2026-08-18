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
    useGameSounds.js       # watches the event log, plays a sound per new entry
    useAudioSettings.js      # volume/mute state, synced across components
  audio/
    soundLibrary.js       # tunable synthesized sound "recipes", one per effect
    soundEngine.js           # Web Audio playback + volume/mute + persistence
    musicEngine.js             # background-music playback + its own volume/mute
  assets/
    audio/                # bundled mp3 tracks (theme + in-game instrumental)
  game/
    leaderboard.js          # localStorage-backed high-score list (own hook below)
    nameFilter.js              # offensive-name blocklist, used at setup + leaderboard save
  hooks/
    useLeaderboard.js          # React glue for game/leaderboard.js
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

## Sound

Every action and reward has a sound — buying, selling, starting a business,
learning a skill, ending your turn, payday, fortune cards (a bright chime for
Opportunity, a gentle "womp" for Setback), badges, weather shifts, and the
game-over fanfare. All of it is synthesized on the fly with the Web Audio
API (`audio/soundLibrary.js` + `audio/soundEngine.js`) — no audio files to
load, license, or go stale, and it works offline once the page has loaded
(useful for classroom wifi).

Buying and selling each of the four assets has its own distinct personality
instead of one generic "buy"/"sell" sound: Piggy Bank gets a soft, cute
double "boop"; Lemonade Co. gets a bright, bouncy triangle "sproing"; Tree
House gets a warm, woody chime triad; Treasure Chest gets a shimmery
sawtooth sparkle with a bigger flourish, matching its higher risk/reward
personality. A generic `buy`/`sell` sound is kept as a fallback so a new
asset added later to `gameConfig.js` never goes silent before it gets its
own recipe.

The game engine itself stays audio-agnostic: log entries just carry a `kind`
(e.g. `'buy_piggy'`, `'sell_treasure'`, `'badge'`, `'weather'`), and
`hooks/useGameSounds.js` is the only thing that turns that into noise,
watching the shared event log from `App.jsx` so it works the same whether a
human or an AI robot triggered the event. Add a new sound by adding an entry
to `SOUNDS` in `audio/soundLibrary.js` and tagging the relevant log entry
with a matching `kind` — no other wiring needed. If a `kind` has no exact
match in `SOUNDS`, `useGameSounds.js` falls back from `buy_*`/`sell_*`
prefixes to the generic `buy`/`sell` sound rather than staying silent.

Volume is adjustable (and mutable) from a control in the corner of every
screen; the setting persists in `localStorage` separately from game saves,
so it carries over between games.

### Fireworks, cheering, and thunderous applause

Two sound "primitives" live in `audio/soundEngine.js`: pitched tone notes
(the original oscillator recipes) and filtered-white-noise bursts (new —
used for anything a pure tone can't convincingly make, like crackle, claps,
or crowd texture). A tone note can also now sweep from one pitch to another
(`freqEnd`), which is what makes a firework "whistle" or a crowd "whoop"
sound like a sweep instead of a flat beep. `audio/soundLibrary.js` composes
these into three generative effects — `fireworks`, `cheering`, `applause` —
each a *function* that builds a freshly randomized note list on every call
(number of firework shells, clap timing, whoop pitches, all randomized), so
the big celebratory moments don't sound identical every time. The game-over
sound (`SOUNDS.gameover`) layers fireworks + cheering on top of the original
victory fanfare automatically — nothing else had to change to wire that up,
since it's still just one sound triggered by the existing `'gameover'` log
entry. A matching visual, `components/Fireworks.jsx`, draws a burst of
colored CSS particles over the game-over screen (respects
`prefers-reduced-motion`).

`applause` is played separately, straight from `GameOverScreen.jsx`, when a
saved score lands at or above `LEADERBOARD_TOP_HIGHLIGHT` (`gameConfig.js`,
currently top 20) — see the Leaderboard section below.

## Music

Background music is a separate system from the synthesized sound effects
above — `audio/musicEngine.js` plays real recorded tracks (bundled mp3s,
imported from `src/assets/audio/` so they're versioned with the rest of the
project and work offline once loaded) through a single reused `<audio>`
element, with its own independent volume/mute so a player can mix music
down (or off entirely) without touching sound-effect volume, and vice versa.

Two tracks, each with a different intended loudness baked in as a per-track
gain multiplier that the volume slider scales on top of, so the balance
between them stays sensible at any setting:

- **Theme** (`venture-forth-theme.mp3`) — plays at normal (full) relative
  volume on the setup screen, and again on the game-over screen for the big
  finish.
- **Background** (`relic-run-instrumental.mp3`) — plays softly (a lower
  built-in gain) for as long as the game board is up, through every month
  and every turn.

`components/MusicControl.jsx` (visually matching the existing
`VolumeControl.jsx` — same pill/slider styling, just a music-note icon) is
rendered on every screen and drives `hooks/useMusicSettings.js`, which mirrors
`useAudioSettings.js`'s pattern for the SFX volume. Settings persist to their
own `localStorage` key (`ventureflow-music-v1`), separate from both the SFX
settings and any game save.

Each screen just calls `playMusicTrack('theme' | 'background')` once on
mount (`SetupScreen.jsx`, `GameBoard.jsx`, `GameOverScreen.jsx`) — the engine
handles the rest: switching tracks fades the old one out and the new one in
rather than cutting abruptly, and calling it with the track that's already
playing is a safe no-op (so "Play Again," which goes GameOver → Setup and
both screens use "theme," doesn't restart the song from the top). Browsers
block audio from autoplaying before any user interaction; if the initial
`play()` is blocked, the engine quietly retries on the page's next
click/tap/keypress rather than erroring, so the very first thing a player
does (picking a game mode, moving a slider) is what actually starts the
music.

## Player portfolio details

Tapping any player's card (your own or an AI robot's) opens a read-only
portfolio breakdown (`components/PlayerDetailModal.jsx`): net worth, cash,
total assets worth, and passive income at a glance, then a line per asset
showing quantity currently owned, the player's lifetime average purchase
price for that asset, its current price, current value, and a gain/loss
percentage versus that average — plus rent earned per month where relevant
(Tree House). Below that is a list of every business the player has started,
each with its own individual monthly cash flow, and a total.

Average purchase price is tracked per player per asset in
`game/players.js`'s `purchaseStats` (`{ qty, spent }`, accumulated on every
buy in `game/actions.js`) and read via the `avgPurchasePrice()` selector —
it's a lifetime "what have you typically paid" figure, not a remaining cost
basis adjusted for sales. This is read-only and safe to open at any time,
including mid-turn or during an AI robot's turn.

## Difficulty presets

At setup, players pick a challenge level — KidStuff (easy), Middle of the
Pack (medium, the original balance), or Hard Knocks (hard) — each a preset
of starting cash, monthly allowance, and starting skill tokens defined in
`gameConfig.js`'s `DIFFICULTIES` array. Every player at the table (human or
robot) starts from the same preset, so the challenge is consistent across
the whole game. The choice flows from `SetupScreen.jsx` through
`useGame.startGame()` → the reducer → `game/newGame.js`, which resolves the
preset via `getDifficulty()` and stores `monthlyAllowance` directly on game
state for `game/turnEngine.js` to read at payday (falling back to the
original `MONTHLY_ALLOWANCE` constant for a game saved before this feature
existed). A small pill in the corner of the game board shows which
difficulty is active, since a 24-month game is long enough to forget. Add a
new preset by adding an entry to `DIFFICULTIES` — it automatically appears
as a card on the setup screen.

## Hold-to-repeat buying and selling

The Buy/Sell buttons in the asset shop support press-and-hold: a normal
tap/click buys or sells one unit, same as always, but holding past a second
starts auto-repeating — and the repeat accelerates the longer it's held — so
scooping up (or unwinding) a big stack of one asset isn't a wall of
individual taps. This lives in `hooks/useHoldRepeat.js`, a small
framework-agnostic-flavored hook (Pointer Events, so it works the same for
mouse, touch, and pen) that also still answers to a plain click so keyboard
activation (Enter/Space on a focused button) keeps working exactly as
before. It re-checks whether the action can still fire before every single
repeat (via a `canFire()` callback wired to the same "can afford this /
still own any of this" logic that already disables the buttons), so a hold
stops cleanly the instant cash or holdings run out instead of hammering a
no-op.

## Branding

Every screen (setup, board, game over) renders the `Brand` component
(`components/Brand.jsx`), which reads `GAME_NAME`/`PARENT_BRAND`/
`BRAND_TAGLINE` from `gameConfig.js` — currently "VentureFlow" / "A
VentureMaker™ game". Change the wording in one place and it updates
everywhere.

## Leaderboard

A persistent high-score list, separate from any single game's save
(`game/leaderboard.js`, its own `localStorage` key so "New Game" doesn't
touch it). It's opt-in: nothing is recorded automatically when a game ends —
on the game-over screen the winner can choose a display name (pre-filled
with their in-game name, editable) and optionally attach an email, then
"Save My Score." The email is stored on the entry for VentureMaker's own
use (e.g. a future "you made the leaderboard!" follow-up) but no rendering
code ever reads it back out — `LeaderboardModal.jsx` only ever displays
name/avatar/net worth/mode/date/portfolio. Open the leaderboard from the
trophy button on any screen.

Saving a score also attaches a frozen "hard copy" snapshot of the winner's
portfolio at that exact moment — how much of each asset they owned and their
lifetime average purchase price for it, plus every business and its
individual cash flow (`game/players.js`'s `snapshotPortfolio()`, stored as
`entry.portfolio`). It never changes again after saving, even if that player
goes on to play (and sell everything in) another game. Tap any row in the
leaderboard to expand it and see the breakdown; older entries saved before
this feature existed simply show "no snapshot was saved for this run"
instead. `addLeaderboardEntry()` also returns the new entry's 1-based rank
in the sorted list — a save landing at or above `LEADERBOARD_TOP_HIGHLIGHT`
(`gameConfig.js`, currently top 20) gets a thunderous-applause sound effect
and a "Top 20!" callout on the game-over screen instead of the regular save
chime.

Every name — at setup and again at leaderboard save — is checked by
`game/nameFilter.js`, a small client-side blocklist (with basic leetspeak
normalization, e.g. `b1tch` → `bitch`) tuned to avoid the classic
profanity-filter false positive of blocking innocent names that merely
*contain* a short blocked word. It's a reasonable first line of defense for
a local/offline game; if the leaderboard ever becomes shared/online, names
should be re-checked server-side too, since a client-side filter is
inherently bypassable.
