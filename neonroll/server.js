#!/usr/bin/env node
/**
 * NEONROLL — fake-currency casino simulator
 * ----------------------------------------
 * A zero-dependency Node HTTP server that hosts a fake-currency "skin casino"
 * emulator (case opening, case battles, crash, coinflip, mines) played with
 * invented coins against simulated ("AI") players.
 *
 * HARD RULES BAKED INTO THIS FILE:
 *   - REAL_MONEY_ENABLED is false and there is no code path for deposits,
 *     withdrawals, payments or crypto. Coins are generated for free.
 *   - Every "player" you see in the feed/chat is a bot unless it is the
 *     single human in the browser. Bots are flagged so the UI can label them.
 *   - Games carry a disclosed house edge (like the real sites) so the demo
 *     can honestly show how the maths works over time.
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const REAL_MONEY_ENABLED = false; // there is no real money here. none. zero.
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, '.data');
const DATA_FILE = path.join(DATA_DIR, 'players.json');

/* ==========================================================================
   1. CATALOG — fictional game, fictional weapons, fictional skins
   ========================================================================== */

const RARITIES = {
  common:    { label: 'Common',    color: '#8b96a8', tier: 0 },
  uncommon:  { label: 'Uncommon',  color: '#3ea6ff', tier: 1 },
  rare:      { label: 'Rare',      color: '#8b5cf6', tier: 2 },
  epic:      { label: 'Epic',      color: '#ff4d97', tier: 3 },
  legendary: { label: 'Legendary', color: '#ffa726', tier: 4 },
  exotic:    { label: 'Exotic',    color: '#ff3b3b', tier: 5 },
};

const WEAPONS = [
  'Vector-9', 'Nova-90', 'Ripcord', 'Hexbow', 'Vandal-77',
  'Sidewinder', 'Hailmaker', 'Tally-Ho', 'Torque', 'Longbow-X',
];

const SKINS_BY_RARITY = {
  common:    ['Ash Grey', 'Dust Cover', 'Field Worn', 'Painted Steel', 'Cardboard Cut'],
  uncommon:  ['Cobalt Hex', 'Static Haze', 'Pine Camo', 'Blue Shift', 'Taped Up'],
  rare:      ['Glacier Fade', 'Toxic Bloom', 'Sunset Drive', 'Circuit Board', 'Deep Water'],
  epic:      ['Vaporwave', 'Molten Core', 'Blood Moon', 'Prism Shift', 'Neon Wraith'],
  legendary: ['Holo Bloom', 'Aurora Borealis', 'Dragon Scale', 'Midnight Star', 'Golden Hour'],
  exotic:    ['StatTrak-Style Rift', 'Quantum Splinter', 'Singularity', 'Event Horizon', 'God Roll'],
};

// Drop rates + value multipliers (as multiples of the case price), chosen so
// that each case returns ~90% of what it costs to open. That is exactly how
// real case sites are priced — the demo just tells you the number out loud.
const DROP_TABLE = [
  { rarity: 'common',    weight: 0.8000, mult: 0.30 },
  { rarity: 'uncommon',  weight: 0.1600, mult: 0.90 },
  { rarity: 'rare',      weight: 0.0320, mult: 3.00 },
  { rarity: 'epic',      weight: 0.0065, mult: 12.0 },
  { rarity: 'legendary', weight: 0.0012, mult: 60.0 },
  { rarity: 'exotic',    weight: 0.0003, mult: 0 }, // solved at load time
];

const TARGET_RETURN = 0.90;
(function solveExotic() {
  const exotic = DROP_TABLE.find((d) => d.rarity === 'exotic');
  const partial = DROP_TABLE.filter((d) => d !== exotic)
    .reduce((sum, d) => sum + d.weight * d.mult, 0);
  exotic.mult = Math.max(200, (TARGET_RETURN - partial) / exotic.weight);
})();

const CASES = [
  { id: 'bronze',  name: 'Bronze Crate',   price: 25,     accent: '#c98a3c', blurb: 'Cheap, cheerful, mostly grey.' },
  { id: 'neon',    name: 'Neon Case',      price: 100,    accent: '#37f5a0', blurb: "The site's bread and butter." },
  { id: 'glacier', name: 'Glacier Case',   price: 500,    accent: '#3ea6ff', blurb: 'Cold pulls, colder odds.' },
  { id: 'molten',  name: 'Molten Case',    price: 2500,   accent: '#ff6b35', blurb: 'Where the clips come from.' },
  { id: 'quantum', name: 'Quantum Case',   price: 10000,  accent: '#a78bfa', blurb: 'Big boy territory.' },
  { id: 'vault',   name: 'Legacy Vault',   price: 50000,  accent: '#ffd166', blurb: 'One click, one mortgage.' },
];

const BOT_NAMES = [
  'ShadowByte', 'KryptoKid', 'NovaPrime', 'GlitchGoblin', 'zeroTwo', 'LuckyLars',
  'TiltedTimmy', 'MidnightMaggie', 'VoidWalker77', 'PrismPete', 'TurboTaco',
  'NeonNinja', 'FrostbiteFox', 'BlockHedger', 'PixelPirate', 'DegenDaisy',
  'SlipperySid', 'RocketRhea', 'StaticSam', 'GraylineGabe', 'OmegaOllie',
  'VelvetVex', 'CobaltKai', 'RustyRaccoon', 'HauntedHazel', 'ZephyrZed',
  'MochaMike', 'BitterBetty', 'CosmicCrab', 'WashedWally', 'SparkyStella',
  'LucidLouie', 'TinyTitan', 'PhantomPhil', 'CursedCass', 'MoonShotMax',
  'ZigZagZoe', 'CalmCarl', 'DoomedDerek', 'PeachyPam', 'GhostGwen',
  'SketchySteve', 'FinalFormFinn', 'JellybeanJim', 'RatchetRina', 'OnyxOscar',
];

const BOT_TITLES = [
  'Case grinder', 'Crash main', 'Rake collector', 'First-round soldier',
  'Hopium dealer', 'Grey-pull veteran', 'Sold at 1.2x', 'Rebuy enjoyer',
];

