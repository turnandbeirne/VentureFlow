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

### Why music volume/mute is routed through a GainNode, not `audio.volume`

iOS Safari (and every other browser on iPhone/iPad, since Apple requires
them all to run on WebKit under the hood) silently ignores
`HTMLMediaElement.volume` — the setter is a documented no-op there, and
actual playback volume is locked to the hardware buttons instead. An
earlier version of `musicEngine.js` controlled music volume by setting
`audio.volume` directly, which meant the volume slider and mute button
worked everywhere except iPhone, where they visibly moved but did nothing
audible. The fix: `ensureAudio()` now routes the `<audio>` element's output
through a Web Audio `GainNode` (`audioContext.createMediaElementSource(el)`
→ `GainNode` → `destination`), the same mechanism the synthesized sound
effects in `soundEngine.js` already use — iOS *does* honor Web Audio gain
automation. `setMusicVolume`/`setMusicMuted`/the fade helper all move
`gainNode.gain.value` now instead of `audio.volume`; a browser with no Web
Audio support at all (essentially none in practice) falls back to the old
`audio.volume` behavior rather than going silent. `playMusicTrack()` and the
existing "retry on next user gesture" autoplay-unlock logic also now resume
the `AudioContext` itself (`audioContext.resume()`), since iOS gates that
the same way it gates `audio.play()`.

## Player portfolio details

Tapping any player's card (your own or an AI robot's) opens a read-only
portfolio breakdown (`components/PlayerDetailModal.jsx`): net worth, cash,
total assets worth, and passive income at a glance, then a line per asset
showing quantity currently owned, the player's lifetime average purchase
price for that asset, its current price, current value, and a gain/loss
percentage versus that average — plus rent earned per month where relevant
(Tree House). Below that is a list of every business the player has started,
each with its own individual monthly cash flow, and a total.

Each new business gets a whimsical name instead of a generic "Business #1" —
`gameConfig.js`'s `BUSINESS_NAMES` is a pool of 500 kid-funny options (things
like "Auntie Betty's Bakery" or "Buttons' Bangs and Clangs Comic Shop") that
`game/actions.js`'s `startBusiness()` picks from at random, preferring a name
the player hasn't already used that game so a player running several
businesses doesn't see repeats. The name is stored on the business itself
(`business.name`) and shown everywhere a business appears — the event log,
this portfolio modal, and a saved leaderboard snapshot — with every
`Business #N`-style fallback still in place for businesses started before
this feature existed (they simply have no `.name` and fall back to their
index). Add more options by appending to `BUSINESS_NAMES`; every entry is
also run through `nameFilter.js`'s `isOffensiveName()` at build/generation
time as a sanity check, though the pool is hand-curated to be kid-appropriate
so nothing should ever actually trip it at runtime.

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

## Robot personalities and skill levels

Each robot opponent in Solo mode is one of seven named personalities —
Leeroy Jenkins, BossEmby, MrB, MrGrinch, DaddyBigBux, MoneyMama, and
GrumpyMommy — defined in `gameConfig.js`'s `BOT_PERSONALITIES` array, each
with its own avatar, a one-line `blurb`, and a `strategyId` that picks a
scoring profile in `game/aiEngine.js`'s `STRATEGIES` table. That profile is
just a set of score multipliers (plus a couple of behavior flags) layered on
top of the same base greedy AI every robot always used — so Leeroy
(`reckless`) ignores stormy weather and charges into risky assets and
businesses, MrGrinch (`hoarder`) piles almost everything into the Piggy
Bank and rarely starts a business, DaddyBigBux (`tycoon`) chases businesses
and skill tokens above all else, GrumpyMommy (`contrarian`) deliberately
plays the weather backwards (buying when everyone else is retreating and
vice versa), and so on for BossEmby (`flipper`), MoneyMama (`saver`), and
MrB (`balanced`, the original unweighted behavior).

