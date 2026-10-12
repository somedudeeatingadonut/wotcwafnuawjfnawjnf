# NEONROLL — fake-currency skin-casino simulator

An emulation of the case-opening / skin-gambling site genre (the clashgg / csgoroll
style lobby) built as a **simulation**: invented currency, invented items, invented
players, no payment rails of any kind.

> **DEMO MODE.** Fake coins only. No deposits, no withdrawals, no crypto, no cards,
> no accounts, no real-world value. Every opponent is a bot. This is not gambling,
> and it is not a product — it's a piece of software that shows you how those
> products are built.

## Run it

```bash
cd neonroll
npm start          # or: node server.js
# → http://localhost:3000
```

Zero dependencies. Node 18+ (uses only `node:http`, `node:fs`, `node:crypto`).
`PORT=8080 HOST=0.0.0.0 node server.js` to change the bind address.

## The games

| Game | How it works | Disclosed edge |
| --- | --- | --- |
| **Cases** | Open a case, get a fictional skin, sell it back for coins. Odds table is printed inside every case card. | items return ~90% of case price |
| **Case battles** | You vs one bot, same case, same number of openings. Highest total takes both piles. | ≈10% (emerges from case return) |
| **Crash** | Multiplier climbs from 1.00×; cash out before it busts. 1% instant-bust rounds. | 1% instant bust, ~50% of rounds die before 2.00× |
| **Coinflip 1v1** | 50/50 vs a bot. | pays 1.95× (2.5% rake) |
| **Mines** | 5×5 grid, 1–5 mines, cash out any time. Board is generated server-side *before* your first click. | 3% rake on fair odds |

Case drop table (weights are per-open, value multipliers are × case price):

| Rarity | Chance | Value |
| --- | --- | --- |
| Common | 80% | 0.30× |
| Uncommon | 16% | 0.90× |
| Rare | 3.2% | 3.0× |
| Epic | 0.65% | 12× |
| Legendary | 0.12% | 60× |
| Exotic | 0.03% | 900× |

The exotic multiplier is solved at load time (currently 900×) so the table always
sums to exactly a 90% return — change the case prices or the weights and the top
prize re-solves itself. Nothing here is "provably fair" and the code doesn't pretend otherwise.

## The fake AI players

* 26 scripted bots with names, levels, balances, inventories, chat lines and
  betting "personalities" (`early`, `mid`, `greedy`, `degen`) that decide when to
  cash out on crash and what to stake.
* They open cases, run coinflips, start case battles, complain when a round busts
  at 1.01× and type `gg` when they beat you.
* They **rebuy instantly** when broke, because their money is made up — this is
  exactly the trick real sites use to make a lobby look busier and luckier than it
  is. Here they're labelled `BOT` everywhere instead.
* Your chat messages get canned replies on a random delay. The bots have no idea
  what you said. That's the point.

## Fake-currency guarantees in the code

* `REAL_MONEY_ENABLED = false` at the top of `server.js`, and there is no deposit,
  withdrawal, payment, crypto or account code path anywhere in the project.
* New profiles start with 2,500 coins; a free drop of 400–900 coins is claimable
  every 2 minutes forever; levels pay coin bonuses. Coins can never be bought.
* Inventory items are invented strings with a fake price. They cannot be traded,
  transferred, redeemed or sold for anything except more fake coins.
* Your profile (coins, level, inventory) is stored in `neonroll/.data/players.json`
  on this machine only. No analytics, no ads, no third-party requests, no fonts or
  scripts loaded from anywhere else.

## Files

```
neonroll/
├── server.js          # HTTP server + game engine + bots (zero deps)
├── package.json       # npm start → node server.js
├── public/
│   ├── index.html     # lobby, crash, cases, battles, coinflip, mines, inventory,
│   │                  # leaderboard, "how this works" page
│   ├── styles.css     # dark neon skin-site aesthetic
│   ├── core.js        # session, polling, chat/feed, inventory, leaderboard
│   └── games.js       # crash canvas + all five games
└── .data/             # local fake-coin saves (gitignored)
```

## API (all fake, obviously)

`GET /api/config` · `POST /api/hello` · `GET /api/state?sinceChat=&sinceFeed=`
`POST /api/crash/bet|crash/cashout` · `POST /api/case/open` · `POST /api/battle/start`
`POST /api/coinflip` · `POST /api/mines/start|mines/pick|mines/cashout`
`POST /api/inventory/sell|inventory/sellall` · `POST /api/bonus` · `POST /api/chat`
`POST /api/rename` · `POST /api/reset`

Game outcomes are decided on the server; the client only animates what already
happened. Coin balances and the mines board never trust the browser.

## Why this exists

Real versions of this genre are engineered by very good designers to keep you
clicking, with the odds buried. A simulator is a cheap, safe way to feel how fast a
balance moves under a 2–10% edge — and how much of the "activity" on those sites is
manufactured. If the real thing is affecting your money, sleep, relationships or
mood, treat that as a real problem and talk to someone you trust or a local gambling
support service. This page will never ask you for a cent.
