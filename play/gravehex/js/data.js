'use strict';
// ───────────────────────── Game data: suits, rites, heroes, relics, scrolls, monsters, events ─────────────────────────
const SUITS = {
  steel: { name: 'Steel', col: '#c4d0e4', dark: '#2c3448' },
  blood: { name: 'Blood', col: '#ff5068', dark: '#4a0814' },
  bone: { name: 'Bone', col: '#f2e8d0', dark: '#4a4030' },
  hex: { name: 'Hex', col: '#c890ff', dark: '#2e1056' },
};
const SUIT_KEYS = Object.keys(SUITS);

const RES = {
  bone: { name: 'Bone', col: '#f2e8d0', terrain: 'Bonefield' },
  ichor: { name: 'Ichor', col: '#40e0b0', terrain: 'Ichor Fen' },
  iron: { name: 'Iron', col: '#a8b4c4', terrain: 'Iron Barrow' },
  gold: { name: 'Gold', col: '#ffd44a', terrain: 'Gilded Ruin' },
  soul: { name: 'Soul', col: '#5ad0ff', terrain: 'Soul Spire' },
};
const RES_KEYS = Object.keys(RES);

// lc / lm: Chips and Mult gained per level. Levels are capped per Act (see riteCap).
const RITES = {
  high: { name: 'Lone Strike', chips: 5, mult: 1, lc: 10, lm: 1, desc: 'Your single highest card' },
  pair: { name: 'Twin Fangs', chips: 10, mult: 2, lc: 10, lm: 1, desc: 'Two cards of one rank' },
  two: { name: 'Double Pact', chips: 20, mult: 2, lc: 15, lm: 1, desc: 'Two different pairs' },
  three: { name: 'Coven of Three', chips: 30, mult: 3, lc: 15, lm: 1, desc: 'Three cards of one rank' },
  thirteen: { name: 'Black Thirteen', chips: 13, mult: 4, lc: 13, lm: 1, trick: true, desc: 'Three or more cards whose ranks total exactly 13' },
  humours: { name: 'Four Humours', chips: 25, mult: 3, lc: 15, lm: 1, trick: true, desc: 'Four or five cards covering all four suits' },
  straight: { name: 'Procession', chips: 30, mult: 4, lc: 25, lm: 2, desc: 'Five ranks in a row' },
  flush: { name: 'Bloodline', chips: 35, mult: 4, lc: 15, lm: 1, desc: 'Five cards of one suit' },
  beggar: { name: "Beggar's Rite", chips: 40, mult: 5, lc: 20, lm: 1, trick: true, desc: 'Five cards, every one rank 3 or lower' },
  full: { name: 'Grand Coven', chips: 40, mult: 4, lc: 20, lm: 1, desc: 'Three of a rank plus a pair' },
  four: { name: 'Quartet of Ruin', chips: 60, mult: 7, lc: 25, lm: 2, desc: 'Four cards of one rank' },
  sflush: { name: 'Black Procession', chips: 100, mult: 8, lc: 35, lm: 2, desc: 'A Procession all of one suit' },
  five: { name: 'Pentacle', chips: 120, mult: 12, lc: 35, lm: 2, desc: 'Five cards of one rank' },
  trick: { name: 'Trickery', chips: 0, mult: 1, lc: 0, lm: 0, desc: 'Only Arcana or Tombstones played' },
};
const RITE_ORDER = ['high', 'pair', 'two', 'three', 'thirteen', 'humours', 'straight', 'flush', 'beggar', 'full', 'four', 'sflush', 'five'];
const STUDY_RITES = RITE_ORDER.filter(k => k !== 'high');

const ENCH = {
  gilded: { name: 'Gilded', col: '#ffd44a', desc: '+4 Mult when scored' },
  bloodied: { name: 'Bloodied', col: '#ff5068', desc: '+20 Chips when scored' },
  glass: { name: 'Glass', col: '#9ae8ff', desc: '×2 Mult when scored · 1 in 4 to shatter' },
  holy: { name: 'Holy', col: '#fff6a0', desc: 'Heal 2 HP when scored' },
  cursed: { name: 'Cursed', col: '#8a3ab0', desc: 'Never scores' },
  spectral: { name: 'Spectral', col: '#b8f0ff', desc: 'Counts as every suit when forming Rites' },
  echo: { name: 'Echoing', col: '#ff9ad0', desc: 'Scores twice' },
  effigy: { name: 'Effigy', col: '#e0a82e', desc: '+3 Mult to every Rite while held in hand (not played)' },
  venom: { name: 'Venom', col: '#6ae08a', desc: 'When scored, deals 4% of the monster\'s max HP' },
  fated: { name: 'Fated', col: '#9ae8ff', desc: 'When scored, 1 in 3 chance of +1 Fate' },
  mimic: { name: 'Mimic', col: '#ff7a2a', desc: 'Counts as whichever rank makes the best Rite' },
  tomb: { name: 'Tombstone', col: '#8a7e94', desc: 'No rank or suit. Always scores: +40 Chips' },
};
// enchantments that can turn up on reward / shop cards
const ENCH_DROP = ['gilded', 'bloodied', 'glass', 'holy', 'spectral', 'echo', 'effigy', 'venom', 'fated', 'mimic', 'tomb'];

// Arcana: trick cards. Played alongside a Rite they take a card slot, add no rank, and fire their effect.
const ARCANA = {
  snare: { name: 'Snare', ic: 'key', col: '#a8b4c4', desc: 'The monster skips its next attack.' },
  witchfire: { name: 'Witchfire', ic: 'candle', col: '#c890ff', desc: '+30 Chips to this Rite.' },
  bloodlet: { name: 'Bloodletting', ic: 'dagger', col: '#ff5068', desc: '×1.5 Mult to this Rite. You lose 3 HP.' },
  graverob: { name: 'Grave Robber', ic: 'skull', col: '#f2e8d0', desc: 'Draw 2 extra cards after this Rite.' },
  secondwind: { name: 'Second Wind', ic: 'hourglass', col: '#40e0b0', desc: '+1 Discard this fight.' },
  mirror: { name: 'Mirror Rite', ic: 'gem', col: '#9ae8ff', desc: 'The first scoring card triggers again.' },
};
const ARCANA_KEYS = Object.keys(ARCANA);
const DECK_MAX = 32;

const CLASSES = {
  knight: { name: 'Knight', col: '#c4d0e4', desc: 'steel, oaths, standing firm' },
  witch: { name: 'Witch', col: '#c890ff', desc: 'hexes, bargains, the unseen' },
  butcher: { name: 'Butcher', col: '#ff5068', desc: 'blood, brawn, breaking things' },
  gravecaller: { name: 'Gravecaller', col: '#5ad0ff', desc: 'the dead, their secrets' },
  ranger: { name: 'Ranger', col: '#6ab04a', desc: 'cunning, paths, quick hands' },
  saint: { name: 'Saint', col: '#ffd44a', desc: 'faith, mercy, holy light' },
};

