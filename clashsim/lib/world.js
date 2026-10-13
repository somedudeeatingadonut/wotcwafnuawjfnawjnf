/**
 * world.js — the living lobby.
 *
 * Everything the "other players" do lives here: 30 scripted bots, the chat, the
 * Lucky Wins / High Rollers feeds, the round engines for the multiplayer games
 * (Crash, Double, Champion) and the daily race.
 *
 * Only one brain in this building is real, and it is the one reading the screen.
 */

'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');
const catalog = require('./catalog');

// the save file lives in .data/ (gitignored); tests can point CLASH_DATA_DIR at a
// scratch directory so they never touch a real profile
const DATA_DIR = process.env.CLASH_DATA_DIR
  ? path.resolve(process.env.CLASH_DATA_DIR)
  : path.join(__dirname, '..', '.data');
const DATA_FILE = path.join(DATA_DIR, 'players.json');

const rnd = (a, b) => a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (n) => Math.round(n * 100) / 100;

/* ==========================================================================
   Bots
   ========================================================================== */

const BOT_NAMES = [
  'shadowByte', 'KryptoKid', 'NovaPrime', 'glitchGoblin', 'zeroTwo', 'luckyLars',
  'TiltedTimmy', 'midnightMaggie', 'voidWalker', 'prismPete', 'turboTaco',
  'neonNinja', 'frostbiteFox', 'blockHedger', 'pixelPirate', 'degenDaisy',
  'slipperySid', 'rocketRhea', 'staticSam', 'graylineGabe', 'omegaOllie',
  'velvetVex', 'cobaltKai', 'rustyRaccoon', 'hauntedHazel', 'zephyrZed',
  'mochaMike', 'bitterBetty', 'cosmicCrab', 'washedWally', 'sparkyStella',
  'lucidLouie', 'tinyTitan', 'phantomPhil', 'cursedCass', 'moonShotMax',
  'zigzagZoe', 'calmCarl', 'doomedDerek', 'peachyPam', 'ghostGwen',
  'sketchySteve', 'finalFormFinn', 'jellybeanJim', 'ratchetRina', 'onyxOscar',
];

const BOT_TITLES = [
  'Case grinder', 'Crash main', 'Upgrader enjoyer', 'First-round soldier',
  'Hopium dealer', 'Grey-pull veteran', 'Sold at 1.2x', 'Rebuy enthusiast',
  'Double grinder', 'Plinko physicist', 'Champion camper',
];

const CHAT_LINES = [
  'gl everyone', 'anyone else lagging or just me', 'this case is cursed i swear',
  'chat is dead today', 'brb coffee', 'who else only sells at 1.3x',
  'im up 40k and ill lose it in 4 minutes', 'kh', 'lets gooo', 'F',
  'remember these gems are fake, the pain is real', 'one more then bed (a lie)',
  'sold too early again', 'who is hitting 100x on plinko', 'upgrader owes me 200k',
  'my strategy is vibes', 'double black when', 'champion pot is juicy',
  'i swear the knife case hates me', 'w stream', 'nap time after this round',
];
const CHAT_LOW_CRASH = ['rip', 'instant bust', 'of course', 'brutal', 'unlucky', 'house does not miss', '1.00x is a war crime'];
const CHAT_HIGH_CRASH = ['called it', 'i sold at 1.4 ffs', 'W', 'watched a 60x go by', 'somebody hit big', 'insane round'];

function makeBots(n) {
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, n);
  return names.map((name, i) => ({
    id: 'bot_' + i,
    name,
    isBot: true,
    title: pick(BOT_TITLES),
    hue: rndInt(0, 359),
    face: rndInt(0, 11),
    balance: Math.round(rnd(40000, 900000)),
    level: rndInt(8, 96),
    wagered: Math.round(rnd(20000, 4000000)),
    netToday: Math.round(rnd(-90000, 160000)),
    style: pick(['early', 'early', 'mid', 'mid', 'greedy', 'degen']),
    patience: rnd(0.5, 0.95),
    sessionStart: Date.now() - rndInt(1, 40) * 60000,
    // live rounds
    crashBet: null,
    doubleBet: null,
    championTickets: 0,
    lastChatAt: 0,
    lastCaseAt: 0,
    lastBattleAt: 0,
  }));
}

function botStake(bot, max) {
  const hi = Math.min(bot.balance * 0.06, max || 60000);
  const lo = Math.max(50, Math.min(bot.balance * 0.002, 900));
  if (hi <= lo) return Math.round(Math.max(50, bot.balance * 0.04));
  return Math.round(rnd(lo, hi));
}

/** Bots are coded to rebuy the second they bust — the reason a lobby always looks warm. */
function botRebuyIfBroke(bot) {
  if (bot.balance < 5000) bot.balance += rndInt(50000, 400000);
}

function botCrashTarget(bot) {
  switch (bot.style) {
    case 'early': return round2(rnd(1.05, 1.9));
    case 'mid': return round2(rnd(1.9, 4.2));
    case 'greedy': return round2(rnd(3, 12));
    case 'degen': return pick([1.2, 1.5, 2, 5, 10, 30, 80]);
    default: return 2;
  }
}

