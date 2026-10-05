/**
 * MOCK-SUCCESS E2E: simulates the user's real browser environment.
 *  - pollinations image API reachable but SLOW (6s per generation), real JPEG bytes
 *  - POST text.pollinations.ai/openai is DEAD (502) — the user's actual failure mode
 *  - legacy GET text.pollinations.ai works (serves routeOffline content + marker)
 *
 * Verifies: non-blocking create/settings UI, data: thumbnail, remote textMode,
 * marker narration in DOM, remote image mode, persistence.
 * Run:  LD_LIBRARY_PATH=/tmp/al2023/lib node run-mock.mjs
 */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const JPEG = fs.readFileSync('/home/user/wotcwafnuawjfnawjnf/background.jpg');
const MARKER = 'REMOTE_NARRATOR_ONLINE';

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
const consoleAll = [];
const dialogs = [];
page.on('pageerror', err => pageErrors.push(String(err && err.stack || err)));
page.on('console', msg => {
    const t = msg.text();
    consoleAll.push(t);
    if (msg.type() === 'error') consoleErrors.push(t);
});
page.on('dialog', async d => {
    dialogs.push(d.message());
    if (d.type() === 'prompt') return; // the once-handler supplies the save name
    try { await d.accept(); } catch (e) {}
});

function routeText(messages) {
    return page.evaluate((msgs) => {
        let out = window.__wsShimInternals.routeOffline(msgs);
        try {
            const obj = JSON.parse(out);
            if (obj && typeof obj === 'object' && obj.description) {
                obj.description = 'REMOTE_NARRATOR_ONLINE: ' + obj.description;
                out = JSON.stringify(obj);
            }
        } catch (e) { /* plain text result */ }
        return out;
    }, messages);
}