const CHAT_NEUTRAL = [
  'gl everyone', 'anyone else lagging or just me', 'this case is cursed i swear',
  'chat is quiet today', 'brb coffee', 'who else only sells at 1.3x',
  'i am up 12k and i will lose it in 4 minutes', 'nice site btw',
  'remember these coins are fake, the sadness is real',
  'fun fact: a 10% edge eats your whole stack eventually',
  'i sold at 1.02 and it went to 40x. every time.',
  'is there a deposit button?? there is not?? good',
  'my strategy is vibes', 'one more case then bed (a lie)',
  'this is basically maths class with neon lights',
];

const CHAT_LOW_CRASH = ['rip', 'instant rug', 'of course', 'brutal', 'my 1.01 sold?? no it did not', 'sigh', 'unlucky', 'house does not miss'];
const CHAT_HIGH_CRASH = ['called it', 'i sold at 1.4 ffs', 'W', 'that was a 60x and i watched', 'ok that one hurt', 'somebody hit big'];

const BOT_TAGS_PUBLIC = true; // bots carry a visible BOT badge (transparency)

/* ==========================================================================
   2. HELPERS
   ========================================================================== */

const rnd = (a, b) => a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (n) => Math.round(n * 100) / 100;
const uid = () => crypto.randomBytes(8).toString('hex');

function weightedPick(table) {
  const total = table.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of table) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return table[table.length - 1];
}

