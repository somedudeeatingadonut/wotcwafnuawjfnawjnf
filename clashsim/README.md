# clash.sim — a fake-currency CS2 skin-site emulator

An emulation of the case-opening / skin-gambling lobby genre (the clash.gg /
csgoroll shape), built as a **simulation you can read**: real case names, real item
names, real rarity ladders and real Steam item art — with invented gem values,
invented players, and **no payment code of any kind**.

> **There is no real money here.** Gems are handed out free and forever. Every
> opponent is a bot, and every bot wears a `BOT` tag. No deposits, no withdrawals,
> no cards, no crypto, no accounts, no cashout, nothing with real-world value.
> `REAL_MONEY_ENABLED` is hard-coded `false` in `server.js`, and the smoke test
> asserts that no such route exists.

## Run it

```bash
cd clashsim
npm start                 # or: node server.js
# → http://localhost:3000
```

Zero dependencies — Node 18+ and nothing else (`node:http`, `node:fs`,
`node:crypto`). The browser gets three plain scripts; no bundler, no framework.

```bash
PORT=8080 HOST=127.0.0.1 node server.js   # bind somewhere else
npm run smoke                             # 41 checks, spawns its own scratch server
node tools/smoke.js http://localhost:3000 # or test a server that is already running

npm run test:reel                         # drives a real Chromium and watches the reel move
node tools/reel-check.js http://localhost:3000
```

`npm run test:reel` is the test a DOM stub cannot write: jsdom gives every element
a zero-sized rect and runs no animations, so a motionless reel passes a jsdom
suite. This one counts how many distinct on-screen positions the reel passes
through in every speed, pins the durations (Normal ≈ 3× Quick), checks the winner
lands under the pointer, that clicking the reel skips to the result, that zero
sized rects still animate, and that motion survives
`prefers-reduced-motion: reduce`. It needs `puppeteer-core` and
`@sparticuz/chromium` (`npm i -D puppeteer-core @sparticuz/chromium`, or point
`CLASH_BROWSER_DIR` at a folder that has them); without them it prints SKIP and
exits 0 rather than failing a machine that cannot run a browser.

## The rules it plays by

| | |
| --- | --- |
| **Outcomes are server-side** | The client animates a result that already happened. Nothing that pays out is decided in the browser. |
| **Odds are printed** | Every case card and every case modal shows the drop table it actually rolls from, with the return rate on it. Plinko prints all nine tables; the upgrader prints its win chance on the dial; Champion prints your share as your stake ÷ pot. |
| **Every opponent is a bot** | 30 of them, all tagged. They open cases, bet crash and double, trade battles, chat, and win pots. |
| **Nothing is purchasable** | The payment mock on the home page is dead on purpose — it has no handler, and its buttons are `disabled`. |
| **Persistence is a scratch file** | Fake profiles are saved to `.data/players.json` (gitignored). Delete it and everyone starts with 💎 2,500 again. |

## The games

| Game | How it works | House edge |
| --- | --- | --- |
| **Case Opening** | Real CS2 cases, real items, real rarity ladders. Each drop rolls a float (wear band) and a 10% StatTrak™ chance, both of which scale the value. | items return ~90% of the case price, by construction |
| **Case Battles** | You vs one random bot, same case, same number of openings, one roll-off. Ties go to the human — the only break in the house's favour reversed anywhere in the sim. The winner takes both piles as items, not as gems. | emerges from the case return |
| **Crash** | Multiplier climbs from 1.00× until it busts. 1% of rounds bust instantly at 1.00×; auto-cash-out is handled server-side, so it fires even if you switch tabs. | ~1%, ≈50% of rounds die before 2.00× |
| **Double** | 54-segment wheel: 24 green and 24 red pay 2×, 6 gold pay 8×. | ≈11% per colour |
| **Upgrader** | Stake gems or a skin, pick a multiplier 1.05×–100×. Win chance is `(1 ÷ target) × 0.96` and it is printed on the dial. | 4% |
| **Mines** | 5×5 grid, 1–5 mines picked before the first click. | 3% rake on fair odds |
| **Plinko** | 8 / 12 / 16 rows, low / medium / high risk, fair coin flips the whole way down. | ~1% (all nine tables return ~99%) |
| **Tiles** | Five rows, more cursed tiles the higher you climb: 1.20× · 2.00× · 3.33× · 8.33× · 20.00×. | ~4% |
| **Champion** | One pot, many contributors, one winner takes 95% of it. Your chance is your stake ÷ pot, printed. | 5% rake on the pot |
| **10K Daily Race** | Wager gems to climb a 12-hour ladder; the top ten are paid at rollover. | — |

