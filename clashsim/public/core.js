/* ==========================================================================
   core.js — session, polling, sound, feeds, chat, inventory, rewards, race
   clash.sim · fake currency only · every other player is a bot
   ========================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const state = {
  pid: null,
  cfg: null,
  you: null,
  crash: null,
  double: null,
  champion: null,
  race: null,
  view: 'home',
  chatSeq: 0,
  feedSeq: 0,
  lastFeed: [],
  connected: false,
  pollTimer: null,
  invFilter: 'all',
  done: {},
};

/* --------------------------------------------------------- motion & speed */

/** True when the OS asks for reduced motion. Defined here because the reel
 *  speed default below depends on it (games.js used to declare it). */
const reduceMotion = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
})();

/* Reel speeds.
 *
 * The real case reel in the clash.gg bundle is a component that walks 70
 * positions — `startPosition: 10, finalPosition: 80, itemCount: 90` — over
 * `duration ?? 6` seconds, after `delay ?? 1.5`, eased with cubic-bezier
 * (.1, 0, .2, 1). These profiles keep that shape and make the pace a choice;
 * `traverse` is how many items the reel walks past, so a slower speed shows
 * you more items rather than crawling through the same handful. */
const REEL_SPEEDS = {
  turbo:  { label: 'Turbo',  caseMs: 1200,  battleMs: 800,   traverse: 10 },
  quick:  { label: 'Quick',  caseMs: 3400,  battleMs: 2200,  traverse: 24 },
  normal: { label: 'Normal', caseMs: 10200, battleMs: 6600,  traverse: 70 },
  slow:   { label: 'Slow',   caseMs: 16000, battleMs: 10400, traverse: 110 },
};
const REEL_SPEED_KEYS = ['turbo', 'quick', 'normal', 'slow'];

let reelSpeedKey = null;

/** The active profile, with everything the reel code needs derived from it. */
function reelSpeedProfile() {
  if (!reelSpeedKey) {
    let saved = null;
    try { saved = localStorage.getItem('clashsim.reelSpeed'); } catch { saved = null; }
    // an explicit choice always wins, even over the OS reduced-motion default
    reelSpeedKey = REEL_SPEED_KEYS.includes(saved) ? saved : (reduceMotion ? 'turbo' : 'normal');
  }
  const prof = { ...REEL_SPEEDS[reelSpeedKey], key: reelSpeedKey };
  prof.pace = prof.traverse / (prof.caseMs / 1000);                    // items per second
  prof.delayMs = Math.min(1500, Math.round(prof.caseMs * 0.15));       // clash starts at 1.5s
  prof.settleMs = Math.round(prof.caseMs * 0.04);                      // beat before the reveal
  prof.itemsFor = (ms) => Math.max(6, Math.round((ms / 1000) * prof.pace));
  return prof;
}

function setReelSpeed(key) {
  if (!REEL_SPEED_KEYS.includes(key)) return;
  reelSpeedKey = key;
  try { localStorage.setItem('clashsim.reelSpeed', key); } catch { /* private mode */ }
  $$('[data-reel-speed]').forEach((sel) => { if (sel.value !== key) sel.value = key; });
}

/** Fill every <select data-reel-speed> on the page and keep them in sync. */
function initReelSpeed() {
  const current = reelSpeedProfile();
  $$('[data-reel-speed]').forEach((sel) => {
    if (!sel.options.length) {
      REEL_SPEED_KEYS.forEach((k) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = REEL_SPEEDS[k].label;
        sel.appendChild(opt);
      });
    }
    sel.value = current.key;
    if (!sel.dataset.reelSpeedWired) {
      sel.dataset.reelSpeedWired = '1';
      sel.addEventListener('change', () => setReelSpeed(sel.value));
    }
  });
}

/* ------------------------------------------------------------- utilities */

const fmt = (n, d = 0) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

