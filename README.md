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
double "boop"; Lemonade Stand gets a bright, bouncy triangle "sproing"; Tree
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

## Clearer zero-income asset labels and dynamic Tree House rent

Two related fixes to what was actually a confusing pair of mechanics: an
asset with `rentPerMonth: 0` (originally Lemonade Co., Treasure Chest, and
Piggy Bank — see the next section for how Lemonade's since changed)
generated no visible label at all in `AssetShop.jsx`, which read as a gap
rather than as "this one pays no monthly income." Every zero-income asset
card now shows an explicit "💵 Price only — no monthly income" line instead
of nothing; Treasure Chest and Piggy Bank still show it today.

Tree House's rent was the other half: `rentPerMonth: 40` was a flat
constant regardless of price or how many were ever bought, even though the
price itself drifted every month like any other asset — two numbers that
should have been connected but weren't. `game/players.js`'s
`effectiveRentPerUnit()` now derives a baseline yield from the asset's own
`rentPerMonth`/`basePrice` (Tree House: 40/250 = 16%) and multiplies it by
the *live* price, so rent rises and falls with price the way a real rental
cap rate would. On top of that, the first couple of units owned **across
the whole table** (not just one player — see `totalUnitsOwned()`) pay that
full baseline; every unit beyond that crowds the shared rental market a bit
more and pulls the per-unit yield down (floored so it never goes to
nothing) — `RENT_OVERSUPPLY_FREE_UNITS`/`RENT_OVERSUPPLY_RATE`/
`RENT_MIN_YIELD_FACTOR` in `gameConfig.js`. `AssetShop.jsx`'s Tree House
card now shows the live computed rent instead of a static number, plus a
plain-language "Market: getting crowded" / "Market: very crowded" tag once
the shared oversupply threshold is crossed, so the mechanic is visible
instead of hidden inside a formula.

Because rent now depends on what *every* player owns, a robot's own cash
(and so its own turn-by-turn decisions) can be nudged by what a human
bought — which surfaced a real bug while building this: `game/rng.js` used
to be a single shared random-number stream for everything, and Daily
Challenge's fairness guarantee (see above) depends on every player getting
the *identical* weather/price/fortune-card sequence regardless of their own
choices. A robot needing more or fewer decision-rolls because its rent
income shifted was enough to desync that shared stream. Fixed by splitting
`rng.js` into two independent streams: an "environment" stream (weather
duration, price drift noise, fortune-card draws — `envRandomInt`/
`envNoise`/`envWeightedPick`/`envPickRandom`, used only by `weather.js`,
`market.js`, `decks.js`, and `scenarios.js`'s starting-weather roll) that
every Daily Challenge player shares bit-for-bit, and the original default
stream for everything that stems from a player's own choices (business
income rolls, robot decision-making, R&D payoffs). `seedRng()` seeds both
from one input seed with two independently-derived starting points, so
Daily Challenge is still fully deterministic per date — just correctly
isolated from anything player choices can perturb.

## Lemonade Stand's weather-driven variable income

Lemonade Co. is now **Lemonade Stand (or similar service)** — the new name
is deliberately generic, since the mechanic is really "a small weather-
sensitive business," whatever a given table imagines it to be. More than a
rename, it used to be pure price appreciation/depreciation (weather + its
own volatility + a couple of specific fortune cards) and, unlike Tree
House, never generated any actual cash flow — a real gap given the mechanic
was originally described (and expected) to behave like unpredictable
business income. It now does, on top of its existing price swings:

- **A per-unit monthly income that's rolled fresh every month**, from a
  range that depends on the *current weather stage* —
  `weatherIncomeRange` in `gameConfig.js`'s `ASSETS` entry, e.g. $18–$34/mo
  per unit in a Sunny Boom (thirsty customers) vs. $0–$4/mo in a Stormy
  Bust (nobody's buying lemonade outside). `players.js`'s
  `rollWeatherIncomeAmounts()` does the actual roll, keyed by
  `weather.stageId`; `turnEngine.js`'s month-end resolution rolls it right
  before payday (so this month's roll pays out this month, not a month
  late) and stores the result on `state.weatherIncomeAmounts`, and
  `newGame.js` rolls an initial value for month 1 so it's never undefined.
  `players.js`'s `perUnitIncome()` is the new generic dispatcher `passiveIncome()`
  loops every asset through — a rent-bearing asset (Tree House) uses the
  live-price cap-rate model from the section above, a weather-income asset
  (Lemonade Stand) uses this month's rolled amount, and everything else is
  still 0.
- **A one-time nudge from the 3 lemonade-specific fortune cards** —
  Lemonade Rush, Lucky Stand Review, and Lemonade Spill — on top of their
  existing price-percent effect. `decks.js`'s `applyCardEffect()` now
  understands a new `perUnitCash` effect type (a flat $ amount **times
  however many units the player currently owns**) and a card can carry
  either a single legacy `effect` object or an `effects` array to do more
  than one thing at once — every pre-existing single-effect card keeps
  working byte-for-byte unchanged.
- **The rolled amount is on the ENVIRONMENT random-number stream**
  (`envRandomInt`, same stream as weather/price/cards — see the dual-stream
  fix above), since it's driven by the shared weather, not any player's own
  choices. Getting this wrong would have reintroduced the exact class of
  Daily Challenge desync bug just fixed for Tree House rent; a dedicated
  regression test (`test_economy3_determinism.mjs`) specifically checks that
  the month-by-month roll sequence stays identical between a human who
  trades heavily and one who does nothing at all.

Both the shop (`AssetShop.jsx`) and the portfolio breakdown
(`PlayerDetailModal.jsx`) show Lemonade Stand with a live "+$X/mo each
right now (⛅ Cloudy Peak)" figure plus the overall range across every
weather stage ("Range: $0–$34/mo each" — `gameConfig.js`'s
`getAssetIncomeRange()`), so the variability is visible up front instead of
only ever showing up quietly in the cash total. Bots don't factor this
income into their buy/sell decisions yet — `aiEngine.js`'s scoring still
only looks at price — the same kind of deliberate scope cut as "bots don't
use business upgrades yet" below; teaching a bot personality to actually
chase weather-driven income is future work.

## Business upgrades: Marketing, Sales, Operations, and R&D

A started business used to be pure autopilot: one decision (pay $300 + a
skill token), then a fixed, randomly-rolled income forever with nothing
further to do. Businesses can now be reinvested in via four upgrade tracks
— `gameConfig.js`'s `BUSINESS_UPGRADE_TRACKS`, applied by
`game/businessUpgrades.js` — each modeling a different real lever, and each
behaving mechanically differently on purpose rather than being four
reskins of the same button:

- **📣 Marketing** ($120) — a short campaign: +$25/mo for the next 3
  months, then it fades. No cap on repeat purchases (every one costs real
  cash and only ever helps briefly).
- **🤝 Sales** ($180) — grows the permanent customer base: +$15/mo,
  forever, capped at 3 purchases per business so it's a steady climb
  rather than a runaway number.
- **⚙️ Operations** ($150) — doesn't touch income directly; each level
  (capped at 3) discounts every *other* upgrade bought for that business
  by 10% (never discounting itself, or Operations would just be strictly
  better than the other three tracks). "Running leaner" makes future
  investment cheaper, not more income today.
- **🔬 R&D** ($250) — the riskiest, slowest bet, capped at 2 projects per
  business: cash spent now queues a project that resolves 2 months later
  (`RND_DELAY_MONTHS`) for a permanent bump that's always *something* —
  65% chance of a big payoff (+$40/mo), 35% chance of a smaller one
  (+$15/mo) — never nothing, so it reads as "a risk worth taking," not a
  trap, while the size variance still teaches that R&D is less certain
  than Sales.

`actions.js`'s new `upgradeBusiness()` validates ownership, the track's cap,
and cost (after any Operations discount) the same way every other action
does, and `turnEngine.js`'s month-end resolution now has a step *before*
payday that resolves any R&D project whose delay is up and drops expired
Marketing boosts (`resolvePendingRnd()`/`pruneExpiredBoosts()`) — so a
project that resolves this month already counts toward this month's
paycheck instead of showing up a month late. A business's net-worth
contribution (`businessValue()` in `players.js`) now tracks
`totalInvested` — the original $300 plus every upgrade actually paid for
— instead of a flat per-business constant, so reinvesting in a business is
real net-worth growth, not just a cash-flow trick. Upgrade buttons live in
`PlayerDetailModal.jsx`'s business rows, but only render when
`canUpgrade` is true (viewing your own live turn — `GameBoard.jsx` computes
this); opening any other player's card, including an AI's or your own
after the game has ended, stays exactly as read-only as it always was,
just now also showing each business's upgrade levels so it's visible how
it was grown. A first business-upgrade purchase also surfaces a new
"reinvesting in what you own" financial lesson (`FINANCIAL_LESSONS.reinvestment`
in `gameConfig.js`), same one-time-per-game treatment as every other lesson.

Bots don't use this system yet — every robot personality still just starts
businesses and never upgrades them, a deliberate scope cut to keep this
round's AI behavior unchanged and easy to reason about. A follow-up could
teach e.g. DaddyBigBux's `tycoon` strategy to reinvest in its own
businesses, but that's future work, not something this round claims to do.

## Portfolio breakdown available at game-over

Tapping a player's card always showed a live gain/loss breakdown per asset
(average price paid vs. current price) and each business's income, but
that view — `PlayerDetailModal.jsx` — was never wired up on the game-over
screen, which is exactly when "how did my Lemonade Stand actually do this
game?" is the more interesting question. Every row in the final standings
is now tappable (`GameOverScreen.jsx`), opening the same portfolio
breakdown in its normal read-only mode (no upgrade buttons — the game's
over, there's nothing left to invest in) for any player, not just the
winner.

## Player card: explicit "Invest in your businesses!" button

The "🔍 Tap for portfolio details" hint on each player card was the only
way to discover that the whole card is clickable — there was nothing
pointing specifically at the business-upgrade system introduced earlier.
`PlayerPanel.jsx`'s `PlayerCard` now has an explicit ⚙️ "Invest in your
businesses!" button under that hint, which opens the exact same portfolio
breakdown as tapping anywhere else on the card. Cosmetic only — no new
behavior, just a second, more specific way in. (Nesting a real `<button>`
inside the outer clickable card meant the card itself could no longer be a
`<button>` — it's now a `<div role="button">` with the same click handler
plus Enter/Space keyboard support, so accessibility didn't regress.)

## Treasure Chest: an honest speculation lesson, not just an unexplained gamble

Treasure Chest had the highest volatility in the game (0.40 — more than
double Lemonade Stand's) and, unlike every other asset, absolutely no
cash-flow mechanic of any kind: no rent, no weather-driven income, nothing.
That's the correct design — it's supposed to be the one purely speculative
asset at the table — but the game never actually *said* that, so it read as
an unexplained "sometimes the shiny one goes up a lot, sometimes it
crashes" rather than a lesson. Renamed to **Treasure Chest (or speculative
crypto)** with a "No income — pure speculation" tagline, and the financial
lesson that fires on a player's first purchase (`FINANCIAL_LESSONS.riskReward`
in `gameConfig.js`, triggered via the existing `buy_treasure` → lesson hook
in `game/lessons.js`) now explicitly teaches *why* it's risky: it never
pays you anything the way Tree House rent or Lemonade Stand's earnings do,
so its whole value is just whatever someone else is willing to pay for it
next — speculation, the same idea behind a trendy collectible or a
cryptocurrency, not investing. The asset's mechanics themselves are
unchanged; this is a labeling and lesson-content fix, not a new mechanic.

That reframes *what* the risk is, but the more useful lesson for a kids'
game is probably *what to do about it* — hence two smaller additions
alongside the rename:

- **A new "Balanced Investor" badge** (`gameConfig.js`'s `BADGES`, a new
  `assetDiversityAtLeast` checker in `badges.js`) for holding 3+ different
  kinds of assets at once, with its own dedicated financial lesson
  ("Don't put all your eggs in one basket" — `FINANCIAL_LESSONS.diversification`)
  instead of the generic "badges track good habits" every other badge
  triggers. `game/lessons.js` now looks up a badge's own id
  (`CONCEPT_BY_BADGE_ID`) before falling back to the generic mapping, so
  future badges can get their own specific "why" too without disturbing
  the ones that don't need it.
- **A named concentration warning at game-over** — `game/insights.js`'s
  low-diversity insight used to just say "spreading out usually lowers
  your risk" with no specifics. It now checks whether a player ended the
  game heavily concentrated (≥40% of net worth) in something genuinely
  volatile (Lemonade Stand's volatility or higher) and, if so, names it
  directly: "62% of your money was in Treasure Chest (or speculative
  crypto) by the end — the most volatile thing you held... likely why your
  net worth swung around the most this game." This is a current-holdings
  approximation, not a true month-by-month causal reconstruction (the game
  doesn't keep a per-player, per-asset value history to compute that
  precisely) — documented as such in the code — but naming the actual
  culprit asset is a real improvement over the old generic nudge. Concentration
  in something *safe* (e.g. all Piggy Bank) deliberately does NOT trigger
  this warning — being concentrated isn't inherently risky, only being
  concentrated in something volatile is.

One reliability fix came out of building the badge lesson: `reducer.js`'s
`appendLog()` only ever attaches one financial lesson per batch of log
entries (so a single month-end resolution doesn't fire three lessons at
once), previously just picking whichever qualifying entry happened to come
first in the array. Month-end logs fortune cards *before* badges, and on
month 1 essentially every fortune card qualifies for a still-unseen
lesson — so a badge earned on turn one (Balanced Investor is easy to hit
immediately) would almost always lose that race and silently never show
its lesson, forever, since a badge only ever logs once. `appendLog` now
gives badge-earned entries first crack at that single slot — a recurring
kind like `fortuneGood` gets another shot the next time it happens, but a
one-shot badge doesn't, so it's the one that should yield. Verified with a
dedicated Playwright test that reproduces exactly this scenario (diversify
into 3 assets on turn one) and confirms the diversification lesson now
actually appears.

## Business exits, refined asset labels, and 3 new badges

Three additions this round, all in service of the same idea: growing a
business's income should pay off in more ways than the slow monthly
trickle.

**Treasure Chest and Lemonade Stand naming, refined again.** The previous
round's `Treasure Chest (or speculative crypto)` name is now just
**Treasure Chest** again, with the specifics moved into its tagline —
*"Collectibles, meme stocks, crypto tokens, and the new things"* — which
reads better in the shop card's limited space while keeping the same
honest point (it's the one purely speculative asset, no cash flow of any
kind). Lemonade Stand is now **Lemonade Stands & More**, tagline *"Seasonal
services like food trucks, lawncare, & more!"* — broadening what the asset
represents beyond literally just lemonade, matching the fact that its
weather-driven variable income already models any seasonal side-hustle
kids might run. Both are cosmetic — `gameConfig.js`'s `ASSETS` entries
only, no mechanics changed.

**Business exit offers — a rare, high-upside "sell for a multiple" event.**
About once every 6 months on average (a per-month coin flip, not a fixed
schedule, so it stays a surprise — `BUSINESS_EXIT_CHANCE_PER_MONTH = 1/6`
in `gameConfig.js`), the table gets a shot at an acquisition offer: one
random player, if they currently own a business, gets a buyout offer for a
multiple of that business's current monthly income —
**2x** (rare), **5x** (common), **8x** (common), **10x** (rare), or a
jackpot **20x** (very rare), weighted via `BUSINESS_EXIT_MULTIPLIER_WEIGHTS`.
If someone owns more than one business, the offer targets whichever one
currently earns the most. The whole point is to make every dollar sunk
into Marketing/Sales/Ops/R&D upgrades (see the "Business upgrades" section
above) pay off twice over: once as steady monthly income, and again as a
bigger number if an exit happens to land on that business — a $200/mo
business worth $400 at 2x is worth $4,000 at a 20x jackpot.

The event reuses the existing fortune-card recap modal (`FortuneCardModal`)
instead of a new UI — it queues a synthetic recap entry shaped exactly like
a real fortune card (`deckId: 'opportunity'` for the green "good" styling),
so it shows up, plays its own sound, and gets a bot-chat reaction through
all the same systems a real card does, with zero new UI code. A new
"why" financial lesson (`FINANCIAL_LESSONS.businessValuation`) explains the
real-world idea the first time it fires: *businesses are bought and sold
for a multiple of what they earn — which is why growing a business's
income pays off even before you ever sell it.*

New game-state: each player now has `soldBusinesses`, a permanent record of
every exit they've cashed in on (`{ id, name, income, multiplier, payout,
month }`), which feeds the new "Cashed Out" badge below.

*RNG determinism note, since this game supports a shared Daily Challenge
mode:* the exit's chance/multiplier/target-player draws happen
**unconditionally, in the same fixed order, every single month** — on the
environment RNG stream (`envChance`, a new export added to `game/rng.js`
alongside the existing `envRandomInt`/`envNoise`/`envWeightedPick`) — even
in a month where nobody at the table owns a business. Skipping those draws
based on who currently owns a business would make the environment stream's
draw count depend on player choices, silently desyncing the shared
weather/price/fortune-card sequence between two Daily Challenge players the
moment their choices diverge — the exact bug class fixed earlier for
dynamic Tree House rent. If the randomly-targeted player turns out to own
nothing, the offer is simply a quiet no-op, same spirit as an existing
fortune-card effect that already no-ops for a non-owner. Whether a *real*
transfer happens (vs. a no-op) is allowed to depend on player state — that
part is by design, the same as any other ownership-gated card effect — only
the RNG draw *count and order* has to stay fixed. Covered by a dedicated
determinism test (`test_business_exits_determinism.mjs`, mirroring the
existing Tree House rent one) that plays two runs with wildly different
business-building behavior and confirms the exit fires on identical months
regardless.

**3 new badges**, added to `gameConfig.js`'s `BADGES` with new checker
kinds in `badges.js`:

- **Cashed Out** 💼 — sell a business for a buyout offer (`soldBusinesses`
  has at least one entry). Shares the business-valuation lesson above via
  `CONCEPT_BY_BADGE_ID` in `lessons.js`, the same "give this specific badge
  its own explanation" mechanism the Balanced Investor badge introduced
  last round.
- **Empire Builder** 🏙️ — own the most businesses at the table (2 or
  more; ties all get the badge).
- **Top Earner** 💎 — have the most lucrative businesses at the table
  combined ($100+/mo; ties all get the badge).

The latter two are a new checker *shape*, not just new data: every prior
badge only ever looked at one player's own state, but "most" is inherently
relative to everyone else at the table. Both new checkers take
`context.allPlayers` (already threaded through from `turnEngine.js`'s
month-end badge evaluation) and compare against the max across the whole
roster, awarding the badge to every player tied for that max rather than
picking an arbitrary single winner.

A new sound (`SOUNDS.businessExit` — a "cha-ching!" cash-register flourish,
bigger than the badge fanfare) and bot-chat reaction category
(`REACT_CHANCE.businessExit`, `chatEngine.js`) round out the exit event so
it feels like a genuine table-wide moment rather than a quiet log line.

**Assumptions made, stated here for the record:** "once every six
months/turns" in the request was read as a per-game, table-wide cadence
(the coin flip happens once per month for the whole table, not once per
player) — the qualifying phrase "in a typical game" pointed that way, and
the config constant is named accordingly
(`BUSINESS_EXIT_CHANCE_PER_MONTH`, not per-player). Bots don't yet factor
exit odds into their own buy/upgrade decisions (`aiEngine.js` is
unchanged) — the mechanic affects everyone equally when it fires, but
nobody's strategy adapts to its existence yet.

**A real bug came out of building this**, caught by a Playwright run before
shipping: business ids were generated as
`` `${playerId}-biz-${businesses.length + 1}` `` — fine as long as
businesses only ever got added, but a business exit can now *remove* one,
shrinking that length. Sell business #2 of 3, start a new one, and the new
business silently reused business #2's old id — a duplicate React key
(caught as a real console warning, not a guess) and a corrupted id shared
between two different businesses under the hood (soldBusinesses history,
badge math, anything keyed by business id). Fixed with a monotonic
`businessSeq` counter on the player (`players.js`) that only ever counts
up, threaded through `startBusiness` in `actions.js` instead of deriving
the id from the live array length. Covered by a dedicated regression test
(`test_business_id_seq.mjs`) that reproduces the exact
start-3/sell-one/start-another repro shape directly.

Tested with new unit coverage (`test_business_exits1.mjs` — multiplier
distribution matches configured weights over 20k trials, payout math,
silent no-op on a business-less target, full-game integration; plus
`test_badges_exit.mjs` for all 3 new badge checkers including ties and
threshold edges, and `test_business_id_seq.mjs` for the id-collision fix
above) and a Playwright run that plays 18+ months of real UI
interaction and confirms the buyout-offer modal, its lesson callout, and
the new badges all render correctly with no console errors.

## VentureMaker links: title card, setup screen, and game over

Three link placements out to the parent brand's site
(`https://venturemaker.org/`, `VENTUREMAKER_URL` in `gameConfig.js` — one
constant, so it only ever needs updating in one place):

- **The title card/logo.** `components/Brand.jsx` — the "VentureFlow"
  wordmark + "A VentureMaker™ game" tagline shown on every screen (setup,
  board, game over) — is now itself a link out to VentureMaker, opening in
  a new tab (`target="_blank" rel="noopener noreferrer"`, so nobody loses
  their in-progress game). Visually unchanged from before (same size/
  color/spacing); only a subtle hover/focus opacity cue was added
  (`.vf-brand--link` in `theme.css`) so it still reads like a wordmark, not
  a generic blue hyperlink.
- **A clear callout at the bottom of the setup screen.** New
  `components/VentureMakerLink.jsx` — a small pill-styled link (not a
  plain text link — deliberately styled to look clickable at a glance,
  `.vf-venturemaker-link` in `theme.css`) reading *"Learn more about
  winning entrepreneurship and connect with future and proven entrepreneurs
  at VentureMaker."* Sits below the "Let's Play!" button, separated by a
  dashed rule (`.vf-setup__venturemaker`).
- **The same callout on the game-over screen**, right after the "Play
  Again" actions row (`.vf-gameover__venturemaker`) — the natural spot
  since that's the screen where a session actually wraps up.

Both callout placements render the exact same `VentureMakerLink`
component (and the exact same `VENTUREMAKER_BLURB` string from
`gameConfig.js`) rather than separately copy-pasted markup/text, so the
wording only ever needs to change in one place.

Verified with a new Playwright test (`test_ui_venturemaker.js`) that
checks all three placements across all three screens: the Brand link's
`href`/`target`/`rel` on setup, board, and game-over; the setup-screen
callout's link and exact wording; and — after playing a full 24-month game
through to game over — the same callout's link and wording there too.

## Business-upgrade payoffs: percentage of income instead of flat dollars

Marketing, Sales, and R&D used to pay out a fixed dollar figure no matter
how big the business already was — Marketing was always +$25/mo, Sales was
always +$15/mo, R&D was always +$40 or +$15/mo. The exact same purchase
felt huge on a brand-new $30/mo business and trivial on one that had
already grown, and — worse — it meant a bigger, more successful business
got no more benefit from the same kind of investment than a tiny one did,
which is backwards from how a real ad campaign or sales hire actually
pays off. All three tracks now pay out a random **percentage of the
business's current income** instead (`percentOfIncome()` in
`game/businessUpgrades.js`), so the same purchase is worth more dollars on
a business that's already grown — including from earlier Sales/R&D
upgrades — the same way reinvesting more in something that's already
paying off should compound:

- **📣 Marketing** — a temporary boost, still fading after 3 months, now
  sized as 8%–30% of the business's current permanent income
  (`MARKETING_BOOST_PCT_MIN`/`MAX` in `gameConfig.js`) rather than a flat
  $25. Rolled against income *not* including any other still-active
  Marketing boost, so stacking campaigns can't inflate each other's roll.
- **🤝 Sales** — same 8%–30% range, still permanent, still capped at 3
  purchases per business — but each purchase now applies to whatever
  income the business already has, so three purchases in a row compound
  on top of each other rather than adding three identical flat amounts.
- **🔬 R&D** — keeps its own big-vs-small split so a big payoff still
  reliably reads as bigger than a small one, just expressed as two
  percentage sub-ranges instead of two dollar constants: a small payoff is
  now 8%–18% of current income, a big one (still a 65% chance) is 20%–30%.
  Multiple R&D projects resolving in the same month still compound on the
  running (already-bumped) income within that same resolution, same as
  before.

The 8% floor (rather than a literal 0%) is a deliberate choice, made after
checking in on it directly rather than guessing: a genuine 0% roll would
read as a bug or a wasted turn rather than "a real letdown compared to a
great roll," so every purchase is guaranteed to do *something*, even on a
bad roll — the gap between an 8% and a 30% outcome is still wide enough to
feel like it mattered.