function sanitizeText(str, max) {
  return String(str == null ? '' : str)
    .replace(/[<>&"'`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Build a fake skin item for a case. Pure RNG, nothing is "provably fair". */
function rollItem(caseDef) {
  const drop = weightedPick(DROP_TABLE);
  const rarity = drop.rarity;
  const weapon = pick(WEAPONS);
  const skin = pick(SKINS_BY_RARITY[rarity]);
  const variance = rnd(0.72, 1.32);
  const value = Math.max(1, Math.round(caseDef.price * drop.mult * variance));
  return {
    id: uid(),
    name: `${weapon} | ${skin}`,
    weapon,
    skin,
    rarity,
    value,
    caseId: caseDef.id,
    seed: rndInt(0, 99999),
    ts: Date.now(),
  };
}

/* ==========================================================================
   3. WORLD STATE
   ========================================================================== */

const world = {
  rev: 1,
  startedAt: Date.now(),
  bots: [],
  feed: [],
  chat: [],
  players: new Map(),   // pid -> player
  fakeOnline: 0,
};

let feedSeq = 1;
let chatSeq = 1;

/* --------------------------------------------------------------------------
   3a. Bots — the "fake AI players"
   -------------------------------------------------------------------------- */

function makeBots(n) {
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, n);
  return names.map((name, i) => ({
    id: 'bot_' + i,
    name,
    isBot: true,
    title: pick(BOT_TITLES),
    hue: rndInt(0, 359),
    face: rndInt(0, 11),
    balance: Math.round(rnd(2500, 240000)),
    level: rndInt(3, 74),
    wagered: 0,
    netToday: 0,
    crashBet: null,
    lastChatAt: 0,
    patience: rnd(0.55, 0.95), // how often they actually bet a round
    style: pick(['early', 'early', 'mid', 'mid', 'greedy', 'degen']),
    lastCaseAt: 0,
  }));
}

function botCashoutTarget(bot) {
  switch (bot.style) {
    case 'early': return round2(rnd(1.05, 1.9));
    case 'mid': return round2(rnd(1.9, 4.5));
    case 'greedy': return round2(rnd(3, 12));
    case 'degen': return pick([1.2, 1.5, 2, 5, 10, 25, 60]);
    default: return 2;
  }
}

function botStake(bot) {
  const max = Math.min(bot.balance * 0.08, 25000);
  const min = Math.max(10, Math.min(bot.balance * 0.002, 250));
  if (max <= min) return Math.round(Math.max(10, bot.balance * 0.05));
  return Math.round(rnd(min, max));
}

function botRebuyIfBroke(bot) {
  if (bot.balance < 250) {
    // Bots "rebuy" instantly because they are bots and none of this is real.
    bot.balance += rndInt(2500, 25000);
  }
}

/* --------------------------------------------------------------------------
   3b. Feed + chat
   -------------------------------------------------------------------------- */

function pushFeed(ev) {
  const entry = { seq: feedSeq++, ts: Date.now(), ...ev };
  world.feed.unshift(entry);
  if (world.feed.length > 80) world.feed.length = 80;
  world.rev++;
  return entry;
}

function pushChat(entry) {
  const msg = { seq: chatSeq++, ts: Date.now(), ...entry };
  world.chat.push(msg);
  if (world.chat.length > 90) world.chat.shift();
  world.rev++;
  return msg;
}

function botChat(bot, text, force) {
  const now = Date.now();
  if (!force && now - bot.lastChatAt < 6000) return;
  bot.lastChatAt = now;
  pushChat({ name: bot.name, isBot: true, hue: bot.hue, face: bot.face, text });
}

function systemChat(text) {
  pushChat({ name: 'NEONROLL', isBot: true, system: true, hue: 150, face: 0, text });
}

/* --------------------------------------------------------------------------
   3c. Crash round engine
   -------------------------------------------------------------------------- */

const CRASH = {
  BET_MS: 6500,
  CRASHED_MS: 4200,
  GROWTH_MS: 9000,   // time to double
  MAX_CRASH: 120,
  phase: 'betting',
  roundId: 1,
  phaseEndsAt: 0,
  roundStartAt: 0,
  crashPoint: null,
  history: [],
  bets: [],
  tickAt: 0,
};

function drawCrashPoint() {
  const u = Math.random();
  if (u < 0.01) return 1.0;                   // 1% instant bust
  const cp = 0.99 / (1 - u);
  return clamp(round2(cp), 1.0, CRASH.MAX_CRASH);
}

function crashMultAt(ts) {
  if (CRASH.phase !== 'running') return CRASH.phase === 'crashed' ? CRASH.crashPoint : 1;
  const elapsed = Math.max(0, ts - CRASH.roundStartAt);
  return Math.pow(2, elapsed / CRASH.GROWTH_MS);
}

function startBettingPhase() {
  CRASH.phase = 'betting';
  CRASH.crashPoint = null;
  CRASH.bets = [];
  CRASH.phaseEndsAt = Date.now() + CRASH.BET_MS;
  CRASH.roundId++;

  // clear last round's human bets (they are settled once the round busts)
  for (const p of world.players.values()) p.crashBet = null;

  const bots = world.bots;
  for (const bot of bots) {
    bot.crashBet = null;
    if (Math.random() > bot.patience) continue;
    const amount = botStake(bot);
    if (amount < 10 || amount > bot.balance) continue;
    bot.balance -= amount;
    bot.wagered += amount;
    bot.crashBet = { amount, target: botCashoutTarget(bot), cashed: null, payout: 0 };
    CRASH.bets.push({
      id: bot.id, name: bot.name, isBot: true, hue: bot.hue, face: bot.face,
      amount, cashedAt: null, payout: 0,
    });
  }
  addPlayerBetsToRound();
}

function addPlayerBetsToRound() {
  for (const p of world.players.values()) {
    if (p.crashBet && p.crashBet.roundId === CRASH.roundId) {
      CRASH.bets.push({
        id: p.id, name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
        amount: p.crashBet.amount, cashedAt: null, payout: 0,
      });
    }
  }
}

function startRunningPhase() {
  CRASH.phase = 'running';
  CRASH.roundStartAt = Date.now();
  CRASH.crashPoint = drawCrashPoint();
  CRASH.phaseEndsAt = 0;
  world.rev++;
}

function resolveCrash() {
  CRASH.phase = 'crashed';
  CRASH.phaseEndsAt = Date.now() + CRASH.CRASHED_MS;
  const cp = CRASH.crashPoint;
  CRASH.history.unshift(cp);
  if (CRASH.history.length > 24) CRASH.history.length = 24;

  for (const bet of CRASH.bets) {
    if (bet.cashedAt) continue;
    if (bet.isBot) {
      const bot = world.bots.find((b) => b.id === bet.id);
      if (bot) {
        bot.netToday -= bet.amount;
        botRebuyIfBroke(bot);
      }
    } else {
      const p = world.players.get(bet.id);
      if (p) {
        if (p.crashBet) p.crashBet.busted = true; // keep it visible until the next round
        p.stats.lost += bet.amount;
        p.netToday -= bet.amount;
      }
    }
  }

  if (cp < 1.25) {
    const speakers = world.bots.slice().sort(() => Math.random() - 0.5).slice(0, 2);
    speakers.forEach((b, i) => setTimeout(() => botChat(b, pick(CHAT_LOW_CRASH), true), i * 700));
  } else if (cp >= 8) {
    const speaker = pick(world.bots);
    setTimeout(() => botChat(speaker, pick(CHAT_HIGH_CRASH), true), 400);
  }
  world.rev++;
}

function cashOutBot(bot, bet, mult) {
  bet.cashed = mult;
  const payout = round2(bet.amount * mult);
  bet.payout = payout;
  bot.balance += payout;
  bot.netToday += payout - bet.amount;
  bot.crashBet = null;

  const entry = CRASH.bets.find((b) => b.id === bot.id);
  if (entry) { entry.cashedAt = mult; entry.payout = payout; }

  if (mult >= 1.5) {
    pushFeed({
      type: 'crash', name: bot.name, isBot: true, hue: bot.hue, face: bot.face,
      value: payout, profit: payout - bet.amount, mult, text: `cashed out at ${mult.toFixed(2)}x`,
    });
  }
}

function cashOutPlayer(p, mult) {
  const bet = p.crashBet;
  if (!bet || bet.cashed) return;
  const payout = round2(bet.amount * mult);
  bet.cashed = mult;
  creditWin(p, payout);
  const entry = CRASH.bets.find((b) => b.id === p.id);
  if (entry) { entry.cashedAt = mult; entry.payout = payout; }
  pushFeed({
    type: 'crash', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
    value: payout, profit: payout - bet.amount, mult, text: `cashed out at ${mult.toFixed(2)}x (auto)`,
  });
  scheduleSave();
}

/* --------------------------------------------------------------------------
   3d. Bot ambience (case openings, coinflips, chats)
   -------------------------------------------------------------------------- */

function botOpensCase(bot) {
  const affordable = CASES.filter((c) => c.price <= Math.max(bot.balance, 1) * 0.25);
  const caseDef = affordable.length ? pick(affordable) : CASES[0];
  if (bot.balance < caseDef.price) return;
  bot.balance -= caseDef.price;
  bot.wagered += caseDef.price;
  const item = rollItem(caseDef);
  const profit = item.value - caseDef.price;
  bot.netToday += profit;
  if (profit > 0) bot.balance += item.value;
  else botRebuyIfBroke(bot);

  if (item.value >= caseDef.price * 2.5) {
    pushFeed({
      type: 'case', name: bot.name, isBot: true, hue: bot.hue, face: bot.face,
      item: item.name, rarity: item.rarity, value: item.value, caseId: caseDef.id,
      text: `unboxed from ${caseDef.name}`,
    });
    const speaker = pick(world.bots);
    setTimeout(() => botChat(speaker, pick(['insane pull', 'gg', 'that is a clip', 'give me that luck', 'no way']), true), 600);
  }
}

function botCoinflips(botA, botB) {
  const stake = Math.round(rnd(50, 2500));
  const flip = Math.random() < 0.5 ? 'heads' : 'tails';
  const aSide = Math.random() < 0.5 ? 'heads' : 'tails';
  const winner = aSide === flip ? botA : botB;
  const loser = winner === botA ? botB : botA;
  const payout = round2(stake * 1.95);
  winner.balance += payout;
  winner.netToday += payout - stake;
  loser.balance -= stake;
  loser.netToday -= stake;
  pushFeed({
    type: 'coinflip', name: winner.name, isBot: true, hue: winner.hue, face: winner.face,
    value: payout, profit: payout - stake, text: `won a coinflip vs ${loser.name}`,
  });
  botRebuyIfBroke(loser);
}

function botBattle() {
  const caseDef = pick(CASES.slice(1, 4));
  const count = rndInt(1, 3);
  const bots = world.bots.slice().sort(() => Math.random() - 0.5).slice(0, 2);
  const [a, b] = bots;
  const roll = () => Array.from({ length: count }, () => rollItem(caseDef));
  const itemsA = roll();
  const itemsB = roll();
  const totalA = itemsA.reduce((s, i) => s + i.value, 0);
  const totalB = itemsB.reduce((s, i) => s + i.value, 0);
  const winner = totalA === totalB ? a : (totalA > totalB ? a : b);
  const loser = winner === a ? b : a;
  const winnerTotal = winner === a ? totalA : totalB;
  const loserTotal = winner === a ? totalB : totalA;
  const cost = caseDef.price * count;
  winner.balance += winnerTotal - cost;
  loser.balance -= cost;
  winner.netToday += winnerTotal - cost;
  loser.netToday -= cost;
  pushFeed({
    type: 'battle', name: winner.name, isBot: true, hue: winner.hue, face: winner.face,
    value: winnerTotal, profit: winnerTotal - cost, caseId: caseDef.id,
    text: `won a ${count}x ${caseDef.name} battle vs ${loser.name} (${Math.round(winnerTotal)} vs ${Math.round(loserTotal)})`,
  });
  botRebuyIfBroke(loser);
}

/* --------------------------------------------------------------------------
   3e. Main world tick (100ms)
   -------------------------------------------------------------------------- */

let lastChatAt = 0;

function worldTick() {
  const now = Date.now();
  CRASH.tickAt = now;

  /* --- round state machine --- */
  if (CRASH.phase === 'betting' && now >= CRASH.phaseEndsAt) {
    startRunningPhase();
  } else if (CRASH.phase === 'running') {
    const mult = crashMultAt(now);
    if (mult >= CRASH.crashPoint) {
      resolveCrash();       // everyone still in busts, no exceptions
    } else {
      // bots cash out at their scripted targets
      for (const bot of world.bots) {
        const bet = bot.crashBet;
        if (!bet || bet.cashed) continue;
        if (mult >= bet.target) cashOutBot(bot, bet, bet.target);
      }
      // humans cash out at their auto targets (server-side, so a backgrounded tab can't miss it)
      for (const p of world.players.values()) {
        const bet = p.crashBet;
        if (!bet || bet.cashed || bet.roundId !== CRASH.roundId) continue;
        if (bet.auto && mult >= bet.auto) cashOutPlayer(p, bet.auto);
      }
    }
  } else if (CRASH.phase === 'crashed' && now >= CRASH.phaseEndsAt) {
    startBettingPhase();
  }

  /* --- bot ambience --- */
  if (Math.random() < 0.030 && now - lastChatAt > 1400) {
    lastChatAt = now;
    const bot = pick(world.bots);
    botChat(bot, pick(CHAT_NEUTRAL));
  }
  if (Math.random() < 0.012) botOpensCase(pick(world.bots));
  if (Math.random() < 0.0035) {
    const [a, b] = world.bots.slice().sort(() => Math.random() - 0.5);
    botCoinflips(a, b);
  }
  if (Math.random() < 0.0035) botBattle();

  /* --- fake online counter drifts --- */
  const hour = new Date().getHours();
  const base = 620 + Math.round(Math.sin(hour / 3.8) * 180);
  world.fakeOnline = Math.max(180, Math.round(base + rnd(-40, 40)));

  world.rev++;
}

/* ==========================================================================
   4. PLAYERS (one human per browser, keyed by a local random id)
   ========================================================================== */

const XP_PER_LEVEL = 250;

function levelFromXp(xp) {
  return Math.floor(Math.pow(Math.max(0, xp) / XP_PER_LEVEL, 2 / 3)) + 1;
}
function xpForLevel(level) {
  return Math.round(XP_PER_LEVEL * Math.pow(level - 1, 1.5));
}

function newPlayer(pid, name) {
  return {
    id: pid,
    name: name || 'Player_' + pid.slice(0, 4),
    hue: rndInt(0, 359),
    face: rndInt(0, 11),
    balance: 2500,
    inventory: [],
    xp: 0,
    level: 1,
    lastBonusAt: 0,
    stats: { wagered: 0, won: 0, lost: 0, opened: 0, biggestWin: 0, rounds: 0 },
    netToday: 0,
    crashBet: null,
    mines: null,
    coinflipHistory: [],
    chatAt: 0,
    lastSeen: Date.now(),
  };
}

function playerPublic(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    hue: p.hue,
    face: p.face,
    balance: Math.round(p.balance * 100) / 100,
    inventory: p.inventory.slice(-90),
    invCount: p.inventory.length,
    invValue: Math.round(p.inventory.reduce((s, i) => s + i.value, 0)),
    xp: p.xp,
    level: p.level,
    xpNext: xpForLevel(p.level + 1),
    xpPrev: xpForLevel(p.level),
    stats: p.stats,
    netToday: Math.round(p.netToday),
    bonusIn: Math.max(0, Math.ceil((120000 - (Date.now() - p.lastBonusAt)) / 1000)),
    crashBet: p.crashBet
      ? {
        amount: p.crashBet.amount,
        roundId: p.crashBet.roundId,
        cashedAt: p.crashBet.cashed || null,
        busted: !!p.crashBet.busted,
      }
      : null,
    mines: p.mines ? minesPublic(p.mines) : null,
    coinflipHistory: p.coinflipHistory.slice(0, 12),
  };
}

function getPlayer(pid) {
  if (!pid) return null;
  let p = world.players.get(pid);
  if (p) p.lastSeen = Date.now();
  return p || null;
}

function addXp(p, amount) {
  p.xp += amount;
  const lvl = levelFromXp(p.xp);
  if (lvl > p.level) {
    const gained = lvl - p.level;
    p.level = lvl;
    const reward = gained * lvl * 150;
    p.balance += reward;
    pushFeed({
      type: 'level', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
      value: reward, text: `reached level ${lvl} (+${reward} coins)`,
    });
    systemChat(`@${p.name} just reached level ${lvl}. Free fake coins awarded: ${reward}.`);
  }
}

function creditWin(p, amount) {
  p.balance += amount;
  p.stats.won += amount;
  p.netToday += amount;
  if (amount > p.stats.biggestWin) p.stats.biggestWin = Math.round(amount);
}

function chargeBet(p, amount) {
  p.balance -= amount;
  p.stats.wagered += amount;
  p.stats.rounds++;
  addXp(p, Math.max(1, Math.round(amount / 8)));
}

/* --------------------------------------------------------------------------
   4a. Mines (server-authoritative board)
   -------------------------------------------------------------------------- */

function minesMultiplier(mineCount, revealed) {
  // fair = C(25,k) / C(25-m,k); we apply a 3% rake like the real sites do.
  let fair = 1;
  for (let i = 0; i < revealed; i++) fair *= (25 - i) / (25 - mineCount - i);
  return round2(fair * 0.97);
}

function minesPublic(m) {
  return {
    active: m.active,
    bet: m.bet,
    mineCount: m.mineCount,
    revealed: m.revealed.slice(),
    mines: m.active ? [] : m.mines.slice(),
    nextMult: m.active ? minesMultiplier(m.mineCount, m.revealed.length + 1) : 1,
    curMult: m.active ? minesMultiplier(m.mineCount, m.revealed.length) : 1,
  };
}

/* ==========================================================================
   5. LEADERBOARD
   ========================================================================== */

function leaderboard(forPlayer) {
  const rows = world.bots.map((b) => ({
    id: b.id, name: b.name, isBot: true, hue: b.hue, face: b.face,
    level: b.level, value: Math.round(b.balance), netToday: Math.round(b.netToday),
    you: false,
  }));
  for (const p of world.players.values()) {
    rows.push({
      id: p.id, name: p.name, isBot: false, hue: p.hue, face: p.face,
      level: p.level, value: Math.round(p.balance + p.inventory.reduce((s, i) => s + i.value, 0)),
      netToday: Math.round(p.netToday), you: forPlayer ? p.id === forPlayer.id : false,
    });
  }
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, 12);
}

