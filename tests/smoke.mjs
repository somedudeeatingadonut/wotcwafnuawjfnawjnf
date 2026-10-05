/**
 * Smoke tests for the standalone websim platform shim.
 * Run with: node tests/smoke.mjs
 *
 * These run the shim inside plain Node (no DOM): they verify the offline
 * director's JSON contracts, avatars, and the WebsimSocket collection layer
 * including seeding. Canvas image generation is browser-only and covered by
 * the live preview instead.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// --- load the shim into the global scope --------------------------------
const code = readFileSync(path.join(ROOT, 'vendor', 'websim-shim.js'), 'utf8');
(0, eval)(code); // indirect eval -> global scope

let failures = 0;
function check(label, ok, extra) {
    if (ok) {
        console.log(`  ok  ${label}`);
    } else {
        failures++;
        console.error(`FAIL  ${label}`, extra !== undefined ? extra : '');
    }
}

const I = globalThis.__wsShimInternals;
check('shim installed websim global', !!globalThis.websim && globalThis.websim.__shimmed === true);
check('shim installed WebsimSocket', typeof globalThis.WebsimSocket === 'function');
check('internals exposed', !!I);

// --- offline scene director --------------------------------------------
const SYS = {
    role: 'system',
    content: `You are a Master World-Building Engine. Your task is to generate an immersive, narrative experience based on the following world concept:
--- WORLD CONCEPT: A neon cyberpunk city where memories are traded like currency. ---
--- WORLD OBJECTIVE / WIN CONDITION ---
Recover your stolen childhood memory from the black market before it is erased forever.
If the player fulfills this objective, you must set "game_won": true in your JSON response.
---------------------------------------
--- SURVIVAL SYSTEM SETTINGS ---
- Hunger Logic: ENABLED. Track hunger changes and describe the need for food.
- Thirst Logic: DISABLED. Do not track thirst or mention needing water for hydration.
---------------------------------------
Your response MUST be a JSON object with these fields: { "description": ..., "image_prompt": ... }`
};

{
    const messages = [SYS, { role: 'user', content: 'Current Stats: {"health":100,"hunger":88,"thirst":100}\nInventory: {"Lockpick":2}\nUser Action: go to the black market alley\n\n(Respond using the required JSON schema)' }];
    let out = null, model = null;
    await globalThis.websim.chat.completions.create({ messages, json: true }).then(r => { out = r.content; model = r.model; });
    check('scene call returns content', typeof out === 'string');
    let scene = null;
    try { scene = JSON.parse(I.cleanJsonText(out)); } catch (e) {}
    check('scene is valid JSON', !!scene, out && String(out).slice(0, 200));
    if (scene) {
        check('scene has description', typeof scene.description === 'string' && scene.description.length > 40);
        check('scene has image_prompt', typeof scene.image_prompt === 'string' && scene.image_prompt.length > 20);
        check('scene has stats_changes object', scene.stats_changes && typeof scene.stats_changes === 'object');
        check('scene tracks hunger drain', scene.stats_changes.hunger_change < 0, scene.stats_changes);
        check('scene has arrays + game_won', Array.isArray(scene.items_gained) && Array.isArray(scene.items_lost) && typeof scene.game_won === 'boolean');
        check('scene has current_level', typeof scene.current_level === 'string' && scene.current_level.length > 0);
        console.log(`       [${model}] level=${JSON.stringify(scene.current_level)} desc=${JSON.stringify(scene.description.slice(0, 90))}...`);
    }
}

// --- initialization prompt --------------------------------------------
{
    const messages = [SYS, { role: 'user', content: 'Initialize the game in the world concept provided in your system prompt. Describe the starting scene and the current state of the player. Current Stats: {"health":100,"hunger":100,"thirst":100}\n\n(Respond using the required JSON schema)' }];
    const r = await globalThis.websim.chat.completions.create({ messages, json: true });
    let scene = null;
    try { scene = JSON.parse(r.content); } catch (e) {}
    check('init scene parses', !!scene, r.content && r.content.slice(0, 200));
    if (scene) check('init scene skips stat drain', scene.stats_changes.hunger_change === 0, scene.stats_changes);
}

// --- sounds router ------------------------------------------------------
{
    const messages = [{ role: 'system', content: 'You are a sound effects manager for a text-based adventure game. Respond with a JSON array of {"sound":...}.' },
                      { role: 'user', content: 'User Action: "I walk through the forest and attack the beast"\nAI Description: "You drink from the stream."' }];
    const r = await globalThis.websim.chat.completions.create({ messages, json: true });
    let arr = null;
    try { arr = JSON.parse(r.content); } catch (e) {}
    check('sounds returns array', Array.isArray(arr), r.content);
    if (arr) {
        check('sounds includes walk + monster + drink', arr.some(s => s.sound === 'walk.mp3') && arr.some(s => s.sound === 'monster.mp3') && arr.some(s => s.sound === 'drink.mp3'), arr);
    }
}

// --- summary router ------------------------------------------------------
{
    const long = 'You step into the ruin. The door slams behind you. "Never look back," the hermit warned. ' + 'Another sentence goes here and keeps going for a while to make the text long enough to summarize properly. '.repeat(30) + '"The key is under the stone," he said. The end of the passage grows dark.';
    const messages = [{ role: 'system', content: 'You are an AI critical condensation engine...' },
                      { role: 'user', content: long }];
    const r = await globalThis.websim.chat.completions.create({ messages });
    check('summary is plain text (not JSON)', typeof r.content === 'string' && r.content.trim().charAt(0) !== '{', r.content.slice(0, 80));
    check('summary preserves quotes', r.content.includes('"The key is under the stone,"'), r.content.slice(0, 200));
    check('summary is shorter than source', r.content.length < long.length, `${r.content.length} vs ${long.length}`);
}

// --- voice mapping router -------------------------------------------------
{
    const messages = [{ role: 'system', content: 'Analyze the provided game text and identify which character is speaking each dialogue line. Available Predefined Characters: [{"name":"Vex","preferredVoice":"en-female"}] Respond with {"dialogue","voiceId"}' },
                      { role: 'user', content: 'Vex waves and says "We should leave now" while you hesitate. Another voice says "No, wait."' }];
    const r = await globalThis.websim.chat.completions.create({ messages, json: true });
    let segs = null;
    try { segs = JSON.parse(r.content); } catch (e) {}
    check('voice map returns segments', Array.isArray(segs) && segs.length === 2, r.content);
    if (segs) check('voice map picks predefined voice', segs[0].voiceId === 'en-female', segs);
}

// --- avatars --------------------------------------------------------------
{
    const url = I.avatarDataUrl('explorer_x');
    check('avatar is a data URL', typeof url === 'string' && url.startsWith('data:image/svg+xml'));
}

// --- WebsimSocket ----------------------------------------------------------
{
    const room = new globalThis.WebsimSocket();
    await room.initialize();

    let notified = null;
    const unsub = room.collection('probe_collection').subscribe(recs => { notified = recs; });
    await new Promise(r => setTimeout(r, 50));
    check('subscribe fires with array', Array.isArray(notified), notified);

    const rec = await room.collection('probe_collection').create({ hello: 'world' });
    check('create returns record with id', !!rec.id && !!rec.created_at, rec);
    check('create stamps username', typeof rec.username === 'string' && rec.username.length > 0, rec.username);
    await new Promise(r => setTimeout(r, 50));
    check('subscriber notified on create', Array.isArray(notified) && notified.length === 1 && notified[0].hello === 'world', notified);

    await room.collection('probe_collection').update(rec.id, { hello: 'updated' });
    await new Promise(r => setTimeout(r, 50));
    check('update applied', notified && notified[0].hello === 'updated', notified);

    const filtered = await room.collection('probe_collection').filter({ hello: 'updated' }).getList();
    check('filter matches', filtered.length === 1);
    const filteredMiss = await room.collection('probe_collection').filter({ hello: 'nope' }).getList();
    check('filter excludes', filteredMiss.length === 0);

    await room.collection('probe_collection').delete(rec.id);
    await new Promise(r => setTimeout(r, 50));
    check('delete applied', notified && notified.length === 0, notified);
    unsub();

    // seeding: gallery should come pre-populated
    const worlds = await room.collection('shared_world_v6').getList();
    check('gallery seeded with demo worlds', worlds.length >= 2, worlds.length);
    const featured = await room.collection('featured_world_v1').getList();
    check('featured seeded', featured.length >= 1, featured.length);
    const chat = await room.collection('chat_message_v1').getList();
    check('chat seeded', chat.length >= 1, chat.length);

    const user = await globalThis.websim.getCurrentUser();
    check('getCurrentUser returns username', user && typeof user.username === 'string', user);
    const creator = await globalThis.websim.getCreatedBy();
    check('getCreatedBy returns username', creator && creator.username === 'Speedymule6858', creator);
}

// --- upload ---------------------------------------------------------------
{
    const blobLike = { type: 'text/plain' };
    // Node has Blob; FileReader does not exist in Node, so expect rejection.
    const res = await globalThis.websim.upload(null).then(() => 'resolved', () => 'rejected');
    check('upload validates input', res === 'rejected');
}

console.log(failures === 0 ? '\nAll smoke tests passed.' : `\n${failures} smoke test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