// Hero hooks: card(ctx,c) per scored card · rite(ctx) once per rite · invoke(f, selectedCards) → text · fightEnd(won)
const HEROES = [
  { id: 'odric', name: 'Ser Odric the Rusted', cls: 'knight', hp: 10, need: 6,
    passive: 'Steel cards give +3 Chips when scored.', inv: 'Next Rite gains +8 Mult.',
    card(ctx, c) { if (c.suit === 'steel') ctx.chip(3, this); }, invoke(f) { f.bonus.mult += 8; return '+8 Mult on your next Rite.'; } },
  { id: 'sallow', name: 'Mother Sallow', cls: 'witch', hp: 6, need: 7, sel: 3,
    passive: 'Hex cards give +2 Mult when scored.', inv: 'Turn up to 3 selected cards into Hex, forever.',
    card(ctx, c) { if (c.suit === 'hex') ctx.mul(2, this); }, invoke(f, sel) { sel.slice(0, 3).forEach(c => c.suit = 'hex'); return 'The cards blacken into Hex.'; } },
  { id: 'grub', name: 'Grub the Butcher', cls: 'butcher', hp: 12, need: 6,
    passive: 'Blood cards give +4 Chips and +1 Mult when scored.', inv: 'Cleave the monster for 60 × Act damage.',
    card(ctx, c) { if (c.suit === 'blood') { ctx.chip(4, this); ctx.mul(1, this); } }, invoke(f) { const d = 60 * G.act; damageMonster(d); return `Grub cleaves for ${d}!`; } },
  { id: 'vesper', name: 'Vesper the Gravecaller', cls: 'gravecaller', hp: 7, need: 5,
    passive: 'Bone cards give +6 Chips when scored.', inv: 'Draw 3 cards.',
    card(ctx, c) { if (c.suit === 'bone') ctx.chip(6, this); }, invoke(f) { drawCards(3); return 'Three cards claw up out of the grave.'; } },
  { id: 'ilse', name: 'Ilse Thornwick', cls: 'ranger', hp: 8, need: 6, handSize: 1,
    passive: '+1 hand size.', inv: '+2 Discards this fight.', invoke(f) { f.discards += 2; return '+2 Discards.'; } },
  { id: 'abelard', name: 'Saint Abelard of Ash', cls: 'saint', hp: 9, need: 6,
    passive: 'Heal 4 HP after every victory.', inv: 'Heal 16 HP.',
    fightEnd(won) { if (won) healHP(4); }, invoke(f) { healHP(16); return 'Ash-light knits your wounds (+16 HP).'; } },
  // unlocked in the Ossuary
  { id: 'duelist', name: 'The Pale Duelist', cls: 'knight', hp: 8, need: 8, unlock: 20, swap: { r: '#f2e8d0', R: '#bfb39a', s: '#e8e0f0', S: '#8a7a9a' },
    passive: 'Twin Fangs and Double Pact gain +6 Mult.', inv: 'Next Rite ×2 Mult.',
    rite(ctx) { if (ctx.key === 'pair' || ctx.key === 'two') ctx.mul(6, this); }, invoke(f) { f.bonus.x *= 2; return 'A perfect riposte: ×2 Mult on your next Rite.'; } },
  { id: 'corvina', name: 'Corvina, Crow-Witch', cls: 'witch', hp: 6, need: 9, unlock: 30, swap: { P: '#1c1424', p: '#5a5a7a', n: '#c8c0d8' },
    passive: 'Bloodline and Black Procession gain ×1.5 Mult.', inv: 'Next Rite ×3 Mult.',
    rite(ctx) { if (ctx.key === 'flush' || ctx.key === 'sflush') ctx.xm(1.5, this); }, invoke(f) { f.bonus.x *= 3; return 'The crows scream: ×3 Mult on your next Rite.'; } },
  { id: 'hagmaw', name: 'Hagmaw', cls: 'butcher', hp: 14, need: 6, unlock: 25, swap: { R: '#2e5a2a', W: '#6a5a44', N: '#5e7a3a' },
    passive: 'Every Rite gains +15 Chips.', inv: 'Stun: the monster skips its next attack.',
    rite(ctx) { ctx.chip(15, this); }, invoke(f) { f.stun = 1; return 'Hagmaw slams it senseless.'; } },
  { id: 'ossian', name: 'Ossian the Sexton', cls: 'gravecaller', hp: 8, need: 7, sel: 2, unlock: 30, swap: { D: '#4a3420', d: '#2e2010', b: '#ffd44a' },
    passive: 'Gain 1 Soul whenever a card is destroyed.', inv: 'Raise up to 2 selected cards by 2 ranks, forever (max 10).',
    invoke(f, sel) { sel.slice(0, 2).forEach(c => c.rank = Math.min(10, c.rank + 2)); return 'Bones re-set, longer and crueller.'; } },
  { id: 'wren', name: 'Wren of the Lanterns', cls: 'ranger', hp: 7, need: 5, unlock: 25, swap: { M: '#7a4a14', m: '#b07a2a' },
    passive: 'Harvest rolls of 2, 3, 11 or 12 pay from every hex your outposts touch.', inv: 'Draw 2 cards and gain 1 Discard.',
    invoke(f) { drawCards(2); f.discards++; return 'Lantern-light finds two more.'; } },
  { id: 'morrow', name: 'Sister Morrow', cls: 'saint', hp: 16, need: 7, unlock: 25, swap: { w: '#d8d0f0', W: '#9a90c0', g: '#5ad0ff' },
    passive: 'Holy cards heal double.', inv: 'Ward: block the next attack and heal 6.',
    invoke(f) { f.shield = 1; healHP(6); return 'A pale ward rises before you.'; } },
];