/* ==========================================================================
   World
   ========================================================================== */

const world = {
  rev: 1,
  startedAt: Date.now(),
  bots: [],
  players: new Map(),
  feed: [],
  chat: [],
  history: { crash: [], double: [] },
  fakeOnline: 0,
  race: { endsAt: 0, participants: new Map(), lastWinnerAward: 0, round: 1 },
};

let feedSeq = 1;
let chatSeq = 1;

/* --- feeds ---------------------------------------------------------------- */

function pushFeed(ev) {
  const entry = { seq: feedSeq++, ts: Date.now(), ...ev };
  world.feed.unshift(entry);
  if (world.feed.length > 140) world.feed.length = 140;
  world.rev++;
  return entry;
}

function pushChat(entry) {
  const msg = { seq: chatSeq++, ts: Date.now(), ...entry };
  world.chat.push(msg);
  if (world.chat.length > 120) world.chat.shift();
  world.rev++;
}

function botChat(bot, text, force) {
  const now = Date.now();
  if (!force && now - bot.lastChatAt < 8000) return;
  bot.lastChatAt = now;
  pushChat({ name: bot.name, isBot: true, hue: bot.hue, face: bot.face, text });
}

const systemChat = (text) => pushChat({ name: 'clash.sim', isBot: true, system: true, hue: 150, face: 0, text });

/** Record a win for the Lucky Wins table (columns: game, user, amount, multi, payout). */
function recordWin({ game, name, isBot, you, hue, face, stake, mult, payout, detail }) {
  pushFeed({
    type: game, name, isBot, you, hue, face,
    stake: Math.round(stake),
    // one clamp at the source: a jackpot multiplier can be huge, but never
    // shows up as a spread of trailing decimals in the feed
    mult: clamp(round2(mult), 0, 100000),
    value: Math.round(payout),
    profit: Math.round(payout - stake), detail: detail || '',
  });
}

/* ==========================================================================
   Players
   ========================================================================== */

const XP_PER_LEVEL = 400;
const levelFromXp = (xp) => Math.floor(Math.pow(Math.max(0, xp) / XP_PER_LEVEL, 2 / 3)) + 1;
const xpForLevel = (level) => Math.round(XP_PER_LEVEL * Math.pow(level - 1, 1.5));

const BONUS_COOLDOWN_MS = 3 * 60 * 1000;
const FREE_CASE_COOLDOWN_MS = 45 * 60 * 1000;
const FREE_CASE_MAX_PRICE = 1000;   // vouchers only cover the cheaper cases

function newPlayer(id, name) {
  return {
    id,
    name: name || 'player_' + id.slice(0, 4),
    hue: rndInt(0, 359),
    face: rndInt(0, 11),
    balance: 2500,
    inventory: [],
    xp: 0,
    level: 1,
    lastBonusAt: 0,
    lastFreeCaseAt: 0,
    freeCases: 3,
    raceWagered: 0,
    stats: { wagered: 0, won: 0, lost: 0, opened: 0, biggestWin: 0, rounds: 0, battles: 0, upgrades: 0, creatorEarned: 0, creatorOpens: 0 },
    netToday: 0,
    crashBet: null,
    mines: null,
    tiles: null,
    coinflipHistory: [],
    chatAt: 0,
    lastSeen: Date.now(),
  };
}

function getPlayer(pid) {
  if (!pid) return null;
  const p = world.players.get(pid);
  if (p) p.lastSeen = Date.now();
  return p || null;
}

function invValue(p) { return p.inventory.reduce((s, i) => s + i.value, 0); }

function publicPlayer(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    hue: p.hue,
    face: p.face,
    balance: Math.round(p.balance),
    inventory: p.inventory.slice(-120),
    invCount: p.inventory.length,
    invValue: Math.round(invValue(p)),
    netWorth: Math.round(p.balance + invValue(p)),
    xp: Math.round(p.xp),
    level: p.level,
    xpNext: xpForLevel(p.level + 1),
    xpPrev: xpForLevel(p.level),
    stats: p.stats,
    netToday: Math.round(p.netToday),
    bonusIn: Math.max(0, Math.ceil((BONUS_COOLDOWN_MS - (Date.now() - p.lastBonusAt)) / 1000)),
    freeCases: p.freeCases,
    freeCaseIn: Math.max(0, Math.ceil((FREE_CASE_COOLDOWN_MS - (Date.now() - p.lastFreeCaseAt)) / 1000)),
    crashBet: p.crashBet && p.crashBet.roundId === crash.roundId
      ? { amount: p.crashBet.amount, cashedAt: p.crashBet.cashed || null, busted: !!p.crashBet.busted, auto: p.crashBet.auto || null }
      : null,
    doubleBet: p.doubleBet && p.doubleBet.roundId === double.roundId
      ? { color: p.doubleBet.color, amount: p.doubleBet.amount }
      : null,
    championTickets: p.championTickets || 0,
    mines: p.mines ? minesView(p.mines) : null,
    tiles: p.tiles ? tilesView(p.tiles) : null,
    raceWagered: Math.round(p.raceWagered),
  };
}

