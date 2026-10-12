/* ==========================================================================
   NEONROLL — games client
   crash · cases · battles · coinflip · mines
   All money is fake. All opponents are bots. There is no payment code.
   ========================================================================== */

let clockSkew = 0;                 // serverNow - clientNow
const serverNow = () => Date.now() + clockSkew;

/* ==========================================================================
   CRASH
   ========================================================================== */

const crashUI = {
  canvas: null,
  ctx: null,
  dpr: 1,
  path: [],
  startedAt: 0,
  busted: false,
  placing: false,
  lastTick: 0,
  lastReadout: 0,
  lastPhase: null,
};

function sizeCanvas() {
  const canvas = crashUI.canvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(320, rect.width * dpr);
  canvas.height = Math.max(180, rect.height * dpr);
  crashUI.dpr = dpr;
}

function multFromClock(c) {
  if (!c) return 1;
  if (c.phase === 'crashed') return c.crashPoint || 1;
  if (c.phase !== 'running') return 1;
  const elapsed = Math.max(0, serverNow() - c.roundStartAt);
  const local = Math.pow(2, elapsed / c.growthMs);
  // if the server's own reading is higher (latency hiccup), trust the server
  return Math.max(local, c.mult || 1);
}

function drawCrash(dt) {
  const canvas = crashUI.canvas;
  const ctx = crashUI.ctx;
  if (!canvas || !ctx) return;
  const W = canvas.width / crashUI.dpr;
  const H = canvas.height / crashUI.dpr;
  const c = state.crash || {};
  const pad = { l: 46, r: 16, t: 16, b: 26 };

  ctx.save();
  ctx.scale(crashUI.dpr, crashUI.dpr);
  ctx.clearRect(0, 0, W, H);

  const running = c.phase === 'running';
  const crashed = c.phase === 'crashed';
  const mult = running ? multFromClock(c) : (crashed ? (c.crashPoint || 1) : 1);
  const elapsed = running ? Math.max(1, serverNow() - c.roundStartAt) : (crashed ? Math.max(1, serverNow() - c.roundStartAt) : 1);

  // track the curve while running; clear it when a fresh betting phase starts
  if (running) {
    if (crashUI.startedAt !== c.roundStartAt) { crashUI.path = []; crashUI.startedAt = c.roundStartAt; }
    const last = crashUI.path[crashUI.path.length - 1];
    if (!last || mult - last.m > 0.004 || elapsed - last.t > 60) crashUI.path.push({ t: elapsed, m: mult });
    if (crashUI.path.length > 900) crashUI.path.shift();
  } else if (c.phase === 'betting' && crashUI.path.length) {
    crashUI.path = [];
    crashUI.startedAt = 0;
  }

  const yMax = Math.max(2, Math.max(mult, crashUI.path.reduce((s, p) => Math.max(s, p.m), 1)) * 1.12);
  const xMax = Math.max(6000, elapsed * 1.1);

  const px = (t) => pad.l + (Math.min(t, xMax) / xMax) * (W - pad.l - pad.r);
  const py = (m) => {
    const logMax = Math.log(yMax) / Math.log(2);
    const v = Math.log(Math.max(1, m)) / Math.log(2) / logMax;
    return H - pad.b - v * (H - pad.t - pad.b);
  };

  // grid + axis labels
  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  ctx.fillStyle = 'rgba(139,150,168,.75)';
  ctx.font = '10px ui-monospace, monospace';
  ctx.lineWidth = 1;
  const gridLevels = [1, 1.5, 2, 3, 5, 10, 20, 50, 100].filter((v) => v <= yMax);
  gridLevels.forEach((v) => {
    const y = py(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillText(v.toFixed(v < 10 ? 1 : 0) + 'x', 8, y + 3);
  });

  // curve
  const pts = running ? crashUI.path : crashUI.path;
  if (pts.length > 1) {
    const stroke = crashed ? '#ff4d4d' : '#37f5a0';
    const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
    grad.addColorStop(0, crashed ? 'rgba(255,77,77,.35)' : 'rgba(55,245,160,.35)');
    grad.addColorStop(1, 'rgba(55,245,160,0)');
    ctx.beginPath();
    ctx.moveTo(px(pts[0].t), py(1));
    pts.forEach((p) => ctx.lineTo(px(p.t), py(p.m)));
    ctx.lineTo(px(pts[pts.length - 1].t), py(1));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(px(p.t), py(p.m)) : ctx.moveTo(px(p.t), py(p.m))));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.shadowColor = stroke;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // head dot
    const head = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(px(head.t), py(head.m), 5, 0, Math.PI * 2);
    ctx.fillStyle = stroke;
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(139,150,168,.25)';
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(pad.l, py(1));
    ctx.lineTo(W - pad.r, py(1));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();

  /* ---- readouts (throttled: canvas runs at 60fps, text at ~11fps) ---- */
  const nowMs = Date.now();
  const phaseChanged = crashUI.lastPhase !== c.phase;
  if (!phaseChanged && nowMs - (crashUI.lastReadout || 0) < 90) return;
  crashUI.lastReadout = nowMs;
  crashUI.lastPhase = c.phase;

  const multEl = $('#crash-mult');
  const statusEl = $('#crash-status');
  if (running) {
    multEl.textContent = mult.toFixed(2) + 'x';
    multEl.classList.remove('dead');
    statusEl.textContent = `Round #${c.roundId} · climbing`;
    if (mult - crashUI.lastTick > 0.25) { crashUI.lastTick = mult; sfx.tick(); }
  } else if (crashed) {
    multEl.textContent = (c.crashPoint || 1).toFixed(2) + 'x';
    multEl.classList.add('dead');
    const left = Math.max(0, Math.ceil((c.phaseEndsAt - serverNow()) / 1000));
    statusEl.textContent = `Busted · next round in ${left}s`;
  } else {
    multEl.textContent = '1.00x';
    multEl.classList.remove('dead');
    const left = Math.max(0, ((c.phaseEndsAt || serverNow()) - serverNow()) / 1000);
    statusEl.textContent = `Betting open · ${left.toFixed(1)}s`;
  }

  // busted overlay
  const bust = $('#crash-bust');
  if (crashed) {
    bust.textContent = 'BUSTED @ ' + (c.crashPoint || 1).toFixed(2) + 'x';
    bust.classList.add('show');
  } else bust.classList.remove('show');

  // progress bar: betting countdown, then nothing while running
  const fill = $('#crash-progress');
  if (c.phase === 'betting') {
    const total = c.betMs || 6500;
    const left = Math.max(0, (c.phaseEndsAt || serverNow()) - serverNow());
    fill.style.width = (100 - (left / total) * 100) + '%';
  } else if (crashed) {
    const total = 4200;
    const left = Math.max(0, (c.phaseEndsAt || serverNow()) - serverNow());
    fill.style.width = (100 - (left / total) * 100) + '%';
  } else {
    const t = Math.min(1, elapsed / xMax);
    fill.style.width = (t * 100) + '%';
  }

  /* ---- action button ---- */
  renderCrashAction(mult, c);
}

