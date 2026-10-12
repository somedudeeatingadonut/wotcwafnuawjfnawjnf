/**
 * catalog.js — the item universe.
 *
 * Loads public/catalog.json, which tools/build-catalog.js builds from the public
 * CS2 item data (ByMykel/CSGO-API): real case names, real item names, real rarity
 * ladder, real Steam CDN images. Gem values are *simulated* (modelled on the shape
 * of the real market) — the sim says so in the UI.
 *
 * Drop mechanics mirror the real thing:
 *   · the published CS2 rarity odds per case
 *   · a float value in 0.00–1.00, which decides the wear band (FN/MW/FT/WW/BS)
 *   · StatTrak™ on ~10% of drops
 *   · value = base value × wear multiplier × (StatTrak multiplier if any)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CATALOG_PATH = path.join(__dirname, '..', 'public', 'catalog.json');
const RAW = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

const WEARS = RAW.wears || [];
const STATTRAK = RAW.stattrak || { chance: 0.1, mult: 1.5 };

/* float bands, straight out of the game */
const FLOAT_BANDS = [
  { name: 'Factory New', short: 'FN', max: 0.07 },
  { name: 'Minimal Wear', short: 'MW', max: 0.15 },
  { name: 'Field-Tested', short: 'FT', max: 0.38 },
  { name: 'Well-Worn', short: 'WW', max: 0.45 },
  { name: 'Battle-Scarred', short: 'BS', max: 1.0 },
];

function pickWear() {
  let r = Math.random();
  for (const w of WEARS) { r -= w.chance; if (r <= 0) return w; }
  return WEARS[2] || { name: 'Field-Tested', short: 'FT', mult: 1, dist: [0.15, 0.38] };
}

/** Roll a float inside the band that the wear roll picked. */
function rollFloat(wearName) {
  const band = FLOAT_BANDS.find((b) => b.name === wearName) || FLOAT_BANDS[2];
  const lo = FLOAT_BANDS[FLOAT_BANDS.indexOf(band) - 1]?.max ?? 0;
  const float = lo + Math.random() * (band.max - lo);
  return Math.round(float * 1e6) / 1e6;
}

const uid = () => crypto.randomBytes(6).toString('hex');

/** Turn a catalog entry into a rolled, owned instance. */
function instantiate(entry, caseId) {
  const wear = pickWear();
  const float = rollFloat(wear.name);
  const stattrak = Math.random() < STATTRAK.chance;
  const wearMult = wear.mult ?? 1;
  const value = Math.max(1, Math.round(entry.base * wearMult * (stattrak ? STATTRAK.mult : 1)));
  return {
    uid: uid(),
    itemId: entry.id,
    name: stattrak ? `StatTrak™ ${entry.name}` : entry.name,
    baseName: entry.name,
    weapon: entry.weapon,
    pattern: entry.pattern,
    rarity: entry.rarity,
    stattrak,
    float,
    wear: wear.name,
    wearShort: wear.short,
    value,
    image: entry.image,
    seed: entry.seed,
    caseId: caseId || null,
    ts: Date.now(),
  };
}

/** Roll one item out of a case, using that case's published per-item odds. */
function rollItem(caseId) {
  const def = getCase(caseId);
  if (!def) return null;
  const r = Math.random();
  let acc = 0;
  for (const item of def.items) {
    acc += item.chance;
    if (r <= acc) return instantiate(item, def.id);
  }
  return instantiate(def.items[def.items.length - 1], def.id);
}

const CASE_INDEX = new Map(RAW.cases.map((c) => [c.id, c]));
const RARITY_ORDER = ['rarespecial', 'rarity_ancient', 'rarity_legendary', 'rarity_mythical', 'rarity_rare'];

function getCase(id) { return CASE_INDEX.get(id) || null; }

/** Aggregate a case's per-item odds up to rarity level — this is what the UI shows. */
function rarityOdds(caseDef) {
  const byRarity = new Map();
  for (const item of caseDef.items) {
    const cur = byRarity.get(item.rarity) || { rarity: item.rarity, chance: 0, items: [], min: Infinity, max: 0 };
    cur.chance += item.chance;
    cur.items.push(item);
    cur.min = Math.min(cur.min, item.base);
    cur.max = Math.max(cur.max, item.base);
    byRarity.set(item.rarity, cur);
  }
  return [...byRarity.values()]
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
    .map((r) => ({
      rarity: r.rarity,
      name: RAW.rarities[r.rarity]?.name || r.rarity,
      color: RAW.rarities[r.rarity]?.color || '#888',
      chance: Math.round(r.chance * 1e6) / 1e6,
      count: r.items.length,
      min: r.min,
      max: r.max,
    }));
}

/** Public shape of a case (what the client needs, odds included). */
function publicCase(caseDef) {
  return {
    id: caseDef.id,
    name: caseDef.name,
    gems: caseDef.gems,
    tag: caseDef.tag,
    origin: caseDef.origin,
    image: caseDef.image,
    itemCount: caseDef.items.length,
    odds: rarityOdds(caseDef),
    contents: caseDef.items
      .slice()
      .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || b.base - a.base)
      .map((i) => ({
        id: i.id, name: i.name, weapon: i.weapon, pattern: i.pattern,
        rarity: i.rarity, base: i.base, chance: i.chance, image: i.image, seed: i.seed,
      })),
  };
}

/** Expected return for a case, in gems, at the published odds. */
function caseEv(caseDef) {
  const ev = caseDef.items.reduce((s, i) => s + i.chance * i.base, 0);
  const wearEv = WEARS.reduce((s, w) => s + w.chance * (w.mult ?? 1), 0) || 1;
  const stEv = 1 + STATTRAK.chance * (STATTRAK.mult - 1);
  return Math.round(ev * wearEv * stEv);
}

/** A high-tier item from the pool — used as the upgrader's "win" target. */
function randomPoolItem(maxValue) {
  const pool = (RAW.pool || []).filter((p) => !maxValue || p.base <= maxValue);
  if (!pool.length) return null;
  const p = pool[Math.floor(Math.random() * pool.length)];
  const it = instantiate(p, null);
  return it;
}

/** Find a pool item whose value lands close to a target (for upgrade payouts). */
function poolItemNear(targetValue) {
  const pool = RAW.pool || [];
  if (!pool.length) return null;
  let best = pool[0];
  let bestDiff = Infinity;
  for (let i = 0; i < 40; i++) {
    const p = pool[Math.floor(Math.random() * pool.length)];
    const diff = Math.abs(p.base - targetValue);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  return instantiate(best, null);
}

module.exports = {
  RAW,
  rarities: RAW.rarities,
  cases: RAW.cases,
  pool: RAW.pool || [],
  wearTable: WEARS,
  stattrak: STATTRAK,
  getCase,
  publicCase,
  rarityOdds,
  caseEv,
  rollItem,
  instantiate,
  randomPoolItem,
  poolItemNear,
  RARITY_ORDER,
  FLOAT_BANDS,
};
