/* ==========================================================================
   NEONROLL — core client: session, state polling, shared rendering
   Fake-currency only. No payment code exists anywhere in this app.
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  pid: null,
  cfg: null,
  you: null,
  crash: null,
  chatSeq: 0,
  feedSeq: 0,
  view: 'crash',
  sound: true,
  lastCrashAmount: 100,
  crashAuto: false,
  pollTimer: null,
  connected: false,
};

/* ------------------------------------------------------------------ utils */

function fmt(n, digits = 0) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function short(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (v >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return fmt(n);
}

function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------ sound */

let audioCtx = null;
function beep(freq = 440, dur = 0.07, type = 'sine', gain = 0.05) {
  if (!state.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.stop(audioCtx.currentTime + dur);
  } catch { /* audio is a nicety */ }
}
const sfx = {
  click: () => beep(320, 0.05, 'square', 0.03),
  bet: () => beep(520, 0.08, 'triangle', 0.04),
  tick: () => beep(880, 0.02, 'square', 0.012),
  win: () => { beep(660, 0.09, 'triangle', 0.06); setTimeout(() => beep(990, 0.12, 'triangle', 0.06), 90); },
  big: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.14, 'triangle', 0.06), i * 90)); },
  lose: () => { beep(180, 0.2, 'sawtooth', 0.05); setTimeout(() => beep(120, 0.28, 'sawtooth', 0.05), 120); },
};

/* ------------------------------------------------------------------ api */

async function api(route, body, method) {
  const url = `/api/${route}${route.includes('?') ? '&' : '?'}pid=${encodeURIComponent(state.pid || '')}`;
  const res = await fetch(url, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ------------------------------------------------------------------ toasts */

function toast(msg, kind = '') {
  const node = el('div', 'toast ' + kind, esc(msg));
  $('#toast-root').appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .3s, transform .3s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    setTimeout(() => node.remove(), 320);
  }, 3200);
}

/* ------------------------------------------------------------------ modal */

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

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) modal.close();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.close(); });

/* ------------------------------------------------------------------ avatars + skins */

const FACES = ['🦊', '🐺', '🐸', '🐙', '🦉', '🐲', '🐝', '🦈', '🐼', '🦅', '🐢', '👾'];

function avatarEl(hue = 150, face = 0, size = 28) {
  const a = el('span', 'avatar', FACES[face % FACES.length]);
  a.style.setProperty('--hue', hue);
  a.style.width = a.style.height = size + 'px';
  a.style.fontSize = Math.max(10, size * 0.45) + 'px';
  return a;
}

function skinEl(item, opts = {}) {
  const rar = (state.cfg && state.cfg.rarities[item.rarity]) || { color: '#888', label: item.rarity };
  const node = el('div', 'skin' + (opts.small ? ' small' : '') + (opts.pop ? ' skin-pop' : ''));
  node.style.setProperty('--rc', rar.color);
  const h = (item.seed * 13) % 360;
  node.style.setProperty('--h', h);
  node.style.setProperty('--x1', 15 + (item.seed % 40) + '%');
  node.style.setProperty('--y1', 20 + ((item.seed >> 2) % 45) + '%');
  node.style.setProperty('--x2', 55 + ((item.seed >> 3) % 40) + '%');
  node.style.setProperty('--y2', 55 + ((item.seed >> 4) % 40) + '%');
  node.style.setProperty('--ang', 60 + (item.seed % 90) + 'deg');
  node.dataset.itemId = item.id;
  node.innerHTML = `
    <div class="skin-art"></div>
    <div class="skin-weapon">${esc(item.weapon || '')}</div>
    <div class="skin-name">${esc(item.skin || item.name || '')}</div>
    <div class="skin-foot">
      <span class="skin-rar">${esc(rar.label)}</span>
      <span class="skin-val">🪙 ${fmt(item.value)}</span>
    </div>`;
  return node;
}

/* ------------------------------------------------------------------ header */