function addXp(p, amount) {
  p.xp += amount;
  const lvl = levelFromXp(p.xp);
  if (lvl > p.level) {
    const gained = lvl - p.level;
    p.level = lvl;
    const reward = gained * lvl * 250;
    p.balance += reward;
    pushFeed({
      type: 'level', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
      stake: 0, mult: 0, value: reward, profit: reward, detail: `reached level ${lvl}`,
    });
    systemChat(`${p.name} just hit level ${lvl}. Free gems awarded: ${reward.toLocaleString('en-US')}.`);
  }
  world.rev++;
}

/** Every wager feeds the daily race. */
function trackWager(p, amount) {
  p.stats.wagered += amount;
  p.stats.rounds++;
  p.raceWagered += amount;
  world.race.participants.set(p.id, (world.race.participants.get(p.id) || 0) + amount);
  addXp(p, Math.max(1, Math.round(amount / 10)));
}

function charge(p, amount) {
  p.balance -= amount;
  trackWager(p, amount);
}

function credit(p, amount) {
  p.balance += amount;
  p.stats.won += amount;
  p.netToday += amount;
  if (amount > p.stats.biggestWin) p.stats.biggestWin = Math.round(amount);
}

/* ==========================================================================
   Mines + Tiles helpers (state views live here so the client shape is shared)
   ========================================================================== */

function minesMultiplier(mineCount, revealed) {
  let fair = 1;
  for (let i = 0; i < revealed; i++) fair *= (25 - i) / (25 - mineCount - i);
  return round2(fair * 0.97);  // 3% rake, like the real site
}
function minesView(m) {
  return {
    active: m.active,
    bet: m.bet,
    mineCount: m.mineCount,
    revealed: m.revealed.slice(),
    mines: m.active ? [] : m.mines.slice(),
    curMult: m.active ? minesMultiplier(m.mineCount, m.revealed.length) : 0,
    nextMult: m.active ? minesMultiplier(m.mineCount, m.revealed.length + 1) : 0,
  };
}

/* Tiles: 5 rows, growing darkness. Multipliers are solved so the rake is ~4%. */
const TILES_ROWS = [
  { cursed: 1, of: 5, mult: 1.20 },
  { cursed: 2, of: 5, mult: 2.00 },
  { cursed: 2, of: 5, mult: 3.33 },
  { cursed: 3, of: 5, mult: 8.33 },
  { cursed: 3, of: 5, mult: 20.00 },
];
function tilesView(t) {
  return {
    active: t.active,
    bet: t.bet,
    row: t.row,
    picks: t.picks.slice(),
    cursed: t.active ? [] : t.cursed.map((row) => row.slice()),
    curMult: t.row > 0 ? TILES_ROWS[t.row - 1].mult : 0,
    nextMult: TILES_ROWS[t.row] ? TILES_ROWS[t.row].mult : 0,
    rows: TILES_ROWS.map((r, i) => ({ row: i, cursed: r.cursed, mult: r.mult, state: i < t.row ? 'done' : i === t.row ? 'live' : 'locked' })),
  };
}

/* ==========================================================================
   Round engines
   ========================================================================== */

/* --- Crash --------------------------------------------------------------- */

const CRASH = {
  BET_MS: 7000,
  CRASHED_MS: 4500,
  GROWTH_MS: 9500,
  MAX_CRASH: 150,
  phase: 'betting',
  roundId: 1,
  phaseEndsAt: 0,
  roundStartAt: 0,
  crashPoint: null,
  bets: [],
};
const crash = CRASH;   // alias used by publicPlayer()

function drawCrashPoint() {
  const u = Math.random();
  if (u < 0.01) return 1.0;
  return clamp(round2(0.99 / (1 - u)), 1.0, CRASH.MAX_CRASH);
}
function crashMultAt(ts) {
  if (CRASH.phase !== 'running') return CRASH.phase === 'crashed' ? CRASH.crashPoint : 1;
  return Math.pow(2, Math.max(0, ts - CRASH.roundStartAt) / CRASH.GROWTH_MS);
}

function crashStartBetting() {
  CRASH.phase = 'betting';
  CRASH.crashPoint = null;
  CRASH.bets = [];
  CRASH.roundId++;
  CRASH.phaseEndsAt = Date.now() + CRASH.BET_MS;

  for (const p of world.players.values()) p.crashBet = null;

  for (const bot of world.bots) {
    bot.crashBet = null;
    if (Math.random() > bot.patience) continue;
    const amount = botStake(bot, 40000);
    if (amount < 50 || amount > bot.balance) continue;
    bot.balance -= amount;
    bot.wagered += amount;
    world.race.participants.set(bot.id, (world.race.participants.get(bot.id) || 0) + amount);
    bot.crashBet = { amount, target: botCrashTarget(bot), cashed: null };
    CRASH.bets.push({ id: bot.id, name: bot.name, isBot: true, hue: bot.hue, face: bot.face, amount, cashedAt: null, payout: 0 });
  }
}

function crashStartRunning() {
  CRASH.phase = 'running';
  CRASH.roundStartAt = Date.now();
  CRASH.crashPoint = drawCrashPoint();
  world.rev++;
}