function short(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (v >= 1e5) return (n / 1e3).toFixed(0) + 'k';
  if (v >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return fmt(Math.round(n));
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

const FACES = ['🦊', '🐺', '🐸', '🐙', '🦉', '🐲', '🐝', '🦈', '🐼', '🦅', '🐢', '👾'];
/** 2.4x · 18.9x · 1.31kx — never a paragraph of decimals. */
function fmtMult(m) {
  const v = Number(m) || 0;
  if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k×';
  if (v >= 100) return v.toFixed(0) + '×';
  return v.toFixed(2).replace(/\.00$/, '') + '×';
}

const rarityColor = (id) => (state.cfg && state.cfg.rarities[id] ? state.cfg.rarities[id].color : '#8a93a8');
const rarityName = (id) => (state.cfg && state.cfg.rarities[id] ? state.cfg.rarities[id].short || state.cfg.rarities[id].name : id);

function avatarEl(hue = 260, face = 0, size = 28) {
  const h = Number.isFinite(Number(hue)) ? Number(hue) : 260;
  const f = Number.isFinite(Number(face)) ? Number(face) : 0;
  const a = el('span', 'avatar', FACES[f % FACES.length]);
  a.style.setProperty('--hue', h);
  a.style.width = a.style.height = size + 'px';
  a.style.fontSize = Math.max(10, size * 0.45) + 'px';
  return a;
}

/* ----------------------------------------------------------------- audio
 * The old build beeped on a requestAnimationFrame loop and the tick sound
 * stacked up until it was a continuous whine. This one:
 *   · reuses one AudioContext (browsers hate being spammed with new ones)
 *   · caps how many short sounds can be in flight at once
 *   · rate-limits the crash tick and only plays it when it means something
 */

const audio = {
  ctx: null,
  enabled: true,
  live: 0,
  lastTick: 0,
  tickArmed: false,

  unlock() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },

  tone(freq, ms = 60, type = 'sine', gain = 0.05) {
    if (!this.enabled || !this.ctx) return;
    if (this.live > 6) return;                 // never let blips pile up
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.connect(g).connect(this.ctx.destination);
      this.live++;
      osc.onended = () => { this.live = Math.max(0, this.live - 1); };
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.02);
    } catch { /* audio is a nicety, never a crash */ }
  },

  click() { this.tone(300, 40, 'square', 0.02); },
  bet() { this.tone(520, 70, 'triangle', 0.035); },
  win() { this.tone(660, 90, 'triangle', 0.05); setTimeout(() => this.tone(990, 110, 'triangle', 0.05), 80); },
  big() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 130, 'triangle', 0.05), i * 85)); },
  lose() { this.tone(180, 160, 'sawtooth', 0.04); setTimeout(() => this.tone(120, 220, 'sawtooth', 0.04), 110); },
  chip() { this.tone(760, 30, 'square', 0.02); },
  gear() { this.tone(240, 50, 'square', 0.03); },

  /** Crash ticker: hard-limited to 4/s, only while a stake is live on screen. */
  tick() {
    const now = Date.now();
    if (now - this.lastTick < 240) return;
    this.lastTick = now;
    this.tone(880, 22, 'square', 0.012);
  },
};

/* ------------------------------------------------------------------- api */

async function api(route, body) {
  const url = `/api/${route}${route.includes('?') ? '&' : '?'}pid=${encodeURIComponent(state.pid || '')}`;
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body || {}),
  });
  let data = {};
  try { data = await res.json(); } catch { /* fine */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ---------------------------------------------------------------- toasts */

function toast(msg, kind = '') {
  const t = el('div', 'toast ' + kind, esc(msg));
  $('#toast-root').appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .3s, transform .3s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 320);
  }, 3600);
}

/* ----------------------------------------------------------------- modal */

const modal = {
  open(title, bodyNode, footNodes) {
    $('#modal-title').textContent = title;
    const body = $('#modal-body');
    body.innerHTML = '';
    if (typeof bodyNode === 'string') body.innerHTML = bodyNode;
    else if (bodyNode) body.appendChild(bodyNode);
    const foot = $('#modal-foot');
    foot.innerHTML = '';
    (footNodes || []).forEach((n) => foot.appendChild(n));
    $('#modal-root').hidden = false;
  },
  close() { $('#modal-root').hidden = true; },
};
document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) modal.close(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.close(); });

/* ------------------------------------------------------- item rendering */