function renderHeader() {
  const you = state.you;
  if (!you) return;
  $('#balance-value').textContent = fmt(you.balance);
  $('#user-name').textContent = you.name;
  $('#user-level').textContent = you.level;
  const av = $('#user-avatar');
  av.textContent = FACES[you.face % FACES.length];
  av.style.setProperty('--hue', you.hue);
  $('#inv-badge').textContent = you.invCount;

  const span = Math.max(1, you.xpNext - you.xpPrev);
  const pct = Math.max(0, Math.min(100, ((you.xp - you.xpPrev) / span) * 100));
  $('#level-fill').style.width = pct + '%';
  $('#level-num').textContent = you.level;
  $('.level-ring').style.setProperty('--p', pct + '%');
  $('#level-xp').textContent = `${fmt(Math.max(0, you.xp - you.xpPrev))} / ${fmt(span)} xp`;

  const b = $('#bonus-btn');
  if (you.bonusIn > 0) {
    b.disabled = true;
    $('#bonus-label').textContent = `Free coins ${you.bonusIn}s`;
  } else {
    b.disabled = false;
    $('#bonus-label').textContent = 'Free coins';
  }
}

function applyYou(you, { flash = false } = {}) {
  if (!you) return;
  const before = state.you ? state.you.balance : you.balance;
  state.you = you;
  renderHeader();
  if (flash && you.balance !== before) {
    const p = $('#balance-pill');
    p.classList.remove('flash');
    void p.offsetWidth;
    p.classList.add('flash');
  }
  renderInventory();
  renderLeaderboard();
  // keep "you" labels in the game views in sync (e.g. right after a rename)
  const bn = document.getElementById('battle-you-name');
  if (bn) bn.textContent = you.name;
  const cn = document.getElementById('cf-you-name');
  if (cn) cn.textContent = you.name;
  if (window.onMinesState) window.onMinesState();
}

/* ------------------------------------------------------------------ chat */

function chatRow(msg) {
  if (msg.system) {
    return el('li', 'chat-row sys', esc(msg.text));
  }
  const li = el('li', 'chat-row' + (msg.you ? ' you' : ''));
  const color = `hsl(${msg.hue || 150} 75% 68%)`;
  const tag = msg.isBot ? '<span class="bot-tag">BOT</span>' : (msg.you ? '<span class="you-tag">YOU</span>' : '');
  li.innerHTML = `${tag} <span class="who" style="color:${color}">${esc(msg.name)}</span>: ${esc(msg.text)}`;
  return li;
}

function renderChat(list) {
  const ul = $('#chat-list');
  const stick = ul.scrollTop + ul.clientHeight > ul.scrollHeight - 40;
  list.forEach((m) => ul.appendChild(chatRow(m)));
  while (ul.children.length > 160) ul.removeChild(ul.firstChild);
  if (stick) ul.scrollTop = ul.scrollHeight;
}

/* ------------------------------------------------------------------ feed */

function feedRow(m) {
  const li = el('li', 'feed-row' + (m.you ? ' you' : ''));
  const icons = { case: '📦', battle: '⚔️', crash: '📈', coinflip: '🪙', mines: '💥', level: '🏆' };
  const tag = m.isBot ? '<span class="bot-tag">BOT</span>' : (m.you ? '<span class="you-tag">YOU</span>' : '');
  const val = m.profit != null ? `${m.profit >= 0 ? '+' : ''}${short(m.profit)}` : (m.value ? short(m.value) : '');
  li.innerHTML = `
    <span class="feed-icon">${icons[m.type] || '🎲'}</span>
    <span class="txt">
      <b style="color:hsl(${m.hue || 150} 75% 70%)">${esc(m.name)}</b> ${tag}
      <i>${esc(m.text || '')}${m.item ? ' · ' + esc(m.item) : ''}</i>
    </span>
    <span class="val">${val}</span>`;
  return li;
}

function renderFeed(list) {
  const ul = $('#feed-list');
  // server sends newest-first; prepend oldest-first so newest ends up on top
  list.slice().reverse().forEach((m) => ul.prepend(feedRow(m)));
  while (ul.children.length > 60) ul.removeChild(ul.lastChild);
  if (window.onFeed) window.onFeed(list);
}

const TICKER_STATIC = [
  { icon: '🚫', name: 'no deposits', text: 'this site has zero payment code', val: 'forever' },
  { icon: '🎁', name: 'free coins', text: 'claim a drop every 2 minutes', val: '0 real money' },
  { icon: '🤖', name: 'every opponent', text: 'is a simulated bot with a script', val: 'BOT' },
  { icon: '📉', name: 'house edge', text: 'cases return ~90% on average', val: 'by design' },
];

