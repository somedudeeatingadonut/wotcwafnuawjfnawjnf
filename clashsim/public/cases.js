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
 *  The winner's slot is measured from live rects (its own, not a pitch guess),
 *  so mixed card widths cannot drift the landing. Returns a positive "move the
 *  track left/up by this much" amount; the caller animates to `-distance`. */
function reelDistance(track, win, axis, itemCount, lead, jitter) {
  const trackRect = track.getBoundingClientRect();
  const winRect = win.getBoundingClientRect();
  const first = track.firstElementChild;
  const firstRect = first ? first.getBoundingClientRect() : null;
  const vertical = axis === 'Y';
  const fallbackStep = vertical ? 96 : 129.6;
  const step = trackStep(track, axis, fallbackStep);
  const idx = Math.max(0, Math.min(track.children.length - 1, Math.round(lead + (itemCount - 1) / 2)));
  const target = track.children[idx];
  const tRect = target ? target.getBoundingClientRect() : null;
  const size = tRect ? (vertical ? tRect.height : tRect.width)
    : (firstRect ? (vertical ? firstRect.height : firstRect.width) : step);
  const winSize = (vertical ? winRect.height : winRect.width) || (vertical ? 190 : 600);
  // where the winner starts, relative to the track's own box (padding, borders)
  const pad = tRect ? (vertical ? tRect.top - trackRect.top : tRect.left - trackRect.left)
    : (firstRect ? (vertical ? firstRect.top - trackRect.top : firstRect.left - trackRect.left) : 0);
  // where the track's box starts, relative to the window's box
  const offset = (vertical ? trackRect.top - winRect.top : trackRect.left - winRect.left) || 0;
  const winnerCentre = tRect
    ? offset + pad + size / 2                                  // live slot of the winner
    : offset + pad + (lead + (itemCount - 1) / 2) * step + size / 2;
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

/* The case browser. The real lobby sorts its 400-odd cases with category chips
 * (Best AWP, Best Knives, Free Cases…), a type filter and a search box, and the
 * cards stay compact — the full drop table lives in the modal. Same here. */

const CATEGORIES = [
  { id: 'all', label: 'All Cases' },
  { id: 'best-knives', label: 'Best Knives' },
  { id: 'best-gloves', label: 'Best Gloves' },
  { id: 'best-stickers', label: 'Best Stickers' },
  { id: 'best-awp', label: 'Best AWP' },
  { id: 'best-weapon', label: 'Best Weapon' },
  { id: 'highest-roi', label: 'Highest ROI' },
  { id: 'most-expensive', label: 'Most Expensive' },
  { id: 'community', label: 'Community Cases' },
];

const caseUi = { cat: 'all', type: 'all', sort: 'popular', q: '' };

/** Real sites print a risk label next to the price (Low → Extreme). */
const riskOf = (c) => (c.gems >= 15000 ? { label: 'Extreme', cls: 'risk-extreme' }
  : c.gems >= 5000 ? { label: 'High', cls: 'risk-high' }
    : c.gems >= 1500 ? { label: 'Medium', cls: 'risk-medium' }
      : { label: 'Low', cls: 'risk-low' });

const kindLabel = (c) => (c.kind === 'community' ? 'community case'
  : c.kind === 'sticker' ? 'sticker capsule'
    : c.kind === 'original' ? 'clash original' : 'valve case');

function caseMatches(c, cat) {
  switch (cat) {
    case 'best-knives': return c.kind === 'original' && /knife/i.test(c.name);
    case 'best-gloves': return c.kind === 'original' && /glove/i.test(c.name);
    case 'best-stickers': return c.kind === 'sticker';
    case 'best-awp': return /awp|ssg|scar|sniper|nightshade/i.test(c.name) || (c.odds || []).some((o) => /awp/i.test(o.name));
    case 'best-weapon': return (c.returnRate || 0) >= 0.88 && c.gems >= 1000;
    case 'highest-roi': return (c.returnRate || 0) >= 0.89;
    case 'most-expensive': return c.gems >= 8000;
    case 'community': return c.kind === 'community';
    default: return true;
  }
}

/** "Popularity" is a stable pseudo-random number per case — the same fake stat
 *  the real lobby prints ("Opened 1,204 times"), seeded off the case id. */
function caseOpens(c) {
  let h = 0;
  for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) >>> 0;
  return 400 + (h % 46000);
}