function itemEl(item, opts = {}) {
  const rc = rarityColor(item.rarity);
  const node = el('div', 'item' + (opts.small ? ' small' : '') + (opts.pop ? ' item-pop' : ''));
  node.style.setProperty('--rc', rc);
  node.dataset.uid = item.uid || '';
  const h = (item.seed || 0) % 360;
  node.style.setProperty('--h', h);
  node.style.setProperty('--x1', 15 + ((item.seed || 0) % 40) + '%');
  node.style.setProperty('--y1', 20 + (((item.seed || 0) >> 2) % 45) + '%');
  node.style.setProperty('--x2', 55 + (((item.seed || 0) >> 3) % 40) + '%');
  node.style.setProperty('--y2', 55 + (((item.seed || 0) >> 4) % 40) + '%');

  const art = el('div', 'item-art');
  if (item.image) {
    const img = el('img');
    img.src = item.image;
    img.alt = item.name || '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    // Steam's CDN is not always reachable (offline, blocked, rate limited):
    // fall back to generated art so a card never renders empty.
    img.onerror = () => { img.remove(); art.appendChild(el('div', 'gen')); };
    art.appendChild(img);
  } else {
    art.appendChild(el('div', 'gen'));
  }

  const wearBit = item.wearShort
    ? `<span class="item-wear">${esc(item.wearShort)}${item.float != null ? ' · ' + Number(item.float).toFixed(3) : ''}</span>`
    : '';
  node.appendChild(art);
  node.insertAdjacentHTML('beforeend', `
    <div class="item-weapon">${esc(item.weapon || '')}${item.stattrak ? ' <span class="item-st">StatTrak™</span>' : ''}</div>
    <div class="item-name" title="${esc(item.name || '')}">${esc((item.pattern || item.name || '').replace(/^StatTrak™ /, ''))}</div>
    <div class="item-foot">
      <span class="item-rar" style="background:${rc}">${esc(rarityName(item.rarity))}</span>
      <span class="item-val">${item.value ? '💎 ' + fmt(item.value) : ''}</span>
    </div>
    <div class="item-foot">${wearBit}</div>`);
  return node;
}

/* ---------------------------------------------------------------- header */

function renderHeader() {
  const you = state.you;
  if (!you) return;
  $('#gems-value').textContent = fmt(you.balance, 2);
  $('#user-name').textContent = you.name;
  $('#user-level').textContent = you.level;
  const av = $('#user-avatar');
  av.textContent = FACES[you.face % FACES.length];
  av.style.setProperty('--hue', you.hue);
  $('#inv-badge').textContent = fmt(you.invCount);

  const span = Math.max(1, you.xpNext - you.xpPrev);
  const pct = Math.max(0, Math.min(100, ((you.xp - you.xpPrev) / span) * 100));
  $('#level-fill').style.width = pct + '%';
  $('#level-num').textContent = you.level;
  const ring = $('.level-ring');
  if (ring) ring.style.setProperty('--p', pct + '%');
  $('#level-xp').textContent = `${fmt(Math.max(0, you.xp - you.xpPrev))} / ${fmt(span)} xp`;

  // freebies
  const claimBtn = $('#claim-cases-btn');
  if (you.freeCaseIn > 0) {
    claimBtn.textContent = `🎁 Next free cases in ${Math.ceil(you.freeCaseIn / 60)}m`;
    claimBtn.disabled = true;
  } else {
    claimBtn.textContent = '🎁 Claim Free 3 Cases';
    claimBtn.disabled = false;
  }
  const bonusBtn = $('#bonus-btn');
  if (you.bonusIn > 0) { bonusBtn.disabled = true; bonusBtn.textContent = `Free Gems ${you.bonusIn}s`; }
  else { bonusBtn.disabled = false; bonusBtn.textContent = 'Free Gems'; }

  const vchip = $('#voucher-chip');
  if (vchip) vchip.textContent = `🎁 ${you.freeCases} free case${you.freeCases === 1 ? '' : 's'}`;

  // rewards view
  $('#reward-gems-timer').textContent = you.bonusIn > 0 ? `ready in ${you.bonusIn}s` : 'ready now';
  $('#reward-cases-timer').innerHTML = you.freeCaseIn > 0
    ? `ready in ${Math.ceil(you.freeCaseIn / 60)} minutes · you hold <b>${you.freeCases}</b>`
    : `ready now · you hold <b>${you.freeCases}</b>`;
  $('#reward-level-bonus').textContent = `💎 ${fmt((you.level) * 250)}`;
  if ($('#reward-level-fill')) $('#reward-level-fill').style.width = pct + '%';
}

function applyYou(you, opts = {}) {
  if (!you) return;
  const before = state.you ? state.you.balance : you.balance;
  state.you = you;
  renderHeader();
  if (opts.flash && you.balance !== before) {
    const pill = $('#gems-pill');
    pill.classList.remove('flash');
    void pill.offsetWidth;
    pill.classList.add('flash');
  }
  if (window.onProfile) window.onProfile();
  renderInventory();
  renderLeaderboard();
  if (window.onStateRefresh) window.onStateRefresh();
}

