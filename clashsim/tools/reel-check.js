#!/usr/bin/env node
/**
 * tools/reel-check.js — the one test that a headless DOM cannot do.
 *
 *   npm run test:reel                     # boots its own scratch server
 *   node tools/reel-check.js              # same
 *   node tools/reel-check.js http://host:port
 *
 * Why this exists: jsdom gives every element a zero-sized rect and runs no
 * animations, so a completely motionless case reel passes every jsdom test.
 * That is exactly how "the case opening still doesnt work properly, it stays
 * stuck in one place" shipped twice. This harness drives a real Chromium and
 * measures the reel's on-screen position frame by frame, in both motion modes:
 *
 *   normal               → the track must move through many distinct positions
 *   prefers-reduced-motion → it must still move (just faster), because the old
 *                          CSS override flattened the animation to a jump
 *
 * It also checks that the winner ends up under the pointer and that the pull
 * is revealed, and that a case battle's two reels both move.
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

async function sampleTrack(page, selector, ticks, everyMs) {
  const seen = [];
  for (let i = 0; i < ticks; i++) {
    await new Promise((r) => setTimeout(r, everyMs));
    seen.push(await page.evaluate((sel) => {
      const t = document.querySelector(sel);
      if (!t) return null;
      const r = t.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), inline: t.style.transform };
    }, selector));
  }
  return seen;
}

const distinct = (samples, key) => new Set(samples.filter(Boolean).map((s) => s[key])).size;

async function pointerGap(page, trackSel, winSel) {
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
      if (best === null || d < best.d) best = { d: Math.round(d), name: k.textContent.trim().replace(/\s+/g, ' ').slice(0, 28) };
    });
    return best;
  }, trackSel, winSel);
}

async function newPage(browser, motion) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 950 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  if (motion === 'reduce') await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  if (!(await page.$eval('#name-root', (el) => el.hidden))) {
    await page.type('#name-input', 'Reel ' + motion);
    await page.click('#name-save');
    await new Promise((r) => setTimeout(r, 400));
  }
  page.__errors = errors;
  return page;
}

/* ------------------------------------------------------------------- checks */

async function caseReel(browser, motion) {
  const page = await newPage(browser, motion);
  await page.click('.nav-item[data-view="cases"]');
  await new Promise((r) => setTimeout(r, 300));
  await page.click('#case-grid .case-card .btn-primary');
  await new Promise((r) => setTimeout(r, 800));

  const btn = await page.$eval(OPEN_BTN, (el) => el.textContent.trim());
  await page.click(OPEN_BTN);
  const samples = await sampleTrack(page, TRACK, motion === 'reduce' ? 14 : 26, 200);

  const moved = distinct(samples, 'x');
  const gap = await pointerGap(page, TRACK, WINDOW);
  const revealed = await page.evaluate(() => {
    const banner = document.querySelector('#modal-body .result-banner');
    const cards = document.querySelectorAll('#modal-body .pull-result > *').length;
    return { banner: banner ? banner.textContent.trim().slice(0, 90) : '', cards };
  });

  await page.screenshot({ path: path.join(os.tmpdir(), `clash-reel-${motion}.png`) });
  const errs = page.__errors.length;
  await page.close();

  const minMoves = motion === 'reduce' ? 3 : 8;
  assert(moved >= minMoves, `track reached only ${moved} distinct positions (wanted ≥ ${minMoves}) — the reel is stuck`);
  assert(gap && gap.d <= 40, `winner is ${gap ? gap.d + 'px' : 'unmeasurable'} from the pointer`);
  assert(revealed.banner.length > 0, 'the pull was never revealed');
  assert(revealed.cards > 0, 'no item cards after the pull');
  assert(errs === 0, `${errs} page error(s)`);
  return `${btn}; ${moved} positions; winner ${gap.d}px off centre; ${revealed.cards} card(s); "${revealed.banner}"`;
}

async function zeroRectStillMoves(browser) {
  // A window/track that measures 0 (hidden tab, collapsed layout) must still be
  // animated rather than silently "revealed" with no motion.
  const page = await newPage(browser, 'normal');
  await page.click('.nav-item[data-view="cases"]');
  await new Promise((r) => setTimeout(r, 300));
  await page.click('#case-grid .case-card .btn-primary');
  await new Promise((r) => setTimeout(r, 800));
  const patched = await page.evaluate((sel) => {
    const t = document.querySelector(sel);
    if (!t) return false;
    const zero = () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 });
    t.getBoundingClientRect = zero;
    Array.from(t.children).forEach((k) => { k.getBoundingClientRect = zero; });
    const w = document.querySelector('#modal-body .roll-window');
    if (w) w.getBoundingClientRect = zero;
    return true;
  }, TRACK);
  assert(patched, 'no reel track to sabotage');
  await page.click(OPEN_BTN);
  const samples = await sampleTrack(page, TRACK, 14, 200);
  const moved = distinct(samples, 'inline');
  await page.close();
  assert(moved >= 3, `with zero rects the track only had ${moved} distinct transforms — animation was skipped`);
  return `${moved} distinct transforms with 0×0 rects`;
}

async function battleReels(browser) {
  const page = await newPage(browser, 'normal');
  await page.click('.nav-item[data-view="battles"]');
  await new Promise((r) => setTimeout(r, 400));
  await page.click('#battle-start');
  // sample both reels at the same time: the shorter spin would otherwise be
  // over before the second loop starts
  const [you, bot] = await Promise.all([
    sampleTrack(page, '#reel-you', 24, 200),
    sampleTrack(page, '#reel-bot', 24, 200),
  ]);
  const gapYou = await pointerGap(page, '#reel-you', '#reel-you');
  const verdict = await page.$eval('#battle-verdict', (el) => el.textContent.trim());
  await page.close();
  const movedYou = distinct(you, 'y');
  const movedBot = distinct(bot, 'y');
  assert(movedYou >= 8, `your battle reel moved through only ${movedYou} positions`);
  assert(movedBot >= 3, `the opponent reel moved through only ${movedBot} positions`);
  assert(/win|lose|draw|vs/i.test(verdict) && verdict.length > 0, 'no verdict after the battle');
  return `you ${movedYou} / bot ${movedBot} positions; verdict "${verdict}"`;
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
    await check('case reel moves (normal motion)', () => caseReel(browser, 'normal'));
    await check('case reel moves (prefers-reduced-motion)', () => caseReel(browser, 'reduce'));
    await check('case reel moves with zero-sized rects', () => zeroRectStillMoves(browser));
    await check('case battle reels move', () => battleReels(browser));
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
