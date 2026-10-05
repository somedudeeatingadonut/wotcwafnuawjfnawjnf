/**
 * Offline/fallback E2E: pollinations unreachable (request failures) —
 * the app must still work via offline director + procedural images.
 * Run:  LD_LIBRARY_PATH=/tmp/al2023/lib node run.mjs
 */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const BASE = process.env.BASE_URL || 'http://localhost:8080';
let failures = 0;
function check(label, ok, extra) {
    if (ok) console.log(`  ok  ${label}`);
    else { failures++; console.error(`FAIL  ${label}`, extra !== undefined ? extra : ''); }
}

const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless ?? true,
    defaultViewport: { width: 1440, height: 900 }
});

const page = await browser.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', err => pageErrors.push(String(err && err.stack || err)));
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

// Simulate total outage: every pollinations request fails fast.
await page.setRequestInterception(true);
page.on('request', req => {
    const u = req.url();
    if (u.startsWith('https://image.pollinations.ai/') || u.startsWith('https://text.pollinations.ai/')) {
        req.abort('failed').catch(() => {});
        return;
    }
    req.continue().catch(() => {});
});

try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.waitForFunction(() => {
        const splash = document.getElementById('loading-splash');
        const menu = document.getElementById('main-menu');
        return splash && splash.classList.contains('hidden') && menu && !menu.classList.contains('hidden');
    }, { timeout: 30000, polling: 100 });
    check('app boots to main menu', true);

    const needOnboarding = await page.waitForFunction(() => {
        const m = document.getElementById('language-onboarding');
        return m && !m.classList.contains('hidden');
    }, { timeout: 8000, polling: 100 }).then(() => true).catch(() => false);
    if (needOnboarding) {
        await page.click('#onboarding-language-confirm-btn');
        await page.waitForFunction(() => document.getElementById('language-onboarding').classList.contains('hidden'), { timeout: 15000, polling: 100 });
        check('onboarding dismissed', true);
    }

    await page.click('#manage-worlds-btn');
    await page.waitForFunction(() => !document.getElementById('worlds-menu').classList.contains('hidden'), { timeout: 15000, polling: 100 });
    await new Promise(r => setTimeout(r, 500));
    check('My Worlds opens', true);

    await page.click('.world-card.create-new');
    await page.waitForFunction(() => !document.getElementById('create-world-menu').classList.contains('hidden'), { timeout: 15000, polling: 100 });
    check('Create World opens', true);

    await page.type('#new-world-name', 'E2E Test Realm');
    await page.type('#new-world-prompt', 'A sunken observatory beneath a violet ocean, home to star-tidal whales and clockwork divers.');
    await page.type('#new-world-objective', 'Restore the observatory lens and surface the drowned star map.');

    const tCreate = Date.now();
    await page.click('#confirm-create-world-btn');
    await page.waitForFunction(() => !document.getElementById('world-config-menu').classList.contains('hidden'), { timeout: 90000, polling: 100 });
    check('world created + config opened', true, `${Date.now() - tCreate}ms`);

    let thumb = null;
    for (let i = 0; i < 20; i++) {
        thumb = await page.evaluate(() => {
            const w = JSON.parse(localStorage.getItem('ai_worlds_v1') || '{}');
            const first = Object.values(w)[0];
            return first ? { name: first.name, thumb: String(first.thumbnailUrl || '').slice(0, 40) } : null;
        }).catch(() => null);
        if (thumb && thumb.thumb) break;
        await new Promise(r => setTimeout(r, 1000));
    }
    check('world persisted with thumbnail', !!(thumb && thumb.thumb), thumb);

    await page.click('#close-world-config-btn');
    await page.waitForFunction(() => document.getElementById('worlds-menu') && !document.getElementById('worlds-menu').classList.contains('hidden'), { timeout: 15000, polling: 100 });
    await new Promise(r => setTimeout(r, 400));
    const clickedCard = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.world-card')];
        const card = cards.find(c => /E2E Test Realm/i.test(c.innerText));
        if (card) { card.click(); return true; }
        return false;
    });
    check('world card found in library', clickedCard);
    await page.waitForFunction(() => {
        const v = document.getElementById('config-saves-view');
        const b = document.getElementById('new-save-btn');
        return v && !v.classList.contains('hidden') && b && b.offsetParent !== null;
    }, { timeout: 15000, polling: 100 });

    const [dialog2] = await Promise.all([
        new Promise(r => page.once('dialog', async d => { await d.accept('E2E Adventure'); r(d); })),
        page.click('#new-save-btn')
    ]);
    check('new game dialog handled', !!dialog2);

    await page.waitForFunction(() => {
        const gc = document.getElementById('game-container');
        return gc && !gc.classList.contains('hidden');
    }, { timeout: 15000, polling: 100 });
    check('game container opens', true);

    await page.waitForFunction(() => {
        const out = document.getElementById('text-output');
        const img = document.getElementById('current-scene-image');
        const pano = document.getElementById('panorama-container');
        const hasImage = (img && img.src && img.src.length > 100) ||
            (pano && !pano.classList.contains('hidden') && pano.querySelector('canvas'));
        const narrated = out && out.textContent.replace(/Entering World\.\.\./g, '').trim().length > 80;
        return narrated && hasImage;
    }, { timeout: 120000, polling: 250 });

    const scene1 = await page.evaluate(() => {
        const out = document.getElementById('text-output');
        const img = document.getElementById('current-scene-image');
        const pano = document.getElementById('panorama-container');
        const panoActive = pano && !pano.classList.contains('hidden') && !!pano.querySelector('canvas');
        return {
            textLen: out.textContent.length,
            snippet: out.textContent.slice(0, 200),
            imgSrcKind: panoActive ? 'panorama-webgl' :
                img.src.startsWith('data:') ? 'data-url' :
                img.src.startsWith('https://image.pollinations.ai') ? 'pollinations' :
                img.src.startsWith('http') ? 'remote' : (img.src ? img.src.slice(0, 40) : 'none'),
            imgLen: panoActive ? 1 : img.src.length
        };
    });
    check('initial scene narration rendered (offline director)', scene1.textLen > 80, scene1.snippet);
    check('initial scene IMAGE rendered (procedural fallback)', scene1.imgSrcKind === 'panorama-webgl' || scene1.imgLen > 200, scene1);
    console.log(`       scene image source: ${scene1.imgSrcKind}`);

    const beforeCount = await page.evaluate(() => document.querySelectorAll('#text-output p').length);
    await page.type('#user-input', 'I carefully dive through the broken dome and search the observatory floor');
    await Promise.all([
        page.waitForFunction((n) => document.querySelectorAll('#text-output p').length > n + 1, { timeout: 120000, polling: 250 }, beforeCount),
        page.click('#act-button')
    ]);

    const scene2 = await page.evaluate(() => {
        const out = document.getElementById('text-output');
        const img = document.getElementById('current-scene-image');
        const pano = document.getElementById('panorama-container');
        const panoActive = pano && !pano.classList.contains('hidden') && !!pano.querySelector('canvas');
        return {
            paras: out.querySelectorAll('p').length,
            textLen: out.textContent.length,
            imgKind: panoActive ? 'panorama-webgl' : img.src.slice(0, 30),
            imgLen: panoActive ? 1 : img.src.length
        };
    });
    check('second turn produced new narration', scene2.paras > beforeCount && scene2.textLen > 200, scene2);
    check('second turn produced a scene image', scene2.imgKind === 'panorama-webgl' || scene2.imgLen > 200, scene2);
    console.log(`       turn-2 image: ${scene2.imgKind}`);

    await page.screenshot({ path: '/home/user/wotcwafnuawjfnawjnf/tests/e2e-scene.png', fullPage: false });

    check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3));
    const unexpected = consoleErrors.filter(e =>
        !/net::|Failed to load resource|ERR_|pollinations|websim\.com|gamenora|favicon/i.test(e));
    check('no unexpected console errors', unexpected.length === 0, unexpected.slice(0, 8));
    if (pageErrors.length) console.log('PAGE ERRORS:\n' + pageErrors.join('\n---\n'));

} catch (err) {
    failures++;
    console.error('E2E FATAL:', err);
    try { await page.screenshot({ path: '/tmp/e2e-failure.png' }); } catch (e) {}
    if (pageErrors.length) console.error('pageErrors:\n' + pageErrors.join('\n---\n'));
    if (consoleErrors.length) console.error('consoleErrors:\n' + consoleErrors.slice(0, 25).join('\n'));
} finally {
    await browser.close();
}

console.log(failures === 0 ? '\nE2E: all checks passed.' : `\nE2E: ${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
