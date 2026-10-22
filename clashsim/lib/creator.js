/**
 * creator.js — the Case Creator, the one page on the real site that lets a
 * player build a case and earn a commission when other people open it.
 *
 * Real flow (copy taken from the bundle's own strings, it is what the steps are
 * called there): "Create Your Own Case" → Your Case Name → Select Case Image →
 * Select up to 20 items → Set Drop Chances → Finish Case Creation, where it
 * prints "Case Price" and "You earn {amount} per unbox". Rules there: the name
 * must be unused, at least 10 characters, no profanities; there is a level
 * requirement and a cap on how many cases one account can publish.
 *
 * Here: anything a session can publish lives in .data/creators.json, is merged
 * into the catalog like any other case, and pays its creator a commission out
 * of the entry fee. Fake gems, fake commission, no real money — same as
 * everything else in the build.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_DIR = process.env.CLASH_DATA_DIR || path.join(__dirname, '..', '.data');
const FILE = path.join(DATA_DIR, 'creators.json');

const MIN_LEVEL = 1;                 // upstream: "You must be at least level {level}" — kept open here on purpose
const MAX_CASES_PER_PLAYER = 3;      // mirrors "You can create up to {max} cases"
const COMMISSION = 0.05;             // "You earn {amount} per unbox"
const MAX_ITEMS = 20;                // "Select up to 20 items"
const MIN_ITEMS = 6;
const NAME_MIN = 10;                 // "Should be at least 10 characters long"
const NAME_MAX = 28;

const PROFANITY = /(fuck|shit|cunt|nigg|fag|rape|nazi|hitler|retard)/i;

/* ------------------------------------------------------------------ state */

let store = { cases: [] };
let universe = [];                   // [{id, name, weapon, pattern, rarity, base, image, seed}]
let economy = { wear: [], stattrak: null };   // the sim's real drop tables, set at boot
let revision = 0;                    // bump so catalog can cache its merged view

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (raw && Array.isArray(raw.cases)) store = raw;
  } catch { store = { cases: [] }; }
  return store;
}

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(store));
    } catch { /* unwritable scratch dir: the session still works, it just forgets */ }
  }, 500);
}

load();

/* --------------------------------------------------------------- the API */

/** The drop tables the server actually rolls with — pricing has to use these,
 *  or the return rate printed on a published case would be a lie. */
function setEconomy(wear, stattrak) {
  economy = { wear: wear || [], stattrak: stattrak || null };
}

/** Give the creator the item universe it may build cases out of. */
function setUniverse(list) {
  const seen = new Set();
  universe = (list || []).filter((it) => {
    if (!it || !it.id || !it.name || seen.has(it.name)) return false;
    seen.add(it.name);
    return true;
  });
  return universe.length;
}

function searchItems(query, rarity, limit = 40) {
  const q = String(query || '').trim().toLowerCase();
  let list = universe;
  if (rarity && rarity !== 'all') list = list.filter((i) => i.rarity === rarity);
  if (q) list = list.filter((i) => i.name.toLowerCase().includes(q) || String(i.weapon || '').toLowerCase().includes(q));
  return list.slice(0, Math.max(1, Math.min(120, limit)));
}

const itemById = (id) => universe.find((i) => i.id === id) || null;

/** Published cases, in catalog shape, ready to be merged. */
function cases() {
  return store.cases.map((c) => ({
    id: c.id,
    name: c.name,
    gems: c.gems,
    tag: 'community',
    origin: 'community',
    image: c.image,
    creator: { id: c.ownerId, name: c.ownerName, commission: COMMISSION },
    items: c.items,
  }));
}

const revisionOf = () => revision;
const all = () => store.cases;

/** Your own cases, with the numbers the creator page shows you. */
function mine(playerId) {
  return store.cases
    .filter((c) => c.ownerId === playerId)
    .map((c) => ({ id: c.id, name: c.name, image: c.image, gems: c.gems, items: c.items.length, opens: c.opens, earned: c.earned, createdAt: c.createdAt }));
}

function commissionFor(caseId) {
  const c = store.cases.find((x) => x.id === caseId);
  if (!c || !c.ownerId) return null;
  return { ownerId: c.ownerId, ownerName: c.ownerName, amount: Math.round(c.gems * COMMISSION) };
}

/** Credit a creator when someone opens their case. Returns the payout. */
function payCreator(caseId, opens = 1) {
  const c = store.cases.find((x) => x.id === caseId);
  if (!c) return 0;
  const pay = Math.round(c.gems * COMMISSION) * opens;
  c.opens += opens;
  c.earned += pay;
  revision++;
  save();
  return pay;
}

