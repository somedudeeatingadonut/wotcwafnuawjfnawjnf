/**
 * games.js — every wager the human can place.
 *
 * Same rules as the lobby: outcomes are decided here on the server, the browser
 * only animates what already happened. Every house edge is disclosed in the UI.
 */

'use strict';

const catalog = require('./catalog');
const W = require('./world');

const {
  world, crash, double, champion, CRASH, DOUBLE_PAYOUT, TILES_ROWS,
  getPlayer, publicPlayer, charge, credit, recordWin, pushFeed, pushChat,
  minesMultiplier, minesView, tilesView, scheduleSave,
  rnd, rndInt, pick, clamp, round2,
  BONUS_COOLDOWN_MS, FREE_CASE_COOLDOWN_MS, FREE_CASE_MAX_PRICE,
} = W;

const MIN_BET = 25;
const err = (message) => ({ error: message });
const ok = (extra) => ({ ok: true, ...extra });

/* ==========================================================================
   Case opening
   ========================================================================== */

function actionCaseOpen(p, body) {
  const def = catalog.getCase(String(body.caseId || ''));
  if (!def) return err('Unknown case.');
  const count = clamp(Math.floor(Number(body.count) || 1), 1, 5);
  const useVoucher = !!body.voucher;
  const cost = def.gems * count;

  if (useVoucher) {
    if (p.freeCases < count) return err(`You have ${p.freeCases} free case${p.freeCases === 1 ? '' : 's'} left.`);
    if (def.gems > FREE_CASE_MAX_PRICE) return err(`Free cases only cover cases up to ${FREE_CASE_MAX_PRICE.toLocaleString('en-US')} gems.`);
    p.freeCases -= count;
  } else if (cost > p.balance) {
    return err(`That costs ${cost.toLocaleString('en-US')} gems and you have ${Math.round(p.balance).toLocaleString('en-US')}. Claim the free case drop — it resets every 45 minutes.`);
  }

  if (!useVoucher) charge(p, cost);
  else if (def.gems > 0) W.trackWager(p, 0);

  const items = [];
  let returned = 0;
  for (let i = 0; i < count; i++) {
    const item = catalog.rollItem(def.id);
    if (!item) return err('Roll failed.');
    p.inventory.push(item);
    p.stats.opened++;
    items.push(item);
    returned += item.value;
    if (item.value >= def.gems * 3) {
      pushFeed({
        type: 'Case', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
        stake: useVoucher ? 0 : def.gems, mult: round2(item.value / def.gems), value: item.value,
        profit: item.value - def.gems, detail: `${item.name} (${item.wearShort})`, item, caseId: def.id,
      });
      for (const bot of world.bots.slice(0, 2)) {
        setTimeout(() => W.botChat(bot, pick(['insane pull', 'gg', 'that is a clip', 'no way', 'kh', 'give me that luck']), true), rndInt(600, 2400));
      }
    }
  }
  const spent = useVoucher ? 0 : cost;
  p.netToday += returned - spent;
  if (returned - spent > p.stats.biggestWin) p.stats.biggestWin = Math.round(returned - spent);
  scheduleSave();
  return ok({ items, cost: spent, refund: returned, voucherUsed: useVoucher, you: publicPlayer(p) });
}

function actionSell(p, body) {
  const idx = p.inventory.findIndex((i) => i.uid === body.uid || i.uid === body.itemId);
  if (idx === -1) return err('Item not found in your inventory.');
  const [item] = p.inventory.splice(idx, 1);
  p.balance += item.value;
  p.netToday += item.value;
  scheduleSave();
  return ok({ sold: item, you: publicPlayer(p) });
}

function actionSellAll(p, body) {
  const max = Number(body.maxValue);
  const floor = Number.isFinite(max) ? max : Infinity;
  const selling = p.inventory.filter((i) => i.value < floor);
  if (!selling.length) return err('Nothing to sell.');
  p.inventory = p.inventory.filter((i) => i.value >= floor);
  const total = selling.reduce((s, i) => s + i.value, 0);
  p.balance += total;
  p.netToday += total;
  scheduleSave();
  return ok({ total, count: selling.length, you: publicPlayer(p) });
}

