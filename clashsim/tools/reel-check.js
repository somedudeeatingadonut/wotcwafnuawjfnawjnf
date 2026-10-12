#!/usr/bin/env node
/**
 * tools/reel-check.js — the one test a headless DOM cannot do.
 *
 *   npm run test:reel                      # boots its own scratch server
 *   node tools/reel-check.js               # same
 *   node tools/reel-check.js http://host:port
 *
 * Why this exists: jsdom gives every element a zero-sized rect and runs no
 * animations, so a completely motionless case reel passes every jsdom test.
 * That is exactly how "the case opening still doesnt work properly, it stays
 * stuck in one place" shipped twice. This harness drives a real Chromium and
 * measures the reel's on-screen position frame by frame.
 *
 * What it pins down:
 *   · the reel moves, in every speed, and the winner lands under the pointer
 *   · Normal is ~3× the Quick spin and walks past ~3× as many items
 *   · prefers-reduced-motion still animates (that setting is what used to
 *     flatten the CSS transition to a jump), and an explicit speed choice
 *     beats the reduced-motion default
 *   · clicking the reel ends the wait immediately
 *   · zero-sized rects (hidden/collapsed layout) still animate
 *   · both case-battle reels move
 *
 * Chromium comes from @sparticuz/chromium (an npm tarball, so it is reachable
 * even where Google's CDN is not) plus its brotli-packed system libraries.
 * If those packages are not installed this exits 0 with a SKIP line: the test
 * is valuable, but it must never block a machine that cannot run a browser.
 */

'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.REEL_PORT || 3988);
const externalUrl = process.argv[2] || process.env.REEL_URL || '';
const BASE = externalUrl || `http://127.0.0.1:${PORT}`;

/* The expectations, in one place. caseMs/delay/settle mirror core.js. */
const SPEEDS = {
  turbo: { caseMs: 1200, delayMs: 180, settleMs: 50 },
  quick: { caseMs: 3400, delayMs: 510, settleMs: 140 },
  normal: { caseMs: 10200, delayMs: 1500, settleMs: 410 },
  slow: { caseMs: 16000, delayMs: 1500, settleMs: 640 },
};
const reveal = (k) => SPEEDS[k].caseMs + SPEEDS[k].delayMs + SPEEDS[k].settleMs;
const within = (v, target, tol) => Math.abs(v - target) <= target * tol;

const results = [];
const check = async (name, fn) => {
  try {
    const note = await fn();
    results.push({ name, ok: true, note: typeof note === 'string' ? note : '' });
  } catch (err) {
    results.push({ name, ok: false, note: err.message });
  }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };

/* ------------------------------------------------------------- dependencies */

function browserDirs(extraDirs) {
  return [
    process.env.CLASH_BROWSER_DIR,
    path.join(ROOT, 'node_modules'),
    ...extraDirs,
  ].filter(Boolean);
}

function resolveDep(name, dirs) {
  for (const dir of dirs) {
    try {
      return require(require.resolve(name, { paths: [dir] }));
    } catch { /* try the next location */ }
  }
  return null;
}

/** Package folder of a dependency. `require.resolve(pkg + '/package.json')`
 *  is not usable — @sparticuz/chromium's exports map blocks it — so walk up
 *  from the main entry until a package.json shows up. */
function pkgRootOf(name, dirs) {
  let dir = path.dirname(require.resolve(name, { paths: dirs }));
  while (dir !== path.dirname(dir) && !fs.existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir);
  return dir;
}

/** Chromium needs its NSS libs; the package ships them brotli'd as a tar. */
function libPath(chromium, dirs) {
  try {
    const pkgRoot = pkgRootOf('@sparticuz/chromium', dirs);
    const tarball = path.join(pkgRoot, 'bin', 'al2023.tar.br');
    if (!fs.existsSync(tarball)) return '';
    const out = path.join(os.tmpdir(), 'clash-chromium-libs');
    const marker = path.join(out, 'libnss3.so');
    if (!fs.existsSync(marker)) {
      fs.mkdirSync(out, { recursive: true });
      const tarFile = path.join(os.tmpdir(), 'clash-chromium-al2023.tar');
      fs.writeFileSync(tarFile, zlib.brotliDecompressSync(fs.readFileSync(tarball)));
      // spawnSync matters: a plain spawn returns before tar has written the libs
      spawnSync('tar', ['xf', tarFile, '-C', out, '--strip-components=1'], { stdio: 'ignore' });
    }
    if (fs.existsSync(marker)) {
      process.env.LD_LIBRARY_PATH = out + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '');
      return out;
    }
    return '';
  } catch {
    return '';
  }
}