function buildCaseGrid() {
  const grid = $('#case-grid');
  if (!grid) return;
  const all = state.cfg.cases;
  const q = caseUi.q.trim().toLowerCase();

  let list = all.filter((c) => caseMatches(c, caseUi.cat)
    && (caseUi.type === 'all' || c.kind === caseUi.type)
    && (!q || c.name.toLowerCase().includes(q)));

  const ROI = { highest_roi: 0 };
  switch (caseUi.sort) {
    case 'price-asc': list.sort((a, b) => a.gems - b.gems); break;
    case 'price-desc': list.sort((a, b) => b.gems - a.gems); break;
    case 'roi': list.sort((a, b) => b.returnRate - a.returnRate); break;
    case 'new': list.sort((a, b) => caseOpens(b) - caseOpens(a)); break;
    default: list.sort((a, b) => caseOpens(b) - caseOpens(a));
  }

  grid.innerHTML = '';
  list.forEach((c) => {
    const card = el('div', 'case-card compact');
    const art = el('div', 'case-art');
    const src = c.art || c.image;
    if (src) {
      const img = el('img');
      img.src = src;
      img.alt = c.name;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => { img.remove(); art.innerHTML = caseFallbackArt(); };
      art.appendChild(img);
    } else art.innerHTML = caseFallbackArt();
    card.appendChild(art);

    const risk = riskOf(c);
    const badges = el('div', 'case-badges');
    badges.appendChild(el('span', `chip risk ${risk.cls}`, risk.label));
    if (c.kind === 'community') badges.appendChild(el('span', 'chip chip-community', 'community'));
    if (c.kind === 'sticker') badges.appendChild(el('span', 'chip chip-sticker', 'stickers'));
    card.appendChild(badges);

    const nameRow = el('div', 'case-name');
    nameRow.appendChild(el('h3', '', esc(c.name)));
    nameRow.appendChild(el('span', 'case-price', `💎 ${fmt(c.gems)}`));
    card.appendChild(nameRow);
    card.appendChild(el('div', 'case-tag', `${kindLabel(c)} · ${c.itemCount} items · opened ${short(caseOpens(c))}×`));
    card.appendChild(oddsBars(c));

    const actions = el('div', 'case-actions');
    const openBtn = el('button', 'btn btn-primary', `Open 💎 ${short(c.gems)}`);
    openBtn.addEventListener('click', () => openCaseFlow(c, 1));
    const five = el('button', 'btn btn-ghost', '×5');
    five.addEventListener('click', () => openCaseFlow(c, 5));
    actions.appendChild(openBtn);
    actions.appendChild(five);
    card.appendChild(actions);
    grid.appendChild(card);
  });

  const more = $('#case-more');
  if (more) more.textContent = list.length ? `${list.length} of ${all.length} cases — click one for its full drop table` : 'No cases match that filter.';
}

function buildCaseToolbar() {
  const chips = $('#case-cats');
  if (!chips) return;
  chips.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const b = el('button', `case-chip${caseUi.cat === cat.id ? ' active' : ''}`, cat.label);
    b.addEventListener('click', () => { caseUi.cat = cat.id; buildCaseToolbar(); buildCaseGrid(); });
    chips.appendChild(b);
  });
  const search = $('#case-search');
  if (search && !search.dataset.wired) {
    search.dataset.wired = '1';
    search.value = caseUi.q;
    search.addEventListener('input', () => { caseUi.q = search.value; buildCaseGrid(); });
  }
  const type = $('#case-type');
  if (type && !type.dataset.wired) {
    type.dataset.wired = '1';
    type.addEventListener('change', () => { caseUi.type = type.value; buildCaseGrid(); });
  }
  const sort = $('#case-sort');
  if (sort && !sort.dataset.wired) {
    sort.dataset.wired = '1';
    sort.addEventListener('change', () => { caseUi.sort = sort.value; buildCaseGrid(); });
  }
}

/* ------------------------------------------------------- the case modal */

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
  oddsBox.appendChild(el('p', 'odds-note',
    (caseDef.kind === 'sticker'
      ? 'Stickers have no wear and no StatTrak™ — the value on the card is what lands. '
      : 'Wear (Factory New → Battle-Scarred) is rolled per item and scales its value; StatTrak™ adds ×1.5 on ~10% of drops. ')
    + `Average return ≈${Math.round((detail ? detail.returnRate : caseDef.returnRate) * 100)}%.`));
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

