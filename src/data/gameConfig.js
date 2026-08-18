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
// Difficulty presets — chosen at setup, controls the player challenge level
// ---------------------------------------------------------------------------
// Every player in the game (human or robot) starts from the same preset, so
// the challenge level is consistent across the whole table. Add a new
// preset here and it automatically shows up as a card on the setup screen —
// see components/SetupScreen.jsx.
export const DIFFICULTIES = [
  {
    id: 'easy',
    name: 'KidStuff',
    icon: '🌈',
    tagline: 'Extra cash to learn the ropes, stress-free.',
    startingCash: 800,
    monthlyAllowance: 220,
    startingSkillTokens: 2,
  },
  {
    id: 'medium',
    name: 'Middle of the Pack',
    icon: '⚖️',
    tagline: 'The classic VentureFlow challenge.',
    startingCash: 500,
    monthlyAllowance: 150,
    startingSkillTokens: 1,
  },
  {
    id: 'hard',
    name: 'Hard Knocks',
    icon: '🥊',
    tagline: 'A tight budget — every choice counts.',
    startingCash: 300,
    monthlyAllowance: 90,
    startingSkillTokens: 0,
  },
];

export const DEFAULT_DIFFICULTY_ID = 'medium';

export function getDifficulty(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES.find((d) => d.id === DEFAULT_DIFFICULTY_ID);
}

// ---------------------------------------------------------------------------
// Core economy
// ---------------------------------------------------------------------------
export const GAME_LENGTH_MONTHS = 24;

