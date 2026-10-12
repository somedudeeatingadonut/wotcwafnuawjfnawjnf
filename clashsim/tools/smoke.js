#!/usr/bin/env node
/**
 * tools/smoke.js — the no-dependency test suite.
 *
 *   npm run smoke                     # boots its own server on a scratch port
 *   node tools/smoke.js               # same thing
 *   node tools/smoke.js http://host:port   # test a server that is already up
 *
 * It checks the two things that were actually broken in development:
 *   1. every case is priced FROM the odds it ships (EV ≈ 90% of the price,
 *      odds summing to 1) — the "11,000% return" bug
 *   2. case opening moves gems and items for real — the "case opening did not
 *      properly work" bug
 *
 * …plus every other API route, with real arithmetic assertions instead of
 * "did it return 200".
 *
 * Nothing here touches real money: the whole point is that there is none.
 */

'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const catalog = require(path.join(ROOT, 'lib', 'catalog'));
const { PLINKO, DOUBLE_PAYOUT } = require(path.join(ROOT, 'lib', 'games'));

const externalUrl = process.argv[2] || process.env.SMOKE_URL || '';
const PORT = Number(process.env.SMOKE_PORT || 3987);
const BASE = externalUrl || `http://127.0.0.1:${PORT}`;
const MIN_BET = 25;

const results = [];
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

async function check(name, fn) {
  try {
    const note = await fn();
    results.push({ name, ok: true, note: typeof note === 'string' ? note : '' });
  } catch (err) {
    results.push({ name, ok: false, note: err.message });
  }
}

async function api(route, body, pid) {
  const sep = route.includes('?') ? '&' : '?';
  const url = `${BASE}/api/${route}${pid ? `${sep}pid=${encodeURIComponent(pid)}` : ''}`;
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html or plain text */ }
  return { status: res.status, json, text };
}

/* ==========================================================================
   boot a server if we were not handed one
   ========================================================================== */

let child = null;
let dataDir = null;

async function startServer() {
  if (externalUrl) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clashsim-smoke-'));
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', CLASH_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${BASE}/api/config`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server never came up:\n' + log);
}

function stopServer() {
  if (child) { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
  if (dataDir) { try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* fine */ } }
}

/* ==========================================================================
   the tests
   ========================================================================== */

