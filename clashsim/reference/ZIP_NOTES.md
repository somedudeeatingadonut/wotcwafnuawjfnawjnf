# clash.gg dump — what is in the zips and how it was used

The six archives at the repo root are saves of the real clash.gg site that this
sim emulates. They stay at the root so the extraction can be repeated; nothing
in `clashsim/` reads them at runtime.

| zip | size | what it is |
| --- | --- | --- |
| `1.zip` | 13.3 MB | Homepage + Mines + Plinko page saves |
| `1downloads4.zip` | 4.1 MB | Case-Opening landing page save |
| `2.zip` | 12.6 MB | Case Creator + Champion + Race page saves |
| `3.zip` | 6.9 MB | Community Cases + Case Battles archive (inner zip) |
| `4.zip` | 11.2 MB | Double + Crash + Tiles + Upgrader page saves |
| `6.zip` | 22.0 MB | Assets (the bulk of the `.webp` art) |

Extract with:

```sh
mkdir -p /tmp/clashzip
for z in 1.zip 1downloads4.zip 2.zip 3.zip 4.zip 6.zip; do unzip -q -o "$z" -d /tmp/clashzip; done
unzip -q -o "/tmp/clashzip/CS_GO Case Battles_ Win Rare CS_GO Skins_files.zip" -d /tmp/clashzip/battles
```

## What is actually inside

The saved HTML pages are tiny tracking shells (`a_I2O4.htm` ≈ 221 B wrapping a
service-worker iframe) — no `__NEXT_DATA__`, no API responses. The useful parts
are the JS bundles and the art:

* `3258-*.js` (≈1.6 MB) — the main Next.js chunk. This is where everything
  below was mined from.
* `335-*.js`, `4709-*.js`, `main-*.js` — supporting chunks.
* ~1,800 `.webp` files total: `cases_*.webp` (168 files, 62 unique case
  covers), `image_*.webp` (392 sticker/UI images), plus the battles archive
  (298 webp of case-battle art).

## Findings that shaped the sim

### Case reel (from the real reel component in the bundle)

```
itemCount: 90, startPosition: 10, finalPosition: 80
delay: 1.5s, duration: 6s, ease: [.1, 0, .2, 1], HORIZONTAL
```

The real reel walks 70 of its 90 items and lands with a front-loaded ease. The
sim's reel uses the same ease; the Normal speed walks ~70 items over ~10s, and
the speed setting (Turbo/Quick/Normal/Slow) scales that.

### Battle modes (from the i18n strings)

| mode | win condition (verbatim from the bundle) |
| --- | --- |
| normal | "The player with the greatest total unboxed wins" |
| crazy | "The player with the lowest total unboxed wins" |
| jackpot | "Winnings odds are based on value unboxed" |
| terminal | "Most valuable item unboxed on the last case wins" |
| group | "The total unboxed is split by all players" |

Battle creation on the real site runs 2–4 players and offers "Quick Unbox" and
"Clash Spin" (rare items re-roll as the Clash logo) spin styles; the sim ships
the five modes and 2–4 seats.

### Case browser (i18n)

Categories on the real site: All Cases, Classic, New, Popular, Trending, Best
AWP, Best Gloves, Best Knives, Best Stickers, Best Weapon, Free Cases, Highest
ROI, Most Expensive, Community. Search placeholder: "Search for cases...". The
sim ships these categories plus a type filter (Valve / Community / Sticker
Capsule / Clash Original) and the risk chips (Low → Extreme).

### Double (roulette)

* Labels: red / green / black / bait.
* Triple Green Bonus: "A portion (0.75%) of all bets placed on the double will
  be added to the Triple Green Bonus pot." — "Once there is three greens in a
  row, the Triple Green Bonus pot will be distributed…" among the green bettors
  of the third win.

### Tiles (Keno)

"Tiles is a game where players select numbers between 1 and 40 from a set
range. You can pick up to 10 numbers and choose your bet amount. After placing
your bet, 10 random numbers are drawn. Payouts depend on how many of your
chosen numbers match the drawn numbers."

### Other i18n nuggets used or mirrored

* Rarity names: ancient / common / immortal / legendary / mythical / rare /
  uncommon — and the sticker ladder High Grade → Remarkable → Exotic →
  Extraordinary (EMS Katowice 2014 capsules print exactly this).
* Wear: FN Factory New / MW Minimal Wear / FT Field-Tested / WW Well-Worn /
  BS Battle-Scarred.
* Case open button: "Open for {amount}", "Quick Unbox".
* Risk tiers: Low / Medium / High / Extreme.
* Champion (King of the Hill): HP from item value, CRITICAL/MISS hits, house
  edge printed, crown + carried pot paid at session end.
* Rewards: level cases, rakeback, race points, vault, pass — the sim keeps the
  free-gem / free-case drops and the race, all in fake currency.

## Community case art (shipped)

Twelve community case covers were picked out of `cases_*.webp` (unique by md5)
and live in `clashsim/public/art/cases/`:

`crimson-squad` · `ten-percent` · `nightshade` · `broken-heart` · `reaper` ·
`golden-halo` · `insurgency` · `glove-trade` · `graffiti-chaos` ·
`golden-katowice` · `jungle-warfare` · `frozen-assault`

The real community case *prices and item lists* are not in the dump (they were
loaded client-side), so the sim's community cases use these covers with
creator-style odds (62/24/10/3/1) and themed item pools.

## Item data

Real skin names, art URLs (Steam CDN) and rarity tiers come from
[ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API) (`crates.json` /
`skins.json`, fetched by `tools/build-catalog.js --fetch`). All 41 real Valve
weapon cases ship with the published 79.92 / 15.98 / 3.2 / 0.64 / 0.26 % rarity
ladder; the 3 sticker capsules use the capsule ladder; 2 Clash originals and
the 12 community cases round out the 58-case browser.