// These reflect the "Middle of the Pack" difficulty and exist as a fallback
// default — e.g. for a game saved before difficulty presets existed. Every
// actual new game reads its numbers from the chosen DIFFICULTIES entry
// instead (see game/newGame.js).
const DEFAULT_DIFFICULTY = getDifficulty(DEFAULT_DIFFICULTY_ID);
export const STARTING_CASH = DEFAULT_DIFFICULTY.startingCash;
export const MONTHLY_ALLOWANCE = DEFAULT_DIFFICULTY.monthlyAllowance;
export const STARTING_SKILL_TOKENS = DEFAULT_DIFFICULTY.startingSkillTokens;

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
    // `mood` is read by game/aiEngine.js's isGoodWeather() (boom/peak/rebound
    // = good, everything else = retreat) and by game/chatEngine.js's bot
    // weather commentary — keep it in sync with GOOD_MOODS in aiEngine.js.
    mood: 'boom',
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
    mood: 'peak',
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
    mood: 'dip',
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
    mood: 'bust',
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
    mood: 'rebound',
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
// Business names — whimsical names assigned when a player starts a business
// ---------------------------------------------------------------------------
// Instead of a generic "Business #1", each new business gets a random funny
// name from this pool (see game/actions.js startBusiness), preferring one the
// player hasn't already used this game. 500 entries is comfortably more than
// any single game will ever need (a 24-month game realistically supports a
// handful of businesses per player), so repeats within a game are rare and
// repeats across different players/games don't matter.
export const BUSINESS_NAMES = [
  "Auntie Betty's Bakery",
  "Auntie Bubba's Video Game Store",
  "Auntie Coco's Yo-Yo Shop",
  "Auntie Franklin's Candle Making",
  "Auntie Iggy's Pickle Shop",
  "Auntie Norbert's Face Painting",
  "Auntie Pippin's Hot Cocoa Stand",
  "Auntie Stan's Sunglasses Stand",
  "Auntie Vera's Sewing Shop",
  "Barnaby's Sizzle and Drizzle Muffin Shop",
  "Baron Bartholomew's Sunglasses Stand",
  "Baron Herman's Juggling Lessons",
  "Baron Wally's Video Game Store",
  "Bartholomew's Peppy Button Making",
  "Bartholomew's Twist and Shout Frisbee Golf Course",
  "Beau's Breezy Aquarium Supply",
  "Betty's Huff and Puff Video Game Store",
  "Betty's Speedy Pottery Studio",
  "Biscuit's Sassy Snow Cone Stand",
  "Bubba's Crunch and Munch Puppet Theater",
  "Bubba's Crunch and Munch Soup Kitchen",
  "Bubba's Goofy Aquarium Supply",
  "Bubba's Twist and Shout Bug Collecting Club",
  "Buttons' Bangs and Clangs Comic Shop",
  "Buttons' Chomp and Champ Candle Making",
  "Buttons' Sizzle and Drizzle Wagon Repair",
  "Captain Cornelius' Rock Polishing",
  "Captain Doodle's Candle Making",
  "Captain Flossie's Dumpling Shop",
  "Captain Jasper's Balloon Animals",
  "Captain Lester's Robot Building",
  "Captain Vera's Trampoline Park",
  "Chef Fifi's Stamp Collecting Shop",
  "Chef Nugget's Bonsai Studio",
  "Chef Rufus' Knitting Shop",
  "Chester's Bubbles and Bobbles Gutter Cleaning",
  "Chief Dottie's Rock Climbing Gym",
  "Chief Noodle's Gutter Cleaning",
  "Chief Ozzie's Firewood Delivery",
  "Chief Sprinkles' Seashell Shop",
  "Chief Vinnie's Pet Grooming",
  "Chomper's Breezy Fudge Shop",
  "Chomper's Snips and Snaps Bagel Shop",
  "Chomper's Wiggles and Giggles Jump Rope Lessons",
  "Chomper's Zips and Zaps Rock Climbing Gym",
  "Clara's Bangs and Clangs Firewood Delivery",
  "Clementine's Ribbits and Ripples Bug Collecting Club",
  "Clementine's Squeaks and Squawks Roller Rink",
  "Coach Doris' Window Washing",
  "Coach Dottie's Marble Shop",
  "Coach Fifi's Kayak Rental",
  "Coach Irwin's Coin Shop",
  "Coach Knox's Sled Rental",
  "Coach Nelly's Tech Support",
  "Coach Stan's Coin Shop",
  "Coach Ulric's Fence Painting",
  "Coco's Zips and Zaps Donut Shop",
  "Cornelius' Chirp and Chatter Birthday Party Planning",
  "Cornelius' Cranky Jump Rope Lessons",
  "Cornelius' Jolly Magic Show",
  "Cornelius' Snoozy Fudge Shop",
  "Cornelius' Wobble and Bobble Errand Running",
  "Count Cornelius' Snow Shoveling",
  "Count Jolene's Trading Card Shop",
  "Count Pippin's Tutoring",
  "Count Pudding's Taffy Pull",
  "Count Queenie's Mitten Shop",
  "Count Tallulah's Pogo Stick Repair",
  "Count Tater's Muffin Shop",
  "Count Wanda's Sock Puppet Theater",
  "Dame Biscuit's Doghouse Building",
  "Dame Peanut's Brownie Bakery",
  "Dame Vera's Cheese Shop",
  "Dexter's Buzz and Whirr Cupcake Bakery",
  "Dexter's Crunch and Munch Ice Skating Lessons",
  "Dexter's Ribbits and Ripples Tutoring",
  "Dexter's Silly Kite Flying Lessons",
  "Doc Fifi's Balloon Animals",
  "Doc Nelly's Popcorn Stand",
  "Doc Pickle's Grilled Cheese Truck",
  "Doc Wanda's Egg Roll Stand",
  "Doc Yolanda's Friendship Bracelet Shop",
  "Doodle's Fizz and Pop Candle Making",
  "Doodle's Hops and Skips Chalk Art Studio",
  "Doodle's Zippy Cookie Company",
  "Doris' Wonky Root Beer Stand",
  "Dottie's Bouncy Puzzle Shop",
  "Dottie's Chunky Cotton Candy Stand",
  "Dottie's Hops and Skips Pancake House",
  "Dottie's Puffs and Fluffs Gutter Cleaning",
  "Duchess Hazel's Pet Grooming",
  "Duchess Lolly's Marble Shop",
  "Duchess Lulu's Sticker Shop",
  "Duchess Norbert's Sidewalk Mural Painting",
  "Duchess Nugget's Tech Support",
  "Duchess Pearl's Window Washing",
  "Duchess Queenie's Kayak Rental",
  "Duke's Snips and Snaps Rock Collecting Club",
  "Duke's Wonky Skate Ramp Building",
  "Edwina's Clank and Clatter Treehouse Building",
  "Edwina's Scoop and Swirl Bike Repair",
  "Edwina's Sizzle and Drizzle Hot Cocoa Stand",
  "Edwina's Spiffy Doghouse Building",
  "Elmo's Grumpy Pizza Truck",
  "Elmo's Sassy Slime Shop",
  "Elmo's Squeaks and Squawks Button Making",
  "Eugene's Puffs and Fluffs Rock Climbing Gym",
  "Eugene's Sleepy Popsicle Cart",
  "Eugene's Snips and Snaps Pony Rides",
  "Fifi's Nuts and Bolts Bookstore",
  "Fifi's Twist and Shout Toy Library",
  "Fizzy's Sizzle and Drizzle Skate Ramp Building",
  "Fizzy's Snazzy Birdseed Shop",
  "Flossie's Breezy Scarf Knitting",
  "Flossie's Bubbles and Bobbles Muffin Shop",
  "Flossie's Chomp and Champ Fence Painting",
  "Flossie's Chomp and Champ Leaf Raking",
  "Flossie's Doodle and Noodle Tea House",
  "Flossie's Jazzy Umbrella Shop",
  "Flossie's Splish and Splash Pottery Studio",
  "Franklin's Bangs and Clangs Bookstore",
  "Franklin's Dizzy Sidewalk Mural Painting",
  "General Doodle's Computer Repair",
  "General Flossie's Fudge Shop",
  "General Jasper's Scavenger Hunt Planning",
  "General Nugget's Skateboard Shop",
  "General Otis' Board Game Cafe",
  "Gertie's Clank and Clatter Pet Grooming",
  "Gertie's Flip and Flop Balloon Animals",
  "Gertie's Sparkly Birdseed Shop",
  "Gladys' Bumpy Grilled Cheese Truck",
  "Gladys' Puffs and Fluffs Snowball Fight Coaching",
  "Gladys' Zippy Frisbee Golf Course",
  "Gordy's Rusty Mailbox Repair",
  "Gordy's Wobble and Bobble Ice Cream Shop",
  "Gordy's Wobble and Bobble Leaf Raking",
  "Grandma Coco's Umbrella Shop",
  "Grandma Jasper's Balloon Delivery",
  "Grandma Knox's Coffee Cart",
  "Grandma Xavier's Soup Kitchen",
  "Grandpa Biscuit's Model Train Shop",
  "Grandpa Dexter's Pottery Studio",
  "Grandpa Elmo's Balloon Delivery",
  "Grandpa Horace's Costume Shop",
  "Grandpa Mo's Pickle Shop",
  "Grandpa Petunia's Herb Garden",
  "Grandpa Petunia's Model Train Shop",
  "Grandpa Prudence's Smoothie Bar",
  "Grandpa Ruby's Soup Kitchen",
  "Grandpa Snicker's Map Making",
  "Grandpa Waddles' Errand Running",
  "Grandpa Wanda's Window Washing",
  "Gus' Doodle and Noodle Kite Shop",
  "Gus' Snips and Snaps Butterfly Garden",
  "Hank's Clank and Clatter Book Repair",
  "Hank's Cranky Pet Grooming",
  "Hank's Jingle and Jangle Craft Supply Shop",
  "Hank's Snap and Crackle Solar Panel Cleaning",
  "Hank's Zips and Zaps Face Painting",
  "Hattie's Chirp and Chatter Sandwich Shop",
  "Hattie's Hops and Skips Quilt Shop",
  "Hattie's Hops and Skips Trading Card Shop",
  "Hattie's Squeaks and Squawks Sandcastle Building",
  "Hazel's Giggly Pogo Stick Repair",
  "Hazel's Zips and Zaps Donut Shop",
  "Herman's Hops and Skips Hula Hoop Lessons",
  "Herman's Nifty Herb Garden",
  "Herman's Scoop and Swirl Scooter Repair",
  "Horace's Bangs and Clangs Cookie Company",
  "Horace's Chirp and Chatter Drone Racing",
  "Horace's Jingle and Jangle Bonsai Studio",
  "Ida's Silly Mitten Shop",
  "Ida's Speedy Puzzle Shop",
  "Iggy's Perky Tech Support",
  "Iggy's Puffs and Fluffs Snow Shoveling",
  "Iggy's Rusty Honey Shop",
  "Iggy's Squeaks and Squawks Umbrella Rental",
  "Iggy's Twist and Shout Pet Sitting",
  "Iggy's Zips and Zaps Pet Grooming",
  "Irwin's Wiggles and Giggles Tutoring",
  "Jasper's Chirp and Chatter Bike Repair",
  "Jolene's Bouncy Soup Kitchen",
  "Kermit's Flip and Flop Scooter Repair",
  "Kitty's Bouncy Pizza Truck",
  "Kitty's Chomp and Champ Umbrella Shop",
  "Knox's Sparkly Puppet Theater",
  "Lady Buttons' Sunglasses Stand",
  "Lady Jasper's Leaf Raking",
  "Lady Lolly's Firewood Delivery",
  "Lady Peanut's Bagel Shop",
  "Lady Sprinkles' Hat Shop",
  "Lady Tater's Dumpling Shop",
  "Lady Winnie's Sewing Shop",
  "Larry's Bangs and Clangs Slime Shop",
  "Larry's Breezy Friendship Bracelet Shop",
  "Larry's Crunch and Munch Sewing Shop",
  "Larry's Dizzy Candle Making",
  "Larry's Jingle and Jangle Pickle Shop",
  "Larry's Snap and Crackle Video Game Store",
  "Larry's Sniffs and Sniffles Pet Sitting",
  "Larry's Whirls and Twirls Weather Station",
  "Larry's Wiggly Gutter Cleaning",
  "Lester's Nuts and Bolts Toy Repair",
  "Lester's Spiffy Jump Rope Lessons",
  "Lolly's Snap and Crackle Model Train Shop",
  "Lolly's Whirls and Twirls Roller Rink",
  "Lord Bubba's Tech Support",
  "Lord Doodle's Chimney Sweeping",
  "Lord Hank's Sandcastle Building",
  "Lord Knox's Yo-Yo Shop",
  "Lord Lulu's Egg Roll Stand",
  "Lord Mabel's Seashell Shop",
  "Lord Myrtle's Hat Shop",
  "Lord Peanut's Firewood Delivery",
  "Lord Pickle's Umbrella Rental",
  "Lord Ruby's Seashell Shop",
  "Lord Ziggy's Trampoline Park",
  "Lulu's Buzz and Whirr Dumpling Shop",
  "Lulu's Flip and Flop Composting Service",
  "Lulu's Nifty Pogo Stick Repair",
  "Mabel's Peppy Fishing Guide Service",
  "Mabel's Silly Mitten Shop",
  "Mabel's Sizzle and Drizzle Jump Rope Lessons",
  "Madam Gertie's Model Train Shop",
  "Madam Gus' Ice Cream Shop",
  "Madam Horace's Llama Walking Tours",
  "Madam Kermit's Soup Kitchen",
  "Madam Lolly's Cookie Company",
  "Madam Petunia's Bug Collecting Club",
  "Madam Rusty's Rock Polishing",
  "Marbles' Fizz and Pop Sock Puppet Theater",
  "Marbles' Sizzle and Drizzle Cheese Shop",
  "Marvin's Bangs and Clangs Greeting Card Shop",
  "Marvin's Bouncy Yo-Yo Shop",
  "Marvin's Clank and Clatter Rock Climbing Gym",
  "Marvin's Dizzy Worm Farm",
  "Mayor Bartholomew's Bike Rental",
  "Mayor Beau's Marble Shop",
  "Mayor Betty's Leaf Raking",
  "Mayor Chomper's Compass Shop",
  "Mayor Knox's Composting Service",
  "Mayor Petunia's Roller Skate Rental",
  "Mayor Yvonne's Candle Making",
  "Mildred's Bangs and Clangs Umbrella Repair",
  "Mildred's Twist and Shout Costume Shop",
  "Milton's Splish and Splash Pet Sitting",
  "Mo's Bangs and Clangs Bakery",
  "Myrtle's Boops and Beeps Bug Collecting Club",
  "Myrtle's Boops and Beeps Knitting Shop",
  "Nadine's Fizz and Pop Garden Center",
  "Nadine's Loopy Friendship Bracelet Shop",
  "Nadine's Splish and Splash Tech Support",
  "Noodle's Fizz and Pop Cookie Company",
  "Noodle's Huff and Puff Tutoring",
  "Norbert's Doodle and Noodle Bike Rental",
  "Nugget's Bangs and Clangs Scooter Repair",
  "Nugget's Bubbles and Bobbles Dumpling Shop",
  "Nugget's Crunch and Munch Sandcastle Building",
  "Nugget's Nifty Window Washing",
  "Opal's Boops and Beeps Pogo Stick Repair",
  "Opal's Fizz and Pop Muffin Shop",
  "Opal's Splish and Splash Pogo Stick Repair",
  "Otis' Buzz and Whirr Leaf Raking",
  "Otis' Jolly Milkshake Bar",
  "Ozzie's Hops and Skips Juice Bar",
  "Ozzie's Nifty Fishing Guide Service",
  "Ozzie's Spiffy Kite Shop",
  "Ozzie's Splish and Splash Waffle Cart",
  "Peanut's Bits and Bobs Umbrella Rental",
  "Peanut's Crunch and Munch Petting Zoo",
  "Pearl's Doodle and Noodle Noodle Shop",
  "Pearl's Peppy Fence Painting",
  "Pearl's Puffs and Fluffs Umbrella Rental",
  "Pearl's Sizzle and Drizzle Jam Making",
  "Pearl's Twist and Shout Butterfly Garden",
  "Percy's Chirp and Chatter Sled Rental",
  "Percy's Crunch and Munch Knitting Shop",
  "Petunia's Bubbles and Bobbles Origami Studio",
  "Petunia's Wiggly Arcade",
  "Pickle's Wiggles and Giggles Rock Climbing Gym",
  "Pippin's Bangs and Clangs Window Washing",
  "Pippin's Crunch and Munch Fishing Guide Service",
  "Pippin's Sizzle and Drizzle Roller Rink",
  "Pippin's Splish and Splash Telescope Shop",
  "Professor Bumble's Bookstore",
  "Professor Flossie's Snow Cone Stand",
  "Professor Ida's Coffee Cart",
  "Prudence's Bangs and Clangs Leaf Raking",
  "Prudence's Huff and Puff Sandwich Shop",
  "Pudding's Bangs and Clangs Fort Building",
  "Pudding's Flip and Flop Sticker Shop",
  "Pudding's Silly Pottery Studio",
  "Pudding's Snap and Crackle Face Painting",
  "Pudding's Wiggles and Giggles Skateboard Shop",
  "Queenie's Chomp and Champ Taco Cart",
  "Queenie's Jazzy Woodworking Shop",
  "Queenie's Sassy Pottery Studio",
  "Queenie's Snap and Crackle Balloon Delivery",
  "Quincy's Twist and Shout Costume Shop",
  "Quincy's Twist and Shout Trampoline Park",
  "Ruby's Buzz and Whirr Puppet Theater",
  "Ruby's Chirp and Chatter Popcorn Stand",
  "Rufus' Bubbles and Bobbles Fence Painting",
  "Rufus' Wobbly Umbrella Rental",
  "Rusty's Scoop and Swirl Tea House",
  "Rusty's Sizzle and Drizzle Compass Shop",
  "Sadie's Bangs and Clangs Frisbee Golf Course",
  "Sadie's Sniffs and Sniffles Cotton Candy Stand",
  "Sir Hattie's Puppet Theater",
  "Sir Mabel's Sewing Shop",
  "Sir Marbles' Bonsai Studio",
  "Sir Marbles' Photography",
  "Sir Otis' Mushroom Farm",
  "Sir Pippin's Seashell Shop",
  "Sir Snicker's Gutter Cleaning",
  "Sir Yolanda's Origami Studio",
  "Snicker's Splish and Splash Cupcake Bakery",
  "Sprinkles' Hops and Skips Pony Rides",
  "Stan's Scoop and Swirl Coin Shop",
  "Tallulah's Bits and Bobs Roller Skate Rental",
  "Tallulah's Scoop and Swirl Woodworking Shop",
  "Tater's Speedy Rock Climbing Gym",
  "The Bouncy Fox Rain Barrel Installation",
  "The Bouncy Gecko Fishing Guide Service",
  "The Bouncy Hippo Kite Flying Lessons",
  "The Bouncy Turtle Snowball Fight Coaching",
  "The Breezy Alpaca Skate Ramp Building",
  "The Breezy Ferret Birthday Party Planning",
  "The Bumpy Ferret Face Painting",
  "The Bumpy Owl Firewood Delivery",
  "The Bumpy Squirrel Taffy Pull",
  "The Bumpy Turtle Fence Painting",
  "The Chunky Armadillo Hopscotch Coaching",
  "The Chunky Hedgehog Rain Barrel Installation",
  "The Chunky Walrus Recycling Service",
  "The Cranky Ferret Fishing Guide Service",
  "The Cranky Ferret Soup Kitchen",
  "The Cranky Kangaroo Sunglasses Stand",
  "The Cranky Koala Snowman Building",
  "The Cranky Otter Trampoline Park",
  "The Cranky Turtle Snow Cone Stand",
  "The Cranky Weasel Pretzel Stand",
  "The Dizzy Raccoon Rock Collecting Club",
  "The Fuzzy Beaver Papercraft Shop",
  "The Fuzzy Owl Comic Shop",
  "The Fuzzy Squirrel Donut Shop",
  "The Giggly Badger Birthday Party Planning",
  "The Giggly Beaver Blanket Fort Consulting",
  "The Giggly Giraffe Trading Card Shop",
  "The Giggly Gopher Fishing Guide Service",
  "The Giggly Panda Sandcastle Building",
  "The Giggly Sloth Sandcastle Building",
  "The Goofy Squirrel Chalk Art Studio",
  "The Goofy Squirrel Pogo Stick Repair",
  "The Grumpy Giraffe Pogo Stick Repair",
  "The Grumpy Hedgehog Tea House",
  "The Grumpy Koala Chicken Coop Building",
  "The Jazzy Alpaca Arcade",
  "The Jazzy Fox Seashell Shop",
  "The Jazzy Fox Snow Cone Stand",
  "The Jazzy Hedgehog Hat Shop",
  "The Jolly Alpaca Wagon Repair",
  "The Jolly Fox Gutter Cleaning",
  "The Jolly Owl Cookie Company",
  "The Loopy Alpaca Plant Sitting",
  "The Loopy Ferret Sticker Shop",
  "The Loopy Gopher Electronics Repair",
  "The Loopy Gopher Window Washing",
  "The Loopy Raccoon Chimney Sweeping",
  "The Nifty Alpaca Origami Studio",
  "The Nifty Alpaca Umbrella Repair",
  "The Nifty Beaver Escape Room",
  "The Nifty Ferret Tutoring",
  "The Nifty Hippo Marble Shop",
  "The Nifty Kangaroo Grilled Cheese Truck",
  "The Nifty Moose Sticker Shop",
  "The Peppy Weasel Noodle Shop",
  "The Peppy Weasel Recycling Service",
  "The Perky Fox Window Washing",
  "The Perky Hedgehog Popcorn Delivery",
  "The Perky Hedgehog Woodworking Shop",
  "The Perky Owl Muffin Shop",
  "The Perky Owl Tea House",
  "The Perky Raccoon Roller Rink",
  "The Perky Squirrel Bike Rental",
  "The Rusty Koala Comic Shop",
  "The Rusty Newt Woodworking Shop",
  "The Rusty Sloth Sled Rental",
  "The Sassy Ferret Snow Shoveling",
  "The Sassy Gopher Juggling Lessons",
  "The Sassy Moose Friendship Bracelet Shop",
  "The Sassy Newt Bonsai Studio",
  "The Sassy Otter Gift Wrapping",
  "The Silly Badger Yo-Yo Shop",
  "The Silly Platypus Recycling Service",
  "The Sleepy Armadillo Rock Collecting Club",
  "The Sleepy Beaver Umbrella Rental",
  "The Sleepy Gopher Rain Barrel Installation",
  "The Sleepy Kangaroo Hot Cocoa Stand",
  "The Sleepy Turtle Tutoring",
  "The Snazzy Armadillo Cheese Shop",
  "The Snazzy Moose Bakery",
  "The Snazzy Yak Bookstore",
  "The Snoozy Ferret Hula Hoop Lessons",
  "The Snoozy Ferret Mitten Shop",
  "The Snoozy Fox Root Beer Stand",
  "The Snoozy Giraffe Car Wash",
  "The Snoozy Koala Bookstore",
  "The Snoozy Koala Roller Rink",
  "The Snoozy Platypus Cupcake Bakery",
  "The Sparkly Alpaca Pet Sitting",
  "The Sparkly Chipmunk Balloon Delivery",
  "The Sparkly Hedgehog Pony Rides",
  "The Sparkly Hedgehog Roller Skate Rental",
  "The Sparkly Kangaroo Butterfly Garden",
  "The Sparkly Moose Blanket Fort Consulting",
  "The Sparkly Platypus Blanket Fort Consulting",
  "The Sparkly Raccoon Telescope Shop",
  "The Sparkly Weasel Scavenger Hunt Planning",
  "The Speedy Armadillo Puppet Theater",
  "The Speedy Chipmunk Worm Farm",
  "The Speedy Giraffe Cotton Candy Stand",
  "The Speedy Hedgehog Bagel Shop",
  "The Speedy Owl Weather Station",
  "The Speedy Penguin Snowman Building",
  "The Speedy Toad Llama Walking Tours",
  "The Spiffy Chipmunk Seashell Shop",
  "The Spiffy Gopher Coffee Cart",
  "The Spiffy Hedgehog Kite Shop",
  "The Spiffy Owl Chalk Art Studio",
  "The Spiffy Squirrel Pretzel Stand",
  "The Spiffy Walrus Mini Golf",
  "The Spiffy Weasel Candle Making",
  "The Squeaky Giraffe Pie Shop",
  "The Squeaky Kangaroo Snow Cone Stand",
  "The Squeaky Platypus Photography",
  "The Squeaky Squirrel Pretzel Stand",
  "The Wiggly Armadillo Puzzle Shop",
  "The Wiggly Hippo Roller Skate Rental",
  "The Wiggly Koala Costume Shop",
  "The Wiggly Moose Button Making",
  "The Wiggly Newt Scooter Repair",
  "The Wobbly Alpaca Roller Rink",
  "The Wobbly Armadillo Seashell Shop",
  "The Wobbly Newt Juice Bar",
  "The Wonky Owl Dog Walking",
  "The Wonky Toad Electronics Repair",
  "The Wonky Weasel Greeting Card Shop",
  "The Zippy Gecko Waffle Cart",
  "The Zippy Koala Rock Collecting Club",
  "The Zippy Llama Cookie Company",
  "The Zippy Turtle Weather Station",
  "Tobias' Bits and Bobs Doghouse Building",
  "Tobias' Nifty Car Wash",
  "Tobias' Snazzy Garden Center",
  "Ulric's Boops and Beeps Bonsai Studio",
  "Ulric's Scoop and Swirl Treasure Hunt Guide",
  "Ulric's Silly Waffle Cart",
  "Ulric's Wiggles and Giggles Origami Studio",
  "Uncle Dexter's Cupcake Bakery",
  "Uncle Hazel's Snow Shoveling",
  "Uncle Marbles' Doghouse Building",
  "Uncle Norbert's Escape Room",
  "Uncle Petunia's Car Wash",
  "Uncle Sprinkles' Muffin Shop",
  "Uncle Vera's Ice Cream Shop",
  "Uncle Xavier's Firewood Delivery",
  "Uncle Yolanda's Bug Collecting Club",
  "Ursula's Scoop and Swirl Pancake House",
  "Ursula's Splish and Splash Skate Ramp Building",
  "Ursula's Twist and Shout Candle Making",
  "Vera's Boops and Beeps Pie Shop",
  "Vinnie's Flip and Flop Roller Rink",
  "Vinnie's Sleepy Honey Shop",
  "Vinnie's Wiggles and Giggles Weather Station",
  "Waddles' Jolly Treehouse Building",
  "Waffles' Zips and Zaps Rain Boot Shop",
  "Wally's Fizz and Pop Smoothie Bar",
  "Wanda's Bangs and Clangs Pogo Stick Repair",
  "Wendell's Jingle and Jangle Window Washing",
  "Winnie's Fuzzy Herb Garden",
  "Xavier's Nuts and Bolts Pretzel Stand",
  "Xavier's Sizzle and Drizzle Origami Studio",
  "Xavier's Splish and Splash Juggling Lessons",
  "Ximena's Bubbles and Bobbles Mini Golf",
  "Ximena's Puffs and Fluffs Roller Rink",
  "Ximena's Snap and Crackle Telescope Shop",
  "Yolanda's Bubbles and Bobbles Electronics Repair",
  "Yolanda's Flip and Flop Jump Rope Lessons",
  "Yolanda's Sizzle and Drizzle Sidewalk Mural Painting",
  "Yolanda's Snips and Snaps Smoothie Bar",
  "Yolanda's Wiggles and Giggles Dog Walking",
  "Yvonne's Bubbles and Bobbles Canoe Rental",
  "Yvonne's Crunch and Munch Sticker Shop",
  "Yvonne's Fizz and Pop Garden Center",
  "Yvonne's Ribbits and Ripples Hot Cocoa Stand",
  "Zeke's Ribbits and Ripples Sticker Shop",
  "Ziggy's Chirp and Chatter Gift Wrapping",
  "Ziggy's Dizzy Snow Shoveling",
  "Ziggy's Doodle and Noodle Origami Studio",
];