function renderTicker() {
  const track = $('#ticker-track');
  const rows = (state.tickerItems || []).slice(0, 12).concat(TICKER_STATIC);
  if (!rows.length) return;
  const html = rows.map((m) => `<span class="tk">${m.icon} <b>${esc(m.name)}</b> ${esc(m.text)} <b style="color:#9ff5cd">${m.val}</b></span>`).join('');
  track.innerHTML = html + html; // duplicated for a seamless loop
}

/* ------------------------------------------------------------------ inventory */

function renderInventory() {
  const you = state.you;
  if (!you) return;
  $('#inv-count').textContent = fmt(you.invCount);
  $('#inv-total').textContent = fmt(you.invValue);
  const grid = $('#inv-grid');
  const items = you.inventory.slice().reverse();
  $('#inv-empty').classList.toggle('hidden', items.length > 0);
  const sig = items.map((i) => i.id).join(',');
  if (grid.dataset.sig === sig) return;
  grid.dataset.sig = sig;
  grid.innerHTML = '';
  items.forEach((item) => {
    const card = skinEl(item, { small: false });
    card.title = `Click to sell for 🪙 ${fmt(item.value)}`;
    card.appendChild(el('div', 'sell-hint', `click to sell for 🪙 ${fmt(item.value)}`));
    card.addEventListener('click', async () => {
      try {
        const res = await api('inventory/sell', { itemId: item.id });
        sfx.bet();
        toast(`Sold ${item.name} for 🪙 ${fmt(res.sold.value)}`, 'gold');
        applyYou(res.you, { flash: true });
      } catch (err) { toast(err.message, 'err'); }
    });
    grid.appendChild(card);
  });
}

/* ------------------------------------------------------------------ leaderboard */

function renderLeaderboard() {
  const rows = state.leaderboard || [];
  const body = $('#lb-body');
  if (!body) return;
  const sig = rows.map((r) => r.id + r.value + r.netToday).join('|');
  if (body.dataset.sig === sig) return;
  body.dataset.sig = sig;
  body.innerHTML = rows.map((r, i) => `
    <tr class="${r.you ? 'you' : ''}">
      <td class="num">${i + 1}</td>
      <td><span class="lb-name">${avatarEl(r.hue, r.face, 22).outerHTML}
        <b>${esc(r.name)}</b> ${r.isBot ? '<span class="bot-tag">BOT</span>' : '<span class="you-tag">YOU</span>'}</span></td>
      <td class="num">${r.level}</td>
      <td class="num">🪙 ${fmt(r.value)}</td>
      <td class="num ${r.netToday >= 0 ? 'up' : 'down'}">${r.netToday >= 0 ? '+' : ''}${short(r.netToday)}</td>
    </tr>`).join('');
}

/* ------------------------------------------------------------------ nav */

function setView(view) {
  state.view = view;
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'inventory') renderInventory();
  if (view === 'leaderboard') renderLeaderboard();
  if (window.onViewChange) window.onViewChange(view);
}

$$('.nav-item').forEach((btn) => btn.addEventListener('click', () => {
  sfx.click();
  setView(btn.dataset.view);
}));

/* ------------------------------------------------------------------ session boot */

async function bootSession() {
  state.cfg = await api('config');
  // server base + local save file
  const res = await api('hello', { pid: state.pid, name: state.pid ? undefined : undefined }, 'POST');
  state.pid = res.pid;
  state.you = res.you;
  state.crash = res.crash;
  try { localStorage.setItem('neonroll.pid', res.pid); } catch { /* private mode */ }

  renderHeader();
  renderInventory();
  renderLeaderboard();
  window.initCases && window.initCases();
  window.initBattles && window.initBattles();
  window.initCoinflip && window.initCoinflip();
  window.initMines && window.initMines();
  window.startCrashCanvas && window.startCrashCanvas();

  if (res.isNew) {
    $('#name-root').hidden = false;
    $('#name-input').value = '';
    $('#name-input').focus();
  }

  $('#name-save').addEventListener('click', async () => {
    const name = $('#name-input').value.trim();
    if (name.length < 2) { toast('Pick at least 2 characters.', 'err'); return; }
    const r = await api('rename', { name });
    applyYou(r.you);
    $('#name-root').hidden = true;
    toast(`Welcome, ${r.you.name}. Here's 🪙 2,500 of absolutely nothing.`);
  });

  $('#name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#name-save').click(); });

  startPolling();
}

/* ------------------------------------------------------------------ polling */