// Relic hooks as heroes; static: handSize, discards, maxHp
const RELICS = [
  { id: 'molar', name: "Saint's Molar", ic: 'tooth', col: '#f2e8d0', desc: '+4 Mult on every Rite.', rite(ctx) { ctx.mul(4, this); } },
  { id: 'chalice', name: 'Crimson Chalice', ic: 'cup', col: '#ff5068', desc: 'Blood cards give +3 Mult when scored.', card(ctx, c) { if (c.suit === 'blood') ctx.mul(3, this); } },
  { id: 'gauntlet', name: 'Rusted Gauntlet', ic: 'gauntlet', col: '#a8b4c4', desc: 'Steel cards give +12 Chips when scored.', card(ctx, c) { if (c.suit === 'steel') ctx.chip(12, this); } },
  { id: 'lantern', name: 'Skull Lantern', ic: 'lantern', col: '#e0a82e', desc: 'Bone cards give +8 Chips and +1 Mult when scored.', card(ctx, c) { if (c.suit === 'bone') { ctx.chip(8, this); ctx.mul(1, this); } } },
  { id: 'mooneye', name: 'Eye of the Black Moon', ic: 'eye', col: '#c890ff', desc: 'Hex cards give +3 Mult when scored.', card(ctx, c) { if (c.suit === 'hex') ctx.mul(3, this); } },
  { id: 'candle', name: 'Black Candle', ic: 'candle', col: '#463650', desc: '+50 Chips if the Rite uses 3 or fewer cards.', rite(ctx) { if (ctx.cards.length <= 3) ctx.chip(50, this); } },
  { id: 'hourglass', name: 'Hourglass of Ash', ic: 'hourglass', col: '#bfb39a', desc: '+1 Discard every fight.', discards: 1 },
  { id: 'gluttony', name: "Glutton's Ring", ic: 'ring', col: '#e0a82e', desc: '+1 hand size.', handSize: 1 },
  { id: 'bottle', name: 'Witch Bottle', ic: 'vial', col: '#40e0b0', desc: 'Bloodline Rites ×2 Mult.', rite(ctx) { if (ctx.key === 'flush') ctx.xm(2, this); } },
  { id: 'miser', name: "Miser's Crown", ic: 'crown', col: '#ffd44a', desc: '+1 Gold every harvest.', harvest() { return { gold: 1 }; } },
  { id: 'litany', name: 'Litany of the Lost', ic: 'book', col: '#7a0f24', desc: '+3 Mult per hero in your party.', rite(ctx) { ctx.mul(3 * G.heroes.length, this); } },
  { id: 'hanged', name: "Hanged Man's Mask", ic: 'mask', col: '#9a8c70', desc: '×2 Mult while you are below half HP.', rite(ctx) { if (G.hp < maxHP() / 2) ctx.xm(2, this); } },
  { id: 'runt', name: "Runt's Fang", ic: 'tooth', col: '#ff7a2a', desc: 'Scored 1s and 2s give +8 Mult.', card(ctx, c) { if (c.rank <= 2) ctx.mul(8, this); } },
  { id: 'loaded', name: 'Loaded Bone Die', ic: 'die', col: '#f2e8d0', desc: 'Gain 1 Fate whenever the harvest dice show 7.' },
  { id: 'smuggler', name: "Smuggler's Key", ic: 'key', col: '#e0a82e', desc: 'Trade with the Black Market at 3:1 (2:1 if you hold a dock).' },
  { id: 'wraithlamp', name: 'Wraith Lantern', ic: 'lantern', col: '#5ad0ff', desc: 'Omens never make you discard resources.' },
  { id: 'bell', name: 'Cathedral Bell', ic: 'bell', col: '#c4d0e4', desc: 'Your first Rite each fight ×2 Mult.', rite(ctx) { if (ctx.f.rites === 0) ctx.xm(2, this); } },
  { id: 'axe', name: "Headsman's Axe", ic: 'dagger', col: '#d0213a', desc: 'Slaying a monster with your first Rite yields 2 Gold and 1 Soul.' },
  { id: 'mirror', name: 'Mirror Shard', ic: 'gem', col: '#9ae8ff', desc: 'The first scored card in each Rite triggers twice.' },
  { id: 'ratking', name: "Rat King's Crown", ic: 'crown', col: '#9a8c70', desc: '+1 Mult for every 3 Bone cards in your deck.', rite(ctx) { const n = Math.floor(G.deck.filter(c => c.suit === 'bone').length / 3); if (n) ctx.mul(n, this); } },
  { id: 'pearl', name: 'Abyssal Pearl', ic: 'gem', col: '#2a5aa8', desc: '×1.5 Mult on every Rite.', unlock: 30, rite(ctx) { ctx.xm(1.5, this); } },
  { id: 'coven', name: 'Coven Ring', ic: 'ring', col: '#a65cf0', desc: 'Coven of Three and Grand Coven ×2 Mult.', rite(ctx) { if (ctx.key === 'three' || ctx.key === 'full') ctx.xm(2, this); } },
  { id: 'pilgrim', name: "Pilgrim's Eye", ic: 'eye', col: '#ffd44a', desc: 'Reveals what waits in every hex.' },
  { id: 'leech', name: 'Leech Heart', ic: 'heart', col: '#7a0f24', desc: 'Heal 2 HP each time you perform a Rite.' },
  { id: 'gargoyle', name: 'Gargoyle Heart', ic: 'heart', col: '#5a6478', desc: '+20 max HP.', maxHp: 20 },
  { id: 'moth', name: 'Fate Moth', ic: 'moth', col: '#c4d0e4', desc: 'Start each Act with +2 Fate. Hero invocations need 1 less.', unlock: 25 },
  { id: 'ledger', name: "Gravedigger's Ledger", ic: 'book', col: '#5e5240', desc: 'Gains +2 Mult permanently whenever a card is destroyed.', unlock: 20, rite(ctx) { const n = G.ledger || 0; if (n) ctx.mul(n, this); } },
  { id: 'martyr', name: "Martyr's Skull", ic: 'skull', col: '#f2e8d0', desc: 'After you are struck, your next Rite gains Mult equal to the damage taken.', rite(ctx) { if (ctx.f.martyr) { ctx.mul(ctx.f.martyr, this); if (!ctx.preview) ctx.f.martyr = 0; } } },
  { id: 'procession', name: 'Procession Candle', ic: 'candle', col: '#ffd44a', desc: 'Procession Rites ×2 Mult.', rite(ctx) { if (ctx.key === 'straight' || ctx.key === 'sflush') ctx.xm(2, this); } },
  { id: 'gambler', name: "Gambler's Knucklebone", ic: 'die', col: '#d0213a', desc: '+1 to every hero invocation roll and every event roll.' },
  { id: 'thornveil', name: 'Thorn Veil', ic: 'mask', col: '#2e5a2a', desc: 'Monsters deal 1 less damage per hit.', unlock: 30 },
  { id: 'twinmoon', name: 'Twin Moons', ic: 'moth', col: '#a65cf0', desc: 'Double Pact Rites ×2.5 Mult.', rite(ctx) { if (ctx.key === 'two') ctx.xm(2.5, this); } },
];

const SCROLLS = [
  { id: 'sc_blood', name: 'Scroll of Bloodletting', ic: 'scroll', col: '#ff5068', sel: 3, desc: 'Turn up to 3 selected cards into Blood, forever.', use(sel) { sel.forEach(c => c.suit = 'blood'); } },
  { id: 'sc_steel', name: 'Scroll of Tempering', ic: 'scroll', col: '#c4d0e4', sel: 3, desc: 'Turn up to 3 selected cards into Steel, forever.', use(sel) { sel.forEach(c => c.suit = 'steel'); } },
  { id: 'sc_bone', name: 'Scroll of the Ossuary', ic: 'scroll', col: '#f2e8d0', sel: 3, desc: 'Turn up to 3 selected cards into Bone, forever.', use(sel) { sel.forEach(c => c.suit = 'bone'); } },
  { id: 'sc_hex', name: 'Scroll of the Black Moon', ic: 'scroll', col: '#c890ff', sel: 3, desc: 'Turn up to 3 selected cards into Hex, forever.', use(sel) { sel.forEach(c => c.suit = 'hex'); } },
  { id: 'sc_ash', name: 'Scroll of Ashes', ic: 'scroll', col: '#5e5240', sel: 2, desc: 'Destroy up to 2 selected cards forever.', use(sel) { sel.forEach(c => destroyCard(c)); } },
  { id: 'sc_mirror', name: 'Scroll of Mirrors', ic: 'scroll', col: '#9ae8ff', sel: 1, desc: 'Copy 1 selected card into your deck and hand.', use(sel) { sel.forEach(c => copyCard(c)); } },
  { id: 'sc_ascend', name: 'Scroll of Ascension', ic: 'scroll', col: '#ffd44a', sel: 2, desc: 'Raise up to 2 selected cards by 2 ranks, forever (max 10).', use(sel) { sel.forEach(c => c.rank = Math.min(10, c.rank + 2)); } },
  { id: 'sc_gild', name: 'Gilding Oil', ic: 'vial', col: '#ffd44a', sel: 1, desc: 'Gild 1 selected card (+4 Mult when scored).', use(sel) { sel.forEach(c => c.ench = 'gilded'); } },
  { id: 'sc_holy', name: 'Font Water', ic: 'vial', col: '#fff6a0', sel: 2, desc: 'Bless up to 2 selected cards (Holy: heal 2 when scored). Lifts curses.', use(sel) { sel.forEach(c => c.ench = 'holy'); } },
  { id: 'sc_draught', name: 'Draught of Ichor', ic: 'vial', col: '#40e0b0', anywhere: true, desc: 'Heal 20 HP.', use() { healHP(20); } },
  { id: 'sc_thunder', name: 'Thunder Vial', ic: 'vial', col: '#5ad0ff', desc: "Deal 25% of the monster's max HP.", use() { damageMonster(Math.ceil(F.maxHp * 0.25)); } },
  { id: 'sc_coin', name: 'Fate Coin', ic: 'die', col: '#ffd44a', anywhere: true, desc: '+2 Fate.', use() { addFate(2); } },
];