function crashCashoutBot(bot, bet, mult) {
  bet.cashed = mult;
  const payout = Math.round(bet.amount * mult);
  bet.payout = payout;
  bot.balance += payout;
  bot.netToday += payout - bet.amount;
  bot.crashBet = null;
  const entry = CRASH.bets.find((b) => b.id === bot.id);
  if (entry) { entry.cashedAt = mult; entry.payout = payout; }
  if (mult >= 1.6 && payout >= 1000) {
    recordWin({ game: 'Crash', name: bot.name, isBot: true, hue: bot.hue, face: bot.face, stake: bet.amount, mult, payout, detail: 'cashed out' });
  }
  world.rev++;
}

function crashCashoutPlayer(p, mult) {
  const bet = p.crashBet;
  if (!bet || bet.cashed) return null;
  const payout = Math.round(bet.amount * mult);
  bet.cashed = mult;
  credit(p, payout);
  const entry = CRASH.bets.find((b) => b.id === p.id);
  if (entry) { entry.cashedAt = mult; entry.payout = payout; }
  recordWin({ game: 'Crash', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, stake: bet.amount, mult, payout, detail: 'cashed out' });
  return { mult, payout };
}

function crashResolve() {
  CRASH.phase = 'crashed';
  CRASH.phaseEndsAt = Date.now() + CRASH.CRASHED_MS;
  const cp = CRASH.crashPoint;
  world.history.crash.unshift(cp);
  if (world.history.crash.length > 30) world.history.crash.length = 30;

  for (const bet of CRASH.bets) {
    if (bet.cashedAt) continue;
    if (bet.isBot) {
      const bot = world.bots.find((b) => b.id === bet.id);
      if (bot) { bot.netToday -= bet.amount; botRebuyIfBroke(bot); }
    } else {
      const p = world.players.get(bet.id);
      if (p) {
        if (p.crashBet) p.crashBet.busted = true;
        p.stats.lost += bet.amount;
        p.netToday -= bet.amount;
      }
    }
  }
  if (cp < 1.25) world.bots.slice(0, 2).forEach((b, i) => setTimeout(() => botChat(b, pick(CHAT_LOW_CRASH), true), i * 800));
  else if (cp >= 8) setTimeout(() => botChat(pick(world.bots), pick(CHAT_HIGH_CRASH), true), 400);
  world.rev++;
}

/* --- Double (54-segment wheel: 24 green 2x, 24 red 2x, 6 gold 8x) --------- */

const DOUBLE_SEGMENTS = (() => {
  const segs = [];
  for (let i = 0; i < 24; i++) segs.push('green');
  for (let i = 0; i < 24; i++) segs.push('red');
  for (let i = 0; i < 6; i++) segs.push('gold');
  // deterministic shuffle so the wheel layout is stable
  let seed = 1337;
  for (let i = segs.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [segs[i], segs[j]] = [segs[j], segs[i]];
  }
  return segs;
})();
const DOUBLE_PAYOUT = { green: 2, red: 2, gold: 8 };

const double = {
  BET_MS: 20000,
  SPIN_MS: 9000,
  phase: 'betting',
  roundId: 1,
  phaseEndsAt: Date.now() + 20000,
  result: null,
  winningIndex: null,
  history: [],
};

function doubleStartBetting() {
  double.phase = 'betting';
  double.result = null;
  double.winningIndex = null;
  double.roundId++;
  double.phaseEndsAt = Date.now() + double.BET_MS;

  for (const p of world.players.values()) p.doubleBet = null;
  for (const bot of world.bots) {
    bot.doubleBet = null;
    if (Math.random() > bot.patience * 0.9) continue;
    const amount = botStake(bot, 30000);
    if (amount < 50 || amount > bot.balance) continue;
    const color = pick(['green', 'green', 'red', 'red', 'gold']);
    bot.balance -= amount;
    bot.wagered += amount;
    world.race.participants.set(bot.id, (world.race.participants.get(bot.id) || 0) + amount);
    bot.doubleBet = { color, amount };
  }
}

function doubleStartSpin() {
  double.phase = 'spinning';
  const idx = Math.floor(Math.random() * DOUBLE_SEGMENTS.length);
  double.winningIndex = idx;
  double.result = DOUBLE_SEGMENTS[idx];
  double.phaseEndsAt = Date.now() + double.SPIN_MS;

  let pot = 0;
  for (const bot of world.bots) {
    const bet = bot.doubleBet;
    if (!bet) continue;
    pot += bet.amount;
    if (bet.color === double.result) {
      const payout = Math.round(bet.amount * DOUBLE_PAYOUT[double.result]);
      bot.balance += payout;
      bot.netToday += payout - bet.amount;
      if (payout >= bet.amount * 2 && payout >= 2000) {
        recordWin({ game: 'Double', name: bot.name, isBot: true, hue: bot.hue, face: bot.face, stake: bet.amount, mult: DOUBLE_PAYOUT[double.result], payout, detail: `bet ${bet.color} · landed ${double.result}` });
      }
    } else {
      bot.netToday -= bet.amount;
    }
    botRebuyIfBroke(bot);
  }
  for (const p of world.players.values()) {
    const bet = p.doubleBet;
    if (!bet) continue;
    if (bet.color === double.result) {
      const payout = Math.round(bet.amount * DOUBLE_PAYOUT[double.result]);
      credit(p, payout);
      recordWin({ game: 'Double', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, stake: bet.amount, mult: DOUBLE_PAYOUT[double.result], payout, detail: `bet ${bet.color} · landed ${double.result}` });
    } else {
      p.stats.lost += bet.amount;
      p.netToday -= bet.amount;
    }
  }
  world.history.double.unshift({ result: double.result, index: idx, pot });
  if (world.history.double.length > 24) world.history.double.length = 24;
  if (double.result === 'gold') world.bots.slice(0, 2).forEach((b, i) => setTimeout(() => botChat(b, pick(['BLACK CITY', 'gold hit, we eating', 'gold?? insane', 'who bet gold']), true), i * 700));
  world.rev++;
}

