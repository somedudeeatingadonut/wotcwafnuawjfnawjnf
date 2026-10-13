#!/usr/bin/env node
/**
 * build-clash-catalog.js — builds the "clash pack": the cases the real site runs.
 *
 * Three groups, all named from the real thing:
 *
 *   clash-classic   real Valve cases, real contents (ByMykel/CSGO-API), priced by
 *                   the sim's rule (price = EV / 0.9), same ladder as the originals
 *   clash-original  the site's own cases. The names come from the curated lists
 *                   embedded in the clash.gg bundle (`highest_roi`, `best_knives`,
 *                   `best_awp`, `most_expensive`, `free_cases`, `best_weapon`,
 *                   `best_gloves`, `best_stickers`) — e.g. 10percent-Knife,
 *                   Knife-50-50, Tomb-Raid, Eye-of-the-Dragon, Glove-Flip,
 *                   Holo-King, Level-200-Case. Contents are modelled from the
 *                   name's intent (knife cases really do carry a knife chance
 *                   matching the number in the name) using real item data.
 *   art             the 152 cases_*.webp case images out of the user's dump,
 *                   copied into public/art/ and assigned to the site's own cases
 *                   by name hash, so the shelf shows the real case art offline.
 *
 * Usage:
 *   node tools/build-clash-catalog.js --fetch --art /tmp/clashzip
 *   node tools/build-clash-catalog.js --crates a.json --skins b.json --art DIR
 *
 * Output: public/catalog-clash.json  +  public/art/case-<n>.webp
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'catalog-clash.json');
const ART_OUT = path.join(ROOT, 'public', 'art');

/* ------------------------------------------------------------------ pricing */

const WEAR = [
  { name: 'Factory New', short: 'FN', mult: 1.30, chance: 0.10 },
  { name: 'Minimal Wear', short: 'MW', mult: 1.12, chance: 0.18 },
  { name: 'Field-Tested', short: 'FT', mult: 1.00, chance: 0.40 },
  { name: 'Well-Worn', short: 'WW', mult: 0.90, chance: 0.18 },
  { name: 'Battle-Scarred', short: 'BS', mult: 0.78, chance: 0.14 },
];
const STATTRAK = { chance: 0.10, mult: 1.5 };
const EXPECTED_WEAR = WEAR.reduce((s, w) => s + w.chance * w.mult, 0);
const EXPECTED_STATTRAK = 1 + STATTRAK.chance * (STATTRAK.mult - 1);
const RARITY_ODDS = {
  rarity_rare: 0.7992, rarity_mythical: 0.1598, rarity_legendary: 0.0320,
  rarity_ancient: 0.0064, rarespecial: 0.0026,
};
const RARITY_MULT = {
  rarity_rare: 0.28, rarity_mythical: 1.35, rarity_legendary: 7.5,
  rarity_ancient: 38, rarespecial: 420,
};
const RARITY_TIER = ['rarity_rare', 'rarity_mythical', 'rarity_legendary', 'rarity_ancient', 'rarespecial'];

const PRESTIGE = {
  Karambit: 1.00, Butterfly: 0.95, Talon: 0.90, 'M9 Bayonet': 0.85, Bayonet: 0.72,
  Skeleton: 0.70, Stiletto: 0.66, Nomad: 0.58, Ursus: 0.56, Huntsman: 0.52,
  Kukri: 0.50, 'Classic Knife': 0.48, Bowie: 0.46, Flip: 0.44, Paracord: 0.40,
  Survival: 0.38, Falchion: 0.36, 'Shadow Daggers': 0.34, Gut: 0.28, Navaja: 0.24,
  'Sport Gloves': 0.90, 'Specialist Gloves': 0.86, 'Driver Gloves': 0.80,
  'Moto Gloves': 0.80, 'Hand Wraps': 0.76, 'Hydra Gloves': 0.70,
  'Bloodhound Gloves': 0.66, 'Broken Fang Gloves': 0.62,
};
const FINISH_BUMP = /Doppler|Fade|Case Hardened|Slaughter|Lore|Crimson Web|Tiger Tooth|Marble|Gamma|Autotronic|Emerald|Ruby|Sapphire|Black Pearl|Howl|Fire Serpent|Dragon Lore|Medusa|Hyper Beast|Gungnir|Wild Lotus|Vice|Amphibious|King Snake|Spearmint|Superconductor|Pandora|Hedge Maze|Cobalt Skulls|Nocts/i;