function validateName(name, ownerId) {
  const nm = String(name || '').trim().replace(/\s+/g, ' ');
  if (nm.length < NAME_MIN) return { error: `Name must be at least ${NAME_MIN} characters long.` };
  if (nm.length > NAME_MAX) return { error: `Keep the name under ${NAME_MAX} characters.` };
  if (!/^[\w %$&/=+\-.'!]+$/u.test(nm)) return { error: 'Letters, numbers, spaces and simple punctuation only.' };
  if (PROFANITY.test(nm)) return { error: 'Pick a name without profanities or slurs.' };
  const clash = store.cases.find((c) => c.name.toLowerCase() === nm.toLowerCase());
  if (clash) return { error: `"${nm}" is already taken${clash.ownerId === ownerId ? ' by one of your cases' : ''}.` };
  return { name: nm };
}

/* The ★ family split mirrors the catalog: a knife keeps one value everywhere. */
function buildItems(ids, chances) {
  const picked = [];
  const seen = new Set();
  for (const id of ids || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const it = itemById(String(id));
    if (it) picked.push(it);
    if (picked.length >= MAX_ITEMS) break;
  }
  if (picked.length < MIN_ITEMS) return { error: `Pick at least ${MIN_ITEMS} items (you picked ${picked.length}).` };

  /* Chances: either the creator's own numbers or an even split. They are
   * normalised to sum to exactly 1, and the ★ tier keeps its rarity colour —
   * what you see on the card is what the roll uses. */
  const given = Array.isArray(chances) ? chances.map((c) => Number(c) || 0) : [];
  const useGiven = given.length === picked.length && given.every((c) => c > 0);
  let weights = useGiven ? given : picked.map(() => 1);
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const items = picked.map((it, i) => ({
    id: it.id,
    name: it.name,
    weapon: it.weapon,
    pattern: it.pattern,
    rarity: it.rarity,
    base: it.base,
    image: it.image,
    seed: it.seed,
    chance: Math.round((weights[i] / total) * 1e6) / 1e6,
  }));
  const drift = 1 - items.reduce((s, i) => s + i.chance, 0);
  if (Math.abs(drift) > 1e-9) {
    let cheapest = items[0];
    for (const it of items) if (it.base < cheapest.base) cheapest = it;
    cheapest.chance = Math.round((cheapest.chance + drift) * 1e6) / 1e6;
  }
  return { items };
}

/** Expected value at the shipped odds, including wear and StatTrak, in gems. */
function expectedValue(items, wear, stattrak) {
  const ev = items.reduce((s, i) => s + i.chance * i.base, 0);
  const wearEv = (wear || []).reduce((s, w) => s + w.chance * (w.mult ?? 1), 0) || 1;
  const stEv = stattrak ? 1 + stattrak.chance * (stattrak.mult - 1) : 1;
  return ev * wearEv * stEv;
}

/* `rate` is the share of the entry fee that comes back to the player, so the
 * label on each price point is the number the card prints. */
const PRICE_SHAPES = [
  { key: 'player', rate: 0.97, label: 'Player-favoured' },
  { key: 'house', rate: 0.90, label: 'The house row' },
  { key: 'creator', rate: 0.82, label: 'Creator-favoured' },
];

/** Three honest price points: each prints the return rate it actually pays. */
function quote(items, wear, stattrak) {
  const ev = expectedValue(items, wear, stattrak);
  return PRICE_SHAPES.map((p) => {
    // cheap cases are priced to the gem; rounding to 5 would swing the return
    // rate by tens of percent when the EV is only a couple of dozen gems
    const raw = ev / p.rate;
    const gems = Math.max(10, raw < 500 ? Math.round(raw) : Math.round(raw / 5) * 5);
    return {
      key: p.key,
      label: p.label,
      gems,
      returnRate: Math.round((ev / gems) * 1000) / 1000,
      commission: Math.max(1, Math.round(gems * COMMISSION)),
    };
  });
}

function create(player, body) {
  if (!player) return { error: 'Unknown session.' };
  if ((player.level || 1) < MIN_LEVEL) return { error: `You must be at least level ${MIN_LEVEL} to create a case.` };
  if (store.cases.filter((c) => c.ownerId === player.id).length >= MAX_CASES_PER_PLAYER) {
    return { error: `You can create up to ${MAX_CASES_PER_PLAYER} cases.` };
  }

  const named = validateName(body.name, player.id);
  if (named.error) return { error: named.error };

  const built = buildItems(body.items, body.chances);
  if (built.error) return { error: built.error };

  const shapes = quote(built.items, economy.wear, economy.stattrak);
  const shape = PRICE_SHAPES.find((p) => p.key === String(body.shape)) || PRICE_SHAPES[1];
  const priced = shapes.find((x) => x.key === shape.key) || shapes[1];

  const image = String(body.image || '');
  if (image && !/^(art\/case-\d+\.webp)$/.test(image)) return { error: 'Pick one of the case images on offer.' };

  const rec = {
    id: `community-${crypto.randomBytes(4).toString('hex')}`,
    ownerId: player.id,
    ownerName: player.name,
    name: named.name,
    image: image || null,
    gems: priced.gems,
    returnRate: priced.returnRate,
    shape: priced.key,
    items: built.items,
    createdAt: Date.now(),
    opens: 0,
    earned: 0,
  };
  store.cases.push(rec);
  revision++;
  save();
  return { ok: true, case: { id: rec.id, name: rec.name, gems: rec.gems, returnRate: rec.returnRate, items: rec.items.length, image: rec.image, commission: Math.round(rec.gems * COMMISSION) }, mine: mine(player.id) };
}

function remove(player, id) {
  const i = store.cases.findIndex((c) => c.id === id);
  if (i < 0) return { error: 'No such case.' };
  if (store.cases[i].ownerId !== player.id) return { error: 'That case belongs to someone else.' };
  const [gone] = store.cases.splice(i, 1);
  revision++;
  save();
  return { ok: true, removed: gone.name, mine: mine(player.id) };
}

/** The image choices on offer: the real case art shipped in public/art/. */
function artChoices(limit = 60) {
  const dir = path.join(__dirname, '..', 'public', 'art');
  try {
    const files = fs.readdirSync(dir).filter((f) => /^case-\d+\.webp$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    const step = Math.max(1, Math.floor(files.length / limit));
    return files.filter((_, i) => i % step === 0).slice(0, limit).map((f) => `art/${f}`);
  } catch { return []; }
}

module.exports = {
  MIN_LEVEL, MAX_CASES_PER_PLAYER, COMMISSION, MAX_ITEMS, MIN_ITEMS, NAME_MIN, NAME_MAX,
  setUniverse, setEconomy, searchItems, itemById, universeSize: () => universe.length,
  cases, all, mine, create, remove, payCreator, commissionFor, artChoices, quote,
  revisionOf, buildItems, validateName,
};