const ABIL = {
  double: { name: 'Swarm', desc: 'Strikes twice each turn.' },
  leech: { name: 'Leech', desc: 'Heals 3× the damage it deals.' },
  hex: { name: 'Hexer', desc: 'You have 1 fewer Discard.' },
  armor: { name: 'Armored', desc: 'Your first Rite deals half damage.' },
  regen: { name: 'Regrowth', desc: 'Regains 8% of its max HP each turn.' },
  enrage: { name: 'Frenzy', desc: 'Its damage grows by 2 every turn.' },
  thorns: { name: 'Thorns', desc: 'You take 1 damage per card in each Rite.' },
  fog: { name: 'Gloom', desc: 'Hand size −1.' },
  shy: { name: 'Elusive', desc: 'Rites of fewer than 3 cards deal half damage.' },
  monotony: { name: 'Ennui', desc: 'Repeating your previous Rite type deals half damage.' },
  curse: { name: 'Cursebearer', desc: 'Each hit has a 1 in 3 chance to add a Cursed card to your deck.' },
  d_hex: { name: 'Drowns Hex', desc: 'Hex cards score nothing.' },
  d_steel: { name: 'Rusts Steel', desc: 'Steel cards score nothing.' },
  d_blood: { name: 'Drinks Blood', desc: 'Blood cards score nothing.' },
  d_bone: { name: 'Grinds Bone', desc: 'Bone cards score nothing.' },
};

// c = [main, dark, light, eye]
const MONSTERS = {
  1: [
    { name: 'Grave-Rat Swarm', hp: 170, dmg: 3, ab: ['double'], c: ['#6a5a44', '#3a2e22', '#9a8a6a', '#ff4a5e'] },
    { name: 'Mire Ghoul', hp: 220, dmg: 5, ab: ['leech'], c: ['#4a6a3a', '#24361c', '#7a9a5a', '#fff6a0'] },
    { name: 'Lantern Wisp', hp: 160, dmg: 4, ab: ['hex'], c: ['#2a5aa8', '#142e5a', '#5ad0ff', '#ffffff'] },
    { name: 'Rotting Squire', hp: 240, dmg: 5, ab: ['armor'], c: ['#5a6478', '#2e3444', '#8a94a8', '#40e0b0'] },
    { name: 'Weeping Pilgrim', hp: 200, dmg: 4, ab: ['regen'], c: ['#8a7a6a', '#4a3e34', '#c0b0a0', '#5ad0ff'] },
    { name: 'Barrow Hound', hp: 190, dmg: 4, ab: ['enrage'], c: ['#3a2e3e', '#1c141e', '#6a5a6e', '#ff7a2a'] },
    { name: 'Drowned Choirboy', hp: 180, dmg: 4, ab: ['shy'], c: ['#3a6a6a', '#1a3434', '#6aa0a0', '#fff6a0'] },
  ],
  2: [
    { name: 'Gilt Revenant', hp: 230, dmg: 9, ab: ['armor'], c: ['#b08a2a', '#5a4410', '#ffd44a', '#d0213a'] },
    { name: 'Ossuary Golem', hp: 280, dmg: 10, ab: ['d_bone'], c: ['#bfb39a', '#6a5e48', '#f2e8d0', '#ff7a2a'] },
    { name: 'Censer Fiend', hp: 210, dmg: 9, ab: ['fog'], c: ['#6a3a8a', '#341a46', '#a65cf0', '#ffd44a'] },
    { name: 'Choir of Teeth', hp: 240, dmg: 8, ab: ['thorns'], c: ['#d0b0a0', '#7a5a4a', '#fff0e0', '#d0213a'] },
    { name: 'Plague Abbot', hp: 250, dmg: 9, ab: ['curse'], c: ['#5a6a2a', '#2c3414', '#8a9a4a', '#40e0b0'] },
    { name: 'Velvet Strangler', hp: 220, dmg: 10, ab: ['leech'], c: ['#7a0f24', '#3a0610', '#c0304a', '#fff6a0'] },
    { name: 'Reliquary Mimic', hp: 260, dmg: 9, ab: ['d_steel'], c: ['#8a5a14', '#46280a', '#e0a82e', '#5ad0ff'] },
  ],
  3: [
    { name: 'Star-Eaten Monk', hp: 240, dmg: 13, ab: ['d_hex'], c: ['#1a1a3a', '#0a0a1a', '#4a4a8a', '#ffffff'] },
    { name: 'Moth Seraph', hp: 220, dmg: 12, ab: ['shy', 'regen'], c: ['#c4bce0', '#6a6488', '#f2eeff', '#ff4a8a'] },
    { name: 'The Flayed Choir', hp: 260, dmg: 14, ab: ['thorns'], c: ['#b0303a', '#5a1018', '#ff6a6a', '#fff6a0'] },
    { name: 'Abyss Hound', hp: 230, dmg: 12, ab: ['enrage', 'double'], c: ['#2a0a2a', '#140414', '#5a1a5a', '#ff4a5e'] },
    { name: 'Clockwork Penitent', hp: 280, dmg: 13, ab: ['armor', 'monotony'], c: ['#8a6a3a', '#463418', '#c09a5a', '#5ad0ff'] },
    { name: 'Eyeless Archon', hp: 250, dmg: 14, ab: ['d_blood'], c: ['#e0d8c0', '#8a826a', '#ffffff', '#d0213a'] },
    { name: 'Hungering Dark', hp: 240, dmg: 13, ab: ['fog', 'leech'], c: ['#120a1a', '#06030a', '#3a2a4a', '#a65cf0'] },
  ],
};
// Lairs: Here-to-Slay style party requirements. Unmet → +35% HP, +30% damage.
const LAIRS = {
  1: [
    { name: 'The Bell-Wight', hp: 420, dmg: 6, ab: ['armor', 'enrage'], req: { cls: ['knight'] }, c: ['#5a6478', '#2a2e3a', '#c4d0e4', '#40e0b0'] },
    { name: 'Carrion Matron', hp: 460, dmg: 4, ab: ['double', 'regen'], req: { count: 2 }, c: ['#6a4a3a', '#34221a', '#a07a5a', '#ff4a5e'] },
    { name: 'The Lantern Hag', hp: 400, dmg: 6, ab: ['hex', 'leech'], req: { cls: ['witch', 'saint'] }, c: ['#2e5a2a', '#142a12', '#6ab04a', '#ffd44a'] },
  ],
  2: [
    { name: 'The Embalmer', hp: 520, dmg: 11, ab: ['regen', 'curse'], req: { cls: ['gravecaller'] }, c: ['#8a7a5a', '#463c28', '#d0c090', '#40e0b0'] },
    { name: 'Gilt Colossus', hp: 600, dmg: 12, ab: ['armor', 'shy'], req: { cls: ['butcher', 'knight'] }, c: ['#b08a2a', '#5a4410', '#ffe07a', '#d0213a'] },
    { name: 'Choir Eternal', hp: 540, dmg: 10, ab: ['thorns', 'fog'], req: { count: 3 }, c: ['#c4bce0', '#5a5478', '#ffffff', '#ffd44a'] },
  ],
  3: [
    { name: 'Archon of Eyes', hp: 600, dmg: 15, ab: ['d_steel', 'regen'], req: { cls: ['witch'] }, c: ['#e0d8c0', '#7a7258', '#ffffff', '#ff4a8a'] },
    { name: 'The Flayed Prince', hp: 640, dmg: 16, ab: ['leech', 'enrage'], req: { cls: ['butcher', 'ranger'] }, c: ['#a0202a', '#500a10', '#ff5a5a', '#ffd44a'] },
    { name: 'Penitent Engine', hp: 700, dmg: 14, ab: ['armor', 'monotony'], req: { count: 3 }, c: ['#6a5a3a', '#342a18', '#a8946a', '#5ad0ff'] },
  ],
};
const BOSSES = {
  1: [
    { name: 'The Drowned Bishop', hp: 950, dmg: 7, ab: ['d_hex', 'regen'], c: ['#2a4a5a', '#12242e', '#5a8aa0', '#fff6a0'], title: 'Shepherd of the Sunken Flock' },
    { name: 'The Lady of Moths', hp: 900, dmg: 6, ab: ['thorns', 'shy'], c: ['#9a90b0', '#4a4460', '#e0d8f0', '#ff4a8a'], title: 'She Who Eats the Light' },
  ],
  2: [
    { name: 'The Crownless King', hp: 950, dmg: 13, ab: ['monotony', 'armor'], c: ['#8a6a1a', '#46340a', '#ffd44a', '#d0213a'], title: 'Who Sold His Name for Gold' },
    { name: 'The Embalmed Twins', hp: 900, dmg: 9, ab: ['double', 'curse'], c: ['#bfb39a', '#5e5440', '#f2e8d0', '#40e0b0'], title: 'Two Hearts in One Jar' },
  ],
  3: [
    { name: 'Mother of the Black Sun', hp: 950, dmg: 18, ab: ['fog', 'enrage'], c: ['#2a0a1a', '#12040a', '#7a1a3a', '#ffd44a'], title: 'Final Dark of the Firmament' },
    { name: 'The Starving God', hp: 1000, dmg: 16, ab: ['leech', 'hex'], c: ['#3a3a2a', '#1a1a10', '#7a7a5a', '#ff4a5e'], title: 'Mouth Beneath the World' },
  ],
};
const ACTS = {
  1: { name: 'The Drowned Barrows', tint: 'rgba(40,90,80,0.10)', hpMul: 1, flavor: 'Rain that never ends. Barrows that breathe. Somewhere beneath the fen, a bishop still preaches to the drowned.' },
  2: { name: 'The Gilded Necropolis', tint: 'rgba(160,110,20,0.12)', hpMul: 3, flavor: 'A city of tombs plated in stolen gold. Its king sold his name and has been looking for it ever since.' },
  3: { name: 'The Bleeding Firmament', tint: 'rgba(140,20,50,0.14)', hpMul: 7, flavor: 'The sky here is a wound. Stars fall like teeth. At the centre of it all, the black sun waits to be born.' },
};