/* ------------------------------------------------------------------- nav */

function setView(view) {
  state.view = view;
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  renderLeaderboard();
  if (view === 'inventory') renderInventory();
  if (view === 'profile' && window.onProfile) window.onProfile();
  if (window.onViewChange) window.onViewChange(view);
}
$$('.nav-item').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

// one delegated handler: unlock audio, blip on real button presses, handle [data-goto]
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-goto]');
  if (go) { setView(go.dataset.goto); audio.click(); return; }
  const btn = e.target.closest('button');
  if (btn && !btn.disabled) {
    audio.unlock();
    audio.click();
  }
});
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });

/* ------------------------------------------------------------- home view */

const GAMES = [
  { id: 'cases', ico: '📦', name: 'Case Opening', desc: 'Real CS2 cases, published odds, ×1 to ×5 openings.', meta: '0.26% rare special' },
  { id: 'battles', ico: '⚔️', name: 'Battles', desc: 'Same case, same openings, highest total takes both piles.', meta: '1 v 1 bot' },
  { id: 'crash', ico: '📈', name: 'Crash', desc: 'Climb the multiplier and cash out before it busts.', meta: '1% instant bust' },
  { id: 'double', ico: '🎡', name: 'Double', desc: '54 segments: 24 green, 24 red, 6 gold.', meta: '2× / 2× / 8×' },
  { id: 'upgrader', ico: '⬆️', name: 'Upgrader', desc: 'Stake gems or a skin against a multiplier of your choice.', meta: '4% edge' },
  { id: 'mines', ico: '💥', name: 'Mines', desc: '25 tiles, 1–5 mines, cash out whenever you like.', meta: '3% rake' },
  { id: 'plinko', ico: '🔻', name: 'Plinko', desc: '8, 12 or 16 rows, three risk levels, printed tables.', meta: '99% return' },
  { id: 'tiles', ico: '🟪', name: 'Tiles', desc: 'Five rows, more cursed tiles the higher you go.', meta: '20× top row' },
  { id: 'champion', ico: '🏆', name: 'Champion', desc: 'One pot, many contributors, one winner takes 95%.', meta: '5% rake' },
];

function renderGameGrid() {
  const grid = $('#game-grid');
  if (!grid || grid.dataset.done) return;
  grid.dataset.done = '1';
  GAMES.forEach((g) => {
    const tile = el('button', 'game-tile');
    tile.innerHTML = `
      <span class="gt-ico">${g.ico}</span>
      <span class="gt-name">${g.name}</span>
      <span class="gt-desc">${g.desc}</span>
      <span class="gt-meta">${g.meta}</span>`;
    tile.addEventListener('click', () => { audio.click(); setView(g.id); });
    grid.appendChild(tile);
  });
}

/* -------------------------------------------------------- feeds + chat */

function feedRow(ev) {
  const li = el('li', 'feed-row' + (ev.you ? ' you' : ''));
  const icons = { Case: '📦', Battles: '⚔️', Crash: '📈', Double: '🎡', Upgrader: '⬆️', Mines: '💥', Plinko: '🔻', Tiles: '🟪', Champion: '🏆', level: '⭐' };
  const tag = ev.isBot ? '<span class="bot-tag">BOT</span>' : (ev.you ? '<span class="you-tag">YOU</span>' : '');
  const profit = ev.profit != null ? `${ev.profit >= 0 ? '+' : '−'}${short(Math.abs(ev.profit))}` : (ev.value ? short(ev.value) : '');
  li.innerHTML = `
    <span class="feed-icon">${icons[ev.type] || '🎲'}</span>
    <span class="txt">
      <b style="color:hsl(${ev.hue || 260} 80% 72%)">${esc(ev.name)}</b> ${tag}
      <i>${esc(ev.detail || '')}${ev.mult ? ` · ${fmtMult(ev.mult)}` : ''}</i>
    </span>
    <span class="val">${profit}</span>`;
  return li;
}

function renderFeed(list) {
  const ul = $('#feed-list');
  list.slice().reverse().forEach((ev) => ul.prepend(feedRow(ev)));
  while (ul.children.length > 60) ul.removeChild(ul.lastChild);
  renderLuckyWins();
  renderHighRollers();
  if (window.onFeed) window.onFeed(list);
}

