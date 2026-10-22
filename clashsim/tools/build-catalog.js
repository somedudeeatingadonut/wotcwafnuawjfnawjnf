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
  /* ---- the Valve ladder, cheapest first ------------------------------------
   * 41 real cases, roughly the order a real lobby lists them in: the 2013
   * originals at the bottom, this year's case at the top. `gems` is the sim's
   * starting price; the builder re-prices every case from the odds it ships,
   * so the ladder is a shape, not a promise. */
  { id: 'weapon-case-1',      crate: 'CS:GO Weapon Case',              gems: 50,    tag: 'classic',  kind: 'valve' },
  { id: 'esports-2013',       crate: 'eSports 2013 Case',              gems: 60,    tag: 'classic',  kind: 'valve' },
  { id: 'weapon-case-2',      crate: 'CS:GO Weapon Case 2',            gems: 70,    tag: 'classic',  kind: 'valve' },
  { id: 'bravo',              crate: 'Operation Bravo Case',           gems: 90,    tag: 'classic',  kind: 'valve' },
  { id: 'esports-winter-2013',crate: 'eSports 2013 Winter Case',       gems: 110,   tag: 'classic',  kind: 'valve' },
  { id: 'weapon-case-3',      crate: 'CS:GO Weapon Case 3',            gems: 130,   tag: 'classic',  kind: 'valve' },
  { id: 'winter-offensive',   crate: 'Winter Offensive Weapon Case',   gems: 150,   tag: 'classic',  kind: 'valve' },
  { id: 'phoenix',            crate: 'Operation Phoenix Weapon Case',  gems: 175,   tag: 'classic',  kind: 'valve' },
  { id: 'esports-summer-2014',crate: 'eSports 2014 Summer Case',       gems: 200,   tag: 'classic',  kind: 'valve' },
  { id: 'breakout',           crate: 'Operation Breakout Weapon Case', gems: 230,   tag: 'classic',  kind: 'valve' },
  { id: 'vanguard',           crate: 'Operation Vanguard Weapon Case', gems: 260,   tag: 'classic',  kind: 'valve' },
  { id: 'chroma-1',           crate: 'Chroma Case',                    gems: 300,   tag: 'budget',   kind: 'valve' },
  { id: 'chroma-2',           crate: 'Chroma 2 Case',                  gems: 340,   tag: 'budget',   kind: 'valve' },
  { id: 'falchion',           crate: 'Falchion Case',                  gems: 380,   tag: 'budget',   kind: 'valve' },
  { id: 'shadow',             crate: 'Shadow Case',                    gems: 420,   tag: 'budget',   kind: 'valve' },
  { id: 'wildfire',           crate: 'Operation Wildfire Case',        gems: 460,   tag: 'budget',   kind: 'valve' },
  { id: 'revolver',           crate: 'Revolver Case',                  gems: 500,   tag: 'budget',   kind: 'valve' },
  { id: 'chroma-3',           crate: 'Chroma 3 Case',                  gems: 560,   tag: 'budget',   kind: 'valve' },
  { id: 'gamma-1',            crate: 'Gamma Case',                     gems: 640,   tag: 'budget',   kind: 'valve' },
  { id: 'gamma-2',            crate: 'Gamma 2 Case',                   gems: 720,   tag: 'budget',   kind: 'valve' },
  { id: 'spectrum-1',         crate: 'Spectrum Case',                  gems: 800,   tag: 'mid',      kind: 'valve' },
  { id: 'spectrum-2',         crate: 'Spectrum 2 Case',                gems: 900,   tag: 'mid',      kind: 'valve' },
  { id: 'hydra',              crate: 'Operation Hydra Case',           gems: 1000,  tag: 'mid',      kind: 'valve' },
  { id: 'prisma',             crate: 'Prisma Case',                    gems: 1150,  tag: 'mid',      kind: 'valve' },
  { id: 'huntsman',           crate: 'Huntsman Weapon Case',           gems: 1300,  tag: 'mid',      kind: 'valve' },
  { id: 'cs20',               crate: 'CS20 Case',                      gems: 1450,  tag: 'mid',      kind: 'valve' },
  { id: 'prisma-2',           crate: 'Prisma 2 Case',                  gems: 1650,  tag: 'mid',      kind: 'valve' },
  { id: 'clutch',             crate: 'Clutch Case',                    gems: 1850,  tag: 'mid',      kind: 'valve' },
  { id: 'danger-zone',        crate: 'Danger Zone Case',               gems: 2100,  tag: 'mid',      kind: 'valve' },
  { id: 'shattered-web',      crate: 'Shattered Web Case',             gems: 2400,  tag: 'mid',      kind: 'valve' },
  { id: 'horizon',            crate: 'Horizon Case',                   gems: 2700,  tag: 'high',     kind: 'valve' },
  { id: 'fracture',           crate: 'Fracture Case',                  gems: 3100,  tag: 'high',     kind: 'valve' },
  { id: 'snakebite',          crate: 'Snakebite Case',                 gems: 3500,  tag: 'high',     kind: 'valve' },
  { id: 'broken-fang',        crate: 'Operation Broken Fang Case',     gems: 4000,  tag: 'high',     kind: 'valve' },
  { id: 'dreams',             crate: 'Dreams & Nightmares Case',       gems: 4600,  tag: 'high',     kind: 'valve' },
  { id: 'riptide',            crate: 'Operation Riptide Case',         gems: 5300,  tag: 'high',     kind: 'valve' },
  { id: 'recoil',             crate: 'Recoil Case',                    gems: 6000,  tag: 'high',     kind: 'valve' },
  { id: 'revolution',         crate: 'Revolution Case',                gems: 7000,  tag: 'high',     kind: 'valve' },
  { id: 'kilowatt',           crate: 'Kilowatt Case',                  gems: 8500,  tag: 'premium',  kind: 'valve' },
  { id: 'gallery',            crate: 'Gallery Case',                   gems: 12000, tag: 'premium',  kind: 'valve' },
  { id: 'fever',              crate: 'Fever Case',                     gems: 25000, tag: 'premium',  kind: 'valve' },

  /* ---- sticker capsules ----------------------------------------------------
   * Real capsules, and stickers do not have wear or StatTrak, so these cases
   * ship "flat" items: the value is the value. */
  { id: 'capsule-birthday',   crate: '10 Year Birthday Sticker Capsule',     gems: 800,  tag: 'capsule', kind: 'sticker', slice: 28 },
  { id: 'capsule-stockholm',  crate: 'Stockholm 2021 Legends Sticker Capsule', gems: 1200, tag: 'capsule', kind: 'sticker', slice: 30 },
  { id: 'capsule-katowice',   crate: 'EMS Katowice 2014 Legends',            gems: 9000, tag: 'capsule', kind: 'sticker', slice: 24 },

  /* ---- community cases -----------------------------------------------------
   * The real lobby's second half is player-made cases: someone picks the items,
   * the art and the odds. These twelve are built the same way — a themed item
   * pool, creator-style odds, and case art from the dump in the repo (the real
   * cover images, credited in the README). `theme` names the pool the builder
   * draws from; see COMMUNITY_THEMES below. */
  { id: 'community-crimson-squad',  community: 'Crimson Squad Case',   art: 'crimson-squad',  gems: 900,   tag: 'community', kind: 'community', theme: 'ak-red' },
  { id: 'community-ten-percent',    community: 'Ten Percent Case',     art: 'ten-percent',    gems: 1500,  tag: 'community', kind: 'community', theme: 'm4' },
  { id: 'community-nightshade',     community: 'Nightshade Case',      art: 'nightshade',     gems: 2200,  tag: 'community', kind: 'community', theme: 'sniper' },
  { id: 'community-broken-heart',   community: 'Broken Heart Case',    art: 'broken-heart',   gems: 1100,  tag: 'community', kind: 'community', theme: 'pistol' },
  { id: 'community-reaper',         community: 'Reaper Case',          art: 'reaper',         gems: 6000,  tag: 'community', kind: 'community', theme: 'knife' },
  { id: 'community-golden-halo',    community: 'Golden Halo Case',     art: 'golden-halo',    gems: 9000,  tag: 'community', kind: 'community', theme: 'covert' },
  { id: 'community-insurgency',     community: 'Insurgency Case',      art: 'insurgency',     gems: 700,   tag: 'community', kind: 'community', theme: 'military' },
  { id: 'community-glove-trade',    community: 'Glove Trade Case',     art: 'glove-trade',    gems: 15000, tag: 'community', kind: 'community', theme: 'glove' },
  { id: 'community-graffiti-chaos', community: 'Graffiti Chaos Case',  art: 'graffiti-chaos', gems: 400,   tag: 'community', kind: 'community', theme: 'chaos' },
  { id: 'community-golden-katowice',community: 'Golden Katowice Case', art: 'golden-katowice',gems: 12000, tag: 'community', kind: 'community', theme: 'gold' },
  { id: 'community-jungle-warfare', community: 'Jungle Warfare Case',  art: 'jungle-warfare', gems: 1800,  tag: 'community', kind: 'community', theme: 'woodland' },
  { id: 'community-frozen-assault', community: 'Frozen Assault Case',  art: 'frozen-assault', gems: 3200,  tag: 'community', kind: 'community', theme: 'ice' },

  /* ---- the site's own cases, built like a case site builds them ------------- */
  { id: 'knife-original', original: 'knife', gems: 5000,  tag: 'original', kind: 'original', name: 'Clash Knife Case' },
  { id: 'glove-original', original: 'glove', gems: 15000, tag: 'original', kind: 'original', name: 'Clash Glove Case' },
];