const COSTS = {
  road: { bone: 1, iron: 1 },
  outpost: { bone: 1, iron: 1, gold: 1, ichor: 1 },
  citadel: { iron: 2, soul: 2 },
  keep: { iron: 2, gold: 2, soul: 2 },
  siege: { iron: 2, bone: 2, gold: 1 },
  tend: { ichor: 1, bone: 1 },
  forge: { iron: 1, ichor: 1 },
  summon: { soul: 2, gold: 2, bone: 1 },
  tome: { soul: 2, gold: 1 },
  fate: { gold: 1, soul: 1 },
  cleanse: { soul: 1, ichor: 1, bone: 1 },
  purge: { soul: 1, bone: 2 },
};
// Keeps: a Citadel can be raised into one of these for the rest of the Act
const KEEPS = {
  watchtower: { name: 'Watchtower', col: '#5ad0ff', desc: '+1 hand size in fights.' },
  chapel: { name: 'Chapel', col: '#fff6a0', desc: '+1 Discard in fights; heal 3 HP every harvest.' },
  armory: { name: 'Armory', col: '#ff5068', desc: '+15 Chips on every Rite.' },
  treasury: { name: 'Treasury', col: '#ffd44a', desc: '+1 Gold and +1 Soul every harvest.' },
};
// Expandable capacity: start, max, and cost of the n-th purchase (n = 0, 1, ...)
const SLOTS = {
  relic: { name: 'Reliquary', start: 4, max: 8, cost: n => ({ gold: 3 + n, soul: 2 + n }), desc: '+1 relic slot' },
  scroll: { name: 'Satchel', start: 2, max: 5, cost: n => ({ gold: 1 + n, ichor: 2 + n }), desc: '+1 scroll slot' },
  party: { name: 'Barracks', start: 3, max: 5, cost: n => ({ bone: 2 + n, iron: 2 + n, soul: 1 + n }), desc: '+1 party slot' },
};