function renderLuckyWins() {
  const body = $('#lucky-body');
  if (!body) return;
  const wins = state.lastFeed.filter((f) => f.profit > 0).slice(0, 9);
  if (!wins.length) { body.innerHTML = '<tr><td colspan="5" class="muted">No wins yet — the bots are being careful.</td></tr>'; return; }
  body.innerHTML = wins.map((w) => `
    <tr class="${w.you ? 'you' : ''}">
      <td class="game">${esc(w.type)}</td>
      <td class="user"><span class="lb-name">${avatarEl(w.hue, w.face, 20).outerHTML}<b>${esc(w.name)}</b> ${w.isBot ? '<span class="bot-tag">BOT</span>' : '<span class="you-tag">YOU</span>'}</span></td>
      <td>💎 ${fmt(w.stake)}</td>
      <td>${w.mult ? fmtMult(w.mult) : '—'}</td>
      <td class="win">💎 ${fmt(w.value)}</td>
    </tr>`).join('');
}

function renderHighRollers() {
  const ul = $('#high-rollers');
  if (!ul) return;
  const highs = (state.highs || []).concat(state.lastFeed.filter((f) => f.stake >= 5000)).slice(0, 6);
  const seen = new Set();
  const rows = highs.filter((h) => (seen.has(h.seq) ? false : seen.add(h.seq)));
  ul.innerHTML = rows.length ? '' : '<li class="muted tiny">Waiting for a whale. The whales are bots.</li>';
  rows.forEach((h) => ul.appendChild(feedRow(h)));
}

function chatRow(m) {
  if (m.system) return el('li', 'chat-row sys', esc(m.text));
  const li = el('li', 'chat-row' + (m.you ? ' you' : ''));
  const tag = m.isBot ? '<span class="bot-tag">BOT</span>' : (m.you ? '<span class="you-tag">YOU</span>' : '');
  li.innerHTML = `${tag} <span class="who" style="color:hsl(${m.hue || 260} 80% 72%)">${esc(m.name)}</span>: ${esc(m.text)}`;
  return li;
}

function renderChat(list) {
  const ul = $('#chat-list');
  const stick = ul.scrollTop + ul.clientHeight > ul.scrollHeight - 40;
  list.forEach((m) => ul.appendChild(chatRow(m)));
  while (ul.children.length > 160) ul.removeChild(ul.firstChild);
  if (stick) ul.scrollTop = ul.scrollHeight;
}

/* ------------------------------------------------------------ inventory */

function renderInventory() {
  const you = state.you;
  if (!you) return;
  $('#inv-count').textContent = fmt(you.invCount);
  $('#inv-total').textContent = fmt(you.invValue);
  const grid = $('#inv-grid');
  if (!grid) return;

  let items = you.inventory.slice().reverse();
  if (state.invFilter === 'stattrak') items = items.filter((i) => i.stattrak);
  else if (state.invFilter !== 'all') items = items.filter((i) => i.rarity === state.invFilter);

  $('#inv-empty').classList.toggle('hidden', items.length > 0);
  const sig = state.invFilter + ':' + items.map((i) => i.uid + i.value).join(',');
  if (grid.dataset.sig === sig) return;
  grid.dataset.sig = sig;
  grid.innerHTML = '';
  items.forEach((item) => {
    const card = itemEl(item);
    card.title = `Click to sell for 💎 ${fmt(item.value)}`;
    card.addEventListener('click', async () => {
      try {
        const res = await api('inventory/sell', { uid: item.uid });
        audio.chip();
        toast(`Sold ${item.name} for 💎 ${fmt(res.sold.value)}`, 'gold');
        applyYou(res.you, { flash: true });
      } catch (err) { toast(err.message, 'err'); }
    });
    grid.appendChild(card);
  });
}