/* Community cases are themed pools. Each theme is a predicate over the public
 * skin list: weapon family, finish name, or both. The builder tiers the matches
 * by value so the case still has a junk rung and a jackpot rung. */
const COMMUNITY_THEMES = {
  'ak-red':    { weapons: ['AK-47'], match: /Redline|Bloodsport|Crimson|Wasteland|Vulcan|Case Hardened|Jaguar|Elite Build|Point Disarray|Head Shot|Slate|Asiimov|Neon Rider|Legion of Anubis/i },
  m4:          { weapons: ['M4A4', 'M4A1-S'], match: /Asiimov|Hyper Beast|Desolate Space|Neo-Noir|Cyber Security|The Emperor|Player Two|Welcome to the Jungle|Temukau|Black Lotus|Printstream|Nightwish/i },
  sniper:      { weapons: ['AWP', 'SSG 08', 'SCAR-20', 'G3SG1'], match: /Asiimov|Dragon Lore|Wildfire|Neo-Noir|Containment Breach|Fade|Chromatic Aberration|Blood in the Water|Death Strike|Hyper Beast|Mortis|Chrome Cannon|Electric Hive|Atheris|Acid Fade|Big Iron/i },
  pistol:      { weapons: ['Desert Eagle', 'USP-S', 'Glock-18', 'P250', 'Five-SeveN', 'Tec-9', 'CZ75-Auto', 'P2000', 'Dual Berettas', 'R8 Revolver'], match: /Printstream|Kill Confirmed|Blaze|Code Red|Fade|Neo-Noir|Cortex|Ocean Drive|Fade|Crimson Web|Hyper Beast|Emerald|Blossom|Water Elemental|Vulcan|Blueprint|Moonrise/i },
  knife:       { rarespecial: true },
  glove:       { rarespecial: true, gloves: true },
  covert:      { tier: ['rarity_ancient', 'rarity_legendary'] },
  military:    { weapons: ['Galil AR', 'FAMAS', 'SG 553', 'AUG', 'M249', 'Negev', 'MP5-SD', 'UMP-45'], match: /|/ },
  woodland:    { weapons: ['AK-47', 'M4A1-S', 'SSG 08', 'MP9', 'MAC-10', 'UMP-45', 'XM1014', 'MAG-7', 'SG 553'], match: /Jungle|Forest|Bamboo|Wood|Commando|Safari|Predator|Grass|Camo|Boreal|Anubis|Sand|Moss|Hunter/i },
  ice:         { match: /Frost|Ice|Glacier|Winter|Snow|Permafrost|Arctic|Blizzard|Freeze|Blue|Aquamarine|Neon|Cyan/i },
  gold:        { match: /Gold|Golden|Aurum|Brass|Amber|Honey|Sand Dune|Bullion|Noble/i },
  chaos:       { match: /|/, spread: true },
};

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