/* ==========================================================================
   6. PERSISTENCE (best effort, keeps your balance across restarts)
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
      }));
      await fsp.writeFile(DATA_FILE, JSON.stringify({ players, savedAt: Date.now() }));
    } catch (err) {
      /* persistence is a nicety, never fatal */
    }
  }, 3000);
}

async function loadPlayers() {
  try {
    const raw = await fsp.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    for (const p of data.players || []) {
      world.players.set(p.id, {
        ...newPlayer(p.id, p.name),
        ...p,
        crashBet: null,
        mines: null,
        coinflipHistory: [],
      });
    }
    console.log(`[neonroll] restored ${world.players.size} player profile(s)`);
  } catch {
    /* no save file yet */
  }
}

/* ==========================================================================
   7. HTTP LAYER
   ========================================================================== */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 64 * 1024) { tooBig = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooBig) return resolve({});
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(buf);
  });
}

function casePayload(caseDef) {
  return {
    id: caseDef.id,
    name: caseDef.name,
    price: caseDef.price,
    accent: caseDef.accent,
    blurb: caseDef.blurb,
    returnRate: TARGET_RETURN,
    drops: DROP_TABLE.map((d) => ({ rarity: d.rarity, chance: d.weight, mult: round2(d.mult) })),
    preview: PREVIEW_ITEMS[caseDef.id] || [],
  };
}