$$('#inv-filter button').forEach((b) => b.addEventListener('click', () => {
  $$('#inv-filter button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  state.invFilter = b.dataset.filter;
  $('#inv-grid').dataset.sig = '';
  renderInventory();
}));

$('#inv-sell-cheap').addEventListener('click', async () => {
  try {
    const res = await api('inventory/sellall', { maxValue: 500 });
    audio.chip();
    toast(`Sold ${res.count} items for 💎 ${fmt(res.total)}`, 'gold');
    applyYou(res.you, { flash: true });
  } catch (err) { toast(err.message, 'err'); }
});

$('#inv-sell-all').addEventListener('click', async () => {
  if (!state.you.inventory.length) return toast('Inventory is already empty.');
  if (!confirm(`Sell all ${state.you.inventory.length} items for fake gems?`)) return;
  try {
    const res = await api('inventory/sellall', {});
    audio.chip();
    toast(`Sold ${res.count} items for 💎 ${fmt(res.total)}`, 'gold');
    applyYou(res.you, { flash: true });
  } catch (err) { toast(err.message, 'err'); }
});

/* -------------------------------------------------------- leaderboard */

function renderLeaderboard() {
  const body = $('#lb-body');
  if (!body || !state.leaderboard) return;
  const sig = state.leaderboard.map((r) => r.id + r.value).join('|');
  if (body.dataset.sig === sig) return;
  body.dataset.sig = sig;
  body.innerHTML = state.leaderboard.map((r, i) => `
    <tr class="${r.you ? 'you' : ''}">
      <td class="num">${i + 1}</td>
      <td><span class="lb-name">${avatarEl(r.hue, r.face, 22).outerHTML}<b>${esc(r.name)}</b>${r.isBot ? '<span class="bot-tag">BOT</span>' : '<span class="you-tag">YOU</span>'}</span></td>
      <td class="num">${r.level}</td>
      <td class="num">💎 ${fmt(r.value)}</td>
      <td class="num ${r.netToday >= 0 ? 'up' : 'down'}">${r.netToday >= 0 ? '+' : '−'}${short(Math.abs(r.netToday))}</td>
    </tr>`).join('');
}

/* ----------------------------------------------------------------- race */

function renderRace(race) {
  state.race = race;
  if (!race) return;
  const body = $('#race-body');
  const left = Math.max(0, race.endsAt - Date.now());
  const hh = String(Math.floor(left / 3600000)).padStart(2, '0');
  const mm = String(Math.floor((left % 3600000) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  const clock = `${hh}:${mm}:${ss}`;
  if ($('#race-timer')) $('#race-timer').textContent = clock;
  if ($('#race-countdown')) $('#race-countdown').textContent = clock;
  if ($('#race-rank-chip')) $('#race-rank-chip').textContent = race.myRank ? `your rank: #${race.myRank} of ${race.totalPlayers}` : `your rank: unranked`;
  if ($('#reward-race-line')) $('#reward-race-line').textContent = race.myRank ? `you are #${race.myRank} of ${race.totalPlayers} right now` : 'wager gems to enter the ladder';
  if (!body) return;
  const sig = race.top.map((r) => r.id + r.wagered).join('|');
  if (body.dataset.sig === sig) return;
  body.dataset.sig = sig;
  body.innerHTML = race.top.map((r) => `
    <tr class="${r.you ? 'you' : ''}">
      <td class="num">${r.place}</td>
      <td><span class="lb-name">${avatarEl(r.hue, r.face, 22).outerHTML}<b>${esc(r.name)}</b>${r.isBot ? '<span class="bot-tag">BOT</span>' : '<span class="you-tag">YOU</span>'}</span></td>
      <td class="num">💎 ${fmt(r.wagered)}</td>
      <td class="num race-prize">💎 ${fmt(r.prize)}</td>
    </tr>`).join('');
}

/* -------------------------------------------------------------- profile */

function renderProfile() {
  const you = state.you;
  if (!you || state.view !== 'profile') return;
  const av = $('#profile-avatar');
  if (av) {
    av.textContent = FACES[you.face % FACES.length];
    av.style.setProperty('--hue', you.hue);
  }
  if ($('#profile-name')) {
    $('#profile-name').textContent = you.name;
    $('#profile-level').textContent = you.level;
    $('#profile-xp').textContent = `${fmt(you.xp)} xp`;
    const s = you.stats;
    const cards = [
      ['Balance', `💎 ${fmt(you.balance)}`],
      ['Inventory', `💎 ${fmt(you.invValue)}`],
      ['Net worth', `💎 ${fmt(you.netWorth)}`],
      ['Wagered', `💎 ${fmt(s.wagered)}`],
      ['Biggest win', `💎 ${fmt(s.biggestWin)}`],
      ['Cases opened', fmt(s.opened)],
      ['Battles', fmt(s.battles)],
      ['Upgrades', fmt(s.upgrades)],
      ['Session P/L', `${you.netToday >= 0 ? '+' : '−'}💎 ${fmt(Math.abs(you.netToday))}`],
    ];
    $('#profile-stats').innerHTML = cards.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
  }
}

/* ------------------------------------------------------------- freebies */

$('#claim-cases-btn').addEventListener('click', async () => {
  try {
    const res = await api('rewards/free-cases', {});
    audio.big();
    toast(`3 free case vouchers added — you hold ${res.freeCases}. They only work on cases up to 💎 ${fmt(state.cfg.freebies.freeCaseMaxPrice)}.`, 'good');
    applyYou(res.you, { flash: true });
  } catch (err) { toast(err.message, 'err'); }
});

$('#bonus-btn').addEventListener('click', claimGems);
if ($('#reward-gems')) $('#reward-gems').addEventListener('click', claimGems);
if ($('#reward-cases')) $('#reward-cases').addEventListener('click', () => $('#claim-cases-btn').click());

async function claimGems() {
  try {
    const res = await api('bonus', {});
    audio.big();
    toast(`Free drop: 💎 ${fmt(res.amount)}. No purchase, no conditions, ever.`, 'good');
    applyYou(res.you, { flash: true });
  } catch (err) { toast(err.message, 'err'); }
}

window.onProfile = renderProfile;

/* ------------------------------------------------------------ sound btn */

function loadSoundPref() {
  try {
    const v = localStorage.getItem('clashsim.sound');
    if (v === 'off') audio.enabled = false;
  } catch { /* ignore */ }
  $('#sound-btn').textContent = audio.enabled ? '🔊' : '🔇';
}
$('#sound-btn').addEventListener('click', () => {
  audio.unlock();
  audio.enabled = !audio.enabled;
  $('#sound-btn').textContent = audio.enabled ? '🔊' : '🔇';
  try { localStorage.setItem('clashsim.sound', audio.enabled ? 'on' : 'off'); } catch { /* ignore */ }
  if (audio.enabled) audio.click();
});

/* ------------------------------------------------------------- verify */

if ($('#verify-btn')) {
  $('#verify-btn').addEventListener('click', async () => {
    const out = $('#verify-out');
    out.textContent = 'rolling…';
    try {
      const id = $('#verify-case').value;
      const n = Math.max(100, Math.min(20000, Number($('#verify-n').value) || 5000));
      const r = await api(`samples?id=${encodeURIComponent(id)}&n=${n}`);
      const def = state.cfg.cases.find((c) => c.id === r.case);
      const theory = def ? `\ntheory:   💎 ${fmt(def.ev)} expected back per case (${((def.ev / def.gems) * 100).toFixed(1)}% of the 💎 ${fmt(def.gems)} price)` : '';
      const noise = `\nnote:     a ${r.openings.toLocaleString('en-US')}-roll sample still swings by a few points — the tail is that thin`;
      out.textContent =
        `${r.openings.toLocaleString('en-US')} openings of the ${r.case} at 💎 ${r.priceEach.toLocaleString('en-US')} each\n` +
        `spent:    💎 ${r.spent.toLocaleString('en-US')}\n` +
        `returned: 💎 ${r.returned.toLocaleString('en-US')}\n` +
        `return:   ${r.returnPct}%   (the case is priced for ~90%)\n` +
        `best pull: 💎 ${r.bestPull.toLocaleString('en-US')}\n` +
        `rarity spread: ${Object.entries(r.tiers).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${rarityName(k)} ${(v / r.openings * 100).toFixed(2)}%`).join(' · ')}` +
        theory + noise;
    } catch (err) { out.textContent = 'error: ' + err.message; }
  });
}

/* -------------------------------------------------------------- session */

async function boot() {
  state.cfg = await api('config');
  const res = await api('hello', { pid: state.pid });
  state.pid = res.pid;
  state.you = res.you;
  state.crash = res.crash;
  state.double = res.double;
  state.champion = res.champion;
  state.leaderboard = res.leaderboard;
  state.highs = res.highs;
  state.lastFeed = res.feed.slice();          // newest first, like world.feed
  try { localStorage.setItem('clashsim.pid', res.pid); } catch { /* private mode */ }

  renderHeader();
  renderGameGrid();
  renderInventory();
  renderLeaderboard();
  renderLuckyWins();
  renderHighRollers();
  renderRace(res.race);
  // the backlog matters: a warm lobby opens with drops already in the feed
  renderFeed(res.feed.slice().reverse());

  // verify-case dropdown + about counters
  const sel = $('#verify-case');
  if (sel) state.cfg.cases.forEach((c) => sel.appendChild(new Option(`${c.name} (💎 ${fmt(c.gems)})`, c.id)));
  if ($('#about-bots')) $('#about-bots').textContent = state.cfg.botCount;
  if ($('#hero-bots')) $('#hero-bots').textContent = `${state.cfg.botCount} / ${state.cfg.botCount}`;
  if ($('#reward-max-price')) $('#reward-max-price').textContent = fmt(state.cfg.freebies.freeCaseMaxPrice);

  if (window.initCases) window.initCases();
  if (window.initBattles) window.initBattles();
  if (window.initGames) window.initGames();

  if (res.isNew) {
    $('#name-root').hidden = false;
    $('#name-input').focus();
  }
  $('#name-save').addEventListener('click', async () => {
    const name = $('#name-input').value.trim();
    if (name.length < 2) return toast('Pick at least 2 characters.', 'err');
    const r = await api('rename', { name });
    applyYou(r.you);
    $('#name-root').hidden = true;
    toast(`Welcome, ${r.you.name}. Here is 💎 2,500 of absolutely nothing.`, 'good');
  });
  $('#name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#name-save').click(); });

  // seed the feed/chat views with history
  renderChat(res.chat);
  state.chatSeq = res.chat.length ? res.chat[res.chat.length - 1].seq : 0;
  state.feedSeq = res.feed.length ? res.feed[0].seq : 0;
  if (window.onCrashState) window.onCrashState(res.crash);
  if (window.onDoubleState) window.onDoubleState(res.double);
  if (window.onChampionState) window.onChampionState(res.champion);

  startPolling();
}

$('#reset-btn').addEventListener('click', async () => {
  if (!confirm('Reset the profile to 💎 2,500 and an empty inventory?')) return;
  const res = await api('reset', {});
  applyYou(res.you);
  toast('Profile reset. Still fake, still free.');
});

$('#chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try { await api('chat', { text }); } catch (err) { toast(err.message, 'err'); }
});

/* ------------------------------------------------------------- polling */

let polling = false;

async function poll() {
  if (polling) return;
  polling = true;
  try {
    const res = await api(`state?sinceChat=${state.chatSeq}&sinceFeed=${state.feedSeq}`);
    state.connected = true;
    state.crash = res.crash;
    state.double = res.double;
    state.champion = res.champion;
    state.leaderboard = res.leaderboard;
    state.highs = res.highs;
    if (res.you) applyYou(res.you);

    if (res.chat && res.chat.length) {
      state.chatSeq = res.chat[res.chat.length - 1].seq;
      renderChat(res.chat);
    }
    if (res.feed && res.feed.length) {
      state.feedSeq = res.feed[0].seq;
      state.lastFeed = res.feed.concat(state.lastFeed).slice(0, 60);
      renderFeed(res.feed);
    }
    renderRace(res.race);
    $('#online-count').textContent = fmt(res.online);
    $('#chat-count').textContent = `${fmt(res.online)} online`;

    if (window.onCrashState) window.onCrashState(res.crash);
    if (window.onDoubleState) window.onDoubleState(res.double);
    if (window.onChampionState) window.onChampionState(res.champion);
    if (state.view === 'profile') renderProfile();
  } catch (err) {
    if (state.connected) toast('Lost the sim server — retrying…', 'err');
    state.connected = false;
  } finally {
    polling = false;
    const busy = state.crash && state.crash.phase === 'running';
    const spinning = state.double && state.double.phase === 'spinning';
    // the crash board is worth a tighter loop: its betting window is short
    state.pollTimer = setTimeout(poll, busy || spinning || state.view === 'crash' ? 220 : 500);
  }
}

function startPolling() {
  clearTimeout(state.pollTimer);
  poll();
}

/* ----------------------------------------------------------------- boot */

loadSoundPref();
$('#sound-btn').textContent = audio.enabled ? '🔊' : '🔇';
initReelSpeed();

(function start() {
  try { state.pid = localStorage.getItem('clashsim.pid'); } catch { state.pid = null; }
  boot().catch((err) => {
    console.error(err);
    toast('Could not reach the sim server: ' + err.message, 'err');
  });
})();