/* --- Champion (the jackpot) ---------------------------------------------- */

const champion = {
  JOIN_MS: 30000,
  DRAW_MS: 9000,
  phase: 'joining',
  roundId: 1,
  phaseEndsAt: Date.now() + 30000,
  pot: 0,
  contributors: [],
  winner: null,
  history: [],
};

function championStartJoining() {
  champion.phase = 'joining';
  champion.roundId++;
  champion.pot = 0;
  champion.contributors = [];
  champion.winner = null;
  champion.phaseEndsAt = Date.now() + champion.JOIN_MS;
  for (const p of world.players.values()) p.championTickets = 0;
  for (const bot of world.bots) bot.championTickets = 0;
  world.rev++;
}

function championAdd(bot, amount) {
  bot.balance -= amount;
  bot.wagered += amount;
  bot.championTickets = (bot.championTickets || 0) + amount;
  world.race.participants.set(bot.id, (world.race.participants.get(bot.id) || 0) + amount);
  champion.contributors.push({ id: bot.id, name: bot.name, isBot: true, hue: bot.hue, face: bot.face, amount });
  champion.pot += amount;
}

function championDraw() {
  champion.phase = 'draw';
  champion.phaseEndsAt = Date.now() + champion.DRAW_MS;
  const pot = champion.pot;
  if (pot <= 0 || !champion.contributors.length) {
    champion.winner = null;
    world.rev++;
    return;
  }
  const total = champion.contributors.reduce((s, c) => s + c.amount, 0);
  let r = Math.random() * total;
  let winner = champion.contributors[0];
  for (const c of champion.contributors) { r -= c.amount; if (r <= 0) { winner = c; break; } }

  const payout = Math.round(pot * 0.95);   // 5% rake, disclosed in the UI
  if (winner.isBot) {
    const bot = world.bots.find((b) => b.id === winner.id);
    if (bot) { bot.balance += payout; bot.netToday += payout - winner.amount; bot.ticketsWon = (bot.ticketsWon || 0) + 1; }
  } else {
    const p = world.players.get(winner.id);
    if (p) credit(p, payout);
  }
  champion.winner = { ...winner, payout, pot };
  champion.history.unshift({ round: champion.roundId, name: winner.name, isBot: winner.isBot, pot, payout, chances: Math.round((winner.amount / total) * 1000) / 10 });
  if (champion.history.length > 12) champion.history.length = 12;
  recordWin({ game: 'Champion', name: winner.name, isBot: winner.isBot, you: !winner.isBot, hue: winner.hue, face: winner.face, stake: winner.amount, mult: payout / Math.max(1, winner.amount), payout, detail: `won the ${Math.round(pot).toLocaleString('en-US')} gem pot` });
  systemChat(`🏆 ${winner.name} won the Champion pot — ${payout.toLocaleString('en-US')} gems (${(payout / winner.amount).toFixed(1)}x their entry).`);
  world.rev++;
}

/* ==========================================================================
   Bot ambience
   ========================================================================== */

function botOpensCase(bot) {
  const affordable = catalog.cases.filter((c) => c.gems <= Math.max(200, bot.balance * 0.02));
  const def = affordable.length ? pick(affordable) : catalog.cases[0];
  if (bot.balance < def.gems) return;
  bot.balance -= def.gems;
  bot.wagered += def.gems;
  world.race.participants.set(bot.id, (world.race.participants.get(bot.id) || 0) + def.gems);
  const item = catalog.rollItem(def.id);
  const profit = item.value - def.gems;
  bot.netToday += profit;
  if (profit > 0) bot.balance += item.value;
  bot.lastCaseAt = Date.now();
  if (item.value >= def.gems * 3) {
    pushFeed({
      type: 'Case', name: bot.name, isBot: true, hue: bot.hue, face: bot.face,
      stake: def.gems, mult: round2(item.value / def.gems), value: item.value,
      profit: Math.round(profit), detail: `${item.name} (${item.wearShort})`, item, caseId: def.id,
    });
    const speaker = pick(world.bots);
    setTimeout(() => botChat(speaker, pick(['insane pull', 'gg', 'that is a clip', 'give me that luck', 'no way', 'kh']), true), 700);
  }
  botRebuyIfBroke(bot);
}