/* --------------------------------------------------------------- the server */

let child = null;

async function startServer() {
  if (externalUrl) return;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clash-reel-'));
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', CLASH_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`${BASE}/api/config`);
      if (res.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`scratch server on ${BASE} did not come up`);
}

const stopServer = () => { if (child) { child.kill('SIGTERM'); child = null; } };

/* ----------------------------------------------------------------- the page */

const TRACK = '#modal-body .roll-track';
const WINDOW = '#modal-body .roll-window';
const OPEN_BTN = '#modal-foot .btn-primary';
const REVEALED = () => {
  const b = document.querySelector('#modal-body .result-banner');
  const t = b ? b.textContent : '';
  return /Pulled|Free case/.test(t);
};

async function newPage(browser, { motion = 'no-preference', speed = null } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 950 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  if (motion === 'reduce') await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  // an explicit per-page choice; `null` clears it so the default is tested
  await page.evaluateOnNewDocument((key) => {
    try {
      if (key) localStorage.setItem('clashsim.reelSpeed', key);
      else localStorage.removeItem('clashsim.reelSpeed');
    } catch { /* private mode */ }
  }, speed);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  if (!(await page.$eval('#name-root', (el) => el.hidden))) {
    await page.type('#name-input', `Reel ${speed || motion}`);
    await page.click('#name-save');
    await new Promise((r) => setTimeout(r, 400));
  }
  page.__errors = errors;
  return page;
}

async function openCaseModal(page) {
  await page.click('.nav-item[data-view="cases"]');
  await new Promise((r) => setTimeout(r, 300));
  await page.click('#case-grid .case-card .btn-primary');
  await new Promise((r) => setTimeout(r, 800));
}

/** Click Open, then watch the track and time the reveal. */
async function spinAndWatch(page, { maxMs = 25000, step = 150 } = {}) {
  const started = Date.now();
  const seen = [];
  await page.click(OPEN_BTN);
  let revealed = false;
  while (Date.now() - started < maxMs) {
    await new Promise((r) => setTimeout(r, step));
    const sample = await page.evaluate((sel) => {
      const t = document.querySelector(sel);
      const r = t ? t.getBoundingClientRect() : null;
      const b = document.querySelector('#modal-body .result-banner');
      return {
        x: r ? Math.round(r.left) : null,
        inline: t ? t.style.transform : null,
        text: b ? b.textContent : '',
        children: t ? t.children.length : 0,
      };
    }, TRACK);
    seen.push(sample);
    if (/Pulled|Free case/.test(sample.text)) { revealed = true; break; }
  }
  const elapsed = Date.now() - started;
  const positions = new Set(seen.map((s) => s.x).filter((x) => x !== null));
  const transforms = new Set(seen.map((s) => s.inline).filter(Boolean));
  return {
    elapsed,
    revealed,
    moves: Math.max(positions.size, transforms.size),
    transformed: transforms.size,
    children: seen.reduce((m, s) => Math.max(m, s.children), 0),
  };
}

async function pointerGap(page) {
  return page.evaluate((tSel, wSel) => {
    const t = document.querySelector(tSel);
    const w = document.querySelector(wSel);
    if (!t || !w) return null;
    const wr = w.getBoundingClientRect();
    const centre = wr.left + wr.width / 2;
    let best = null;
    Array.from(t.children).forEach((k) => {
      const r = k.getBoundingClientRect();
      if (r.width <= 0) return;
      const d = Math.abs(r.left + r.width / 2 - centre);
      if (best === null || d < best.d) best = { d: Math.round(d), name: k.textContent.trim().replace(/\s+/g, ' ').slice(0, 26) };
    });
    return best;
  }, TRACK, WINDOW);
}

/* ------------------------------------------------------------------- checks */