function renderCrashAction(mult, c) {
  const btn = $('#crash-action');
  const mine = c.bets.find((b) => b.you);
  const bet = state.you && state.you.crashBet;
  const amountInput = $('#crash-amount');
  const autoInput = $('#crash-auto');

  $('#crash-potential').textContent = '🪙 ' + fmt(Math.round((Number(amountInput.value) || 0) * (Number(autoInput.value) || 1)));

  if (c.phase === 'betting') {
    if (bet) {
      const auto = Number(autoInput.value);
      btn.className = 'btn btn-primary big';
      btn.disabled = true;
      btn.textContent = `Bet placed: 🪙 ${fmt(bet.amount)} — round starting`
        + (auto > 1.01 ? ` (auto ${auto.toFixed(2)}x)` : '');
    } else {
      btn.className = 'btn btn-primary big';
      btn.disabled = false;
      btn.textContent = `Place bet 🪙 ${fmt(Number(amountInput.value) || 0)}`;
      btn.dataset.action = 'bet';
    }
  } else if (c.phase === 'running') {
    if (bet && !bet.cashedAt) {
      const payout = Math.round(bet.amount * mult);
      btn.className = 'btn cashout big';
      btn.disabled = false;
      btn.textContent = `Cash out ${mult.toFixed(2)}x → 🪙 ${fmt(payout)}`;
      btn.dataset.action = 'cashout';
    } else if (bet && bet.cashedAt) {
      btn.className = 'btn btn-ghost big';
      btn.disabled = true;
      btn.textContent = `Cashed out at ${bet.cashedAt.toFixed(2)}x`;
      delete btn.dataset.action;
    } else {
      btn.className = 'btn big';
      btn.disabled = true;
      btn.textContent = 'Round in progress — wait for the next one';
      delete btn.dataset.action;
    }
  } else if (c.phase === 'crashed') {
    const left = Math.max(0, Math.ceil((c.phaseEndsAt - serverNow()) / 1000));
    if (bet && bet.cashedAt) {
      btn.className = 'btn btn-ghost big';
      btn.disabled = true;
      btn.textContent = `You escaped at ${bet.cashedAt.toFixed(2)}x — nice`;
    } else if (bet) {
      btn.className = 'btn btn-bust big';
      btn.disabled = true;
      btn.textContent = `You busted at ${(c.crashPoint || 1).toFixed(2)}x`;
    } else {
      btn.className = 'btn big';
      btn.disabled = true;
      btn.textContent = `Next round in ${left}s`;
    }
  }

  // auto cash-out is enforced server-side at bet time (see crash/bet "auto")
  const auto = Number(autoInput.value);
  if (c.phase === 'running' && bet && !bet.cashedAt && auto > 1.01) {
    btn.textContent += ` · auto ${auto.toFixed(2)}x`;
  }
}

