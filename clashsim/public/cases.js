/* ==========================================================================
   cases.js — Case Opening (with the fixed reel) + Case Battles
   The old reel guessed item widths from CSS numbers and drifted further off
   with every item. This one measures the DOM after layout, so the marker
   always stops on the item that was actually pulled.
   ========================================================================== */

/* --------------------------------------------------------------- the reel
 * The reel used to move with a CSS transition, and one global rule in
 * styles.css — the prefers-reduced-motion guard that flattens every
 * transition-duration to 0.01ms — turned that into an instant jump: the reel
 * "stayed stuck in one place" for anyone whose OS has reduce-motion on.
 * Now the scroll is driven by requestAnimationFrame: no transition, no
 * override, and a short-but-real scroll for reduce-motion users instead of
 * no motion at all.
 */

/* The real case reel eases with cubic-bezier(.1, 0, .2, 1) — that is the
 * value in the clash.gg bundle — so the landing feels the same here. */
function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {                       // Newton–Raphson
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-5) return sy(t);
      const slope = dx(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= err / slope;
    }
    let lo = 0, hi = 1;                                  // bisection fallback
    t = x;
    for (let i = 0; i < 24; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v > x) hi = t; else lo = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

const reelEase = cubicBezier(0.1, 0, 0.2, 1);            // the bundle's case-reel ease

/** Animate an element's transform with rAF. `done` runs exactly once and the
 *  returned handle can cut the wait short (the reel is click-to-skip). */
function animateTrack(el, axis, from, to, duration, ease, done) {
  let finished = false;
  const write = (v) => {
    el.style.transform = axis === 'Y'
      ? `translate3d(0, ${v.toFixed(2)}px, 0)`
      : `translate3d(${v.toFixed(2)}px, 0, 0)`;
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    write(to);
    if (done) done();
  };
  el.style.transition = 'none';
  write(from);
  const t0 = performance.now();
  const frame = (now) => {
    if (finished) return;
    const p = duration <= 0 ? 1 : Math.min(1, (now - t0) / duration);
    write(from + (to - from) * ease(p));
    if (p < 1) requestAnimationFrame(frame);
    else finish();
  };
  requestAnimationFrame(frame);
  // belt and braces: rAF is throttled in a background tab, so make sure the
  // result still lands (and is revealed) on time
  setTimeout(finish, Math.max(0, duration) + 150);
  return { finish };
}

/** Item pitch of a flex track, measured — with constants as a safety net. */
/** Item pitch of a flex track, measured — with constants as a safety net. */
function trackStep(track, axis, fallback) {
  const kids = track.children;
  if (kids.length >= 2) {
    const a = kids[0].getBoundingClientRect();
    const b = kids[1].getBoundingClientRect();
    const delta = axis === 'Y' ? (b.top - a.top) : (b.left - a.left);
    if (delta > 0) return delta;               // pitch including the flex gap
  }
  const first = kids[0] && kids[0].getBoundingClientRect();
  const size = first ? (axis === 'Y' ? first.height : first.width) : 0;
  if (size > 0) return size;
  return fallback;
}

/** How far to translate a reel so the middle winner sits under the pointer.
 *  Everything except the pixel pitch comes from live rects (padding, gap,
 *  borders included), so this keeps working at any width or font size.
 *  Returns a positive "move the track left/up by this much" amount; the
 *  caller animates to `-distance`. */
function reelDistance(track, win, axis, itemCount, lead, jitter) {
  const trackRect = track.getBoundingClientRect();
  const winRect = win.getBoundingClientRect();
  const first = track.firstElementChild;
  const firstRect = first ? first.getBoundingClientRect() : null;
  const vertical = axis === 'Y';
  const fallbackStep = vertical ? 96 : 129.6;
  const step = trackStep(track, axis, fallbackStep);
  const size = firstRect ? (vertical ? firstRect.height : firstRect.width) : step;
  const winSize = (vertical ? winRect.height : winRect.width) || (vertical ? 190 : 600);
  // where item 0 starts, relative to the track's own box (padding, borders)
  const pad = firstRect ? (vertical ? firstRect.top - trackRect.top : firstRect.left - trackRect.left) : 0;
  // where the track's box starts, relative to the window's box
  const offset = (vertical ? trackRect.top - winRect.top : trackRect.left - winRect.left) || 0;
  const centreIndex = lead + (itemCount - 1) / 2;
  const winnerCentre = offset + pad + centreIndex * step + size / 2;
  return Math.max(0, winnerCentre - winSize / 2 + (jitter || 0));
}

/* ------------------------------------------------------------ case grid */

function oddsBars(caseDef) {
  const wrap = el('div', 'odds-bars');
  caseDef.odds.slice().sort((a, b) => b.chance - a.chance).forEach((o) => {
    const i = el('i');
    i.style.width = Math.max(1, o.chance * 100) + '%';
    i.style.background = o.color;
    i.title = `${o.name}: ${(o.chance * 100).toFixed(o.chance < 0.01 ? 3 : 2)}%`;
    wrap.appendChild(i);
  });
  return wrap;
}

function oddsRows(caseDef) {
  const wrap = el('div', 'odds-rows');
  caseDef.odds.forEach((o) => {
    const pct = o.chance * 100;
    wrap.appendChild(el('div', 'odds-row', `
      <span class="dot" style="background:${o.color}"></span>
      <span class="name">${esc(o.name)}${o.count != null ? ` · ${o.count} item${o.count === 1 ? '' : 's'}` : ''}</span>
      <span>${pct < 0.01 ? pct.toFixed(3) : pct.toFixed(2)}%</span>
      <span>💎 ${short(o.min)}–${short(o.max)}</span>`));
  });
  return wrap;
}