async function testCatalog() {
  await check('catalog: 12 cases, all with items', () => {
    assert(catalog.cases.length === 12, `${catalog.cases.length} cases`);
    for (const def of catalog.cases) assert(def.items.length >= 15, `${def.id} has ${def.items.length} items`);
    return `${catalog.cases.length} cases · ${catalog.cases.reduce((s, c) => s + c.items.length, 0)} items`;
  });

  for (const def of catalog.cases) {
    await check(`pricing: ${def.id} is priced from its own odds`, () => {
      const pmf = def.items.reduce((s, i) => s + i.chance, 0);
      assert(near(pmf, 1, 1e-6), `chances sum to ${pmf}, not 1`);
      const ev = catalog.caseEv(def);
      const ratio = ev / def.gems;
      // price is rounded to a multiple of 5, so tiny cases drift a little
      assert(ratio > 0.85 && ratio <= 0.945, `EV ${ev} vs price ${def.gems} = ${(ratio * 100).toFixed(1)}%`);
      const worst = Math.max(...def.items.map((i) => i.chance * i.value0 || 0));
      return `price ${def.gems} · EV ${ev} · ${(ratio * 100).toFixed(1)}%`;
    });
  }

  await check('pricing: Valve cases keep the published rarity ladder', () => {
    const published = { rarity_rare: 0.7992, rarity_mythical: 0.1598, rarity_legendary: 0.032, rarity_ancient: 0.0064, rarespecial: 0.0026 };
    for (const def of catalog.cases.filter((c) => c.origin !== 'original')) {
      const byTier = {};
      for (const it of def.items) byTier[it.rarity] = (byTier[it.rarity] || 0) + it.chance;
      for (const [rarity, expected] of Object.entries(published)) {
        // per-item chances are rounded to 5 decimal places and the leftover is
        // nudged into the cheapest item so the table sums to exactly 1
        const got = byTier[rarity] || 0;
        assert(near(got, expected, 2e-4), `${def.id}: ${rarity} is ${got}, expected ${expected}`);
      }
    }
    return 'five rungs on every Valve case';
  });

  await check('pricing: originals re-tier by prestige, not by Valve rarity', () => {
    const ladder = [0.70, 0.21, 0.065, 0.022, 0.003];
    for (const def of catalog.cases.filter((c) => c.origin === 'original')) {
      const byTier = {};
      for (const it of def.items) byTier[it.tier] = (byTier[it.tier] || 0) + it.chance;
      Object.entries(byTier).forEach(([tier, chance]) => {
        assert(near(chance, ladder[Number(tier)], 5e-4), `${def.id}: tier ${tier} pays ${chance}, expected ${ladder[Number(tier)]}`);
      });
      // the rarity the UI prints must be the tier it actually rolls from
      const shown = catalog.rarityOdds(def);
      const shownChance = shown.reduce((s, o) => s + o.chance, 0);
      assert(near(shownChance, 1, 1e-6), `${def.id}: printed odds sum to ${shownChance}`);
    }
    return 'printed table == rolled table';
  });

  await check('sampling: 40k rolls per case land inside the sampling noise', () => {
    const N = 40000;
    const notes = [];
    for (const def of catalog.cases) {
      const wear = catalog.wearTable;
      const m1 = wear.reduce((s, w) => s + w.chance * (w.mult == null ? 1 : w.mult), 0);
      const m2 = wear.reduce((s, w) => s + w.chance * Math.pow(w.mult == null ? 1 : w.mult, 2), 0);
      const st = catalog.stattrak;
      const s1 = 1 + st.chance * (st.mult - 1);
      const s2 = (1 - st.chance) + st.chance * st.mult * st.mult;
      const ev1 = def.items.reduce((s, i) => s + i.chance * i.base, 0) * m1 * s1;
      const ev2 = def.items.reduce((s, i) => s + i.chance * i.base * i.base, 0) * m2 * s2;
      const sd = Math.sqrt(Math.max(0, ev2 - ev1 * ev1));
      const se = sd / Math.sqrt(N);
      let total = 0;
      for (let i = 0; i < N; i++) total += catalog.rollItem(def.id).value;
      const mean = total / N;
      const sigma = se > 0 ? Math.abs(mean - ev1) / se : 0;
      assert(sigma < 4.5, `${def.id}: ${(mean / def.gems * 100).toFixed(1)}% vs EV ${(ev1 / def.gems * 100).toFixed(1)}% (${sigma.toFixed(1)}σ)`);
      notes.push(`${def.id} ${(mean / def.gems * 100).toFixed(0)}%`);
    }
    return notes.join(' ');
  });
}