/* ==========================================================================
   Battles
   ========================================================================== */

function actionBattleStart(p, body) {
  const def = catalog.getCase(String(body.caseId || ''));
  if (!def) return err('Unknown case.');
  const count = clamp(Math.floor(Number(body.count) || 1), 1, 5);
  const cost = def.gems * count;
  if (cost > p.balance) return err(`That battle needs ${cost.toLocaleString('en-US')} gems. You have ${Math.round(p.balance).toLocaleString('en-US')}.`);

  const opponent = pick(world.bots);
  charge(p, cost);
  p.stats.battles++;

  const mine = Array.from({ length: count }, () => catalog.rollItem(def.id));
  const theirs = Array.from({ length: count }, () => catalog.rollItem(def.id));
  const myTotal = mine.reduce((s, i) => s + i.value, 0);
  const theirTotal = theirs.reduce((s, i) => s + i.value, 0);
  const win = myTotal >= theirTotal;      // ties go to the human — the only break in here
  const pot = myTotal + theirTotal;

  if (win) {
    for (const item of mine) p.inventory.push(item);
    for (const item of theirs) { item.viaBattle = true; p.inventory.push(item); }
    p.stats.won += pot;
    p.netToday += pot - cost;
    if (pot - cost > p.stats.biggestWin) p.stats.biggestWin = Math.round(pot - cost);
    opponent.balance -= theirTotal;
    opponent.netToday -= theirTotal;
  } else {
    p.stats.lost += cost;
    p.netToday -= cost;
    opponent.balance += pot;
    opponent.netToday += pot - cost;
  }
  W.botRebuyIfBroke(opponent);

  pushFeed({
    type: 'Battles', name: win ? p.name : opponent.name, isBot: !win, you: win,
    hue: win ? p.hue : opponent.hue, face: win ? p.face : opponent.face,
    stake: cost, mult: round2(pot / cost), value: pot, profit: win ? pot - cost : -cost,
    detail: `won a ${count}x ${def.name} battle vs ${win ? opponent.name : p.name}`,
    battle: {
      caseId: def.id, caseName: def.name, count, winner: win ? 'you' : 'bot',
      a: { name: p.name, items: mine, total: myTotal },
      b: { name: opponent.name, items: theirs, total: theirTotal },
    },
  });
  if (!win) setTimeout(() => W.botChat(opponent, pick(['gg', 'gg wp', 'ez', 'kh']), true), 900);
  scheduleSave();
  return ok({
    win, pot, cost,
    yourPile: { name: p.name, items: mine, total: myTotal },
    oppPile: { name: opponent.name, hue: opponent.hue, face: opponent.face, items: theirs, total: theirTotal },
    you: publicPlayer(p),
  });
}

/* ==========================================================================
   Crash
   ========================================================================== */

function actionCrashBet(p, body) {
  if (CRASH.phase !== 'betting') return err('Too late — that round already started. Nothing was taken from your balance.');
  if (p.crashBet && p.crashBet.roundId === CRASH.roundId) return err('You already have a bet on this round.');
  const amount = Math.floor(Number(body.amount));
  if (!Number.isFinite(amount) || amount < MIN_BET) return err(`Minimum bet is ${MIN_BET} gems.`);
  if (amount > p.balance) return err('Not enough gems.');
  const auto = Number(body.auto);
  charge(p, amount);
  p.crashBet = {
    amount, roundId: CRASH.roundId, cashed: null,
    auto: Number.isFinite(auto) && auto > 1.01 ? round2(auto) : null,
  };
  CRASH.bets.push({ id: p.id, name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, amount, cashedAt: null, payout: 0 });
  world.rev++;
  scheduleSave();
  return ok({ you: publicPlayer(p) });
}