/** Inline crate art for the two original cases (no Steam image exists for them). */
function caseFallbackArt() {
  return `<svg viewBox="0 0 120 92" class="case-fallback" aria-hidden="true">
    <rect x="12" y="28" width="96" height="52" rx="7" fill="#241f45" stroke="#7c5cff66"/>
    <rect x="12" y="28" width="96" height="15" rx="6" fill="#372c68" stroke="#7c5cff66"/>
    <rect x="57" y="28" width="6" height="52" fill="#14122a" opacity=".6"/>
    <rect x="18" y="50" width="84" height="3" rx="1.5" fill="#7c5cff33"/>
    <circle cx="60" cy="60" r="8" fill="#ffcf5c" opacity=".9"/>
    <path d="M60 52.5v15M52.5 60h15" stroke="#1b1a34" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="34" cy="60" r="2.5" fill="#38e8a0" opacity=".8"/>
    <circle cx="86" cy="60" r="2.5" fill="#ff5d5d" opacity=".8"/>
  </svg>`;
}

/* Which slice of the shelf is showing. Filters are built from the catalog the
 * server actually ships, so a new origin ("clash-original", "community")
 * appears here on its own. */
const CASE_FILTERS = [
  { key: 'all', label: 'All cases' },
  { key: 'original', label: 'clash.sim originals' },
  { key: 'clash-classic', label: 'Clash classics' },
  { key: 'clash-original', label: 'Clash originals' },
  { key: 'community', label: 'Community' },
];
let caseFilter = 'all';

function initCaseFilters() {
  const bar = $('#case-filters');
  if (!bar) return;
  const counts = {};
  state.cfg.cases.forEach((c) => { counts[c.origin] = (counts[c.origin] || 0) + 1; });
  counts.all = state.cfg.cases.length;
  bar.innerHTML = '';
  CASE_FILTERS.forEach((f) => {
    const n = counts[f.key] || 0;
    const b = el('button', 'case-filter' + (caseFilter === f.key ? ' active' : ''), `${esc(f.label)} <b>${n}</b>`);
    b.disabled = n === 0;
    b.addEventListener('click', () => { caseFilter = f.key; buildCaseGrid(); initCaseFilters(); });
    bar.appendChild(b);
  });
}