const battleCfg = { caseId: null, count: 1, mode: 'normal', players: 2, busy: false };

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
  $$('#battle-count button').forEach((b) => {
    b.addEventListener('click', () => {
      $$('#battle-count button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      battleCfg.count = Number(b.dataset.count);
      $('#battle-cost').textContent = fmt(battleCost());
    });
  });
  const modeSel = $('#battle-mode');
  if (modeSel && !modeSel.dataset.wired) {
    modeSel.dataset.wired = '1';
    modeSel.addEventListener('change', () => { battleCfg.mode = modeSel.value; });
  }
  $$('#battle-players button').forEach((b) => {
    b.addEventListener('click', () => {
      $$('#battle-players button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      battleCfg.players = Number(b.dataset.players);
    });
  });
  const youLabel = $('#battle-you-name');
  if (youLabel) youLabel.textContent = state.you ? state.you.name : 'You';
  $('#battle-start').addEventListener('click', runBattle);
}

/** Build one seat per player: avatar, name, vertical reel, running total. */
function buildBattleSeats(seats) {
  const box = $('#battle-seats');
  if (!box) return;
  box.innerHTML = '';
  seats.forEach((seat) => {
    const side = el('div', `battle-side${seat.you ? ' is-you' : ''}`);
    const head = el('div', 'battle-name');
    const avatar = el('span', 'avatar');
    avatar.style.background = `hsl(${seat.hue || 260} 60% 45%)`;
    head.appendChild(avatar);
    head.appendChild(el('span', null, esc(seat.name) + (seat.you ? ' (you)' : '')));
    side.appendChild(head);
    const reel = el('div', 'reel');
    const track = el('div', 'reel-track');
    track.id = 'reel-' + (seat.you ? 'you' : seat.id);
    reel.appendChild(track);
    side.appendChild(reel);
    const total = el('div', 'battle-total', '💎 0');
    total.id = 'battle-total-' + (seat.you ? 'you' : seat.id);
    side.appendChild(total);
    box.appendChild(side);
  });
}

async function runBattle() {
  if (battleCfg.busy) return;
  battleCfg.busy = true;
  const btn = $('#battle-start');
  btn.disabled = true;
  const verdict = $('#battle-verdict');
  verdict.className = 'battle-vs';
  verdict.textContent = 'VS';

  let payload;
  try {
    payload = await api('battle/start', {
      caseId: battleCfg.caseId, count: battleCfg.count,
      mode: battleCfg.mode, players: battleCfg.players,
    });
  } catch (err) {
    toast(err.message, 'err');
    battleCfg.busy = false;
    btn.disabled = false;
    return;
  }
  // a stale server can answer with the old two-pile shape; degrade instead of dying
  if (!payload.seats && payload.yourPile) {
    payload.seats = [
      { ...payload.yourPile, you: true, id: 'you', winner: payload.win },
      { ...payload.oppPile, you: false, id: 'bot_0', winner: !payload.win },
    ];
  }
  applyYou(payload.you, { flash: true });
  buildBattleSeats(payload.seats);
  audio.gear();

  const prof = reelSpeedProfile();
  await Promise.all(payload.seats.map((seat, i) => {
    const track = $(seat.you ? '#reel-you' : `#reel-${seat.id}`);
    if (!track) return Promise.resolve();
    // the seats land slightly apart, so the last reel is the last thing you see
    return spinVertical(track, seat.items, Math.round(prof.battleMs * (1 + i * 0.18)));
  }));

  payload.seats.forEach((seat) => {
    const node = $(seat.you ? '#battle-total-you' : `#battle-total-${seat.id}`);
    if (!node) return;
    node.textContent = '💎 ' + fmt(seat.total);
    if (seat.winner) {
      node.classList.add('win');
      const side = node.closest('.battle-side');
      if (side) side.classList.add('winner');
    }
  });

  const net = payload.share - payload.cost;
  const fmtNet = (v) => (v >= 0 ? `+💎 ${fmt(v)}` : `−💎 ${fmt(Math.abs(v))}`);
  if (payload.win) {
    verdict.className = 'battle-vs win';
    verdict.textContent = payload.mode === 'group'
      ? `SPLIT  ${fmtNet(net)}`
      : `YOU WIN  ${fmtNet(net)}`;
    audio.big();
    toast(payload.mode === 'group'
      ? `Group battle: pot 💎 ${fmt(payload.pot)} split ${payload.players} ways — you got 💎 ${fmt(payload.share)}.`
      : `Battle won: ${fmtNet(net)} — the pot is yours (💎 ${fmt(payload.pot)}).`);
  } else {
    verdict.className = 'battle-vs lose';
    verdict.textContent = `${payload.winners.join(' & ').slice(0, 24).toUpperCase()} WINS  −💎 ${fmt(payload.cost)}`;
    audio.lose();
    toast(`Lost the ${payload.mode} battle: −💎 ${fmt(payload.cost)}.`);
  }
  battleCfg.busy = false;
  btn.disabled = false;
}

/** Vertical reel that scrolls to an item, measured from the DOM (no CSS guessing). */
/** Vertical reel: same rAF rules as the case reel, paced by the same profile. */
function spinVertical(track, items, ms) {
  return new Promise((resolve) => {
    const prof = reelSpeedProfile();
    // walk the same items-per-second pace as the case reel: the further the
    // track travels, the more filler you see before the winner lands
    const lead = Math.max(8, prof.itemsFor(ms));
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
    // seats carry every player; a/b are the legacy two-seat shape
    const seats = (b.seats && b.seats.length) ? b.seats : [
      { name: b.a.name, total: b.a.total }, { name: b.b.name, total: b.b.total },
    ];
    const best = Math.max(...seats.map((s) => s.total));
    const modeTag = b.mode && b.mode !== 'normal' ? ` · ${b.mode}` : '';
    const row = el('div', 'battle-row');
    row.innerHTML = `
      <span class="bt-case">${esc(b.caseName)} ×${b.count}${esc(modeTag)}</span>
      <span class="muted tiny">${seats.map((s) => esc(s.name)).join(' vs ')}</span>
      <span class="bt-total">${seats.map((s) => `<b class="${s.winner != null ? (s.winner ? 'win' : '') : (s.total === best ? 'win' : '')}">💎 ${short(s.total)}</b>`).join(' · ')}</span>`;
    box.prepend(row);
    while (box.children.length > 8) box.removeChild(box.lastChild);
  });
}

window.initCases = () => { buildCaseToolbar(); buildCaseGrid(); };
window.initBattles = initBattles;
window.onFeed = renderBattleLog;