function actionCrashCashout(p) {
  if (CRASH.phase !== 'running') return err('No round in progress.');
  const bet = p.crashBet;
  if (!bet || bet.roundId !== CRASH.roundId) return err('You have no bet in this round.');
  if (bet.cashed) return err('Already cashed out.');
  const mult = clamp(round2(crashMultNow()), 1, CRASH.crashPoint);
  const res = W.crashCashoutPlayer(p, mult);
  if (!res) return err('Could not cash out.');
  scheduleSave();
  return ok({ ...res, you: publicPlayer(p) });
}
// local helper: the live multiplier right now
function crashMultNow() {
  return Math.pow(2, Math.max(0, Date.now() - CRASH.roundStartAt) / CRASH.GROWTH_MS);
}

/* ==========================================================================
   Double
   ========================================================================== */

function actionDoubleBet(p, body) {
  if (double.phase !== 'betting') return err('Betting is closed — wait for the next spin.');
  if (p.doubleBet && p.doubleBet.roundId === double.roundId) return err('You already bet on this spin.');
  const color = ['green', 'red', 'gold'].includes(body.color) ? body.color : null;
  if (!color) return err('Pick a colour.');
  const amount = Math.floor(Number(body.amount));
  if (!Number.isFinite(amount) || amount < MIN_BET) return err(`Minimum bet is ${MIN_BET} gems.`);
  if (amount > p.balance) return err('Not enough gems.');
  charge(p, amount);
  p.doubleBet = { color, amount, roundId: double.roundId };
  world.rev++;
  scheduleSave();
  return ok({ you: publicPlayer(p) });
}

/* ==========================================================================
   Mines
   ========================================================================== */