function buildCaseGrid() {
  const grid = $('#case-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const list = state.cfg.cases
    .filter((c) => caseFilter === 'all' || c.origin === caseFilter)
    .slice()
    .sort((a, b) => a.gems - b.gems);
  const empty = $('#case-empty');
  if (empty) empty.hidden = list.length > 0;

  list.forEach((c) => {
    const card = el('div', 'case-card');
    const art = el('div', 'case-art');
    if (c.image) {
      const img = el('img');
      img.src = c.image;
      img.alt = c.name;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => { img.remove(); art.innerHTML = caseFallbackArt(); };
      art.appendChild(img);
    } else art.innerHTML = caseFallbackArt();

    card.appendChild(art);

    const label = c.origin === 'original' ? 'clash.sim original'
      : c.origin === 'clash-classic' ? 'clash classic'
      : c.origin === 'clash-original' ? 'clash original'
      : c.origin === 'community' ? `community · by ${esc(c.creator ? c.creator.name : 'someone')}`
      : 'valve case';
    card.appendChild(el('div', 'case-tag' + (c.origin === 'community' ? ' community' : ''), `${label} · ${c.itemCount} items`));

    const nameRow = el('div', 'case-name');
    nameRow.appendChild(el('h3', '', esc(c.name)));
    nameRow.appendChild(el('span', 'case-price', `💎 ${fmt(c.gems)}`));
    card.appendChild(nameRow);
    card.appendChild(oddsBars(c));
    card.appendChild(oddsRows(c));
    card.appendChild(el('div', 'odds-note',
      `Average return ≈${Math.round((c.returnRate || 0.9) * 100)}% · expected value 💎 ${fmt(c.ev)}` +
      (c.creator ? ` · creator earns 💎 ${fmt(Math.round(c.gems * (c.creator.commission || 0.05)))} per open` : '')));

    const actions = el('div', 'case-actions');
    const openBtn = el('button', 'btn btn-primary', `Open 💎 ${short(c.gems)}`);
    openBtn.addEventListener('click', () => openCaseFlow(c, 1));
    const five = el('button', 'btn btn-ghost', 'Open ×5');
    five.addEventListener('click', () => openCaseFlow(c, 5));
    actions.appendChild(openBtn);
    actions.appendChild(five);
    if (c.origin === 'community' && c.creator && state.you && c.creator.id === state.you.id) {
      const del = el('button', 'btn btn-ghost', 'Delete');
      del.addEventListener('click', async () => {
        try {
          await api('creator/delete', { id: c.id });
          toast(`Deleted "${c.name}".`, 'gold');
          await refreshCfg();
        } catch (err) { toast(err.message, 'err'); }
      });
      actions.appendChild(del);
    }
    card.appendChild(actions);
    grid.appendChild(card);
  });
}

/** Re-pull the catalog after a case is published or deleted. */
async function refreshCfg() {
  try {
    const cfg = await fetch('api/config').then((r) => r.json());
    state.cfg = cfg;
    buildCaseGrid();
    initCaseFilters();
    const sel = $('#battle-case');
    if (sel) {
      const keep = sel.value;
      sel.innerHTML = '';
      state.cfg.cases.forEach((c) => sel.appendChild(new Option(`${c.name} (💎 ${fmt(c.gems)})`, c.id)));
      if (keep) sel.value = keep;
    }
  } catch (err) { toast('Could not refresh the case list: ' + err.message, 'err'); }
}

async function openCaseFlow(caseDef, count) {
  const you = state.you;
  const voucherOk = you.freeCases >= count && caseDef.gems <= state.cfg.freebies.freeCaseMaxPrice;
  const cost = caseDef.gems * count;

  let detail = null;
  try { detail = await api(`case?id=${encodeURIComponent(caseDef.id)}`); } catch { /* non-fatal */ }

  const body = el('div');
  const tabs = el('div', 'modal-tabs');
  const tabContents = el('button', 'active', 'Contents & odds');
  const tabReel = el('button', '', 'Reel');
  tabs.appendChild(tabContents);
  tabs.appendChild(tabReel);

  const contentsPane = el('div');
  const reelPane = el('div');
  reelPane.hidden = true;

  /* ---------------- contents pane ---------------- */
  const oddsBox = el('div', 'panel');
  oddsBox.appendChild(el('h3', '', 'Drop table — rolled exactly like this'));
  oddsBox.appendChild(oddsRows(detail || caseDef));
  const rate = detail ? (detail.returnRate || caseDef.returnRate) : caseDef.returnRate;
  oddsBox.appendChild(el('p', 'odds-note',
    `Wear (Factory New → Battle-Scarred) is rolled per item and scales its value; StatTrak™ adds ×1.5 on ~10% of drops. ` +
    `Average return ≈${Math.round((rate || 0.9) * 100)}%.`));
  if (caseDef.creator) {
    oddsBox.appendChild(el('p', 'odds-note community-note',
      `Community case by <b>${esc(caseDef.creator.name)}</b> — the creator earns 💎 ${fmt(Math.round(caseDef.gems * (caseDef.creator.commission || 0.05)))} ` +
      `(${Math.round((caseDef.creator.commission || 0.05) * 100)}%) of every open. It rolls from the same server-side odds as everything else.`));
  }
  contentsPane.appendChild(oddsBox);

  const grid = el('div', 'contents-grid');
  (detail ? detail.contents : []).forEach((it) => grid.appendChild(itemEl({ ...it, value: it.base, wearShort: '' }, { small: true })));
  contentsPane.appendChild(grid);

  /* ---------------- reel pane ---------------- */
  const win = el('div', 'roll-window');
  const track = el('div', 'roll-track');
  const fade = el('div', 'roll-fade');
  const pointer = el('div', 'roll-pointer');
  win.appendChild(track);
  win.appendChild(fade);
  win.appendChild(pointer);

  const banner = el('div', 'result-banner', 'Pick open — the reel spins after the server already decided the drops.');
  const results = el('div', 'pull-result');
  reelPane.appendChild(banner);
  reelPane.appendChild(win);
  reelPane.appendChild(results);

  tabContents.addEventListener('click', () => {
    tabContents.classList.add('active'); tabReel.classList.remove('active');
    contentsPane.hidden = false; reelPane.hidden = true;
  });
  tabReel.addEventListener('click', () => {
    tabReel.classList.add('active'); tabContents.classList.remove('active');
    reelPane.hidden = false; contentsPane.hidden = true;
    if (payload) spinReel();
  });

  body.appendChild(tabs);
  body.appendChild(contentsPane);
  body.appendChild(reelPane);

  /* ---------------- footer ---------------- */
  const footer = [];
  const openBtn = el('button', 'btn btn-primary', `Open ${count}× for 💎 ${fmt(cost)}`);
  openBtn.addEventListener('click', () => open(false));
  footer.push(openBtn);

  if (voucherOk) {
    const vBtn = el('button', 'btn btn-gem', `Use ${count} free voucher${count > 1 ? 's' : ''}`);
    vBtn.addEventListener('click', () => open(true));
    footer.push(vBtn);
  } else if (you.freeCases > 0) {
    footer.push(el('span', 'chip', `🎁 vouchers only cover cases up to 💎 ${fmt(state.cfg.freebies.freeCaseMaxPrice)}`));
  }
  const speedField = el('label', 'reel-speed-field modal-speed');
  speedField.title = 'Reel speed for this case and for battles';
  speedField.appendChild(el('span', null, 'Reel'));
  const speedSel = el('select', 'reel-speed-select');
  speedSel.setAttribute('data-reel-speed', '');
  speedSel.setAttribute('aria-label', 'Reel speed');
  speedField.appendChild(speedSel);
  footer.push(speedField);

  modal.open(`${caseDef.name} — 💎 ${fmt(caseDef.gems)} each`, body, footer);
  initReelSpeed();          // fills in the picker inside the modal footer

  /* ============ reel: fillers, winners, measured scroll ============ */

  const TAIL_MIN = 9;   // the real reel keeps 9 items after the winner block
  let fillCount = 0;    // how much filler sits in front of the winners
  let payload = null;
  let spinning = false;
  let spinHandle = null;

  function filler(n, from) {
    const src = (detail && detail.contents.length) ? detail.contents : [{}];
    for (let i = 0; i < n; i++) {
      const base = src[Math.floor(Math.random() * src.length)];
      track.appendChild(itemEl({
        rarity: base.rarity || 'rarity_rare',
        name: base.name || '———',
        weapon: base.weapon || '',
        seed: (base.seed || 0) + i * 13,
        value: 0, wearShort: '', uid: 'f' + (from + i),
      }, { small: true }));
    }
  }

  function buildTrack(items) {
    // How far the reel walks comes from the speed profile: a slower speed shows
    // more items instead of crawling through the same handful.
    const prof = reelSpeedProfile();
    const fill = Math.max(4, prof.traverse - Math.floor((items.length - 1) / 2));
    const tail = Math.max(TAIL_MIN, Math.ceil(((win.clientWidth || 660) / 2) / 130) + 3);
    fillCount = fill;
    track.innerHTML = '';
    track.style.transition = 'none';
    track.style.transform = 'translate3d(0, 0, 0)';
    filler(fill, 0);
    items.forEach((it, i) => track.appendChild(itemEl(it, { small: true, uid: 'w' + i })));
    filler(tail, fill + items.length);
  }

  function spinReel() {
    if (spinning || !payload) return;
    if (!track.children.length) return;
    spinning = true;
    const prof = reelSpeedProfile();

    // keep the reel on screen: the Open button sits below it in the modal
    try {
      const body = win.closest('.modal-body') || win.parentElement;
      if (body && typeof win.scrollIntoView === 'function') win.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (e) { /* cosmetic only */ }

    const n = payload.items.length;
    const step = trackStep(track, 'X', 129.6);
    const jitter = (Math.random() - 0.5) * step * 0.3;
    const distance = reelDistance(track, win, 'X', n, fillCount, jitter);

    win.classList.add('rolling');
    win.title = 'Click the reel to skip to the result';
    banner.textContent = `Rolling… (${prof.label} reel — click the reel to skip)`;

    // the real site waits 1.5s before the reel moves; the pause scales with speed
    setTimeout(() => {
      if (!spinning) return;              // skipped or closed while waiting
      audio.gear();

      // reel clicks, hard-capped so the audio never piles up
      let ticks = 0;
      const ticker = setInterval(() => {
        ticks++;
        if (ticks > 24) return clearInterval(ticker);
        audio.tone(480 + ((ticks * 37) % 300), 16, 'square', 0.008);
      }, Math.max(45, prof.caseMs / 26));

      spinHandle = animateTrack(track, 'X', 0, -distance, prof.caseMs, reelEase, () => {
        clearInterval(ticker);
        spinHandle = null;
        setTimeout(() => {
          win.classList.remove('rolling');
          spinning = false;
          reveal();
        }, prof.settleMs);
      });
    }, prof.delayMs);
  }

  // the result is already decided: clicking the reel ends the wait at once
  win.addEventListener('click', () => { if (spinHandle) spinHandle.finish(); });
  win.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && spinHandle) { e.preventDefault(); spinHandle.finish(); }
  });

  function reveal() {
    if (!payload) return;
    const { cost: spent, refund, items } = payload;
    const net = refund - spent;
    banner.className = 'result-banner ' + (spent === 0 || net >= 0 ? 'good' : 'bad');
    banner.innerHTML = spent === 0
      ? `Free case — pulled 💎 ${fmt(refund)} of items, nothing spent.`
      : net >= 0
        ? `Pulled 💎 ${fmt(refund)} for 💎 ${fmt(spent)} → <b>+💎 ${fmt(net)}</b>`
        : `Pulled 💎 ${fmt(refund)} for 💎 ${fmt(spent)} → <b>−💎 ${fmt(Math.abs(net))}</b>`;
    results.innerHTML = '';
    items.forEach((it, i) => {
      const card = itemEl(it, { pop: true });
      card.style.animationDelay = i * 90 + 'ms';
      results.appendChild(card);
    });
    if (net > 0) { audio.win(); toast(`Pull profit +💎 ${fmt(net)} — check your inventory.`, 'gold'); }
    else if (spent > 0) audio.lose();
    if (you.freeCases !== state.you.freeCases && $('#voucher-chip')) {
      $('#voucher-chip').textContent = `🎁 ${state.you.freeCases} free case${state.you.freeCases === 1 ? '' : 's'}`;
    }
  }

  async function open(asVoucher) {
    if (spinning) return;
    openBtn.disabled = true;
    try {
      payload = await api('case/open', { caseId: caseDef.id, count, voucher: !!asVoucher });
    } catch (err) {
      toast(err.message, 'err');
      openBtn.disabled = false;
      return;
    }
    buildTrack(payload.items);
    // the equipment is what lands in the inventory — the request already did that
    applyYou(payload.you, { flash: true });
    banner.className = 'result-banner';
    banner.textContent = 'Rolling…';
    results.innerHTML = '';
    openBtn.disabled = false;
    openBtn.textContent = `Open ${count}× again — 💎 ${fmt(caseDef.gems * count)}`;

    if (reelPane.hidden) tabReel.click(); else spinReel();
  }
}