**Also adjusted, beyond the literal ask:** Marketing's cost dropped from
$120 to $75. This wasn't optional — under the old flat-dollar system,
Marketing's maximum possible return (3 months × $25 = $75) never covered
its $120 cost, so buying Marketing was a guaranteed loss no matter how the
dice fell, which lines up exactly with the "marketing investment never
makes sense" complaint that prompted this change. Converting to a % of
income without also revisiting the cost would have left that same
guaranteed-loss math in place for any business smaller than roughly
$150/mo (120 ÷ 0.30 ≈ $400 needed at a lucky 30% roll to break even in one
campaign, well above where most businesses sit for a while). At $75, even
a below-average roll on a modest business is a real, if modest, gain — and
Marketing now genuinely grows into being worth more as the business it's
attached to scales, instead of only ever being a guaranteed drain.

Verified with a new dedicated Node test
(`test_business_upgrades_pct.mjs`, run through the same seeded-RNG
harness as the rest of the suite) covering: every Marketing/Sales roll
landing inside the configured 8%–30% band and never rounding to $0; R&D's
small and big sub-bands never overlapping and both appearing over many
trials; three successive Sales purchases and two same-month R&D
resolutions each compounding on the running (not the original) income;
and a bigger business earning a proportionally bigger average dollar
payout than a smaller one for the identical purchase. The existing
`test_economy1.mjs` suite was updated in the same pass (range checks
instead of exact-equality against the old flat constants) and still
passes in full, along with the rest of the Node and Playwright
regression suites.