async function doCrashBet() {
  if (crashUI.placing) return;
  crashUI.placing = true;
  try {
    const amount = Math.floor(Number($('#crash-amount').value) || 0);
    const auto = Number($('#crash-auto').value);
    const res = await api('crash/bet', { amount, auto });
    sfx.bet();
    state.lastCrashAmount = amount;
    $('#crash-last').textContent = '🪙 ' + fmt(amount);
    applyYou(res.you);
    toast(auto > 1.01
      ? `Bet 🪙 ${fmt(amount)} placed — auto sell at ${auto.toFixed(2)}x (handled by the server).`
      : `Bet 🪙 ${fmt(amount)} placed. Cash out before it pops.`);
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    crashUI.placing = false;
  }
}

async function doCrashCashout() {
  if (crashUI.placing) return;
  crashUI.placing = true;
  try {
    const res = await api('crash/cashout', {});
    sfx.win();
    toast(`Cashed out at ${res.mult.toFixed(2)}x for 🪙 ${fmt(res.payout)}`, 'gold');
    applyYou(res.you, { flash: true });
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    crashUI.placing = false;
  }
}

function renderCrashBets(c) {
  const ul = $('#crash-bets');
  const bets = (c.bets || []).slice().sort((a, b) => (b.you ? 1 : 0) - (a.you ? 1 : 0) || b.amount - a.amount);
  $('#crash-bet-summary').textContent = `${bets.length} bets · 🪙 ${short(c.totalStaked || 0)}`;
  const sig = bets.map((b) => b.id + ':' + (b.cashedAt || 0) + ':' + b.payout).join('|');
  if (ul.dataset.sig === sig) return;
  ul.dataset.sig = sig;
  ul.innerHTML = '';
  bets.forEach((b) => {
    const li = el('li', 'bet-row' + (b.you ? ' you' : '') + (c.phase === 'crashed' && !b.cashedAt ? ' lost' : ''));
    const tag = b.you ? '<span class="you-tag">YOU</span>' : '<span class="bot-tag">BOT</span>';
    li.innerHTML = `
      <span class="who">${avatarEl(b.hue, b.face, 20).outerHTML}<b>${esc(b.name)}</b>${tag}</span>
      <span class="amt">🪙 ${short(b.amount)}</span>
      <span class="out">${b.cashedAt ? b.cashedAt.toFixed(2) + 'x · ' + short(b.payout) : (c.phase === 'crashed' ? 'busted' : '—')}</span>`;
    ul.appendChild(li);
  });
}

function renderCrashHistory(c) {
  const box = $('#crash-history');
  const sig = (c.history || []).join(',');
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = '';
  (c.history || []).forEach((h) => {
    const chip = el('span', 'hist' + (h >= 2 ? ' hot' : ''), h.toFixed(2) + 'x');
    box.appendChild(chip);
  });
}

window.onCrashState = function (c) {
  renderCrashHistory(c);
  renderCrashBets(c);
};

window.onCrashBets = function (c) { renderCrashBets(c); };

