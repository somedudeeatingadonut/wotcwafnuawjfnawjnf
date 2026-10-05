# AI World Maker

An AI-powered procedural adventure engine: create a world from a text concept, then
explore it in first person with generated narration, generated 360° scene images,
inventory, survival stats, voice acting, sound effects, saves, and a local gallery.

Originally built for the [websim](https://websim.com) platform. This checkout runs
**fully standalone** — no websim account or runtime required.

## Run it

```bash
node server.mjs          # or: npm start
# open http://localhost:8080
```

Any static file server works, but it must serve `.js` as `text/javascript`
(ES modules) and return 404s for missing files — `server.mjs` does both.

## How it works standalone

The app's code calls a set of platform APIs (`websim.*` and `WebsimSocket`) that
only exist when hosted on websim. `vendor/websim-shim.js` (loaded before the app)
provides a drop-in standalone implementation; the native runtime still wins if the
page is ever hosted on websim itself.

| Capability | Online (browser has internet) | Offline / API unreachable |
| --- | --- | --- |
| Scene narration, sound cues, voice mapping, summaries | [Pollinations](https://pollinations.ai) free text API (no key) | Built-in **offline director**: generates valid scene JSON (narration, image prompt, item/stat changes, win condition, location) from templates |
| Scene / thumbnail / item images | [Pollinations](https://pollinations.ai) image API (no key) | **Procedural renderer**: deterministic canvas landscape/icon art, biome-aware, size-capped for storage |
| Voice acting | Browser `speechSynthesis` voices + pacing audio | same |
| File uploads (`websim.upload`) | `data:` URLs | `data:` URLs |
| Chat / gallery / reports / comments (realtime DB) | IndexedDB + BroadcastChannel (syncs across tabs), seeded with demo gallery worlds | same |

After the first failed remote call the shim backs off (60–120 s), so turns stay
fast even without connectivity.

## What was fixed / changed for standalone use

- **Module loads at all**: vendored `three` (`vendor/three.module.js` + `three.core.js`)
  and `jszip` (`vendor/jszip.min.js`, UMD global) instead of bare-specifier / esm.sh imports.
- **Platform shim** (`vendor/websim-shim.js`): completions, `imageGen`, `textToSpeech`,
  `upload`, `getCurrentUser`, `getCreatedBy`, and a localStorage/IndexedDB-backed
  `WebsimSocket`.
- **Missing media assets**: `loading.jpg` / `background.jpg` generated; warning/button
  icons shipped as SVG (`graphiccontent.svg`, `graphicpreview.svg`, `menu.svg`, `v1.svg`);
  missing `.mp3` sound effects and music are synthesized with the Web Audio API at load
  time (UI blips, footsteps, ambient chord loops for music tracks).
- **Graphic-content AI detector removed** (per request): scene images are always shown
  unless the user picks “Disable Images”. The old detector (and its offline heuristic)
  is gone; Lumen Mode’s copy was updated to match.
- Avatars fall back to generated identicons when `images.websim.com` is unreachable.

## Tests

```bash
npm run check           # syntax checks
node tests/smoke.mjs    # shim unit tests (offline director, collections, seeding)
```

`tests/e2e-scene.png` is a screenshot from a full headless-Chromium walkthrough
(create world → start adventure → take a turn), rendered with the procedural
fallback image in the WebGL panorama viewer.

## Repository layout

```
index.html styles.css script.js   # the app (script.js ~8.5k lines)
vendor/three.* vendor/jszip.*     # vendored libraries
vendor/websim-shim.js             # standalone platform shim
server.mjs package.json           # zero-dependency static server
tests/smoke.mjs                   # shim tests
```
