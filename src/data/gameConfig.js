// ============================================================================
// VentureFlow — GAME CONFIG
// ----------------------------------------------------------------------------
// Single source of truth for every tunable number, asset, weather stage,
// fortune-card deck, and badge in the game. Balance the whole game by
// editing THIS FILE — nothing else needs to change.
//
// This file is pure data (plus small inline arrays). The rules that read it
// live in src/game/*.js. Add a new asset, card, or badge here and it will
// automatically show up in the shop / decks / achievement list.
// ============================================================================

// ---------------------------------------------------------------------------
// Core economy
// ---------------------------------------------------------------------------
export const GAME_LENGTH_MONTHS = 24;

export const STARTING_CASH = 500;
export const MONTHLY_ALLOWANCE = 150;
export const STARTING_SKILL_TOKENS = 1;

export const SKILL_COST = 100;

export const BUSINESS_COST = 300;
export const BUSINESS_SKILL_COST = 1;
export const BUSINESS_INCOME_MIN = 30;
export const BUSINESS_INCOME_MAX = 70;

// Prices can never drift below this (keeps the game from ever showing $0 or
// negative prices).
export const MIN_ASSET_PRICE = 5;

// ---------------------------------------------------------------------------
// Assets — the four buyable "things that grow"
// ---------------------------------------------------------------------------
// kind is used by the AI to reason about risk, and by the UI for badges/labels.
// volatility is the max monthly random swing (as a fraction) layered on top
// of the current weather's marketDrift.
export const ASSETS = [
  {
    id: 'piggy',
    name: 'Piggy Bank',
    icon: '🐷',
    tagline: 'Safe & steady',
    kind: 'safe',
    basePrice: 50,
    volatility: 0.02,
    rentPerMonth: 0,
    riskLabel: 'Very Safe',
  },
  {
    id: 'lemonade',
    name: 'Lemonade Co.',
    icon: '🍋',
    tagline: 'Bounces around',
    kind: 'bouncy',
    basePrice: 75,
    volatility: 0.15,
    rentPerMonth: 0,
    riskLabel: 'Medium Risk',
  },
  {
    id: 'treehouse',
    name: 'Tree House',
    icon: '🏠',
    tagline: 'Pays you rent every month',
    kind: 'rental',
    basePrice: 250,
    volatility: 0.09,
    rentPerMonth: 40,
    riskLabel: 'Low-Medium Risk',
  },
  {
    id: 'treasure',
    name: 'Treasure Chest',
    icon: '💎',
    tagline: 'Big risk, big reward',
    kind: 'risky',
    basePrice: 100,
    volatility: 0.40,
    rentPerMonth: 0,
    riskLabel: 'High Risk',
  },
];

// ---------------------------------------------------------------------------
// Weather / market cycle — hidden-timer state machine
// ---------------------------------------------------------------------------
// Players always see the CURRENT stage, but never the countdown. Each stage
// picks a random duration (in months) between minMonths and maxMonths when
// it begins, then advances to the next stage in WEATHER_ORDER (looping).
//
// marketDrift is the average monthly price drift applied to every asset
// (before each asset's own volatility noise). deckWeight biases which
// fortune-card deck gets drawn from that month.
export const WEATHER_ORDER = [
  'sunnyBoom',
  'cloudyPeak',
  'rainyDip',
  'stormyBust',
  'rainbowRebound',
];

export const WEATHER_STAGES = {
  sunnyBoom: {
    id: 'sunnyBoom',
    name: 'Sunny Boom',
    icon: '☀️',
    blurb: 'Everything is growing fast!',
    minMonths: 2,
    maxMonths: 4,
    marketDrift: 0.05,
    deckWeight: { opportunity: 0.75, setback: 0.25 },
  },
  cloudyPeak: {
    id: 'cloudyPeak',
    name: 'Cloudy Peak',
    icon: '⛅',
    blurb: 'Things are still good, but slowing down.',
    minMonths: 2,
    maxMonths: 3,
    marketDrift: 0.015,
    deckWeight: { opportunity: 0.6, setback: 0.4 },
  },
  rainyDip: {
    id: 'rainyDip',
    name: 'Rainy Dip',
    icon: '🌧️',
    blurb: 'Prices are dipping a little.',
    minMonths: 2,
    maxMonths: 3,
    marketDrift: -0.02,
    deckWeight: { opportunity: 0.4, setback: 0.6 },
  },
  stormyBust: {
    id: 'stormyBust',
    name: 'Stormy Bust',
    icon: '⛈️',
    blurb: 'Rough weather for money — careful out there!',
    minMonths: 2,
    maxMonths: 4,
    marketDrift: -0.05,
    deckWeight: { opportunity: 0.25, setback: 0.75 },
  },
  rainbowRebound: {
    id: 'rainbowRebound',
    name: 'Rainbow Rebound',
    icon: '🌈',
    blurb: 'Things are bouncing back!',
    minMonths: 2,
    maxMonths: 3,
    marketDrift: 0.035,
    deckWeight: { opportunity: 0.65, setback: 0.35 },
  },
};