/* ==========================================================================
   Battles — one roll-off against one random bot
   ========================================================================== */

const battleCfg = { caseId: null, count: 1, busy: false };

const battleCase = () => state.cfg.cases.find((x) => x.id === battleCfg.caseId);
const battleCost = () => { const c = battleCase(); return c ? c.gems * battleCfg.count : 0; };

function initBattles() {
  const sel = $('#battle-case');
  if (!sel) return;
  sel.innerHTML = '';
  state.cfg.cases.forEach((c) => sel.appendChild(new Option(`${c.name} — 💎 ${fmt(c.gems)} each`, c.id)));
  battleCfg.caseId = (state.cfg.cases[2] || state.cfg.cases[0]).id;
  sel.value = battleCfg.caseId;
  sel.addEventListener('change', () => {
    battleCfg.caseId = sel.value;
    $('#battle-cost').textContent = fmt(battleCost());
  });
  $$('#battle-count button').forEach((b) => b.addEventListener('click', () => {
    $$('#battle-count button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    battleCfg.count = Number(b.dataset.count);
    $('#battle-cost').textContent = fmt(battleCost());
  }));
  $('#battle-cost').textContent = fmt(battleCost());
  $('#battle-you-name').textContent = state.you ? state.you.name : 'You';
  $('#battle-start').addEventListener('click', runBattle);
}

async function runBattle() {
  if (battleCfg.busy) return;
  battleCfg.busy = true;
  const btn = $('#battle-start');
  btn.disabled = true;
  const sides = $$('.battle-side');
  sides.forEach((s) => s.classList.remove('winner'));
  const youTotal = $('#battle-you-total');
  const botTotal = $('#battle-bot-total');
  youTotal.textContent = '💎 0';
  botTotal.textContent = '💎 0';
  youTotal.classList.remove('win');
  botTotal.classList.remove('win');
  const verdict = $('#battle-verdict');
  verdict.className = 'battle-vs';
  verdict.textContent = 'VS';

  let payload;
  try {
    payload = await api('battle/start', { caseId: battleCfg.caseId, count: battleCfg.count });
  } catch (err) {
    toast(err.message, 'err');
    battleCfg.busy = false;
    btn.disabled = false;
    return;
  }
  applyYou(payload.you, { flash: true });
  $('#battle-you-name').textContent = payload.yourPile.name;
  $('#battle-bot-name').innerHTML = `${esc(payload.oppPile.name)}`;
  audio.gear();

  await Promise.all([
    spinVertical($('#reel-you'), payload.yourPile.items, reelSpeedProfile().battleMs),
    spinVertical($('#reel-bot'), payload.oppPile.items, Math.round(reelSpeedProfile().battleMs * 1.35)),
  ]);

  youTotal.textContent = '💎 ' + fmt(payload.yourPile.total);
  botTotal.textContent = '💎 ' + fmt(payload.oppPile.total);
  const net = payload.pot - payload.cost;
  if (payload.win) {
    verdict.className = 'battle-vs win';
    verdict.textContent = net >= 0 ? `YOU WIN  +💎 ${fmt(net)}` : `YOU WIN  −💎 ${fmt(Math.abs(net))}`;
    youTotal.classList.add('win');
    sides[0].classList.add('winner');
    audio.big();
    toast(net >= 0
      ? `Battle won: +💎 ${fmt(net)} — both piles are yours.`
      : `You won the roll-off, but both piles only add up to 💎 ${fmt(payload.pot)} against a 💎 ${fmt(payload.cost)} entry. Winning the coinflip is not beating the house.`);
  } else {
    verdict.className = 'battle-vs lose';
    verdict.textContent = `BOT WINS  −💎 ${fmt(payload.cost)}`;
    botTotal.classList.add('win');
    sides[1].classList.add('winner');
    audio.lose();
    toast(`Lost the battle: −💎 ${fmt(payload.cost)}.`);
  }
  battleCfg.busy = false;
  btn.disabled = false;
}

/** Vertical reel that scrolls to an item, measured from the DOM (no CSS guessing). */
/** Vertical reel: same rAF rules as the case reel, paced by the same profile. */
function spinVertical(track, items, ms) {
  return new Promise((resolve) => {
    const prof = reelSpeedProfile();
    const lead = Math.min(20, Math.max(6, Math.round(prof.itemsFor(ms) * 0.15)));
    const tail = 12;
    const blank = (n, pre) => {
      for (let i = 0; i < n; i++) {
        track.appendChild(itemEl({ rarity: 'rarity_rare', name: '———', weapon: '', value: 0, seed: i * 5, wearShort: '', uid: pre + i }, { small: true }));
      }
    };
    track.innerHTML = '';
    track.style.transition = 'none';
    track.style.transform = 'translate3d(0, 0, 0)';
    blank(lead, 'l');
    items.forEach((it, i) => track.appendChild(itemEl(it, { small: true, uid: 'r' + i })));
    blank(tail, 't');

    const go = () => {
      const reel = track.parentElement || track;
      const step = trackStep(track, 'Y', 96);
      const jitter = (Math.random() - 0.5) * step * 0.3;
      const distance = reelDistance(track, reel, 'Y', items.length, lead, jitter);
      animateTrack(track, 'Y', 0, -distance, ms, reelEase, () => resolve());
    };
    // one frame for layout, so the measured pitch is real
    requestAnimationFrame(go);
  });
}

/** Bot vs bot battles from the feed, so the Battles page is never empty. */
function renderBattleLog() {
  const box = $('#battle-list');
  if (!box) return;
  state.lastFeed.filter((f) => f.type === 'Battles' && f.battle).slice(0, 6).forEach((f) => {
    const b = f.battle;
    const row = el('div', 'battle-row');
    row.innerHTML = `
      <span class="bt-case">${esc(b.caseName)} ×${b.count}</span>
      <span class="muted tiny">${esc(b.a.name)} vs ${esc(b.b.name)}</span>
      <span class="bt-total"><b class="${b.a.total >= b.b.total ? 'win' : ''}">💎 ${short(b.a.total)}</b> vs <b class="${b.b.total > b.a.total ? 'win' : ''}">💎 ${short(b.b.total)}</b></span>`;
    box.prepend(row);
    while (box.children.length > 8) box.removeChild(box.lastChild);
  });
}

window.initCases = () => { buildCaseGrid(); initCaseFilters(); };
window.initBattles = initBattles;
window.onFeed = renderBattleLog;

/* ==========================================================================
   Case Creator — "Create Your Own Case"
   Name · image · up to 20 items · drop chances · price. Publishing merges the
   case into the shelf for everyone, with a 5% commission per open.
   ========================================================================== */

const creatorState = {
  rules: null,
  art: [],
  mine: [],
  honor: [],
  selected: [],        // items as returned by /api/items (base values included)
  weights: {},         // itemId → weight
  shape: 'house',
  image: null,
  quotes: [],
  q: '',
  rarity: 'all',
  loaded: false,
};

const creatorIds = () => creatorState.selected.map((i) => i.id);

function creatorEven() {
  creatorState.weights = {};
  creatorState.selected.forEach((i) => { creatorState.weights[i.id] = 1; });
}

/** Proportional to rarity, the way every case on the shelf is built. */
function creatorLadder() {
  const byRarity = { rarespecial: 1, rarity_ancient: 6, rarity_legendary: 18, rarity_mythical: 90, rarity_rare: 420, rarity_common: 900, rarity_uncommon: 900 };
  creatorState.weights = {};
  creatorState.selected.forEach((i) => { creatorState.weights[i.id] = byRarity[i.rarity] || 60; });
}

function creatorRarityName(r) {
  const def = state.cfg.rarities[r];
  return def ? def.name : r;
}

/* --------------------------------------------------------------- rendering */

function renderCreatorArt() {
  const box = $('#creator-art');
  if (!box) return;
  box.innerHTML = '';
  creatorState.art.forEach((src) => {
    const b = el('button', 'art-choice' + (creatorState.image === src ? ' active' : ''));
    const img = el('img');
    img.src = src;
    img.alt = 'case art';
    img.loading = 'lazy';
    b.appendChild(img);
    b.addEventListener('click', () => {
      creatorState.image = creatorState.image === src ? null : src;
      renderCreatorArt();
    });
    box.appendChild(b);
  });
  if (!creatorState.art.length) box.appendChild(el('p', 'muted', 'No case art found in public/art/.'));
}

function renderCreatorResults() {
  const box = $('#creator-results');
  if (!box) return;
  box.innerHTML = '';
  const chosen = new Set(creatorIds());
  const list = creatorState.results || [];
  if (!list.length) { box.appendChild(el('p', 'muted', 'No items match that search.')); return; }
  list.forEach((it) => {
    const card = el('button', 'creator-item' + (chosen.has(it.id) ? ' chosen' : ''));
    const swatch = el('span', 'creator-item-rarity');
    swatch.style.background = (state.cfg.rarities[it.rarity] || {}).color || '#888';
    card.appendChild(swatch);
    card.appendChild(el('b', '', esc(it.name)));
    card.appendChild(el('i', '', `💎 ${short(it.base)}`));
    card.addEventListener('click', () => {
      if (chosen.has(it.id)) {
        creatorState.selected = creatorState.selected.filter((x) => x.id !== it.id);
        delete creatorState.weights[it.id];
      } else if (creatorState.selected.length >= (creatorState.rules?.maxItems || 20)) {
        creatorToast(`Up to ${creatorState.rules?.maxItems || 20} items.`, 'err');
      } else {
        creatorState.selected.push(it);
        creatorState.weights[it.id] = creatorState.weights[it.id] || 1;
      }
      renderCreatorResults();
      renderCreatorChances();
      renderCreatorQuote();
    });
    box.appendChild(card);
  });
}

function renderCreatorChances() {
  const box = $('#creator-chances');
  if (!box) return;
  box.innerHTML = '';
  if (!creatorState.selected.length) {
    box.appendChild(el('p', 'muted', 'Pick items above — their drop chances appear here.'));
    return;
  }
  const total = creatorState.selected.reduce((s, i) => s + (creatorState.weights[i.id] || 0), 0) || 1;
  creatorState.selected
    .slice()
    .sort((a, b) => b.base - a.base)
    .forEach((it) => {
      const row = el('div', 'chance-row');
      const swatch = el('span', 'creator-item-rarity');
      swatch.style.background = (state.cfg.rarities[it.rarity] || {}).color || '#888';
      row.appendChild(swatch);
      row.appendChild(el('b', '', esc(it.name)));
      row.appendChild(el('i', '', fmt(creatorRarityName(it.rarity))));
      const pct = ((creatorState.weights[it.id] || 0) / total) * 100;
      row.appendChild(el('span', 'chance-pct', `${pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}%`));
      const input = el('input', 'chance-input');
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.value = String(creatorState.weights[it.id] || 1);
      input.addEventListener('input', () => {
        creatorState.weights[it.id] = Math.max(0, Number(input.value) || 0);
        renderCreatorChances();
        renderCreatorQuote();
      });
      row.appendChild(input);
      const del = el('button', 'btn btn-ghost tiny', '✕');
      del.addEventListener('click', () => {
        creatorState.selected = creatorState.selected.filter((x) => x.id !== it.id);
        renderCreatorResults();
        renderCreatorChances();
        renderCreatorQuote();
      });
      row.appendChild(del);
      box.appendChild(row);
    });
  box.appendChild(el('div', 'chance-sum', `Chances are normalised to 100% when you publish (weights ${fmt(total)}).`));
}

/** Live EV preview: same maths the server uses, printed honestly. */
function creatorEv(items, chances) {
  const wear = state.cfg.wears || [];
  const st = state.cfg.stattrak || { chance: 0.1, mult: 1.5 };
  const wearEv = wear.reduce((s, w) => s + w.chance * (w.mult ?? 1), 0) || 1;
  const stEv = 1 + st.chance * (st.mult - 1);
  const ev = items.reduce((s, i, idx) => s + (chances[idx] / 100) * i.base, 0);
  return ev * wearEv * stEv;
}

function renderCreatorQuote() {
  const box = $('#creator-quote');
  if (!box) return;
  box.innerHTML = '';
  const ids = creatorIds();
  if (ids.length < (creatorState.rules?.minItems || 6)) {
    box.appendChild(el('p', 'muted', `Add at least ${creatorState.rules?.minItems || 6} items to see the price.`));
    if ($('#creator-earn')) $('#creator-earn').textContent = '0';
    return;
  }
  const total = creatorState.selected.reduce((s, i) => s + (creatorState.weights[i.id] || 0), 0) || 1;
  const chances = creatorState.selected.map((i) => ((creatorState.weights[i.id] || 0) / total) * 100);
  const ev = creatorEv(creatorState.selected, chances);
  const rates = { player: 0.97, house: 0.90, creator: 0.82 };
  creatorState.quotes = Object.entries(rates).map(([key, rate]) => {
    const raw = ev / rate;
    const gems = Math.max(10, raw < 500 ? Math.round(raw) : Math.round(raw / 5) * 5);   // same rounding as the server
    return { key, gems, rate, returnRate: ev / gems };
  });
  creatorState.quotes.forEach((q) => {
    const b = el('button', 'quote-card' + (creatorState.shape === q.key ? ' active' : ''));
    b.appendChild(el('b', '', q.key === 'player' ? 'Player-favoured' : q.key === 'house' ? 'The house row' : 'Creator-favoured'));
    b.appendChild(el('span', 'quote-price', `💎 ${fmt(q.gems)}`));
    b.appendChild(el('i', '', `${Math.round(q.returnRate * 100)}% back · you earn 💎 ${fmt(Math.round(q.gems * (creatorState.rules?.commission || 0.05)))}`));
    b.addEventListener('click', () => {
      creatorState.shape = q.key;
      renderCreatorQuote();
    });
    box.appendChild(b);
  });
  const picked = creatorState.quotes.find((q) => q.key === creatorState.shape) || creatorState.quotes[1];
  if ($('#creator-earn')) $('#creator-earn').textContent = fmt(Math.round(picked.gems * (creatorState.rules?.commission || 0.05)));
}

function renderCreatorMine() {
  const box = $('#creator-mine');
  if (!box) return;
  box.innerHTML = '';
  if (!creatorState.mine.length) {
    box.appendChild(el('p', 'muted', 'You have not created any cases yet!'));
    return;
  }
  creatorState.mine.forEach((c) => {
    const row = el('div', 'mine-row');
    if (c.image) {
      const img = el('img');
      img.src = c.image; img.alt = c.name; img.loading = 'lazy';
      row.appendChild(img);
    }
    const info = el('div', 'mine-info');
    info.appendChild(el('b', '', esc(c.name)));
    info.appendChild(el('i', '', `💎 ${fmt(c.gems)} · ${c.items} items · opened ${fmt(c.opens)}× · earned 💎 ${fmt(c.earned)}`));
    row.appendChild(info);
    const del = el('button', 'btn btn-ghost tiny', 'Delete');
    del.addEventListener('click', async () => {
      try {
        await api('creator/delete', { id: c.id });
        creatorToast(`Deleted "${c.name}".`, 'gold');
        await refreshCfg();
        await loadCreator(true);
      } catch (err) { creatorToast(err.message, 'err'); }
    });
    row.appendChild(del);
    box.appendChild(row);
  });
}

function renderCreatorHonor() {
  const box = $('#creator-honor');
  if (!box) return;
  box.innerHTML = '';
  if (!creatorState.honor.length) {
    box.appendChild(el('p', 'muted', 'Nobody has published a case yet — be the first.'));
    return;
  }
  creatorState.honor.slice(0, 8).forEach((c) => {
    const row = el('div', 'mine-row');
    if (c.image) {
      const img = el('img');
      img.src = c.image; img.alt = c.name; img.loading = 'lazy';
      row.appendChild(img);
    }
    const info = el('div', 'mine-info');
    info.appendChild(el('b', '', esc(c.name)));
    info.appendChild(el('i', '', `by ${esc(c.by)} · 💎 ${fmt(c.gems)} · ${fmt(c.opens)} opens · creator made 💎 ${fmt(c.earned)}`));
    row.appendChild(info);
    box.appendChild(row);
  });
}

function creatorToast(msg, kind) {
  const box = $('#creator-error');
  if (!box) { toast(msg, kind); return; }
  box.hidden = false;
  box.textContent = msg;
  box.className = 'creator-note ' + (kind === 'err' ? 'bad' : 'good');
  clearTimeout(creatorToast.timer);
  creatorToast.timer = setTimeout(() => { box.hidden = true; }, 6000);
}

/* ------------------------------------------------------------- data loading */

async function searchCreatorItems() {
  const q = encodeURIComponent(creatorState.q);
  const rarity = encodeURIComponent(creatorState.rarity);
  try {
    const res = await fetch(`api/items?q=${q}&rarity=${rarity}&limit=48`).then((r) => r.json());
    creatorState.results = res.items || [];
  } catch { creatorState.results = []; }
  renderCreatorResults();
}

async function loadCreator(force) {
  if (creatorState.loaded && !force) { renderCreatorMine(); renderCreatorHonor(); return; }
  const box = $('#creator-results');
  try {
    const st = await fetch(`api/creator${state.pid ? `?pid=${encodeURIComponent(state.pid)}` : ''}`).then((r) => r.json());
    creatorState.rules = st.rules;
    creatorState.art = st.art || [];
    creatorState.mine = st.mine || [];
    creatorState.loaded = true;
    const honor = await fetch('api/honor-roll').then((r) => r.json()).catch(() => ({ cases: [] }));
    creatorState.honor = honor.cases || [];
    if ($('#creator-universe')) $('#creator-universe').textContent = `${fmt(st.universe)} items to build from`;
    if ($('#creator-commission-chip')) $('#creator-commission-chip').textContent = `${Math.round((st.rules?.commission || 0.05) * 100)}% commission per open`;
  } catch (err) {
    if (box) box.innerHTML = '';
    creatorToast('Could not load the creator: ' + err.message, 'err');
    return;
  }
  renderCreatorArt();
  renderCreatorMine();
  renderCreatorHonor();
  await searchCreatorItems();
  renderCreatorChances();
  renderCreatorQuote();
}

function initCreator() {
  const nameInput = $('#creator-name');
  const qInput = $('#creator-q');
  const raritySel = $('#creator-rarity');
  if (!nameInput || !qInput || !raritySel) return;

  // rarity filter options
  if (!raritySel.options.length) {
    const order = ['all', 'rarespecial', 'rarity_ancient', 'rarity_legendary', 'rarity_mythical', 'rarity_rare', 'rarity_uncommon', 'rarity_common'];
    order.forEach((r) => {
      const label = r === 'all' ? 'All rarities' : creatorRarityName(r);
      raritySel.appendChild(new Option(label, r));
    });
  }

  let t = null;
  qInput.addEventListener('input', () => {
    creatorState.q = qInput.value.trim();
    clearTimeout(t);
    t = setTimeout(searchCreatorItems, 180);
  });
  raritySel.addEventListener('change', () => { creatorState.rarity = raritySel.value; searchCreatorItems(); });
  $('#creator-even').addEventListener('click', () => { creatorEven(); renderCreatorChances(); renderCreatorQuote(); });
  $('#creator-ladder').addEventListener('click', () => { creatorLadder(); renderCreatorChances(); renderCreatorQuote(); });
  $('#creator-clear').addEventListener('click', () => {
    creatorState.selected = [];
    creatorState.weights = {};
    renderCreatorResults();
    renderCreatorChances();
    renderCreatorQuote();
  });
  $('#creator-publish').addEventListener('click', publishCreator);
}

async function publishCreator() {
  const name = ($('#creator-name').value || '').trim();
  if (creatorState.selected.length < (creatorState.rules?.minItems || 6)) {
    creatorToast(`Pick at least ${creatorState.rules?.minItems || 6} items.`, 'err');
    return;
  }
  const total = creatorState.selected.reduce((s, i) => s + (creatorState.weights[i.id] || 0), 0) || 1;
  const chances = creatorState.selected.map((i) => (creatorState.weights[i.id] || 0) / total);
  const btn = $('#creator-publish');
  btn.disabled = true;
  try {
    const res = await api('creator/create', {
      name, items: creatorIds(), chances, image: creatorState.image, shape: creatorState.shape,
    });
    const c = res.case;
    creatorToast(`Published "${c.name}" — 💎 ${fmt(c.gems)} a case, you earn 💎 ${fmt(c.commission)} per open. It is on the shelf now.`, 'good');
    creatorState.selected = [];
    creatorState.weights = {};
    creatorState.image = null;
    $('#creator-name').value = '';
    await refreshCfg();
    creatorState.loaded = false;
    await loadCreator(true);
    renderCreatorArt();
  } catch (err) {
    creatorToast(err.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

/* The creator page wakes up when its nav entry is clicked, and the grid is
 * rebuilt when the shelf is (a published case has to appear straight away).
 * This listens on the nav itself so it keeps working whatever games.js does
 * with window.onViewChange. */
document.addEventListener('click', (e) => {
  const nav = e.target.closest('.nav-item[data-view]');
  if (!nav) return;
  if (nav.dataset.view === 'creator') {
    initCreator();
    loadCreator(false).catch(() => {});
  }
  if (nav.dataset.view === 'cases') { buildCaseGrid(); initCaseFilters(); }
});