const PREVIEW_ITEMS = {};
for (const c of CASES) {
  const items = [];
  for (const d of DROP_TABLE) {
    // a stable-ish "best known pull" per rarity for the case contents list
    const weapon = WEAPONS[(d.rarity.length + c.id.length) % WEAPONS.length];
    const skin = SKINS_BY_RARITY[d.rarity][c.id.length % SKINS_BY_RARITY[d.rarity].length];
    items.push({
      id: `${c.id}-${d.rarity}`,
      name: `${weapon} | ${skin}`,
      rarity: d.rarity,
      value: Math.max(1, Math.round(c.price * d.mult)),
      seed: (c.id.length * 977 + d.rarity.length * 31) % 9999,
    });
  }
  PREVIEW_ITEMS[c.id] = items;
}

/* --------------------------------------------------------------------------
   7a. Game actions
   -------------------------------------------------------------------------- */

function actionCrashBet(p, body) {
  if (CRASH.phase !== 'betting') return { error: 'Too late — that round already started. Nothing was taken from your balance.' };
  if (p.crashBet) return { error: 'You already have a bet on this round.' };
  const amount = Math.floor(Number(body.amount));
  if (!Number.isFinite(amount) || amount < 10) return { error: 'Minimum bet is 10 coins.' };
  if (amount > p.balance) return { error: 'Not enough coins.' };
  const auto = Number(body.auto);
  chargeBet(p, amount);
  p.crashBet = {
    amount,
    roundId: CRASH.roundId,
    cashed: null,
    auto: Number.isFinite(auto) && auto > 1.01 ? round2(auto) : null,
  };
  CRASH.bets.push({
    id: p.id, name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
    amount, cashedAt: null, payout: 0,
  });
  world.rev++;
  scheduleSave();
  return { ok: true };
}