let quickElapsed = 0;

async function caseReel(browser, speed, motion = 'no-preference') {
  const page = await newPage(browser, { motion, speed });
  await openCaseModal(page);
  const run = await spinAndWatch(page);
  const gap = await pointerGap(page);
  const errs = page.__errors.length;
  await page.screenshot({ path: path.join(os.tmpdir(), `clash-reel-${speed}${motion === 'reduce' ? '-reduce' : ''}.png`) });
  await page.close();

  assert(run.revealed, `no result appeared within ${run.elapsed}ms`);
  assert(run.moves >= 3, `the track only reached ${run.moves} positions — the reel is stuck`);
  assert(gap && gap.d <= 40, `winner is ${gap ? gap.d + 'px' : 'unmeasurable'} from the pointer`);
  assert(errs === 0, `${errs} page error(s)`);
  return { run, gap };
}

async function runChecks(browser) {
  await check('case reel: quick animates, lands, and takes as long as advertised', async () => {
    const { run, gap } = await caseReel(browser, 'quick');
    quickElapsed = run.elapsed;
    assert(within(run.elapsed, reveal('quick'), 0.3), `took ${run.elapsed}ms, expected ~${reveal('quick')}ms`);
    return `${run.moves} positions · ${run.elapsed}ms · winner ${gap.d}px off`;
  });

  await check('case reel: normal is ~3× slower and walks ~3× the items', async () => {
    const { run, gap } = await caseReel(browser, 'normal');
    const ratio = run.elapsed / quickElapsed;
    assert(within(ratio, 3, 0.3), `normal/quick duration ratio is ${ratio.toFixed(2)}, expected ~3`);
    assert(run.children >= 60, `normal reel only carries ${run.children} items (want ≥ 60)`);
    assert(run.moves > 12, `only ${run.moves} positions in a 10s spin`);
    return `${run.elapsed}ms (${ratio.toFixed(2)}× quick) · ${run.children} items · winner ${gap.d}px off`;
  });

  await check('case reel: reduced-motion still animates (turbo default)', async () => {
    const { run } = await caseReel(browser, null, 'reduce');
    assert(run.elapsed <= 4000, `reduced-motion default took ${run.elapsed}ms — it should be the turbo reel`);
    return `${run.moves} positions · ${run.elapsed}ms — motion survives prefers-reduced-motion`;
  });

  await check('case reel: an explicit speed beats the reduced-motion default', async () => {
    const { run } = await caseReel(browser, 'normal', 'reduce');
    assert(within(run.elapsed, reveal('normal'), 0.3), `took ${run.elapsed}ms, expected ~${reveal('normal')}ms`);
    assert(run.moves > 12, `only ${run.moves} positions with reduce-motion + explicit Normal`);
    return `reduce-motion still honoured the chosen Normal reel (${run.elapsed}ms, ${run.moves} positions)`;
  });

  await check('reel speed picker: present everywhere, and it sticks', async () => {
    const page = await newPage(browser, { speed: null });
    await openCaseModal(page);
    const sels = await page.$$eval('[data-reel-speed]', (els) => els.map((e) => ({ where: e.closest('#modal-foot') ? 'modal' : e.closest('.topbar') ? 'header' : 'battles', value: e.value })));
    assert(sels.length >= 3, `found ${sels.length} speed pickers, expected the header, the case modal and the battle setup`);
    await page.select('.topbar [data-reel-speed]', 'slow');
    await new Promise((r) => setTimeout(r, 200));
    const after = await page.evaluate(() => ({
      stored: localStorage.getItem('clashsim.reelSpeed'),
      values: Array.from(document.querySelectorAll('[data-reel-speed]')).map((e) => e.value),
    }));
    await page.close();
    assert(after.stored === 'slow', `localStorage has "${after.stored}" after picking Slow`);
    assert(after.values.every((v) => v === 'slow'), `picker values did not sync: ${after.values.join(', ')}`);
    return `pickers: ${sels.map((s) => s.where).join(', ')} · picking Slow syncs all of them`;
  });

  await check('case reel: clicking the reel skips to the result', async () => {
    const page = await newPage(browser, { speed: 'slow' });
    await openCaseModal(page);
    const started = Date.now();
    await page.click(OPEN_BTN);
    await new Promise((r) => setTimeout(r, 1800));         // mid-spin (slow is 18s)
    await page.click(WINDOW);
    let revealed = false;
    while (Date.now() - started < 6000) {
      await new Promise((r) => setTimeout(r, 120));
      if (await page.evaluate(REVEALED)) { revealed = true; break; }
    }
    const gap = await pointerGap(page);
    await page.close();
    assert(revealed, 'the skip click did not reveal the result');
    assert(gap && gap.d <= 40, `after skipping, the winner is ${gap ? gap.d + 'px' : 'unmeasurable'} from the pointer`);
    return `skipped a Slow reel in ${Date.now() - started}ms and still landed on the item (${gap.d}px off)`;
  });

  await check('case reel: zero-sized rects still animate', async () => {
    const page = await newPage(browser, { speed: 'turbo' });
    await openCaseModal(page);
    await page.evaluate((sel) => {
      const zero = () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 });
      const t = document.querySelector(sel);
      t.getBoundingClientRect = zero;
      Array.from(t.children).forEach((k) => { k.getBoundingClientRect = zero; });
      const w = document.querySelector('#modal-body .roll-window');
      if (w) w.getBoundingClientRect = zero;
    }, TRACK);
    const run = await spinAndWatch(page, { maxMs: 8000 });
    await page.close();
    assert(run.transformed >= 3, `only ${run.transformed} distinct transforms with 0×0 rects — animation was skipped`);
    return `${run.transformed} transforms with 0×0 rects`;
  });

  await check('case battle reels move', async () => {
    const page = await newPage(browser, { speed: 'quick' });
    await page.click('.nav-item[data-view="battles"]');
    await new Promise((r) => setTimeout(r, 400));
    await page.click('#battle-start');
    const sample = async (sel, ticks) => {
      const seen = new Set();
      for (let i = 0; i < ticks; i++) {
        await new Promise((r) => setTimeout(r, 200));
        seen.add(await page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().top), sel));
      }
      return seen.size;
    };
    const [you, bot] = await Promise.all([sample('#reel-you', 22), sample('#reel-bot', 22)]);
    const verdict = await page.$eval('#battle-verdict', (el) => el.textContent.trim());
    await page.close();
    assert(you >= 8, `your battle reel reached only ${you} positions`);
    assert(bot >= 8, `the opponent reel reached only ${bot} positions`);
    assert(verdict.length > 0, 'no verdict after the battle');
    return `you ${you} / bot ${bot} positions · verdict "${verdict}"`;
  });
}