## AI players reinvest in businesses they already own

Robots used to completely ignore the Marketing/Sales/Operations/R&D
upgrade system — every one of the four business tracks above was a
human-only lever. A bot with a thriving business and cash sitting idle
would just start another business (or buy more assets) rather than ever
growing what it already had, which looked passive and a little dumb next
to a human player actively upgrading.

`game/aiEngine.js`'s greedy candidate-scoring loop now generates upgrade
candidates too: for every business a bot owns, and every still-upgradeable
track on it (skipping anything already maxed or unaffordable — the exact
same `canUpgradeTrack`/`upgradeCost` checks a human's upgrade buttons use,
so a bot can never buy something a human couldn't), a weighted candidate
gets added to the same pool the bot already uses to compare Piggy Banks,
Treasure, starting a new business, and so on. Each of the seven bot
personalities got its own weighting across the four tracks
(`upgradeMarketing/upgradeSales/upgradeOps/upgradeRnd` in `STRATEGIES`),
matching each personality's existing flavor — **Tycoon** leans hard into
Sales and R&D (aggressive compounding growth), **Hoarder** barely touches
any of them (prefers piling up cash and assets over reinvesting), **Saver**
favors Operations (a safer, steadier upgrade) over anything flashy, and so
on. Base scores also shift with the weather — during a storm, upgrade
candidates score much lower across the board (10–20 vs. 50–85 in good
weather), the same "play it safer when the market's bad" instinct the rest
of the AI's candidate list already follows for buying assets.

An emergent (and correct, not a bug) behavior surfaced while testing this:
a bot sitting on a big cash surplus often buys uncapped, repeatable,
higher-scoring assets like Treasure or Lemonade Stands *before* it ever
gets to an upgrade candidate, for several personalities — the upgrade
candidates aren't meant to always win, just to be real options a bot can
and will take when they're competitive. Verified with a new dedicated Node
test (`test_ai_reinvest.mjs`): rather than relying on "give a bot lots of
cash and hope an upgrade wins out of many options" (which is exactly the
unreliable design that surfaced the behavior above), the test isolates the
actual claim — every option *other* than a Marketing upgrade is made
unaffordable/unavailable, proving each of the 7 personalities takes the
upgrade when it's genuinely their best (only) move — plus a full-game
integration check that a Tycoon bot buys at least one upgrade over the
course of a real game.

## Business buyout offers: a real accept/decline decision

A buyout offer used to auto-resolve the instant it landed — the business
was just sold, with no say from whoever owned it, human or bot. That
removed all the tension from what's meant to be a real decision: cash in
hand right now, or keep a business that might be worth even more later.