function actionMinesStart(p, body) {
  if (p.mines && p.mines.active) return err('Finish your current mines round first.');
  const bet = Math.floor(Number(body.bet));
  const mineCount = clamp(Math.floor(Number(body.mines) || 3), 1, 5);
  if (!Number.isFinite(bet) || bet < MIN_BET) return err(`Minimum bet is ${MIN_BET} gems.`);
  if (bet > p.balance) return err('Not enough gems.');
  charge(p, bet);
  const cells = Array.from({ length: 25 }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  p.mines = { active: true, bet, mineCount, mines: cells.slice(0, mineCount), revealed: [] };
  world.rev++;
  scheduleSave();
  return ok({ mines: minesView(p.mines), you: publicPlayer(p) });
}

function actionMinesPick(p, body) {
  const m = p.mines;
  if (!m || !m.active) return err('No active mines round.');
  const tile = Math.floor(Number(body.tile));
  if (!(tile >= 0 && tile < 25)) return err('Bad tile.');
  if (m.revealed.includes(tile)) return err('Already revealed.');

  if (m.mines.includes(tile)) {
    m.active = false;
    p.stats.lost += m.bet;
    p.netToday -= m.bet;
    const result = { bom: true, tile, mines: m.mines.slice(), bet: m.bet };
    pushFeed({
      type: 'Mines', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
      stake: m.bet, mult: 0, value: 0, profit: -m.bet, detail: `hit a mine on ${m.mineCount}-mine mines`,
    });
    setTimeout(() => W.botChat(pick(world.bots), pick(['rip', 'oof', 'F', 'one more tile next time']), true), 400);
    scheduleSave();
    return ok({ result, mines: minesView(m), you: publicPlayer(p) });
  }

  m.revealed.push(tile);
  const mult = minesMultiplier(m.mineCount, m.revealed.length);
  if (m.revealed.length === 25 - m.mineCount) {
    const payout = Math.round(m.bet * mult);
    credit(p, payout);
    m.active = false;
    recordWin({ game: 'Mines', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, stake: m.bet, mult, payout, detail: 'cleared the whole board' });
    scheduleSave();
    return ok({ result: { cleared: true, mult, payout }, mines: minesView(m), you: publicPlayer(p) });
  }
  world.rev++;
  return ok({ result: { safe: true, tile, mult }, mines: minesView(m), you: publicPlayer(p) });
}

function actionMinesCashout(p) {
  const m = p.mines;
  if (!m || !m.active || !m.revealed.length) return err('Nothing to cash out.');
  const mult = minesMultiplier(m.mineCount, m.revealed.length);
  const payout = Math.round(m.bet * mult);
  credit(p, payout);
  m.active = false;
  if (payout >= m.bet * 2) {
    recordWin({ game: 'Mines', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, stake: m.bet, mult, payout, detail: 'cashed out' });
  }
  scheduleSave();
  return ok({ payout, mult, mines: minesView(m), you: publicPlayer(p) });
}

/* ==========================================================================
   Tiles — 5 rows, growing numbers of cursed tiles, cash out any time
   ========================================================================== */

function actionTilesStart(p, body) {
  if (p.tiles && p.tiles.active) return err('Finish your current tiles run first.');
  const bet = Math.floor(Number(body.bet));
  if (!Number.isFinite(bet) || bet < MIN_BET) return err(`Minimum bet is ${MIN_BET} gems.`);
  if (bet > p.balance) return err('Not enough gems.');
  charge(p, bet);
  const cursed = TILES_ROWS.map((row) => {
    const cells = [0, 1, 2, 3, 4];
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return cells.slice(0, row.cursed);
  });
  p.tiles = { active: true, bet, row: 0, picks: [], cursed };
  world.rev++;
  scheduleSave();
  return ok({ tiles: tilesView(p.tiles), you: publicPlayer(p) });
}

function actionTilesPick(p, body) {
  const t = p.tiles;
  if (!t || !t.active) return err('No active tiles run.');
  const tile = Math.floor(Number(body.tile));
  if (!(tile >= 0 && tile < 5)) return err('Bad column.');
  const rowDef = TILES_ROWS[t.row];

  if (t.cursed[t.row].includes(tile)) {
    t.active = false;
    p.stats.lost += t.bet;
    p.netToday -= t.bet;
    pushFeed({
      type: 'Tiles', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
      stake: t.bet, mult: 0, value: 0, profit: -t.bet, detail: `stepped on a cursed tile in row ${t.row + 1}`,
    });
    scheduleSave();
    return ok({ result: { dead: true, row: t.row, tile }, tiles: tilesView(t), you: publicPlayer(p) });
  }

  t.picks.push(tile);
  t.row++;
  if (t.row >= TILES_ROWS.length) {
    const mult = rowDef.mult;
    const payout = Math.round(t.bet * mult);
    credit(p, payout);
    t.active = false;
    recordWin({ game: 'Tiles', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, stake: t.bet, mult, payout, detail: 'cleared every row' });
    scheduleSave();
    return ok({ result: { complete: true, mult, payout }, tiles: tilesView(t), you: publicPlayer(p) });
  }
  world.rev++;
  return ok({ result: { safe: true, row: t.row - 1, tile, nextMult: TILES_ROWS[t.row].mult }, tiles: tilesView(t), you: publicPlayer(p) });
}

function actionTilesCashout(p) {
  const t = p.tiles;
  if (!t || !t.active || t.row === 0) return err('Nothing to cash out yet.');
  const mult = TILES_ROWS[t.row - 1].mult;
  const payout = Math.round(t.bet * mult);
  credit(p, payout);
  t.active = false;
  if (payout >= t.bet * 2) {
    recordWin({ game: 'Tiles', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, stake: t.bet, mult, payout, detail: `cashed out after ${t.row} row${t.row === 1 ? '' : 's'}` });
  }
  scheduleSave();
  return ok({ payout, mult, tiles: tilesView(t), you: publicPlayer(p) });
}

/* ==========================================================================
   Plinko
   ========================================================================== */

const PLINKO = {
  8: {
    low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

function actionPlinko(p, body) {
  const rows = [8, 12, 16].includes(Number(body.rows)) ? Number(body.rows) : 12;
  const risk = ['low', 'medium', 'high'].includes(body.risk) ? body.risk : 'medium';
  const amount = Math.floor(Number(body.amount));
  if (!Number.isFinite(amount) || amount < MIN_BET) return err(`Minimum bet is ${MIN_BET} gems.`);
  if (amount > p.balance) return err('Not enough gems.');

  charge(p, amount);
  const table = PLINKO[rows][risk];
  const path = [];               // each step: 0 = left, 1 = right
  let slot = 0;
  for (let i = 0; i < rows; i++) {
    const right = Math.random() < 0.5 ? 1 : 0;
    path.push(right);
    slot += right;
  }
  const mult = table[slot];
  const payout = Math.round(amount * mult);
  if (payout > 0) credit(p, payout);
  else p.netToday -= amount;
  if (mult >= 8) {
    recordWin({ game: 'Plinko', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, stake: amount, mult, payout, detail: `${rows} rows · ${risk} risk` });
  }
  scheduleSave();
  return ok({ result: { rows, risk, slot, path, mult, payout }, table, you: publicPlayer(p) });
}

/* ==========================================================================
   Upgrader — stake gems or a skin, pick a multiplier, spin the arc
   ========================================================================== */

const UPGRADE_EDGE = 0.96;   // 4% house edge, same as the real thing

function actionUpgrade(p, body) {
  const target = clamp(Number(body.target) || 0, 1.05, 100);
  const gems = Math.floor(Number(body.amount) || 0);
  const uid = body.uid ? String(body.uid) : null;
  let stakeValue = 0;
  let stakeItem = null;

  if (uid) {
    const idx = p.inventory.findIndex((i) => i.uid === uid);
    if (idx === -1) return err('That skin is not in your inventory.');
    stakeItem = p.inventory[idx];
    stakeValue = stakeItem.value;
    if (stakeValue * target > 20_000_000) return err('That target is beyond the sim\'s ceiling. Pick a smaller multiplier.');
    p.inventory.splice(idx, 1);
  } else {
    if (!Number.isFinite(gems) || gems < MIN_BET) return err(`Minimum stake is ${MIN_BET} gems.`);
    if (gems > p.balance) return err('Not enough gems.');
    stakeValue = gems;
  }

  if (!uid) charge(p, gems);
  else W.trackWager(p, 0);

  const chance = clamp((1 / target) * UPGRADE_EDGE, 0.005, 0.99);
  const win = Math.random() < chance;
  const payoutGems = Math.round(stakeValue * target);

  if (win) {
    // a win pays out as gems plus a skin worth roughly the target value
    const prize = catalog.poolItemNear(payoutGems * 0.6) || catalog.randomPoolItem();
    if (prize) p.inventory.push(prize);
    credit(p, payoutGems);
    recordWin({ game: 'Upgrader', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, stake: stakeValue, mult: target, payout: payoutGems, detail: `${chance * 100 < 1 ? '<1' : Math.round(chance * 100)}% roll landed` });
  } else {
    p.stats.lost += stakeValue;
    p.netToday -= stakeValue;
    if (stakeValue >= 2000) {
      pushFeed({
        type: 'Upgrader', name: p.name, isBot: false, you: true, hue: p.hue, face: p.face,
        stake: stakeValue, mult: 0, value: 0, profit: -stakeValue,
        detail: `lost a ${target.toFixed(2)}x upgrade${stakeItem ? ` (${stakeItem.name})` : ''}`,
      });
    }
  }
  p.stats.upgrades++;
  scheduleSave();
  return ok({
    result: { win, chance, target, stakeValue, payout: win ? payoutGems : 0, stakeItem },
    you: publicPlayer(p),
  });
}

/* ==========================================================================
   Champion
   ========================================================================== */

function actionChampionJoin(p, body) {
  if (champion.phase !== 'joining') return err('The pot is being drawn — wait for the next round.');
  const amount = Math.floor(Number(body.amount));
  if (!Number.isFinite(amount) || amount < 100) return err('Minimum entry is 100 gems.');
  if (amount > p.balance) return err('Not enough gems.');
  charge(p, amount);
  p.championTickets = (p.championTickets || 0) + amount;
  champion.contributors.push({ id: p.id, name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, amount });
  champion.pot += amount;
  world.rev++;
  scheduleSave();
  return ok({ you: publicPlayer(p) });
}

/* ==========================================================================
   Freebies
   ========================================================================== */

function actionBonus(p) {
  const wait = BONUS_COOLDOWN_MS - (Date.now() - p.lastBonusAt);
  if (wait > 0) return err(`Next free drop in ${Math.ceil(wait / 1000)}s.`);
  p.lastBonusAt = Date.now();
  const amount = rndInt(2500, 9000);
  p.balance += amount;
  scheduleSave();
  return ok({ amount, you: publicPlayer(p) });
}

function actionClaimFreeCases(p) {
  const wait = FREE_CASE_COOLDOWN_MS - (Date.now() - p.lastFreeCaseAt);
  if (wait > 0) return err(`Next free case drop in ${Math.ceil(wait / 60000)} minutes.`);
  p.lastFreeCaseAt = Date.now();
  p.freeCases += 3;
  scheduleSave();
  return ok({ freeCases: p.freeCases, you: publicPlayer(p) });
}

function actionRename(p, body) {
  const name = String(body.name || '').replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
  if (name.length < 2) return err('Name needs at least 2 characters.');
  p.name = name;
  scheduleSave();
  return ok({ you: publicPlayer(p) });
}

function actionChat(p, body) {
  const text = String(body.text || '').replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 130);
  if (!text) return err('Empty message.');
  const now = Date.now();
  if (now - p.chatAt < 1200) return err('Slow down a little.');
  p.chatAt = now;
  pushChat({ name: p.name, isBot: false, you: true, hue: p.hue, face: p.face, text });

  if (Math.random() < 0.6) {
    const bot = pick(world.bots);
    const replies = [
      `@${p.name} based`, `@${p.name} gl`, 'real', `@${p.name} how do you hit like that`,
      'lol', `@${p.name} no way that was real`, 'cope', `@${p.name} remember: fake gems, real feelings`,
      'kh', `@${p.name} sell it before it drops`, 'w pull',
    ];
    setTimeout(() => W.botChat(bot, pick(replies), true), rndInt(800, 3000));
  }
  world.rev++;
  return ok({});
}

function actionReset(p) {
  const fresh = W.newPlayer(p.id, p.name);
  world.players.set(p.id, fresh);
  scheduleSave();
  return ok({ you: publicPlayer(fresh) });
}

/* ==========================================================================
   Action table
   ========================================================================== */

const ACTIONS = {
  'case/open': actionCaseOpen,
  'inventory/sell': actionSell,
  'inventory/sellall': actionSellAll,
  'battle/start': actionBattleStart,
  'crash/bet': actionCrashBet,
  'crash/cashout': actionCrashCashout,
  'double/bet': actionDoubleBet,
  'mines/start': actionMinesStart,
  'mines/pick': actionMinesPick,
  'mines/cashout': actionMinesCashout,
  'tiles/start': actionTilesStart,
  'tiles/pick': actionTilesPick,
  'tiles/cashout': actionTilesCashout,
  'plinko/drop': actionPlinko,
  'upgrader/spin': actionUpgrade,
  'champion/join': actionChampionJoin,
  'bonus': actionBonus,
  'rewards/free-cases': actionClaimFreeCases,
  'rename': actionRename,
  'chat': actionChat,
  'reset': actionReset,
};

module.exports = { ACTIONS, PLINKO, MIN_BET, DOUBLE_PAYOUT };