// ---------------------------------------------------------------------------
// Fortune card decks
// ---------------------------------------------------------------------------
// Every card carries a kid-friendly "why" — the money lesson behind what
// just happened. Effect kinds understood by the engine (src/game/decks.js):
//   cash          { amount }                flat dollars, + or -
//   cashPercent   { percent }                % of current net worth, + or -
//   assetPrice    { assetId | 'all', percent } bumps a price (or all prices)
//   skillToken    { amount }                 + or - skill tokens (floors at 0)
//   passiveBonus  { amount }                 permanent $/mo passive income, + or -
export const OPPORTUNITY_DECK = [
  { id: 'lemonade-rush', title: 'Lemonade Rush', icon: '🍋', flavor: 'A summer heat wave has everyone thirsty!', why: 'When lots of people want the same thing at once, businesses that sell it can do great — that’s called demand.', effect: { type: 'assetPrice', assetId: 'lemonade', percent: 12 } },
  { id: 'piggy-interest', title: 'Piggy Bank Interest', icon: '🐷', flavor: 'Your piggy bank paid you a little bonus for saving.', why: 'Banks pay you a small reward called interest just for keeping your money safely saved with them.', effect: { type: 'cash', amount: 25 } },
  { id: 'birthday-money', title: 'Birthday Money', icon: '🎂', flavor: 'Grandma sent you birthday cash!', why: 'Gifts are a fun way money can come to you — you still get to choose how to save or spend it wisely.', effect: { type: 'cash', amount: 80 } },
  { id: 'treasure-found', title: 'Treasure Found', icon: '💎', flavor: 'An old treasure map actually led somewhere real!', why: 'Sometimes risky investments pay off big — that extra reward is why people take the chance.', effect: { type: 'assetPrice', assetId: 'treasure', percent: 25 } },
  { id: 'treehouse-tourists', title: 'Tree House Tourists', icon: '🏠', flavor: 'Kids from the whole neighborhood want to rent your tree house for a party!', why: 'Owning something useful, like property, can earn you money from people who want to use it.', effect: { type: 'cash', amount: 50 } },
  { id: 'skill-scholarship', title: 'Skill Scholarship', icon: '📚', flavor: 'You won a free workshop spot!', why: 'Learning new skills doesn’t always cost money — sometimes an opportunity is handed right to you.', effect: { type: 'skillToken', amount: 1 } },
  { id: 'stand-review', title: 'Lucky Stand Review', icon: '🌟', flavor: 'A local newspaper wrote a nice story about your lemonade stand!', why: 'A good reputation brings more customers, which means more money coming in.', effect: { type: 'assetPrice', assetId: 'lemonade', percent: 10 } },
  { id: 'garage-sale', title: 'Garage Sale', icon: '🧺', flavor: 'You sold some old toys you didn’t need anymore.', why: 'Selling things you don’t use is a smart, easy way to earn a little extra cash.', effect: { type: 'cash', amount: 40 } },
  { id: 'market-rally', title: 'Market Rally', icon: '📈', flavor: 'The whole town is feeling good about spending and investing!', why: 'When everyone feels confident about the future, prices often rise together — that’s a rally.', effect: { type: 'cashPercent', percent: 5 } },
  { id: 'bright-idea', title: 'Bright Idea Bonus', icon: '💡', flavor: 'Your business found a clever way to save money.', why: 'Being creative and solving problems is one of the best ways a business can grow stronger.', effect: { type: 'passiveBonus', amount: 15 } },
  { id: 'referral', title: 'Neighbor’s Referral', icon: '🤝', flavor: 'A happy customer told all their friends about your tree house.', why: 'Word of mouth — people telling their friends — is free advertising that helps things grow.', effect: { type: 'cash', amount: 45 } },
  { id: 'rainbow-bonus', title: 'Rainbow Bonus', icon: '🌈', flavor: 'Everything is looking bright for your investments today.', why: 'After hard times, markets often bounce back — that’s why patient savers often win in the end.', effect: { type: 'assetPrice', assetId: 'all', percent: 6 } },
];