window.startCrashCanvas = function () {
  crashUI.canvas = $('#crash-canvas');
  crashUI.ctx = crashUI.canvas.getContext('2d');
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
  const loop = () => { try { drawCrash(); } catch (e) { console.error(e); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
};

$('#crash-action').addEventListener('click', () => {
  const action = $('#crash-action').dataset.action;
  if (action === 'bet') doCrashBet();
  else if (action === 'cashout') doCrashCashout();
});

$('#crash-repeat').addEventListener('click', () => {
  $('#crash-amount').value = state.lastCrashAmount || 100;
});

$$('[data-crash-amt]').forEach((btn) => btn.addEventListener('click', () => {
  const v = btn.dataset.crashAmt;
  const input = $('#crash-amount');
  const bal = state.you ? state.you.balance : 0;
  if (v === 'half') input.value = Math.max(10, Math.floor((Number(input.value) || 0) / 2));
  else if (v === 'double') input.value = Math.max(10, Math.floor((Number(input.value) || 0) * 2));
  else if (v === 'max') input.value = Math.max(10, Math.floor(bal));
  else input.value = v;
}));

$('#crash-auto').addEventListener('input', () => {
  const v = Number($('#crash-auto').value);
  state.crashAuto = v > 1;
});

/* ==========================================================================
   CASES
   ========================================================================== */

function oddsRows(caseDef, compact) {
  const wrap = el('div', 'case-odds');
  const rows = compact ? caseDef.drops.slice().reverse() : caseDef.drops;
  rows.forEach((d) => {
    const rar = state.cfg.rarities[d.rarity];
    const row = el('div', 'odd-row');
    const pct = d.chance * 100;
    row.innerHTML = `
      <span class="odd-dot" style="background:${rar.color}"></span>
      <span style="width:56px">${(pct >= 1 ? pct.toFixed(1) : pct.toFixed(2))}%</span>
      <span class="bar"><i style="width:${Math.min(100, Math.max(2, Math.log10(pct + 1) * 34))}%;background:${rar.color}"></i></span>
      <span>🪙 ${short(d.mult * caseDef.price)}</span>`;
    wrap.appendChild(row);
  });
  return wrap;
}

function buildCaseGrid() {
  const grid = $('#case-grid');
  grid.innerHTML = '';
  state.cfg.cases.forEach((c) => {
    const card = el('div', 'case-card');
    card.style.setProperty('--case-accent', c.accent);
    card.innerHTML = `
      <div class="case-art">📦</div>
      <div class="case-name"><h3>${esc(c.name)}</h3><span class="case-price">🪙 ${short(c.price)}</span></div>
      <div class="case-blurb">${esc(c.blurb)}</div>`;
    card.appendChild(oddsRows(c, true));
    const note = el('div', 'odds-note', `Average return ≈ ${Math.round(c.returnRate * 100)}% of price. That gap is the house edge, and it never sleeps.`);
    card.appendChild(note);
    const actions = el('div', 'case-actions');
    const openBtn = el('button', 'btn btn-primary', `Open 🪙 ${short(c.price)}`);
    const fiveBtn = el('button', 'btn btn-ghost', '×5');
    fiveBtn.title = `Open 5 cases for 🪙 ${fmt(c.price * 5)}`;
    openBtn.addEventListener('click', () => openCaseFlow(c, 1));
    fiveBtn.addEventListener('click', () => openCaseFlow(c, 5));
    actions.appendChild(openBtn);
    actions.appendChild(fiveBtn);
    card.appendChild(actions);
    grid.appendChild(card);
  });
}

function reelSkin(item) {
  const node = skinEl(item, { small: true });
  node.style.flex = '0 0 auto';
  node.style.width = '128px';
  return node;
}

async function openCaseFlow(caseDef, count) {
  if (state.you.balance < caseDef.price * count) {
    toast(`That costs 🪙 ${fmt(caseDef.price * count)} and you only have 🪙 ${fmt(state.you.balance)}. Claim a free drop — it's free, always.`, 'err');
    return;
  }

  /* --- build the modal with a rolling reel --- */
  const body = el('div');
  const win = el('div', 'roll-window');
  const track = el('div', 'roll-track');
  const pointer = el('div', 'roll-pointer');
  win.appendChild(track);
  win.appendChild(pointer);
  const banner = el('div', 'result-banner', 'Rolling…');
  const results = el('div', 'pull-result');
  body.appendChild(win);
  body.appendChild(banner);
  body.appendChild(results);
  modal.open(`${caseDef.name} — opening ${count > 1 ? count + '×' : '1×'}`, body, []);

  const filler = [];
  for (let i = 0; i < 46; i++) {
    const d = state.cfg.cases.find((x) => x.id === caseDef.id);
    const rar = weightedClientPick(d.drops);
    filler.push({
      id: 'f' + i, rarity: rar, weapon: '???', skin: 'Unknown',
      value: 0, seed: Math.floor(Math.random() * 9999),
    });
  }
  filler.forEach((f) => track.appendChild(reelSkin(f)));

  // ask the server to actually roll (server-authoritative, not "provably fair")
  let payload;
  try {
    payload = await api('case/open', { caseId: caseDef.id, count });
  } catch (err) {
    toast(err.message, 'err');
    modal.close();
    return;
  }
  applyYou(payload.you, { flash: true });

  // the winners go on the end of the reel (hidden by the scroll position until it stops)
  const winners = payload.items;
  winners.forEach((w) => track.appendChild(reelSkin(w)));
  for (let i = 0; i < 12; i++) {
    const d = state.cfg.cases.find((x) => x.id === caseDef.id);
    track.appendChild(reelSkin({
      id: 'z' + i, rarity: weightedClientPick(d.drops), weapon: '???', skin: 'Unknown',
      value: 0, seed: Math.floor(Math.random() * 9999),
    }));
  }

  const winWidth = Math.max(320, win.clientWidth);
  track.style.paddingLeft = (winWidth / 2 - 64) + 'px';
  const itemW = 128 + 8;
  const targetIndex = filler.length + (winners.length - 1) / 2; // centre the last pull(s)

  requestAnimationFrame(() => {
    const jitter = (Math.random() - 0.5) * 60;
    const distance = -(targetIndex * itemW + jitter);
    track.style.transition = 'transform 3.1s cubic-bezier(.12,.72,.06,1)';
    track.style.transform = `translateX(${distance}px)`;
    let ticks = 0;
    const ticker = setInterval(() => {
      ticks++;
      beep(400 + ((ticks * 37) % 500), 0.02, 'square', 0.012);
      if (ticks > 26) clearInterval(ticker);
    }, 90);
  });

  setTimeout(() => {
    const total = payload.refund;
    const cost = payload.cost;
    const net = total - cost;
    banner.className = 'result-banner ' + (net >= 0 ? 'good' : 'bad');
    banner.textContent = net >= 0
      ? `Pulled 🪙 ${fmt(total)} of items for 🪙 ${fmt(cost)} → +🪙 ${fmt(net)}`
      : `Pulled 🪙 ${fmt(total)} of items for 🪙 ${fmt(cost)} → −🪙 ${fmt(Math.abs(net))}`;
    results.innerHTML = '';
    winners.forEach((w, i) => {
      const card = skinEl(w, { pop: true });
      card.style.animationDelay = (i * 90) + 'ms';
      results.appendChild(card);
    });
    if (net > 0) { sfx.win(); toast(`Nice pull: +🪙 ${fmt(net)}`, 'gold'); }
    else sfx.lose();
    window.onMinesState && window.onMinesState();
  }, 3200);
}

function weightedClientPick(drops) {
  const total = drops.reduce((s, d) => s + d.chance, 0);
  let r = Math.random() * total;
  for (const d of drops) { r -= d.chance; if (r <= 0) return d.rarity; }
  return drops[drops.length - 1].rarity;
}

/* live unboxing strip, fed from the feed */
function pushUnboxToStrip(ev) {
  const strip = $('#unbox-strip');
  if (!strip) return;
  const item = {
    id: 'u' + Math.random(), rarity: ev.rarity, value: ev.value,
    weapon: (ev.item || '').split('|')[0].trim(), skin: (ev.item || '').split('|')[1] ? ev.item.split('|')[1].trim() : '',
    seed: Math.floor(Math.random() * 9999),
  };
  if (!item.skin) { item.weapon = ''; item.skin = ev.item || 'Unknown'; }
  const card = skinEl(item, { small: true, pop: true });
  card.style.minWidth = '148px';
  const who = el('div', 'tiny muted', `${esc(ev.name)} ${ev.isBot ? '· BOT' : '· you'}`);
  card.appendChild(who);
  strip.prepend(card);
  while (strip.children.length > 12) strip.removeChild(strip.lastChild);
}

/* ==========================================================================
   CASE BATTLES
   ========================================================================== */

const battleState = { caseId: null, count: 3, running: false };

function battleCost() {
  const c = state.cfg.cases.find((x) => x.id === battleState.caseId);
  return c ? c.price * battleState.count : 0;
}

function buildBattleSetup() {
  const sel = $('#battle-case');
  sel.innerHTML = '';
  state.cfg.cases.forEach((c) => {
    const opt = el('option', '', `${c.name} — 🪙 ${fmt(c.price)} each`);
    opt.value = c.id;
    sel.appendChild(opt);
  });
  battleState.caseId = state.cfg.cases[1].id;
  sel.value = battleState.caseId;
  sel.addEventListener('change', () => {
    battleState.caseId = sel.value;
    $('#battle-cost').textContent = fmt(battleCost());
  });
  $$('#battle-count button').forEach((b) => b.addEventListener('click', () => {
    $$('#battle-count button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    battleState.count = Number(b.dataset.count);
    $('#battle-cost').textContent = fmt(battleCost());
  }));
  $('#battle-cost').textContent = fmt(battleCost());
  $('#battle-you-name').textContent = state.you ? state.you.name : 'You';
  $('#battle-start').addEventListener('click', runBattle);
  buildEmptyReel($('#reel-you'));
  buildEmptyReel($('#reel-bot'));
}

function buildEmptyReel(track) {
  track.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    track.appendChild(skinEl({
      id: 'p' + i + Math.random(), rarity: ['common', 'uncommon', 'rare'][i % 3],
      weapon: '???', skin: '———', value: 0, seed: Math.floor(Math.random() * 9999),
    }, { small: true }));
  }
}

function fillReel(track, items, extraLoops = 14) {
  track.innerHTML = '';
  const all = [];
  for (let i = 0; i < extraLoops; i++) {
    const rar = weightedClientPick(state.cfg.cases.find((c) => c.id === battleState.caseId).drops);
    all.push({ id: 'x' + i + Math.random(), rarity: rar, weapon: '???', skin: 'Unknown', value: 0, seed: Math.floor(Math.random() * 9999) });
  }
  all.push(...items);
  all.forEach((it) => track.appendChild(skinEl(it, { small: true })));
  return all.length - items.length;
}

function spinReel(track, items, duration) {
  const startIndex = fillReel(track, items);
  const first = track.firstElementChild;
  const itemH = first ? first.getBoundingClientRect().height : 78;
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      track.style.transition = `transform ${duration}ms cubic-bezier(.1,.75,.08,1)`;
      track.style.transform = `translateY(${-(startIndex * itemH)}px)`;
      setTimeout(resolve, duration + 60);
    });
  });
}