function botBattle() {
  const def = pick(catalog.cases.filter((c) => c.gems <= 20000)) || catalog.cases[0];
  const count = rndInt(1, 3);
  const [a, b] = world.bots.slice().sort(() => Math.random() - 0.5);
  const roll = () => Array.from({ length: count }, () => catalog.rollItem(def.id));
  const aItems = roll();
  const bItems = roll();
  const aTotal = aItems.reduce((s, i) => s + i.value, 0);
  const bTotal = bItems.reduce((s, i) => s + i.value, 0);
  const winner = aTotal >= bTotal ? a : b;
  const loser = winner === a ? b : a;
  const winTotal = Math.max(aTotal, bTotal);
  const cost = def.gems * count;
  a.wagered += cost; b.wagered += cost;
  world.race.participants.set(a.id, (world.race.participants.get(a.id) || 0) + cost);
  world.race.participants.set(b.id, (world.race.participants.get(b.id) || 0) + cost);
  winner.balance += winTotal - cost;
  loser.balance -= cost;
  winner.netToday += winTotal - cost;
  loser.netToday -= cost;
  a.lastBattleAt = b.lastBattleAt = Date.now();
  pushFeed({
    type: 'Battles', name: winner.name, isBot: true, hue: winner.hue, face: winner.face,
    stake: cost, mult: round2(winTotal / cost), value: winTotal, profit: Math.round(winTotal - cost),
    detail: `won a ${count}x ${def.name} battle vs ${loser.name}`,
    battle: { caseId: def.id, caseName: def.name, count, winner: winner.id, a: { name: a.name, items: aItems, total: aTotal }, b: { name: b.name, items: bItems, total: bTotal } },
  });
  botRebuyIfBroke(loser);
  world.liveBattle = { caseId: def.id, caseName: def.name, count, cost, a: { name: a.name }, b: { name: b.name }, ts: Date.now(), feedSeq: feedSeq - 1 };
}

/* ==========================================================================
   Daily race
   ========================================================================== */

const RACE_PRIZES = [5000, 3000, 2000, 1500, 1200, 1000, 800, 700, 600, 500];
const RACE_LENGTH_MS = 12 * 60 * 60 * 1000;

function raceStart() {
  world.race = { endsAt: Date.now() + RACE_LENGTH_MS, participants: new Map(), round: (world.race.round || 0) + 1 };
  // bots start with a plausible day's worth of wagering
  for (const bot of world.bots) {
    world.race.participants.set(bot.id, Math.round(rnd(5000, 1_800_000)));
  }
}

function raceStandings(forPlayer) {
  const rows = [];
  for (const [id, wagered] of world.race.participants) {
    const bot = world.bots.find((b) => b.id === id);
    const p = world.players.get(id);
    if (bot) rows.push({ id, name: bot.name, isBot: true, hue: bot.hue, face: bot.face, wagered: Math.round(wagered), you: false });
    else if (p) rows.push({ id, name: p.name, isBot: false, hue: p.hue, face: p.face, wagered: Math.round(wagered), you: forPlayer ? p.id === forPlayer.id : false });
  }
  rows.sort((a, b) => b.wagered - a.wagered);
  const top = rows.slice(0, 10).map((r, i) => ({ ...r, place: i + 1, prize: RACE_PRIZES[i] || 0 }));
  const mine = forPlayer ? top.find((r) => r.you) : null;
  const myRank = forPlayer ? rows.findIndex((r) => r.you) + 1 : 0;
  return { top, mine, myRank, totalPlayers: rows.length, endsAt: world.race.endsAt, round: world.race.round };
}

function raceRollover() {
  const standings = raceStandings(null);
  for (const row of standings.top) {
    if (!row.prize) continue;
    const p = world.players.get(row.id);
    if (p) {
      p.balance += row.prize;
      p.netToday += row.prize;
      systemChat(`Daily race payout: ${p.name} finished #${row.place} and received ${row.prize.toLocaleString('en-US')} gems.`);
    } else {
      const bot = world.bots.find((b) => b.id === row.id);
      if (bot) bot.balance += row.prize;
    }
  }
  raceStart();
  systemChat('A new daily race just started. Wager gems to climb — the gems are still fake, the ladder is still real.');
}

/* ==========================================================================
   Main tick
   ========================================================================== */

let lastChatAt = 0;
let lastBotPersist = 0;

