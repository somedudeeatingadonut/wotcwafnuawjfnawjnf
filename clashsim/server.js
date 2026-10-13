#!/usr/bin/env node
/**
 * clash.sim — a fake-currency emulator of a CS2 skin-gambling site.
 * ---------------------------------------------------------------------------
 * Games: Case Opening · Case Battles · Crash · Double · Upgrader · Mines ·
 *        Plinko · Tiles · Champion (jackpot) · Daily Race
 *
 * REAL_MONEY_ENABLED is false and there is no deposit, withdrawal, payment,
 * crypto or account code anywhere in this project. Gems are handed out for
 * free, items are simulated values on real item names, and every opponent in
 * the lobby is a bot.
 *
 * Zero dependencies: node:http + vanilla JS.
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const catalog = require('./lib/catalog');
const creator = require('./lib/creator');
const W = require('./lib/world');
const { ACTIONS, PLINKO, MIN_BET } = require('./lib/games');

const REAL_MONEY_ENABLED = false;   // there is no real money. none. zero.
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ==========================================================================
   Static files
   ========================================================================== */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
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

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'content-type': 'text/plain' }).end('forbidden');
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
      'access-control-allow-origin': '*',
    });
    res.end(buf);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    let tooBig = false;
    req.on('data', (c) => { data += c; if (data.length > 64 * 1024) { tooBig = true; req.destroy(); } });
    req.on('end', () => {
      if (tooBig) return resolve({});
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[<>&"'`\\]/g, '').trim().slice(0, max);

/* ==========================================================================
   Config payload (light: no case contents, those load per case)
   ========================================================================== */

function configPayload() {
  return {
    site: 'clash.sim',
    tagline: 'A fake-currency emulator of a CS2 skin site. No real money, no deposits, no withdrawals.',
    realMoney: REAL_MONEY_ENABLED,
    currency: 'gems',
    minBet: MIN_BET,
    rarities: catalog.rarities,
    wears: catalog.wearTable,
    stattrak: catalog.stattrak,
    cases: catalog.cases.map((c) => {
      const pub = catalog.publicCase(c);
      const { contents, ...light } = pub;
      return { ...light, ev: catalog.caseEv(c), returnRate: 0.9 };
    }),
    plinko: PLINKO,
    double: { segments: W.DOUBLE_SEGMENTS, payouts: W.DOUBLE_PAYOUT, betMs: W.double.BET_MS, spinMs: W.double.SPIN_MS },
    tiles: W.TILES_ROWS.map((r, i) => ({ row: i + 1, cursed: r.cursed, of: r.of, mult: r.mult })),
    mines: { rake: 0.03, grid: 25 },
    crash: { betMs: W.CRASH.BET_MS, growthMs: W.CRASH.GROWTH_MS, instantBustChance: 0.01 },
    champion: { joinMs: W.champion.JOIN_MS, rake: 0.05, minEntry: 100 },
    race: { lengthHours: 12, prizes: [5000, 3000, 2000, 1500, 1200, 1000, 800, 700, 600, 500] },
    freebies: {
      freeCases: 3,
      freeCaseEveryMinutes: 45,
      freeCaseMaxPrice: W.FREE_CASE_MAX_PRICE,
      gemDropEverySeconds: W.BONUS_COOLDOWN_MS / 1000,
    },
    botCount: W.world.bots.length,
    botsTagged: true,
  };
}

/* ==========================================================================
   Router
   ========================================================================== */

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

  const pid = clean(url.searchParams.get('pid'), 40);
  const route = pathname.slice(5);

  /* ---- public ---- */
  if (route === 'config' && req.method === 'GET') return sendJson(res, 200, configPayload());

  if (route === 'case' && req.method === 'GET') {
    const def = catalog.getCase(clean(url.searchParams.get('id'), 40));
    if (!def) return sendJson(res, 404, { error: 'Unknown case.' });
    const pub = catalog.publicCase(def);
    return sendJson(res, 200, { ...pub, ev: catalog.caseEv(def), returnRate: 0.9 });
  }

  if (route === 'samples' && req.method === 'GET') {
    // roll a few thousand cases and report the real payout — used by the tests,
    // and by the "verify the odds" button in the About tab
    const def = catalog.getCase(clean(url.searchParams.get('id'), 40));
    if (!def) return sendJson(res, 404, { error: 'Unknown case.' });
    const n = Math.min(20000, Math.max(100, Number(url.searchParams.get('n')) || 5000));
    let total = 0;
    let best = 0;
    const tierCount = {};
    for (let i = 0; i < n; i++) {
      const it = catalog.rollItem(def.id);
      total += it.value;
      best = Math.max(best, it.value);
      tierCount[it.rarity] = (tierCount[it.rarity] || 0) + 1;
    }
    return sendJson(res, 200, {
      case: def.id, openings: n, priceEach: def.gems,
      spent: def.gems * n, returned: total,
      returnPct: Math.round((total / (def.gems * n)) * 1000) / 10,
      bestPull: best, tiers: tierCount,
    });
  }

  if (route === 'items' && req.method === 'GET') {
    // the Case Creator's item picker ("Select up to 20 items")
    const q = url.searchParams.get('q') || '';
    const rarity = clean(url.searchParams.get('rarity'), 24) || 'all';
    const limit = Number(url.searchParams.get('limit')) || 40;
    return sendJson(res, 200, {
      items: creator.searchItems(q, rarity, limit),
      universe: creator.universeSize(),
      rarities: catalog.rarities,
    });
  }

  if (route === 'honor-roll' && req.method === 'GET') {
    return sendJson(res, 200, { cases: creator.all().slice(-40).reverse().map((c) => ({
      id: c.id, name: c.name, by: c.ownerName, gems: c.gems, opens: c.opens, earned: c.earned, image: c.image, items: c.items.length,
    })) });
  }

  if (route === 'hello' && req.method === 'POST') {
    const body = await readBody(req);
    const id = clean(body.pid, 40) || pid || require('node:crypto').randomBytes(8).toString('hex');
    let p = W.world.players.get(id);
    const isNew = !p;
    if (!p) {
      p = W.newPlayer(id, clean(body.name, 14));
      W.world.players.set(id, p);
    } else if (body.name) {
      const nm = clean(body.name, 14);
      if (nm.length >= 2) p.name = nm;
    }
    W.scheduleSave();
    return sendJson(res, 200, { ok: true, pid: id, isNew, ...W.stateSnapshot(p, 0, 0) });
  }

  /* ---- needs a session ---- */
  const player = W.getPlayer(pid);
  if (!player) return sendJson(res, 400, { error: 'Unknown session — reload the page.' });

  if (route === 'creator' && req.method === 'GET') {
    return sendJson(res, 200, {
      rules: {
        minLevel: creator.MIN_LEVEL, maxCases: creator.MAX_CASES_PER_PLAYER, commission: creator.COMMISSION,
        maxItems: creator.MAX_ITEMS, minItems: creator.MIN_ITEMS, nameMin: creator.NAME_MIN, nameMax: creator.NAME_MAX,
      },
      mine: creator.mine(player.id),
      art: creator.artChoices(60),
      rarities: catalog.rarities,
      universe: creator.universeSize(),
    });
  }

  if (route === 'state' && req.method === 'GET') {
    return sendJson(res, 200, W.stateSnapshot(player, url.searchParams.get('sinceChat'), url.searchParams.get('sinceFeed')));
  }

  if (route === 'race' && req.method === 'GET') {
    return sendJson(res, 200, W.raceStandings(player));
  }

  if (ACTIONS[route] && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const result = ACTIONS[route](player, body);
      if (result && result.error) return sendJson(res, 400, result);
      return sendJson(res, 200, { rev: W.world.rev, ...result, you: result.you || W.publicPlayer(player) });
    } catch (err) {
      console.error('[clashsim] action failed', route, err);
      return sendJson(res, 500, { error: 'Something went wrong in the sim.' });
    }
  }

  return sendJson(res, 404, { error: 'Unknown endpoint.' });
});

/* ==========================================================================
   Boot
   ========================================================================== */

async function main() {
  await W.loadPlayers();
  creator.setUniverse(catalog.itemUniverse());   // the Case Creator's shop of parts
  creator.setEconomy(catalog.wearTable, catalog.stattrak);
  W.boot();

  W.systemChat('Welcome to clash.sim — a fake-currency emulator. Every gem is free, every opponent is a bot, and there is no way to spend real money here.');
  W.systemChat('Tip: the Odds page inside every case shows the real drop table. The house edge is printed on it, not hidden behind it.');

  server.listen(PORT, HOST, () => {
    console.log(`[clashsim] fake-currency CS2 site sim on http://${HOST}:${PORT}`);
    console.log(`[clashsim] ${catalog.cases.length} cases, ${catalog.cases.reduce((s, c) => s + c.items.length, 0)} items, ${creator.universeSize()} creator parts, ${W.world.bots.length} bots`);
    console.log('[clashsim] real money: DISABLED (no deposits, no withdrawals, no payments)');
  });
}

process.on('SIGTERM', () => { try { server.close(); } catch {} process.exit(0); });
process.on('SIGINT', () => { try { server.close(); } catch {} process.exit(0); });

main();