// ── Choose-your-own-adventure events ──
// choice: { t, cost?, hpCost?, req?(), reqText?, check?:{n, cls:{class:bonus}}, win(), lose(), go() }  — functions return result text
const EVENTS = [
  { id: 'statue', title: 'The Weeping Statue', art: 'altar',
    text: 'A saint of black marble stands knee-deep in the mire, weeping ichor that steams where it falls. Her stone mouth is still moving, very slowly, as if reciting something she has repeated for a thousand years.',
    choices: [
      { t: 'Collect her tears', check: { n: 7, cls: { witch: 2, gravecaller: 1 } }, win: () => 'The tears coil into your flasks obediently. ' + gain({ ichor: 3, soul: 1 }), lose: () => 'The ichor bites like acid as you gather it. ' + gain({ ichor: 2 }) + ' ' + hurt(8) },
      { t: 'Kneel and pray with her', check: { n: 8, cls: { saint: 3, knight: 1 } }, win: () => 'Her lips stop. She looks at you. Something is granted. ' + addFate(2) + ' ' + healHP(10), lose: () => 'She does not stop reciting. You feel foolish and cold. ' + doomAdd(1) },
      { t: 'Smash her face in', check: { n: 7, cls: { butcher: 3 } }, win: () => 'Inside her skull: a relic, wrapped in a dead man\'s finger.' + giveRelic(), lose: () => 'The marble screams. Everything in the fen hears it. ' + doomAdd(3) },
    ] },
  { id: 'choir', title: 'The Hanged Choir', art: 'coffin',
    text: 'Seven gibbets creak in a windless grove. The corpses hanging from them are singing, in perfect harmony, a hymn whose words you almost understand. Understanding them would cost you something.',
    choices: [
      { t: 'Listen closely (lose 8 HP)', hpCost: 8, go: () => 'The words burn themselves into you: ' + levelRite() + ' grows stronger.' },
      { t: 'Cut them down', check: { n: 8, cls: { gravecaller: 3, saint: 1 } }, win: () => 'The last of them is not quite dead, and is grateful.' + giveHero(), lose: () => 'They fall silent and rot at once. You salvage what you can. ' + gain({ bone: 3 }) },
      { t: 'Walk on quickly', go: () => 'The song follows you for a long time. ' + doomAdd(1) },
    ] },
  { id: 'teeth', title: 'The Merchant of Teeth', art: 'market',
    text: '"Teeth! I deal in teeth!" A smiling peddler with far too many of them blocks the path, his cart rattling with jars. "A tooth for a trinket? Or coin, coin, coin, if you are squeamish."',
    choices: [
      { t: 'Pay in teeth (lose 10 HP)', hpCost: 10, go: () => '"Marvellous molars!" He presses a relic into your bloody palm.' + giveRelic() },
      { t: 'Pay 3 Gold for two scrolls', cost: { gold: 3 }, go: () => giveScroll() + ' ' + giveScroll() },
      { t: 'Rob him', check: { n: 9, cls: { ranger: 3, butcher: 1 } }, win: () => 'You are gone before he finishes smiling. ' + gain({ gold: 3 }) + giveRelic(), lose: () => 'His smile grows wider. Much wider. ' + hurt(10) + ' ' + addCurse(1) },
    ] },
  { id: 'well', title: 'The Drowned Well', art: 'well',
    text: 'Voices rise from an old well — children, counting coins, over and over. The rope is new. Someone has been going down there recently. Someone who did not come back up.',
    choices: [
      { t: 'Toss in 2 Gold', cost: { gold: 2 }, go: () => 'The counting stops. "Thank you," they whisper. ' + addFate(2) },
      { t: 'Climb down', check: { n: 7, cls: { ranger: 2, knight: 1 } }, win: () => 'At the bottom: the last climber, and everything he carried. ' + gain({ gold: 4 }) + giveRelic(), lose: () => 'Small hands grab at your ankles in the dark. ' + hurt(12) },
      { t: 'Seal it with stones', go: () => 'The voices become muffled, then stop. ' + gain({ soul: 1 }) + ' ' + doomAdd(-2) },
    ] },
  { id: 'riddle', title: 'The Ossuary Door', art: 'door',
    text: 'A door of fused skulls. As you approach, every jaw opens at once: "THE MORE OF ME YOU TAKE, THE MORE OF ME YOU LEAVE BEHIND. NAME ME, AND PASS."',
    choices: [
      { t: '"Footsteps."', go: () => 'The skulls clatter in what might be applause. The door opens onto a treasury.' + giveRelic() + ' ' + gain({ gold: 2 }) },
      { t: '"Breath."', go: () => 'The jaws snap shut. One of them bites. ' + hurt(6) },
      { t: '"Time."', go: () => '"CLOSE," the skulls groan, and the door weeps a little gold. ' + gain({ gold: 1 }) },
      { t: 'Pry the skulls loose instead', check: { n: 8, cls: { butcher: 2, gravecaller: 2 } }, win: () => gain({ bone: 4 }), lose: () => hurt(8) + ' ' + doomAdd(1) },
    ] },
  { id: 'knight', title: 'A Starving Knight', art: 'tavern',
    text: 'A knight in rusted plate sits against a dead tree, chewing his own belt. "Food," he rasps. "Give me food, and my sword is yours. Or take it from me. I am too tired to care which."',
    choices: [
      { t: 'Feed him (2 Ichor, 1 Bone)', cost: { ichor: 2, bone: 1 }, go: () => 'He eats like a wolf and swears an oath like a saint.' + giveHero('knight') },
      { t: 'Take his sword', go: () => 'He doesn\'t resist. You hear him weeping long after. ' + gain({ iron: 3 }) + ' ' + addCurse(1) },
      { t: 'Put him out of his misery', go: () => 'Mercy, of a kind. ' + gain({ soul: 2 }) },
    ] },
  { id: 'candles', title: 'The Candle Market', art: 'altar',
    text: 'A crooked woman sells candles in a market that isn\'t there. "Each one is a year of somebody\'s life," she says. "Burn one, and your hands grow surer. I only ask a little of your own in trade."',
    choices: [
      { t: 'Buy a candle (−6 max HP)', go: () => maxHpAdd(-6) + ' ' + rankUpRandom(4, 1) },
      { t: 'Steal a handful', check: { n: 9, cls: { ranger: 3 } }, win: () => rankUpRandom(6, 1) + ' ' + addFate(1), lose: () => '"Thief!" The candles go out. All of them. ' + doomAdd(2) + ' ' + hurt(6) },
      { t: 'Leave', go: () => 'When you look back, the market is a field of black stubs.' },
    ] },
  { id: 'cartographer', title: 'The Blind Cartographer', art: 'eye',
    text: 'An old man with sewn-shut eyes is drawing a perfect map of this place, his quill guided by something you cannot see. "I know what waits in every hex," he says. "Knowledge has a price."',
    choices: [
      { t: 'Buy the map (2 Gold)', cost: { gold: 2 }, go: () => revealAll() },
      { t: 'Ask the secret way to the Throne (3 Soul)', cost: { soul: 3 }, go: () => addSigil() },
      { t: 'Ask about yourself', check: { n: 8, cls: { witch: 2, saint: 1 } }, win: () => '"You will win," he says, "if you stop counting." ' + addFate(2) + ' ' + levelRite(), lose: () => 'He tells you how you will die. You cannot stop thinking about it. ' + doomAdd(2) },
    ] },
  { id: 'feast', title: 'Feast of the Fallen', art: 'tavern',
    text: 'A banquet table, laid for twelve, in the middle of a battlefield. The food is perfect. It is impossible that the food is perfect. The guests are bones in rusted armour, still holding their cups.',
    choices: [
      { t: 'Eat', check: { n: 7, cls: { saint: 2, butcher: 2 } }, win: () => 'It is the best meal of your life. ' + healHP(999), lose: () => 'Your mouth fills with grave-dirt. ' + hurt(10) + ' ' + addCurse(1) },
      { t: 'Raise a toast to the dead', check: { n: 7, cls: { gravecaller: 3, knight: 2 } }, win: () => 'Twelve skulls turn to you and nod. One of them stands.' + giveHero(), lose: () => 'Nothing happens, which is somehow worse. ' + doomAdd(1) },
      { t: 'Pocket the silverware', go: () => gain({ gold: 2, iron: 1 }) },
    ] },
  { id: 'bride', title: 'The Mirror Bride', art: 'eye',
    text: 'A tall mirror in a veil of rotten lace. Your reflection is wearing a wedding dress and smiling at you. It raises a finger to its lips, then reaches for the glass from the other side.',
    choices: [
      { t: 'Take its hand', go: () => 'Something of you is doubled. Something else is left behind. ' + dupRandom(2) + ' ' + maxHpAdd(-4) },
      { t: 'Shatter the mirror', go: () => hurt(5) + ' ' + enchantRandom('glass', 2) },
      { t: 'Turn your back on it', go: () => 'You hear a very soft knock. Then nothing.' },
    ] },
  { id: 'cart', title: 'The Plague Cart', art: 'coffin',
    text: 'A cart piled with bodies, abandoned in a crossroads. The mule is still harnessed, long dead, standing. Flies form slow letters in the air above it, but you refuse to read them.',
    choices: [
      { t: 'Search the bodies', check: { n: 6, cls: { gravecaller: 2, ranger: 1 } }, win: () => gain({ gold: 2, bone: 2 }) + ' ' + giveScroll(), lose: () => gain({ bone: 2 }) + ' ' + hurt(7) + ' ' + addCurse(1) },
      { t: 'Burn it all', go: () => 'The flies scream as they burn. ' + gain({ soul: 1 }) + ' ' + doomAdd(-1) },
      { t: 'Say the rites for them', check: { n: 7, cls: { saint: 3 } }, win: () => 'They rest. You feel lighter. ' + healHP(12) + ' ' + addFate(1), lose: () => 'Your words are thin and the dead are many. ' + doomAdd(1) },
    ] },
  { id: 'crossroads', title: 'Bargain at the Crossroads', art: 'shrine',
    text: 'Someone tall is waiting where the paths meet. Its face is a hole cut neatly in the night. "Everyone comes here eventually," it says pleasantly. "Shall we trade?"',
    choices: [
      { t: 'Trade a hero for two relics', req: () => G.heroes.length > 1, reqText: 'Needs 2+ heroes', go: () => loseHero() + giveRelic() + giveRelic() },
      { t: 'Trade 15 max HP for a relic', go: () => maxHpAdd(-15) + giveRelic() },
      { t: 'Trade 5 Doom for a Cursed card', go: () => doomAdd(-5) + ' ' + addCurse(1) },
      { t: '"No."', go: () => '"Next time, then." It is already gone.' },
    ] },
  { id: 'sevens', title: 'Shrine of the Sevenfold Die', art: 'shrine',
    text: 'A pedestal holds two dice carved from a saint\'s knuckles. An inscription: ROLL, AND BE JUDGED. Below it, the floor is covered in teeth and gold coins in roughly equal measure.',
    choices: [
      { t: 'Roll the dice', go: () => { const a = d6(), b = d6(), s = a + b; return `You roll ${a} + ${b} = ${s}. ` + (s === 7 ? 'JUDGED WORTHY. ' + addFate(3) + giveRelic() : s < 7 ? 'Judged wanting. ' + hurt(9) : 'Judged adequate. ' + gain(randRes(3))); } },
      { t: 'Gather coins from the floor', go: () => gain({ gold: 2 }) + ' ' + doomAdd(1) },
      { t: 'Leave the dice alone', go: () => 'Wise, perhaps.' },
    ] },
  { id: 'library', title: 'The Moth Library', art: 'door',
    text: 'Shelves to the ceiling, every book furred with sleeping moths. When you open one, they wake, and the pages beneath are blank — but the moths, in flight, spell out the forbidden rites.',
    choices: [
      { t: 'Read until your eyes bleed (lose 10 HP)', hpCost: 10, go: () => levelRite() + ' and ' + levelRite() + ' grow stronger.' },
      { t: 'Steal a scroll', go: () => giveScroll() },
      { t: 'Speak with the moths', check: { n: 8, cls: { witch: 3, gravecaller: 1 } }, win: () => 'They teach you their oldest rite. ' + levelRite() + ' ' + addFate(1), lose: () => 'They swarm into your mouth. ' + hurt(6) },
    ] },
  { id: 'forge', title: 'The Abandoned Forge', art: 'altar',
    text: 'A dwarf-sized forge still burns with blue fire, though no one has fed it in a century. Hammers hang on the wall, waiting. One of them is warm to the touch.',
    choices: [
      { t: 'Temper your weapons (2 Iron)', cost: { iron: 2 }, go: () => enchantRandom('bloodied', 2) },
      { t: 'Melt down 2 cards for Iron', go: () => { queuePurge(2); return 'Choose two cards to feed to the flames. ' + gain({ iron: 3 }); } },
      { t: 'Pry out the forge-heart', check: { n: 8, cls: { knight: 2, butcher: 2 } }, win: () => giveRelic(), lose: () => hurt(9) },
    ] },
  { id: 'child', title: 'The Child in the Fog', art: 'well',
    text: 'A little girl in a white dress stands in the fog, holding a lantern. "I know the way," she says. "Do you want to come?" Her feet do not quite touch the ground.',
    choices: [
      { t: 'Follow her', check: { n: 8, cls: { saint: 2, ranger: 2 } }, win: () => 'She leads you to a hidden camp of wanderers.' + giveHero() + ' ' + gain({ soul: 1 }), lose: () => 'She leads you to something hungry. ' + queueFight() },
      { t: 'Give her your lantern oil (1 Ichor)', cost: { ichor: 1 }, go: () => '"Thank you." She fades. You feel watched over. ' + addFate(2) },
      { t: 'Ignore her', go: () => 'She is standing in the next hex too. And the next. ' + doomAdd(1) },
    ] },
  { id: 'wolfking', title: 'Court of the Wolf-King', art: 'tavern',
    text: 'A circle of wolves sits in perfect silence around a throne of antlers. On it lounges a wolf wearing a man\'s face like a mask. "Entertain us," it says, "or feed us."',
    choices: [
      { t: 'Duel his champion', check: { n: 8, cls: { knight: 3, butcher: 2 } }, win: () => 'The court howls approval. ' + giveRelic() + ' ' + gain({ bone: 2 }), lose: () => hurt(14) },
      { t: 'Tell him a story of your journey', check: { n: 7, cls: { ranger: 2, witch: 2 } }, win: () => '"Good. Go." ' + addFate(2) + ' ' + gain({ gold: 2 }), lose: () => '"Boring." ' + queueFight() },
      { t: 'Offer meat (2 Bone)', cost: { bone: 2 }, go: () => 'The wolves eat, and permit you to pass. ' + gain({ soul: 1 }) },
    ] },
  { id: 'nun', title: 'The Last Nun of Saint Ulfra', art: 'shrine',
    text: 'An ancient nun tends a chapel no bigger than a wardrobe. "Saint Ulfra will bless one thing you carry," she says. "Or take one burden from you. She was always generous, before."',
    choices: [
      { t: 'Ask her to bless your cards', go: () => enchantRandom('holy', 2) + ' ' + removeCurses() },
      { t: 'Ask her to take a burden', go: () => { queuePurge(1); return 'Choose a card to leave on the altar.'; } },
      { t: 'Ask what happened to Saint Ulfra', go: () => 'The nun\'s face falls away like wet paper. Beneath is the saint. She is not generous anymore. ' + queueFight() },
    ] },
  // ── dice events (go() may be async; rollOpen shows the dice) ──
  { id: 'gamblers', title: 'The Bone Gamblers', art: 'tavern',
    text: 'Three skeletons crouch around an upturned shield, rolling knucklebones for a pile of coins and teeth. One of them pats the mud beside it. "Sit. Roll. Higher takes the pot."',
    choices: [
      { t: 'Wager 2 Gold (dice duel)', cost: { gold: 2 }, go: async () => { const r = await diceDuel('The Bone Gamblers'); return r > 0 ? 'You take the pot. ' + gain({ gold: 5 }) : r === 0 ? 'A draw. Your stake comes back. ' + gain({ gold: 2 }) : 'They rattle with laughter and sweep up your coins.'; } },
      { t: 'Wager blood (6 HP, dice duel)', hpCost: 6, go: async () => { const r = await diceDuel('Blood Wager'); return r > 0 ? 'The pot holds something better than coin.' + giveRelic() : r === 0 ? 'A draw. They let you keep your dignity. ' + healHP(6) : 'They drink your stake, somehow.'; } },
      { t: 'Cheat', check: { n: 8, cls: { ranger: 3, witch: 1 } }, win: () => 'Your loaded bones never miss. ' + gain({ gold: 4 }) + giveArcana(), lose: () => 'Skeletons hate a cheat. ' + hurt(8) + ' ' + addCurse(1) },
    ] },
  { id: 'ferry', title: "The Ferryman's Dice", art: 'well',
    text: 'A black river, a black boat, and a ferryman with no face. He will not take coin. He holds out two dice in a palm of bare bone. "Passage is a matter of chance," he says.',
    choices: [
      { t: 'Roll for passage', go: async () => { const { vals, sum } = await rollOpen("The Ferryman's Dice", 2, 'Doubles: blessed · 7: the river takes a toll · 9+: safe · else: the water bites');
        if (vals[0] === vals[1]) return 'Doubles. He bows. ' + addFate(1) + giveRelic();
        if (sum === 7) return 'Seven. Hands rise from the river. ' + doomAdd(2) + ' ' + gain({ soul: 3 });
        if (sum >= 9) return 'A smooth crossing. ' + gain({ ichor: 2, soul: 1 });
        return 'Something below the boat takes a bite. ' + hurt(7); } },
      { t: 'Pay in Soul (2)', cost: { soul: 2 }, go: () => 'He accepts. The river parts. ' + addFate(1) + ' ' + doomAdd(-1) },
      { t: 'Swim', check: { n: 7, cls: { ranger: 2, knight: 1, butcher: 1 } }, win: () => 'You haul yourself out on the far bank with treasure in your fists. ' + gain({ ichor: 2, gold: 1 }), lose: () => 'The river does not want you to leave. ' + hurt(10) },
    ] },
  { id: 'blades', title: 'Hall of Falling Blades', art: 'door',
    text: 'A corridor of rusted pendulums, each one older than the last. Gold glitters in the far chambers. The blades swing to a rhythm. If you can read it, you can run it.',
    choices: [
      { t: 'Run the halls (push your luck)', go: () => runBlades() },
      { t: 'Strip the first blade for iron', go: () => gain({ iron: 2 }) },
      { t: 'Leave', go: () => 'The rhythm follows you into your sleep.' },
    ] },
  { id: 'oracle', title: 'The Drunk Oracle', art: 'eye',
    text: 'A three-eyed woman sprawls in a ruined chapel with a bottle of something luminous. "I read dice, not stars," she slurs, shaking two of them in a cup. "Stars lie."',
    choices: [
      { t: 'Let her read your dice', go: () => oracleRoll(0) },
      { t: 'Buy her a drink first (1 Gold, +2 to the roll)', cost: { gold: 1 }, go: () => oracleRoll(2) },
      { t: 'Leave her to it', go: () => 'She is still rolling when you go. "Seven," you hear. "Always seven."' },
    ] },
  { id: 'sickhouse', title: 'The Sickhouse', art: 'coffin',
    text: 'A long house full of coughing. The sick lie in rows, attended by no one. A plague doctor\'s mask hangs on a nail by the door, still warm.',
    choices: [
      { t: 'Tend the sick (each hero rolls a die)', go: () => sickhouseRolls() },
      { t: 'Burn it', go: () => 'You do what has to be done. ' + hurt(4) + ' ' + doomAdd(-2) },
      { t: 'Take the mask and go', go: () => 'It smells of cloves and death. ' + gain({ soul: 1 }) },
    ] },
  { id: 'wheel', title: 'The Hexed Wheel', art: 'shrine',
    text: 'A great wheel of bone and brass stands in a clearing, its spokes painted with symbols. A sign: SPIN, AND YOUR CARDS SHALL BE CHANGED. The paint on the sign is very fresh.',
    choices: [
      { t: 'Spin (1 Soul): 3 cards each roll a die', cost: { soul: 1 }, go: () => wheelSpin() },
      { t: 'Smash it for parts', check: { n: 7, cls: { butcher: 2, knight: 1 } }, win: () => gain({ gold: 2, iron: 2 }), lose: () => 'A spoke whips round and catches you. ' + hurt(7) },
      { t: 'Leave', go: () => 'Behind you, the wheel turns on its own.' },
    ] },
  { id: 'pit', title: 'The Pit of Champions', art: 'tavern',
    text: 'A sunken arena ringed with cheering dead. A herald with a voice like a broken bell calls for challengers. "Fight the beast! Or bet on it!"',
    choices: [
      { t: 'Fight for the purse (+3 Gold now)', go: () => gain({ gold: 3 }) + ' The crowd roars. ' + queueFight() },
      { t: 'Bet 2 Gold on the beast (roll 8+)', cost: { gold: 2 }, go: async () => { const { sum } = await rollOpen('The Pit', 2, '8 or more: the beast wins'); return sum >= 8 ? 'The beast wins. So do you. ' + gain({ gold: 6 }) : 'The challenger wins, somehow. Your coins are gone.'; } },
      { t: 'Leave', go: () => 'The crowd boos you all the way out.' },
    ] },
  { id: 'lich', title: 'The Card-Sharp Lich', art: 'altar',
    text: 'A lich in a moth-eaten waistcoat deals cards onto a coffin lid. "A game?" Its jaw clicks. "I play for tricks. Real tricks. The kind that cheat the dark."',
    choices: [
      { t: 'Play a hand against him', check: { n: 8, cls: { witch: 2, gravecaller: 2 } }, win: () => '"Well played." He slides you his best trick.' + giveArcana(3), lose: () => '"Pity." He takes something from you. ' + hurt(6) + ' ' + addCurse(1) },
      { t: 'Buy a trick (3 Gold)', cost: { gold: 3 }, go: () => '"A fair price."' + giveArcana(2) },
      { t: 'Leave', go: () => '"Next time," he says, shuffling.' },
    ] },
  { id: 'roadstones', title: 'The Old Roadstones', art: 'door',
    text: 'Beneath the moss, a buried road of fitted stone runs straight as an arrow into the fog. Whoever built it meant to go somewhere, and meant to get there fast.',
    choices: [
      { t: 'Clear the old road', check: { n: 6, cls: { knight: 2, ranger: 2 } }, win: () => 'The road is yours to use. +2 free roads. ' + freeRoads(2), lose: () => 'Back-breaking work. ' + hurt(5) + ' +1 free road. ' + freeRoads(1) },
      { t: 'Pry up the stones', go: () => gain({ iron: 2, bone: 1 }) },
      { t: 'Follow it into the fog', go: () => doomAdd(1) + ' ' + revealAll() },
    ] },
];

