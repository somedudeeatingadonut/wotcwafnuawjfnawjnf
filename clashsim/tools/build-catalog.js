#!/usr/bin/env node
/**
 * build-catalog.js — builds clashsim's item catalog from the public CS2 game data.
 *
 * Source: ByMykel/CSGO-API (public CS2 item data: real case names, real item names,
 * real rarity colours, real Steam CDN image URLs).
 *
 *   node tools/build-catalog.js --fetch            # download the source data first
 *   node tools/build-catalog.js --crates a.json --skins b.json
 *
 * Output: public/catalog.json  (compact: only the cases + items the sim actually uses)
 *
 * NOTE ON VALUES: skins in this sim get *simulated* gem values modelled on the shape
 * of the real CS2 market (rarity tiers, wear, per-item jitter). They are not market
 * prices and the sim says so in the UI.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'public', 'catalog.json');

/* ------------------------------------------------------------------ cases we ship
 * Real CS2 cases, spanning a cheap→expensive ladder, plus two themed "originals"
 * built the way case sites do it (a knife case and a glove case).
 * `gems` is the case price in the sim's fake currency.
 */
const CASES = [
  { id: 'weapon-case-1',   crate: 'CS:GO Weapon Case',        gems: 50,    tag: 'classic' },
  { id: 'chroma-3',        crate: 'Chroma 3 Case',            gems: 120,   tag: 'budget' },
  { id: 'prisma',          crate: 'Prisma Case',              gems: 250,   tag: 'budget' },
  { id: 'fracture',        crate: 'Fracture Case',            gems: 500,   tag: 'mid' },
  { id: 'dreams',          crate: 'Dreams & Nightmares Case', gems: 1000,  tag: 'mid' },
  { id: 'recoil',          crate: 'Recoil Case',              gems: 2000,  tag: 'mid' },
  { id: 'revolution',      crate: 'Revolution Case',          gems: 3500,  tag: 'high' },
  { id: 'kilowatt',        crate: 'Kilowatt Case',            gems: 6000,  tag: 'high' },
  { id: 'gallery',         crate: 'Gallery Case',             gems: 12000, tag: 'high' },
  { id: 'fever',           crate: 'Fever Case',               gems: 25000, tag: 'premium' },
  { id: 'knife-original',  original: 'knife',  gems: 5000,  tag: 'original', name: 'Clash Knife Case' },
  { id: 'glove-original',  original: 'glove',  gems: 15000, tag: 'original', name: 'Clash Glove Case' },
];

/* Real CS2 case odds (per-case, published by Valve's own odds disclosure). */
const RARITY_ODDS = {
  'rarity_rare': 0.7992,        // Mil-Spec Grade
  'rarity_mythical': 0.1598,    // Restricted
  'rarity_legendary': 0.0320,   // Classified
  'rarity_ancient': 0.0064,     // Covert
  'rarespecial': 0.0026,        // ★ Rare Special (knives / gloves)
};

/* Simulated value multipliers, expressed as multiples of the case price.
 * These reproduce the *shape* of a real case: junk for a fraction of the entry,
 * a top-tier jackpot worth 100–1000x. Jitter per item keeps it from looking flat. */
const RARITY_MULT = {
  'rarity_rare': 0.28,
  'rarity_mythical': 1.35,
  'rarity_legendary': 7.5,
  'rarity_ancient': 38,
  'rarespecial': 420,
};

const WEAR = [
  { name: 'Factory New', short: 'FN', mult: 1.30, chance: 0.10 },
  { name: 'Minimal Wear', short: 'MW', mult: 1.12, chance: 0.18 },
  { name: 'Field-Tested', short: 'FT', mult: 1.00, chance: 0.40 },
  { name: 'Well-Worn', short: 'WW', mult: 0.90, chance: 0.18 },
  { name: 'Battle-Scarred', short: 'BS', mult: 0.78, chance: 0.14 },
];

const RARE_SPECIAL = { id: 'rarespecial', name: 'Rare Special', color: '#ffd700' };

/* Average value effect of the wear roll the server performs on every drop. */
const EXPECTED_WEAR = WEAR.reduce((s, w) => s + w.chance * w.mult, 0);
/* StatTrak rolls on ~10% of drops and is worth ~1.5x, so the price has to absorb it. */
const STATTRAK = { chance: 0.10, mult: 1.5 };
const EXPECTED_STATTRAK = 1 + STATTRAK.chance * (STATTRAK.mult - 1);