// ---------------------------------------------------------------------------
// Player avatars for setup screen
// ---------------------------------------------------------------------------
export const PLAYER_AVATARS = ['🦊', '🐼', '🐸', '🦁', '🐨', '🐯'];

// ---------------------------------------------------------------------------
// Bot personalities — named robot opponents, each with a fixed play style
// ---------------------------------------------------------------------------
// `strategyId` selects a scoring profile in game/aiEngine.js's STRATEGIES
// table that biases which moves that bot favors (e.g. DaddyBigBux leans
// hard into businesses, MrGrinch hoards cash, GrumpyMommy plays contrarian
// to the weather). At setup, the player either assigns a specific
// personality + skill level to each robot or leaves it on "🎲 Random" and
// lets `createPlayerRoster` (game/players.js) pick one — see
// SetupScreen.jsx's bot picker. Both `strategyId` and `skillLevelId` are
// copied onto the player object at roster-creation time (not looked up
// live from these tables), so a future edit to a personality's strategy
// here never rewrites how an already-in-progress or saved game plays.
export const BOT_PERSONALITIES = [
  {
    id: 'leeroy',
    name: 'Leeroy Jenkins',
    avatar: '🐔',
    strategyId: 'reckless',
    blurb: 'Charges in first, asks questions never.',
    // `color` tints this bot's chat bubbles (ChatPanel.jsx/GameOverScreen's
    // closing chat) so each personality reads as visually distinct at a
    // glance, on top of its avatar. `sfxPool` is which goofy sound effects
    // (soundLibrary.js) this personality is likely to reach for — see
    // chatEngine.js's generateBotTurnFlavor().
    color: '#e8590c',
    sfxPool: ['botOhYeah', 'botScreech', 'botHeroSting', 'botLaugh', 'botSquawk', 'botAirhorn'],
  },
  {
    id: 'bossemby',
    name: 'BossEmby',
    avatar: '🕶️',
    strategyId: 'flipper',
    blurb: 'Buys low, sells high, never sits still.',
    color: '#1098ad',
    sfxPool: ['botLaugh', 'botOhYeah', 'botTakeItBack', 'botMicDrop'],
  },
  {
    id: 'mrb',
    name: 'MrB',
    avatar: '🎩',
    strategyId: 'balanced',
    blurb: 'Cool, calm, and steady all around.',
    color: '#5c5f66',
    sfxPool: ['botGroan', 'botTakeItBack', 'botLaugh', 'botHiccup'],
  },
  {
    id: 'mrgrinch',
    name: 'MrGrinch',
    avatar: '🎄',
    strategyId: 'hoarder',
    blurb: 'Every dollar saved is a dollar loved.',
    color: '#2f9e44',
    sfxPool: ['botGroan', 'botBurp', 'botTakeItBack', 'botSneeze'],
  },
  {
    id: 'daddybigbux',
    name: 'DaddyBigBux',
    avatar: '💼',
    strategyId: 'tycoon',
    blurb: 'Businesses, businesses, and more businesses.',
    color: '#f08c00',
    sfxPool: ['botOhYeah', 'botHeroSting', 'botBurp', 'botLaugh', 'botAirhorn', 'botMicDrop'],
  },
  {
    id: 'moneymama',
    name: 'MoneyMama',
    avatar: '👛',
    strategyId: 'saver',
    blurb: 'Smart, patient, and always prepared.',
    color: '#d6336c',
    sfxPool: ['botLaugh', 'botOhYeah', 'botKiss'],
  },
  {
    id: 'grumpymommy',
    name: 'GrumpyMommy',
    avatar: '😤',
    strategyId: 'contrarian',
    blurb: 'Buys the dip, sells the hype, grumbles the whole time.',
    color: '#9c36b5',
    sfxPool: ['botGroan', 'botTakeItBack', 'botFart', 'botScreech', 'botSneeze'],
  },
];