export const SETBACK_DECK = [
  { id: 'tooth-trouble', title: 'Tooth Trouble', icon: '🦷', flavor: 'Oops — a trip to the dentist wasn’t free!', why: 'Surprises happen to everyone. That’s why it’s smart to always keep a little cash saved for emergencies.', effect: { type: 'cash', amount: -40 } },
  { id: 'lemonade-spill', title: 'Lemonade Spill', icon: '🍋', flavor: 'A sudden storm ruined your lemonade stand’s ingredients.', why: 'Bouncy businesses can lose value fast — but they can also bounce back. That’s the risk of volatility.', effect: { type: 'assetPrice', assetId: 'lemonade', percent: -15 } },
  { id: 'treasure-sinks', title: 'Treasure Chest Sinks', icon: '💎', flavor: 'The market got spooked and treasure prices dropped fast.', why: 'Risky investments can lose a lot of value quickly — never put in money you can’t afford to lose.', effect: { type: 'assetPrice', assetId: 'treasure', percent: -30 } },
  { id: 'broken-toy', title: 'Broken Toy', icon: '🧸', flavor: 'You accidentally broke something and had to pay to fix it.', why: 'Unexpected costs pop up in life — a little emergency savings helps you handle them without stress.', effect: { type: 'cash', amount: -35 } },
  { id: 'roof-repair', title: 'Rainy Roof Repair', icon: '🏠', flavor: 'Your tree house needs a new roof after the storm.', why: 'Owning property means sometimes paying for repairs — that’s part of the cost of owning things.', effect: { type: 'cash', amount: -50 } },
  { id: 'missed-bus', title: 'Missed the Bus', icon: '🚌', flavor: 'You had to pay for a ride after missing the bus.', why: 'Small costs add up. Planning ahead helps you avoid paying extra for surprises.', effect: { type: 'cash', amount: -20 } },
  { id: 'market-jitters', title: 'Market Jitters', icon: '📉', flavor: 'Everyone got a little nervous about spending and saving.', why: 'When people worry about the economy, prices can dip for a while — that’s normal, and usually temporary.', effect: { type: 'cashPercent', percent: -5 } },
  { id: 'slow-season', title: 'Slow Season', icon: '🍂', flavor: 'Business has been quieter than usual this month.', why: 'Not every month is a big one for a business — income can go up and down, and that’s okay.', effect: { type: 'passiveBonus', amount: -10 } },
  { id: 'library-fee', title: 'Lost Library Book', icon: '📖', flavor: 'You had to pay a fee for a book you couldn’t find.', why: 'Taking care of your things (and keeping track of them) helps you avoid paying for mistakes.', effect: { type: 'cash', amount: -15 } },
  { id: 'piggy-borrow', title: 'Piggy Bank Piggy-back', icon: '🐷', flavor: 'Your little sibling “borrowed” a few coins without asking!', why: 'Even safe savings can shrink a little sometimes — it helps to check in on your money now and then.', effect: { type: 'cash', amount: -10 } },
  { id: 'storm-damage', title: 'Storm Damage', icon: '⛈️', flavor: 'A big storm shook up the whole market.', why: 'Stormy times can drag prices down across the board, even for careful savers.', effect: { type: 'assetPrice', assetId: 'all', percent: -8 } },
  { id: 'skill-slipup', title: 'Skill Slip-up', icon: '📚', flavor: 'You lost focus and forgot part of what you learned!', why: 'Skills need practice — it’s totally normal to have setbacks while you’re still learning.', effect: { type: 'skillToken', amount: -1 } },
];

// ---------------------------------------------------------------------------
// Badges / achievements — extensible registry
// ---------------------------------------------------------------------------
// `kind` maps to a generic checker in src/game/badges.js. Add a badge here
// with an EXISTING kind and it just works with zero logic changes. New kinds
// need one small checker added in badges.js. `kind` values also double as
// the stable identifier synced to the future VentureScouts badge service.
export const BADGES = [
  {
    id: 'moneyGrower',
    name: 'Money Grower',
    icon: '🌱',
    description: 'Earn $100+ per month in passive income',
    kind: 'passiveIncomeAtLeast',
    value: 100,
  },
  {
    id: 'boss',
    name: 'Boss',
    icon: '🚀',
    description: 'Own 2 or more businesses',
    kind: 'businessCountAtLeast',
    value: 2,
  },
  {
    id: 'saver',
    name: 'Saver',
    icon: '🐷',
    description: 'Own 5 or more Piggy Banks',
    kind: 'assetHoldingAtLeast',
    value: 5,
    assetId: 'piggy',
  },
];

// ---------------------------------------------------------------------------
// Player avatars for setup screen
// ---------------------------------------------------------------------------
export const PLAYER_AVATARS = ['🦊', '🐼', '🐸', '🦁', '🐨', '🐯'];
export const AI_NAMES = ['Robo', 'Chip', 'Byte'];

export const LOCAL_STORAGE_KEY = 'ventureflow-save-v1';