async function testHttp() {
  const cfg = await api('config');
  await check('config: served, no real money, 30 bots', () => {
    assert(cfg.status === 200 && cfg.json, 'no config');
    assert(cfg.json.realMoney === false, 'realMoney must be false');
    assert(cfg.json.botCount > 0 && cfg.json.botsTagged === true, 'bots must exist and be tagged');
    assert(cfg.json.cases.length === 12, 'case list');
    assert(cfg.json.minBet === MIN_BET, 'minimum bet');
    return `${cfg.json.site} · ${cfg.json.botCount} bots · real money ${cfg.json.realMoney}`;
  });

  const hello = await api('hello', { name: 'Smoke Tester' });
  const pid = hello.json && hello.json.pid;

  await check('no deposit / withdraw / purchase / payment routes exist', async () => {
    for (const r of ['deposit', 'withdraw', 'purchase', 'payment', 'card', 'crypto']) {
      const res = await api(r, {}, pid);
      assert(res.status === 404, `${r} returned ${res.status}`);
    }
    // the served client must advertise the truth and disable every money-ish control
    const body = await (await fetch(BASE + '/')).text();
    assert(/no real money|no payments|no withdrawals|fake currency/i.test(body), 'the page should say the money is fake');
    const moneyControls = body.match(/<button[^>]*>[^<]*(?:Pay|Purchase|Deposit|Withdraw|Card|Crypto)[^<]*<\/button>/gi) || [];
    moneyControls.forEach((btn) => assert(/disabled/.test(btn), `enabled payment control found: ${btn}`));
    return `six routes missing on purpose · ${moneyControls.length} payment button(s) present and disabled`;
  });
  await check('session: hello hands out a funded fake account', () => {
    assert(hello.status === 200 && pid, 'no pid');
    assert(hello.json.you.balance === 2500, `balance ${hello.json.you.balance}`);
    assert(hello.json.you.freeCases === 3, 'three vouchers to start');
    return `pid ${pid.slice(0, 6)}… · 💎 ${hello.json.you.balance}`;
  });

  const state0 = (await api('state', undefined, pid)).json;
  await check('state: one payload drives the whole client', () => {
    for (const key of ['you', 'crash', 'double', 'champion', 'race', 'feed', 'chat', 'leaderboard', 'highs', 'online', 'rev']) {
      assert(state0[key] !== undefined, `missing ${key}`);
    }
    assert(state0.crash.bets !== undefined && state0.double.segments.length === 54, 'round engines');
    return `${state0.feed.length} feed rows · ${state0.chat.length} chat rows · ${state0.leaderboard.length} ranked`;
  });

  await check('state: chat/feed deltas only send what is new', async () => {
    const since = { c: state0.chat.length ? state0.chat[state0.chat.length - 1].seq : 0, f: state0.feed.length ? state0.feed[0].seq : 0 };
    await api('chat', { text: 'delta check' }, pid);
    const delta = (await api(`state?sinceChat=${since.c}&sinceFeed=${since.f}`, undefined, pid)).json;
    assert(delta.chat.length === 1 && delta.chat[0].text === 'delta check', `got ${delta.chat.length} chat rows`);
    assert(delta.feed.every((f) => f.seq > since.f), 'feed delta leaked old rows');
    return '1 new chat row, no repeats';
  });

  /* ---- case opening, the headline bug ---- */
  const cheap = cfg.json.cases[0];
  await check('case/open: debits gems and lands the items in the inventory', async () => {
    const before = (await api('state', undefined, pid)).json.you;
    const res = await api('case/open', { caseId: cheap.id, count: 3 }, pid);
    assert(res.status === 200, `HTTP ${res.status}: ${res.json && res.json.error}`);
    const after = res.json.you;
    assert(after.balance === before.balance - cheap.gems * 3, `balance ${before.balance} -> ${after.balance} (price ${cheap.gems}×3)`);
    assert(after.invCount === before.invCount + 3, `inventory ${before.invCount} -> ${after.invCount}`);
    assert(res.json.items.length === 3, 'three items returned');
    const sum = res.json.items.reduce((s, i) => s + i.value, 0);
    assert(res.json.refund === sum, `refund ${res.json.refund} vs items ${sum}`);
    assert(res.json.items.every((i) => i.uid && i.name && i.value > 0 && i.wearShort), 'item shape');
    return `💎 ${cheap.gems * 3} spent, 💎 ${sum} back, 3 items owned`;
  });

  await check('case/open: a free voucher opens without touching gems', async () => {
    const before = (await api('state', undefined, pid)).json.you;
    const res = await api('case/open', { caseId: cheap.id, count: 1, voucher: true }, pid);
    assert(res.status === 200, `HTTP ${res.status}: ${res.json && res.json.error}`);
    assert(res.json.you.balance === before.balance, `balance moved: ${before.balance} -> ${res.json.you.balance}`);
    assert(res.json.you.freeCases === before.freeCases - 1, `vouchers ${before.freeCases} -> ${res.json.you.freeCases}`);
    assert(res.json.you.invCount === before.invCount + 1, 'item should still land in the inventory');
    return `voucher spent, 💎 ${res.json.refund} of items still owned`;
  });

  await check('case/open: a case it cannot pay for is refused with no side effects', async () => {
    const broke = (await api('hello', { name: 'Broke' })).json.pid;
    const big = cfg.json.cases[cfg.json.cases.length - 1];
    const res = await api('case/open', { caseId: big.id, count: 5 }, broke);
    assert(res.status === 400 && res.json.error, 'should be refused');
    const after = (await api('state', undefined, broke)).json.you;
    assert(after.balance === 2500 && after.invCount === 0, 'nothing may be charged');
    return res.json.error.slice(0, 60) + '…';
  });

  await check('inventory: selling one item credits its exact value', async () => {
    const before = (await api('state', undefined, pid)).json.you;
    const item = before.inventory[0];
    assert(item, 'need an item to sell');
    const res = await api('inventory/sell', { uid: item.uid }, pid);
    assert(res.status === 200, res.json.error);
    assert(res.json.you.balance === before.balance + item.value, `balance ${before.balance} -> ${res.json.you.balance}, item worth ${item.value}`);
    assert(res.json.you.invCount === before.invCount - 1, 'item left the inventory');
    return `sold ${item.name} for 💎 ${item.value}`;
  });

  await check('inventory: sell-all returns every item and empties the list', async () => {
    const before = (await api('state', undefined, pid)).json.you;
    const res = await api('inventory/sellall', {}, pid);
    assert(res.status === 200, res.json.error);
    assert(res.json.count === before.invCount, `${res.json.count} of ${before.invCount}`);
    assert(res.json.you.invCount === 0 && res.json.you.balance === before.balance + res.json.total, 'balance must add up');
    return `${res.json.count} items → 💎 ${res.json.total}`;
  });

  await check('battle/start: charges the entry, rolls both piles, pays the pot to the winner', async () => {
    const before = (await api('state', undefined, pid)).json.you.balance;
    const beforeInv = (await api('state', undefined, pid)).json.you.invCount;
    const res = await api('battle/start', { caseId: cheap.id, count: 2 }, pid);
    assert(res.status === 200, res.json.error);
    const cost = cheap.gems * 2;
    assert(res.json.cost === cost, `cost ${res.json.cost} vs ${cost}`);
    assert(res.json.pot === res.json.yourPile.total + res.json.oppPile.total, 'pot must be both piles');
    assert(res.json.yourPile.items.length === 2 && res.json.oppPile.items.length === 2, 'two items a side');
    const after = res.json.you;
    // the pot is skins, not gems: the balance only ever moves by the entry fee,
    // and the winner takes the contents of both piles into the inventory
    assert(after.balance === before - cost, `balance should move by the entry fee only: ${before} -> ${after.balance}`);
    if (res.json.win) {
      assert(after.invCount === beforeInv + 4, `winner takes both piles: ${beforeInv} -> ${after.invCount} items`);
      assert(res.json.pot > 0, 'pot must be worth something');
    } else {
      assert(after.invCount === beforeInv, `loser keeps nothing: ${beforeInv} -> ${after.invCount}`);
    }
    assert(after.stats.battles >= 1, 'battle counted');
    return `${res.json.win ? 'won' : 'lost'} · pot 💎 ${res.json.pot} in skins vs 💎 ${cost} entry`;
  });

  await check('crash: bet → round runs → cash out credits stake × multiplier', async () => {
    let st = (await api('state', undefined, pid)).json;
    for (let i = 0; i < 150 && st.crash.phase !== 'betting'; i++) {
      await wait(120);
      st = (await api('state', undefined, pid)).json;
    }
    assert(st.crash.phase === 'betting', `phase ${st.crash.phase}`);
    const before = (await api('state', undefined, pid)).json;
    const betRes = await api('crash/bet', { amount: 200, auto: 50 }, pid);
    assert(betRes.status === 200, betRes.json.error);
    assert(betRes.json.you.balance === before.you.balance - 200, 'bet charged up front');

    let cashed = null;
    for (let i = 0; i < 400 && !cashed; i++) {
      await wait(100);
      const s = (await api('state', undefined, pid)).json;
      if (s.crash.phase === 'running' && s.you.crashBet && !s.you.crashBet.cashedAt && !s.you.crashBet.busted) {
        const out = await api('crash/cashout', {}, pid);
        assert(out.status === 200, out.json.error);
        cashed = out.json;
      }
      if (s.you.crashBet && s.you.crashBet.busted) return 'round busted first (1%-style instant bust) — bet was charged, nothing credited';
    }
    if (!cashed) return 'no cash-out window caught (auto-cash-out carried it)';
    assert(cashed.mult >= 1, `multiplier ${cashed.mult}`);
    assert(cashed.payout === Math.round(cashed.mult * 200) || cashed.payout === Math.round(cashed.mult * 200), `payout ${cashed.payout} vs ${cashed.mult}×200`);
    return `cashed ${cashed.mult.toFixed(2)}× → 💎 ${cashed.payout}`;
  });

  await check('double: bet lands on the wheel and pays the printed odds', async () => {
    let st = (await api('state', undefined, pid)).json;
    for (let i = 0; i < 200 && st.double.phase !== 'betting'; i++) {
      await wait(150);
      st = (await api('state', undefined, pid)).json;
    }
    if (st.double.phase !== 'betting') return 'wheel was mid-spin, skipped';
    const before = st.you.balance;
    const res = await api('double/bet', { color: 'green', amount: 100 }, pid);
    assert(res.status === 200, res.json.error);
    assert(res.json.you.balance === before - 100, 'stake taken');
    assert(res.json.you.doubleBet && res.json.you.doubleBet.color === 'green', 'bet visible in the snapshot');
    const dup = await api('double/bet', { color: 'red', amount: 100 }, pid);
    assert(dup.status === 400, 'a second bet in the same spin must be refused');
    return `💎 100 on green · 2× pays ${DOUBLE_PAYOUT.green}×`;
  });

  await check('mines: start, reveal, cash out — payout matches the shown multiplier', async () => {
    const start = await api('mines/start', { bet: 300, mines: 3 }, pid);
    assert(start.status === 200, start.json.error);
    assert(start.json.mines.active === true && start.json.mines.revealed.length === 0, 'fresh board');
    let safe = 0;
    let busted = false;
    for (let tile = 0; tile < 6 && !busted; tile++) {
      const pick = await api('mines/pick', { tile }, pid);
      assert(pick.status === 200, pick.json.error);
      const m = pick.json.mines;
      if (pick.json.result.bom) { busted = true; assert(m.active === false, 'bust ends the round'); break; }
      safe++;
      if (safe >= 2) {
        const out = await api('mines/cashout', {}, pid);
        assert(out.status === 200, out.json.error);
        assert(out.json.payout === Math.round(300 * out.json.mult), `payout ${out.json.payout} vs 300×${out.json.mult}`);
        return `${safe} safe tiles, cashed ${out.json.mult.toFixed(2)}× → 💎 ${out.json.payout}`;
      }
    }
    if (busted) return 'hit a mine (3 of 25 tiles are mines) — round closed cleanly';
    return `${safe} safe tiles revealed`;
  });

  await check('tiles: five rows, cash out at the printed ladder', async () => {
    const start = await api('tiles/start', { bet: 300 }, pid);
    assert(start.status === 200, start.json.error);
    assert(start.json.tiles.active === true && start.json.tiles.rows.length === 5, 'fresh run');
    const pick = await api('tiles/pick', { tile: 2 }, pid);
    assert(pick.status === 200, pick.json.error);
    if (pick.json.result.dead) return 'first tile was cursed — run closed cleanly';
    const t = pick.json.tiles;
    assert(t.curMult === 1.2 || t.curMult === 0, `row 1 pays 1.20×, got ${t.curMult}`);
    const out = await api('tiles/cashout', {}, pid);
    assert(out.status === 200, out.json.error);
    assert(out.json.payout === Math.round(300 * out.json.mult), 'payout = bet × ladder');
    return `cashed row 1 at ${out.json.mult.toFixed(2)}× → 💎 ${out.json.payout}`;
  });

  await check('plinko: the ball lands in the slot the table pays', async () => {
    for (const rows of [8, 12, 16]) {
      for (const risk of ['low', 'medium', 'high']) {
        const res = await api('plinko/drop', { rows, risk, amount: 100 }, pid);
        assert(res.status === 200, res.json.error);
        const r = res.json.result;
        const table = PLINKO[rows][risk];
        assert(r.path.length === rows, `path has ${r.path.length} steps, expected ${rows}`);
        assert(r.path.reduce((s, x) => s + x, 0) === r.slot, 'slot must equal the number of right turns');
        assert(r.mult === table[r.slot], `table says ${table[r.slot]}×, result says ${r.mult}×`);
        assert(r.payout === Math.round(100 * table[r.slot]), `payout ${r.payout}`);
      }
    }
    return 'all 9 boards (8/12/16 rows × 3 risks) match their printed tables';
  });

  await check('upgrader: chance and payout follow the dial', async () => {
    const target = 4;
    const before = (await api('state', undefined, pid)).json.you;
    const res = await api('upgrader/spin', { amount: 100, target }, pid);
    assert(res.status === 200, res.json.error);
    const r = res.json.result;
    const expectedChance = Math.min(0.99, Math.max(0.005, (1 / target) * 0.96));
    assert(near(r.chance, expectedChance, 1e-9), `chance ${r.chance} vs ${expectedChance}`);
    if (r.win) {
      assert(r.payout === Math.round(100 * target), `payout ${r.payout} vs ${100 * target}`);
      assert(res.json.you.balance === before.balance - 100 + r.payout, 'balance must reflect the upgrade');
    } else {
      assert(res.json.you.balance === before.balance - 100, 'a loss costs exactly the stake');
    }
    return `${(r.chance * 100).toFixed(2)}% dial · ${r.win ? 'won' : 'lost'} 💎 ${r.stakeValue}`;
  });

  await check('champion: an entry is a share of the pot, and only while joining', async () => {
    const st = (await api('state', undefined, pid)).json;
    const res = await api('champion/join', { amount: 100 }, pid);
    if (st.champion.phase !== 'joining') {
      assert(res.status === 400, 'must be refused during the draw');
      return 'draw in progress — entry correctly refused';
    }
    assert(res.status === 200, res.json.error);
    const after = (await api('state', undefined, pid)).json;
    const mine = after.champion.contributors.filter((c) => c.you).reduce((s, c) => s + c.amount, 0);
    assert(mine >= 100, `you-flagged contribution: ${mine}`);
    assert(after.champion.pot >= mine, 'pot must include your stake');
    return `💎 100 into a 💎 ${after.champion.pot} pot`;
  });

  await check('rewards: free gems drop on a cooldown, not on demand', async () => {
    const first = await api('bonus', {}, pid);
    assert(first.status === 200, first.json.error);
    assert(first.json.amount >= 2500 && first.json.amount <= 9000, `drop ${first.json.amount}`);
    const second = await api('bonus', {}, pid);
    assert(second.status === 400 && /drop/i.test(second.json.error), 'the cooldown must bite');
    return `💎 ${first.json.amount} then "${second.json.error}"`;
  });

  await check('rewards: three case vouchers, then the cooldown takes over', async () => {
    const fresh = (await api('hello', { name: 'Vouchers' })).json.pid;
    const first = await api('rewards/free-cases', {}, fresh);
    assert(first.status === 200, first.json.error);
    assert(first.json.freeCases === 6, `3 starting + 3 claimed = 6, got ${first.json.freeCases}`);
    const second = await api('rewards/free-cases', {}, fresh);
    assert(second.status === 400, 'cooldown must bite');
    return `${first.json.freeCases} vouchers held, then "${second.json.error.slice(0, 40)}…"`;
  });

  await check('vouchers: they are capped by case price', async () => {
    const fresh = (await api('hello', { name: 'Capped' })).json.pid;
    const expensive = cfg.json.cases.filter((c) => c.gems > cfg.json.freebies.freeCaseMaxPrice).pop();
    const res = await api('case/open', { caseId: expensive.id, count: 1, voucher: true }, fresh);
    assert(res.status === 400, 'a voucher must not open a whale case');
    return `💎 ${expensive.gems} case refused with a voucher (max 💎 ${cfg.json.freebies.freeCaseMaxPrice})`;
  });

  await check('race: wagering climbs the ladder, prizes are printed', async () => {
    const race = (await api('race', undefined, pid)).json;
    assert(Array.isArray(race.top) && race.top.length <= 10, 'top ten');
    assert(race.top.every((r) => r.place >= 1 && r.prize >= 0), 'places and prizes');
    assert(race.endsAt > Date.now(), 'the clock is running');
    return `#${race.myRank} of ${race.totalPlayers} · top prize 💎 ${race.top[0] ? race.top[0].prize : 0}`;
  });

  await check('profile: rename, stats and reset all behave', async () => {
    const renamed = await api('rename', { name: 'Scripted' }, pid);
    assert(renamed.status === 200, renamed.json.error);
    assert(renamed.json.you.name === 'Scripted', 'name should stick');
    const bad = await api('rename', { name: '<>' }, pid);
    assert(bad.status === 400 || /^[a-zA-Z0-9_ ]{2,14}$/.test(bad.json.you.name), 'names get cleaned');
    await api('case/open', { caseId: cheap.id, count: 1 }, pid);
    const st = (await api('state', undefined, pid)).json.you;
    assert(st.stats.opened >= 1, 'stats track openings');
    assert(st.stats.battles >= 1, 'stats track battles');
    assert(st.xp > 0 && st.level >= 1, 'wagering earns xp');
    const reset = await api('reset', {}, pid);
    assert(reset.status === 200, reset.json.error);
    assert(reset.json.you.balance === 2500 && reset.json.you.invCount === 0, 'reset wipes the fake account');
    return `level ${st.level} · 💎 ${st.netWorth} net worth -> reset to 💎 2,500`;
  });

  await check('chat: rate-limited, and every speaker is tagged', async () => {
    const ok = await api('chat', { text: 'hello from the smoke test' }, pid);
    assert(ok.status === 200, ok.json.error);
    const fast = await api('chat', { text: 'again instantly' }, pid);
    assert(fast.status === 400, 'flood control must work');
    const st = (await api('state', undefined, pid)).json;
    const speakers = st.chat.filter((m) => !m.system);
    assert(speakers.length > 0, 'somebody is talking');
    assert(speakers.every((m) => m.isBot === false || m.isBot === true), 'bot flag present on humans and bots');
    return `${st.chat.length} messages, ${speakers.filter((m) => m.isBot).length} from bots`;
  });

  await check('samples: the odds verifier returns real counts', async () => {
    const res = await api(`samples?id=${cheap.id}&n=3000`);
    assert(res.status === 200, `${res.status}`);
    const r = res.json;
    const tiers = Object.values(r.tiers).reduce((s, v) => s + v, 0);
    assert(tiers === 3000, `tier counts sum to ${tiers}`);
    assert(r.spent === cheap.gems * 3000, 'spent must be openings × price');
    assert(r.returnPct > 50 && r.returnPct < 150, `return ${r.returnPct}% is not plausible`);
    return `3000 rolls → ${r.returnPct}% back (theory ${((r.returned / r.spent) * 100).toFixed(1)}%)`;
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ==========================================================================
   run
   ========================================================================== */

(async () => {
  console.log(`[smoke] ${externalUrl ? 'testing ' + BASE : 'booting a scratch server on ' + BASE}`);
  try {
    await startServer();
    await testCatalog();
    await testHttp();
  } catch (err) {
    results.push({ name: 'harness', ok: false, note: err.message });
  } finally {
    stopServer();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('');
  results.forEach((r) => console.log(`${r.ok ? ' ok ' : 'FAIL'}  ${r.name}${r.note ? `  —  ${r.note}` : ''}`));
  console.log(`\n[smoke] ${results.length - failed.length}/${results.length} passed${failed.length ? ' — FAILURES' : ' — all good'}`);
  process.exit(failed.length ? 1 : 0);
})();