export function getBotPersonality(id) {
  return BOT_PERSONALITIES.find((b) => b.id === id) || BOT_PERSONALITIES[0];
}

// ---------------------------------------------------------------------------
// Bot skill levels — how sharp a robot's decisions are, independent of its
// personality/strategy. Read by game/aiEngine.js's SKILL_PROFILES to tune
// cash efficiency, how many moves it takes per turn, and how often it
// second-guesses its own best move.
// ---------------------------------------------------------------------------
export const SKILL_LEVELS = [
  { id: 'rookie', name: 'Rookie', icon: '🐣', tagline: 'Learning the ropes — makes a few slip-ups.' },
  { id: 'sharp', name: 'Sharp', icon: '🧠', tagline: 'Solid, sensible moves every turn.' },
  { id: 'shark', name: 'Shark', icon: '🦈', tagline: 'Reads the market and rarely wastes a move.' },
];
export const DEFAULT_SKILL_LEVEL_ID = 'sharp';

export function getSkillLevel(id) {
  return SKILL_LEVELS.find((s) => s.id === id) || SKILL_LEVELS.find((s) => s.id === DEFAULT_SKILL_LEVEL_ID);
}

// ---------------------------------------------------------------------------
// Bot chat — each personality's voice, read by game/chatEngine.js
// ---------------------------------------------------------------------------
// One array of lines per (personality, category). `{player}` is replaced
// with whoever the line is about/aimed at (human or robot); `{bot}` is
// replaced with another robot's name, used only by the `botBanter` category
// (a bot addressing a specific other bot by name). chatEngine.js picks a
// random line from the matching array and does the substitution — see that
// file for exactly when each category fires:
//   greeting    — said once as the game starts, introducing themselves
//   question    — asked to whoever's turn is starting (mostly the human)
//   tease       — a light, friendly jab (a cautious move, a rough card...)
//   challenge   — competitive trash-talk / a dare
//   compliment  — a good move: a business started, a badge earned...
//   applause    — end-of-game congratulations for whoever won
//   gloat       — a bot's own reaction to doing well / winning
//   sympathy    — a kind word about someone else's bad luck
//   weatherGood — commentary when the market turns sunny/rebounding
//   weatherBad  — commentary when the market turns stormy/dipping
//   botBanter   — a follow-up line aimed at another specific bot
//   hype        — an unprompted money/winning catchphrase, rolled once per
//                 robot turn alongside (independently of) a chance at a
//                 goof-off sound effect — see chatEngine.js's
//                 generateBotTurnFlavor() and BOT_PERSONALITIES' sfxPool
//                 for the actual sound-effect side of that (fart, burp,
//                 laugh, screech, etc. — soundLibrary.js, not lines here).
export const BOT_CHAT_LINES = {
  leeroy: {
    greeting: [
      "LEEROOOY JENKINS! Let's gooo! 🐔",
      "Who's ready to charge in?! Planning is for chickens. Wait...",
      "I have a plan: no plan. Let's play!",
    ],
    question: [
      "Whatcha buyin', {player}? Don't overthink it!",
      "You gonna make a move or just stand there, {player}?",
      "Feeling lucky, {player}? You SHOULD be!",
    ],
    tease: [
      "Careful, {player} — savings accounts are for the slow!",
      "Is that a Piggy Bank? Bo-ring.",
      "{player}, you plan more than my grandma. No offense to grandmas.",
    ],
    challenge: [
      "Race you to the top, {player}! Last one there buys lunch!",
      "Bet I start more businesses than you this game, {player}.",
      "I'm not scared of a little storm — are you, {player}?",
    ],
    compliment: [
      "Whoa, bold move! I love it, {player}!",
      "Now THAT'S how you play! Nice one, {player}!",
      "See, {player}? Charging in pays off!",
    ],
    applause: [
      "LEEROOOY— I mean, way to go, {player}! 🎉",
      "That was WILD. Respect, {player}!",
      "Best game I've seen! You crushed it, {player}!",
    ],
    gloat: ["Ha! Told you charging in works!", "Who's reckless now? THIS guy's winning.", "Fortune favors the bold. And me."],
    sympathy: ["Ouch, {player}. Shake it off and charge back in!", "Bad luck happens, {player} — don't slow down now!"],
    weatherGood: ["SUNSHINE! Let's gooo, everybody buy stuff!", "Boom time! No brakes today!"],
    weatherBad: ["A little storm never hurt anybody. Onward!", "Storm? PSH. I don't retreat."],
    botBanter: ["Hey {bot}, still counting pennies?", "{bot}, you gotta live a little!", "Race you, {bot}! Bet you chicken out."],
    hype: ["LET'S GOOOO — we earnin' AND burnin', baby! 🔥", "Bet! Always bet.", "Six... seven. 🤷 No idea what that means but LET'S GO."],
  },
  bossemby: {
    greeting: [
      "BossEmby's in the house. Let's make some deals. 🕶️",
      "Buy low, sell high, look cool doing it. That's the whole plan.",
      "Everybody ready to trade? I was born ready.",
    ],
    question: [
      "What's the move, {player}? I'm always watching the market.",
      "You holding or folding, {player}?",
      "Got a read on this weather, {player}, or just vibing?",
    ],
    tease: [
      "Still holding that? Market's moved on, {player}.",
      "Slow and steady's cute, {player}. I prefer fast and smooth.",
      "{player}, that's a... choice.",
    ],
    challenge: [
      "Bet my portfolio flips yours by next month, {player}.",
      "Let's see who reads the market better, {player}.",
      "I'll double my cash before you do, {player}. Watch.",
    ],
    compliment: [
      "Clean trade, {player}. Very clean.",
      "Okay, {player}, that was smooth. Respect.",
      "Now THAT'S a deal. Nice, {player}.",
    ],
    applause: ["Smooth game, {player}. I'll admit it.", "Respect where it's due — nice work, {player}.", "Solid trading, {player}. Solid."],
    gloat: ["Called it. Buy low, sell high, every time.", "This is what a good read on the market looks like.", "Told you I don't miss."],
    sympathy: ["Rough trade, {player}. Happens to everyone.", "Ouch. Shake it off, {player} — next month's a new chart."],
    weatherGood: ["Market's hot. Time to move.", "This is the good stuff. Let's ride it."],
    weatherBad: ["Time to cut losses and get lean.", "Storm's here. Smart money gets flexible."],
    botBanter: ["{bot}, you seeing this market too?", "Keep up, {bot}.", "{bot}, I'll trade circles around you."],
    hype: ["Earnin' and burnin', baby. That's the whole game.", "Bet.", "That's cap and you know it."],
  },
  mrb: {
    greeting: ["MrB, at your service. Let's have a good, sensible game.", "Hello, everyone. May the steadiest portfolio win.", "Good luck, all. I'll be right here, being reasonable."],
    question: ["What's the plan, {player}?", "Any thoughts on this month, {player}?", "What are we thinking, {player}?"],
    tease: ["Bold choice, {player}. I'll be over here being careful.", "Interesting strategy, {player}. Truly.", "Well, that's one way to do it, {player}."],
    challenge: ["Let's just see how this plays out, {player}.", "May the more sensible player win, {player}.", "I'll quietly out-save you, {player}."],
    compliment: ["Well played, {player}. Very sound.", "That was a smart, balanced move, {player}.", "Nicely done, {player}. Steady wins."],
    applause: ["Well earned, {player}. Congratulations.", "A solid, well-played game, {player}.", "Nice work, {player}. Truly."],
    gloat: ["Steady and sensible. Works every time.", "Well, that went about as planned.", "Balance. It's not flashy, but it works."],
    sympathy: ["Tough break, {player}. These things happen.", "Sorry to hear that, {player}. Onward."],
    weatherGood: ["A pleasant market. I'll take it.", "Good conditions. Let's use them wisely."],
    weatherBad: ["A bit of a rough patch. Steady on.", "Nothing a balanced approach can't handle."],
    botBanter: ["Careful there, {bot}.", "{bot}, always a pleasure to compete with you.", "We'll see, {bot}."],
    hype: ["Ah yes. 'Bet,' as the kids say.", "Six... seven? I confess I don't follow.", "Is that what they call 'cap'? Fascinating."],
  },
  mrgrinch: {
    greeting: ["MrGrinch here. Every dollar saved is a dollar loved. 🎄", "Hmph. Let's play — but I'm keeping my cash.", "Fine, I'll join. But I'm not spending more than I have to."],
    question: ["You SURE you want to spend that, {player}?", "What are you buying, {player}? Better be worth it.", "Is that really necessary, {player}?"],
    tease: ["Spending again, {player}? Hmph.", "That money could've been SAVED, {player}.", "{player}, you spend like it grows on trees."],
    challenge: ["Bet my Piggy Bank beats your fancy assets, {player}.", "I'll out-save you without even trying, {player}.", "Let's see who's richer when it actually counts, {player}."],
    compliment: ["Hmph. Fine, that was actually smart, {player}.", "...Not bad, {player}. Don't let it go to your head.", "Okay, I'll admit it — good move, {player}."],
    applause: ["Hmph. Well deserved, {player}. Don't spend it all.", "Fine. Congratulations, {player}. You earned it.", "Not bad at all, {player}. Truly."],
    gloat: ["See? Saving works. Every. Time.", "Told you a full Piggy Bank beats a fast one.", "Hmph. Who's stingy NOW?"],
    sympathy: ["Hmph. That's rough, {player}. Save up and bounce back.", "Sorry to hear it, {player}. Should've saved more. But still, sorry."],
    weatherGood: ["Good times. Still saving, though.", "Nice weather. Doesn't change my plan: save."],
    weatherBad: ["Told you a storm was coming. Piggy Bank time.", "Hmph. See? THIS is why you save."],
    botBanter: ["{bot}, you're spending too fast.", "Hmph, {bot}, save something for once.", "{bot}, watch and learn."],
    hype: ["'Earnin' and burnin''? I only do the earnin'. Burnin's wasteful.", "Sus. Everything's a little sus to me.", "That's cap. I don't do cap, I do compound interest."],
  },
  daddybigbux: {
    greeting: ["DaddyBigBux is HERE, champ! 💼 Let's build some empires!", "Businesses, businesses, and more businesses. Let's go, team!", "Who's ready to think BIG? That's my whole personality."],
    question: ["Starting a business yet, champ? {player}?", "What's your five-year plan, {player}?", "Any big ideas today, {player}?"],
    tease: ["Just one Piggy Bank, {player}? Where's the EMPIRE?", "That's cute, {player}. Now where's your business plan?", "{player}, small moves. I like BIG moves."],
    challenge: ["Bet I've got more businesses than you by month-end, {player}.", "Let's see whose empire grows faster, {player}.", "I'll out-hustle you, {player}. Just watch."],
    compliment: ["NOW we're talking business, {player}! Love it!", "That's the entrepreneurial spirit, {player}!", "Big moves, {player}! That's my kind of play!"],
    applause: ["That's my champ! Way to go, {player}!", "Now THAT'S a success story, {player}!", "Proud of you, {player}! Big win!"],
    gloat: ["Empire status: achieved.", "This is what happens when you think BIG.", "Businesses, businesses, and more winning."],
    sympathy: ["Rough one, {player}. Every tycoon has a bad quarter.", "Chin up, champ — I mean, {player}. Build it back."],
    weatherGood: ["Boom time! Time to expand, expand, expand!", "The market's hot — start another business!"],
    weatherBad: ["A storm's just a chance to buy in cheap, champ.", "Rough weather, but empires are built in storms too."],
    botBanter: ["{bot}, you should really start a business.", "Step it up, {bot} — think bigger!", "{bot}, my empire's bigger. Just saying."],
    hype: ["Earnin' AND burnin', champ! That's the tycoon way!", "Bet! Big deals only, baby!", "Six figures, seven figures — six, seven, let's just say BIG."],
  },
  moneymama: {
    greeting: ["Hi everyone, I'm MoneyMama. 👛 Let's play smart and have fun!", "Hello, sweetie! Ready to grow your money the smart way?", "MoneyMama's here — patience and good choices win the day."],
    question: ["What are you thinking of doing, hon — I mean, {player}?", "Have you thought this through, {player}?", "What's your plan for today, {player}?"],
    tease: ["Ooh, a little risky, {player}. Are you sure?", "That's bold, sweetie. I mean, {player}.", "Careful now, {player} — patience pays."],
    challenge: ["I bet patience beats speed, {player}. Let's find out.", "Let's see who saves smarter, {player}.", "I'll grow mine steady and sure, {player}. Race you."],
    compliment: ["Smart choice, sweetie! I'm proud of you, {player}.", "Now that's thinking ahead, {player}!", "Wonderful move, {player}. Truly smart."],
    applause: ["I'm so proud of you, {player}! Well earned.", "Beautifully played, {player}! Well done, sweetie.", "You did wonderfully, {player}. Congratulations!"],
    gloat: ["Patience and smart choices. Every time.", "Slow, steady, and it paid off.", "See? Good habits win."],
    sympathy: ["Oh no, {player}. It's okay, these things happen. Keep going.", "I'm sorry, sweetie — I mean, {player}. You'll bounce back."],
    weatherGood: ["Lovely weather for growing your money!", "Sunny days — a good time to plan ahead."],
    weatherBad: ["A little rain is fine, dear. Stay steady.", "Rough patch, but we'll be smart about it."],
    botBanter: ["{bot}, remember — patience, dear.", "Slow down a little, {bot}.", "I believe in you too, {bot}."],
    hype: ["It's 'earning AND saving,' sweetie, but I love the energy!", "Bet, hon! I like your confidence.", "Sus? No such thing when you plan ahead."],
  },
  grumpymommy: {
    greeting: ["Hmph. GrumpyMommy's here. 😤 Don't expect me to follow the crowd.", "Fine, I'll play. I'll also be right, as usual.", "Everyone's excited. I'm... cautiously grumpy about it."],
    question: ["Why would you do THAT, {player}?", "You really thought that through, {player}?", "What's the rush, {player}?"],
    tease: ["Everyone's doing that? Then I'm definitely not, {player}.", "Following the crowd again, {player}? Hmph.", "{player}, that's exactly what everyone else is doing. Boring."],
    challenge: ["Bet I do better going against the grain, {player}.", "Let's see who's smarter — the crowd or me, {player}.", "I dare you to zig when everyone else zags, {player}."],
    compliment: ["Hmph. Fine, {player}, that was actually clever.", "Didn't expect that from you, {player}. Good.", "Okay, {player}. I'm grudgingly impressed."],
    applause: ["Hmph. Nice job, {player}. Don't let it go to your head.", "Fine, congratulations, {player}. You did good.", "Alright, alright — well done, {player}."],
    gloat: ["Told you going against the crowd works.", "Hmph. Contrarian and correct. As usual.", "While everyone panicked, I did the opposite. And won."],
    sympathy: ["Hmph. That's a shame, {player}. Chin up.", "Rough one, {player}. Even I feel for you a little."],
    weatherGood: ["Everyone's cheering. Suspicious, honestly.", "Sunny skies. I'll believe it when I see it."],
    weatherBad: ["Finally, some proper weather. Time to buy.", "Storm's here — everyone panic, and I'll do the opposite."],
    botBanter: ["{bot}, following the crowd again, I see.", "Hmph, {bot}, try thinking for yourself.", "{bot}, you'll learn eventually."],
    hype: ["Sus. Everything's sus. Especially good moods.", "That's cap and I'm calling it out.", "Six... seven? Hmph. Back in my day it was just seven."],
  },
};

export const LOCAL_STORAGE_KEY = 'ventureflow-save-v1';

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------
export const GAME_NAME = 'VentureFlow';
export const PARENT_BRAND = 'VentureMaker';
export const BRAND_TAGLINE = `A ${PARENT_BRAND}™ game`;

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
export const LEADERBOARD_STORAGE_KEY = 'ventureflow-leaderboard-v1';
export const LEADERBOARD_MAX_ENTRIES = 50;

// A saved score ranking at or above this position gets the extra "Top 20"
// thunderous-applause celebration on the game-over screen.
export const LEADERBOARD_TOP_HIGHLIGHT = 20;
