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
```

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

`npm run smoke` re-derives all of that from the shipped catalog and fails if the
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
  public/cases.js        case grid + the measured reel + battles
  public/games.js        crash · double · upgrader · mines · plinko · tiles · champion
  public/catalog.json    generated — 12 cases, 314 items (never hand-edit)
  tools/build-catalog.js generator + pricing model
  tools/smoke.js         the test suite
  reference/             the clash.gg page the layout was matched against
  .data/players.json     gitignored save file
```

The API is small: `GET /api/config · /api/case?id= · /api/samples?id=&n=`,
`POST /api/hello`, then `GET /api/state?sinceChat=&sinceFeed=` (the whole client runs
off this one polling call, with deltas so the feed and chat never repeat), and
`POST /api/<action>` for everything in `lib/games.js`.

## Two bugs this build fixes, kept honest by tests

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