const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
};
const jitter = (seed, lo, hi) => lo + ((seed % 1000) / 1000) * (hi - lo);

/** price from the odds a case actually ships: price = EV / 0.9 (90% return). */
function priceFromItems(items, gemsHint) {
  const ev = items.reduce((s, i) => s + i.chance * i.base, 0) * EXPECTED_WEAR * EXPECTED_STATTRAK;
  if (gemsHint) return gemsHint;
  return Math.max(10, Math.round(ev / 0.9 / 5) * 5);
}

/** Split a set of tier weights across the items in those tiers, occupying
 *  `scale` of the case. Weights are normalised first, so a typo in a table can
 *  never produce a negative chance — which is exactly what happened once, when
 *  sticker weights summed to 2.02 and the rounding fix pushed an item to −78%. */
function spread(tiers, weights, scale = 1) {
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  tiers.forEach((list, i) => {
    const share = (scale * (weights[i] / total)) / Math.max(1, list.length);
    list.forEach((it) => { it.chance = Math.round(share * 1e6) / 1e6; });
  });
}

/** Give a list an exact, absolute share of the case — no normalisation. */
function spreadAbsolute(list, share) {
  if (!list.length) return;
  const each = Math.round((share / list.length) * 1e6) / 1e6;
  list.forEach((it) => { it.chance = each; });
}

/** nudge the cheapest item so the printed odds sum to exactly 1 */
function fixOdds(items) {
  const drift = 1 - items.reduce((s, i) => s + i.chance, 0);
  if (Math.abs(drift) > 1e-9) {
    let cheapest = items[0];
    for (const it of items) if (it.base < cheapest.base) cheapest = it;
    cheapest.chance = Math.round((cheapest.chance + drift) * 1e6) / 1e6;
  }
}

/* ------------------------------------------------------------------- inputs */

const splitName = (name) => {
  const clean = String(name || '').replace(/^★\s*/, '');
  const [weapon, pattern] = clean.split(' | ');
  return { weapon: weapon || clean, pattern: pattern || '' };
};

function makeItem(raw, category = 'weapon', opts = {}) {
  const name = String(raw.name || '').trim();
  const { weapon, pattern } = splitName(name);
  const seed = hash(name);
  const anchor = opts.anchor || 100;
  let base = anchor * (opts.mult || RARITY_MULT[opts.rarity] || 0.3);
  if (opts.rarity === 'rarespecial') {
    base *= PRESTIGE[weapon] || 0.35;
    if (FINISH_BUMP.test(pattern)) base *= 1.55;
  }
  if (opts.bump) base *= opts.bump;
  base *= jitter(seed, 0.72, 1.28) * jitter(hash(pattern + weapon), 0.88, 1.18);
  return {
    id: raw.id || name,
    name,
    weapon,
    pattern,
    rarity: opts.rarity || 'rarity_rare',
    base: Math.max(1, Math.round(base / 5) * 5),
    image: raw.image || null,
    seed: seed % 100000,
    category,
  };
}

/* --------------------------------------------------------------- case tables */

/* Real Valve cases the site lists as classics — picked for spread, not just price. */
const CLASH_CLASSIC = [
  { crate: 'Operation Bravo Case', tag: 'clash-classic' },
  { crate: 'Huntsman Weapon Case', tag: 'clash-classic' },
  { crate: 'Operation Breakout Weapon Case', tag: 'clash-classic' },
  { crate: 'Shadow Case', tag: 'clash-classic' },
  { crate: 'Spectrum Case', tag: 'clash-classic' },
  { crate: 'Clutch Case', tag: 'clash-classic' },
  { crate: 'Danger Zone Case', tag: 'clash-classic' },
  { crate: 'Snakebite Case', tag: 'clash-classic' },
];

/* The site's own cases: the exact names the curated lists in the clash.gg bundle
 * use, grouped the way the bundle groups them. `kind` drives contents + odds. */