const OMENS = [
  'A bell tolls under the earth. The Blight stirs.',
  'Ravens fall dead from the sky, all at once.',
  'Every candle in the land gutters and goes blue.',
  'The dice come up seven. Something laughs.',
  'Black rain. It tastes of iron and old prayers.',
];

// Ossuary unlocks (meta progression)
const UPGRADES = [
  { id: 'hp1', name: 'Thick Blood I', desc: '+8 starting max HP.', cost: 15 },
  { id: 'hp2', name: 'Thick Blood II', desc: 'Another +8 starting max HP.', cost: 35, need: 'hp1' },
  { id: 'hoard', name: 'Hoarder', desc: 'Start each run with +1 of every resource.', cost: 20 },
  { id: 'fate1', name: 'Fated', desc: 'Start each run with +1 Fate.', cost: 20 },
  { id: 'eye', name: 'Keen Eye', desc: 'Card rewards offer 4 choices instead of 3.', cost: 25 },
  { id: 'relic', name: 'Inheritance', desc: 'Start each run with a random relic.', cost: 45 },
  { id: 'broker', name: 'Broker', desc: 'Black Market trades at 3:1 instead of 4:1.', cost: 35 },
  { id: 'heroes4', name: 'Wider Muster', desc: 'Choose your first hero from 4 instead of 3.', cost: 20 },
  { id: 'scroll', name: 'Satchel', desc: 'Start each run with a random scroll; +1 scroll slot.', cost: 30 },
  { id: 'tome', name: 'Old Learning', desc: 'Start each run with a random Rite at level 2.', cost: 40 },
  { id: 'vault', name: 'Vaulted Reliquary', desc: 'Start each run with +1 relic slot.', cost: 30 },
  { id: 'barracks', name: 'Old Barracks', desc: 'Start each run with +1 party slot.', cost: 35 },
  { id: 'roads', name: 'Surveyor', desc: '+1 free road every Act.', cost: 20 },
];
const DESCENTS = [
  'The ordinary dark.',
  'Doom begins at 4.',
  'Monsters have +20% HP.',
  'Outposts cost +1 Soul.',
  '−1 Discard each fight.',
  'The Throne awakens at Doom 30 instead of 36.',
  'Monsters deal +2 damage.',
  'Start with 2 Cursed cards.',
  '−1 hand size.',
];