await page.setRequestInterception(true);
page.on('request', (req) => {
    const handle = async () => {
        const u = req.url();
        if (u.startsWith('https://image.pollinations.ai/')) {
            // Slow generation — exactly what broke the old 30s timeout.
            setTimeout(() => {
                req.respond({
                    status: 200,
                    contentType: 'image/jpeg',
                    headers: { 'access-control-allow-origin': '*' },
                    body: JPEG
                }).catch(() => {});
            }, 6000);
            return;
        }
        if (u.startsWith('https://text.pollinations.ai/')) {
            const method = req.method();
            const pathAndQuery = u.slice('https://text.pollinations.ai'.length);
            const path = pathAndQuery.split('?')[0];

            if (method === 'POST' && path.startsWith('/openai')) {
                // Simulate the dead POST endpoint from the user's browser.
                req.respond({
                    status: 502,
                    contentType: 'text/plain',
                    headers: { 'access-control-allow-origin': '*' },
                    body: 'Bad Gateway'
                }).catch(() => {});
                return;
            }

            let messages = [];
            if (method === 'POST') {
                try { messages = JSON.parse(req.postData() || '{}').messages || []; } catch (e) {}
            } else {
                // Legacy GET: condensed prompt in the path, [SYSTEM]/[USER] marked.
                let promptText = '';
                try { promptText = decodeURIComponent(path.replace(/^\//, '')); } catch (e) { promptText = ''; }
                const userIdx = promptText.lastIndexOf('[USER]');
                if (userIdx !== -1) promptText = promptText.slice(userIdx + 6);
                messages = [{ role: 'user', content: promptText || 'continue the scene' }];
            }
            const content = await routeText(messages);

            if (method === 'POST') {
                req.respond({
                    status: 200,
                    contentType: 'application/json',
                    headers: { 'access-control-allow-origin': '*' },
                    body: JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] })
                }).catch(() => {});
            } else {
                req.respond({
                    status: 200,
                    contentType: 'text/plain',
                    headers: { 'access-control-allow-origin': '*' },
                    body: content
                }).catch(() => {});
            }
            return;
        }
        req.continue().catch(() => {});
    };
    handle().catch(() => { try { req.continue().catch(() => {}); } catch (e) {} });
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
    console.log('   onboarding shown:', needOnboarding);
    if (needOnboarding) {
        await page.click('#onboarding-language-confirm-btn');
        await page.waitForFunction(() => document.getElementById('language-onboarding').classList.contains('hidden'), { timeout: 15000, polling: 100 });
    }

    await page.click('#manage-worlds-btn');
    await page.waitForFunction(() => !document.getElementById('worlds-menu').classList.contains('hidden'), { timeout: 15000, polling: 100 });
    await new Promise(r => setTimeout(r, 500));
    await page.click('.world-card.create-new');
    await page.waitForFunction(() => !document.getElementById('create-world-menu').classList.contains('hidden'), { timeout: 15000, polling: 100 });

    await page.type('#new-world-name', 'Mock Remote Realm');
    await page.type('#new-world-prompt', 'A cathedral of suspended bells above a storm-lit sea, rung by weather-priests.');
    await page.type('#new-world-objective', 'Ring the great bell before the storm breaks.');

    // --- NON-BLOCKING CREATE: config must open fast despite 6s image generation ---
    const tCreate = Date.now();
    await page.click('#confirm-create-world-btn');
    await page.waitForFunction(() => !document.getElementById('world-config-menu').classList.contains('hidden'), { timeout: 15000, polling: 100 });
    const createMs = Date.now() - tCreate;
    check('create UI unblocked (<4s while image still generating)', createMs < 4000, `${createMs}ms`);

    // --- NON-BLOCKING SETTINGS: save alert while thumbnail still in flight ---
    const saveVisible = await page.evaluate(() => {
        const b = document.getElementById('save-world-config-btn');
        return !!(b && b.offsetParent !== null);
    });
    if (saveVisible) {
        const tSave = Date.now();
        await page.evaluate(() => document.getElementById('save-world-config-btn').click());
        let gotAlert = false;
        for (let i = 0; i < 40 && !gotAlert; i++) {
            gotAlert = dialogs.some(m => /configuration updated/i.test(m));
            if (!gotAlert) await new Promise(r => setTimeout(r, 100));
        }
        const saveMs = Date.now() - tSave;
        // Headless canvas encoding can occupy the main thread briefly; the real
    // regression (awaiting image generation => minutes/hang) would be far worse.
    check('settings save confirms while image gen in flight (<6s)', gotAlert && saveMs < 6000, { gotAlert, saveMs, dialogs });
    } else {
        check('settings save button visible after create', false);
    }

    // --- thumbnail lands as data: URL (background generation) ---
    const remoteLogs = () => consoleAll.filter(t => /remote image generated/.test(t)).length;
    let thumbOk = false, thumbKind = '';
    for (let i = 0; i < 30 && !thumbOk; i++) {
        const state = await page.evaluate(() => {
            const w = JSON.parse(localStorage.getItem('ai_worlds_v1') || '{}');
            const first = Object.values(w)[0];
            const t = first ? String(first.thumbnailUrl || '') : '';
            return { t: t.slice(0, 24), mode: (window.__wsShim && window.__wsShim.imageMode) || 'unknown' };
        });
        thumbKind = state.t;
        // Thumbnails now persist the ORIGINAL remote URL (full quality, ~200B);
        // data: would mean the procedural fallback slipped in.
        thumbOk = state.t.startsWith('http') && remoteLogs() >= 1 && state.mode === 'remote';
        if (!thumbOk) await new Promise(r => setTimeout(r, 1000));
    }
    check('thumbnail persisted as REMOTE URL (full quality) + imageMode remote', thumbOk, { thumbKind, logs: remoteLogs() });

    // --- open the adventure ---
    await page.click('#close-world-config-btn');
    await page.waitForFunction(() => document.getElementById('worlds-menu') && !document.getElementById('worlds-menu').classList.contains('hidden'), { timeout: 15000, polling: 100 });
    await new Promise(r => setTimeout(r, 400));
    const clickedCard = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.world-card')];
        const card = cards.find(c => /Mock Remote Realm/i.test(c.innerText));
        if (card) { card.click(); return true; }
        return false;
    });
    check('world card present (save worked)', clickedCard);
    await page.waitForFunction(() => {
        const v = document.getElementById('config-saves-view');
        const b = document.getElementById('new-save-btn');
        return v && !v.classList.contains('hidden') && b && b.offsetParent !== null;
    }, { timeout: 15000, polling: 100 });

    const [dialog2] = await Promise.all([
        new Promise(r => page.once('dialog', async d => { await d.accept('Mock Adventure'); r(d); })),
        page.click('#new-save-btn')
    ]);
    check('new game dialog handled', !!dialog2);

    await page.waitForFunction(() => {
        const gc = document.getElementById('game-container');
        return gc && !gc.classList.contains('hidden');
    }, { timeout: 15000, polling: 100 });

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
            text: out.textContent,
            imgKind: panoActive ? 'panorama-webgl' : (img.src.startsWith('data:') ? 'data-url' : img.src.slice(0, 30))
        };
    });
    check('scene 1 narration present', scene1.text.length > 80, scene1.text.slice(0, 120));
    check('scene 1 narration came from REMOTE text (marker)', scene1.text.includes(MARKER));
    check('scene 1 image rendered', scene1.imgKind === 'panorama-webgl' || scene1.imgKind === 'data-url', scene1.imgKind);

    const textMode = await page.evaluate(() => window.__wsShim && window.__wsShim.textMode);
    check("textMode === 'remote' (legacy GET chain worked)", textMode === 'remote', textMode);

    // --- turn 2 ---
    const beforeCount = await page.evaluate(() => document.querySelectorAll('#text-output p').length);
    await page.type('#user-input', 'I climb the bell tower rope and swing the bronze hammer with both hands');
    await Promise.all([
        page.waitForFunction((n) => document.querySelectorAll('#text-output p').length > n + 1, { timeout: 120000, polling: 250 }, beforeCount),
        page.click('#act-button')
    ]);

    const scene2 = await page.evaluate(() => {
        const out = document.getElementById('text-output');
        return { paras: out.querySelectorAll('p').length, text: out.textContent };
    });
    check('turn 2 produced new narration', scene2.paras > beforeCount && scene2.text.length > 200, scene2.paras);
    check('turn 2 narration includes remote marker', scene2.text.includes(MARKER));

    const finalMode = await page.evaluate(() => window.__wsShim && window.__wsShim.imageMode);
    check("imageMode === 'remote'", finalMode === 'remote', finalMode);
    check('at least 2 remote image fetches (thumb + scene)', remoteLogs() >= 2, `logs=${remoteLogs()}`);

    await page.screenshot({ path: '/tmp/e2e-mock.png' });
    check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3));
    const unexpected = consoleErrors.filter(e =>
        !/net::|Failed to load resource|ERR_|pollinations|websim\.com|gamenora|favicon|502|Bad Gateway/i.test(e));
    check('no unexpected console errors', unexpected.length === 0, unexpected.slice(0, 8));
    if (pageErrors.length) console.log('PAGE ERRORS:\n' + pageErrors.join('\n---\n'));

} catch (err) {
    failures++;
    console.error('E2E-MOCK FATAL:', err);
    try {
        const st = await page.evaluate(() => ({
            onboarding: document.getElementById('language-onboarding') && !document.getElementById('language-onboarding').classList.contains('hidden'),
            worldsMenu: document.getElementById('worlds-menu') && document.getElementById('worlds-menu').className,
            createMenu: document.getElementById('create-world-menu') && document.getElementById('create-world-menu').className,
            configMenu: document.getElementById('world-config-menu') && document.getElementById('world-config-menu').className
        }));
        console.error('state:', JSON.stringify(st), 'dialogs:', dialogs);
    } catch (e) {}
    try { await page.screenshot({ path: '/tmp/e2e-mock-failure.png' }); } catch (e) {}
    if (pageErrors.length) console.error('pageErrors:\n' + pageErrors.join('\n---\n'));
    if (consoleErrors.length) console.error('consoleErrors:\n' + consoleErrors.slice(0, 25).join('\n'));
} finally {
    await browser.close();
}

console.log(failures === 0 ? '\nE2E-MOCK: all checks passed.' : `\nE2E-MOCK: ${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