Freebies: 💎 2,500–9,000 every 3 minutes, and 3 free case vouchers every 45 minutes
(usable on any case up to 💎 1,000). Wagering earns XP; level-ups pay bonus gems.

## How the odds are built (and how they are checked)

`tools/build-catalog.js` builds `public/catalog.json` from the public CS2 item data
([ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API)), then prices **every case
from the odds that case actually ships**:

```
chance  = tier odds ÷ items in that tier        (5 decimal places, then nudged to sum to exactly 1)
value   = tier anchor × wear multiplier × (StatTrak™ ? 1.5 : 1)      ← rolled per drop
EV      = Σ chance × base  ×  E[wear]  ×  E[StatTrak]
price   = round(EV ÷ 0.9 ÷ 5) × 5               (so the case returns ~90%)
```

- **Valve cases** keep the published ladder: Mil-Spec 79.92% · Restricted 15.98% ·
  Classified 3.20% · Covert 0.64% · Rare Special ★ 0.26%.
- **Original cases** (the Clash Knife and Glove cases) re-tier their items by
  prestige into the same five rungs — 70% / 21% / 6.5% / 2.2% / 0.3% — and the
  rarity the UI prints *is* the tier they roll from, so the printed table and the
  rolled table can never disagree.

`npm run smoke` (97 checks) re-derives all of that from the shipped catalog and fails if the
odds stop summing to 1, if a case drifts away from ~90%, if a Valve case loses the
published ladder, or if 40,000 sampled rolls per case land outside sampling noise
(showing that even a 40k sample of the cheapest case is noisy: their tails are thin).

## Layout

```
clashsim/
  server.js              zero-dep HTTP: static files + JSON API + routes
  lib/catalog.js         loads catalog.json; rolls items, wear and StatTrak
  lib/world.js           bots, chat/feed, round engines (crash · double · champion · race),
                         XP/levels, freebies, persistence, the boot-time lobby warm-up
  lib/games.js           every action a human can take (the API surface)
  public/index.html      the whole UI: nav, 15 views, modals, toasts
  public/styles.css      dark/violet theme, responsive, reduced-motion aware
  public/core.js         session, polling with chat/feed deltas, sound, router, inventory
  public/cases.js        case grid + filters + the measured reel + battles + the Case Creator
  public/core.js         session, sound, feeds · the reel-speed profiles
  public/catalog-clash.json  the clash pack — 48 of the site's own/classic cases, generated
  public/art/case-<n>.webp   152 real clash case images, served locally
  lib/creator.js         the Case Creator: rules, pricing, commissions, the published store
  public/games.js        crash · double · upgrader · mines · plinko · tiles · champion
  public/catalog.json    generated — 12 cases, 314 items (never hand-edit)
  tools/build-catalog.js generator + pricing model (the clash.sim originals)
  tools/build-clash-catalog.js  generator for the clash pack (the site's own cases + classics)
  tools/smoke.js         the test suite, 97 checks
  tools/reel-check.js    the real-browser reel test
  reference/             the clash.gg page the layout was matched against
  .data/players.json     gitignored save file
```

The API is small: `GET /api/config · /api/case?id= · /api/samples?id=&n=`,
`POST /api/hello`, then `GET /api/state?sinceChat=&sinceFeed=` (the whole client runs
off this one polling call, with deltas so the feed and chat never repeat), and
`POST /api/<action>` for everything in `lib/games.js`.

## Four bugs this build fixes, kept honest by tests

1. **Case opening did not work.** Opening a case now debits gems, rolls the items
   server-side, puts them straight into your inventory, and the reel scrolls to the
   exact item that was pulled — the reel measures the DOM after layout instead of
   guessing item widths from CSS, so the marker cannot drift off the result. Both
   the "Open" button and the ×5 path are covered by `npm run smoke`.
2. **Crash sounds played continuously.** The old build beeped on every animation
   frame and the blips stacked into a whine. Now there is one `AudioContext`, a cap
   on sounds in flight, a 240 ms gate on the crash ticker, and a per-round flag so
   the bust sound fires exactly once. The sound is muted by default in no case —
   there is a 🔊 button in the header, and your choice is remembered.
3. **The reel still would not move.** Reported twice. The first fix landed the
   right item but still animated it with a CSS transition, and the
   `@media (prefers-reduced-motion: reduce)` block in `styles.css` flattened
   *every* `transition-duration` to `0.01ms !important` — so for anyone whose OS
   has reduce-motion switched on, the reel jumped straight to the finished state
   and "stayed stuck in one place". Two changes: the reel is now scrolled by
   `requestAnimationFrame` in `cases.js` (no transition to override, and a real
   750 ms scroll for reduce-motion users instead of no motion at all), and the
   reduced-motion block only calms decorative effects, never meaningful motion.
   `npm run test:reel` is the guard against a relapse: with the old
   transition-driven reel that rule left the reduced-motion case reporting a
   single track position, where it now reports a real (if shorter) scroll.