/* --------------------------------------------------------------------- run */

(async () => {
  const dirs = browserDirs([
    path.join(os.tmpdir(), 'br', 'node_modules'),
    path.join(os.tmpdir(), 'clash-browser', 'node_modules'),
  ]);
  const puppeteer = resolveDep('puppeteer-core', dirs);
  const chromiumMod = resolveDep('@sparticuz/chromium', dirs);
  if (!puppeteer || !chromiumMod) {
    console.log('[reel] SKIP — puppeteer-core / @sparticuz/chromium are not installed.');
    console.log('[reel]   npm i -D puppeteer-core @sparticuz/chromium   (or set CLASH_BROWSER_DIR)');
    process.exit(0);
  }
  const chromium = chromiumMod.default || chromiumMod;
  const libs = libPath(chromium, dirs);
  if (libs) console.log(`[reel] chromium libs: ${libs}`);

  console.log(`[reel] ${externalUrl ? 'testing ' + BASE : 'booting a scratch server on ' + BASE}`);
  let browser = null;
  try {
    await startServer();
    browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    await runChecks(browser);
  } catch (err) {
    results.push({ name: 'harness', ok: false, note: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
    stopServer();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('');
  results.forEach((r) => console.log(`${r.ok ? ' ok ' : 'FAIL'}  ${r.name}${r.note ? `  —  ${r.note}` : ''}`));
  console.log(`\n[reel] ${results.length - failed.length}/${results.length} passed${failed.length ? ' — FAILURES' : ' — all good'}`);
  process.exit(failed.length ? 1 : 0);
})();