function actionCrashCashout(p) {
  if (CRASH.phase !== 'running') return { error: 'No round in progress.' };
  const bet = p.crashBet;
  if (!bet || bet.roundId !== CRASH.roundId) return { error: 'You have no bet in this round.' };
  if (bet.cashed) return { error: 'Already cashed out.' };
  const mult = clamp(round2(crashMultAt(Date.now())), 1, CRASH.crashPoint);
  const payout = round2(bet.amount * mult);
  bet.cashed = mult;
  creditWin(p, payout);
  const entry = CRASH.bets.find((b) => b.id === p.id);
  if (entry) { entry.cashedAt = mult; entry.payout = payout; }
  pushFeed({
    type: 'crash', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
    value: payout, profit: payout - bet.amount, mult, text: `cashed out at ${mult.toFixed(2)}x`,
  });
  world.rev++;
  scheduleSave();
  return { ok: true, mult, payout };
}

function actionCoinflip(p, body) {
  const amount = Math.floor(Number(body.amount));
  const side = body.side === 'tails' ? 'tails' : 'heads';
  if (!Number.isFinite(amount) || amount < 10) return { error: 'Minimum bet is 10 coins.' };
  if (amount > p.balance) return { error: 'Not enough coins.' };

  const opponent = pick(world.bots);
  const opponentSide = side === 'heads' ? 'tails' : 'heads';
  const flip = Math.random() < 0.5 ? 'heads' : 'tails';
  const youWin = flip === side;

  chargeBet(p, amount);
  const payout = round2(amount * 1.95);   // 2.5% rake, same as the real sites
  if (youWin) creditWin(p, payout);
  else p.netToday -= amount;

  // the bot plays the other side, so its balance moves inverse to yours
  if (youWin) {
    opponent.balance -= amount;
    opponent.netToday -= amount;
  } else {
    opponent.balance += payout;
    opponent.netToday += payout - amount;
  }
  botRebuyIfBroke(opponent);

  const record = {
    id: uid(), side, opponentSide, flip, amount, payout: youWin ? payout : 0,
    opponent: opponent.name, win: youWin, ts: Date.now(),
  };
  p.coinflipHistory.unshift(record);
  if (p.coinflipHistory.length > 12) p.coinflipHistory.length = 12;

  if (youWin && amount >= 200) {
    pushFeed({
      type: 'coinflip', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
      value: payout, profit: payout - amount, text: `won a coinflip vs ${opponent.name}`,
    });
  }
  world.rev++;
  scheduleSave();
  return { ok: true, result: record, you: playerPublic(p) };
}

function actionCaseOpen(p, body) {
  const caseDef = CASES.find((c) => c.id === body.caseId);
  if (!caseDef) return { error: 'Unknown case.' };
  const count = clamp(Math.floor(Number(body.count) || 1), 1, 5);
  const cost = caseDef.price * count;
  if (cost > p.balance) return { error: 'Not enough coins for that.' };
  chargeBet(p, cost);

  const items = [];
  let refund = 0;
  for (let i = 0; i < count; i++) {
    const item = rollItem(caseDef);
    p.inventory.push(item);
    p.stats.opened++;
    items.push(item);
    refund += item.value;
    if (item.value >= caseDef.price * 2.5) {
      pushFeed({
        type: 'case', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
        item: item.name, rarity: item.rarity, value: item.value, caseId: caseDef.id,
        text: `unboxed from ${caseDef.name}`,
      });
    }
  }
  p.netToday += refund - cost;
  if (refund > cost && refund - cost > p.stats.biggestWin) p.stats.biggestWin = Math.round(refund - cost);
  world.rev++;
  scheduleSave();
  return { ok: true, items, cost, refund, you: playerPublic(p) };
}

function actionBattle(p, body) {
  const caseDef = CASES.find((c) => c.id === body.caseId);
  if (!caseDef) return { error: 'Unknown case.' };
  const count = clamp(Math.floor(Number(body.count) || 1), 1, 3);
  const cost = caseDef.price * count;
  if (cost > p.balance) return { error: 'Not enough coins for that battle.' };

  const opponent = pick(world.bots);
  chargeBet(p, cost);

  const mine = Array.from({ length: count }, () => rollItem(caseDef));
  const theirs = Array.from({ length: count }, () => rollItem(caseDef));
  const myTotal = mine.reduce((s, i) => s + i.value, 0);
  const theirTotal = theirs.reduce((s, i) => s + i.value, 0);
  // ties go to the human — the only break you get in this simulation
  const win = myTotal >= theirTotal;
  const pot = myTotal + theirTotal;

  if (win) {
    // winner takes both piles (that's the whole point of a battle)
    for (const item of mine) p.inventory.push(item);
    for (const item of theirs) { item.viaBattle = true; p.inventory.push(item); }
    p.stats.won += pot;
    p.netToday += pot - cost;
    if (pot - cost > p.stats.biggestWin) p.stats.biggestWin = Math.round(pot - cost);
    opponent.balance -= theirTotal;
    opponent.netToday -= theirTotal;
  } else {
    // loser's pile goes to the bot, player keeps nothing from the battle
    p.netToday -= cost;
    p.stats.lost += cost;
    opponent.balance += pot;
    opponent.netToday += pot - cost;
  }
  botRebuyIfBroke(opponent);

  pushFeed({
    type: 'battle', name: win ? p.name : opponent.name, isBot: !win, you: win,
    hue: win ? p.hue : opponent.hue, face: win ? p.face : opponent.face,
    value: pot, profit: win ? pot - cost : -cost, caseId: caseDef.id,
    text: `won a ${count}x ${caseDef.name} battle vs ${win ? opponent.name : p.name}`,
  });
  world.rev++;
  scheduleSave();

  return {
    ok: true,
    win,
    pot,
    cost,
    yourPile: { name: p.name, hue: p.hue, face: p.face, items: mine, total: myTotal },
    oppPile: { name: opponent.name, hue: opponent.hue, face: opponent.face, items: theirs, total: theirTotal },
    you: playerPublic(p),
  };
}