const CLASH_ORIGINAL = [
  // best_knives / highest_roi — the knife-percentage cases
  { name: '10percent-Knife', kind: 'knife', pct: 10 },
  { name: '30percent-Knife', kind: 'knife', pct: 30 },
  { name: 'Knife-50-50', kind: 'knife', pct: 50 },
  { name: 'Knives-Out', kind: 'knife', pct: 35 },
  { name: 'Color-Hunt', kind: 'knife', pct: 25, finishes: /Fade|Doppler|Marble|Case Hardened|Slaughter|Tiger Tooth|Bright Water|Crimson/i },
  { name: 'Purple-Pack', kind: 'knife', pct: 18, finishes: /Doppler|Ultraviolet|Necropos|Purple|Amethyst|Gamma/i },
  { name: 'Vortex', kind: 'knife', pct: 45 },
  { name: 'Brokie-50-50', kind: 'fifty', pct: 50, premium: 0.6 },
  { name: 'Medium-50-50', kind: 'fifty', pct: 50, premium: 1.6 },
  { name: '60percent-Profit', kind: 'fifty', pct: 60, premium: 1.2 },
  // best_awp
  { name: 'AWP-Main', kind: 'awp', pct: 40 },
  { name: '10percent-AWP-Asiimov', kind: 'awp', pct: 10, finish: /Asiimov/i },
  { name: 'AWP-Main-V10', kind: 'awp', pct: 45 },
  { name: '10percent-AWP', kind: 'awp', pct: 10 },
  { name: 'AWP-Heaven', kind: 'awp', pct: 55 },
  // most_expensive
  { name: 'Tomb-Raid', kind: 'premium', pct: 12, finish: /Tomb|Anubis|Nile|Ashen|Pharaoh/i },
  { name: 'Wealth', kind: 'premium', pct: 14, finish: /Printstream|Neo-Noir|Wild Lotus|Bloodsport|Vice/i },
  { name: 'Twisted', kind: 'premium', pct: 16, finish: /Twist|Neon|Hyper Beast|Rider|Chromatic/i },
  { name: 'Eye-of-the-Dragon', kind: 'premium', pct: 10, finish: /Dragon|Fire Serpent|Medusa|Blaze|Fade/i },
  { name: 'Eclipse', kind: 'premium', pct: 15, finish: /Eclipse|Night|Black|Noir|Dark/i },
  // best_weapon
  { name: 'Killer-Loadout', kind: 'loadout', pct: 20 },
  { name: 'Pro-Loadout', kind: 'loadout', pct: 25 },
  { name: '20percent-Mid', kind: 'loadout', pct: 20 },
  { name: 'Stay-Frosty', kind: 'loadout', pct: 22, finish: /Frost|Ice|Snow|Glacier|Cold|Winter/i },
  { name: 'Howl-Abuser', kind: 'loadout', pct: 12, finish: /Howl|Fade|Printstream|Fire Serpent/i },
  // best_gloves
  { name: 'Glove-Flip', kind: 'glove', pct: 20 },
  { name: 'Finest-Gloves', kind: 'glove', pct: 12 },
  { name: '5percent-Gloves', kind: 'glove', pct: 5 },
  { name: 'Aces', kind: 'glove', pct: 8 },
  { name: 'Rains-and-Pours', kind: 'glove', pct: 15 },
  // best_stickers
  { name: 'Sticker-Package', kind: 'sticker', pct: 30 },
  { name: 'Capsule-King', kind: 'sticker', pct: 25 },
  { name: 'Encapsulated', kind: 'sticker', pct: 20 },
  { name: 'Holo-King', kind: 'sticker', pct: 15, holo: true },
  { name: 'Hologram', kind: 'sticker', pct: 35, holo: true },
  // free_cases — the level rewards
  { name: 'Nametag-Case', kind: 'level', level: 1 },
  { name: 'Level-5-Case', kind: 'level', level: 5 },
  { name: 'Level-10-Case', kind: 'level', level: 10 },
  { name: 'Level-20-Case', kind: 'level', level: 20 },
  { name: 'Level-200-Case', kind: 'level', level: 200 },
];