/** How many items land on each rung of a synthetic ladder: a wide bottom rung
 *  and a thin top one, like a real case skin list. Every rung gets at least one
 *  item — a rung with no items can never drop, and its printed odds would be a
 *  lie. (A 12-item case used to leave the top rung empty this way.) */
function splitTiers(n, weights = [0.40, 0.26, 0.18, 0.10, 0.06]) {
  const counts = weights.map((w) => Math.max(1, Math.floor(n * w)));
  counts[0] += n - counts.reduce((s, c) => s + c, 0);
  for (let t = 1; counts[0] < 1 && t < counts.length; t++) {
    while (counts[0] < 1 && counts[t] > 1) { counts[t]--; counts[0]++; }
  }
  return counts;
}

/** Fill tier buckets from a cheapest-first list: cheap items fill the bottom
 *  rung, the most expensive land on the top rung. Returns [buckets, counts]. */
function bucketByTier(sorted, tiers) {
  const counts = splitTiers(sorted.length);
  const buckets = tiers.map(() => []);
  let i = 0;
  for (let t = 0; t < tiers.length; t++) {
    for (let k = 0; k < counts[t]; k++) buckets[t].push(sorted[i++]);
  }
  return buckets;
}

async function ghFile(repoPath, dest) {
  // api.github.com is the only GitHub host this sandbox may reach, and its contents
  // endpoint happily serves multi-megabyte JSON through the raw media type.
  const url = `https://api.github.com/repos/ByMykel/CSGO-API/contents/${repoPath}`;
  console.log(`[catalog] downloading ${repoPath} …`);
  try {
    const res = await fetch(url, { headers: { accept: 'application/vnd.github.raw', 'user-agent': 'clashsim-catalog' } });
    if (!res.ok) throw new Error(`${repoPath}: HTTP ${res.status}`);
    const text = await res.text();
    fs.writeFileSync(dest, text);
    console.log(`[catalog]  → ${(text.length / 1048576).toFixed(1)} MB saved to ${dest}`);
  } catch (err) {
    // some sandboxes MITM TLS and node's fetch rejects the proxy CA — the gh CLI
    // is authenticated and already trusts the chain, so fall back to it
    console.log(`[catalog]  fetch failed (${err.message}); retrying via gh api`);
    const { spawnSync } = require('node:child_process');
    const r = spawnSync('gh', ['api', `repos/ByMykel/CSGO-API/contents/${repoPath}`, '-H', 'Accept: application/vnd.github.raw'], { maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`${repoPath}: gh api failed: ${r.stderr}`);
    fs.writeFileSync(dest, r.stdout);
    console.log(`[catalog]  → ${(r.stdout.length / 1048576).toFixed(1)} MB saved to ${dest}`);
  }
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

/** Themed item pool for a community case: real skins that match the theme. */
const COMMUNITY_FALLBACK = ['AK-47', 'M4A4', 'M4A1-S', 'AWP', 'Desert Eagle', 'USP-S', 'Glock-18', 'MP9', 'P90', 'Galil AR', 'FAMAS'];
function communityPool(themeName, skins) {
  const theme = COMMUNITY_THEMES[themeName] || {};
  const everything = (skins.list || []).filter((s) => s.image && s.name);
  const all = everything.filter((s) => !s.name.startsWith('★'));
  if (theme.rarespecial) {
    // ★ items are the knives/gloves, so this pool deliberately keeps them
    const kind = theme.gloves ? /Gloves/ : /Knives/;
    const rares = everything.filter((s) => kind.test(s.category?.name || ''));
    return rares.sort((a, b) => (a.name < b.name ? -1 : 1));
  }
  let pool = all;
  if (theme.spread) {
    // a mixed case: walk the whole list so the pool covers every rarity band
    const step = Math.max(1, Math.floor(all.length / 40));
    pool = all.filter((_, i) => i % step === 0);
  }
  if (theme.tier) pool = pool.filter((s) => theme.tier.includes(s.rarity?.id));
  if (theme.weapons) {
    const want = new Set(theme.weapons);
    const byWeapon = pool.filter((s) => want.has(s.weapon?.name));
    if (byWeapon.length >= 8) pool = byWeapon;
  }
  if (theme.match && theme.match.source !== '(?:)') {
    const byFinish = pool.filter((s) => theme.match.test(s.name));
    if (byFinish.length >= 8) pool = byFinish; else pool = pool.concat(byFinish);
  }
  // community cases show a spread of values: sort by rarity then shuffle within
  const rank = { rarity_ancient: 0, rarity_legendary: 1, rarity_mythical: 2, rarity_rare: 3, rarity_uncommon: 4, rarity_common: 5 };
  const uniq = [];
  const dup = new Set();
  for (const s of pool.sort((a, b) => (rank[a.rarity?.id] ?? 9) - (rank[b.rarity?.id] ?? 9))) {
    if (dup.has(s.name)) continue;
    dup.add(s.name);
    uniq.push(s);
  }
  if (uniq.length < 8) {
    const wide = all.filter((s) => COMMUNITY_FALLBACK.includes(s.weapon?.name));
    for (const s of wide) { if (!dup.has(s.name)) { dup.add(s.name); uniq.push(s); } }
  }
  return uniq;
}

function buildCase(def, crate, skins) {
  const items = [];
  const seen = new Set();
  const flat = def.kind === 'sticker';

  // community cases are built from a themed pool instead of a crate's contents
  if (def.kind === 'community') {
    const pool = communityPool(def.theme, skins);
    if (pool.length) crate = { name: def.community, contains: pool.slice(0, 20), contains_rare: [] };
  }

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
    const entry = {
      id: raw.id || name,
      name,
      weapon,
      pattern,
      rarity,
      base: baseValue,
      image: raw.image || null,
      seed: seed % 100000,
    };
    if (flat) entry.flat = true;         // stickers: no wear roll, no StatTrak
    items.push(entry);
  };

  for (const it of crate.contains || []) push(it);
  if (!flat) for (const it of crate.contains_rare || []) push(it, 'rarespecial');

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
    } else if (def.kind === 'community') {
      // the pool is filled in by buildCase() from COMMUNITY_THEMES
      crate = { name: def.community, contains: [], contains_rare: [] };
    } else if (crate) {
      // Valve lists the same ★ pool on every case; give each case its own slice so a
      // given knife has one value in the whole sim instead of one per case.
      const assigned = knifeSlices.byCase.get(def.id) || [];
      if (assigned.length) crate = { ...crate, contains_rare: assigned };
    }
    if (!crate) { console.warn(`[catalog] skipping ${def.id}: crate "${def.crate}" not found`); continue; }

    let items = buildCase(def, crate, skins);
    // capsules list hundreds of stickers; ship a deterministic slice
    if (def.slice && items.length > def.slice) {
      items = items.slice().sort((a, b) => (a.name < b.name ? -1 : 1)).slice(0, def.slice);
    }

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
      // each prestige tier maps onto one rung of the same rarity ladder the
      // Valve cases use, so the odds the UI prints are the odds the roll uses
      const TIER_RARITY = ['rarity_rare', 'rarity_mythical', 'rarity_legendary', 'rarity_ancient', 'rarespecial'];
      const buckets = bucketByTier(items, TIERS);
      buckets.forEach((list, t) => list.forEach((it) => {
        it.tier = t;
        it.rarity = TIER_RARITY[t];
        it.base = Math.max(1, Math.round(anchor * TIERS[t].mult * jitter(hash(it.name), 0.85, 1.15) / 5) * 5);
      }));
      // split each tier's odds between the items that actually landed in it,
      // otherwise a thin top tier silently pays a quarter of its advertised odds
      buckets.forEach((list, t) => {
        const share = Math.round((TIERS[t].odds / Math.max(1, list.length)) * 100000) / 100000;
        list.forEach((it) => { it.chance = share; });
      });
      chance = items.map((i) => i.chance);
    } else if (def.kind === 'community' || def.kind === 'sticker') {
      /* Creator-style odds: a community case is made by a player picking items and
       * chances, so it does not have to match Valve's ladder. Community cases use
       * a 62/24/10/3/1 spread; sticker capsules use a flatter 5-rung ladder. */
      const TIERS = def.kind === 'sticker'
        ? [{ odds: 0.50, mult: 0.22 }, { odds: 0.28, mult: 0.70 }, { odds: 0.15, mult: 2.2 }, { odds: 0.055, mult: 8.0 }, { odds: 0.015, mult: 30.0 }]
        : [{ odds: 0.62, mult: 0.30 }, { odds: 0.24, mult: 1.15 }, { odds: 0.10, mult: 4.2 }, { odds: 0.03, mult: 15.0 }, { odds: 0.01, mult: 70.0 }];
      const TIER_RARITY = ['rarity_rare', 'rarity_mythical', 'rarity_legendary', 'rarity_ancient', 'rarespecial'];
      if (def.kind === 'sticker') {
        /* Stickers have their own rarity ladder — High Grade → Extraordinary —
         * which is what the real capsules print. */
        TIER_RARITY.length = 0;
        TIER_RARITY.push('sticker_high', 'sticker_remarkable', 'sticker_exotic', 'sticker_extraordinary', 'sticker_extraordinary');
      }
      // rank the pool by value so each rung gets a slice, cheapest first
      const sorted = items.slice().sort((a, b) => a.base - b.base);
      const buckets = bucketByTier(sorted, TIERS);
      buckets.forEach((list, t) => list.forEach((it) => {
        it.rarity = TIER_RARITY[t];
        it.base = Math.max(1, Math.round(def.gems * TIERS[t].mult * jitter(hash(it.name), 0.85, 1.15) / 5) * 5);
      }));
      // keep the array order stable for the catalog
      const byName = new Map();
      buckets.forEach((list, t) => list.forEach((it) => byName.set(it, { t, list })));
      items.forEach((it) => {
        const info = byName.get(it);
        it.chance = Math.round((TIERS[info.t].odds / Math.max(1, info.list.length)) * 100000) / 100000;
      });
      chance = items.map((i) => i.chance);
    } else {
      const byTier = {};
      for (const it of items) (byTier[it.rarity] = byTier[it.rarity] || []).push(it);
      chance = items.map((it) => (RARITY_ODDS[it.rarity] || 0) / byTier[it.rarity].length);
      items.forEach((it, i) => { it.chance = Math.round(chance[i] * 100000) / 100000; });
    }

    const rawEv = items.reduce((s, i) => s + i.chance * i.base, 0);
    const flatCase = def.kind === 'sticker';
    const ev = flatCase ? rawEv : rawEv * EXPECTED_WEAR * EXPECTED_STATTRAK;
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
      name: def.name || def.community || crate.name,
      gems: price,
      tag: def.tag,
      origin: def.original ? 'original' : (def.kind === 'community' ? 'community' : 'valve'),
      kind: def.kind || 'valve',
      style: flatCase ? 'sticker' : 'weapon',
      art: def.art ? `art/cases/${def.art}.webp` : null,
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
    /* sticker capsules print their own ladder */
    sticker_high: { name: 'High Grade', color: '#4b69ff', short: 'High Grade' },
    sticker_remarkable: { name: 'Remarkable', color: '#8847ff', short: 'Remarkable' },
    sticker_exotic: { name: 'Exotic', color: '#d32ce6', short: 'Exotic' },
    sticker_extraordinary: { name: 'Extraordinary', color: '#eb4b4b', short: 'Extraordinary' },
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
