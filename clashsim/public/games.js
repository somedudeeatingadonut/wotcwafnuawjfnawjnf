/* ==========================================================================
   games.js — Crash · Double · Upgrader · Mines · Plinko · Tiles · Champion
   The browser only draws what the server already decided.
   ========================================================================== */

/* `reduceMotion` (and the reel-speed profiles) live in core.js. */

/** Size a canvas to its CSS box (DPR aware) and hand back a clean 2d context. */
function gfx(canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
  if (!ctx) return null;            // no 2d context (headless / ancient browser)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

const COL = {
  gem: '#38e8a0', red: '#ff5d5d', gold: '#ffcf5c', accent: '#7c5cff',
  line: 'rgba(255,255,255,.07)', text: '#e6e9f2', muted: '#8a93a8',
  green: '#38e8a0', goldSeg: '#ffcf5c',
};

const numValue = (sel, fallback) => {
  const n = Number($(sel).value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

function applyQuick(inputSel, mode) {
  const input = $(inputSel);
  const you = state.you;
  const v = Number(input.value) || 0;
  if (mode === 'half') input.value = Math.max(25, Math.floor(v / 2));
  else if (mode === 'double') input.value = Math.max(25, Math.round(v * 2));
  else if (mode === 'max') input.value = Math.max(25, Math.floor(you.balance));
  else input.value = mode;
}

/* ==========================================================================
   CRASH
   ========================================================================== */

const crashFx = { roundId: 0, points: [], bustAt: null, bustSounded: false, cashSounded: false, raf: 0 };

function crashPoints() {
  const c = state.crash;
  if (!c) return crashFx.points;
  return crashFx.points;
}

function drawCrash() {
  const canvas = $('#crash-canvas');
  if (!canvas || !state.crash) return;
  const c = state.crash;
  const g2 = gfx(canvas);
  if (!g2) return;
  const { ctx, w, h } = g2;
  const padL = 40;
  const padB = 22;
  const padT = 14;
  const padR = 14;

  const pts = crashFx.points;
  const maxT = Math.max(7000, pts.length ? pts[pts.length - 1].t : 7000) * 1.05;
  let maxM = 2;
  pts.forEach((p) => { if (p.m > maxM) maxM = p.m; });
  const yScale = Math.log2(Math.max(3, maxM) * 1.15);

  const px = (t) => padL + (t / maxT) * (w - padL - padR);
  const py = (m) => h - padB - (Math.log2(Math.max(1, m)) / yScale) * (h - padT - padB);

  // grid + axis labels
  ctx.font = '10px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  [1, 2, 5, 10, 25, 50, 100, 150].forEach((m) => {
    const y = py(m);
    if (y < padT - 4 || y > h - padB) return;
    ctx.strokeStyle = COL.line;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    ctx.fillStyle = COL.muted;
    ctx.textAlign = 'right';
    ctx.fillText(m + 'x', padL - 6, y);
  });

  if (pts.length < 2) {
    ctx.fillStyle = COL.muted;
    ctx.textAlign = 'center';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(c.phase === 'betting' ? 'waiting for the round to start…' : 'climbing…', (w + padL) / 2, h / 2);
    return;
  }

  const dead = c.phase === 'crashed';
  const stroke = dead ? COL.red : COL.gem;

  // filled area under the curve
  const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
  grad.addColorStop(0, dead ? 'rgba(255,93,93,.35)' : 'rgba(56,232,160,.35)');
  grad.addColorStop(1, 'rgba(56,232,160,0)');
  ctx.beginPath();
  ctx.moveTo(px(pts[0].t), py(pts[0].m));
  pts.forEach((p) => ctx.lineTo(px(p.t), py(p.m)));
  ctx.lineTo(px(pts[pts.length - 1].t), h - padB);
  ctx.lineTo(px(pts[0].t), h - padB);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // the curve
  ctx.beginPath();
  ctx.moveTo(px(pts[0].t), py(pts[0].m));
  pts.forEach((p) => ctx.lineTo(px(p.t), py(p.m)));
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.shadowColor = dead ? 'rgba(255,93,93,.65)' : 'rgba(56,232,160,.6)';
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // leading dot
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(px(last.t), py(last.m), 4.5, 0, Math.PI * 2);
  ctx.fillStyle = stroke;
  ctx.fill();

  // crash marker
  if (dead) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255,93,93,.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(last.t), py(last.m));
    ctx.lineTo(px(last.t), h - padB);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function crashStatusText(c) {
  const left = Math.max(0, Math.ceil((c.phaseEndsAt - Date.now()) / 1000));
  const bet = state.you.crashBet;
  if (c.phase === 'betting') {
    return bet ? `bet placed · ${left}s to place more` : `betting open · ${left}s`;
  }
  if (c.phase === 'running') {
    if (bet && bet.cashedAt) return `cashed out at ${bet.cashedAt.toFixed(2)}×`;
    if (bet) return 'you are in — cash out any time';
    return 'in the air';
  }
  if (bet && bet.cashedAt) return `you cashed out at ${bet.cashedAt.toFixed(2)}×`;
  if (bet && bet.busted) return 'you busted';
  return 'round over';
}

/** What should the crash button do right now? Derived from live state so a
 *  stale render can never strand the player on "betting closed". */
function crashMode() {
  const c = state.crash;
  const bet = state.you ? state.you.crashBet : null;
  if (bet && bet.cashedAt) return 'done';
  if (bet && bet.busted) return 'done';
  if (bet && c && c.phase === 'running') return 'cashout';
  if (bet) return 'done';
  if (c && c.phase === 'betting' && Date.now() < c.phaseEndsAt + 250) return 'bet';
  return 'done';
}

function renderCrash() {
  const c = state.crash;
  if (!c) return;
  const now = Date.now();
  const live = c.phase === 'running' ? Math.pow(2, Math.max(0, now - c.roundStartAt) / c.growthMs) : null;
  const mult = c.phase === 'crashed' ? c.crashPoint : (live || c.mult || 1);
  const you = state.you;
  const bet = you.crashBet;

  const multEl = $('#crash-mult');
  multEl.textContent = (c.phase === 'crashed' ? (c.crashPoint || 1) : mult).toFixed(2) + '×';
  multEl.classList.toggle('dead', c.phase === 'crashed');
  $('#crash-status').textContent = crashStatusText(c);
  $('#crash-bet-summary').textContent = `${c.betCount} bets · 💎 ${fmt(c.totalStaked)} staked`;

  // history chips
  const hist = $('#crash-history');
  if (hist.dataset.sig !== String(c.history.length) + c.history[0]) {
    hist.dataset.sig = String(c.history.length) + c.history[0];
    hist.innerHTML = c.history.map((m) => `<span class="hist ${m >= 2 ? 'hot' : ''}">${Number(m).toFixed(2)}×</span>`).join('');
  }

  // progress
  let p = 0;
  if (c.phase === 'betting') p = 1 - Math.max(0, c.phaseEndsAt - now) / c.betMs;
  else if (c.phase === 'running') p = 1 - 1 / Math.max(1, mult);
  else p = 1;
  $('#crash-progress').style.width = Math.max(0, Math.min(100, p * 100)) + '%';

  // bust overlay
  const bust = $('#crash-bust');
  bust.classList.toggle('show', c.phase === 'crashed');
  bust.textContent = c.phase === 'crashed' ? `CRASHED ${Number(c.crashPoint || 1).toFixed(2)}×` : '';

  // bet list
  const list = $('#crash-bets');
  const sig = c.roundId + ':' + c.phase + ':' + c.bets.map((b) => `${b.name}${b.cashedAt || ''}${b.payout || ''}`).join(',');
  if (list.dataset.sig !== sig) {
    list.dataset.sig = sig;
    list.innerHTML = '';
    c.bets.slice().reverse().forEach((b) => {
      const cashed = !!b.cashedAt;
      const busted = c.phase === 'crashed' && !cashed;
      const li = el('li', 'bet-row' + (b.you ? ' you' : '') + (cashed ? ' win' : busted ? ' lose' : ''));
      li.innerHTML = `
        <span class="who">${avatarEl(b.hue, b.face, 22).outerHTML}${esc(b.name)}${b.isBot ? '<span class="bot-tag">BOT</span>' : b.you ? '<span class="you-tag">YOU</span>' : ''}</span>
        <span class="amt">💎 ${fmt(b.amount)}</span>
        <span class="state">${cashed ? `${Number(b.cashedAt).toFixed(2)}× · +💎 ${fmt(b.payout - b.amount)}` : busted ? 'busted' : '—'}</span>`;
      list.appendChild(li);
    });
  }

  // action button + potential
  const btn = $('#crash-action');
  const amount = numValue('#crash-amount', 500);
  const auto = Math.max(1.01, Number($('#crash-auto').value) || 2);
  if (bet && bet.cashedAt) {
    btn.disabled = true;
    btn.textContent = `Cashed out at ${Number(bet.cashedAt).toFixed(2)}×`;
    btn.dataset.mode = 'done';
  } else if (bet && bet.busted) {
    btn.disabled = true;
    btn.textContent = 'Busted — wait for the next round';
    btn.dataset.mode = 'done';
  } else if (bet && c.phase === 'running') {
    btn.disabled = false;
    btn.textContent = `Cash out 💎 ${fmt(Math.round(bet.amount * mult))}`;
    btn.dataset.mode = 'cashout';
  } else if (bet) {
    btn.disabled = true;
    btn.textContent = 'Bet placed — round starting…';
    btn.dataset.mode = 'done';
  } else if (c.phase === 'betting') {
    btn.disabled = amount > state.you.balance;
    btn.textContent = `Place bet 💎 ${fmt(amount)}`;
    btn.dataset.mode = 'bet';
  } else {
    btn.disabled = true;
    btn.textContent = 'Betting closed — next round';
    btn.dataset.mode = 'done';
  }
  $('#crash-potential').textContent = '💎 ' + fmt(bet && c.phase === 'running' ? Math.round(bet.amount * mult) : amount * auto);

  drawCrash();
}

function crashSound(c) {
  const you = state.you;
  const bet = you.crashBet;
  if (c.phase === 'running' && bet && !bet.cashedAt && !bet.busted) audio.tick();
  if (c.phase === 'crashed' && !crashFx.bustSounded) {
    crashFx.bustSounded = true;
    // exactly one sound per round, and only if this player was riding it
    if (bet && !bet.cashedAt) audio.lose();
  }
  if (bet && bet.cashedAt && !crashFx.cashSounded) {
    crashFx.cashSounded = true;
    audio.win();
    toast(`Cashed out at ${Number(bet.cashedAt).toFixed(2)}× → 💎 ${fmt(Math.round(bet.amount * bet.cashedAt))}`, 'good');
  }
}

function onCrashState(c) {
  if (!c) return;
  if (c.roundId !== crashFx.roundId) {
    crashFx.roundId = c.roundId;
    crashFx.points = [];
    crashFx.bustSounded = false;
    crashFx.cashSounded = false;
  }
  if (c.phase === 'running') {
    const m = Math.pow(2, Math.max(0, Date.now() - c.roundStartAt) / c.growthMs);
    crashFx.points.push({ t: Date.now() - c.roundStartAt, m });
  } else if (c.phase === 'crashed' && crashFx.points.length) {
    const last = crashFx.points[crashFx.points.length - 1];
    if (Number(last.m).toFixed(2) !== Number(c.crashPoint).toFixed(2)) {
      crashFx.points.push({ t: c.phaseEndsAt - c.betMs - c.growthMs + c.growthMs, m: c.crashPoint });
    }
  }
  crashSound(c);
  if (state.view === 'crash') renderCrash();
}

$('#crash-action').addEventListener('click', async () => {
  const mode = crashMode();
  try {
    if (mode === 'bet') {
      const res = await api('crash/bet', { amount: numValue('#crash-amount', 500), auto: Number($('#crash-auto').value) || 2 });
      audio.bet();
      applyYou(res.you, { flash: true });
      renderCrash();
    } else if (mode === 'cashout') {
      const res = await api('crash/cashout', {});
      audio.win();
      toast(`Cashed out at ${Number(res.mult).toFixed(2)}× → 💎 ${fmt(res.payout)}`, 'good');
      applyYou(res.you, { flash: true });
      renderCrash();
    }
  } catch (err) { toast(err.message, 'err'); }
});

$$('#view-crash [data-crash-amt]').forEach((b) => b.addEventListener('click', () => {
  applyQuick('#crash-amount', b.dataset.crashAmt);
  renderCrash();
}));
['#crash-amount', '#crash-auto'].forEach((s) => $(s).addEventListener('input', renderCrash));

/* ==========================================================================
   DOUBLE
   ========================================================================== */

const doubleFx = { rot: 0, spinRound: 0, from: 0, to: 0, raf: 0, preBet: null, settled: 0, last: null };
const doubleCfg = { color: 'green' };

function wheelRotation(c) {
  const step = (Math.PI * 2) / c.segments.length;
  if (c.phase === 'spinning' && c.winningIndex != null) {
    if (doubleFx.spinRound !== c.roundId) {
      doubleFx.spinRound = c.roundId;
      doubleFx.from = doubleFx.rot;
      const jitter = (Math.random() - 0.5) * step * 0.55;
      const target = -(c.winningIndex + 0.5) * step + jitter;
      const twoPi = Math.PI * 2;
      const delta = (((target - doubleFx.from) % twoPi) + twoPi) % twoPi + twoPi * 4;
      doubleFx.to = doubleFx.from + delta;
    }
    const start = c.phaseEndsAt - c.spinMs;
    const p = Math.max(0, Math.min(1, (Date.now() - start) / c.spinMs));
    const e = 1 - Math.pow(1 - p, 3);
    const rot = doubleFx.from + (doubleFx.to - doubleFx.from) * e;
    if (p >= 1) doubleFx.rot = doubleFx.to;
    return rot;
  }
  return doubleFx.rot;
}

function drawWheel() {
  const canvas = $('#double-canvas');
  if (!canvas || !state.double) return;
  const c = state.double;
  const g2 = gfx(canvas);
  if (!g2) return;
  const { ctx, w, h } = g2;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2 - 6;
  const step = (Math.PI * 2) / c.segments.length;
  const rot = wheelRotation(c);
  const fills = { green: COL.green, red: COL.red, gold: COL.goldSeg };

  for (let i = 0; i < c.segments.length; i++) {
    const a0 = -Math.PI / 2 + rot + i * step;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a0, a0 + step);
    ctx.closePath();
    ctx.fillStyle = fills[c.segments[i]] || COL.muted;
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,12,18,.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // hub
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0e16';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.stroke();
  ctx.fillStyle = COL.text;
  ctx.font = `700 ${Math.round(R * 0.12)}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const showResult = c.phase !== 'spinning' && (c.result || (doubleFx.last && doubleFx.last.result));
  const label = c.result || (doubleFx.last && doubleFx.last.result) || null;
  ctx.fillText(showResult && label ? String(label).toUpperCase() : 'DOUBLE', cx, cy - R * 0.05);
  if (showResult && label) {
    ctx.fillStyle = COL.gold;
    ctx.font = `700 ${Math.round(R * 0.1)}px ui-monospace, monospace`;
    ctx.fillText(`${c.payouts[label]}×`, cx, cy + R * 0.09);
  }
}

function renderDouble() {
  const c = state.double;
  if (!c) return;
  const now = Date.now();
  const you = state.you;
  const bet = you.doubleBet;
  drawWheel();

  if (c.phase === 'betting') {
    const left = Math.max(0, Math.ceil((c.phaseEndsAt - now) / 1000));
    const last = doubleFx.last;
    if (last && last.pre) {
      const won = last.pre.color === last.result;
      $('#double-result').innerHTML = `${String(last.result).toUpperCase()} hit — ${c.payouts[last.result]}× · ` +
        (won
          ? `<span style="color:${COL.gem}">you won 💎 ${fmt(Math.round(last.pre.amount * c.payouts[last.result]))}</span>`
          : `<span style="color:${COL.red}">you lost 💎 ${fmt(last.pre.amount)}</span>`);
    } else if (last) {
      $('#double-result').textContent = `${String(last.result).toUpperCase()} hit — ${c.payouts[last.result]}× payout`;
    } else {
      $('#double-result').textContent = 'Place a bet before the wheel stops taking entries.';
    }
    $('#double-timer').textContent = `spins in ${left}s`;
    $('#double-progress').style.width = (100 - (left / (c.betMs / 1000)) * 100) + '%';
  } else {
    $('#double-result').textContent = 'Spinning…';
    $('#double-timer').textContent = 'no more entries this spin';
    const p = 1 - Math.max(0, c.phaseEndsAt - now) / c.spinMs;
    $('#double-progress').style.width = Math.max(0, Math.min(100, p * 100)) + '%';
  }

  // history chips
  const hist = $('#double-history');
  const sig = c.history.map((x) => x.index).join(',');
  if (hist.dataset.sig !== sig) {
    hist.dataset.sig = sig;
    hist.innerHTML = c.history.map((x) => `<span class="dh ${x.result}" title="pot 💎 ${fmt(x.pot)}">${x.result === 'gold' ? 'GOLD 8×' : x.result.toUpperCase()}</span>`).join('');
  }

  // bet list
  const list = $('#double-bets');
  const bsig = c.betters.map((b) => `${b.name}${b.color}${b.amount}`).join(',');
  if (list.dataset.sig !== bsig) {
    list.dataset.sig = bsig;
    list.innerHTML = '';
    c.betters.slice().reverse().forEach((b) => {
      const li = el('li', 'bet-row' + (b.you ? ' you' : ''));
      li.innerHTML = `
        <span class="who">${avatarEl(b.hue, b.face, 22).outerHTML}${esc(b.name)}${b.isBot ? '<span class="bot-tag">BOT</span>' : b.you ? '<span class="you-tag">YOU</span>' : ''}</span>
        <span class="amt" style="color:${b.color === 'green' ? COL.green : b.color === 'red' ? COL.red : COL.gold}">${String(b.color).toUpperCase()}</span>
        <span class="state">💎 ${fmt(b.amount)}</span>`;
      list.appendChild(li);
    });
  }
  $('#double-total').textContent = `${c.betters.length} bets · 💎 ${fmt(c.totalStaked)}`;

  const btn = $('#double-bet');
  if (bet) {
    btn.disabled = true;
    btn.textContent = `Bet placed: ${String(bet.color).toUpperCase()} · 💎 ${fmt(bet.amount)}`;
  } else if (c.phase === 'spinning') {
    btn.disabled = true;
    btn.textContent = 'Spinning — wait for the next round';
  } else {
    btn.disabled = false;
    btn.textContent = `Bet on ${doubleCfg.color[0].toUpperCase() + doubleCfg.color.slice(1)}`;
  }
}

/**
 * The server flips straight back to "betting" and clears .result when a spin
 * ends, so the wheel's own timeline is what decides when this player's bet
 * settles — exactly one cheer or groan per spin, no repeats on later polls.
 */
function doubleSounds(c) {
  if (c.phase !== 'spinning' || c.winningIndex == null) return;
  if (doubleFx.spinRound === c.roundId) return;
  doubleFx.spinRound = c.roundId;
  doubleFx.preBet = state.you.doubleBet ? { ...state.you.doubleBet } : null;
  const round = c.roundId;
  const result = c.result;
  setTimeout(() => settleDoubleSpin(round, result), Math.max(0, c.phaseEndsAt - Date.now()) + 160);
}

function settleDoubleSpin(round, result) {
  if (doubleFx.settled === round || !result) return;
  doubleFx.settled = round;
  const pre = doubleFx.preBet;
  doubleFx.preBet = null;
  doubleFx.last = { result, pre, at: Date.now() };
  if (!pre) return;
  const mult = (state.cfg && state.cfg.double ? state.cfg.double.payouts[result] : null) || 2;
  if (pre.color === result) {
    audio.big();
    toast(`${String(result).toUpperCase()} — 💎 ${fmt(Math.round(pre.amount * mult))} paid on your 💎 ${fmt(pre.amount)}`, 'gold');
  } else {
    audio.lose();
    toast(`${String(result).toUpperCase()} — your 💎 ${fmt(pre.amount)} is gone.`, 'err');
  }
}

function onDoubleState(c) {
  if (!c) return;
  doubleSounds(c);
  if (state.view !== 'double') return;
  renderDouble();
  if (c.phase === 'spinning') {
    cancelAnimationFrame(doubleFx.raf);
    const loop = () => {
      drawWheel();
      const now = Date.now();
      if (state.view === 'double' && state.double && state.double.phase === 'spinning' && now < state.double.phaseEndsAt + 200) {
        doubleFx.raf = requestAnimationFrame(loop);
      } else {
        doubleFx.raf = 0;
        renderDouble();
      }
    };
    if (!reduceMotion && !doubleFx.raf) doubleFx.raf = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(doubleFx.raf);
    doubleFx.raf = 0;
  }
}

$$('#double-color button').forEach((b) => b.addEventListener('click', () => {
  $$('#double-color button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  doubleCfg.color = b.dataset.color;
  renderDouble();
}));
$$('#view-double [data-double-amt]').forEach((b) => b.addEventListener('click', () => {
  applyQuick('#double-amount', b.dataset.doubleAmt);
}));
$('#double-bet').addEventListener('click', async () => {
  try {
    const res = await api('double/bet', { color: doubleCfg.color, amount: numValue('#double-amount', 500) });
    audio.bet();
    applyYou(res.you, { flash: true });
    renderDouble();
  } catch (err) { toast(err.message, 'err'); }
});

/* ==========================================================================
   UPGRADER
   ========================================================================== */

const upFx = { spinning: false, angle: 0, winFrom: 0, winTo: 0 };

const upChance = (target) => Math.min(0.99, Math.max(0.005, (1 / target) * 0.96));

function drawUpArc() {
  const canvas = $('#up-canvas');
  if (!canvas) return;
  const g2 = gfx(canvas);
  if (!g2) return;
  const { ctx, w, h } = g2;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2 - 10;
  const target = Math.max(1.05, Number($('#up-target').value) || 4);
  const chance = upChance(target);

  // full ring: green = win slice, red = the rest
  ctx.lineWidth = R * 0.16;
  ctx.strokeStyle = 'rgba(255,93,93,.5)';
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.88, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = COL.gem;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.88, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chance);
  ctx.stroke();

  // tick marks
  for (let i = 0; i < 60; i++) {
    const a = -Math.PI / 2 + (i / 60) * Math.PI * 2;
    const r0 = R * 0.72;
    const r1 = R * (i % 5 === 0 ? 0.64 : 0.68);
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }

  // needle: at rest points at the top, spins while upgrading
  const a = -Math.PI / 2 + upFx.angle;
  ctx.strokeStyle = COL.accent;
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(124,92,255,.8)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0e16';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.stroke();
}

function renderUpgrader() {
  const target = Math.max(1.05, Number($('#up-target').value) || 4);
  const chance = upChance(target);
  const mode = $('#up-mode button.active').dataset.mode;
  const stake = mode === 'gems'
    ? numValue('#up-amount', 1000)
    : (() => {
      const opt = $('#up-skin').selectedOptions && $('#up-skin').selectedOptions[0];
      return opt ? Number(opt.dataset.value) || 0 : 0;
    })();
  const payout = Math.round(stake * target);
  $('#up-chance').textContent = (chance * 100).toFixed(chance * 100 < 1 ? 2 : 1) + '%';
  $('#up-sub').textContent = `chance to win ${target.toFixed(2)}×`;
  $('#up-math').textContent = mode === 'gems'
    ? `stake 💎 ${fmt(stake)} × ${target.toFixed(2)} = 💎 ${fmt(payout)} · win chance ${(chance * 100).toFixed(2)}% · house edge 4%`
    : `skin worth 💎 ${fmt(stake)} × ${target.toFixed(2)} = 💎 ${fmt(payout)} + a skin near that value · win chance ${(chance * 100).toFixed(2)}%`;
  $('#up-spin').disabled = upFx.spinning || stake <= 0;
  drawUpArc();
}

function fillUpSkins() {
  const sel = $('#up-skin');
  if (!sel || !state.you) return;
  const items = state.you.inventory.slice().sort((a, b) => b.value - a.value).slice(0, 60);
  const sig = items.map((i) => i.uid + i.value).join(',');
  if (sel.dataset.sig === sig) return;
  sel.dataset.sig = sig;
  const keep = sel.value;
  sel.innerHTML = '';
  if (!items.length) {
    sel.appendChild(new Option('— inventory empty —', ''));
    return;
  }
  items.forEach((i) => {
    const o = new Option(`${i.name} · ${i.wearShort} · 💎 ${fmt(i.value)}`, i.uid);
    o.dataset.value = i.value;
    sel.appendChild(o);
  });
  if (keep && items.some((i) => i.uid === keep)) sel.value = keep;
}

$$('#up-mode button').forEach((b) => b.addEventListener('click', () => {
  $$('#up-mode button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  const skin = b.dataset.mode === 'skin';
  $('#up-gems-field').hidden = skin;
  $('#up-skin-field').hidden = !skin;
  renderUpgrader();
}));
$$('#up-quick button').forEach((b) => b.addEventListener('click', () => {
  $('#up-target').value = b.dataset.up;
  renderUpgrader();
}));
['#up-target', '#up-amount'].forEach((s) => $(s).addEventListener('input', renderUpgrader));
$('#up-skin').addEventListener('change', renderUpgrader);

$('#up-spin').addEventListener('click', async () => {
  if (upFx.spinning) return;
  const target = Math.max(1.05, Number($('#up-target').value) || 4);
  const mode = $('#up-mode button.active').dataset.mode;
  const body = { target };
  if (mode === 'skin') {
    body.uid = $('#up-skin').value;
    if (!body.uid) return toast('Stake a skin first — the inventory is empty.', 'err');
  } else {
    body.amount = numValue('#up-amount', 1000);
  }
  upFx.spinning = true;
  $('#up-spin').disabled = true;
  $('#up-result').textContent = 'Upgrading…';

  let res;
  try {
    res = await api('upgrader/spin', body);
  } catch (err) {
    upFx.spinning = false;
    $('#up-result').textContent = '';
    renderUpgrader();
    return toast(err.message, 'err');
  }
  applyYou(res.you, { flash: true });

  const chance = res.result.chance;
  const TAU = Math.PI * 2;
  const winArc = TAU * chance;
  // the green arc runs clockwise from the top; park the needle inside the arc
  // it actually belongs to, so the animation never lies about the result
  const rest = res.result.win
    ? winArc * (0.1 + Math.random() * 0.75)
    : winArc + (TAU - winArc) * (0.15 + Math.random() * 0.7);
  const from = upFx.angle;
  const duration = reduceMotion ? 180 : 1700;
  const delta = reduceMotion ? 0 : ((((rest - from) % TAU) + TAU) % TAU) + TAU * 3;
  const to = from + delta;
  const t0 = performance.now();

  const step = () => {
    const p = Math.min(1, (performance.now() - t0) / duration);
    const e = 1 - Math.pow(1 - p, 3);
    upFx.angle = from + (to - from) * e;
    drawUpArc();
    if (p < 1) return requestAnimationFrame(step);
    upFx.spinning = false;
    if (res.result.win) {
      $('#up-result').innerHTML = `<span style="color:${COL.gem}">UPGRADED — 💎 ${fmt(res.result.payout)} (+ a skin near 💎 ${fmt(res.result.payout * 0.6)})</span>`;
      audio.big();
      toast(`Upgrade landed: 💎 ${fmt(res.result.payout)} for 💎 ${fmt(res.result.stakeValue)}`, 'gold');
    } else {
      $('#up-result').innerHTML = `<span style="color:${COL.red}">BUSTED — 💎 ${fmt(res.result.stakeValue)} gone</span>`;
      audio.lose();
    }
    upFx.angle = ((to % TAU) + TAU) % TAU;
    renderUpgrader();
  };
  requestAnimationFrame(step);
});

/* ==========================================================================
   MINES
   ========================================================================== */

const minesFx = { busy: false, mineCount: 3 };

function renderMines() {
  const board = $('#mines-board');
  if (!board) return;
  const you = state.you;
  const m = you.mines;
  const active = !!(m && m.active);

  // 25 tiles
  const sig = JSON.stringify([
    active, m ? m.bet : 0, m ? m.mineCount : 0,
    m ? m.revealed : [], m ? m.mines : [],
  ]);
  if (board.dataset.sig !== sig) {
    board.dataset.sig = sig;
    board.innerHTML = '';
    for (let i = 0; i < 25; i++) {
      const t = el('button', 'tile');
      const revealed = m && m.revealed.includes(i);
      const isMine = m && !active && m.mines.length && m.mines.includes(i);
      if (revealed) { t.classList.add('gem'); t.textContent = '💎'; t.disabled = true; }
      else if (isMine) { t.classList.add('mine'); t.textContent = '💥'; t.disabled = true; }
      else if (active) {
        t.textContent = '';
        t.disabled = false;
        t.addEventListener('click', () => pickMine(i));
      } else {
        t.disabled = true;
        t.textContent = '';
      }
      board.appendChild(t);
    }
  }

  $('#mines-found').textContent = m ? m.revealed.length : 0;
  $('#mines-mult').textContent = (m && active ? m.curMult : 0).toFixed(2) + '×';
  $('#mines-next').textContent = (m && active ? m.nextMult : 0).toFixed(2) + '×';
  $('#mines-odds').textContent = `${m && m.mineCount ? m.mineCount : minesFx.mineCount} mines · 25 tiles`;
  $('#mines-start').disabled = active || minesFx.busy;
  $('#mines-start').textContent = active ? 'Round in progress' : 'Start round';
  const canCash = active && m.revealed.length > 0;
  $('#mines-cashout').disabled = !canCash || minesFx.busy;
  $('#mines-payout').textContent = fmt(canCash ? Math.round(m.bet * m.curMult) : 0);
  $$('#mines-count button').forEach((b) => { b.disabled = active; });
}

async function pickMine(tile) {
  if (minesFx.busy) return;
  minesFx.busy = true;
  try {
    const res = await api('mines/pick', { tile });
    applyYou(res.you);
    if (res.result.bom) {
      $('#mines-board').dataset.sig = '';
      renderMines();
      audio.lose();
      toast(`Mine on tile ${tile + 1}. 💎 ${fmt(res.result.bet)} gone.`, 'err');
    } else if (res.result.cleared) {
      audio.big();
      toast(`Cleared the board: 💎 ${fmt(res.result.payout)} at ${res.result.mult.toFixed(2)}×`, 'gold');
    } else {
      audio.chip();
    }
  } catch (err) { toast(err.message, 'err'); }
  finally {
    minesFx.busy = false;
    $('#mines-board').dataset.sig = '';
    renderMines();
  }
}

$$('#mines-count button').forEach((b) => b.addEventListener('click', () => {
  $$('#mines-count button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  minesFx.mineCount = Number(b.dataset.mines);
  renderMines();
}));

$('#mines-start').addEventListener('click', async () => {
  if (minesFx.busy) return;
  minesFx.busy = true;
  try {
    const res = await api('mines/start', { bet: numValue('#mines-bet', 500), mines: minesFx.mineCount });
    audio.bet();
    applyYou(res.you, { flash: true });
  } catch (err) { toast(err.message, 'err'); }
  finally {
    minesFx.busy = false;
    $('#mines-board').dataset.sig = '';
    renderMines();
  }
});

$('#mines-cashout').addEventListener('click', async () => {
  if (minesFx.busy) return;
  minesFx.busy = true;
  try {
    const res = await api('mines/cashout', {});
    audio.win();
    toast(`Cashed out ${res.mult.toFixed(2)}× → 💎 ${fmt(res.payout)}`, 'good');
    applyYou(res.you, { flash: true });
  } catch (err) { toast(err.message, 'err'); }
  finally {
    minesFx.busy = false;
    $('#mines-board').dataset.sig = '';
    renderMines();
  }
});

/* ==========================================================================
   PLINKO
   ========================================================================== */

const plinkoCfg = { rows: 12, risk: 'medium', anim: null };

const plinkoTable = () => (state.cfg.plinko[String(plinkoCfg.rows)] || state.cfg.plinko[12])[plinkoCfg.risk];

function plinkoGeometry(w, h, rows) {
  const top = h * 0.1;
  const bottom = h * 0.72;
  const rowGap = (bottom - top) / rows;
  const gap = (w - 24) / (rows + 1);      // peg spacing == slot width
  return {
    top, rowGap, gap, cx: w / 2,
    pegY: (row) => top + row * rowGap,
    // peg (row r has r+1 pegs) and slot (row+1 slots) share one coordinate system
    pegX: (row, i) => w / 2 + (i - row / 2) * gap,
    slotCenter: (slot) => w / 2 + (slot - rows / 2) * gap,
    slotY: bottom + rowGap * 0.55,
    slotH: Math.max(16, rowGap * 0.85),
  };
}

function drawPlinko() {
  const canvas = $('#plinko-canvas');
  if (!canvas || !state.cfg) return;
  const g2 = gfx(canvas);
  if (!g2) return;
  const { ctx, w, h } = g2;
  const rows = plinkoCfg.rows;
  const table = plinkoTable();
  const g = plinkoGeometry(w, h, rows);

  // pegs
  for (let r = 0; r < rows; r++) {
    const y = g.pegY(r);
    for (let i = 0; i <= r; i++) {
      ctx.beginPath();
      ctx.arc(g.pegX(r, i), y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fill();
    }
  }

  // slots
  for (let s = 0; s <= rows; s++) {
    const mult = table[s];
    const cool = mult < 1;
    const bw = g.gap - 5;
    const bx = g.slotCenter(s) - bw / 2;
    const radius = 5;
    ctx.beginPath();
    ctx.moveTo(bx + radius, g.slotY);
    ctx.arcTo(bx + bw, g.slotY, bx + bw, g.slotY + g.slotH, radius);
    ctx.arcTo(bx + bw, g.slotY + g.slotH, bx, g.slotY + g.slotH, radius);
    ctx.arcTo(bx, g.slotY + g.slotH, bx, g.slotY, radius);
    ctx.arcTo(bx, g.slotY, bx + bw, g.slotY, radius);
    ctx.closePath();
    ctx.fillStyle = mult >= 8 ? 'rgba(255,207,92,.22)' : cool ? 'rgba(255,93,93,.16)' : 'rgba(56,232,160,.16)';
    ctx.fill();
    ctx.strokeStyle = mult >= 8 ? 'rgba(255,207,92,.6)' : cool ? 'rgba(255,93,93,.45)' : 'rgba(56,232,160,.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (g.gap > 26) {
      ctx.fillStyle = mult >= 8 ? COL.gold : cool ? '#ffb3b3' : '#9ff5cd';
      ctx.font = `700 ${rows > 12 ? 8 : 9}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${mult}×`, g.slotCenter(s), g.slotY + g.slotH / 2);
    }
  }

  // the ball, walking the actual path the server rolled
  if (plinkoCfg.anim) {
    const { path, t } = plinkoCfg.anim;
    const p = Math.max(0, Math.min(1, t / rows));
    const lvf = p * rows;
    const lv = Math.min(rows - 1, Math.floor(lvf));
    const frac = Math.max(0, Math.min(1, lvf - lv));
    let sum = 0;
    for (let i = 0; i < lv; i++) sum += path[i];
    const x0 = g.pegX(lv, sum);
    const x1 = g.pegX(lv + 1, sum + path[lv]);
    const x = x0 + (x1 - x0) * frac;
    const y = g.top + lvf * g.rowGap;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = COL.gold;
    ctx.shadowColor = 'rgba(255,207,92,.85)';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function renderPlinkoTable() {
  const box = $('#plinko-table');
  if (!box) return;
  const table = plinkoTable();
  const landing = plinkoCfg.anim && plinkoCfg.anim.done ? plinkoCfg.anim.slot : -1;
  box.innerHTML = table.map((m, i) => `<span class="plinko-slot ${i === landing ? 'hi' : m >= 8 ? 'hi' : m < 1 ? 'lo' : ''}" data-slot="${i}">${m}×</span>`).join('');
}

function renderPlinko() {
  drawPlinko();
  renderPlinkoTable();
}

$$('#plinko-risk button').forEach((b) => b.addEventListener('click', () => {
  $$('#plinko-risk button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  plinkoCfg.risk = b.dataset.risk;
  renderPlinko();
}));
$$('#plinko-rows button').forEach((b) => b.addEventListener('click', () => {
  $$('#plinko-rows button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  plinkoCfg.rows = Number(b.dataset.rows);
  plinkoCfg.anim = null;
  renderPlinko();
}));
$$('#view-plinko [data-plinko-amt]').forEach((b) => b.addEventListener('click', () => applyQuick('#plinko-amount', b.dataset.plinkoAmt)));

$('#plinko-drop').addEventListener('click', async () => {
  const btn = $('#plinko-drop');
  if (btn.disabled) return;
  btn.disabled = true;
  let res;
  try {
    res = await api('plinko/drop', { rows: plinkoCfg.rows, risk: plinkoCfg.risk, amount: numValue('#plinko-amount', 500) });
  } catch (err) {
    btn.disabled = false;
    return toast(err.message, 'err');
  }
  applyYou(res.you, { flash: true });
  const speed = reduceMotion ? 0.3 : 1;
  plinkoCfg.anim = { path: res.result.path, t: 0, slot: res.result.slot, done: false };
  audio.bet();

  const t0 = performance.now();
  const total = 1100 * speed;
  const step = () => {
    const p = Math.min(1, (performance.now() - t0) / total);
    plinkoCfg.anim.t = p * plinkoCfg.rows;
    drawPlinko();
    if (p < 1) return requestAnimationFrame(step);
    plinkoCfg.anim.done = true;
    renderPlinkoTable();
    drawPlinko();
    btn.disabled = false;
    const r = res.result;
    if (r.mult >= 1) {
      audio.win();
      toast(`Landed ${r.mult}× → 💎 ${fmt(r.payout)} (stake 💎 ${fmt(numValue('#plinko-amount', 500))})`, r.mult >= 8 ? 'gold' : 'good');
    } else {
      audio.lose();
      toast(`Landed ${r.mult}× → 💎 ${fmt(r.payout)} back.`, 'err');
    }
  };
  requestAnimationFrame(step);
});

/* ==========================================================================
   TILES
   ========================================================================== */

const tilesFx = { busy: false };

function renderTiles() {
  const board = $('#tiles-board');
  const ladder = $('#tiles-ladder');
  if (!board || !state.cfg) return;
  const t = state.you.tiles;
  const active = !!(t && t.active);
  const curRow = t ? t.row : 0;             // rows completed
  const picks = t ? t.picks : [];

  const sig = JSON.stringify([active, curRow, picks, t ? t.cursed : [], t ? t.bet : 0]);
  if (board.dataset.sig !== sig) {
    board.dataset.sig = sig;
    board.innerHTML = '';
    // rows are drawn top row first so climbing goes up the screen
    for (let r = 5; r >= 1; r--) {
      const cfgRow = state.cfg.tiles[r - 1];
      for (let c = 0; c < cfgRow.of; c++) {
        const cell = el('button', 'tile');
        const picked = picks[r - 1] === c;
        const past = curRow >= r;
        const isLive = active && r === curRow + 1;
        const revealedCursed = t && !active && t.cursed && t.cursed[r - 1] && t.cursed[r - 1].includes(c);
        if (past) { cell.classList.add('done'); if (picked) { cell.classList.add('gem'); cell.textContent = '💎'; } }
        else if (revealedCursed) { cell.classList.add('cursed'); cell.textContent = '☠️'; }
        else if (isLive) {
          cell.disabled = false;
          cell.addEventListener('click', () => pickTile(c));
        } else {
          cell.classList.add('locked');
          cell.disabled = true;
        }
        if (past || revealedCursed || !isLive) cell.disabled = true;
        board.appendChild(cell);
      }
    }
  }

  if (ladder) {
    ladder.innerHTML = state.cfg.tiles.map((r, i) => {
      const done = curRow > i;
      const live = active && curRow === i;
      return `<div class="ladder-row ${done ? 'done' : live ? 'live' : ''}">
        <span>row ${r.row}</span>
        <span class="lr-curse">${r.cursed} cursed of ${r.of}</span>
        <span>${r.mult.toFixed(2)}×</span>
      </div>`;
    }).join('');
  }

  $('#tiles-odds').textContent = active
    ? `row ${curRow + 1} · ${state.cfg.tiles[curRow].cursed} cursed of 5`
    : 'pick a row, cash out any time';
  $('#tiles-start').disabled = active || tilesFx.busy;
  $('#tiles-start').textContent = active ? 'Run in progress' : 'Start run';
  const canCash = active && curRow > 0;
  $('#tiles-cashout').disabled = !canCash || tilesFx.busy;
  $('#tiles-payout').textContent = fmt(canCash ? Math.round(t.bet * t.curMult) : 0);
}

async function pickTile(col) {
  if (tilesFx.busy) return;
  tilesFx.busy = true;
  try {
    const res = await api('tiles/pick', { tile: col });
    applyYou(res.you);
    if (res.result.dead) {
      audio.lose();
      toast(`Cursed tile in row ${res.result.row}. 💎 ${fmt(state.you.tiles.bet)} gone.`, 'err');
    } else if (res.result.complete) {
      audio.big();
      toast(`Top row cleared: 💎 ${fmt(res.result.payout)} at ${res.result.mult.toFixed(2)}×`, 'gold');
    } else {
      audio.chip();
    }
  } catch (err) { toast(err.message, 'err'); }
  finally {
    tilesFx.busy = false;
    $('#tiles-board').dataset.sig = '';
    renderTiles();
  }
}

$('#tiles-start').addEventListener('click', async () => {
  if (tilesFx.busy) return;
  tilesFx.busy = true;
  try {
    const res = await api('tiles/start', { bet: numValue('#tiles-bet', 500) });
    audio.bet();
    applyYou(res.you, { flash: true });
  } catch (err) { toast(err.message, 'err'); }
  finally {
    tilesFx.busy = false;
    $('#tiles-board').dataset.sig = '';
    renderTiles();
  }
});

$('#tiles-cashout').addEventListener('click', async () => {
  if (tilesFx.busy) return;
  tilesFx.busy = true;
  try {
    const res = await api('tiles/cashout', {});
    audio.win();
    toast(`Cashed out ${res.mult.toFixed(2)}× → 💎 ${fmt(res.payout)}`, 'good');
    applyYou(res.you, { flash: true });
  } catch (err) { toast(err.message, 'err'); }
  finally {
    tilesFx.busy = false;
    $('#tiles-board').dataset.sig = '';
    renderTiles();
  }
});

/* ==========================================================================
   CHAMPION
   ========================================================================== */

const champFx = { sounded: 0 };

function myChampionStake(c) {
  return c.contributors.filter((x) => x.you || (state.you && x.id === state.you.id))
    .reduce((s, x) => s + x.amount, 0);
}

function renderChampion() {
  const c = state.champion;
  if (!c) return;
  const now = Date.now();
  $('#champ-pot').textContent = '💎 ' + fmt(c.pot);
  const left = Math.max(0, Math.ceil((c.phaseEndsAt - now) / 1000));
  $('#champ-timer').textContent = c.phase === 'joining' ? `${left}s` : `${left}s`;
  const total = c.phase === 'joining' ? c.joinMs : c.drawMs;
  $('#champ-progress').style.width = Math.max(0, Math.min(100, (1 - Math.max(0, c.phaseEndsAt - now) / total) * 100)) + '%';

  const mine = myChampionStake(c);
  $('#champ-chance').textContent = mine > 0
    ? `your odds: ${(c.pot ? (mine / c.pot) * 100 : 0).toFixed(1)}% · you put in 💎 ${fmt(mine)}`
    : 'your odds: — (you are not in this pot)';
  $('#champ-entries').textContent = `${c.contributors.length} entries`;
  $('#champ-join').disabled = c.phase !== 'joining';

  const winner = $('#champ-winner');
  if (c.phase === 'draw') {
    winner.className = 'champ-winner';
    winner.textContent = c.pot > 0 ? 'Drawing…' : 'Empty pot — nothing to draw.';
  } else if (c.winner) {
    const isMe = c.winner.you || (state.you && c.winner.id === state.you.id);
    winner.className = 'champ-winner' + (isMe ? ' win' : '');
    winner.textContent = `🏆 ${c.winner.name} took 💎 ${fmt(c.winner.payout)} (${((c.winner.payout / Math.max(1, c.winner.amount))).toFixed(1)}× their entry)`;
    if (c.winner.roundId !== champFx.sounded) {
      // only celebrate once per draw
      champFx.sounded = c.winner.pot + ':' + c.winner.name;
    }
  } else {
    winner.className = 'champ-winner';
    winner.textContent = '';
  }

  const list = $('#champ-list');
  const sig = c.contributors.map((x) => x.name + x.amount).join(',') + c.roundId;
  if (list.dataset.sig !== sig) {
    list.dataset.sig = sig;
    list.innerHTML = '';
    c.contributors.slice().reverse().slice(0, 24).forEach((x) => {
      const share = c.pot ? (x.amount / c.pot) * 100 : 0;
      const li = el('li', 'bet-row' + (x.you ? ' you' : ''));
      li.innerHTML = `
        <span class="who">${avatarEl(x.hue, x.face, 22).outerHTML}${esc(x.name)}${x.isBot ? '<span class="bot-tag">BOT</span>' : x.you ? '<span class="you-tag">YOU</span>' : ''}</span>
        <span class="amt">💎 ${fmt(x.amount)}</span>
        <span class="state">${share.toFixed(1)}%</span>`;
      list.appendChild(li);
    });
  }

  const hist = $('#champ-history');
  const hsig = c.history.map((h) => h.round + h.name).join(',');
  if (hist.dataset.sig !== hsig) {
    hist.dataset.sig = hsig;
    hist.innerHTML = c.history.length ? '' : '<span class="muted tiny">No pots drawn yet.</span>';
    c.history.forEach((h) => {
      hist.appendChild(el('div', 'ch', `
        <span>#${h.round} · ${esc(h.name)}${h.isBot ? ' <span class="bot-tag">BOT</span>' : ''} · ${h.chances}% chance</span>
        <b>💎 ${short(h.payout)} / pot 💎 ${short(h.pot)}</b>`));
    });
  }
}

function championSounds(c) {
  if (c.phase !== 'draw' || !c.winner) return;
  const key = 'w' + c.roundId;
  if (champFx.sounded === key) return;
  champFx.sounded = key;
  const isMe = c.winner.you || (state.you && c.winner.id === state.you.id);
  if (isMe) {
    audio.big();
    toast(`🏆 You won the Champion pot: 💎 ${fmt(c.winner.payout)} (5% rake kept by the sim)`, 'gold');
  } else {
    toast(`🏆 ${c.winner.name} took the 💎 ${fmt(c.winner.pot)} pot.`, '');
  }
}

function onChampionState(c) {
  if (!c) return;
  championSounds(c);
  if (state.view === 'champion') renderChampion();
}

$('#champ-join').addEventListener('click', async () => {
  try {
    const res = await api('champion/join', { amount: Math.max(100, numValue('#champ-amount', 2000)) });
    audio.bet();
    applyYou(res.you, { flash: true });
    toast('You are in the pot. No tickets, no secrets — your share is your stake.', 'good');
  } catch (err) { toast(err.message, 'err'); }
});

/* ==========================================================================
   View plumbing + state refresh
   ========================================================================== */

const VIEW_RENDER = {
  crash: renderCrash,
  double: renderDouble,
  upgrader: renderUpgrader,
  mines: renderMines,
  plinko: renderPlinko,
  tiles: renderTiles,
  champion: renderChampion,
};

window.onViewChange = function (view) {
  const fn = VIEW_RENDER[view];
  if (!fn) return;
  if (view === 'upgrader') fillUpSkins();
  // the canvas boxes only have a size once the view is displayed
  requestAnimationFrame(fn);
};

window.onStateRefresh = function () {
  if (!state.cfg) return;
  const fn = VIEW_RENDER[state.view];
  if (state.view === 'upgrader') { fillUpSkins(); }
  if (fn) fn();
};

window.addEventListener('resize', () => {
  const fn = VIEW_RENDER[state.view];
  if (fn) fn();
});

/* chain onto core's profile renderer instead of replacing it */
const coreOnProfile = window.onProfile;
window.onProfile = function () {
  if (coreOnProfile) coreOnProfile();
  fillUpSkins();
};

window.initGames = function () {
  // draw the boards once the boxes exist
  renderMines();
  renderTiles();
  renderChampion();
  fillUpSkins();
  if (state.crash) onCrashState(state.crash);
  if (state.double) onDoubleState(state.double);
  if (state.champion) onChampionState(state.champion);
};

/* small helpers reused by cases.js/inventory code */
window.gameHelpers = { applyQuick, numValue };
