/**
 * websim-shim.js — standalone fallback for the websim.com platform APIs.
 *
 * The app was originally written for the websim runtime, which injects:
 *   - window.websim.chat.completions.create(...)  (LLM)
 *   - window.websim.imageGen(...)                 (AI image generation)
 *   - window.websim.textToSpeech(...)             (TTS)
 *   - window.websim.upload(...)                   (file hosting)
 *   - window.websim.getCurrentUser()/getCreatedBy()
 *   - window.WebsimSocket                         (realtime collections DB)
 *
 * Outside websim none of those exist, so nothing works. This shim provides a
 * drop-in standalone implementation:
 *
 *   TEXT  : tries the free Pollinations text API first (no key needed); if the
 *           network/API is unavailable it falls back to a built-in "offline
 *           director" that produces valid scene JSON so the game always runs.
 *   IMAGE : tries the free Pollinations image API first; if unavailable it
 *           renders a deterministic procedural landscape/icon image on canvas
 *           so every scene, item and thumbnail ALWAYS gets a real image.
 *   TTS   : uses the browser's speechSynthesis voices (audible!) and returns a
 *           silent pacing WAV so the existing playback flow keeps working.
 *   UPLOAD: converts files to data: URLs.
 *   DB    : WebsimSocket backed by IndexedDB (+localStorage mirror) with
 *           BroadcastChannel sync, so chat/gallery/share features work locally
 *           and across browser tabs.
 *
 * The shim only activates when the native websim runtime is missing, so the
 * app still runs unchanged on websim.com itself.
 */