async function runBattle() {
  if (battleState.running) return;
  const cost = battleCost();
  if (state.you.balance < cost) {
    toast(`That battle costs 🪙 ${fmt(cost)}. You have 🪙 ${fmt(state.you.balance)}. Free coins are one click away.`, 'err');
    return;
  }
  battleState.running = true;
  $('#battle-start').disabled = true;
  $('#battle-verdict').className = 'battle-vs';
  $('#battle-verdict').textContent = 'VS';
  const sides = $$('.battle-side');
  $('#battle-you-total').textContent = '🪙 0';
  $('#battle-bot-total').textContent = '🪙 0';
  $('#battle-you-total').classList.remove('win');
  $('#battle-bot-total').classList.remove('win');
  sides.forEach((s) => s.classList.remove('winner'));

  let payload;
  try {
    payload = await api('battle/start', { caseId: battleState.caseId, count: battleState.count });
  } catch (err) {
    toast(err.message, 'err');
    battleState.running = false;
    $('#battle-start').disabled = false;
    return;
  }
  applyYou(payload.you, { flash: true });

  $('#battle-you-name').textContent = payload.yourPile.name;
  $('#battle-bot-name').innerHTML = `${esc(payload.oppPile.name)} <span class="bot-tag">BOT</span>`;

  const spinA = spinReel($('#reel-you'), payload.yourPile.items, 2400);
  const spinB = spinReel($('#reel-bot'), payload.oppPile.items, 3100);
  await Promise.all([spinA, spinB]);

  $('#battle-you-total').textContent = '🪙 ' + fmt(payload.yourPile.total);
  $('#battle-bot-total').textContent = '🪙 ' + fmt(payload.oppPile.total);
  const verdict = $('#battle-verdict');
  const net = payload.pot - payload.cost;
  if (payload.win) {
    // you won the comparison — the pot is yours, but a weak pot can still cost you
    verdict.textContent = net >= 0
      ? `YOU WIN +🪙 ${fmt(net)}`
      : `YOU WIN 🪙 ${fmt(payload.pot)} POT — STILL −🪙 ${fmt(Math.abs(net))}`;
    verdict.className = 'battle-vs win';
    $('#battle-you-total').classList.add('win');
    sides[0].classList.add('winner');
    sfx.big();
    toast(net >= 0
      ? `Battle won: +🪙 ${fmt(net)} — you keep both piles`
      : `You won the battle with a 🪙 ${fmt(payload.pot)} pot, but entry cost 🪙 ${fmt(payload.cost)} — the rolls came up short. Winning a roll isn't the same as beating the house.`, 'gold');
  } else {
    verdict.textContent = 'BOT WINS −🪙 ' + fmt(payload.cost);
    verdict.className = 'battle-vs lose';
    $('#battle-bot-total').classList.add('win');
    sides[1].classList.add('winner');
    sfx.lose();
    toast(`Lost the battle: −🪙 ${fmt(payload.cost)}. The bot types "gg" now.`);
  }
  battleState.running = false;
  $('#battle-start').disabled = false;
}