4. **Item art and case art never appeared.** Items were plain cards when the
   Steam CDN was unreachable. Every case and item now has a generated SVG
   fallback (`caseFallbackArt()`) that is drawn from the item's own name and
   rarity colour, so the grid is never empty.

## The clash pack

`public/catalog-clash.json` holds the cases the real site runs, and they are
named after the real thing: the case slugs come out of the clash.gg bundle's own
curated lists (`highest_roi`, `best_knives`, `best_awp`, `most_expensive`,
`free_cases`, `best_weapon`, `best_gloves`, `best_stickers`).

| group | count | what it is |
| --- | --- | --- |
| clash classics | 8 | real Valve cases (Operation Bravo, Huntsman, Breakout, Shadow, Spectrum, Clutch, Danger Zone, Snakebite) with their real contents |
| clash originals | 40 | the site's own cases — `10% Knife`, `30% Knife`, `Knife 50 50`, `Knives Out`, `Color Hunt`, `Purple Pack`, `Vortex`, `Brokie 50 50`, `Medium 50 50`, `60% Profit`, `AWP Main`, `10% AWP Asiimov`, `AWP Heaven`, `Tomb Raid`, `Wealth`, `Eye of the Dragon`, `Eclipse`, `Killer Loadout`, `Stay Frosty`, `Howl Abuser`, `Glove Flip`, `Finest Gloves`, `5% Gloves`, `Rains and Pours`, `Sticker Package`, `Holo King`, `Hologram`, `Nametag Case`, `Level 5/10/20/200 Case` … |
| clash.sim originals | 2 | the two themed cases this build always had (knife + glove) |
| valve | 10 | the original shelf |
| community | 0+ | whatever players publish in the Case Creator |

Two rules make those names honest. A case called **10% Knife** really does drop a
★ in 10% of opens (30% Knife 30%, Knife 50 50 half, 5% Gloves 5%) — the smoke
suite asserts each one. And every case, pack or community, is still priced as
`price = EV / 0.9`, so the return rate printed on its card is the rate it pays.

The case art is real: 152 `cases_*.webp` images out of the dump, copied to
`public/art/` and assigned to the site's own cases, so the shelf shows clash's
own case art even with no network at all. Item art still hot-links Steam's CDN
and falls back to generated art when it cannot load.

## The Case Creator

The real site's creator, rebuilt: **Create Your Own Case** → name → image → up to
20 items → drop chances → **Finish Case Creation**, which prints Case Price and
"You earn {amount} per unbox". The copy and the rules are the ones in the bundle
(name must be unused and at least 10 characters, no profanities, a cap on how
many cases one account publishes, commission per open).

What the sim adds, because it can: **the price is a choice of three honest
price points** — Player-favoured (≈97 % back), The house row (≈90 %), or
Creator-favoured (≈82 %) — each labeled with the rate it actually pays, and the
commission printed before you publish. Publishing merges the case into the shelf
for every session; the creator earns 5 % of every open, paid out of the entry
fee, and only the owner can delete it.

## Reel speed

The real case reel is a component in the clash.gg bundle that walks 70 positions
(`startPosition: 10, finalPosition: 80, itemCount: 90`) over `duration ?? 6`
seconds, after `delay ?? 1.5`, eased with `cubic-bezier(.1, 0, .2, 1)`. That shape
is the default here, and the pace is a setting — pick it in the header, in the
case modal footer, or on the Battles page; the choice is stored and applies to
battles too.

| | spin time | items walked | notes |
| --- | --- | --- | --- |
| Turbo | 1.2 s | ~10 | the default under `prefers-reduced-motion` |
| Quick | 3.4 s | ~24 | the old fixed pace |
| **Normal** | **10.2 s** | **~70** | the default: ~3× Quick, matched to the real reel |
| Slow | 16 s | ~110 | shows the most items |

Click the reel while it spins to skip straight to a result that was already
decided server-side — the skip never changes what you get.

## Notes on the data and the art

- Case contents, rarity colours and item art come from the public CS2 item data and
  are hot-linked from Steam's CDN (`community.akamai.steamstatic.com`). If those
  images are unreachable the UI falls back to generated placeholder art instead of
  rendering empty cards. Shipping that art as your own asset is a rights question
  for whoever ships it; hot-linking it in a local sim is a demo.
- Gem values are **simulated**: modelled on the shape of the real market (a knife is
  worth far more than a Mil-Spec), not scraped prices.
- This is not affiliated with clash.gg, Valve or Steam. It is a study of how these
  lobbies are built, and of how plainly they *could* print their own edge.
