# wotcwafnuawjfnawjnf

## Projects

- **`clashsim/`** — a fake-currency emulator of a CS2 skin site (case opening with
  the clash pack's own cases, case battles with five modes, a case creator, crash,
  double with the Triple Green Bonus, upgrader, mines, plinko, keno tiles,
  champion jackpot, daily race), with real case/item names, real clash.gg case
  art, printed odds, and 30 bot opponents. **No real money, no deposits, no
  withdrawals, no payments of any kind.**
  See [`clashsim/README.md`](clashsim/README.md).

```bash
cd clashsim
npm start          # → http://localhost:3000
npm run smoke      # 142 checks: pricing, every API route, the no-money rules
```

The root `index.html` / `script.js` / `styles.css` were an earlier "AI world maker"
experiment. They are gone from the working tree — `git log` still has them if you
ever want them back.