/* ==========================================================================
   COINFLIP
   ========================================================================== */

const cfState = { side: 'heads', flipping: false };

function buildCoinflip() {
  $$('#cf-side button').forEach((b) => b.addEventListener('click', () => {
    $$('#cf-side button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    cfState.side = b.dataset.side;
    $('#cf-you-side').textContent = 'picked ' + cfState.side;
  }));
  $('#cf-you-name').textContent = state.you ? state.you.name : 'You';
  const av = $('#cf-you-avatar');
  av.textContent = FACES[(state.you ? state.you.face : 0) % FACES.length];
  av.style.setProperty('--hue', state.you ? state.you.hue : 150);
  $('#cf-you-side').textContent = 'picked heads';
  $$('[data-cf-amt]').forEach((btn) => btn.addEventListener('click', () => {
    const v = btn.dataset.cfAmt;
    const input = $('#cf-amount');
    const bal = state.you ? state.you.balance : 0;
    if (v === 'half') input.value = Math.max(10, Math.floor((Number(input.value) || 0) / 2));
    else if (v === 'double') input.value = Math.max(10, Math.floor((Number(input.value) || 0) * 2));
    else if (v === 'max') input.value = Math.max(10, Math.floor(bal));
    else input.value = v;
  }));
  $('#cf-amount').addEventListener('input', () => {
    $('#cf-btn-amount').textContent = fmt(Number($('#cf-amount').value) || 0);
  });
}

async function flipCoin() {
  if (cfState.flipping) return;
  const amount = Math.floor(Number($('#cf-amount').value) || 0);
  if (amount < 10) { toast('Minimum bet is 10 coins.', 'err'); return; }
  if (amount > state.you.balance) { toast('Not enough coins — the free drop button is right up top.', 'err'); return; }
  cfState.flipping = true;
  $('#cf-flip').disabled = true;

  let payload;
  try {
    payload = await api('coinflip', { amount, side: cfState.side });
  } catch (err) {
    toast(err.message, 'err');
    cfState.flipping = false;
    $('#cf-flip').disabled = false;
    return;
  }
  const r = payload.result;

  const coin = $('#cf-coin');
  coin.classList.remove('flipping');
  void coin.offsetWidth;
  coin.style.setProperty('--final', r.flip === 'heads' ? '1800deg' : '1980deg');
  coin.classList.add('flipping');
  let n = 0;
  const tick = setInterval(() => { n++; beep(600 + (n % 3) * 120, 0.02, 'square', 0.012); if (n > 16) clearInterval(tick); }, 70);

  $('#cf-bot-name').innerHTML = `${esc(r.opponent)} <span class="bot-tag">BOT</span>`;
  $('#cf-bot-side').textContent = 'picked ' + r.opponentSide;
  const botAvatar = $('#cf-bot-avatar');
  botAvatar.textContent = FACES[Math.floor(Math.random() * FACES.length)];
  botAvatar.style.setProperty('--hue', Math.floor(Math.random() * 360));
  $('#cf-verdict').textContent = 'Flipping…';
  $('#cf-verdict').className = 'cf-verdict';

  setTimeout(() => {
    const verdict = $('#cf-verdict');
    if (r.win) {
      verdict.textContent = `${r.flip.toUpperCase()} — you won 🪙 ${fmt(r.payout)}`;
      verdict.className = 'cf-verdict win';
      sfx.big();
    } else {
      verdict.textContent = `${r.flip.toUpperCase()} — you lost 🪙 ${fmt(r.amount)}`;
      verdict.className = 'cf-verdict lose';
      sfx.lose();
    }
    applyYou(payload.you, { flash: true });
    renderCoinflipHistory(payload.you.coinflipHistory);
    cfState.flipping = false;
    $('#cf-flip').disabled = false;
  }, 1200);
}

function renderCoinflipHistory(history) {
  const ul = $('#cf-history');
  if (!history || !history.length) { ul.innerHTML = '<li class="muted">No flips yet.</li>'; return; }
  ul.innerHTML = history.map((h) => `
    <li class="${h.win ? 'win' : 'lose'}">
      <span>${h.win ? '✅' : '❌'} you ${esc(h.side)} · bot ${esc(h.opponentSide)} · flipped ${esc(h.flip)}</span>
      <b>${h.win ? '+' : '−'}🪙 ${fmt(h.win ? h.payout - h.amount : h.amount)}</b>
    </li>`).join('');
}

/* ==========================================================================
   MINES
   ========================================================================== */

const minesState = { count: 3, busy: false };

function buildMines() {
  const board = $('#mines-board');
  board.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const tile = el('button', 'tile');
    tile.dataset.tile = String(i);
    tile.disabled = true;
    tile.addEventListener('click', () => pickTile(i));
    board.appendChild(tile);
  }
  $$('#mines-count button').forEach((b) => b.addEventListener('click', () => {
    if (state.you && state.you.mines && state.you.mines.active) { toast('Finish the current round first.', 'err'); return; }
    $$('#mines-count button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    minesState.count = Number(b.dataset.mines);
    renderMinesOdds();
  }));
  $('#mines-start').addEventListener('click', startMines);
  $('#mines-cashout').addEventListener('click', cashoutMines);
  $('#mines-bet').addEventListener('input', renderMinesOdds);
  renderMinesBoard();
}

function minesOddsText() {
  const m = minesState.count;
  const k = 1;
  let mult = 1;
  for (let i = 0; i < k; i++) mult *= (25 - i) / (25 - m - i);
  return `first tile: ${(mult * 0.97).toFixed(2)}x · ${m} mine${m > 1 ? 's' : ''}`;
}

function renderMinesOdds() {
  $('#mines-odds').textContent = minesOddsText();
}

function renderMinesBoard() {
  const board = $('#mines-board');
  const m = state.you && state.you.mines;
  const active = m && m.active;
  const revealed = m ? m.revealed : [];
  const mineList = m && !m.active ? m.mines : [];

  $$('.tile', board).forEach((tile, i) => {
    const wasGem = revealed.includes(i);
    const wasMine = mineList.includes(i);
    tile.className = 'tile' + (wasGem ? ' gem revealed' : wasMine ? ' mine revealed' : '');
    tile.textContent = wasGem ? '💎' : wasMine ? '💣' : '';
    tile.disabled = !active || wasGem || minesState.busy;
  });

  $('#mines-start').disabled = !!active;
  $('#mines-cashout').disabled = !active || !revealed.length;
  const cur = m && m.active ? m.curMult : 1;
  $('#mines-found').textContent = revealed.length;
  $('#mines-mult').textContent = (cur || 1).toFixed(2) + 'x';
  $('#mines-next').textContent = m && m.active ? (m.nextMult || 1).toFixed(2) + 'x' : '—';
  const bet = Math.floor(Number($('#mines-bet').value) || 0);
  $('#mines-payout').textContent = active
    ? fmt(Math.round(bet * (m.curMult || 1)))
    : '0';
}

window.onMinesState = function () { renderMinesBoard(); };

async function startMines() {
  if (minesState.busy) return;
  const bet = Math.floor(Number($('#mines-bet').value) || 0);
  if (bet < 10) { toast('Minimum bet is 10 coins.', 'err'); return; }
  if (bet > state.you.balance) { toast('Not enough coins for that bet.', 'err'); return; }
  minesState.busy = true;
  try {
    const res = await api('mines/start', { bet, mines: minesState.count });
    sfx.bet();
    applyYou(res.you);
    renderMinesBoard();
    toast(`${minesState.count} mine${minesState.count > 1 ? 's' : ''} hidden. Good luck — you'll need it.`);
  } catch (err) { toast(err.message, 'err'); }
  finally { minesState.busy = false; renderMinesBoard(); }
}

async function pickTile(i) {
  if (minesState.busy) return;
  minesState.busy = true;
  try {
    const res = await api('mines/pick', { tile: i });
    const r = res.result;
    if (r.bom) {
      sfx.lose();
      toast(`💣 Boom. −🪙 ${fmt(r.bet)}`, 'err');
    } else if (r.cleared) {
      sfx.big();
      toast(`Board cleared at ${r.mult.toFixed(2)}x → +🪙 ${fmt(r.payout - r.bet)}`, 'gold');
    } else {
      sfx.win();
      beep(720, 0.05, 'triangle', 0.03);
    }
    applyYou(res.you);
    renderMinesBoard();
  } catch (err) { toast(err.message, 'err'); }
  finally { minesState.busy = false; renderMinesBoard(); }
}

async function cashoutMines() {
  if (minesState.busy) return;
  minesState.busy = true;
  try {
    const res = await api('mines/cashout', {});
    sfx.win();
    toast(`Cashed out ${res.mult.toFixed(2)}x → 🪙 ${fmt(res.payout)}`, 'gold');
    applyYou(res.you, { flash: true });
    renderMinesBoard();
  } catch (err) { toast(err.message, 'err'); }
  finally { minesState.busy = false; renderMinesBoard(); }
}

/* ==========================================================================
   HOOKS
   ========================================================================== */

window.initCases = function () { buildCaseGrid(); };
window.initBattles = function () { buildBattleSetup(); };
window.initCoinflip = function () {
  buildCoinflip();
  $('#cf-flip').addEventListener('click', flipCoin);
  if (state.you) renderCoinflipHistory(state.you.coinflipHistory);
};
window.initMines = function () { buildMines(); renderMinesOdds(); };

window.onViewChange = function (view) {
  if (view === 'crash' && crashUI.canvas) sizeCanvas();
  if (view === 'mines') renderMinesBoard();
  if (view === 'coinflip' && state.you) renderCoinflipHistory(state.you.coinflipHistory);
};

/* feed → live unboxing strip (filled in core.js's renderFeed) */
window.onFeed = function (list) {
  list.filter((f) => f.type === 'case').slice(0, 6).forEach(pushUnboxToStrip);
};