let pollBusy = false;

async function poll() {
  if (pollBusy) return;
  pollBusy = true;
  try {
    const q = `state?sinceChat=${state.chatSeq}&sinceFeed=${state.feedSeq}`;
    const res = await api(q);
    state.connected = true;
    state.crash = res.crash;
    if (res.you) applyYou(res.you);
    if (res.chat && res.chat.length) {
      state.chatSeq = res.chat[res.chat.length - 1].seq;
      renderChat(res.chat);
    }
    if (res.feed && res.feed.length) {
      state.feedSeq = res.feed[0].seq;
      renderFeed(res.feed);
      state.tickerItems = res.feed.filter((f) => f.profit > 0).slice(0, 14).map((f) => ({
        icon: { case: '📦', battle: '⚔️', crash: '📈', coinflip: '🪙', mines: '💥' }[f.type] || '🎲',
        name: f.name,
        text: f.text,
        val: (f.profit >= 0 ? '+' : '') + short(f.profit),
      }));
      renderTicker();
    }
    state.leaderboard = res.leaderboard;
    if (state.view === 'leaderboard') renderLeaderboard();
    $('#online-count').textContent = fmt(res.online);
    $('#chat-count').textContent = `${fmt(res.online)} online`;
    if (window.onCrashState) window.onCrashState(res.crash);
    if (window.onCrashBets) window.onCrashBets(res.crash);
  } catch (err) {
    if (state.connected) toast('Lost connection to the sim — retrying…', 'err');
    state.connected = false;
  } finally {
    pollBusy = false;
    // poll faster while a round is live so the countdown and buttons stay honest
    const phase = state.crash && state.crash.phase;
    const next = phase === 'running' ? 220 : phase === 'betting' ? 320 : 600;
    state.pollTimer = setTimeout(poll, next);
  }
}

function startPolling() {
  clearTimeout(state.pollTimer);
  poll();
}

/* ------------------------------------------------------------------ global wiring */

document.addEventListener('click', (e) => {
  if (e.target.closest('button')) sfx.click();
});

$('#sound-btn').addEventListener('click', () => {
  state.sound = !state.sound;
  $('#sound-btn').textContent = state.sound ? '🔊' : '🔇';
  if (state.sound) sfx.click();
});

$('#bonus-btn').addEventListener('click', async () => {
  try {
    const res = await api('bonus', {});
    sfx.win();
    toast(`Free coin drop: 🪙 ${fmt(res.amount)}. No purchase, no strings.`, 'gold');
    applyYou(res.you, { flash: true });
  } catch (err) { toast(err.message, 'err'); }
});

$('#reset-btn').addEventListener('click', async () => {
  if (!confirm('Reset your fake profile back to 2,500 coins and an empty inventory?')) return;
  const res = await api('reset', {});
  applyYou(res.you);
  toast('Profile reset. Still fake, still free.');
});

$('#user-chip').addEventListener('click', () => {
  setView('inventory');
});

$('#inv-sell-dupes').addEventListener('click', async () => {
  const cheap = state.you.inventory.filter((i) => i.value < 100);
  if (!cheap.length) { toast('Nothing under 🪙 100 to sell.'); return; }
  let total = 0;
  for (const item of cheap) {
    try { const res = await api('inventory/sell', { itemId: item.id }); total += res.sold.value; applyYou(res.you); }
    catch { break; }
  }
  sfx.bet();
  toast(`Sold ${cheap.length} items for 🪙 ${fmt(total)}`, 'gold');
});

$('#inv-sell-all').addEventListener('click', async () => {
  if (!state.you.inventory.length) { toast('Inventory is already empty.'); return; }
  if (!confirm(`Sell all ${state.you.inventory.length} items? (This is fake money, it changes nothing real.)`)) return;
  const res = await api('inventory/sellall', {});
  sfx.bet();
  toast(`Sold ${res.count} items for 🪙 ${fmt(res.total)}`, 'gold');
  applyYou(res.you, { flash: true });
});

$('#chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try { await api('chat', { text }); } catch (err) { toast(err.message, 'err'); }
});

/* ------------------------------------------------------------------ start */

(function start() {
  try { state.pid = localStorage.getItem('neonroll.pid'); } catch { state.pid = null; }
  bootSession().catch((err) => {
    toast('Could not reach the sim server: ' + err.message, 'err');
    console.error(err);
  });
})();