function tick() {
  const now = Date.now();
  world.rev++;

  /* crash */
  if (CRASH.phase === 'betting' && now >= CRASH.phaseEndsAt) crashStartRunning();
  else if (CRASH.phase === 'running') {
    const mult = crashMultAt(now);
    if (mult >= CRASH.crashPoint) crashResolve();
    else {
      for (const bot of world.bots) {
        const bet = bot.crashBet;
        if (!bet || bet.cashed) continue;
        if (mult >= bet.target) crashCashoutBot(bot, bet, bet.target);
      }
      for (const p of world.players.values()) {
        const bet = p.crashBet;
        if (!bet || bet.cashed || bet.roundId !== CRASH.roundId) continue;
        if (bet.auto && mult >= bet.auto) crashCashoutPlayer(p, bet.auto);
      }
    }
  } else if (CRASH.phase === 'crashed' && now >= CRASH.phaseEndsAt) crashStartBetting();

  /* double */
  if (double.phase === 'betting' && now >= double.phaseEndsAt) doubleStartSpin();
  else if (double.phase === 'spinning' && now >= double.phaseEndsAt) doubleStartBetting();

  /* champion */
  if (champion.phase === 'joining') {
    if (now >= champion.phaseEndsAt) championDraw();
    else {
      // bots trickle into the pot while the round is open
      world.bots.forEach((bot) => {
        if (Math.random() < 0.02) {
          const amount = botStake(bot, 20000);
          if (amount >= 50 && amount <= bot.balance) championAdd(bot, amount);
        }
      });
    }
  } else if (champion.phase === 'draw' && now >= champion.phaseEndsAt) championStartJoining();

  /* ambience */
  if (Math.random() < 0.02 && now - lastChatAt > 2500) {
    lastChatAt = now;
    botChat(pick(world.bots), pick(CHAT_LINES));
  }
  if (Math.random() < 0.016) botOpensCase(pick(world.bots));
  if (Math.random() < 0.004) botBattle();

  /* fake online counter drifts with the time of day */
  const hour = new Date().getHours();
  world.fakeOnline = Math.max(700, Math.round(1400 + Math.sin(hour / 3.8) * 420 + rnd(-60, 60)));

  /* race rollover */
  if (now >= world.race.endsAt) raceRollover();

  /* keep bot numbers drifting so the leaderboard/race move */
  if (now - lastBotPersist > 5000) {
    lastBotPersist = now;
    for (const bot of world.bots) {
      if (Math.random() < 0.35) continue;
      bot.balance = Math.max(5000, Math.round(bot.balance + rnd(-8000, 9000)));
      bot.netToday += rnd(-2000, 2400);
      bot.wagered += rnd(500, 6000);
      world.race.participants.set(bot.id, (world.race.participants.get(bot.id) || 0) + rnd(500, 6000));
    }
  }
}

/* ==========================================================================
   Leaderboard + snapshot
   ========================================================================== */

function leaderboard(forPlayer) {
  const rows = world.bots.map((b) => ({
    id: b.id, name: b.name, isBot: true, hue: b.hue, face: b.face,
    level: b.level, value: Math.round(b.balance), netToday: Math.round(b.netToday), you: false,
  }));
  for (const p of world.players.values()) {
    rows.push({
      id: p.id, name: p.name, isBot: false, hue: p.hue, face: p.face,
      level: p.level, value: Math.round(p.balance + invValue(p)),
      netToday: Math.round(p.netToday), you: forPlayer ? p.id === forPlayer.id : false,
    });
  }
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, 15);
}

function highRollers() {
  return world.feed.filter((f) => f.stake >= 5000).slice(0, 10);
}

function stateSnapshot(p, sinceChat, sinceFeed) {
  const sc = Number(sinceChat) || 0;
  const sf = Number(sinceFeed) || 0;
  return {
    rev: world.rev,
    now: Date.now(),
    online: world.fakeOnline + world.players.size,
    you: publicPlayer(p),
    crash: {
      phase: CRASH.phase, roundId: CRASH.roundId, phaseEndsAt: CRASH.phaseEndsAt,
      roundStartAt: CRASH.roundStartAt, growthMs: CRASH.GROWTH_MS, betMs: CRASH.BET_MS,
      crashPoint: CRASH.phase === 'crashed' ? CRASH.crashPoint : null,
      mult: round2(crashMultAt(Date.now())),
      history: world.history.crash.slice(0, 18),
      bets: CRASH.bets.slice(-45).map((b) => ({ ...b })),
      betCount: CRASH.bets.length,
      totalStaked: Math.round(CRASH.bets.reduce((s, b) => s + b.amount, 0)),
    },
    double: {
      phase: double.phase, roundId: double.roundId, phaseEndsAt: double.phaseEndsAt,
      betMs: double.BET_MS, spinMs: double.SPIN_MS,
      result: double.result, winningIndex: double.winningIndex,
      segments: DOUBLE_SEGMENTS, payouts: DOUBLE_PAYOUT,
      history: world.history.double.slice(0, 20),
      betters: [
        ...world.bots.filter((b) => b.doubleBet).map((b) => ({ name: b.name, isBot: true, hue: b.hue, face: b.face, color: b.doubleBet.color, amount: b.doubleBet.amount })),
        ...[...world.players.values()].filter((x) => x.doubleBet).map((x) => ({ name: x.name, isBot: false, you: true, hue: x.hue, face: x.face, color: x.doubleBet.color, amount: x.doubleBet.amount })),
      ],
      totalStaked: [...world.bots].filter((b) => b.doubleBet).reduce((s, b) => s + b.doubleBet.amount, 0),
    },
    champion: {
      phase: champion.phase, roundId: champion.roundId, phaseEndsAt: champion.phaseEndsAt,
      joinMs: champion.JOIN_MS, drawMs: champion.DRAW_MS,
      pot: Math.round(champion.pot),
      contributors: champion.contributors.slice(-40),
      winner: champion.winner, history: champion.history.slice(0, 6),
      myTickets: p ? (p.championTickets || 0) : 0,
    },
    race: raceStandings(p),
    chat: sc ? world.chat.filter((m) => m.seq > sc) : world.chat.slice(-40),
    feed: sf ? world.feed.filter((m) => m.seq > sf) : world.feed.slice(0, 40),
    leaderboard: leaderboard(p),
    highs: highRollers(),
  };
}