Separately, each robot also gets a skill level — Rookie 🐣, Sharp 🧠, or
Shark 🦈 (`gameConfig.js`'s `SKILL_LEVELS`) — that's independent of
personality and controls how *well* it plays rather than *what* it prefers:
a `SKILL_PROFILES` entry in `aiEngine.js` sets how much cash it always
leaves idle (`cashBuffer`), how many moves it's willing to make in one turn
(`maxSteps`), and how often it plays a random affordable move instead of its
best-scoring one (`mistakeChance`) — Rookie fumbles fairly often, Shark
almost never does.

At setup, for each robot the player either picks a specific personality and
skill level from a pair of dropdowns, or leaves either (or both) on "🎲
Random." Selections flow from `SetupScreen.jsx`'s `botConfigs` state through
`useGame.startGame()` → the reducer → `game/newGame.js` →
`game/players.js`'s `createPlayerRoster()`, which resolves each `random`
into an actual personality/skill (avoiding handing two robots at the same
table the same personality when rolling randomly) and copies the resolved
`personalityId`, `strategyId`, and `skillLevelId` directly onto the player
object — not looked up live against the config tables — so a future edit to
a personality's strategy here never rewrites how an already-in-progress or
saved game plays. A robot's chosen personality also becomes its display name
and avatar everywhere (player cards, event log, leaderboard), and tapping
its card shows its blurb and skill level in the portfolio modal. Games saved
before this feature existed have robots with none of these three fields;
`aiEngine.js` and the UI both fall back gracefully (`balanced` strategy,
`sharp` skill, a plain "AI player" tooltip, no blurb) rather than breaking.

While building this out, `game/aiEngine.js`'s `isGoodWeather()` turned out to
be reading a `mood` field that `gameConfig.js`'s `WEATHER_STAGES` never
actually set — every robot was treating every month as bad weather (retreat
mode), regardless of what the sky actually looked like. Fixed by adding
`mood: 'boom' | 'peak' | 'dip' | 'bust' | 'rebound'` to each stage, matching
the `GOOD_MOODS` set `aiEngine.js` already checked against. Worth knowing if
robot behavior in an older build looked oddly cautious across the board.

## Robot chat

Robots comment on the game as it happens, in their own voice —
`gameConfig.js`'s `BOT_CHAT_LINES` holds a bank of lines per personality per
category (greeting, question, tease, challenge, compliment, applause, gloat,
sympathy, weatherGood/weatherBad, and botBanter — a bot addressing another
bot by name), and `game/chatEngine.js` picks when and who gets to speak.

The trigger point is a single choke point: every log entry that already
flows into the event log (a business started, a badge earned, a fortune
card, the weather shifting, a turn starting, the game ending — see
`actions.js` / `turnEngine.js` / `aiEngine.js`'s `kind`-tagged log entries)
is offered to `chatEngine.js`'s `reactToLogEntries()` inside `reducer.js`'s
`appendLog()`, which decides — per event kind, with its own trigger chance —
whether a robot reacts, and if so, picks one, picks a line from its
personality's bank for the right category, and fills in `{player}`/`{bot}`.
High-volume events (a single buy or sell) trigger rarely (~5%) so the feed
doesn't turn into noise; rare, exciting ones (a badge, the game ending)
trigger often (75-70%). A turn starting has its own small ambient chance
(`kind: 'endTurn'`) to have a robot greet/tease/question/challenge the
player whose turn it now is — or, if it's another robot's turn, a quick
`botBanter` aside — which is also how "bot to bot" chat happens; on top of
that, any reaction has a further chance of a second robot chiming in right
after with a `botBanter` follow-up aimed at whoever just spoke, so a business
start or a big win can turn into a short back-and-forth between two robots.
Solo mode caps at 2 robots, so bot-to-bot chat is always exactly those two.
Game start gets its own one-time `generateGreeting()` call (every robot
introduces itself) since the very first log entry hasn't happened yet.

Only robots with a `personalityId` ever speak — a game (or a specific robot
within it) saved before this feature existed has none, and just stays quiet
rather than crashing or talking with a generic voice. Chat lives in
`state.chat` (parallel to `state.log`, capped at the most recent 60), shown
in `components/ChatPanel.jsx` on the game board. `GameOverScreen.jsx` also
pulls the tail of `state.chat` filtered to `gloat`/`applause` lines to show
the robots' closing thoughts under the final standings.

### Goof-off sound effects and hype quotes

On top of reacting to events, each robot also gets an independent, separate
roll once per turn it takes (`game/reducer.js`'s `RUN_AI_TURN` case calls
`chatEngine.js`'s `generateBotTurnFlavor()`) for two unrelated bits of
flavor: a goof-off sound effect (~22% chance) and an unprompted money/
winning catchphrase (~16% chance) — either, both, or neither can land on any
given turn. The sound effects — a fart, a burp, a hype "OH YEAAAAH!", a
groan, a mock-indignant "take that back!", a big cartoon laugh, a screech,
and a mock-dramatic hero one-liner — are original synthesized Web Audio
recipes in `audio/soundLibrary.js` (`botFart`/`botBurp`/`botOhYeah`/etc., no
sampled or licensed audio, same approach as every other sound in the game),
picked from that personality's own `sfxPool` on its `gameConfig.js`
`BOT_PERSONALITIES` entry (Leeroy Jenkins reaches for the hype shout and
hero sting, MrGrinch for groans and burps, GrumpyMommy even keeps a fart in
her back pocket) — a chat entry tagged `category: 'sfx'` carries the actual
`sound` name and a short caption (e.g. `*BURRRP*`) so the feed still shows
*something* even though the point is the noise. The catchphrases are a new
`hype` category in `BOT_CHAT_LINES`, each personality's own take on money/
winning slang ("earnin' and burnin', baby," "bet!," "sus...," "that's cap!,"
"six... seven" all make an appearance, voiced differently per bot — MrB
finds the slang bewildering, GrumpyMommy is suspicious of it on principle).

Sound playback for the chat feed is its own reactive layer,
`hooks/useChatSounds.js` (mirrors `useGameSounds.js`'s approach for the
event log): it watches `state.chat` and plays `entry.sound` for an `sfx`
entry, or the light generic `chat` pop for every other new line, mounted
once in `App.jsx` so it works no matter which screen is showing.

### Color-coded chat

Every `BOT_PERSONALITIES` entry also has a `color`, and every chat entry
`chatEngine.js` creates carries that color along with it (`say()`'s single
choke point, so nothing has to remember to set it). `components/
ChatPanel.jsx` exports a shared `ChatEntryRow` (reused by `GameOverScreen`'s
closing-chat section too) that tints each bubble's left border and speaker
name with `entry.color`, falling back to a neutral gray for an entry saved
before this field existed — so each bot reads as visually distinct at a
glance, on top of its avatar icon. An `sfx`-category entry additionally gets
a dashed border and italic caption so it reads as "a noise," not a sentence.

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
name/avatar/net worth/mode/difficulty/date/portfolio. Open the leaderboard
from the trophy button on any screen.

Each row also shows which difficulty preset (see "Difficulty presets" above)
that run was played on — `entry.difficultyId` is saved alongside the score
and rendered next to the mode as an icon + label (e.g. "🥊 Hard Knocks") via
`LeaderboardModal.jsx`'s `difficultyLabel()`. Entries saved before this
feature existed have no `difficultyId`, and deliberately show "—" rather than
guessing a default, since that would misrepresent what was actually played.

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

## Sidebar layout: weather, log, and chat always in view

`components/GameBoard.jsx` renders inside a `.vf-board-layout` CSS grid
(`styles/game.css`) with two columns: the main board (header, month
progress, player panel, shop, action bar) on the left, and a sticky sidebar
on the right holding three separate panels — `components/WeatherCard.jsx`
(a fuller version of the header's quick-glance `WeatherBadge`, showing the
current stage's name and blurb, which previously only appeared as a
tooltip), `ChatPanel.jsx`, and `EventLog.jsx`. `position: sticky` on the
sidebar keeps all three in view while the board's own content scrolls past
underneath, on screens wide enough for two columns (1020px and up). Below
that breakpoint, `.vf-board-layout` collapses to a single column and the
sidebar falls back to stacking normally below the board — the original
layout, unchanged — so the game still works on a phone or a narrow window.
The log and chat panels also each got taller (`max-height` bumped from
190px to 340px) since the sidebar has the vertical room to show more at
once. This was a deliberate choice to keep weather/log/chat as three
distinct panels rather than tabs, so nothing is ever hidden behind a click.

## More goof-off sounds

The goof-off SFX pool (see "Goof-off sound effects and hype quotes" above)
grew from 8 to 14 original synthesized sounds — added a hiccup
(`botHiccup`), a chicken-ish squawk (`botSquawk`, fitting for Leeroy
Jenkins' avatar), a hype airhorn blast (`botAirhorn`), a cute "mwah!" kiss
(`botKiss`), a confident low mic-drop thud (`botMicDrop`), and a
building-sneeze-then-"AH-CHOO!" (`botSneeze`) — all in `audio/
soundLibrary.js`, same approach as every other sound in the game (Web Audio
oscillators/noise bursts, no sampled or licensed audio). Each personality's
`sfxPool` in `gameConfig.js`'s `BOT_PERSONALITIES` was also rebalanced to
pull from a wider, more distinct mix — e.g. Leeroy can now squawk and blast
an airhorn, MoneyMama got the kiss sound, GrumpyMommy picked up a sneeze —
so two robots' goof-off moments overlap less than before.

## Player chat input

Alongside robot chat, a human player can now type their own message
straight into the chat feed — `components/ChatPanel.jsx`'s `ChatComposer`
renders a small form under the chat list: an optional "from" selector
(shown only in hot-seat mode, when more than one human is playing — solo
mode skips it since there's only one human to be), a text input (140-char
cap, matching the same cap the reducer enforces), and a "to" selector
defaulting to "Everyone" but able to target any other player at the table,
human or robot. Sending dispatches a new `SEND_CHAT` action
(`hooks/useGame.js`'s `sendChat(playerId, message, targetPlayerId)` →
`game/reducer.js`), which re-validates (never trusting the UI alone) and
appends the message via `game/chatEngine.js`'s new `createHumanChatEntry()`
— tagged `category: 'human'` and given its own color (`#1c7ed6`, a blue
that's visually distinct from every bot's color) so it's immediately
obvious which lines are player-typed versus robot-generated.
`ChatEntryRow` shows the target as a small "→ 🐔 Leeroy Jenkins"-style chip
when one was picked. A typed message is checked against the same
`game/nameFilter.js`'s `isOffensiveName()` already used for player names,
both client-side (so a blocked message shows an inline error immediately
and never appears in the feed) and again in the reducer as defense in depth.

If the message was aimed at a robot (or, if aimed at "Everyone," a random
one), that robot has a capped 45% chance to "reply" via `chatEngine.js`'s
new `reactToHumanChat()` — worth being clear about what this actually is:
there's no language model reading and understanding the typed text, so a
reply is just one of that robot's existing canned `question`/`tease`/
`compliment`/`challenge` lines (the same banks used for reacting to game
events), picked at random and addressed back to the sender. It reads as a
lighthearted in-character response to *being talked to*, not as an actual
answer to whatever was said.

## Scenario goals and setup info popups

Setup now asks "Your goal this game" alongside mode/difficulty — a grid of
scenario cards defined in `gameConfig.js`'s new `SCENARIOS` array (Classic
Growth, Survive the Crash, Passive Income Race, Business Sprint), each with
an icon, a one-line tagline shown right on the card, and a longer `details`
blurb reserved for the popup. Every card has a small "ⓘ" button next to its
pick button; tapping it (instead of picking the scenario) opens
`InfoModal.jsx` — a small generic `{icon, title, body}` popup reused for this
and for the Unlocks screen — so a player can check what "Survive the Crash"
actually means without accidentally selecting it. The chosen `scenarioId`
flows from `SetupScreen.jsx` through `useGame.startGame()`'s new `options`
param → the reducer → `game/newGame.js`, which resolves it via
`game/scenarios.js`'s `getScenario()` and, for Survive the Crash, starts the
game already inside a storm (`scenarioStartingWeather()` seeds
`WEATHER_STAGES.stormyBust` instead of the usual sunny open) rather than
waiting for the weather to randomly turn bad.

Passive Income Race and Business Sprint each carry an `objective` (a passive
income target by difficulty, or a business count by a target month).
`game/scenarios.js`'s `checkScenarioObjective()` runs as a step inside
`turnEngine.js`'s month-end resolution and, the first time a player crosses
their target, stamps a one-time `scenarioGoalMonth` on that player and
appends an `objectiveMet` log entry (celebrated with the badge sound and an
80% robot-chat reaction chance) — guarded so it only ever fires once per
player, and deliberately *doesn't* end the game early or change the 24-month
length, just marks the moment. Classic Growth and Survive the Crash have no
`objective` and play exactly as before. The game-over screen reads
`scenarioGoalMonth` back to show who reached the goal (or a "give it another
shot" nudge if nobody did), plus scenario-specific framing for Survive the
Crash (did you grow your money starting from a storm, or not).

## Daily Challenge

A "🗓️ Today's Challenge" banner sits above the mode picker on setup — a
one-tap quick-start (skipping robot/scenario/difficulty pickers entirely)
into a Solo game against a fixed pair of robots (`game/dailyChallenge.js`'s
`DAILY_CHALLENGE_BOT_CONFIGS`, BossEmby and MrGrinch, both Sharp), on the
default difficulty and scenario, seeded so every player who plays today gets
the *exact same* weather timeline, fortune-card draws, and price drift —
only their own decisions differ. That fairness rests on `game/rng.js` being
rewritten from raw `Math.random()` calls to a seedable mulberry32 PRNG (every
existing helper — `randomInt`, `randomFloat`, `noise`, `chance`,
`weightedPick`, `pickRandom` — keeps its exact signature, so no other file
needed to change beyond how it's seeded); `dailyChallenge.js`'s
`seedForDate()` hashes today's `YYYY-MM-DD` into a seed, and the reducer's
`START_GAME` case calls `seedRng()` with it right before building state
whenever `dailyChallengeDate` is present. Leaderboard entries saved from a
Daily Challenge game carry that date (`game/leaderboard.js`), and
`LeaderboardModal.jsx` gained an All-Time / Today's Challenge tab toggle that
filters to just today's date — so a Daily Challenge score is compared
against other people who played the *same* environment today, not against
best-ever scores set under arbitrary conditions.

## Unlockable avatars and board theme

Beyond the three starter avatars, `gameConfig.js`'s `PLAYER_AVATARS` now has
five more, each gated behind a lifetime milestone in the new
`AVATAR_UNLOCKS` array (three games played, five badges earned across all
games, a $2,000+ net worth finish, ten games played, $300/mo+ passive
income in a game) — plus a cosmetic "Gold Table" board theme in
`BOARD_THEMES`, gated behind eight lifetime badges. `game/profile.js` tracks
the running totals (`gamesPlayed`, `badgesEarned`, `bestNetWorth`,
`bestPassiveIncome`, `selectedTheme`) in their own `localStorage` key,
separate from any single game save, so progress survives "New Game"/"Play
Again" and persists across sessions. `GameOverScreen.jsx` calls
`recordGameResult()` exactly once per finished game (guarded with a
`useRef`, not just an empty effect dependency array — React 18 StrictMode
intentionally double-invokes a fresh mount effect in development specifically
to catch a non-idempotent effect like this one, which would otherwise
double-count `gamesPlayed` and badges every game in a dev build) for
whichever human did best that game, and shows a "🎉 New unlock!" banner the
moment a threshold is newly crossed. Setup's avatar picker
(`useProfile()`'s `avatars`) only offers avatars actually unlocked so far,
and a new "🏅 Unlocks" button opens `UnlocksModal.jsx`, showing every
avatar/theme with its requirement and whether it's been met yet — plus a
one-tap theme selector once Gold Table is unlocked, applied via a
`data-theme` attribute on the app root that `theme.css` keys off of.

## Financial "why" lessons

The event log now occasionally surfaces a short, plain-language explainer
right next to the thing that just happened — `game/lessons.js`'s
`maybeAttachLesson()` maps a log entry's `kind` (starting a business,
buying a volatile "treasure" asset, a weather shift, a bad or good fortune
card, learning a skill, earning a badge) to a concept in `gameConfig.js`'s
new `FINANCIAL_LESSONS` object (passive income, risk and reward, market
cycles, emergency funds, opportunity cost, investing in yourself, good
habits — each with an icon, a title, and a one- or two-sentence blurb).
`game/reducer.js`'s `appendLog()` — already the single choke-point every log
entry flows through, which is also where bot chat reactions get triggered —
now checks each concept against a new `state.seenLessons` array and attaches
the lesson to the log entry (rendered as a small callout in
`EventLog.jsx`) only the *first* time that concept comes up in a game, so
the log doesn't repeat the same explainer every time a player buys another
treasure or another business. `seenLessons` itself is what
`FamilyRecapModal.jsx` reads to build its "concepts this game touched on"
list.

## Net worth chart and end-of-game insights

Every player now has a `netWorthHistory` array (`[{month, netWorth}, ...]`)
snapshotted as a step inside `turnEngine.js`'s month-end resolution, and the
game-over screen renders it as `NetWorthChart.jsx` — a dependency-free
inline-SVG line chart, one line per player, ending in that player's avatar
so the line is identifiable without relying on color alone (a legend row
underneath reinforces it further). Colors follow a validated-palette
workflow: three human colors were chosen and confirmed CVD-safe as a set via
a palette-validation script, while robots keep their existing
`BOT_PERSONALITIES` color for consistency with the chat feed — a couple of
those pre-existing bot colors are close enough to fail a strict pairwise
check on their own, which is exactly why every line here is direct-labeled
rather than depending on color to carry identity (fixing the wider bot
palette is out of scope for this round). Underneath the chart,
`game/insights.js`'s `buildInsights()` reflects a player's *own* numbers
back at them — their biggest single-month swing (up or down, with a
diversification nudge if the swing was a big drop) and a note on how spread
out their holdings ended up — deliberately modest and observational rather
than prescriptive advice.

## Risk-rating indicator in the asset shop

Each asset card in `AssetShop.jsx` now shows a compact 1-4 dot meter next to
its existing `riskLabel` text, derived from that asset's `volatility` value
already defined in `gameConfig.js` (`riskDots()` buckets it into quartiles).
The label text already existed but wasn't visually reinforced; the dots make
risk scannable at a glance right where the buy decision happens, instead of
only showing up implicitly through how bumpy the price line turns out to be
over time.

## Family/teacher recap screen

A "📋 Family Recap" button on the game-over screen opens
`FamilyRecapModal.jsx` — a summary meant to be read together after a game
or printed for a classroom, built entirely from state that already exists
rather than tracking anything new: the concepts touched on this game (from
`seenLessons` + `FINANCIAL_LESSONS`), final standings with each player's
earned badges, and a short list of generic conversation-starter prompts. A
"🖨️ Print" button calls `window.print()`; `game.css` adds a
`@media print` block that hides everything else on the page (buttons,
sidebar, other modals) and shows only the recap content, so what prints is
a clean one-page summary rather than a screenshot of the whole app chrome.

## Lead-change callouts and bigger milestone celebrations

`turnEngine.js` now snapshots who's in the lead (by net worth) at the very
start of each month's resolution, before that month's own payday, fortune
cards, or price drift are applied, then compares against who's in the lead
once resolution finishes — a genuine mid-resolution swing (not a lead that
already existed going in) appends a `leadChange` log entry naming whoever
just took over, which plays the cheering sound and has a 50% chance of
triggering a robot-chat reaction, on top of the `objectiveMet` sound/chat
handling scenario goals get. The bigger celebration (fireworks + applause,
already used for other big moments) now also covers these swing moments,
making a genuine overtake feel like the game event it is instead of quietly
scrolling past in the log.