(function () {
    'use strict';

    var G = globalThis;

    var SHIM = {
        version: '1.0.0',
        standalone: true,
        textMode: 'unknown',      // 'remote' | 'offline' | 'unknown'
        textRetryAt: 0,
        imageMode: 'unknown',     // 'remote' | 'procedural' | 'unknown'
        imageRetryAt: 0
    };
    G.__wsShim = SHIM;

    /* ================================================================
     * Utilities
     * ============================================================== */

    function lsGet(key) {
        try { return G.localStorage ? G.localStorage.getItem(key) : null; } catch (e) { return null; }
    }
    function lsSet(key, value) {
        try { if (G.localStorage) { G.localStorage.setItem(key, value); return true; } } catch (e) { /* quota */ }
        return false;
    }

    function fnv1a(str) {
        str = String(str || '');
        var h = 0x811c9dc5;
        for (var i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    }

    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    function makeAbortError() {
        var e = new Error('The operation was aborted.');
        e.name = 'AbortError';
        return e;
    }

    function uuid() {
        if (G.crypto && G.crypto.randomUUID) return G.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : ((r & 0x3) | 0x8);
            return v.toString(16);
        });
    }

    /** fetch() with timeout + optional parent signal. Never rejects with the
     *  controller's own abort — resolves/rejects with typed errors instead. */
    function fetchTimeout(url, opts, ms, parentSignal) {
        if (parentSignal && parentSignal.aborted) return Promise.reject(makeAbortError());
        var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timedOut = false;
        var timer = null;
        var onAbort = null;
        opts = Object.assign({}, opts || {});
        if (ctrl) {
            timer = setTimeout(function () { timedOut = true; try { ctrl.abort(); } catch (e) {} }, ms);
            opts.signal = ctrl.signal;
            onAbort = function () { try { ctrl.abort(); } catch (e) {} };
            if (parentSignal) parentSignal.addEventListener('abort', onAbort);
        }
        function cleanup() {
            if (timer) clearTimeout(timer);
            if (onAbort && parentSignal) {
                try { parentSignal.removeEventListener('abort', onAbort); } catch (e) {}
            }
        }
        return fetch(url, opts).then(function (res) {
            cleanup();
            return res;
        }, function (err) {
            cleanup();
            if (parentSignal && parentSignal.aborted) throw makeAbortError();
            if (timedOut) { var e = new Error('Network timeout'); e.code = 'ETIMEDOUT'; throw e; }
            throw err;
        });
    }

    /* ================================================================
     * Avatars (local identicons)
     * ============================================================== */

    var AVATAR_COLORS = [
        '#00f3ff', '#7c4dff', '#ff4081', '#ffca28', '#66bb6a',
        '#ff7043', '#26c6da', '#ab47bc', '#42a5f5', '#9ccc65'
    ];

    function avatarDataUrl(name) {
        name = String(name || 'guest');
        var h = fnv1a(name);
        var c1 = AVATAR_COLORS[h % AVATAR_COLORS.length];
        var c2 = AVATAR_COLORS[(h >>> 9) % AVATAR_COLORS.length];
        var letters = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        var initials = (letters.slice(0, 2) || '?');
        var cx = 24 + (h % 80);
        var cy = 24 + ((h >>> 7) % 80);
        var r = 30 + ((h >>> 3) % 26);
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">' +
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/>' +
            '</linearGradient></defs>' +
            '<rect width="128" height="128" fill="url(#g)"/>' +
            '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="rgba(255,255,255,0.16)"/>' +
            '<circle cx="' + (128 - cx) + '" cy="' + (128 - cy) + '" r="' + Math.round(r * 0.6) + '" fill="rgba(0,0,0,0.14)"/>' +
            '<text x="64" y="67" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="bold" ' +
            'fill="#ffffff" text-anchor="middle" dominant-baseline="middle" opacity="0.95">' + initials + '</text>' +
            '</svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    G.__wsAvatarDataUrl = avatarDataUrl;
    G.__WS_AVATAR_FALLBACK = function (img) {
        try {
            img.onerror = null;
            img.src = avatarDataUrl(img.alt || img.getAttribute('data-username') || 'guest');
        } catch (e) { /* ignore */ }
    };

    /* ================================================================
     * Current user
     * ============================================================== */

    var _userCache = null;
    function currentUser() {
        if (_userCache) return _userCache;
        var raw = lsGet('ws_standalone_user');
        var user = null;
        if (raw) { try { user = JSON.parse(raw); } catch (e) {} }
        if (!user || !user.username) {
            user = { id: uuid(), username: 'explorer_' + Math.random().toString(36).slice(2, 7) };
            lsSet('ws_standalone_user', JSON.stringify(user));
        }
        user.avatarUrl = avatarDataUrl(user.username);
        _userCache = user;
        return user;
    }
    function currentUsername() { return currentUser().username; }

    /* ================================================================
     * JSON hygiene for json:true completions
     * ============================================================== */

    function cleanJsonText(text) {
        if (typeof text !== 'string') return text;
        var t = text.trim();
        var fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (fence) t = fence[1].trim();
        if ((t.charAt(0) === '{' && t.charAt(t.length - 1) === '}') ||
            (t.charAt(0) === '[' && t.charAt(t.length - 1) === ']')) {
            return t;
        }
        var firstObj = t.indexOf('{');
        var firstArr = t.indexOf('[');
        var start = -1;
        if (firstObj === -1) start = firstArr;
        else if (firstArr === -1) start = firstObj;
        else start = Math.min(firstObj, firstArr);
        if (start >= 0) {
            var end = t.lastIndexOf(start === firstObj && firstObj <= firstArr ? '}' : ']');
            if (end > start) {
                var candidate = t.slice(start, end + 1);
                try { JSON.parse(candidate); return candidate; } catch (e) {}
            }
        }
        return t;
    }

    function isParsableJson(text) {
        try { JSON.parse(cleanJsonText(text)); return true; } catch (e) { return false; }
    }

    /* ================================================================
     * Offline director — built-in game master used when no LLM is reachable
     * ============================================================== */

    var BIOMES = [
        {
            keys: ['forest', 'wood', 'jungle', 'tree', 'grove', 'thicket', 'canopy'],
            tags: ['verdant', 'overgrown', 'ancient woodland'],
            sense: 'Dappled light filters through a restless canopy; wet earth and resin hang in the air.',
            sky: ['#0b1d2a', '#1f4d3a', '#79c69a'], ridge: ['#0d2419', '#143a26', '#1e5537'],
            sun: '#ffe9a8', night: false
        },
        {
            keys: ['desert', 'sand', 'dune', 'arid', 'oasis'],
            tags: ['sun-scorched', 'windswept', 'endless'],
            sense: 'Heat ripples above the dunes; fine sand skitters across warm stone.',
            sky: ['#3a1e0e', '#c96f2e', '#ffd9a0'], ridge: ['#5c2e12', '#8a4a1e', '#b06a2e'],
            sun: '#fff3c4', night: false
        },
        {
            keys: ['snow', 'winter', 'ice', 'frozen', 'tundra', 'arctic', 'glacier'],
            tags: ['frozen', 'pale', 'biting'],
            sense: 'Your breath plumes in the crystal air; the snow squeaks softly underfoot.',
            sky: ['#0a1428', '#3d6098', '#cfe6ff'], ridge: ['#20334f', '#4a6488', '#8fb0d4'],
            sun: '#eaf4ff', night: false
        },
        {
            keys: ['ocean', 'sea', 'ship', 'sail', 'beach', 'coast', 'island', 'reef', 'underwater', 'depths'],
            tags: ['salt-sprayed', 'tidebound', 'wave-lashed'],
            sense: 'Brine stings your lips; the horizon breathes with long, rolling swells.',
            sky: ['#041428', '#0d3b66', '#53a6d8'], ridge: ['#062340', '#0a3557', '#115077'],
            sun: '#ffe7b8', night: false
        },
        {
            keys: ['space', 'station', 'planet', 'orbit', 'starship', 'galaxy', 'alien', 'cosmic', 'moon base'],
            tags: ['star-lit', 'weightless', 'otherworldly'],
            sense: 'Stars burn like scattered salt beyond the glass; distant machinery hums through the deck.',
            sky: ['#020108', '#140b2e', '#3b1e64'], ridge: ['#0a0618', '#171031', '#251a49'],
            sun: '#cdd8ff', night: true
        },
        {
            keys: ['city', 'urban', 'street', 'neon', 'metropolis', 'town', 'market', 'alley'],
            tags: ['neon-drenched', 'crowded', 'restless'],
            sense: 'Neon bleeds across wet pavement; a thousand conversations mingle with static and rain.',
            sky: ['#0b0714', '#2a1240', '#7b2f6e'], ridge: ['#120a1e', '#1d1230', '#2b1b44'],
            sun: '#ff9de2', night: true
        },
        {
            keys: ['horror', 'haunted', 'abandoned', 'backrooms', 'nightmare', 'asylum', 'dark', 'creepy', 'eerie', 'liminal'],
            tags: ['lightless', 'unsettling', 'hollow'],
            sense: 'Something about the silence feels deliberate, as if the place is listening back.',
            sky: ['#050505', '#131318', '#2c2c33'], ridge: ['#0a0a0c', '#131316', '#1e1e22'],
            sun: '#b9c0c9', night: true
        },
        {
            keys: ['castle', 'kingdom', 'medieval', 'fantasy', 'magic', 'dragon', 'wizard', 'realm', 'throne', 'dungeon'],
            tags: ['mythic', 'candlelit', 'old-world'],
            sense: 'Torch smoke curls past weathered stone; old magic prickles at the edge of hearing.',
            sky: ['#160b26', '#40205c', '#8a5f9e'], ridge: ['#170d20', '#251633', '#38244b'],
            sun: '#ffd98a', night: false
        }
    ];

    var DEFAULT_BIOME = {
        keys: [],
        tags: ['uncharted', 'strange', 'quietly surreal'],
        sense: 'The air itself seems to hold its breath, waiting for the next move.',
        sky: ['#070b1a', '#1b2a52', '#4f74b8'],
        ridge: ['#0b1024', '#151d3b', '#233058'],
        sun: '#f4f0de',
        night: false
    };

    var QUOTE_BANK = {
        gentle: ['"Do not linger here overlong," the wind seems to warn.', '"You are not the first to walk this way," a soft voice murmurs.'],
        wonder: ['"Look — closer," something whispers with unmistakable delight.', '"Every step writes the world anew," a distant voice laughs.'],
        grim: ['"It heard you," the dark replies, flat and certain.', '"Keep moving," a rasping voice advises from somewhere behind the wall.'],
        tech: ['"Signal acquired," chimes a bored mechanical voice.', '"Directive updated: observe the intruder," the console reports.']
    };

    function detectBiome(text) {
        var t = String(text || '').toLowerCase();
        for (var i = 0; i < BIOMES.length; i++) {
            var b = BIOMES[i];
            for (var k = 0; k < b.keys.length; k++) {
                if (t.indexOf(b.keys[k]) !== -1) return b;
            }
        }
        return DEFAULT_BIOME;
    }

    function extractJsonFromAssistant(content) {
        if (typeof content !== 'string') return null;
        try { return JSON.parse(cleanJsonText(content)); } catch (e) { return null; }
    }

    function offlineScene(messages) {
        var sys = '', user = '', lastAssistant = null;
        for (var i = 0; i < messages.length; i++) {
            var m = messages[i] || {};
            if (m.role === 'system' && !sys) sys = String(m.content || '');
            if (m.role === 'user') user = String(m.content || '');
            if (m.role === 'assistant') lastAssistant = m;
        }

        var concept = 'an uncharted world';
        var cm = sys.match(/WORLD CONCEPT:\s*([\s\S]*?)\n---/);
        if (cm) concept = cm[1].trim();

        var panoramic = /equirectangular/i.test(sys);
        var hungerOn = /Hunger Logic:\s*ENABLED/i.test(sys);
        var thirstOn = /Thirst Logic:\s*ENABLED/i.test(sys);
        var objective = '';
        var om = sys.match(/WORLD OBJECTIVE \/ WIN CONDITION\s*---\n([\s\S]*?)\nIf the player/);
        if (om) objective = om[1].trim();

        var userClean = user.replace(/\(Respond using the required JSON schema\)/g, '').trim();
        var actionMatch = userClean.match(/User Action:\s*([\s\S]*)$/);
        var action = actionMatch ? actionMatch[1].trim() : '';
        var isInit = /initialize the game/i.test(userClean) || !action;
        if (!action) action = isInit ? 'Look around and take in the surroundings.' : 'Wait and listen.';

        var turn = 0;
        for (var j = 0; j < messages.length; j++) if (messages[j].role === 'user') turn++;

        var seed = fnv1a(concept + '|' + action + '|' + turn);
        var rng = mulberry32(seed);
        var biome = detectBiome(concept + ' ' + action);

        // Carry forward previous location if the model left one behind.
        var prevLevel = null;
        for (var k = messages.length - 1; k >= 0; k--) {
            if (messages[k].role === 'assistant') {
                var parsed = extractJsonFromAssistant(messages[k].content);
                if (parsed && parsed.current_level) { prevLevel = parsed.current_level; break; }
            }
        }

        var a = action.toLowerCase();
        var isMove = /\b(walk|go|move|head|run|travel|enter|climb|approach|follow|leave|cross|swim|fly|sneak|craw|step|return|advance|descend|ascend)\b/.test(a);
        var isLook = /\b(look|look around|examine|inspect|search|read|scan|observe|study|watch|listen|peer)\b/.test(a);
        var isTake = /\b(take|grab|pick up|collect|loot|pocket|claim|gather|acquire|open)\b/.test(a);
        var isTalk = /\b(talk|speak|ask|greet|call out|shout|negotiate|convince|barter|trade|whisper|command)\b/.test(a);
        var isFight = /\b(attack|fight|strike|shoot|stab|hit|punch|slash|kill|kick|dodge|defend|block)\b/.test(a);
        var isConsume = /\b(eat|drink|consume|bite|sip|swallow|taste|use the|apply|inject)\b/.test(a);
        var isUse = /\b(use|equip|activate|place|set|throw|unlock|repair|craft|build|light|plug|toggle)\b/.test(a);

        var tag = pick(rng, biome.tags);

        // -- Location tracking ------------------------------------------------
        var level = prevLevel;
        var locMatch = action.match(/\b(?:to|into|toward|towards|through|inside|across|along|down|up)\s+(?:the\s+)?([a-z][a-z0-9 '-]{2,40})/i);
        if (locMatch) {
            var loc = locMatch[1].trim().replace(/[.!?,]+$/, '');
            level = loc.charAt(0).toUpperCase() + loc.slice(1);
        } else if (!level) {
            var words = concept.replace(/[^a-zA-Z0-9 ']/g, ' ').split(/\s+/).filter(Boolean);
            level = words.slice(0, 3).join(' ') || 'Unknown Region';
        }

        // -- Build the description -------------------------------------------
        var parts = [];
        if (isInit) {
            parts.push('You surface into awareness in ' + tag + ' surroundings — ' + concept.replace(/\.$/, '') + '.');
            parts.push(biome.sense);
            parts.push('Your senses adjust: there is a direction here, a thread to pull, and the world waits to see what you do first.');
        } else {
            if (isMove) {
                parts.push('You move with purpose — ' + action.replace(/^[a-z]+\s*/i, function (s) { return s; }).toLowerCase().replace(/[.!]+$/, '') + ' — and the ' + tag + ' surroundings rearrange themselves around your intent.');
                parts.push(biome.sense);
                parts.push(pick(rng, [
                    'The way ahead reveals more than it did a moment ago.',
                    'Whatever waits beyond has taken notice of your approach.',
                    'The path commits you; turning back would cost more than continuing.'
                ]));
            } else if (isLook) {
                parts.push('You take stock with care. ' + biome.sense);
                parts.push(pick(rng, [
                    'Details that were hidden a second ago now stand out sharply.',
                    'Nothing important escapes this vantage — though not everything wants to be found.',
                    'The scene rearranges itself under your attention, details clicking into place like tumblers.'
                ]));
            } else if (isTake) {
                parts.push('You reach out and ' + action.replace(/^[a-z]+\s*/i, '').toLowerCase().replace(/[.!]+$/, '') + ' — the world allows it, this time.');
                parts.push(biome.sense);
                parts.push('Whatever you have taken has shifted the balance here, however slightly.');
            } else if (isTalk) {
                parts.push('You make yourself heard in this ' + tag + ' place. ' + pick(rng, QUOTE_BANK.gentle.concat(QUOTE_BANK.wonder, biome.night ? QUOTE_BANK.grim : [])));
                parts.push(biome.sense);
                parts.push('The response, when it comes, carries the weight of a world that has been waiting for exactly this question.');
            } else if (isFight) {
                parts.push('The clash is sudden and total — ' + pick(rng, ['strikes landing hard', 'a frantic exchange of blows', 'the violence erupting in a heartbeat']) + '. ' + biome.sense);
                parts.push(pick(rng, [
                    'You come through it shaken, something irrevocably changed by the contact.',
                    'For one long moment the outcome hangs in the balance, then resolves.',
                    'The confrontation scatters into an uneasy pause.'
                ]));
            } else if (isConsume) {
                parts.push('You go through the motions and ' + action.replace(/^[a-z]+\s*/i, '').toLowerCase().replace(/[.!]+$/, '') + '. ' + biome.sense);
                parts.push('A small but real shift runs through you — the world registers the act.');
            } else if (isUse) {
                parts.push('You commit to the act: ' + action.replace(/^[a-z]+\s*/i, '').toLowerCase().replace(/[.!]+$/, '') + '.');
                parts.push(biome.sense);
                parts.push(pick(rng, [
                    'The mechanism of this place accepts your input and answers in kind.',
                    'Something clicks — literally or otherwise — and the situation moves forward.',
                    'Your action leaves a visible mark on how the scene responds.'
                ]));
            } else {
                parts.push('You try it. In these ' + tag + ' surroundings — ' + concept.replace(/\.$/, '') + ' — even small intentions ripple outward.');
                parts.push(biome.sense);
                parts.push(pick(rng, [
                    'The world answers in its own time, patient and unreadable.',
                    'A subtle change suggests your action was heard.',
                    'Nothing explodes. That, here, counts as a good sign.'
                ]));
            }
        }

        // Occasionally include voiced dialogue for flavor (feeds the TTS system).
        if (!isInit && rng() < 0.35) {
            var bank = biome.night ? QUOTE_BANK.grim : (isFight ? QUOTE_BANK.grim : QUOTE_BANK.wonder);
            parts.push(pick(rng, bank));
        }

        // -- Objective / win detection ---------------------------------------
        var gameWon = false;
        if (objective && !isInit) {
            var STOP = { a: 1, an: 1, the: 1, and: 1, to: 1, of: 1, in: 1, on: 1, for: 1, with: 1, your: 1, you: 1, is: 1, as: 1, at: 1, by: 1, be: 1, it: 1, that: 1, this: 1 };
            var oWords = objective.toLowerCase().match(/[a-z']{3,}/g) || [];
            var aWords = action.toLowerCase().match(/[a-z']{3,}/g) || [];
            var oSet = {};
            oWords.forEach(function (w) { if (!STOP[w]) oSet[w] = 1; });
            var hits = 0;
            aWords.forEach(function (w) { if (oSet[w]) hits++; });
            gameWon = hits >= 2;
            if (gameWon) {
                parts.push('Against every odd, you see it through: ' + objective.split('\n')[0].replace(/[.!]+$/, '') + '. The world seems to exhale — YOU WIN!');
            }
        }

        // -- Items -------------------------------------------------------------
        var itemsGained = [], itemsLost = [];
        if (isTake && !isInit) {
            var gainMatch = action.match(/\b(?:take|grab|pick up|collect|loot|claim|gather|acquire)\s+(?:a|an|the|some|one)?\s*([a-z][a-z0-9 '-]{2,30})/i);
            var gainName = gainMatch ? gainMatch[1].trim().replace(/[.!?,]+$/, '') : '';
            if (gainName) itemsGained.push({ name: gainName.charAt(0).toUpperCase() + gainName.slice(1), quantity: 1 });
            else itemsGained.push({ name: 'Salvaged Trinket', quantity: 1 });
        }
        if (isConsume && !isInit) {
            var loseMatch = action.match(/\b(?:eat|drink|consume|use|sip|swallow|apply)\s+(?:a|an|the|some)?\s*([a-z][a-z0-9 '-]{2,30})/i);
            var loseName = loseMatch ? loseMatch[1].trim().replace(/[.!?,]+$/, '') : null;
            if (loseName) itemsLost.push({ name: loseName.charAt(0).toUpperCase() + loseName.slice(1), quantity: 1 });
            else {
                var invNames = [];
                var invMatch = userClean.match(/Inventory:\s*(\{[^\n]*\})/);
                if (invMatch) { try { invNames = Object.keys(JSON.parse(invMatch[1])); } catch (e) {} }
                if (invNames.length) itemsLost.push({ name: invNames[Math.floor(rng() * invNames.length)], quantity: 1 });
            }
        }

        // -- Stats -------------------------------------------------------------
        var stats = { health_change: 0, hunger_change: 0, thirst_change: 0, sanity_change: 0, custom_stats: {} };
        if (!isInit) {
            if (hungerOn) stats.hunger_change = -(3 + Math.floor(rng() * 5));   // -3..-7
            if (thirstOn) stats.thirst_change = -(3 + Math.floor(rng() * 5));   // -3..-7
            if (isFight) stats.health_change = -(3 + Math.floor(rng() * 6));    // -3..-8
            else if (isMove && rng() < 0.18) stats.health_change = -(1 + Math.floor(rng() * 2)); // scuffs
            if (/horror|haunted|nightmare|backrooms|creepy|madness|sanity/.test(concept.toLowerCase())) {
                stats.sanity_change = -(1 + Math.floor(rng() * 4));
            }
        }

        var description = parts.join(' ');

        var imagePrompt = 'First-person perspective, ' + description.slice(0, 260);
        imagePrompt = imagePrompt.replace(/\s+/g, ' ');
        if (panoramic) {
            imagePrompt += ', equirectangular 360 panorama, seamless 360 degree view, ultra-wide angle';
        } else {
            imagePrompt += ', cinematic lighting, atmospheric, highly detailed digital art';
        }

        return {
            description: description,
            image_prompt: imagePrompt,
            items_gained: itemsGained,
            items_lost: itemsLost,
            stats_changes: stats,
            game_won: gameWon,
            current_level: level
        };
    }

    function offlineSounds(messages) {
        var blob = '';
        for (var i = 0; i < messages.length; i++) blob += String((messages[i] && messages[i].content) || '') + '\n';
        var action = '';
        var am = blob.match(/User Action:\s*"([^"]*)"/);
        if (am) action = am[1];
        var desc = '';
        var dm = blob.match(/AI Description:\s*"([\s\S]*?)"\s*$/m);
        if (dm) desc = dm[1];
        var hay = (action + ' ' + desc).toLowerCase();
        var out = [];
        if (/\b(walk|walking|walks|run|running|move|moving|go|going|travel|explor|search|advance|follow|climb|enter|leave|approach|step|sneak)\b/.test(hay)) {
            out.push({ sound: 'walk.mp3', volume: 0.5 });
        }
        if (/\b(eat|eating|bite|chew|consume|food|meal|snack)\b/.test(hay)) out.push({ sound: 'eat.mp3', volume: 0.7 });
        if (/\b(drink|drinking|sip|swallow|potion|water|coffee|wine|beer)\b/.test(hay)) out.push({ sound: 'drink.mp3', volume: 0.7 });
        if (/\b(attack|attacking|fight|monster|beast|claw|slash|roar|scream|ripping|maul)\b/.test(hay)) {
            out.push({ sound: 'monster.mp3', volume: 0.8 });
        }
        return JSON.stringify(out);
    }

    function offlineDialogueFilter(messages) {
        var last = '';
        for (var i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') { last = String(messages[i].content || ''); break; }
        }
        var m = last.match(/Extracted quoted lines:\s*(\[[\s\S]*\])/);
        if (m) {
            try {
                var arr = JSON.parse(m[1]);
                if (Array.isArray(arr)) return JSON.stringify({ speak: arr.filter(function (s) { return typeof s === 'string' && s.trim(); }) });
            } catch (e) {}
        }
        return JSON.stringify({ speak: [] });
    }

    function offlineVoiceMap(messages) {
        var desc = '';
        for (var i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') { desc = String(messages[i].content || ''); break; }
        }
        var predefined = [];
        var blob0 = String((messages[0] && messages[0].content) || '');
        var pm = blob0.match(/Available Predefined Characters:\s*(\[[\s\S]*?\])/);
        if (pm) { try { predefined = JSON.parse(pm[1]) || []; } catch (e) {} }

        var quotes = [];
        var re = /"([^"]{2,400})"/g;
        var mm;
        while ((mm = re.exec(desc)) !== null) quotes.push(mm[1]);

        var rng = mulberry32(fnv1a(desc));
        var generic = ['en-male', 'en-female'];
        var gi = Math.floor(rng() * 2);
        var segments = quotes.map(function (q) {
            var voice = null;
            for (var c = 0; c < predefined.length; c++) {
                var ch = predefined[c];
                if (ch && ch.name && ch.preferredVoice && ch.preferredVoice !== 'auto' &&
                    desc.toLowerCase().indexOf(ch.name.toLowerCase()) !== -1) {
                    voice = ch.preferredVoice;
                    break;
                }
            }
            if (!voice) { voice = generic[gi % 2]; gi++; }
            return { dialogue: q, voiceId: voice };
        });
        return JSON.stringify(segments);
    }

    function offlineSummary(messages) {
        var text = '';
        for (var i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') { text = String(messages[i].content || ''); break; }
        }
        if (text.length <= 800) return text;
        var sentences = text.match(/[^.!?\n]+[.!?]+/g) || [text];
        var kept = [];
        var seen = {};
        function push(s) {
            s = (s || '').trim();
            if (!s) return;
            var key = s.slice(0, 60);
            if (seen[key]) return;
            seen[key] = 1;
            kept.push(s);
        }
        push(sentences[0]);
        if (sentences[1]) push(sentences[1]);
        for (var j = 0; j < sentences.length; j++) {
            if (sentences[j].indexOf('"') !== -1 && kept.length < 7) push(sentences[j]);
        }
        if (kept.length < 3) {
            for (var k = 2; k < Math.min(sentences.length, 5); k++) push(sentences[k]);
        }
        return kept.join(' ');
    }

    function routeOffline(messages) {
        var blob = '';
        for (var i = 0; i < messages.length; i++) blob += String((messages[i] && messages[i].content) || '') + '\n';
        if (/sound effects manager/i.test(blob)) return offlineSounds(messages);
        if (/Extracted quoted lines/.test(blob) || /"speak"\s*:\s*string\[\]/.test(blob)) return offlineDialogueFilter(messages);
        if (/identify which character is speaking/i.test(blob) || /voiceId/.test(blob)) return offlineVoiceMap(messages);
        if (/condensation engine/i.test(blob)) return offlineSummary(messages);
        return JSON.stringify(offlineScene(messages));
    }

    /* ================================================================
     * Remote text (Pollinations) with graceful degradation
     * ============================================================== */

    var TEXT_ENDPOINTS = [
        'https://text.pollinations.ai/openai',
        'https://text.pollinations.ai/'
    ];

    function remoteTextAttempt(url, body, signal, ms) {
        return fetchTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body
        }, ms || 14000, signal).then(function (res) {
            if (!res.ok) {
                var e = new Error('HTTP ' + res.status);
                e.httpStatus = res.status;
                throw e;
            }
            var ct = String(res.headers.get('content-type') || '');
            if (ct.indexOf('text/html') !== -1) throw new Error('Unexpected HTML response');
            return res.text();
        }).then(function (text) {
            if (!text || !text.trim()) throw new Error('Empty completion');
            try {
                var data = JSON.parse(text);
                if (data && data.choices && data.choices[0]) {
                    var msg = data.choices[0].message || {};
                    var content = typeof msg.content === 'string' ? msg.content : null;
                    if (content && content.trim()) return content;
                }
                if (data && typeof data.content === 'string' && data.content.trim()) return data.content;
                if (data && typeof data.description === 'string') return JSON.stringify(data);
            } catch (e) {
                // Plain-text completion (bare endpoint) — use it as-is.
            }
            if (text.trim().charAt(0) === '<') throw new Error('Unexpected HTML response');
            return text;
        });
    }

    function normalizeMessages(messages) {
        return (messages || []).map(function (m) {
            var role = m && m.role;
            if (!role && m && m.type) role = m.type === 'user' ? 'user' : 'system';
            if (!role) role = 'user';
            return { role: role, content: String((m && m.content) || '') };
        });
    }

    function buildGetPrompt(messages) {
        var sys = '', user = '';
        var list = messages || [];
        for (var i = 0; i < list.length; i++) {
            var m = list[i] || {};
            if (!sys && m.role === 'system' && m.content) sys = String(m.content);
            if (m.role === 'user' && m.content) user = String(m.content);
        }
        if (!user) {
            for (var j = list.length - 1; j >= 0; j--) {
                if (list[j] && list[j].role !== 'system' && list[j].content) { user = String(list[j].content); break; }
            }
        }
        function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + ' [...]' : s; }
        var out = '';
        if (sys) out += '[SYSTEM]\n' + cut(sys, 2400) + '\n\n';
        if (user) out += '[USER]\n' + cut(user, 1500);
        return out.trim();
    }

    /**
     * Legacy GET endpoint — verified working without any key. Used as the
     * primary fallback when the OpenAI-compatible POST endpoints reject or
     * hang. Context is condensed to fit URL limits.
     */
    function remoteTextGet(messages, opts, wantsJson) {
        var prompt = buildGetPrompt(messages);
        if (wantsJson) prompt += '\n\nRespond with ONLY valid JSON. No markdown fences, no commentary.';
        var url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt) +
            '?referrer=ai-world-maker-standalone' + (wantsJson ? '&json=true' : '');
        return fetchTimeout(url, { method: 'GET' }, 14000, opts && opts.signal).then(function (res) {
            if (!res.ok) {
                var e = new Error('HTTP ' + res.status);
                e.httpStatus = res.status;
                throw e;
            }
            var ct = String(res.headers.get('content-type') || '');
            if (ct.indexOf('text/html') !== -1) throw new Error('Unexpected HTML response');
            return res.text();
        }).then(function (text) {
            if (!text || !text.trim()) throw new Error('Empty completion');
            if (text.trim().charAt(0) === '<') throw new Error('Unexpected HTML response');
            return text;
        });
    }

    function notePostFailure() {
        // POST endpoints have been unreliable — after any failure prefer the
        // verified GET endpoint first for the next few minutes.
        SHIM.postSuspectUntil = Date.now() + 300000;
    }

    function tryRemoteText(messages, opts) {
        if (SHIM.textMode === 'offline' && Date.now() < SHIM.textRetryAt) {
            return Promise.resolve(null);
        }
        var body;
        try {
            body = JSON.stringify({
                model: 'openai',
                messages: normalizeMessages(messages),
                private: true,
                referrer: 'ai-world-maker-standalone'
            });
        } catch (e) {
            return Promise.resolve(null);
        }
        var signal = opts ? opts.signal : null;
        var wantsJson = !!(opts && opts.json);

        var postMain = function () {
            return remoteTextAttempt(TEXT_ENDPOINTS[0], body, signal, 14000)
                .catch(function (err) { notePostFailure(); throw err; });
        };
        var getLegacy = function () { return remoteTextGet(messages, opts, wantsJson); };
        var postBare = function () {
            return remoteTextAttempt(TEXT_ENDPOINTS[1], body, signal, 12000)
                .catch(function (err) { notePostFailure(); throw err; });
        };

        var attempts = (Date.now() < (SHIM.postSuspectUntil || 0))
            ? [getLegacy, postMain, postBare]
            : [postMain, getLegacy, postBare];

        function runAttempt(i) {
            if (i >= attempts.length) {
                return Promise.reject(new Error('All text endpoints failed'));
            }
            return Promise.resolve().then(attempts[i]).catch(function (err) {
                if (err && err.name === 'AbortError') throw err;
                return runAttempt(i + 1);
            });
        }

        return runAttempt(0).then(function (content) {
            SHIM.textMode = 'remote';
            return content;
        }).catch(function (err) {
            if (err && err.name === 'AbortError') throw err;
            var backoff = (err && err.httpStatus === 429) ? 120000 : 90000;
            SHIM.textMode = 'offline';
            SHIM.textRetryAt = Date.now() + backoff;
            try { console.warn('[websim-shim] text API unavailable (' + (err && err.message) + '); using offline director'); } catch (e) {}
            return null;
        });
    }

    function completionsCreate(opts) {
        opts = opts || {};
        var messages = opts.messages || [];
        if (opts.signal && opts.signal.aborted) return Promise.reject(makeAbortError());

        return tryRemoteText(messages, opts).then(function (remoteContent) {
            if (opts.signal && opts.signal.aborted) throw makeAbortError();
            var content;
            var model;
            if (remoteContent != null && (!opts.json || isParsableJson(remoteContent))) {
                content = opts.json ? cleanJsonText(remoteContent) : remoteContent;
                model = 'pollinations';
            } else {
                content = routeOffline(messages);
                model = 'offline-director';
            }
            return { role: 'assistant', content: content, model: model };
        });
    }

    /* ================================================================
     * Image generation — Pollinations first, procedural canvas fallback
     * ============================================================== */

    var ASPECT_DIMS = {
        '16:9': [1280, 720],
        '9:16': [720, 1280],
        '1:1': [768, 768],
        '4:3': [1024, 768],
        '3:4': [768, 1024],
        '3:2': [1152, 768],
        '2:3': [768, 1152],
        '21:9': [1344, 576]
    };

    function resolveDims(opts) {
        var w = opts.width, h = opts.height;
        if (w && h) {
            return { w: Math.round(w), h: Math.round(h), explicit: true };
        }
        var ar = String(opts.aspect_ratio || '16:9');
        var dims = ASPECT_DIMS[ar] || ASPECT_DIMS['16:9'];
        return { w: dims[0], h: dims[1], explicit: false };
    }

    // Serialize remote image requests a little to stay under anonymous rate limits.
    // image.pollinations.ai anonymous tier is throttled (~1 request / 15 s).
    // We reserve a slot before each attempt so back-to-back calls (world
    // thumbnail -> first scene -> item icons) never collide with the limit.
    var IMG_GAP_MS = 15000;
    var imgSlotAt = 0; // earliest timestamp the next remote image request may start

    function sleepMs(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

    function remoteImageUrl(prompt, dims, seed) {
        var w = dims.w, h = dims.h;
        // Keep remote sizes within anonymous-tier-friendly bounds: larger
        // requests (e.g. 4096x2048 panoramas) are slow and often rejected on
        // the free tier, which is why scene generation used to fall back.
        var maxDim = 1536;
        if (w > maxDim || h > maxDim) {
            var scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale); h = Math.round(h * scale);
        }
        return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
            '?width=' + w + '&height=' + h +
            '&seed=' + seed + '&nologo=true&referrer=ai-world-maker-standalone';
    }

    function classifyImageFailure(err) {
        var status = err && err.httpStatus;
        var now = Date.now();
        if (status === 429 || status === 503) {
            SHIM.imageMode = 'throttled';
            imgSlotAt = Math.max(imgSlotAt, now + 16000);
            return 'throttled';
        }
        if (status === 401 || status === 402 || status === 403 || status === 404) {
            SHIM.imageMode = 'down';
            SHIM.imageRetryAt = now + 600000;
            return 'down';
        }
        if (err && err.code === 'ETIMEDOUT') {
            SHIM.imageMode = 'degraded';
            imgSlotAt = Math.max(imgSlotAt, now + 16000);
            return 'degraded';
        }
        // Only a true network-level fetch failure (TypeError: CORS/DNS/refused)
        // should flip future attempts to the <img> probe strategy. Decode and
        // HTTP oddities must not mark fetch itself as blocked.
        if (err && (err instanceof TypeError || err.name === 'TypeError')) {
            SHIM.fetchBlocked = true;
            SHIM.fetchBlockedUntil = now + 300000;
        }
        SHIM.imageMode = 'degraded';
        imgSlotAt = Math.max(imgSlotAt, now + 16000);
        return 'degraded';
    }

    /** Decode a fetched blob into a compact data URL (<= ~96 KB string) so the
     *  image renders instantly with zero extra network requests — a second
     *  request within seconds would be rejected by the anonymous throttle,
     *  which is exactly what made scene images disappear. */
    function blobToCappedDataUrl(blob, timeoutMs) {
        return new Promise(function (resolve, reject) {
            var objectUrl = null;
            var done = false;
            var timer = setTimeout(function () {
                if (done) return;
                done = true;
                try { if (objectUrl) URL.revokeObjectURL(objectUrl); } catch (e) {}
                reject(new Error('image decode timeout'));
            }, timeoutMs || 10000);
            function fail(err) {
                if (done) return;
                done = true;
                clearTimeout(timer);
                try { if (objectUrl) URL.revokeObjectURL(objectUrl); } catch (e) {}
                reject(err);
            }
            try { objectUrl = URL.createObjectURL(blob); } catch (e) { fail(e); return; }
            var img = new Image();
            img.onload = function () {
                if (done) return;
                done = true;
                clearTimeout(timer);
                try { URL.revokeObjectURL(objectUrl); } catch (e) {}
                try {
                    var w = img.naturalWidth || img.width;
                    var h = img.naturalHeight || img.height;
                    if (!w || !h) throw new Error('decoded image has no dimensions');
                    var canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(encodeCapped(canvas));
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = function () {
                fail(new Error('failed to decode fetched image'));
            };
            img.src = objectUrl;
        });
    }

    /** CORS-clean <img> load probe: works when connect-src restricts fetch()
     *  but images are allowed. Returns true if the image is usable. */
    function imageLoadTest(url, timeoutMs) {
        return new Promise(function (resolve) {
            var img = new Image();
            var done = false;
            function finish(ok) {
                if (done) return;
                done = true;
                clearTimeout(timer);
                try { img.onload = img.onerror = null; img.src = ''; } catch (e) {}
                resolve(ok);
            }
            var timer = setTimeout(function () { finish(false); }, timeoutMs);
            img.crossOrigin = 'anonymous';
            img.onload = function () { finish(true); };
            img.onerror = function () { finish(false); };
            img.src = url;
        });
    }

    function attemptRemoteImage(prompt, dims) {
        var seed = fnv1a(prompt) % 999999;
        var url = remoteImageUrl(prompt, dims, seed);
        var state = { throttled: false };

        var fetchStep = Promise.resolve(null);
        if (!(SHIM.fetchBlocked && Date.now() < (SHIM.fetchBlockedUntil || 0))) {
            fetchStep = fetchTimeout(url, {}, 40000, null).then(function (res) {
                if (!res.ok) {
                    var e = new Error('HTTP ' + res.status);
                    e.httpStatus = res.status;
                    throw e;
                }
                var ct = String(res.headers.get('content-type') || '');
                if (ct.indexOf('image') === -1) {
                    var e2 = new Error('Non-image response (' + ct + ')');
                    e2.httpStatus = res.status;
                    throw e2;
                }
                return res.blob().then(function (blob) {
                    if (!blob || !blob.size) throw new Error('Empty image');
                    // Decode + re-encode so the display step needs zero extra
                    // network requests (a second request hits the throttle).
                    // If decoding stalls or fails, the fetch already proved the
                    // URL is good — hand back the raw URL rather than failing.
                    return blobToCappedDataUrl(blob, 10000).then(
                        function (dataUrl) { return dataUrl; },
                        function () { return url; }
                    );
                });
            }).then(function (u) {
                return { url: u, via: 'fetch' };
            }).catch(function (err) {
                if (err && err.name === 'AbortError') throw err;
                var cls = classifyImageFailure(err);
                if (cls === 'throttled') state.throttled = true;
                try { console.warn('[websim-shim] image fetch failed (' + (err && err.message) + '); trying img probe'); } catch (e) {}
                return null;
            });
        }

        return fetchStep.then(function (remote) {
            if (remote) {
                SHIM.imageMode = 'remote';
                try { console.info('[websim-shim] remote image generated (fetch' + (String(remote.url).indexOf('data:') === 0 ? ', re-encoded)' : ', raw url)')); } catch (e) {}
                return remote;
            }
            if (state.throttled) return null; // don't burn a probe on a 429
            return imageLoadTest(url, 20000).then(function (ok) {
                if (ok) {
                    SHIM.imageMode = 'remote';
                    SHIM.fetchBlocked = true;
                    SHIM.fetchBlockedUntil = Date.now() + 600000;
                    try { console.info('[websim-shim] remote image generated (img probe)'); } catch (e) {}
                    return { url: url, via: 'img' };
                }
                // Slow generation or a blocked request: back off a single slot
                // (~16s) instead of locking everything out for 90s. Anonymous
                // pollinations often just needs longer than we waited.
                SHIM.imageMode = 'degraded';
                imgSlotAt = Math.max(imgSlotAt, Date.now() + 16000);
                return null;
            });
        });
    }

    /* ---- procedural renderer ---------------------------------------------- */

    function encodeCapped(canvas) {
        function tryEncode(type, q) {
            try {
                var d = canvas.toDataURL(type, q);
                if (type === 'image/webp' && d.indexOf('data:image/webp') !== 0) return null; // unsupported
                return d;
            } catch (e) { return null; }
        }
        var qualities = [0.8, 0.65, 0.5, 0.38];
        for (var i = 0; i < qualities.length; i++) {
            var d = tryEncode('image/webp', qualities[i]);
            if (d && d.length <= 96000) return d;
            if (d === null) break; // webp unsupported — go straight to jpeg
        }
        for (var j = 0; j < qualities.length; j++) {
            var dj = tryEncode('image/jpeg', qualities[j]);
            if (dj && dj.length <= 96000) return dj;
        }
        // Last resort: shrink.
        var scale = 0.6;
        var c2 = document.createElement('canvas');
        c2.width = Math.max(64, Math.round(canvas.width * scale));
        c2.height = Math.max(64, Math.round(canvas.height * scale));
        var ctx2 = c2.getContext('2d');
        ctx2.drawImage(canvas, 0, 0, c2.width, c2.height);
        var d2 = null;
        try { d2 = c2.toDataURL('image/jpeg', 0.55); } catch (e) {}
        if (d2) return d2;
        return canvas.toDataURL('image/png');
    }

    function proceduralImage(prompt, dims) {
        var w = Math.min(dims.w, dims.explicit ? 1536 : 1280);
        var h = Math.min(dims.h, dims.explicit ? 768 : 720);
        if (dims.w / dims.h > 2.2 || dims.h / dims.w > 2.2) {
            // Extreme panoramas: keep 2:1-ish for the 360 viewer.
            w = Math.min(w, 1536);
            h = Math.round(w / 2);
        }

        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        var seed = fnv1a(prompt || 'scene');
        var rng = mulberry32(seed);
        var biome = detectBiome(prompt || '');
        var portrait = dims.h > dims.w;

        // --- sky ---
        var skyGrad = ctx.createLinearGradient(0, 0, 0, h);
        skyGrad.addColorStop(0, biome.sky[0]);
        skyGrad.addColorStop(0.55, biome.sky[1]);
        skyGrad.addColorStop(1, biome.sky[2]);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        var horizon = h * (0.52 + rng() * 0.1);

        // --- stars ---
        if (biome.night || rng() < 0.35) {
            var starCount = Math.round((w * h) / 3500);
            for (var s = 0; s < starCount; s++) {
                var sx = rng() * w, sy = rng() * horizon * 0.95;
                var sr = rng() * 1.4 + 0.2;
                ctx.globalAlpha = 0.25 + rng() * 0.75;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // --- sun / moon ---
        var sunX = w * (0.2 + rng() * 0.6);
        var sunY = horizon * (0.35 + rng() * 0.4);
        var sunR = Math.min(w, h) * (0.05 + rng() * 0.05);
        var glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 4);
        glow.addColorStop(0, biome.sun);
        glow.addColorStop(0.25, biome.sun + '88');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = biome.sun;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
        ctx.fill();

        // --- clouds / haze bands ---
        var cloudBands = 3 + Math.floor(rng() * 4);
        for (var c = 0; c < cloudBands; c++) {
            var cy = horizon * (0.15 + rng() * 0.75);
            var cw = w * (0.2 + rng() * 0.5);
            var cx = rng() * w;
            var ch2 = h * (0.012 + rng() * 0.03);
            var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw / 2);
            cg.addColorStop(0, 'rgba(255,255,255,' + (0.05 + rng() * 0.12).toFixed(3) + ')');
            cg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = cg;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1, ch2 / (cw / 2));
            ctx.beginPath();
            ctx.arc(0, 0, cw / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // --- mountain ridges ---
        var ridges = 3;
        for (var r = 0; r < ridges; r++) {
            var baseY = horizon + (r * h * 0.07) - (r === 0 ? h * 0.06 : 0);
            var amp = h * (0.10 + r * 0.045) * (0.7 + rng() * 0.6);
            var segs = 7 + Math.floor(rng() * 6);
            ctx.beginPath();
            ctx.moveTo(0, h);
            var py = baseY;
            ctx.lineTo(0, py);
            for (var i = 1; i <= segs; i++) {
                var px = (w / segs) * i;
                py = baseY + (rng() - 0.5) * amp;
                var midx = (w / segs) * (i - 0.5);
                var midy = baseY + (rng() - 0.5) * amp * 1.4;
                ctx.quadraticCurveTo(midx, midy, px, py);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = biome.ridge[Math.min(r, biome.ridge.length - 1)];
            ctx.fill();

            // ridge rim light
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.06 + r * 0.02) + ')';
            ctx.lineWidth = Math.max(1, h * 0.003);
            ctx.stroke();
        }

        // --- ground haze ---
        var haze = ctx.createLinearGradient(0, horizon - h * 0.05, 0, h);
        haze.addColorStop(0, 'rgba(255,255,255,0.10)');
        haze.addColorStop(0.4, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = haze;
        ctx.fillRect(0, horizon - h * 0.05, w, h - horizon + h * 0.05);

        // --- foreground silhouettes (trees / structures) ---
        var isForest = /forest|wood|jungle|tree|grove|thicket/.test(prompt || '');
        var isCity = /city|urban|street|neon|metropolis|town/.test(prompt || '');
        if (isForest || isCity || rng() < 0.4) {
            var propCount = 4 + Math.floor(rng() * 6);
            for (var p = 0; p < propCount; p++) {
                var px2 = rng() * w;
                var groundY = h * (0.86 + rng() * 0.14);
                ctx.fillStyle = 'rgba(0,0,0,' + (0.55 + rng() * 0.3).toFixed(2) + ')';
                if (isCity) {
                    var bw = w * (0.03 + rng() * 0.06);
                    var bh = h * (0.12 + rng() * 0.3);
                    ctx.fillRect(px2 - bw / 2, groundY - bh, bw, bh);
                    ctx.fillStyle = 'rgba(255,255,255,0.25)';
                    for (var wy = 0; wy < 5; wy++) {
                        if (rng() < 0.5) continue;
                        ctx.fillRect(px2 - bw / 4, groundY - bh + (wy + 0.5) * (bh / 6), Math.max(2, bw / 8), Math.max(2, bh / 22));
                    }
                } else {
                    var th = h * (0.1 + rng() * 0.24);
                    var tw = th * (0.32 + rng() * 0.2);
                    ctx.fillRect(px2 - tw * 0.06, groundY - th * 0.35, tw * 0.12, th * 0.35);
                    ctx.beginPath();
                    ctx.moveTo(px2, groundY - th);
                    ctx.lineTo(px2 - tw / 2, groundY - th * 0.3);
                    ctx.lineTo(px2 + tw / 2, groundY - th * 0.3);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }

        // --- vignette ---
        var vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.42)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);

        // --- subtle grain ---
        try {
            var img = ctx.getImageData(0, 0, w, h);
            var data = img.data;
            for (var g = 0; g < data.length; g += 4) {
                var n = ((rng() - 0.5) * 14) | 0;
                data[g] = clamp(data[g] + n, 0, 255);
                data[g + 1] = clamp(data[g + 1] + n, 0, 255);
                data[g + 2] = clamp(data[g + 2] + n, 0, 255);
            }
            ctx.putImageData(img, 0, 0);
        } catch (e) { /* tainted canvas shouldn't happen here */ }

        return encodeCapped(canvas);
    }

    function imageGen(opts) {
        opts = opts || {};
        var prompt = String(opts.prompt || '').trim();
        if (!prompt) return Promise.reject(new Error('imageGen: missing prompt'));
        var dims = resolveDims(opts);
        var priority = !!opts.priority; // scene images wait for a throttle slot; icons/thumbs don't

        // Synchronous throttle decision + slot reservation (safe: JS is single-threaded)
        var plan = { go: false, wait: 0 };
        var now = Date.now();
        if (!(SHIM.imageMode === 'down' && now < (SHIM.imageRetryAt || 0))) {
            var wait = Math.max(0, imgSlotAt - now);
            var cap = priority ? 14800 : 2500;
            if (wait <= cap) {
                plan.go = true;
                plan.wait = wait;
                imgSlotAt = now + wait + IMG_GAP_MS;
            }
        }

        var run = async function () {
            if (plan.wait > 0) await sleepMs(plan.wait);
            if (plan.go) {
                var remote = await attemptRemoteImage(prompt, dims);
                if (remote) return { url: remote.url };
                if (SHIM.imageMode !== 'throttled' && SHIM.imageMode !== 'degraded' && SHIM.imageMode !== 'down') {
                    SHIM.imageMode = 'down';
                    SHIM.imageRetryAt = Date.now() + 90000;
                }
            }
            return { url: proceduralImage(prompt, dims) };
        };

        // Hard cap: create/settings flows await this — it must always settle.
        return Promise.race([
            run(),
            sleepMs(80000).then(function () {
                try { console.warn('[websim-shim] imageGen hard timeout; using procedural renderer'); } catch (e) {}
                return { url: proceduralImage(prompt, dims) };
            })
        ]).catch(function (err) {
            // Absolute last resort — still return something renderable.
            try {
                return { url: proceduralImage(prompt, dims) };
            } catch (e) {
                throw err;
            }
        });
    }

    /* ================================================================
     * Text-to-speech — browser voices + pacing WAV
     * ============================================================== */

    var VOICE_LANGS = {
        es: 'es', 'es-male': 'es', 'es-female': 'es',
        fr: 'fr', 'fr-male': 'fr', 'fr-female': 'fr',
        de: 'de', 'de-male': 'de', 'de-female': 'de',
        it: 'it', 'it-male': 'it', 'it-female': 'it'
    };
    var FEMALE_RE = /(female|samantha|zira|victoria|serena|karen|moira|tessa|fiona|kate|stephanie|susan|allison|hazel|aria|michelle|eva|maria|amelie|anna|emma|zoe|catherine|luciana|paulina|monica|laura|melina|ioana|milena|ioana|yuna)/i;

    function speakWithBrowser(text, voiceId) {
        if (!G.speechSynthesis || !G.SpeechSynthesisUtterance) return;
        try {
            var u = new G.SpeechSynthesisUtterance(text);
            var vid = String(voiceId || '');
            var langKey = null;
            for (var k in VOICE_LANGS) {
                if (vid.toLowerCase().indexOf(k) === 0) { langKey = VOICE_LANGS[k]; break; }
            }
            if (langKey) u.lang = langKey + '-' + (langKey.toUpperCase());
            else u.lang = 'en-US';
            var wantsFemale = /female/i.test(vid);
            var wantsMale = /male/i.test(vid) && !/female/i.test(vid);
            try {
                var voices = G.speechSynthesis.getVoices() || [];
                if (voices.length) {
                    var langPrefix = (langKey || 'en');
                    var pool = voices.filter(function (v) {
                        return String(v.lang || '').toLowerCase().indexOf(langPrefix) === 0;
                    });
                    if (!pool.length) pool = voices.filter(function (v) {
                        return String(v.lang || '').toLowerCase().indexOf('en') === 0;
                    });
                    if (!pool.length) pool = voices;
                    var chosen = null;
                    for (var i = 0; i < pool.length; i++) {
                        var isF = FEMALE_RE.test(pool[i].name || '');
                        if ((wantsFemale && isF) || (wantsMale && !isF)) { chosen = pool[i]; break; }
                    }
                    if (!chosen) {
                        var idx = fnv1a(text) % pool.length;
                        chosen = pool[idx];
                    }
                    if (chosen) u.voice = chosen;
                }
            } catch (e) { /* default voice is fine */ }
            u.rate = 1.0;
            u.pitch = wantsMale ? 0.9 : (wantsFemale ? 1.1 : 1.0);
            G.speechSynthesis.speak(u);
        } catch (e) { /* TTS is best-effort */ }
    }

    function silenceWavDataUrl(seconds) {
        var rate = 8000;
        var n = Math.max(1, Math.floor(rate * seconds));
        var buf = new ArrayBuffer(44 + n * 2);
        var v = new DataView(buf);
        function writeStr(off, s) { for (var i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); }
        writeStr(0, 'RIFF');
        v.setUint32(4, 36 + n * 2, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);          // PCM
        v.setUint16(22, 1, true);          // mono
        v.setUint32(24, rate, true);
        v.setUint32(28, rate * 2, true);
        v.setUint16(32, 2, true);
        v.setUint16(34, 16, true);
        writeStr(36, 'data');
        v.setUint32(40, n * 2, true);
        // samples default to 0 == silence
        var bytes = new Uint8Array(buf);
        var CHUNK = 0x8000;
        var s = '';
        for (var i = 0; i < bytes.length; i += CHUNK) {
            s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
        }
        return 'data:audio/wav;base64,' + btoa(s);
    }

    function textToSpeech(opts) {
        opts = opts || {};
        var text = String(opts.text || '');
        var voiceId = String(opts.voice || '');
        speakWithBrowser(text, voiceId);
        var duration = clamp(text.length * 0.072 + 0.4, 0.5, 30);
        return Promise.resolve({ url: silenceWavDataUrl(duration) });
    }

    /* ================================================================
     * Uploads
     * ============================================================== */

    function upload(file) {
        return new Promise(function (resolve, reject) {
            if (!file) { reject(new Error('upload: no file')); return; }
            if (typeof FileReader === 'undefined') { reject(new Error('upload: FileReader unavailable')); return; }
            var fr = new FileReader();
            fr.onload = function () { resolve(fr.result); };
            fr.onerror = function () { reject(fr.error || new Error('upload failed')); };
            fr.readAsDataURL(file);
        });
    }

    /* ================================================================
     * WebsimSocket — local realtime collections (IDB + BroadcastChannel)
     * ============================================================== */

    var DB_NAME = 'ai-world-maker-standalone';
    var STORE = 'kv';
    var idbPromise = null;

    function getDB() {
        if (!G.indexedDB) return Promise.resolve(null);
        if (!idbPromise) {
            idbPromise = new Promise(function (resolve) {
                try {
                    var req = G.indexedDB.open(DB_NAME, 1);
                    req.onupgradeneeded = function () {
                        try { req.result.createObjectStore(STORE); } catch (e) {}
                    };
                    req.onsuccess = function () { resolve(req.result); };
                    req.onerror = function () { resolve(null); };
                    setTimeout(function () { resolve(req.result || null); }, 3000);
                } catch (e) { resolve(null); }
            });
        }
        return idbPromise;
    }

    function storeGet(name) {
        return getDB().then(function (db) {
            if (db) {
                return new Promise(function (resolve) {
                    try {
                        var tx = db.transaction(STORE, 'readonly');
                        var req = tx.objectStore(STORE).get(name);
                        req.onsuccess = function () { resolve(req.result || null); };
                        req.onerror = function () { resolve(null); };
                    } catch (e) { resolve(null); }
                }).then(function (val) {
                    if (val != null) return val;
                    var raw = lsGet('wsdb:' + name);
                    if (raw) { try { return JSON.parse(raw); } catch (e) {} }
                    return null;
                });
            }
            var raw2 = lsGet('wsdb:' + name);
            if (raw2) { try { return JSON.parse(raw2); } catch (e) {} }
            return null;
        });
    }

    function storeSet(name, value) {
        lsSet('wsdb:' + name, JSON.stringify(value)); // mirror (best effort)
        return getDB().then(function (db) {
            if (!db) return;
            return new Promise(function (resolve) {
                try {
                    var tx = db.transaction(STORE, 'readwrite');
                    tx.objectStore(STORE).put(value, name);
                    tx.oncomplete = function () { resolve(); };
                    tx.onerror = function () { resolve(); };
                    tx.onabort = function () { resolve(); };
                } catch (e) { resolve(); }
            });
        }).catch(function () {});
    }

    function WebsimSocket() {
        if (WebsimSocket._instance) return WebsimSocket._instance;
        WebsimSocket._instance = this;
        this._cache = {};      // name -> array (newest first)
        this._loaded = {};     // name -> bool
        this._subs = {};       // name -> [callbacks]
        this._bc = null;
        this._initialized = false;
    }

    WebsimSocket.prototype.initialize = function () {
        var self = this;
        if (self._initialized) return Promise.resolve();
        self._initialized = true;
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                self._bc = new BroadcastChannel('ai_world_maker_wsdb');
                self._bc.onmessage = function (ev) {
                    var name = ev && ev.data && ev.data.name;
                    if (name) self._refresh(name);
                };
            }
        } catch (e) {}
        try {
            if (G.addEventListener) {
                G.addEventListener('storage', function (ev) {
                    if (ev.key && ev.key.indexOf('wsdb:') === 0) {
                        self._refresh(ev.key.slice(5));
                    }
                });
            }
        } catch (e) {}
        return self._seedAll();
    };

    WebsimSocket.prototype._persist = function (name) {
        var records = this._cache[name] || [];
        storeSet(name, records);
        try {
            if (this._bc) this._bc.postMessage({ name: name });
        } catch (e) {}
    };

    WebsimSocket.prototype._refresh = function (name) {
        var self = this;
        storeGet(name).then(function (records) {
            if (records && Array.isArray(records)) {
                self._cache[name] = records;
                self._loaded[name] = true;
                self._notify(name);
            }
        });
    };

    WebsimSocket.prototype._notify = function (name) {
        var subs = this._subs[name] || [];
        var records = (this._cache[name] || []).slice();
        for (var i = 0; i < subs.length; i++) {
            try { subs[i](records.slice()); } catch (e) {
                try { console.error('[websim-shim] subscriber error:', e); } catch (e2) {}
            }
        }
    };

    WebsimSocket.prototype._ensure = function (name) {
        var self = this;
        if (self._loaded[name]) return Promise.resolve();
        return storeGet(name).then(function (records) {
            self._cache[name] = Array.isArray(records) ? records : [];
            self._loaded[name] = true;
        });
    };

    WebsimSocket.prototype._seed = function (name, seedRecords) {
        if (lsGet('wsdb_seed_v2')) return;
        if ((this._cache[name] || []).length > 0) return;
        this._cache[name] = seedRecords.slice();
        lsSet('wsdb_seed_v2', '1');
        this._persist(name);
    };

    WebsimSocket.prototype._seedAll = function () {
        var self = this;
        var now = Date.now();
        function iso(msAgo) { return new Date(now - msAgo).toISOString(); }

        return Promise.all([
            self._ensure('shared_world_v6'),
            self._ensure('featured_world_v1'),
            self._ensure('world_comment'),
            self._ensure('world_play_v1'),
            self._ensure('world_feedback'),
            self._ensure('world_victory_v1'),
            self._ensure('chat_message_v1')
        ]).then(function () {
            if (lsGet('wsdb_seed_v2')) return;

            var w1 = {
                id: uuid(),
                name: 'The Lamplight Archipelago',
                prompt: 'A chain of floating islands where lamplighters keep ancient stars burning. Travel between islands, bargain with sky-faring folk, and relight the fallen constellation before the Long Night arrives.',
                username: 'archive_curator',
                created_at: iso(86400000 * 4),
                thumbnailUrl: 'background.jpg',
                musicDataUrl: null,
                isAdvanced: false,
                rawAdvancedDetails: [],
                startingItems: '', locations: '', characters: '', rules: '', customStats: '',
                objective: 'Relight the fallen constellation before the Long Night arrives.',
                plays: 0, likes: 0, zipUrl: null, allowCopy: false
            };
            var w2 = {
                id: uuid(),
                name: 'Static Motel',
                prompt: 'You are trapped in a roadside motel that exists between television channels. Every room broadcasts a different reality; find the master antenna and tune your way home before the signal decays.',
                username: 'night_signal',
                created_at: iso(86400000 * 2),
                thumbnailUrl: 'background.jpg',
                musicDataUrl: null,
                isAdvanced: false,
                rawAdvancedDetails: [],
                startingItems: '', locations: '', characters: '', rules: '', customStats: '',
                objective: 'Find the master antenna and tune your way home.',
                plays: 0, likes: 0, zipUrl: null, allowCopy: false
            };

            if (self._cache['shared_world_v6'].length === 0) {
                self._cache['shared_world_v6'] = [w1, w2];
                self._persist('shared_world_v6');
            }
            if (self._cache['featured_world_v1'].length === 0) {
                self._cache['featured_world_v1'] = [{
                    id: uuid(), world_id: w1.id, username: 'archive_curator', created_at: iso(86400000 * 3)
                }];
                self._persist('featured_world_v1');
            }
            if (self._cache['world_comment'].length === 0) {
                self._cache['world_comment'] = [{
                    id: uuid(), world_id: w1.id, username: 'wandering_ink',
                    text: 'The lamplight mechanic loop is unreal — got lost in it for an hour.',
                    created_at: iso(86400000 * 3)
                }, {
                    id: uuid(), world_id: w2.id, username: 'channel_surfer',
                    text: 'Room 7 reminded me of a dream I had as a kid. No notes.',
                    created_at: iso(86400000)
                }];
                self._persist('world_comment');
            }
            if (self._cache['world_feedback'].length === 0) {
                self._cache['world_feedback'] = [
                    { id: uuid(), world_id: w1.id, username: 'wandering_ink', type: 'like', created_at: iso(86400000 * 3) },
                    { id: uuid(), world_id: w2.id, username: 'channel_surfer', type: 'like', created_at: iso(86400000) }
                ];
                self._persist('world_feedback');
            }
            if (self._cache['world_play_v1'].length === 0) {
                self._cache['world_play_v1'] = [
                    { id: uuid(), world_id: w1.id, username: 'wandering_ink', created_at: iso(86400000 * 3) },
                    { id: uuid(), world_id: w1.id, username: 'channel_surfer', created_at: iso(86400000 * 2) },
                    { id: uuid(), world_id: w2.id, username: 'wandering_ink', created_at: iso(3600000) }
                ];
                self._persist('world_play_v1');
            }
            if (self._cache['chat_message_v1'].length === 0) {
                self._cache['chat_message_v1'] = [{
                    id: uuid(),
                    username: 'archivist',
                    text: 'Welcome to the Live Chat. Traffic here is local to this machine, but everything else — worlds, gallery, saves — works exactly like the real thing.',
                    avatarUrl: avatarDataUrl('archivist'),
                    created_at: iso(7200000)
                }];
                self._persist('chat_message_v1');
            }
            lsSet('wsdb_seed_v2', '1');
        });
    };

    function matchesFilter(record, query) {
        if (!query) return true;
        for (var k in query) {
            if (Object.prototype.hasOwnProperty.call(query, k)) {
                if (record[k] !== query[k]) return false;
            }
        }
        return true;
    }

    WebsimSocket.prototype.collection = function (name) {
        var room = this;

        function create(data) {
            return room._ensure(name).then(function () {
                var record = Object.assign({}, data || {});
                if (!record.id) record.id = uuid();
                if (!record.created_at) record.created_at = new Date().toISOString();
                if (!record.username) record.username = currentUsername();
                room._cache[name].unshift(record);
                room._persist(name);
                room._notify(name);
                return record;
            });
        }

        function update(id, patch) {
            return room._ensure(name).then(function () {
                var recs = room._cache[name];
                for (var i = 0; i < recs.length; i++) {
                    if (recs[i].id === id) {
                        Object.assign(recs[i], patch || {});
                        recs[i].updated_at = new Date().toISOString();
                        break;
                    }
                }
                room._persist(name);
                room._notify(name);
            });
        }

        function remove(id) {
            return room._ensure(name).then(function () {
                room._cache[name] = room._cache[name].filter(function (r) { return r.id !== id; });
                room._persist(name);
                room._notify(name);
            });
        }

        function getList() {
            return room._ensure(name).then(function () {
                return room._cache[name].slice();
            });
        }

        function subscribe(cb) {
            if (!room._subs[name]) room._subs[name] = [];
            room._subs[name].push(cb);
            room._ensure(name).then(function () { room._notify(name); });
            return function () {
                var arr = room._subs[name] || [];
                var idx = arr.indexOf(cb);
                if (idx !== -1) arr.splice(idx, 1);
            };
        }

        function filter(query) {
            return {
                getList: function () {
                    return getList().then(function (recs) {
                        return recs.filter(function (r) { return matchesFilter(r, query); });
                    });
                },
                subscribe: function (cb) {
                    return subscribe(function (recs) {
                        cb(recs.filter(function (r) { return matchesFilter(r, query); }));
                    });
                },
                create: create,
                update: update,
                delete: remove
            };
        }

        return {
            create: create,
            update: update,
            delete: remove,
            getList: getList,
            subscribe: subscribe,
            filter: filter,
            // Compatibility helper: real websim exposes `getFirst`-like patterns
            // through filter().getList()[0]; nothing else needed here.
        };
    };

    /* ================================================================
     * Install globals (only when the native runtime is absent)
     * ============================================================== */

    if (!G.websim) {
        G.websim = {
            __shimmed: true,
            chat: {
                completions: { create: completionsCreate }
            },
            imageGen: imageGen,
            textToSpeech: textToSpeech,
            upload: upload,
            getCurrentUser: function () { return Promise.resolve(currentUser()); },
            getCreatedBy: function () { return Promise.resolve({ username: 'Speedymule6858' }); }
        };
        try { console.info('[websim-shim] native websim runtime not found — standalone platform shim installed (text: ' + SHIM.textMode + ', images: ' + SHIM.imageMode + ')'); } catch (e) {}
    }

    if (typeof G.WebsimSocket === 'undefined') {
        G.WebsimSocket = WebsimSocket;
    }

    // Introspection helpers for debugging/tests.
    G.__wsShimInternals = {
        offlineScene: offlineScene,
        routeOffline: routeOffline,
        cleanJsonText: cleanJsonText,
        avatarDataUrl: avatarDataUrl,
        detectBiome: detectBiome,
        proceduralImage: proceduralImage
    };
})();