/* ==========================================================================
   Persistence
   ========================================================================== */

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await fsp.mkdir(DATA_DIR, { recursive: true });
      const players = [...world.players.values()].map((p) => ({
        id: p.id, name: p.name, hue: p.hue, face: p.face, balance: p.balance,
        inventory: p.inventory.slice(-120), xp: p.xp, level: p.level,
        stats: p.stats, netToday: p.netToday, lastBonusAt: p.lastBonusAt,
        lastFreeCaseAt: p.lastFreeCaseAt, freeCases: p.freeCases, raceWagered: p.raceWagered,
      }));
      await fsp.writeFile(DATA_FILE, JSON.stringify({ players, savedAt: Date.now() }));
    } catch { /* persistence is a nicety, never fatal */ }
  }, 4000);
}

async function loadPlayers() {
  try {
    const raw = await fsp.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    for (const p of data.players || []) {
      world.players.set(p.id, { ...newPlayer(p.id, p.name), ...p, crashBet: null, mines: null, tiles: null });
    }
    console.log(`[clashsim] restored ${world.players.size} profile(s)`);
  } catch { /* no save yet */ }
}

/**
 * Warm the lobby up so the first paint is not a ghost town: simulate a couple
 * of minutes of bot activity, then make sure the drop feed, the round
 * histories and the Champion pot all have something in them.
 */
function seedCaseRow(bot, def) {
  const item = catalog.rollItem(def.id);
  if (!item) return;
  pushFeed({
    type: 'Case', name: bot.name, isBot: true, hue: bot.hue, face: bot.face,
    stake: def.gems, mult: round2(item.value / def.gems), value: item.value,
    profit: item.value - def.gems, detail: `${item.name} (${item.wearShort})`,
    item, caseId: def.id, seeded: true,
  });
}

function warmUpSite() {
  const bots = world.bots;
  for (let i = 0; i < 18; i++) botOpensCase(pick(bots));
  for (let i = 0; i < 3; i++) botBattle();

  // the drop feed should never open on "no drops yet"
  const cheap = catalog.cases.filter((c) => c.gems <= 20000);
  const rich = catalog.cases.filter((c) => c.gems >= 1000);
  for (let i = 0; i < 60 && world.feed.filter((f) => f.type === 'Case').length < 10; i++) {
    seedCaseRow(pick(bots), pick(cheap));
  }
  for (let i = 0; i < 80 && world.feed.filter((f) => f.type === 'Case' && f.value >= 3000).length < 3; i++) {
    seedCaseRow(pick(bots), pick(rich));
  }
  // and the Lucky Wins table needs actual winners in it
  for (let i = 0; i < 80 && world.feed.filter((f) => f.profit > 0 && f.type === 'Case').length < 4; i++) {
    seedCaseRow(pick(bots), pick(cheap));
  }

  for (let i = 0; i < 16; i++) world.history.crash.push(drawCrashPoint());
  for (let i = 0; i < 18; i++) {
    const idx = Math.floor(Math.random() * DOUBLE_SEGMENTS.length);
    world.history.double.push({ result: DOUBLE_SEGMENTS[idx], index: idx, pot: rndInt(4000, 90000) });
  }
  for (let i = 0; i < 12; i++) {
    const bot = pick(bots);
    const amount = botStake(bot, 12000);
    if (amount >= 50 && amount <= bot.balance) championAdd(bot, amount);
  }
  for (let i = 0; i < 5; i++) botChat(pick(bots), pick(CHAT_LINES), true);
}

function boot() {
  world.bots = makeBots(30);
  raceStart();
  crashStartBetting();
  doubleStartBetting();
  championStartJoining();
  warmUpSite();
  setInterval(tick, 100);
  setInterval(scheduleSave, 30000);
  setInterval(() => {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    for (const [id, p] of world.players) if ((p.lastSeen || 0) < cutoff) world.players.delete(id);
  }, 10 * 60 * 1000);
}

module.exports = {
  world, crash, double, champion, CRASH, DOUBLE_SEGMENTS, DOUBLE_PAYOUT, TILES_ROWS,
  crashCashoutPlayer, crashCashoutBot, crashMultAt, drawCrashPoint,
  newPlayer, getPlayer, publicPlayer, addXp, charge, credit, trackWager, invValue,
  pushFeed, pushChat, botChat, systemChat, recordWin,
  leaderboard, stateSnapshot, raceStandings,
  minesMultiplier, minesView, tilesView,
  botStake, botRebuyIfBroke, rnd, rndInt, pick, clamp, round2,
  scheduleSave, loadPlayers, boot,
  BONUS_COOLDOWN_MS, FREE_CASE_COOLDOWN_MS, FREE_CASE_MAX_PRICE,
};