/** "10percent-Knife" → "10% Knife", "Level-200-Case" → "Level 200 Case". */
function prettyName(slug) {
  return String(slug)
    .replace(/(\d+)percent-/i, '$1% ')
    .replace(/-/g, ' ')
    .trim();
}

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ------------------------------------------------------------------ the build */

async function main() {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  let cratesPath = get('--crates');
  let skinsPath = get('--skins');
  const artDir = get('--art');

  if (args.includes('--fetch')) {
    const tmp = path.join(require('node:os').tmpdir(), 'cs2data');
    fs.mkdirSync(tmp, { recursive: true });
    cratesPath = cratesPath || path.join(tmp, 'crates.json');
    skinsPath = skinsPath || path.join(tmp, 'skins.json');
    for (const [repoPath, dest] of [['public/api/en/crates.json', cratesPath], ['public/api/en/skins.json', skinsPath]]) {
      if (fs.existsSync(dest)) continue;
      console.log(`[clash-pack] downloading ${repoPath} …`);
      const res = await fetch(`https://api.github.com/repos/ByMykel/CSGO-API/contents/${repoPath}`, {
        headers: { accept: 'application/vnd.github.raw', 'user-agent': 'clashsim-clash-pack' },
      });
      if (!res.ok) throw new Error(`${repoPath}: HTTP ${res.status}`);
      fs.writeFileSync(dest, await res.text());
      console.log(`[clash-pack]  → ${dest}`);
    }
  }
  if (!cratesPath || !skinsPath) {
    console.error('usage: node tools/build-clash-catalog.js --fetch [--art DIR]');
    process.exit(1);
  }

  const crates = JSON.parse(fs.readFileSync(cratesPath, 'utf8'));
  const skins = JSON.parse(fs.readFileSync(skinsPath, 'utf8'));
  const crateByName = new Map(crates.map((c) => [c.name, c]));

  /* ByMykel categories are Rifles / Pistols / SMGs / Heavy / Knives / Gloves. */
  const isGun = (s) => /^(Rifles|Pistols|SMGs|Heavy)$/.test(s.category?.name || '');
  const weapons = skins.filter((s) => s.image && isGun(s) && /_weapon$/.test(s.rarity?.id || ''));
  const knives = skins.filter((s) => s.image && /Knives/.test(s.category?.name || ''))
    .filter((s, i, all) => all.findIndex((x) => x.name === s.name) === i);
  const gloves = skins.filter((s) => s.image && /Gloves/.test(s.category?.name || ''))
    .filter((s, i, all) => all.findIndex((x) => x.name === s.name) === i);
  const awps = skins.filter((s) => s.image && /^AWP \|/.test(s.name));
  const byRarity = (list, want) => list.filter((s) => (s.rarity?.id || '').startsWith(want));

  /* ---- case art out of the dump ------------------------------------------- */
  const artFor = new Map();          // slug → 'art/case-N.webp'
  if (artDir) {
    const seen = new Map();          // case id → biggest file
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(p); continue; }
        const m = /^cases_(\d+)(?:_\d{3})?(?:_[A-Za-z0-9_-]+)?\.webp$/i.exec(entry.name);
        if (!m) continue;
        const id = Number(m[1]);
        const size = fs.statSync(p).size;
        if (!seen.has(id) || seen.get(id).size < size) seen.set(id, { size, path: p });
      }
    };
    walk(artDir);
    fs.mkdirSync(ART_OUT, { recursive: true });
    let n = 0;
    for (const [id, { path: src }] of [...seen.entries()].sort((a, b) => a[0] - b[0])) {
      const file = `case-${id}.webp`;
      fs.copyFileSync(src, path.join(ART_OUT, file));
      artFor.set(id, `art/${file}`);
      n++;
    }
    console.log(`[clash-pack] art: ${n} case images copied into public/art/ (${(fs.readdirSync(ART_OUT).reduce((s, f) => s + fs.statSync(path.join(ART_OUT, f)).size, 0) / 1048576).toFixed(1)} MB)`);
  }
  const artIds = [...artFor.keys()];
  const artBySlug = (slug) => (artIds.length ? artFor.get(artIds[hash(slug) % artIds.length]) : null);

  /* ---- clash classics ----------------------------------------------------- */
  const cases = [];
  const usedKnives = new Set();
  const sliceKnives = (n, seedStr) => {
    const out = [];
    let i = hash(seedStr) % Math.max(1, knives.length);
    while (out.length < n && usedKnives.size < knives.length) {
      const k = knives[i % knives.length];
      i++;
      if (usedKnives.has(k.name)) continue;
      usedKnives.add(k.name);
      out.push(k);
    }
    return out;
  };
  const sliceGloves = (n, seedStr) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push(gloves[(hash(seedStr) + i * 7) % gloves.length]);
    return out;
  };

  for (const def of CLASH_CLASSIC) {
    const crate = crateByName.get(def.crate);
    if (!crate) { console.warn(`[clash-pack] classic "${def.crate}" not in the data — skipped`); continue; }
    const slug = slugify(def.crate.replace(/ Case$| Weapon Case$/i, '') + '-classic');
    const items = [];
    const seen = new Set();
    const push = (raw, rarity) => {
      if (!raw?.name || seen.has(raw.name)) return;
      seen.add(raw.name);
      items.push(makeItem(raw, 'weapon', { rarity: rarity || String(raw.rarity?.id || 'rarity_rare').replace(/_weapon$/, ''), anchor: 200 }));
    };
    for (const it of crate.contains || []) push(it);
    for (const it of crate.contains_rare || []) push(it, 'rarespecial');
    if (!items.some((i) => i.rarity === 'rarespecial')) {
      for (const k of sliceKnives(8, slug)) push(k, 'rarespecial');
    }
    const have = new Set(items.map((i) => i.rarity));
    if (!have.has('rarity_ancient')) {
      const covert = byRarity(weapons, 'rarity_ancient')[hash(slug) % byRarity(weapons, 'rarity_ancient').length];
      if (covert) push(covert);
    }
    const byTier = {};
    for (const it of items) (byTier[it.rarity] = byTier[it.rarity] || []).push(it);
    items.forEach((it) => { it.chance = Math.round(((RARITY_ODDS[it.rarity] || 0) / byTier[it.rarity].length) * 1e5) / 1e5; });
    fixOdds(items);
    const starChance = items.filter((i) => i.rarity === 'rarespecial').reduce((s2, i) => s2 + i.chance, 0);
    const gems = priceFromItems(items);
    cases.push({
      id: `clash-${slug}`,
      name: crate.name,
      slug,
      gems,
      tag: def.tag,
      origin: 'clash-classic',
      image: artBySlug(slug) || crate.image,     // local art first: the preview has no network
      items,
    });
  }

  /* ---- clash originals ---------------------------------------------------- */
  const bumpFor = (name, re) => (re && re.test(name) ? 1.9 : 1);
  for (const def of CLASH_ORIGINAL) {
    const slug = slugify(def.name);
    const label = prettyName(def.name);
    const pct = (def.pct || 10) / 100;
    const items = [];
    const seen = new Set();
    const add = (raw, rarity, mult, extra) => {
      if (!raw?.name || seen.has(raw.name)) return null;
      seen.add(raw.name);
      const it = makeItem(raw, extra?.category || 'weapon', { rarity, mult, bump: extra?.bump, anchor: extra?.anchor });
      items.push(it);
      return it;
    };

    if (def.kind === 'knife' || def.kind === 'glove') {
      const pool = def.kind === 'knife' ? knives : gloves;
      const poolFiltered = def.finishes ? pool.filter((k) => def.finishes.test(k.name)) : pool;
      const use = poolFiltered.length >= 8 ? poolFiltered : pool;
      const picks = def.kind === 'knife' ? sliceKnives(10, slug) : sliceGloves(10, slug);
      const premium = picks.length ? picks : use.slice(0, 10).map((x) => x);
      premium.forEach((k) => add(k, 'rarespecial', RARITY_MULT.rarespecial));
      // fill the rest of the ladder from the weapon pool, priced so a ★ is the jackpot
      const fills = [
        { want: 'rarity_rare', mult: 0.30, n: 8 },
        { want: 'rarity_mythical', mult: 1.6, n: 6 },
        { want: 'rarity_legendary', mult: 9, n: 4 },
        { want: 'rarity_ancient', mult: 45, n: 3 },
      ];
      for (const f of fills) {
        const src = byRarity(weapons, f.want);
        for (let i = 0; i < f.n; i++) add(src[(hash(slug + f.want) + i * 13) % src.length], f.want, f.mult);
      }
      // odds: `pct` is the real knife/glove chance, split over the ★ pool;
      // the rest of the ladder follows the classic 80 / 16 / 3.2 / 0.64 shape
      const rest = 1 - pct;
      const stars = items.filter((i) => i.rarity === 'rarespecial');
      const tiers = [items.filter((i) => i.rarity === 'rarity_rare'), items.filter((i) => i.rarity === 'rarity_mythical'), items.filter((i) => i.rarity === 'rarity_legendary'), items.filter((i) => i.rarity === 'rarity_ancient')];
      // the named percentage is the ★ chance; the rest of the ladder keeps the
      // shape every case on the site uses (80 / 16 / 3.2 / 0.8 of what is left)
      spread(tiers, [0.80, 0.16, 0.032, 0.008], rest);
      // the ★ share is absolute (it is the number in the case's name), so it is
      // not passed through spread, which normalises its input instead
      spreadAbsolute(stars, pct);
    } else if (def.kind === 'awp') {
      const pool = def.finish ? awps.filter((a) => def.finish.test(a.name)) : awps;
      const use = pool.length >= 8 ? pool : awps;
      const picks = [];
      for (let i = 0; i < Math.min(14, use.length); i++) picks.push(use[(hash(slug) + i * 11) % use.length]);
      picks.forEach((s, i) => add(s, i < 3 ? 'rarity_ancient' : i < 7 ? 'rarity_legendary' : i < 11 ? 'rarity_mythical' : 'rarity_rare',
        i < 3 ? 42 : i < 7 ? 9 : i < 11 ? 1.8 : 0.32, { category: 'awp', bump: bumpFor(s.name, def.finish) }));
      // whatever the case is called, an AWP case is a normal ladder with a
      // fatter top rung: `pct` is the share of drops that are Covert-tier
      const top = 1 - pct;
      const groups = ['rarity_ancient', 'rarity_legendary', 'rarity_mythical', 'rarity_rare'].map((r) => items.filter((i) => i.rarity === r));
      spread(groups, [pct * 0.35, pct * 0.25, top * 0.32, top * 0.68]);
    } else if (def.kind === 'sticker') {
      const capsules = crates.filter((c) => c.type === 'Sticker Capsule' || c.type === 'Autograph Capsule');
      const stickerPool = [];
      for (const cap of capsules) for (const s of cap.contains || []) if (s.image && s.name) stickerPool.push(s);
      const holo = def.holo ? stickerPool.filter((s) => /Holo|Foil|Gold|Glitter|Lenticular/i.test(s.name)) : stickerPool;
      const use = holo.length >= 10 ? holo : stickerPool;
      const picks = [];
      for (let i = 0; i < Math.min(14, use.length); i++) picks.push(use[(hash(slug) + i * 17) % use.length]);
      picks.forEach((s, i) => add(s, i < 3 ? 'rarity_ancient' : i < 7 ? 'rarity_legendary' : i < 11 ? 'rarity_mythical' : 'rarity_rare',
        i < 3 ? 55 : i < 7 ? 11 : i < 11 ? 2.2 : 0.34, { category: 'sticker', bump: bumpFor(s.name, /Holo|Foil|Gold|Glitter/i) }));
      // sticker capsules skew even harder to the junk end than a weapon case
      const groups = ['rarity_ancient', 'rarity_legendary', 'rarity_mythical', 'rarity_rare'].map((r) => items.filter((i) => i.rarity === r));
      spread(groups, [0.006, 0.03, 0.16, 0.804]);
    } else if (def.kind === 'level') {
      const cap = Math.max(1, Math.min(200, def.level));
      // level cases hand out the low rungs, thinning out as the level climbs
      const cheap = [
        ...byRarity(weapons, 'rarity_uncommon'), ...byRarity(weapons, 'rarity_common'),
        ...byRarity(weapons, 'rarity_rare'), ...byRarity(weapons, 'rarity_mythical'),
      ];
      const picks = [];
      const n = 12;
      for (let i = 0; i < n; i++) picks.push(cheap[(hash(slug) + i * 19) % cheap.length]);
      // higher level → pricier case, better top end
      const anchor = 40 * Math.pow(1.35, Math.min(12, cap / 4));
      picks.forEach((s, i) => {
        const t = i % 4;
        add(s, ['rarity_rare', 'rarity_rare', 'rarity_mythical', 'rarity_legendary'][t],
          [0.5, 0.9, 2.6, 9][t] * (1 + cap / 200), { anchor });
      });
      const groups = ['rarity_rare', 'rarity_mythical', 'rarity_legendary', 'rarity_ancient'].map((r) => items.filter((i) => i.rarity === r));
      spread(groups, [0.72, 0.20, 0.07, 0.01]);
      if (def.name === 'Level-200-Case') {
        const knife = knives[hash(slug) % knives.length];
        if (knife) add(knife, 'rarespecial', RARITY_MULT.rarespecial, { bump: 1.4 });
        spreadAbsolute(items.filter((i) => i.rarity === 'rarespecial'), 0.004);
      }
    } else if (def.kind === 'premium' || def.kind === 'loadout' || def.kind === 'fifty') {
      const wantPremium = def.kind !== 'fifty';
      const pool = def.finish ? weapons.filter((s) => def.finish.test(s.name)) : weapons.filter((s) => /rarity_(ancient|legendary)/.test(s.rarity?.id || ''));
      const use = pool.length >= 10 ? pool : byRarity(weapons, 'rarity_ancient');
      const picks = [];
      const n = def.kind === 'fifty' ? 10 : 14;
      for (let i = 0; i < n; i++) picks.push(use[(hash(slug) + i * 23) % use.length]);
      const premiumShare = def.kind === 'fifty' ? Math.max(0.25, def.pct / 100) : Math.max(0.15, def.pct / 100);
      picks.forEach((s, i) => {
        const top = i < Math.ceil(n * 0.25);
        const mid = i < Math.ceil(n * 0.6);
        add(s, top ? 'rarity_ancient' : mid ? 'rarity_legendary' : 'rarity_mythical',
          (top ? 60 : mid ? 12 : wantPremium ? 2.4 : 0.9) * (def.premium || 1),
          { bump: bumpFor(s.name, def.finish) });
      });
      const weights = [premiumShare * 0.30, premiumShare * 0.55, 1 - premiumShare * 0.85];
      const groups = [items.filter((i) => i.rarity === 'rarity_ancient'), items.filter((i) => i.rarity === 'rarity_legendary'), items.filter((i) => i.rarity === 'rarity_mythical')];
      spread(groups, weights);
    }

    if (items.length < 6) { console.warn(`[clash-pack] "${label}" only produced ${items.length} items — skipped`); continue; }
    const drift = Math.abs(1 - items.reduce((s2, i) => s2 + i.chance, 0));
    if (drift > 0.01) console.warn(`[clash-pack] "${label}" odds were off by ${drift.toFixed(3)} before the rounding fix — check the tier weights`);
    fixOdds(items);
    const gems = priceFromItems(items);
    cases.push({
      id: `clash-${slug}`,
      name: label,
      slug,
      gems,
      tag: def.kind === 'level' ? 'level' : 'clash-original',
      origin: 'clash-original',
      image: artBySlug(slug),
      items,
    });
  }

  /* ---- write ------------------------------------------------------------- */
  const out = {
    source: 'ByMykel/CSGO-API item data + case names from the clash.gg bundle; case art from the clash.gg dump',
    builtAt: new Date().toISOString(),
    cases,
  };
  // strip the build-only fields
  for (const c of out.cases) for (const it of c.items) { delete it.category; delete it.tier; }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  const itemCount = out.cases.reduce((s, c) => s + c.items.length, 0);
  console.log(`\n[clash-pack] wrote ${OUT}`);
  console.log(`[clash-pack] ${out.cases.length} cases, ${itemCount} items, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
  for (const c of cases) {
    console.log(`   ${String(c.gems).padStart(8)} gems  ${c.origin.padEnd(14)}  ${c.name}  (${c.items.length} items)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