/* ------------------------------------------------------------------ helpers */

const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
};
const jitter = (seed, lo, hi) => lo + ((seed % 1000) / 1000) * (hi - lo);

async function ghFile(repoPath, dest) {
  // api.github.com is the only GitHub host this sandbox may reach, and its contents
  // endpoint happily serves multi-megabyte JSON through the raw media type.
  const url = `https://api.github.com/repos/ByMykel/CSGO-API/contents/${repoPath}`;
  console.log(`[catalog] downloading ${repoPath} …`);
  const res = await fetch(url, { headers: { accept: 'application/vnd.github.raw', 'user-agent': 'clashsim-catalog' } });
  if (!res.ok) throw new Error(`${repoPath}: HTTP ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(dest, text);
  console.log(`[catalog]  → ${(text.length / 1048576).toFixed(1)} MB saved to ${dest}`);
}

/* ------------------------------------------------------------------ build */

/* Knife / glove prestige — how much more a given family is worth inside the
 * "Rare Special" tier. Mirrors the real market pecking order (Karambit ≫ Navaja). */
const PRESTIGE = {
  Karambit: 1.00, Butterfly: 0.95, Talon: 0.90, 'M9 Bayonet': 0.85, Bayonet: 0.72,
  Skeleton: 0.70, Stiletto: 0.66, Nomad: 0.58, Ursus: 0.56, Huntsman: 0.52,
  Kukri: 0.50, 'Classic Knife': 0.48, Bowie: 0.46, Flip: 0.44, Paracord: 0.40,
  Survival: 0.38, Falchion: 0.36, 'Shadow Daggers': 0.34, Gut: 0.28, Navaja: 0.24,
  // gloves
  'Sport Gloves': 0.90, 'Specialist Gloves': 0.86, 'Driver Gloves': 0.80,
  'Moto Gloves': 0.80, 'Hand Wraps': 0.76, 'Hydra Gloves': 0.70,
  'Bloodhound Gloves': 0.66, 'Broken Fang Gloves': 0.62,
};
const FINISH_BUMP = /Doppler|Fade|Case Hardened|Slaughter|Lore|Crimson Web|Tiger Tooth|Marble|Gamma|Autotronic|Emerald|Ruby|Sapphire|Black Pearl|Howl|Fire Serpent|Dragon Lore|Medusa|Hyper Beast|Gungnir|Wild Lotus|Vice|Amphibious|King Snake|Spearmint|Superconductor|Pandora|Hedge Maze|Cobalt Skulls|Nocts/i;

const splitName = (name) => {
  const clean = String(name || '').replace(/^★\s*/, '');
  const [weapon, pattern] = clean.split(' | ');
  return { weapon: weapon || clean, pattern: pattern || '' };
};

function buildCase(def, crate, skins) {
  const items = [];
  const seen = new Set();

  const push = (raw, forcedRarity) => {
    const name = String(raw.name || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    const rarity = forcedRarity || String(raw.rarity?.id || 'rarity_rare').replace(/_weapon$/, '');
    const { weapon, pattern } = splitName(name);
    const seed = hash(name);
    let base = def.gems * (RARITY_MULT[rarity] || 0.3);
    if (rarity === 'rarespecial') {
      base *= PRESTIGE[weapon] || 0.35;
      if (FINISH_BUMP.test(pattern)) base *= 1.55;
    }
    // base = value at Field-Tested; wear and StatTrak are rolled when the case opens
    const baseValue = Math.max(1, Math.round(
      base * jitter(seed, 0.70, 1.30) * jitter(hash(pattern + weapon), 0.88, 1.18) / 5,
    ) * 5);
    items.push({
      id: raw.id || name,
      name,
      weapon,
      pattern,
      rarity,
      base: baseValue,
      image: raw.image || null,
      seed: seed % 100000,
    });
  };

  for (const it of crate.contains || []) push(it);
  for (const it of crate.contains_rare || []) push(it, 'rarespecial');

  // make sure every rung of the ladder has something in it
  const have = new Set(items.map((i) => i.rarity));
  if (!have.has('rarity_ancient') && skins.list.length) {
    const coverts = skins.list.filter((s) => s.rarity?.id === 'rarity_ancient_weapon' && s.image && !s.name.startsWith('★'));
    if (coverts.length) push(coverts[hash(def.id) % coverts.length]);
  }
  if (!have.has('rarespecial')) {
    const rares = skins.list.filter((s) => s.image && /Knives|Gloves/.test(s.category?.name || ''));
    if (rares.length) push(rares[hash(def.id + 'k') % rares.length], 'rarespecial');
  }

  return items;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  let cratesPath = get('--crates');
  let skinsPath = get('--skins');

  if (args.includes('--fetch')) {
    const tmp = path.join(require('node:os').tmpdir(), 'cs2data');
    fs.mkdirSync(tmp, { recursive: true });
    cratesPath = cratesPath || path.join(tmp, 'crates.json');
    skinsPath = skinsPath || path.join(tmp, 'skins.json');
    if (!fs.existsSync(cratesPath)) await ghFile('public/api/en/crates.json', cratesPath);
    if (!fs.existsSync(skinsPath)) await ghFile('public/api/en/skins.json', skinsPath);
  }
  if (!cratesPath || !skinsPath) {
    console.error('usage: node tools/build-catalog.js --fetch   (or --crates x.json --skins y.json)');
    process.exit(1);
  }

  const crates = JSON.parse(fs.readFileSync(cratesPath, 'utf8'));
  const rawSkins = JSON.parse(fs.readFileSync(skinsPath, 'utf8'));
  const skins = {
    list: rawSkins,
    byId: new Map(rawSkins.map((s) => [s.id, s])),
  };
  const crateByName = new Map(crates.map((c) => [c.name, c]));

  /* ---- partition the ★ (knife + glove) pool across the cases ---------------- */
  const seenRare = new Set();
  const allRare = rawSkins
    .filter((s) => s.image && /Knives|Gloves/.test(s.category?.name || ''))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .filter((s) => (seenRare.has(s.name) ? false : seenRare.add(s.name)));
  const knifeList = allRare.filter((s) => /Knives/.test(s.category.name));
  const gloveList = allRare.filter((s) => /Gloves/.test(s.category.name));
  const valveDefs = CASES.filter((d) => d.crate);
  const knifeSlices = { byCase: new Map(), knife: [], glove: [] };
  // originals get a generous slice each, then the rest is shared out to the Valve cases
  knifeSlices.knife = knifeList.splice(0, 16);
  knifeSlices.glove = gloveList.splice(0, 14);
  const per = 12; // knives listed on each Valve case's rare pool
  valveDefs.forEach((def, i) => {
    knifeSlices.byCase.set(def.id, knifeList.slice(i * per, (i + 1) * per));
  });
  console.log(`[catalog] ★ pool split: ${knifeSlices.knife.length}+${knifeSlices.glove.length} to originals, ${knifeList.length} shared over ${valveDefs.length} Valve cases`);

  const out = { source: 'ByMykel/CSGO-API (CS2 item data)', builtAt: new Date().toISOString(), cases: [] };

  for (const def of CASES) {
    let crate = def.crate ? crateByName.get(def.crate) : null;
    if (def.original === 'knife') {
      crate = { name: def.name, contains: [], contains_rare: knifeSlices.knife };
    } else if (def.original === 'glove') {
      crate = { name: def.name, contains: [], contains_rare: knifeSlices.glove };
    } else if (crate) {
      // Valve lists the same ★ pool on every case; give each case its own slice so a
      // given knife has one value in the whole sim instead of one per case.
      const assigned = knifeSlices.byCase.get(def.id) || [];
      if (assigned.length) crate = { ...crate, contains_rare: assigned };
    }
    if (!crate) { console.warn(`[catalog] skipping ${def.id}: crate "${def.crate}" not found`); continue; }

    let items = buildCase(def, crate, skins);

    /* ---- price the case from the odds it actually ships --------------------
     * Valve cases: the published rarity ladder, items priced off the case tier.
     * Originals:   items are re-tiered by prestige into the same kind of ladder,
     *              so a knife case still pays junk most of the time and a jackpot
     *              roughly once in 300+ opens.
     */
    let chance;
    if (def.original) {
      items.sort((a, b) => a.base - b.base);
      const TIERS = [
        { odds: 0.700, mult: 0.35 },
        { odds: 0.210, mult: 1.20 },
        { odds: 0.065, mult: 4.00 },
        { odds: 0.022, mult: 14.0 },
        { odds: 0.003, mult: 90.0 },
      ];
      const anchor = def.gems;
      const per = Math.ceil(items.length / TIERS.length);
      // each prestige tier maps onto one rung of the same rarity ladder the
      // Valve cases use, so the odds the UI prints are the odds the roll uses
      const TIER_RARITY = ['rarity_rare', 'rarity_mythical', 'rarity_legendary', 'rarity_ancient', 'rarespecial'];
      const buckets = TIERS.map(() => []);
      items.forEach((it, i) => {
        const t = Math.min(TIERS.length - 1, Math.floor(i / per));
        it.tier = t;
        it.rarity = TIER_RARITY[t];
        it.base = Math.max(1, Math.round(anchor * TIERS[t].mult * jitter(hash(it.name), 0.85, 1.15) / 5) * 5);
        buckets[t].push(it);
      });
      // split each tier's odds between the items that actually landed in it,
      // otherwise a thin top tier silently pays a quarter of its advertised odds
      buckets.forEach((list, t) => {
        const share = Math.round((TIERS[t].odds / Math.max(1, list.length)) * 100000) / 100000;
        list.forEach((it) => { it.chance = share; });
      });
      chance = items.map((i) => i.chance);
    } else {
      const byTier = {};
      for (const it of items) (byTier[it.rarity] = byTier[it.rarity] || []).push(it);
      chance = items.map((it) => (RARITY_ODDS[it.rarity] || 0) / byTier[it.rarity].length);
      items.forEach((it, i) => { it.chance = Math.round(chance[i] * 100000) / 100000; });
    }

    const rawEv = items.reduce((s, i) => s + i.chance * i.base, 0);
    const ev = rawEv * EXPECTED_WEAR * EXPECTED_STATTRAK;
    const price = Math.max(10, Math.round(ev / 0.9 / 5) * 5);

    // odds are rounded for display; nudge the cheapest item so they sum to exactly 1
    const drift = 1 - items.reduce((s, i) => s + i.chance, 0);
    if (Math.abs(drift) > 1e-9) {
      let cheapest = items[0];
      for (const it of items) if (it.base < cheapest.base) cheapest = it;
      cheapest.chance = Math.round((cheapest.chance + drift) * 1000000) / 1000000;
    }

    if (items.length < 6) { console.warn(`[catalog] skipping ${def.id}: only ${items.length} items`); continue; }

    out.cases.push({
      id: def.id,
      name: def.name || crate.name,
      gems: price,
      tag: def.tag,
      origin: def.original ? 'original' : 'valve',
      image: crate.image || null,
      items,
    });
    console.log(`[catalog] ${(def.name || crate.name).padEnd(30)} price=${String(price).padStart(7)} gems  items=${String(items.length).padStart(3)}  EV≈${Math.round(ev)}  return=90%`);
  }

  // rarity table (real CS2 names + colours, plus the synthetic Rare Special tier)
  // drop-time tables — the server rolls wear + StatTrak with exactly these numbers
  out.wears = WEAR;
  out.stattrak = STATTRAK;
  out.rarities = {
    rarity_common: { name: 'Consumer Grade', color: '#b0c3d9', short: 'Consumer' },
    rarity_uncommon: { name: 'Industrial Grade', color: '#5e98d9', short: 'Industrial' },
    rarity_rare: { name: 'Mil-Spec', color: '#4b69ff', short: 'Mil-Spec' },
    rarity_mythical: { name: 'Restricted', color: '#8847ff', short: 'Restricted' },
    rarity_legendary: { name: 'Classified', color: '#d32ce6', short: 'Classified' },
    rarity_ancient: { name: 'Covert', color: '#eb4b4b', short: 'Covert' },
    rarespecial: { name: 'Rare Special', color: '#ffd700', short: 'Rare Special' },
  };

  // knives + gloves worth "upgrading" into, used as upgrader/Jackpot targets
  out.pool = rawSkins
    .filter((s) => s.image && (s.rarity?.id === 'rarity_ancient' || s.rarity?.id === 'rarity_legendary'))
    .slice(0, 400)
    .map((s) => ({
      id: s.id,
      name: s.name,
      weapon: (s.weapon && s.weapon.name) || '',
      rarity: s.rarity.id,
      image: s.image,
      base: Math.round(600 * jitter(hash(s.name), 0.5, 6) * (s.rarity.id === 'rarity_ancient' ? 3 : 1)),
      seed: hash(s.name) % 100000,
    }));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  const itemCount = out.cases.reduce((s, c) => s + c.items.length, 0);
  console.log(`\n[catalog] wrote ${OUT} — ${out.cases.length} cases, ${itemCount} items, ${kb} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