Buyout offers targeting a **human** player now pause the game on a
dedicated decision modal (`BusinessExitOfferModal.jsx`) showing the offer
amount, the multiple it represents, and a plain-language "why" explainer,
with two real buttons: **🤝 Keep Building** (decline — the business stays,
nothing changes) or **💼 Accept $X** (sell it — cash in hand, business
gone). Under the hood, month-end resolution is now a two-phase process
(`game/turnEngine.js`'s `beginMonthEnd`/`finishMonthEnd` split): a
human-targeted offer pauses mid-resolution (`status: 'exitOffer'`,
`pendingExitOffer` holding the offer) until `resolveExitOfferDecision` is
called with the player's choice, at which point the same `finishMonthEnd`
that would've run immediately picks back up — payday, fortune cards, price
drift, badges, and so on, all identical either way.

A buyout offer targeting an **AI** player is still decided instantly, the
same as before this round, so bot turns don't grind to a halt waiting on
nobody — but it's no longer a coin flip. `aiDecideExitOffer` makes a
deterministic call based on the offer's multiple and the bot's own
strategy (Tycoon holds out for an 8x+ offer; Hoarder/Saver always take
guaranteed cash; everyone else takes 5x+) — deliberately **not** using any
RNG draw at all, so it can never affect the environment-stream's fixed
draw order that Daily Challenge fairness depends on (see the Daily
Challenge section below, and `game/businessExits.js`'s own notes on why
that stream stays untouched by player choices).

Declining isn't a free lunch, either — it's a real gamble, flavored as
one: the fortune-card recap that follows a decline ("Offer Declined")
spells out that there's no guarantee a better offer ever comes again.

Verified with a new dedicated Node test (`test_business_exit_decision.mjs`,
14 checks) covering both the decline and accept paths in isolation (state
changes, payout math, log entries, offer clearing) plus a full-game
integration check confirming both a human-paused decision *and* an
AI-instant decision genuinely occur within the same game. The existing
`test_business_exits1.mjs` Playwright/Node coverage was updated for the
new pause behavior, and a new Playwright UI test
(`test_ui_new_features.js`) exercises the actual Accept/Decline buttons
end-to-end, including confirming a sold business disappears from the
portfolio view.

## Businesses decline when left untended

Every upgrade track above is worth investing in — but until now, a
business that was *never* upgraded had no downside at all, just a
permanently flat income. Real businesses don't work that way: neglect a
business operationally for long enough and it starts losing ground.

A business now tracks `lastTendedMonth` — stamped when it's first started,
and re-stamped every time any upgrade (Marketing, Sales, Ops, or R&D) is
*purchased* on it (deliberately not on an R&D payoff resolving later,
since that's not a fresh act of attention, just an earlier one paying
off). Once a business goes 6 months (`BUSINESS_DECLINE_GRACE_MONTHS`)
without a single upgrade purchase, it starts losing **5%–10%** of its
current income every 3 months (`BUSINESS_DECLINE_INTERVAL_MONTHS`) —
resolved automatically at month-end alongside R&D payoffs
(`applyBusinessDecline` in `game/businessUpgrades.js`), logged with a
`businessDecline` entry, and floored so it can never be shrunk to $0
(`BUSINESS_DECLINE_INCOME_FLOOR`) — a neglected business can wither, but
it doesn't disappear.

The UI gives fair warning before any money is actually lost:
`businessHealthStatus()` reads as **healthy** (no coloring), **⚠️ warning**
(the business's name renders in yellow) starting 2 months
(`BUSINESS_DECLINE_WARNING_MONTHS`) before the decline threshold, or
**📉 declining** (name renders in red, plus a "declining" tag) once it's
actually losing money — both shown in the full portfolio breakdown
(`PlayerDetailModal.jsx`) next to every business. The player panel's
"Invest in your businesses!" button also picks up on this: it switches to
a red danger-styled "📉 A business is losing money — reinvest now!" call
to action once anything at the table is actively declining, or a softer
"⚠️ A business needs attention soon" once anything's in the warning
window — so the fix (any upgrade purchase, on any track) is never more
than a glance away.

Verified with a new dedicated Node test (`test_business_decline.mjs`, 21
checks) covering the health-status thresholds, decline timing (no decay
before the grace period, firing exactly on the interval boundaries, never
going below the floor), that any upgrade purchase resets the tending
clock, and a full-game integration check that a genuinely neglected
business logs a real decline and loses income. The new Playwright UI test
(`test_ui_new_features.js`) confirms the red/yellow name coloring and
health tag chips actually render for a crafted long-neglected business.

## Career stats, shareable Daily Challenge results, and an upgrade-roll reveal

Three smaller additions, aimed at giving the game more reasons to come
back to:

- **📊 Career Stats** — a new lifetime totals screen
  (`CareerStatsModal.jsx`, opened from a button next to Unlocks/
  Leaderboard on the setup screen) that accumulates across *every* game
  ever played on the device, win or lose — games played, career net worth
  earned, best single-game net worth, best passive income, businesses
  started, businesses sold in a buyout, and badges earned. This is
  deliberately separate from `game/profile.js`'s existing "best-ever"
  figures (which only move on a new personal best): the running totals
  give a reason to keep playing even between one-off games that don't set
  any new record.
- **📤 Share Result** — on a finished Daily Challenge game, a new button on
  the game-over screen (`buildDailyChallengeShareText()` in
  `game/dailyChallenge.js`) copies a short, spoiler-free, Wordle-style
  summary to the clipboard: the date, final net worth, leaderboard rank
  (if saved), and a row of colored squares tracking net-worth growth
  month-to-month (🟩 up, 🟥 down, ⬜ flat, 🟦 the starting month) — no
  specific numbers or strategy given away, just shareable bragging rights.
  Falls back to a `window.prompt()` if the Clipboard API is unavailable or
  denied, so the text is still reachable even then.
- **A suspenseful reveal for upgrade payoffs** — Marketing/Sales/R&D
  payoffs are randomized percentages (see the "percentage of income"
  section above), but the log entry announcing one used to just flatly
  appear like any other line. A `businessUpgrade`/`businessRnd` log entry
  now gets a brief CSS-only "landing" flash on mount
  (`.vf-log__entry--reveal` in `game.css`) — a cheap way to make a
  percentage roll actually feel like a roll. Pure CSS keyed off the
  entry's stable `id` (never reused, never remounted), so it plays exactly
  once, right when the entry is genuinely new.

Verified with a new dedicated Node test (`test_career_stats.mjs`, 20
checks) covering the lifetime-total accumulation math across multiple
games and the share-text formatting (including a fix for an
astral-character regex bug — the trend emoji need the `u` regex flag and
`Array.from()` character counting, not `.length`, since they're outside
the BMP). The new Playwright UI test (`test_ui_new_features.js`) confirms
the Career Stats modal opens and shows injected totals, and that clicking
Share Result actually copies the expected text to the clipboard on a
crafted Daily Challenge game-over state.

## A signature credit line under the brand mark

The header now reads three lines instead of two: **VentureFlow**, *A
VentureMaker™ game*, and — new — a cursive **by Michael P Beirne** credit
underneath, styled like an actual signature rather than another line of
UI copy. `Brand.jsx` gained a third `<div>` (`BRAND_CREDIT` in
`gameConfig.js`) set in Dancing Script (`@fontsource/dancing-script`,
self-hosted the same way the rest of the game's fonts already are —
`main.jsx` only imports the one weight it actually uses, `600`) instead of
the game's usual Fredoka. The whole mark — logo, tagline, and signature —
is still one single link out to VentureMaker, unchanged from before.

## A wealth pile that grows next to each player's name

A quick, glanceable read on how someone's doing beyond the raw net-worth
number: as a player's net worth crosses a series of thresholds, small
icons pile up right next to their name — loose change first (🪙 at
$500), then cash (💵 at $2,500), money bags (💰 at $10,000), jewels (💎 at
$25,000), and finally the big-ticket lifestyle purchases: a sports car
(🚗 at $50,000), a house (🏠 at $100,000), and a yacht (🛥️ at $250,000).
Tiers are cumulative — a wealthy player shows every icon they've earned
at once, not just the newest one — so the pile reads as something that's
been genuinely building up over the course of the game, not a single
badge that gets swapped out. Implemented as a small pure function
(`wealthPileTiers()` in the new `game/wealthPile.js`, kept separate from
the React that renders it, same pattern as `businessHealthStatus`) plus a
`WealthPile.jsx` component wired into both the live player card
(`PlayerPanel.jsx`) and the game-over standings (`GameOverScreen.jsx`), so
the pile is visible throughout the game and still there for the final
reveal at the end. Purely cosmetic — nothing else in the game reads these
tiers — with a hover tooltip spelling out the exact net worth and which
tiers have been reached, for anyone curious about the icons themselves.

## A full Cash Ledger inside the player portfolio

Every dollar that's ever moved for a player, from the game's first month
through however far it's gotten, is now just a tap away: a new **📒 Cash
Ledger** button in the portfolio breakdown's header (`PlayerDetailModal.jsx`)
opens a dedicated modal (`LedgerModal.jsx`) listing every inflow and
outflow in order, each with the month it happened, whether it was money
in or out, and exactly where it came from or went — starting capital,
a purchase or sale, starting a business, upgrading one, learning a skill,
payday (with a breakdown of how much came from allowance vs. business
income vs. asset income), a fortune card, or a buyout offer. It's
read-only and safe to open for any player (human or AI) at any point in
the game, same as the portfolio breakdown it lives inside.

Under the hood, every player now carries a `ledger` array
(`game/players.js`'s `createPlayer`, seeded with a "Starting capital"
entry on day one) that gets a new entry appended — never rewritten —
at every single site that actually changes `player.cash`: buying/selling
an asset, starting a business, upgrading one, and learning a skill
(`game/actions.js`), plus payday, an accepted buyout, and any fortune
card with a cash effect (`game/turnEngine.js`). Fortune cards are handled
generically — rather than checking each card's effect type by name, the
ledger just compares a player's cash before and after `applyCardEffect`
runs, so a card that doesn't touch cash (a price shift, a skill token)
correctly produces no ledger noise, and any *future* cash-effect type
gets ledger coverage for free. Every ledger entry's `amount` is always
the exact, real cash change — never a derived/estimated figure — so the
ledger can never drift out of sync with the number on the player's card;
the one place an approximation shows up is payday's descriptive
breakdown text (allowance/business/asset amounts are rounded
individually for readability and can be a dollar off from their sum,
while the actual entry `amount` credited always matches the real payday
total exactly).

Verified with a new dedicated Node test (`test_cash_ledger.mjs`, 30
checks) covering every action's entry shape, that payday's entry amount
exactly matches the real cash gained that month, and — the strongest
check — a full multi-player game where every player's starting cash plus
their entire ledger history sums to EXACTLY their actual current cash,
confirming no cash-moving site was missed. The new Playwright UI test
(`test_ui_round3.js`) opens the ledger from a real game, confirms it
shows the starting-capital entry and a fresh purchase, and confirms
closing the ledger doesn't also close the portfolio underneath it (the
ledger nests inside the portfolio's own modal overlay — a first for this
game's modals — so its backdrop click needed an explicit
`stopPropagation` to avoid closing both at once).

## Buyout offers are now a multiple of annual revenue, not monthly

A business buyout offer's multiplier (see the "real accept/decline
decision" section above) was being applied to a single month's income,
which doesn't match how a real business valuation is actually framed —
a buyer values a business against what it earns in a YEAR, not what it
happened to earn last month. `game/businessExits.js`'s `rollBusinessExit`
now computes `annualIncome` (monthly income × 12) and applies the
multiplier to that instead: `BUSINESS_EXIT_MULTIPLIER_WEIGHTS` moved from
2x/5x/8x/10x/20x-of-monthly to **1x/2x/4x/8x/15x-of-annual** (weighted so
2x/4x are the common outcomes, 1x/8x are rarer, and 15x is a true
jackpot) — clean, easy-to-read multiples of a full year's revenue rather
than an odd fraction of one. The rarity labels, the AI's accept/decline
thresholds (`aiDecideExitOffer` in `turnEngine.js` — always takes 8x/15x,
a tycoon holds out for 4x+, everyone else takes 2x+ and shrugs off a
lowball 1x), and every log message / the offer modal's copy were all
updated from "Nx monthly revenue" to "Nx annual revenue" to match.

(An earlier draft of this change used fractional multipliers —
0.25x/0.5x/0.75x/1.25x/2.5x — chosen to land close to the OLD monthly-
revenue dollar payouts. Feedback afterward asked for the current, cleaner
1x/2x/4x/8x/15x set instead, which pays out noticeably more per business
than either the original monthly scheme or that first fractional draft —
a deliberate richer jackpot, not an oversight.)

Verified by extending the existing `test_business_exits1.mjs` (now also
checking `annualIncome === income × 12` and that `payout` is computed off
the annual figure — both checks are parametric against whatever
`BUSINESS_EXIT_MULTIPLIER_WEIGHTS` currently holds, so they kept passing
unmodified across the mid-round multiplier-set change) and the Playwright
suite (`test_ui_round3.js` confirms the offer modal's copy says "annual
revenue" with a `$/yr` figure and never says "monthly revenue";
`test_ui_business_exit.js`'s existing full-game exit coverage was updated
to detect the new message wording). The existing
`test_business_exit_decision.mjs` needed no changes — it exercises
accept/decline against a directly-injected offer object rather than
deriving one from the multiplier math, so it stayed valid across the
switch.

## Marketing campaigns are capped relative to real business-building

**The bug.** Marketing was the one upgrade track with no cap at all. The
reasoning at the time was that each campaign costs real cash and fades after
`MARKETING_BOOST_MONTHS`, so it would price itself out. It didn't. Because a
campaign's boost is a *percentage of current income*, and because a buyout
offer is a multiple of **annual** revenue (see "Buyout offers are now a
multiple of annual revenue, not monthly"), a player sitting on a cash pile
could stack campaign after campaign on one business, spike its revenue far
past anything the capped tracks allow, and then cash out a buyout priced off
that inflated number. Unbounded input, multiplied output — the single biggest
source of runaway wealth in the game, and reported as game-breaking.

**The fix.** Marketing is now capped *relative to* how much real building has
been done on that business, rather than by an absolute number:

```
campaigns allowed = max(MARKETING_FREE_CAMPAIGNS,
                        MARKETING_CAMPAIGNS_PER_UPGRADE × (Sales + Ops + R&D))
                  = max(2, 2 × other upgrades)
```

So 2 R&D + 3 Ops + 1 Sales = 6 upgrades → 12 campaigns; 3 upgrades → 6; a
brand-new business with nothing else bought → 2, so it can still advertise at
all. Counted **per business**, which is the level every other cap already
works at, and applied identically to robots — `game/aiEngine.js` builds its
upgrade candidates through `canUpgradeTrack()`, so no separate AI change was
needed and no amount of bot cash can push past the limit.

Two details worth knowing:

- **Expired campaigns do not free up room.** The counter
  (`business.marketingCount`) is a lifetime tally, never decremented when a
  boost expires. Letting expired campaigns free up headroom would just
  restore the same exploit on a slower clock.
- **The starting 2 are the same 2 the first upgrade would have earned** —
  it's `max(…)`, not `2 + 2 × n`. That means a brand-new business that has
  burned both free campaigns needs *two* other upgrades before the next
  campaign unlocks, not one. Rather than paper over that,
  `upgradesNeededForNextCampaign()` computes the honest number and both the
  error toast and the in-modal note quote it ("Buy 2 more Sales, Operations,
  or R&D upgrades to unlock more"), so the advice a player is given is always
  true.

In the portfolio, Marketing now shows a **"📣 Campaigns 2/6"** chip alongside
the existing Sales/Ops/R&D level chips — turning red, with an explanatory
line, once it's exhausted. Each campaign's log entry also reports how many
are left.

A game saved before this change with, say, nine stacked campaigns isn't
retroactively punished — `marketingCampaignsUsed()` falls back to the recorded
boost count, `marketingRemaining()` floors at 0, and that business is simply
frozen out of further campaigns.

## Hold-to-repeat now works on the business investment buttons too

"Hold Buy/Sell to go faster" already existed in the asset shop
(`hooks/useHoldRepeat.js`) but had never been wired to the four business
upgrade buttons inside the player portfolio, so growing a business to Sales
Lv3 + Ops Lv3 meant six separate round-trips through the modal. Each upgrade
button is now its own `UpgradeButton` component (a hook can't be called in a
loop) using the same hook: a tap buys one, a hold auto-repeats and
accelerates.

The `canFire()` guard is re-read before every repeat tick, so a hold stops
cleanly the instant the track hits its cap or the cash runs out instead of
hammering an action that would only produce an error toast — verified in the
browser: holding Operations bought exactly 3 levels and stopped, and holding
Marketing afterwards bought exactly the 6 campaigns those 3 upgrades had just
unlocked, then stopped.

"📚 Learn Skill" got the same treatment. **"🚀 Start Business" deliberately
did not** — it opens the full-screen launch celebration below, and
auto-repeating that would stack popups nobody asked for.

One related change: `handleUpgrade` no longer plays its own `click` sound. An
upgrade already gets a sound from the log entry it produces
(`hooks/useGameSounds.js` maps `businessUpgrade` → the level-up chime), and
at repeat speed a second layered click became noise.

## Bot player cards say "View businesses"

A robot's card opens the same portfolio modal, but read-only — so its button
now reads **"🔍 View businesses"** instead of "⚙️ Invest in your
businesses!", which is still what a human player's own card says. The
business-health warnings ("📉 A business is losing money — reinvest now!")
are likewise a nudge aimed at the *owner*, so they no longer appear on a
bot's card; a robot's neglected business is the robot's problem, and flagging
it there read as something the player was supposed to fix.

## The Piggy Bank pays interest

The Piggy Bank used to be purely price-only: it held its value through a
storm and did nothing else, which made "saving" feel like a punishment rather
than a real, if unexciting, strategy. It now pays interest every month:

- **0.1%–0.5% of what's parked in it**, monthly — deliberately tiny, so it
  never competes with a business or a rental. That's the lesson, not a
  balance oversight: savings are safe and slow.
- **Roughly a 12% chance of a better month** at 1.2%–3%, standing in for a
  bank's occasional bonus or promo rate. When it happens *and* somebody at
  the table actually holds Piggy Banks, it's called out in the event log with
  the real rate quoted.

Mechanically this generalizes rather than special-cases: an asset opts in with
an `interestBearing: true` flag in `gameConfig.js`, and `perUnitIncome()`
gains one branch that pays `price × thisMonth'sRate`. Because it's driven off
the asset's *live* price rather than a fixed amount, what's stored per month
is the **rate**, not a dollar figure.

`rollWeatherIncomeAmounts()` is accordingly renamed
**`rollMonthlyIncomeAmounts()`** — it now rolls both the weather-driven
per-unit amounts (Lemonade Stand) and the interest rates, under
`interestRates[assetId]` / `interestBonus[assetId]`. The state field it
writes to keeps its old name (`weatherIncomeAmounts`) on purpose: renaming it
would strand every game already saved in `localStorage`.

The rate is drawn on the **environment** stream (`game/rng.js`), like the
weather — one bank, one rate, shared by everyone at the table and identical
for everyone playing the same Daily Challenge. The bonus coin-flip and both
candidate rates are drawn unconditionally in a fixed order, so the stream's
position can never depend on which branch was taken (the same discipline
`game/businessExits.js` follows).

The asset shop and portfolio no longer label the Piggy Bank "price only, no
monthly income" — they show this month's rate and the per-unit cash it works
out to. Only the Treasure Chest is genuinely price-only now.

## An in-game rulebook

A **📖 Rulebook** button now sits directly beside the 🏆 leaderboard button on
the board, so the full rules are one tap away at any point in a game — plus
the same button on the setup screen, for reading before starting.
`components/RulebookModal.jsx` renders ten tabbed sections: the goal, how a
turn works, where money comes from, what you can buy, starting a business,
growing a business, neglect and decline, buyout offers, the weather, badges,
and five closing strategy tips.

The important design decision is that **every number in it is read live from
`gameConfig.js`** rather than typed out. `data/rulebook.js` is a *builder*
(`buildRulebook({ difficultyId, scenarioId })`) that returns the rulebook as
plain data — paragraphs, lists, and two-column reference rows — computed from
the actual constants and from the current game's difficulty and scenario. A
player reading the rulebook mid-game sees the figures actually in play, and
retuning any constant re-renders the rulebook with the new value on the next
build. It cannot drift out of sync with the rules it describes, which a
hand-written rules page inevitably would.

## A startup launch celebration

When a **human** player starts a business, the game now pauses on a
celebration: "*<Player>*'s startup launches!", an illustrated storefront
matched to the business's name, the passive cash it will pay every month, a
one-line explanation of what passive income actually means, and a burst of
fireworks (reusing `Fireworks.jsx` and the `fireworks` + `cheering` sounds
from the game-over fanfare).

It's a full-stop modal rather than a toast on purpose: starting a business is
the single most expensive decision in the game — cash *and* a skill token —
and it's the moment the "passive income" idea the whole game is teaching
becomes concrete. Worth a beat of attention rather than a line that scrolls
past in the event log. Robots don't trigger it; a bot starting its fourth
business shouldn't stop the table.

**The artwork** comes from `game/businessArt.js`, which reads the *trade* out
of a business's randomly-generated name ("Auntie Betty's **Bakery**", "The
Zippy Koala **Rock Collecting Club**") and returns a hero emoji, two
supporting props, and a gradient. Emoji rather than image files because the
game ships as a static bundle with no image assets and no network calls, and
the rest of the UI is already emoji-first — a keyword lookup gives all 500
names a genuinely relevant picture with zero bytes of art to load.

Matching is longest-keyword-first, in two tiers: specific trades first, then
generic fallbacks. Two tiers are necessary because "most specific wins" and
"longest keyword wins" disagree exactly there — "Cookie Company" would match
the 7-letter generic `company` over the 6-letter specific `cookie`, and
"Kayak Rental" the 6-letter `rental` over the 5-letter `kayak`. A test asserts
that **all 500 names** resolve, and that **none** falls through to the generic
storefront.

State-wise the reducer records `state.pendingLaunch` on a human
`START_BUSINESS` and clears it on `ACK_STARTUP_LAUNCH` — the engine records
*what* to celebrate, the UI decides *how*. The business is read back out of
the result state rather than rebuilt, so the name and income shown are exactly
the ones `actions.js` rolled.

## Verification for this round

`scripts/test-update.mjs` (run it with
`node --import ./scripts/register-loader.mjs scripts/test-update.mjs` — the
loader hook lets plain Node resolve the app's extensionless imports) exercises
the **actual exported engine functions**, never a re-implementation of the
rule under test. 20 checks covering:

- the campaign allowance at 0 / 3 / 6 other upgrades, including the user's
  worked example (2 R&D + 3 Ops + 1 Sales → 12);
- that expired campaigns don't free up room, and that a pre-cap save is
  frozen rather than punished;
- that `upgradesNeededForNextCampaign()`'s advice is *true* — buying that
  many other upgrades genuinely re-opens Marketing, and buying one fewer
  doesn't;
- that a blocked upgrade doesn't charge the player;
- that a cash-loaded robot, run for 40 turns, never exceeds the cap;
- the hold-to-repeat guard contract (the repeat loop terminates exactly at
  each track's cap);
- interest rates always landing in the normal or bonus band across 3,000
  rolled months, bonuses occurring at roughly the configured rate, interest
  scaling with the live price, and interest actually reaching a saver's
  payday;
- the bonus-month callout firing for a saver and staying silent when nobody
  at the table holds any;
- all 500 business names resolving to art, and specific trades beating
  generic words;
- a human launch queuing `pendingLaunch` and a robot launch not.

Also verified in a real browser (Playwright against the production build):
the rulebook opens and tabs from both screens, the launch modal renders with
matching art and fireworks, bot cards read "View businesses", the Piggy Bank
shows its live rate in the shop and portfolio, holding Operations buys exactly
3 levels and stops, holding Marketing afterwards buys exactly the 6 unlocked
campaigns and stops, and 12 full months play through with no console errors.

## An always-available upkeep campaign (the decline deadlock)

The campaign cap above created a problem the cap itself couldn't solve.
Buying *any* upgrade resets a business's decline clock — but Sales, Ops and
R&D all cap permanently, so a fully-built business (3/3 Sales, 3/3 Ops, 2/2
R&D) that had also spent its 16 earned campaigns would have **no legal
purchase left that counts as tending it**. The player's best business would
then decline forever with no remedy: strictly worse than the exploit the cap
was closing.

So regardless of the allowance, every business can always run
`MARKETING_UPKEEP_CAMPAIGNS_PER_MONTH` (currently 1) campaign per month, at
full price. Two details make this safe rather than a loophole:

- **It's per month, not per purchase.** The exploit was stacking an unbounded
  number of campaigns inside a *single turn* to spike revenue right before a
  buyout. One per month can't do that: since a campaign lasts
  `MARKETING_BOOST_MONTHS`, upkeep alone can never have more than three boosts
  live at once, no matter how much cash is on the table. There's a test that
  hammers 50 purchase attempts in one month and asserts exactly one lands,
  and another that walks 24 months and asserts the live-boost count never
  exceeds `MARKETING_BOOST_MONTHS`.
- **It doesn't spend earned allowance.** Upkeep stamps its own
  `lastMarketingUpkeepMonth` rather than incrementing `marketingCount`, so it
  never eats headroom the player worked for by buying Sales/Ops/R&D.

Robots get it too — `aiEngine.js` builds its candidates through
`canUpgradeTrack()`, which now takes `month` — so a bot's fully-built business
isn't the one thing at the table that can't be kept healthy.

In the UI the Marketing button gains a small "UPKEEP" tag when that's what the
next purchase would be, the campaigns chip reads "📣 Campaigns 2/2 +1 upkeep",
and the explanatory note distinguishes "you've used this month's upkeep" (temporary,
comes back next month) from "you're out of campaigns" (needs another upgrade)
— the earlier wording would have read as permanent in both cases.

Note this does mean upkeep boosts can slightly inflate a buyout offer, since
`rollBusinessExit()` values a business on `businessMonthlyIncome()` including
active boosts. That's bounded at three concurrent campaigns' worth and can't
be spiked on demand, which is the whole difference from the original bug.

## Play speed: a slider, and robots that move one step at a time

Two changes that only make sense together.

**The problem.** A robot turn resolved as a single burst — the whole turn ran
in one `RUN_AI_TURN` dispatch, so four decisions and their four log lines all
appeared in the same frame, 700ms after the previous player finished. Fast,
but impossible to read: you couldn't see that the bot bought a Tree House
*because* the weather turned sunny, or that its income jumped *because* it ran
a campaign. Cause and effect were simultaneous.

**Stepping.** `aiEngine.js` gained `runAiStep()` — identical decision logic to
`runAiTurn()` (same candidate builder, same strategy weights, same
mistake-chance roll); the only difference is where the loop lives. The reducer
drives it through a new `RUN_AI_STEP` action, tracking `aiTurnSteps` /
`aiTurnDone` on state (both reset on every hand-off), and `useGame.js` waits a
beat between dispatches. Each decision now lands on its own beat with its own
log line and its own sound. `RUN_AI_TURN` is unchanged and still exported —
the VentureMaker Arena's server-side replay has no UI to pace and wants a
whole turn in one call.

Because a shark-level bot can legitimately take up to 32 moves in one turn,
each successive move in the *same* turn comes a little faster than the last
(`STEP_ACCELERATION`, floored) — a typical 4-6 move turn barely notices, and a
20-move late-game turn stays watchable without becoming a wait.

**The slider.** `game/playSpeed.js` is a framework-free settings store (same
shape as the audio/music ones) with five notches — 🐢 Storyteller, 🐌 Relaxed,
🚶 Steady, 🏃 Brisk, ⚡ Zippy — each specifying four real millisecond values
rather than a multiplier over one base number, because the delays don't scale
together evenly: a slow setting wants a *lot* of room between a robot's
individual actions but only a little extra between turns, or the handoff
starts to feel broken rather than deliberate.

`SpeedControl.jsx` sits in the board header (not just on setup — the whole
point is slowing the table down the moment it outruns you, mid-turn if need
be), on the setup screen, and on the landing page. It's a real
`<input type="range">` so "slow it down a couple of notches" is one drag and
it's keyboard/screen-reader accessible for free. Nothing about speed lives in
game state, so it never touches the save file and applies to whatever game is
running; `useGame`'s effect re-reads the current speed on every state change,
so a mid-turn change takes effect on the very next beat.

The default is **Steady**, one notch slower than the old pace ("Brisk" is
documented as closest to how the game used to play) — a new player is the one
who most needs to see cause and effect, and anyone who finds it slow moves the
slider in one click.

Measured in a real browser: in an identical 5-second window after handing off
to the robots, Storyteller produced 3 log entries and Zippy produced 20.

## A spotlight that follows the turn

The active player's card used to get a static teal ring; now a single
absolutely-positioned spotlight element sits inside the players grid and is
CSS-transitioned onto whichever card is active, so as the turn passes you
*see* the light travel from one player to the next. Its travel time comes from
the current play speed, so it's always settling in just as the new turn
begins, never still sliding.

Its position is **measured** from the live DOM rather than computed: the grid
is `auto-fit`/`minmax` and reflows between 1, 2 and 3 columns, so there's no
layout formula to copy that wouldn't silently drift from the CSS. A
`ResizeObserver` watches the container and every card, so it stays correct
through window resizes and through a card growing on its own (a new badge
chip, a longer net-worth number). `setRect` is guarded by a same-rect check —
measuring on every render and storing a fresh object unconditionally would
re-trigger the measure effect and spin forever. The first placement skips the
animation so the light doesn't fly in from the board's corner on load.

The active card's own ring was removed so the two don't fight each other; the
card keeps only its warm background.

## A landing page

`LandingScreen.jsx` is now the first thing anyone sees, ahead of the setup
screen (`App.jsx` holds a small `preGameScreen` state — deliberately local UI
state, since no game exists yet). It carries:

- **An animated hero illustration** (`HeroGraphic.jsx`) — one inline SVG,
  hand-drawn rather than a bundled image, because the game ships no raster art
  and makes no network requests (classroom wifi, offline after first load), an
  SVG stays crisp from a phone to a projector, and every colour is a theme
  token so the hero reskins with the unlockable board themes. What it shows is
  the game's actual loop rather than generic business clip-art: weather
  overhead driving the market, a rising net-worth line, three storefronts, and
  coins stacking up.
- **The three-beat pitch** — buy things that grow, start real businesses, ride
  the weather — with figures read from `gameConfig.js` so the page can't
  advertise rules the game no longer has.
- **The top 5 leaderboard**, with a link to the full one.
- **A self-scrolling rulebook window** (`RulebookTicker.jsx`) so a newcomer
  who hasn't clicked anything yet still sees real rules drifting past. It's
  flattened from the same `buildRulebook()` data the rulebook modal renders,
  so its numbers are equally live. Auto-scroll pauses on hover, focus or
  pointer-down so it never fights someone who has started reading, and stops
  entirely under `prefers-reduced-motion`.
- **Two ways in.** ⚡ **Quick Play** starts immediately with everything rolled
  (`game/quickPlay.js`: scenario, difficulty, 1-2 opponents, each robot's
  personality and skill), and 🎛️ **Customize a game** opens the existing setup
  screen, which gained a ← Back button. Both call the same `onStart`, so
  there's one code path into a game and the two can't drift apart.
- **A "▶️ Watch how to play" link**, driven by `HOW_TO_PLAY_VIDEO_URL` in
  `gameConfig.js`. That constant is deliberately **empty** — the button hides
  itself entirely while it's blank, so nothing ever ships as a dead link. Drop
  a URL in and the button appears on the next build; no other code changes.

The opening theme now starts on the landing page rather than on setup.
`playMusicTrack` is a no-op when the same track is already playing, so moving
Landing → Customize → Back doesn't restart the song mid-phrase, and ending a
game returns to the landing page rather than dropping the player into a form.

One layout bug surfaced and was fixed here: the setup screen's absolutely-
positioned corner toolbar grew wide enough (with the speed slider added) to
overlap and swallow clicks meant for the content beneath it — caught by
Playwright, which reported the mute button intercepting pointer events for the
Back button. `.vf-setup__inner` now has top padding that clears it, with more
on narrow screens where the toolbar wraps.

## Verification for this round

`npm run test` now runs **33 checks**. New ones cover:

- the upkeep campaign: that a fully-maxed business is still tendable, that
  upkeep resets the decline clock without spending allowance, that 50 attempts
  in one month yield exactly one campaign, that 24 months of upkeep never
  exceed `MARKETING_BOOST_MONTHS` live boosts, and that a robot uses upkeep
  across 12 months without ever exceeding its earned allowance;
- the speed table: every delay strictly decreasing across the notches, none of
  them zero (a zero would restore the burst), the default sitting mid-slider
  and slower than "Brisk", and an unknown/corrupt saved id falling back;
- `runAiStep` taking exactly one action per call with exactly one log entry
  each, the stepped path terminating on its own and spending like the
  whole-turn path, `END_TURN` clearing the step bookkeeping, and `RUN_AI_STEP`
  being a no-op on a human seat;
- Quick Play across 400 rolls: always a valid setup, opponent count in range,
  one config per robot, and — since "randomized" has to mean it actually
  varies — every scenario and every difficulty reachable; plus one roll
  actually starting a game, with the name trimmed and no two robots sharing a
  personality.

In a real browser against the production build: the landing page renders with
no console errors (empty and populated leaderboard), Quick Play reaches the
board in ~250ms, the spotlight is pixel-aligned to the active card and
realigns after a hand-off, robot log entries arrive one at a time rather than
in a burst, the speed slider produces a measured 3-vs-20 entry difference over
the same 5 seconds, Customize → Back works, and the upkeep campaign goes
through once and is then correctly refused with the "already run this month's
upkeep campaign" wording.