function actionMinesStart(p, body) {
  if (p.mines && p.mines.active) return { error: 'Finish your current mines round first.' };
  const bet = Math.floor(Number(body.bet));
  const mineCount = clamp(Math.floor(Number(body.mines) || 3), 1, 5);
  if (!Number.isFinite(bet) || bet < 10) return { error: 'Minimum bet is 10 coins.' };
  if (bet > p.balance) return { error: 'Not enough coins.' };

  chargeBet(p, bet);
  const cells = Array.from({ length: 25 }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  p.mines = { active: true, bet, mineCount, mines: cells.slice(0, mineCount), revealed: [] };
  world.rev++;
  scheduleSave();
  return { ok: true, mines: minesPublic(p.mines), you: playerPublic(p) };
}

function actionMinesPick(p, body) {
  const m = p.mines;
  if (!m || !m.active) return { error: 'No active mines round.' };
  const tile = Math.floor(Number(body.tile));
  if (!(tile >= 0 && tile < 25)) return { error: 'Bad tile.' };
  if (m.revealed.includes(tile)) return { error: 'Already revealed.' };

  if (m.mines.includes(tile)) {
    m.active = false;
    p.netToday -= m.bet;
    pushFeed({
      type: 'mines', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
      value: 0, profit: -m.bet, text: `hit a mine on ${m.mineCount}-mine mines`,
    });
    const result = { bom: true, tile, mines: m.mines.slice(), bet: m.bet };
    p.mines = { ...m, active: false };
    scheduleSave();
    // bots react like a real chat would
    const speaker = pick(world.bots);
    setTimeout(() => botChat(speaker, pick(['rip', 'oof', 'one more tile next time', 'F']), true), 350);
    return { ok: true, result, mines: minesPublic(p.mines), you: playerPublic(p) };
  }

  m.revealed.push(tile);
  const mult = minesMultiplier(m.mineCount, m.revealed.length);
  const cleared = m.revealed.length === 25 - m.mineCount;
  if (cleared) {
    const payout = round2(m.bet * mult);
    creditWin(p, payout);
    m.active = false;
    pushFeed({
      type: 'mines', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
      value: payout, profit: payout - m.bet, mult, text: `cleared the board at ${mult.toFixed(2)}x`,
    });
    scheduleSave();
    return { ok: true, result: { cleared: true, mult, payout }, mines: minesPublic(p.mines), you: playerPublic(p) };
  }
  world.rev++;
  return { ok: true, result: { safe: true, tile, mult }, mines: minesPublic(p.mines), you: playerPublic(p) };
}

function actionMinesCashout(p) {
  const m = p.mines;
  if (!m || !m.active || m.revealed.length === 0) return { error: 'Nothing to cash out.' };
  const mult = minesMultiplier(m.mineCount, m.revealed.length);
  const payout = round2(m.bet * mult);
  creditWin(p, payout);
  m.active = false;
  if (payout >= m.bet * 2) {
    pushFeed({
      type: 'mines', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
      value: payout, profit: payout - m.bet, mult, text: `cashed out mines at ${mult.toFixed(2)}x`,
    });
  }
  scheduleSave();
  return { ok: true, payout, mult, mines: minesPublic(p.mines), you: playerPublic(p) };
}

function actionSell(p, body) {
  const idx = p.inventory.findIndex((i) => i.id === body.itemId);
  if (idx === -1) return { error: 'Item not found.' };
  const item = p.inventory[idx];
  p.inventory.splice(idx, 1);
  p.balance += item.value;
  p.netToday += item.value;
  world.rev++;
  scheduleSave();
  return { ok: true, sold: item, you: playerPublic(p) };
}

function actionSellAll(p) {
  const total = p.inventory.reduce((s, i) => s + i.value, 0);
  const count = p.inventory.length;
  p.inventory = [];
  p.balance += total;
  p.netToday += total;
  world.rev++;
  scheduleSave();
  return { ok: true, total, count, you: playerPublic(p) };
}

function actionBonus(p) {
  const now = Date.now();
  const wait = 120000 - (now - p.lastBonusAt);
  if (wait > 0) return { error: `Free coin drop ready in ${Math.ceil(wait / 1000)}s.` };
  p.lastBonusAt = now;
  const amount = rndInt(400, 900);
  p.balance += amount;
  scheduleSave();
  return { ok: true, amount, you: playerPublic(p) };
}

function actionChat(p, body) {
  const text = sanitizeText(body.text, 120);
  const now = Date.now();
  if (!text) return { error: 'Empty message.' };
  if (now - p.chatAt < 1200) return { error: 'Slow down a little.' };
  p.chatAt = now;
  pushChat({ name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, text });

  // bots occasionally respond — cheap but effective AI-actor behaviour
  const roll = Math.random();
  if (roll < 0.55) {
    const speaker = pick(world.bots);
    const replies = [
      `@${p.name} based`, `@${p.name} gl`, `real`, `@${p.name} how do you hit like that`,
      'lol', '@' + p.name + ' no way that was real', 'cope',
      `@${p.name} remember: fake coins, real feelings`,
    ];
    const delay = rndInt(900, 3200);
    setTimeout(() => botChat(speaker, pick(replies), true), delay);
  }
  world.rev++;
  return { ok: true };
}

function actionRename(p, body) {
  const name = sanitizeText(body.name, 14);
  if (name.length < 2) return { error: 'Name must be at least 2 characters.' };
  p.name = name;
  scheduleSave();
  return { ok: true, you: playerPublic(p) };
}

/* --------------------------------------------------------------------------
   7b. State snapshot
   -------------------------------------------------------------------------- */

function stateSnapshot(p, sinceChat, sinceFeed) {
  const sc = Number(sinceChat) || 0;
  const sf = Number(sinceFeed) || 0;
  const newChat = sc ? world.chat.filter((m) => m.seq > sc) : world.chat.slice(-40);
  const newFeed = sf ? world.feed.filter((m) => m.seq > sf) : world.feed.slice(0, 40);
  return {
    rev: world.rev,
    now: Date.now(),
    online: world.fakeOnline + world.players.size,
    you: playerPublic(p),
    crash: {
      phase: CRASH.phase,
      roundId: CRASH.roundId,
      phaseEndsAt: CRASH.phaseEndsAt,
      roundStartAt: CRASH.roundStartAt,
      growthMs: CRASH.GROWTH_MS,
      betMs: CRASH.BET_MS,
      crashPoint: CRASH.phase === 'crashed' ? CRASH.crashPoint : null,
      mult: round2(crashMultAt(Date.now())),
      history: CRASH.history.slice(0, 20),
      bets: CRASH.bets.slice(-40).map((b) => ({ ...b })),
      betCount: CRASH.bets.length,
      totalStaked: Math.round(CRASH.bets.reduce((s, b) => s + b.amount, 0)),
    },
    chat: newChat,
    feed: newFeed,
    leaderboard: leaderboard(p),
    botsTagged: BOT_TAGS_PUBLIC,
  };
}

/* --------------------------------------------------------------------------
   7c. Router
   -------------------------------------------------------------------------- */

const ACTIONS = {
  'crash/bet': (p, body) => actionCrashBet(p, body),
  'crash/cashout': (p) => actionCrashCashout(p),
  'coinflip': (p, body) => actionCoinflip(p, body),
  'case/open': (p, body) => actionCaseOpen(p, body),
  'battle/start': (p, body) => actionBattle(p, body),
  'mines/start': (p, body) => actionMinesStart(p, body),
  'mines/pick': (p, body) => actionMinesPick(p, body),
  'mines/cashout': (p) => actionMinesCashout(p),
  'inventory/sell': (p, body) => actionSell(p, body),
  'inventory/sellall': (p) => actionSellAll(p),
  'bonus': (p) => actionBonus(p),
  'chat': (p, body) => actionChat(p, body),
  'rename': (p, body) => actionRename(p, body),
};

const server = http.createServer(async (req, res) => {
  let url;
  let pathname;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' }).end('bad request');
    return;
  }

  if (!pathname.startsWith('/api/')) {
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
    res.writeHead(405).end('method not allowed');
    return;
  }

  const pid = sanitizeText(url.searchParams.get('pid') || req.headers['x-pid'] || '', 40);
  const route = pathname.slice(5); // strip "/api/"

  // ---- public endpoints -------------------------------------------------
  if (route === 'config' && req.method === 'GET') {
    return sendJson(res, 200, {
      site: 'NEONROLL',
      tagline: 'Fake-currency skin casino sim — zero real money, ever.',
      realMoney: REAL_MONEY_ENABLED,
      botTags: BOT_TAGS_PUBLIC,
      rarities: RARITIES,
      cases: CASES.map(casePayload),
      coinflip: { payout: 1.95, odds: '50/50', rake: '2.5%' },
      mines: { rake: '3%', grid: 25 },
      crash: { houseEdge: '1%' },
      bonus: { amount: '400–900', cooldownSeconds: 120 },
      curfew: false,
    });
  }

  if (route === 'hello' && req.method === 'POST') {
    const body = await readBody(req);
    const id = sanitizeText(body.pid, 40) || pid || uid();
    let p = world.players.get(id);
    const isNew = !p;
    if (!p) {
      p = newPlayer(id, sanitizeText(body.name, 14));
      world.players.set(id, p);
    } else if (body.name) {
      const nm = sanitizeText(body.name, 14);
      if (nm.length >= 2) p.name = nm;
    }
    scheduleSave();
    return sendJson(res, 200, { ok: true, pid: id, isNew, ...stateSnapshot(p, 0) });
  }

  // ---- everything below needs a session --------------------------------
  const player = getPlayer(pid);
  if (!player) return sendJson(res, 400, { error: 'Unknown session. Reload the page.' });

  if (route === 'state' && req.method === 'GET') {
    return sendJson(res, 200, stateSnapshot(
      player,
      url.searchParams.get('sinceChat') || url.searchParams.get('since'),
      url.searchParams.get('sinceFeed') || url.searchParams.get('since'),
    ));
  }

  if (route === 'leaderboard' && req.method === 'GET') {
    return sendJson(res, 200, { leaderboard: leaderboard(player) });
  }

  if (route === 'reset' && req.method === 'POST') {
    const fresh = newPlayer(player.id, player.name);
    world.players.set(player.id, fresh);
    scheduleSave();
    return sendJson(res, 200, { ok: true, you: playerPublic(fresh) });
  }

  if (ACTIONS[route] && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const result = ACTIONS[route](player, body);
      if (result && result.error) return sendJson(res, 400, result);
      // always return the fresh public player state alongside the result
      return sendJson(res, 200, { rev: world.rev, ...result, you: result.you || playerPublic(player) });
    } catch (err) {
      console.error('[neonroll] action failed', route, err);
      return sendJson(res, 500, { error: 'Something went wrong in the sim.' });
    }
  }

  return sendJson(res, 404, { error: 'Unknown endpoint.' });
});

/* ==========================================================================
   8. BOOT
   ========================================================================== */

async function boot() {
  world.bots = makeBots(26);
  await loadPlayers();
  startBettingPhase();
  setInterval(worldTick, 100);
  setInterval(scheduleSave, 30000);
  // forget profiles that have not been seen in a week (keeps memory flat)
  setInterval(() => {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    for (const [id, p] of world.players) if ((p.lastSeen || 0) < cutoff) world.players.delete(id);
  }, 10 * 60 * 1000);

  systemChat('Welcome to NEONROLL. All coins are fake, all opponents are bots, and nothing here can ever cost you real money.');
  pushFeed({
    type: 'battle', name: pick(world.bots).name, isBot: true, hue: 200, face: 3,
    value: 4820, profit: 2310, text: 'won a 3x Neon Case battle',
  });

  server.listen(PORT, HOST, () => {
    console.log(`[neonroll] fake-currency casino sim running on http://${HOST}:${PORT}`);
    console.log('[neonroll] real money: DISABLED (no deposits, no withdrawals, no payments)');
  });
}

process.on('SIGTERM', () => { try { server.close(); } catch {} process.exit(0); });
process.on('SIGINT', () => { try { server.close(); } catch {} process.exit(0); });

boot();
