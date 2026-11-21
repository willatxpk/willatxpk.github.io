import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { World, W, D, H, NCX, NCZ, B, BLOCKS, SOLID, OPAQUE, TL, U, GROUND, resolveTextures, makeTerrainMaterial, makeShadowMaterial, moveBody, collides } from './world.js';
import { buildTextures, layerDataURL, TS } from './textures.js';
import { Mob, MOB_TYPES } from './mobs.js';
import { NPC, NPC_DEFS, SIDE_QUESTS, SHOPS, Crow } from './npcs.js';
import { Sound } from './audio.js';
import { buildWeapon, poseWeapon, arrowGeometry } from './weapons.js';
import { makeMobMaterial, REGIONS, regionAt } from './world.js';
import { NOTES } from './lore.js';
import { ACCURSED } from './mobs.js';
import { buildHuman, poseHuman } from './body.js';

THREE.ColorManagement.enabled = false;
const $ = id => document.getElementById(id);
const isBlk = k => typeof k === 'string' && /^b\d+$/.test(k); // block items are 'b' + block id
const TEST = location.search.includes('test');
const SAVE_KEY = 'gloamreach-save-v2', SET_KEY = 'gloamreach-settings-v1';
// five save slots; slot 1 keeps the old key, so the save you already have is still there
const SLOTS_N = 5, slotKey = n => (n === 1 ? SAVE_KEY : `${SAVE_KEY}-s${n}`);
let curSlot = 1;
function readSlot(n) { try { return JSON.parse(localStorage.getItem(slotKey(n))); } catch (e) { return null; } }
const snd = new Sound();

// ================================================================ dice & rules
const roll = n => 1 + Math.floor(Math.random() * n);
const rollDice = (n, s) => { let t = 0; for (let i = 0; i < n; i++) t += roll(s); return t; };
// ability modifiers: the classic curve up to 20, then a gentler climb to a hard cap of 99 (a 99 is +24)
const mod = v => (v <= 20 ? Math.floor((v - 10) / 2) : 5 + Math.floor((v - 20) / 4));
const LEVEL_CAP = 400, STAT_CAP = 99;
const xpNeed = L => Math.round(60 + 70 * Math.pow(L, 1.5));
// how strong a hunter of level L is expected to be; monsters of level L are built against it
const expect = L => 2 + L / 25 + mod(Math.min(99, 10 + 0.6 * L));
const fm = m => (m >= 0 ? '+' : '') + m;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const XP_TABLE = [0, 100, 300, 600, 1000, 1600, 2400, 3400, 4600, 6000, Infinity];

const RACES = {
  human: { name: 'Human', bonus: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 }, dv: 0, dread: 0.7, desc: '+1 to every ability. Steady nerves: dread builds 30% slower. No darkvision — you will need light.' },
  dwarf: { name: 'Dwarf', bonus: { CON: 2, WIS: 1 }, dv: 10, dread: 1, desc: '+2 CON, +1 WIS. Darkvision: dim grey sight out to 10 blocks in total darkness.' },
  elf: { name: 'Elf', bonus: { DEX: 2, INT: 1 }, dv: 12, dread: 1, desc: '+2 DEX, +1 INT. Darkvision to 12 blocks. Fey Ancestry: never panics at full dread.' },
  halforc: { name: 'Half-Orc', bonus: { STR: 2, CON: 1 }, dv: 9, dread: 1, desc: '+2 STR, +1 CON. Darkvision to 9 blocks. Relentless: once per rest, drop to 1 HP instead of 0.' },
};
const CLASSES = {
  fighter: { name: 'Fighter', hd: 10, prio: ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'], kit: { club: 1, shield: 1, leather: 1, boots: 1 }, desc: 'd10 hit die. Cudgel and shield. [R] Second Wind: heal 1d10 + level. Extra Attack at level 5 (faster swings).' },
  rogue: { name: 'Rogue', hd: 8, prio: ['DEX', 'CON', 'WIS', 'INT', 'CHA', 'STR'], kit: { dagger: 1, bow: 1, arrows: 24, elixir: 1, leather: 1, gloves: 1, boots: 1 }, desc: 'd8. Dagger (finesse). Sneak Attack on unaware or fleeing foes. [R] Shadowstep: monsters lose your scent for 8s.' },
  cleric: { name: 'Cleric', hd: 8, prio: ['WIS', 'CON', 'STR', 'DEX', 'CHA', 'INT'], kit: { mace: 1, healing: 1, leather: 1, hood: 1 }, desc: 'd8. Mace. Light cantrip: your lantern needs no oil. [R] Cure Wounds (spell slots). [T] Turn Undead.' },
};
const ITEMS = {
  coal: { name: 'Coal', icon: '⚫', desc: 'Fuel. Torches, lantern oil, campfires.' },
  iron: { name: 'Iron Ore', icon: '🔩', desc: 'Raw iron from deep stone. Weapons and armour.' },
  herb: { name: 'Moonherb', icon: '🌿', desc: 'A bitter leaf found in tall grass. Used for healing draughts.' },
  oil: { name: 'Lantern Oil', icon: '🛢️', desc: 'Refills your lantern automatically when it runs dry (~2.5 min of light).' },
  elixir: { name: 'Nightshade Elixir', icon: '🧪', desc: 'Right-click to drink: 2 minutes of true night vision.' },
  healing: { name: 'Healing Draught', icon: '🍷', desc: 'Right-click to drink: heal 2d4+2.' },
  lumendraught: { name: 'Lumen Draught', icon: '💠', desc: 'Glowcap light steeped in an umbral shard. Drink to restore 40 Lumen (or a third of your reserve, if that is more). Put it on your belt [Q].' },
  shard: { name: 'Umbral Shard', icon: '🔮', desc: 'A splinter of solid darkness, dropped by creatures of the night.' },
  gold: { name: 'Gold Coin', icon: '🪙', desc: 'Old coin from forgotten chests. Some craftsmen still want it.' },
  club: { name: 'Oak Cudgel', icon: '🏏', desc: 'Weapon: 1d6 bludgeoning.', weapon: { dice: [1, 6], cd: 0.75 }, slot: 'rh', wt: 3 },
  dagger: { name: 'Dagger', icon: '🗡️', desc: 'Weapon: 1d4 piercing, finesse (uses DEX), very quick.', weapon: { dice: [1, 4], cd: 0.45, finesse: true }, slot: 'rh', wt: 1 },
  mace: { name: 'Mace', icon: '🔨', desc: 'Weapon: 1d6 bludgeoning.', weapon: { dice: [1, 6], cd: 0.8 }, slot: 'rh', wt: 4 },
  greatsword: { name: 'Bridgewarden\'s Greatsword', icon: '🗡️', desc: 'Two centuries on the bridge did not dull it. Weapon: 2d6 slashing. Heavy.', weapon: { dice: [2, 6], cd: 1.15 }, slot: 'rh', wt: 9 },
  emptycore: { name: 'Empty Beacon-core', icon: '⚪', desc: 'A Cinderworks vessel for holding the Lumen. Hold it to the Hollow King\'s ashes.' },
  kingash: { name: 'Ashes of the Hollow King', icon: '⚱️', desc: 'Still warm, still bright. An empty Beacon-core held to them would fill.' },
  sword: { name: 'Iron Longsword', icon: '⚔️', desc: 'Weapon: 1d8 slashing, finesse.', weapon: { dice: [1, 8], cd: 0.85, finesse: true }, slot: 'rh', wt: 4 },
  bow: { name: 'Hunting Bow', icon: '🏹', desc: 'Ranged. Hold left mouse to draw, release to loose. 1d6 + DEX; full draws hit harder, headshots harder still. Needs arrows.', weapon: { dice: [1, 6], cd: 0.5, finesse: true, ranged: true, drawT: 0.75 }, slot: 'rh', wt: 2 },
  warbow: { name: 'Vharrow War Bow', icon: '🏹', desc: 'Ranged. A heavy yew bow from the castle armoury. 1d10 + DEX, slow to draw. Needs arrows.', weapon: { dice: [1, 10], cd: 0.6, finesse: true, ranged: true, drawT: 1.05 }, slot: 'rh', wt: 4 },
  arrow_fire: { name: 'Ember Arrows', icon: '🔥', desc: 'Ammunition. Tipped in Ember Resin: set what they strike burning. [Q] on the belt to nock them.' },
  arrow_poison: { name: 'Venom Arrows', icon: '🧪', desc: 'Ammunition. Smeared with mire venom: the wound festers. [Q] on the belt to nock them.' },
  arrow_blast: { name: 'Blast Arrows', icon: '💣', desc: 'Ammunition. A charge of blast-powder bursts on impact: 3d6 to everything close. [Q] on the belt to nock them.' },
  sigil: { name: 'Hunter\'s Sigil', icon: '🜂', desc: 'Off-hand. A focus of etched bone and brass from the old Concord. Held in your left hand, right mouse casts your chosen spell; [Z] cycles your three prepared spells.', slot: 'lh', wt: 1 },
  venomsac: { name: 'Venom Sac', icon: '🫧', desc: 'Cut from a Mire-Kin. Infuses blades with poison; makes Venom Arrows.' },
  emberresin: { name: 'Ember Resin', icon: '🟠', desc: 'Still-warm resin from the Barrens\' vents and the Cinder Wraiths. Infuses blades with fire; makes Ember Arrows and blast-powder.' },
  silverdust: { name: 'Silver Dust', icon: '✨', desc: 'Iron and umbral shard ground fine. Silver-washed weapons bite deep into the accursed.' },
  blastpowder: { name: 'Blast-powder', icon: '⚫', desc: 'Coal and Ember Resin. Makes Blast Arrows.' },
  lumencore: { name: 'Lumen Core', icon: '🔆', desc: 'What the Hollow King swallowed, given back. The heart of a Beacon.' },
  tome_blast: { name: 'Tome: Force Blast', icon: '📕', desc: 'Teaches Force Blast.' },
  tome_hex: { name: 'Tome: Gloam Hex', icon: '📗', desc: 'Teaches Gloam Hex.' },
  tome_ward: { name: 'Tome: Ember Ward', icon: '📙', desc: 'Teaches Ember Ward.' },
  arrows: { name: 'Arrows', icon: '➶', desc: 'Ammunition for bows. Arrows that stick in the ground or walls can often be picked up again — walk over them.' },
  greataxe: { name: 'Headsman\'s Axe', icon: '🪓', desc: 'Weapon: 1d12 slashing. Slow and brutal.', weapon: { dice: [1, 12], cd: 1.25 }, slot: 'rh', wt: 9 },
  kingblade: { name: 'Kingsbane', icon: '🗡️', desc: 'The Hollow King\'s own blade. Weapon: 2d6 slashing, finesse.', weapon: { dice: [2, 6], cd: 0.9, finesse: true }, slot: 'rh', wt: 6 },
  shield: { name: 'Wooden Shield', icon: '🛡️', desc: 'Off-hand. +2 AC. A guard behind it lets only a quarter of a blow through.', slot: 'lh', ac: 2, wt: 3 },
  towershield: { name: 'Knight\'s Kite Shield', icon: '🛡️', desc: 'Off-hand. +3 AC. Heavy. A guard behind it stops almost everything.', slot: 'lh', ac: 3, wt: 8, block: 0.1 },
  leather: { name: 'Leather Jerkin', icon: '🦺', desc: 'Chest. +1 AC. Light.', slot: 'chest', ac: 1, wt: 3 },
  armor: { name: 'Iron Mail', icon: '🥋', desc: 'Chest. +3 AC (DEX bonus at most +2). Medium.', slot: 'chest', ac: 3, wt: 10, dexCap: 2 },
  plate: { name: 'Hollow Knight\'s Plate', icon: '🥋', desc: 'Chest. +5 AC, but no DEX bonus. Heavy.', slot: 'chest', ac: 5, wt: 16, dexCap: 0 },
  hood: { name: 'Pilgrim\'s Hood', icon: '🧕', desc: 'Head. No armour, but dread builds 15% slower.', slot: 'head', ac: 0, wt: 1 },
  helm: { name: 'Iron Helm', icon: '⛑️', desc: 'Head. +1 AC.', slot: 'head', ac: 1, wt: 3 },
  knighthelm: { name: 'Hollow Knight\'s Helm', icon: '🪖', desc: 'Head. +1 AC. Your eyes catch more in the dark (darkvision +4).', slot: 'head', ac: 1, wt: 4 },
  gloves: { name: 'Leather Gloves', icon: '🧤', desc: 'Hands. Your swings come a little faster.', slot: 'hands', ac: 0, wt: 1 },
  gauntlets: { name: 'Iron Gauntlets', icon: '🧤', desc: 'Hands. +1 AC.', slot: 'hands', ac: 1, wt: 3 },
  boots: { name: 'Worn Boots', icon: '🥾', desc: 'Legs. Quieter steps: monsters notice you 15% later.', slot: 'legs', ac: 0, wt: 1 },
  greaves: { name: 'Iron Greaves', icon: '🦿', desc: 'Legs. +1 AC.', slot: 'legs', ac: 1, wt: 4 },
  goggles: { name: 'Goggles of Night', icon: '🥽', desc: '[G] toggles permanent night vision. Burns one glowcap every 45s.' },
  pelt: { name: 'Wolf Pelt', icon: '🐺', desc: 'Thick grey fur. Oswin and Tamsin will buy it.' },
  signet: { name: 'Wyll\'s Signet', icon: '💍', desc: 'A worn family ring from the catacombs. Old Hobb will want it.' },
  reliquary: { name: 'Ashen Reliquary', icon: '⚱️', desc: 'A small sealed urn from the chapel altar. Brother Aldric\'s order kept it.' },
  charm: { name: 'Ash-Blessed Charm', icon: '📿', desc: 'Charm. While worn, dread builds 30% slower.', slot: 'charm', wt: 0 },
  wolfcharm: { name: 'Wolf-Tooth Charm', icon: '🦷', desc: 'Charm. While worn, +1 to hit.', slot: 'charm', wt: 0 },
  // tools: held in the right hand like a weapon ([V] swaps), they dig fast and break out a whole face of earth
  pick: { name: 'Prospector\'s Pick', icon: '⛏️', desc: 'Right hand. Digs three times faster than bare hands and breaks out a cross of earth with every stroke. A poor weapon: 1d6 piercing. Reinforcing it at the forge digs faster still.', weapon: { dice: [1, 6], cd: 0.85 }, tool: { speed: 3, chunk: 1 }, slot: 'rh', wt: 3 },
  mattock: { name: 'Concord Mattock', icon: '⛏️', desc: 'Right hand. A Vharrow quarry tool of black steel: digs five times faster and breaks out a full 3×3 face. Weapon: 1d8 piercing.', weapon: { dice: [1, 8], cd: 0.95 }, tool: { speed: 5, chunk: 2 }, slot: 'rh', wt: 5 },
  wardenaxe: { name: 'Woodwarden\'s Axe', icon: '🪓', desc: 'Blackbark haft, a head of old Concord steel gone green. Weapon: 1d12 slashing. Scales hard on strength.', weapon: { dice: [1, 12], cd: 1.15 }, slot: 'rh', wt: 7 },
  vanesabre: { name: 'Captain Vane\'s Sabre', icon: '🗡️', desc: 'A Lantern Company officer\'s sabre, salt-pitted and still keen. Weapon: 1d10 slashing, finesse, quick.', weapon: { dice: [1, 10], cd: 0.75, finesse: true }, slot: 'rh', wt: 3 },
  rimeglaive: { name: 'Rimeglaive', icon: '🔱', desc: 'The star-monks\' vigil-blade. Frost gathers on it out of nothing. Weapon: 2d6, scaling with strength and with the mind.', weapon: { dice: [2, 6], cd: 1.0 }, slot: 'rh', wt: 6 },
  veillamp: { name: 'Veiled Lamp', icon: '🏮', desc: 'A lantern hood Brother Aldric stitched from the Concord cloth of those you returned. At night your lantern draws the Gloam-kept from only half as far.' },
};
const FISTS = { name: 'Fists', weapon: { dice: [1, 3], cd: 0.5 } };
const RECIPES = [
  { out: 'b7', n: 4, need: { b5: 1 } },
  { out: 'b12', n: 4, need: { coal: 1, b7: 1 } },
  { out: 'oil', n: 1, need: { coal: 2 } },
  { out: 'b18', n: 1, need: { b7: 3, coal: 1 } },
  { out: 'club', n: 1, need: { b7: 2 } },
  { out: 'healing', n: 1, need: { herb: 2, b13: 1 }, alch: true },
  { out: 'elixir', n: 1, need: { b13: 3, coal: 1 }, alch: true },
  { out: 'lumendraught', n: 1, need: { b13: 3, shard: 1 }, alch: true },
  { out: 'b13', n: 3, need: { b30: 1 } },
  { out: 'b11', n: 4, need: { b10: 4 } },
  { out: 'shield', n: 1, need: { b7: 4, iron: 1 } },
  { out: 'sword', n: 1, need: { iron: 3, b7: 1 } },
  { out: 'armor', n: 1, need: { iron: 6 } },
  { out: 'goggles', n: 1, need: { iron: 4, b13: 6, shard: 3, gold: 10 } },
  { out: 'arrows', n: 8, need: { b7: 1, iron: 1 } },
  { out: 'lumencore', n: 1, need: { emptycore: 1, kingash: 1 } },
  { out: 'silverdust', n: 2, need: { iron: 2, shard: 1 } },
  { out: 'blastpowder', n: 2, need: { coal: 2, emberresin: 1 } },
  { out: 'arrow_poison', n: 4, need: { arrows: 4, venomsac: 1 } },
  { out: 'arrow_fire', n: 4, need: { arrows: 4, emberresin: 1 } },
  { out: 'arrow_blast', n: 3, need: { arrows: 3, blastpowder: 1 } },
  { out: 'pick', n: 1, need: { iron: 2, b7: 2 } },
  { out: 'mattock', n: 1, need: { iron: 5, shard: 2, b7: 2 } },
  { out: 'b35', n: 2, need: { b7: 6 } },
  { out: 'b36', n: 4, need: { herb: 2, b2: 1 } },
  { out: 'b44', n: 1, need: { b5: 3 } },
];
// The main story: each step says where to go (the ◆ marker), and some are finished by talking to someone.
const npcAt = id => { const n = npcs.find(q => q.id === id); return n ? { x: n.pos.x, y: n.pos.y + 2.4, z: n.pos.z } : null; };
const notePos = id => { for (const [i, n] of world.notes || []) if (n === id) { const y = Math.floor(i / (W * D)), r = i % (W * D); return { x: r % W + 0.5, y: y + 1.6, z: Math.floor(r / W) + 0.5 }; } return null; };
// The campaign. One story: the Company's hunter comes ashore to clear a haunted land, and learns that what haunts it
// are people the Gloam has kept alive and changed for two hundred years. Every act is a land, a chapter of the Concord
// found in its notes, a person the Gloam made into something else (slay them, or return them), and a step toward a home.
const ACTS = [
  { id: 'prologue', name: 'Prologue — Landfall', sub: 'A fire, a fence of logs, and a land nobody has charted.' },
  { id: 'vale', name: 'Act I — The Ember Vale', sub: 'There were children here. There were festivals.' },
  { id: 'vharrow', name: 'Act II — Vharrow', sub: 'The castle that swallowed the moon — and one of our own.' },
  { id: 'moors', name: 'Act III — The Western Moors', sub: 'Hunters, like you. They never stopped hunting.' },
  { id: 'mire', name: 'Act IV — The Fungal Mire', sub: 'The gardeners remember. That is the worst of it.' },
  { id: 'barrens', name: 'Act V — The Ashen Barrens', sub: 'Where the furnaces still burn, and someone drew a Beacon.' },
  { id: 'king', name: 'Act VI — The Lord of Vharrow', sub: 'He chose this for all of them. Now you choose for him.' },
  { id: 'beacon', name: 'Finale — The Beacon', sub: 'A light to live by — for the Company, and for whoever kneels in it.' },
  { id: 'gloam', name: 'Epilogue — The Gloam Below', sub: 'Beneath the Lumen there is another current. It has noticed you.' },
];
const QUESTS = [
  // ---- Prologue: Landfall — you are a hired hunter, and they are monsters
  { act: 'prologue', text: 'Speak with Maren, Warden of the Landing, by the bonfire', at: () => npcAt('maren'), done: () => S.flags.metMaren,
    talk: { npc: 'maren', flag: 'metMaren', say: 'Hunter. Good, you\'re on your feet. Forty-one days on the Grey Sea and this is what the Lantern Company owns: a fire, a fence of logs, and a land nobody has charted. We came because the old country is going dark, and the Company bought a legend about a land where light rises out of the ground. Somebody lived that legend. Those are their roads and their castle. What lives in it now comes out after dark, and it goes for any light it can see. Every lamp we lit the first week brought them to the fence. So, your work: walk out there, learn what this place is, kill whatever threatens us, and keep this fire lit until it\'s a home. Captain Brannoc has your first contract.' } },
  { act: 'prologue', text: 'Report to Captain Brannoc at the notice board', at: () => npcAt('brannoc'), done: () => S.flags.metBrannoc,
    talk: { npc: 'brannoc', flag: 'metBrannoc', gift: { healing: 2 }, say: 'Maren\'s hunter. Then listen, I\'ll say this once. The things out there are slow, but they hit like a falling wall. Watch them rear back and glow. Raise your guard [hold right mouse] as the blow lands and you\'ll turn it aside, or get clear [C]. And mind your light. After dark a lantern is a dinner bell; they\'ll cross a whole field for it. Crouch [Ctrl], keep to the dark, and if one gets your scent, break its line of sight and hide somewhere. Wardrobes, brambles, anything. Then keep still. They search, but they give up. Take these draughts; [Q] drinks one. There\'s a dead village just north of us. Hollowed have crept into it. Put three down so Wen can survey.' } },
  { act: 'prologue', text: 'Put down the Hollowed in the dead village just north of the Landing', kill: { ghoul: 3 }, alsoDone: () => S.flags.villageDone, at: () => world.village && { x: world.village.x, y: world.topSolid(Math.floor(world.village.x), Math.floor(world.village.z)) + 3, z: world.village.z } },
  { act: 'prologue', text: 'Search the dead village for any sign of who lived there', at: () => notePos('village'), done: () => S.notesRead?.includes('village') },
  { act: 'prologue', text: 'Return to Captain Brannoc before nightfall', at: () => npcAt('brannoc'), done: () => S.flags.villageDone,
    talk: { npc: 'brannoc', flag: 'villageDone', gift: { gold: 15, healing: 1 }, say: 'Three down, and you read their letters too? A child\'s, Wen says. Festivals, lanterns, a well full of light. Don\'t look at me like that. Whoever wrote that letter is two hundred years gone; what\'s left is teeth. Here\'s your pay. Night\'s coming, and here it\'s total dark. Every light you carry out there is a beacon to them. Get through it. Out in the dark if you must, at the bonfire if you\'re wise.' } },
  { act: 'prologue', text: 'Survive your first night — brave the dark, or rest at the Landing\'s bonfire', at: () => sunNow < 0.6 ? { x: world.camp.x + 0.5, y: world.camp.y + 2, z: world.camp.z + 0.5 } : null, done: () => S.day >= 2 },
  // ---- Act I: The Ember Vale — the land was a home once
  { act: 'vale', text: 'Something tested the logs last night, where the lamps were lit. Ask Maren about colony projects and raise the Stone Palisade', at: () => npcAt('maren'), done: () => !!S.colony?.built?.palisade },
  { act: 'vale', boss: 'bridgewarden', text: 'Brannoc\'s scouts saw a sentinel on the broken bridge. Slay the Bridgewarden', at: () => bossAt('bridgewarden'), done: () => S.flags.boss_bridgewarden },
  // ---- Act II: Vharrow — the Sigil, the Rite, and Wyll
  { act: 'vharrow', text: 'Leap the broken bridge and pass through Vharrow\'s gate', at: () => world.castle.gate, done: () => S.flags.inCastle },
  { act: 'vharrow', text: 'Read the plaque beside the gate — learn what Vharrow was', at: () => notePos('gate'), done: () => S.notesRead?.includes('gate') },
  { act: 'vharrow', text: 'Plunder a chest inside the castle walls', at: () => nearestChest(), done: () => S.flags.castleChest },
  { act: 'vharrow', text: 'Something in that chest hums. Bring the strange sigil to Brother Aldric', at: () => npcAt('aldric'), done: () => S.flags.magic,
    talk: { npc: 'aldric', flag: 'magic', need: { sigil: 1 }, keep: true, wait: 'You found something in the castle? Bring it to me, whatever it is.', say: 'Light preserve us, I know this. It\'s drawn in the hymnal fragments: a sigil of the Concord, bone and brass, made for holding the Lumen. Hold it in your left hand... feel that? The creatures still carry the old light. It leaves them when they fall, and this catches it. I can teach you two workings from the hymnal: Mend, and the cinder-fire their forges used. Right mouse to cast, [Z] to choose, [Tab] to swap back to your shield. But hunter, there\'s a third working in these fragments. A rite. "To give the light back to the kept, that they may be returned." Returned. I don\'t know what it means. Beat one of them to its knees, and find out.', fn: () => unlockMagic() } },
  { act: 'vharrow', text: 'Aldric\'s rite: beat one of the Gloam-kept to its knees, then perform the Rite of Return [H] instead of the killing blow', done: () => (S.mercy || 0) >= 1 },
  { act: 'vharrow', text: 'Tell Brother Aldric what knelt in front of you', at: () => npcAt('aldric'), done: () => S.flags.riteTold,
    talk: { npc: 'aldric', flag: 'riteTold', say: () => `A person. You're sure? ${S.names?.[0] ? S.names[0].n + ', ' + S.names[0].w + '. ' : ''}...Then they aren't dead, and they aren't beasts. The Gloam keeps them alive under all that, two hundred years of it. The Lumen in your sigil loosens its grip and the light goes back where it was taken from. Most won't survive it, I think; two centuries come due all at once. But they die as themselves, and some may live. Hunter, I can't tell you what to do with that. Brannoc will say a kill is a kill and the colony needs them gone. And the light it costs to return the living is the light you take from the slain. That arithmetic is yours now.` } },
  { act: 'vharrow', text: 'Old Hobb\'s brother Wyll went into the catacombs and never came up. Ask Hobb', at: () => npcAt('hobb'), done: () => S.flags.hobbAsked,
    talk: { npc: 'hobb', flag: 'hobbAsked', say: 'Wyll. My little brother. Company\'s best scout, the first week. Went down under the castle to map the tunnels, wearing our father\'s signet. Brannoc says he\'s dead. Brannoc didn\'t see what I saw: something at the stair, on the third night. Standing. Facing up. Wearing Wyll\'s coat. Aldric says they can be... brought back. If that\'s him, bring him back to me. And if you can\'t, bring me the ring. Please.' } },
  { act: 'vharrow', text: 'Descend into the catacombs — the stair is on the east side of the keep\'s great hall', at: () => world.castle.catStair, done: () => S.flags.catacombs },
  { act: 'vharrow', boss: 'wyll', text: 'Find Wyll in the candle-lit tomb. Return him [H] when he kneels — or put him to rest', at: () => bossAt('wyll'), done: () => S.flags.boss_wyll },
  { act: 'vharrow', text: 'Go home to Old Hobb', at: () => npcAt('hobb'), done: () => S.flags.wyllHome,
    talk: { npc: 'hobb', flag: 'wyllHome', need: { signet: 1 }, gift: { gold: 50, healing: 2 }, wait: 'Did you find him? Did you find Wyll?', say: () => S.flags.wyllRestored
      ? 'He came up the stair on his own feet. Thin as a rake and shaking, and he knew me. He knew me, hunter. Forty days the Gloam had him, and you brought him back. Aldric has him by the fire. He gave me the ring himself. ...Take these. Take anything. And tell Brannoc. Tell him they\'re people, all of them, every one he\'s paid you for.'
      : 'That\'s his. That\'s Wyll\'s. ...Forty days down there and it made him one of them. Forty days. Do you understand what that means? It isn\'t a curse on their kind. It\'s a sickness of this land, and it can take any of us. ...Take these. I\'m going to go and fill his grave.' } },
  { act: 'vharrow', text: 'The deep places will be darker still. Bring 3 Umbral Shards to Brother Aldric', at: () => count('shard') >= 3 ? npcAt('aldric') : null, done: () => S.flags.goggles,
    talk: { npc: 'aldric', flag: 'goggles', need: { shard: 3 }, gift: { goggles: 1, b13: 6 }, wait: 'Three shards, friend. The Gloam-kept carry them. Crystallised dark, I think.', say: 'Three of them. Listen, I think I understand them now. The Gloam keeps them, but it starves them of the light they lived by, and they hunger for it. That\'s why they come for your lantern: to them it looks like the Lumen, like home. So we take your light away and give you eyes instead. I\'ve set the shards in glass and bound them with glowcap ash: Goggles of Night. Press [G] and the dark opens like a book, and nothing out there sees you coming. They burn glowcaps as they work. Go west next. Brannoc has lost two scouts on the moor.' } },
  // ---- Act III: The Western Moors — they were hunters too
  { act: 'moors', text: 'Two scouts vanished on the Western Moors. Find the old hunting lodge', at: () => notePos('moor'), done: () => S.notesRead?.includes('moor') },
  { act: 'moors', boss: 'aldous', text: 'Aldous, the First Stag, hunts between the pines. Slay him, or bring him to his knees and return him', at: () => bossAt('aldous'), done: () => S.flags.boss_aldous },
  { act: 'moors', text: 'Raise a Watchtower and Lumen Lamps so the Landing sees what\'s coming', at: () => npcAt('maren'), done: () => S.colony?.built?.watchtower && S.colony?.built?.lamps },
  // ---- Act IV: The Fungal Mire — they remember
  { act: 'mire', text: 'Chart the Fungal Mire to the east. Find what the gardeners left behind', at: () => notePos('mire1'), done: () => S.notesRead?.includes('mire1') },
  { act: 'mire', text: 'Find the Concord physician\'s notes on the Change', at: () => notePos('mire2'), done: () => S.notesRead?.includes('mire2') },
  { act: 'mire', boss: 'matron', text: 'The Glasswater Matron still tends the heart of the mire. Slay her, or return her', at: () => bossAt('matron'), done: () => S.flags.boss_matron },
  { act: 'mire', text: 'The mire\'s venom is in the colonists\' wounds, and the returned need tending. Build the Infirmary', at: () => npcAt('maren'), done: () => !!S.colony?.built?.infirmary },
  // ---- Act V: The Ashen Barrens — a light that could bring them all back
  { act: 'barrens', text: 'Cross into the Ashen Barrens and find the Cinderworks ledger', at: () => notePos('barrens1'), done: () => S.notesRead?.includes('barrens1') },
  { act: 'barrens', text: 'Find the Cinderworks\' plans for a Beacon', at: () => notePos('beacon'), done: () => S.notesRead?.includes('beacon') },
  { act: 'barrens', boss: 'foreman', text: 'The Cinder Foreman still works his quota. Take the empty Beacon-core from him', at: () => bossAt('foreman'), done: () => S.flags.boss_foreman },
  { act: 'barrens', text: 'Give Tamsin a real forge for what\'s coming. Build the Colony Forge', at: () => npcAt('maren'), done: () => !!S.colony?.built?.forge },
  // ---- Act VI: The Lord of Vharrow — the one who chose
  { act: 'king', text: 'Read the Lord of Vharrow\'s decree in the great hall', at: () => notePos('keep'), done: () => S.notesRead?.includes('keep') },
  { act: 'king', boss: 'king', text: 'Climb to the throne and face the Lord of Vharrow. Slay or return him, with the empty core in your pack', at: () => world.castle.throne && { x: world.castle.throne.x, y: world.castle.throne.y + 3, z: world.castle.throne.z }, done: () => S.flags.king },
  // ---- Finale
  { act: 'beacon', text: 'Carry the Lumen Core home. Raise the Beacon at the Landing', at: () => npcAt('maren'), done: () => !!S.colony?.built?.beacon },
  // ---- Epilogue: the Gloam Below
  { act: 'gloam', text: 'Something still watches the sky. Find the last astronomer of Vharrow (the far Barrens)', at: () => notePos('barrens2'), done: () => S.notesRead?.includes('barrens2') },
  { act: 'gloam', boss: 'astronomer', text: 'At night, find the Pale Astronomer on the mesas of the far Barrens', at: () => sunNow < 0.4 ? bossAt('astronomer') : notePos('barrens2'), done: () => S.flags.boss_astronomer },
  { act: 'gloam', text: 'Deepen the Gloam at the Beacon. Hunt ever deeper. Reach level 400', done: () => S.level >= 400 },
];
const KING_STEP = QUESTS.findIndex(q => q.boss === 'king');
// ---- the act bosses: each a person of the old kingdom (or of ours) the Gloam made into something else
const BOSSES = {
  bridgewarden: { type: 'knight', name: 'The Bridgewarden', sub: 'It has stood its post for two hundred years.', scale: 1.3, lvl: 8, hp: 3.2, r: 14, item: 'greatsword',
    at: () => ({ x: 128.5, y: world.castle.G + 1, z: world.castle.z1 + 10.5 }) },
  wyll: { type: 'ghoul', name: 'What Was Wyll', sub: 'He is still wearing the Company coat. Forty days.', scale: 1.15, lvl: 14, hp: 4, r: 10, drops: [['signet', 1]],
    at: () => SIDE_POS.signet() },
  aldous: { type: 'wendigo', name: 'Aldous, the First Stag', sub: 'The huntsman of the Western Lodge, grown tall between the pines.', scale: 1.35, lvl: 26, hp: 4, r: 18,
    at: () => { const p = notePos('moor'); return p && { x: p.x + 8, y: world.topSolid(Math.floor(p.x + 8), Math.floor(p.z)) + 1, z: p.z }; } },
  matron: { type: 'mirekin', name: 'The Glasswater Matron', sub: 'She tended the gardens. She tends them still.', scale: 1.7, lvl: 48, hp: 5, r: 18,
    at: () => ({ x: 290.5, y: world.topSolid(290, 118) + 1, z: 118.5 }) },
  foreman: { type: 'cinder', name: 'The Cinder Foreman', sub: 'Quota for the month: one Beacon-core.', scale: 1.5, lvl: 78, hp: 5, r: 18, drops: [['emptycore', 1]],
    at: () => { const p = notePos('beacon'); return p && { x: p.x + 6, y: world.topSolid(Math.floor(p.x + 6), Math.floor(p.z)) + 1, z: p.z }; } },
  king: { type: 'king', name: 'The Hollow King', sub: 'The Lord of Vharrow. He has waited a long time for someone to kneel.', scale: 1, lvl: 95, hp: 2.2, r: 13, flag: 'king',
    at: () => world.castle.throne && { x: world.castle.throne.x, y: world.castle.throne.y + 1, z: world.castle.throne.z } },
  warden: { type: 'barkkin', name: 'The Woodwarden', sub: 'It kept the Weeping Wood so long it became part of it.', scale: 1.6, lvl: 100, hp: 5, r: 16, wild: true, drops: [['wardenaxe', 1]],
    at: () => world.greatTree && { x: world.greatTree.x + 5.5, y: world.topSolid(world.greatTree.x + 5, world.greatTree.z) + 1, z: world.greatTree.z + 0.5 } },
  captain: { type: 'drowned', name: 'Captain Oriel Vane', sub: 'Master of the Constancy, the First Landing. Thirty-one years ashore.', scale: 1.35, lvl: 120, hp: 5, r: 14, wild: true, drops: [['vanesabre', 1]],
    at: () => world.wrecks?.[0] && { x: world.wrecks[0].x + 0.5, y: world.topSolid(world.wrecks[0].x, world.wrecks[0].z + 6) + 1, z: world.wrecks[0].z + 6.5 } },
  abbot: { type: 'rimed', name: 'The Abbot Under Snow', sub: 'He kept the vigil for the moon. He keeps it still.', scale: 1.5, lvl: 142, hp: 6, r: 16, wild: true, drops: [['rimeglaive', 1]],
    at: () => world.monastery && { x: world.monastery.x + 0.5, y: world.monastery.y, z: world.monastery.z + 0.5 } },
  astronomer: { type: 'watcher', name: 'The Pale Astronomer', sub: 'He is only looking for the moon. He is only looking at you.', scale: 1.25, lvl: 110, hp: 6, r: 22, night: true,
    at: () => { const p = notePos('barrens2'); return p && { x: p.x, y: world.topSolid(Math.floor(p.x), Math.floor(p.z - 10)) + 1, z: p.z - 10 }; } },
};
const SIDE_POS = { signet: () => (world.questChest?.signet != null ? idxPos(world.questChest.signet) : null) };
function bossAt(id) { const b = BOSSES[id]; return b && !S.flags['boss_' + id] ? b.at() : null; }

function nearestChest() {
  const K = world.castle; let best = null, bd = 1e9;
  for (const [i, kind] of world.chestKind) {
    if (world.opened.has(i)) continue;
    const y = Math.floor(i / (W * D)), r = i % (W * D), z = Math.floor(r / W), x = r % W;
    if (x < K.x0 || x > K.x1 || z < K.z0 || z > K.z1 || y < K.G - 2) continue;
    const d = Math.hypot(x - P.pos.x, (y - P.pos.y) * 3, z - P.pos.z);
    if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 1.5, z: z + 0.5 }; }
    void kind;
  }
  return best;
}

// ================================================================ settings
let SET = { sens: 1, vol: 0.6 };
try { Object.assign(SET, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { /* ignore */ }
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) { /* ignore */ } };
snd.setVolume(SET.vol);
// browsers only let a page make sound after you interact with it, and can suspend it again later: wake it on any click or key
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => { if (snd.state !== 'running') snd.init(); }, true);

// ================================================================ renderer & scene
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 600);
camera.rotation.order = 'YXZ';
scene.add(camera);
const QUALITY = {
  high: { shadow: 2048, bloom: true, pr: 1.25, view: 230, label: 'High' },
  medium: { shadow: 1024, bloom: false, pr: 1, view: 160, label: 'Medium' },
  low: { shadow: 0, bloom: false, pr: 0.8, view: 115, label: 'Low' },
};
if (!QUALITY[SET.quality]) {
  // first run: integrated / software GPUs start on Medium
  let gpu = '';
  try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) { /* unknown */ }
  SET.quality = /intel|uhd|iris|microsoft basic|swiftshader|llvmpipe|mali|adreno|apple m1/i.test(gpu) ? 'medium' : 'high';
  SET.autoRes ??= true;
}
SET.autoRes ??= true; SET.showFps ??= false;

// ---- materials: 64px albedo + normal-map texture arrays
const TEX = buildTextures();
resolveTextures(TEX.index);
function arrTex(data) {
  const t = new THREE.DataArrayTexture(data, TS, TS, TEX.count);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.needsUpdate = true;
  return t;
}
U.uAlb.value = arrTex(TEX.alb); U.uNrm.value = arrTex(TEX.nrm);
const terrainMat = makeTerrainMaterial();
const tileURL = {};
BLOCKS.forEach((b, i) => { if (i) tileURL[i] = layerDataURL(TEX, TL[i][b.render === 'cube' || b.render === 'cutout' ? 1 : 0]); });

// ---- overcast sky dome with drifting cloud deck
const skyU = { uZen: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() }, uCloud: { value: new THREE.Vector3() }, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uTime: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false,
  vertexShader: /* glsl */`varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: /* glsl */`
    uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uCloud; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uTime;
    varying vec3 vDir;
    float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
    void main() {
      vec3 d = normalize(vDir); float h = d.y;
      vec3 col = mix(uHor, uZen, pow(clamp(h, 0.0, 1.0), 0.45));
      if (h < 0.0) col = uHor * (1.0 + h * 0.7);
      float sd = max(dot(d, uSunDir), 0.0);
      col += uSunCol * (pow(sd, 6.0) * 0.16 + pow(sd, 900.0) * 5.0);
      if (h > 0.0) {
        vec2 cp = d.xz / (h + 0.12) * 0.9 + vec2(uTime * 0.004, uTime * 0.0025);
        float n = fbm(cp * 1.3), lit = n * 0.6 + vn(cp * 1.3 + uSunDir.xz * 0.6) * 0.4;
        float cov = smoothstep(0.34, 0.74, n);
        vec3 cc = uCloud * (0.7 + 0.6 * (n - lit)) + uSunCol * pow(sd, 4.0) * 0.2;
        col = mix(col, cc, cov * smoothstep(0.0, 0.25, h) * 0.94);
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
}));
sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);

// stars: they shine, but light nothing
const starGeo = new THREE.BufferGeometry();
{
  const a = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, y = Math.abs(u) * 0.9 + 0.1, r = Math.sqrt(1 - y * y);
    a[i * 3] = Math.cos(th) * r * 300; a[i * 3 + 1] = y * 300; a[i * 3 + 2] = Math.sin(th) * r * 300;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(a, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xc8d0ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false; scene.add(stars);

// drifting ash
const ASH_N = 700, ashGeo = new THREE.BufferGeometry(), ashPos = new Float32Array(ASH_N * 3);
for (let i = 0; i < ASH_N * 3; i++) ashPos[i] = (Math.random() - 0.5) * 50;
ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
const ashMat = new THREE.PointsMaterial({ color: 0x8a8580, size: 0.06, transparent: true, opacity: 0.4, depthWrite: false });
const ash = new THREE.Points(ashGeo, ashMat); ash.frustumCulled = false; scene.add(ash);

// ---- sun shadow map
const shadowMat = makeShadowMaterial();
const shadowCam = new THREE.OrthographicCamera(-70, 70, 70, -70, 1, 340);
let shadowRT = null;
function setupShadows() {
  if (shadowRT) { shadowRT.depthTexture.dispose(); shadowRT.dispose(); shadowRT = null; }
  U.uShadowOn.value = 0;
  const sz = QUALITY[SET.quality].shadow; if (!sz) return;
  shadowRT = new THREE.WebGLRenderTarget(sz, sz);
  shadowRT.depthTexture = new THREE.DepthTexture(sz, sz); shadowRT.depthTexture.type = THREE.UnsignedIntType;
  U.uShadow.value = shadowRT.depthTexture; U.uShadowTexel.value = 1 / sz;
}
const _sc = new THREE.Vector3();
let shadowAge = 999, shadowKey = '';
function renderShadows() {
  if (!shadowRT || U.uSunCol.value.x < 0.02) { U.uShadowOn.value = 0; return; }
  // the shadow map is expensive: re-render only when the player moves to a new 8-block cell or every ~20 frames
  const key = `${Math.round(P.pos.x / 8)},${Math.round(P.pos.y / 8)},${Math.round(P.pos.z / 8)},${dirty.size}`;
  if (key === shadowKey && ++shadowAge < 75) return;
  shadowKey = key; shadowAge = 0;
  const ext = 70;
  _sc.set(Math.round(P.pos.x / 8) * 8, Math.round(P.pos.y / 8) * 8, Math.round(P.pos.z / 8) * 8);
  shadowCam.position.copy(_sc).addScaledVector(U.uSunDir.value, 170);
  shadowCam.lookAt(_sc); shadowCam.updateMatrixWorld();
  U.uShadowMat.value.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
  const hide = [sky, stars, ash, vm, lanternMesh], vis = hide.map(o => o.visible);
  hide.forEach(o => { o.visible = false; });
  scene.overrideMaterial = shadowMat;
  renderer.setRenderTarget(shadowRT); renderer.clear(); renderer.render(scene, shadowCam); renderer.setRenderTarget(null);
  scene.overrideMaterial = null;
  hide.forEach((o, i) => { o.visible = vis[i]; });
  U.uShadowOn.value = 1;
}

// ---- post: bloom + film grade (ACES, desaturation, split-tone, vignette, grain, night-vision phosphor)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 0.9);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uNV: { value: 0 }, uDread: { value: 0 }, uTime: { value: 0 }, uExposure: { value: 1.0 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uNV; uniform float uDread; uniform float uTime; uniform float uExposure; varying vec2 vUv;
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    float hh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float ca = 0.0012 + uDread * 0.007;
      vec3 col = vec3(texture2D(tDiffuse, vUv + c * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - c * ca).b);
      col = aces(col * uExposure);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 0.74 - uDread * 0.45);
      col *= mix(vec3(0.93, 0.98, 1.08), vec3(1.06, 1.0, 0.92), clamp(l * 2.0, 0.0, 1.0)); // cool shadows, warm highlights; black stays black
      if (uNV > 0.0) { float L = pow(clamp(l * 2.3, 0.0, 1.0), 0.75); col = mix(col, vec3(0.3, 1.0, 0.4) * L + vec3(0.0, 0.02, 0.0), uNV); }
      float vig = smoothstep(0.9, 0.2, length(c) * (1.0 + uDread * 0.7));
      col *= mix(0.5, 1.0, vig);
      col = pow(max(col, 0.0), vec3(1.0 / 2.2));
      float gr = hh(vUv * vec2(1931.0, 1087.0) + fract(uTime) * 91.7) - 0.5;
      col += gr * (0.035 * clamp(l * 4.0, 0.0, 1.0) + uNV * 0.08);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
});
composer.addPass(grade);
// dynamic resolution: the render scale drops when frames run long and creeps back up when there's headroom
let resScale = 1;
function applyPixelRatio() {
  const pr = Math.max(0.35, Math.min(devicePixelRatio, QUALITY[SET.quality].pr) * resScale);
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr); resize();
}
function applyQuality() {
  const q = QUALITY[SET.quality];
  resScale = 1;
  bloom.enabled = q.bloom;
  U.uCheap.value = SET.quality === 'high' ? 0 : 1;
  setupShadows(); applyPixelRatio();
  saveSettings();
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// held item / lantern view-model
const vm = new THREE.Group(); camera.add(vm); vm.position.set(0.36, -0.34, -0.58);
const vmMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const vmMat2 = new THREE.MeshBasicMaterial({ color: 0xffffff });
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb040 });
const torchFlameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.1, 0.6) });
const lanternMesh = new THREE.Group();
{
  const capMat = new THREE.MeshBasicMaterial({ color: 0x141210 });
  for (const y of [-0.05, 0.05]) { const cap = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.02, 0.085), capMat); cap.position.y = y; lanternMesh.add(cap); }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.05, 0.01), capMat); handle.position.y = 0.08; lanternMesh.add(handle);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.065), flameMat); lanternMesh.add(glow);
  lanternMesh.userData.glow = glow;
  lanternMesh.position.set(-0.42, -0.36, -0.95); lanternMesh.scale.setScalar(0.85); camera.add(lanternMesh);
}
// weapons in hand are lit like the world: steel catches the lantern, wood and leather stay matte
const vmMetal = makeMobMaterial(); vmMetal.uniforms.uGrime.value = 0.35; vmMetal.uniforms.uShine.value = 0.55;
const vmWood = makeMobMaterial(); vmWood.uniforms.uGrime.value = 0.55; vmWood.uniforms.uShine.value = 0.1;
const arrowMat = makeMobMaterial(); arrowMat.uniforms.uGrime.value = 0.4; arrowMat.uniforms.uShine.value = 0.3;
const arrowGeo = arrowGeometry();
let vmKey = null, vmInfo = null;
function buildViewModel(key) {
  vmKey = key; vmInfo = null;
  while (vm.children.length) { const c = vm.children[0]; vm.remove(c); c.traverse(o => { if (o.geometry && o.geometry !== arrowGeo) o.geometry.dispose(); }); }
  const add = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); vm.add(m); return m; };
  vm.rotation.set(0, 0, 0);
  if (!key || ITEMS[key]?.weapon) { vmInfo = buildWeapon(key || 'fist', vmMetal, vmWood); vm.add(vmInfo.group); return; }
  if (key === 'b12') {
    vmMat2.userData.base = new THREE.Color(0x76542f);
    add(0.04, 0.3, 0.04, vmMat2, 0, 0, 0); add(0.06, 0.07, 0.06, torchFlameMat, 0, 0.17, 0);
    vm.rotation.set(-0.2, 0, -0.15); return;
  }
  if (isBlk(key)) {
    const id = +key.slice(1);
    const tex = new THREE.TextureLoader().load(tileURL[id]);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 });
    m.userData.dispose = true;
    const mesh = add(0.2, 0.2, 0.2, m, 0, 0, 0); mesh.rotation.set(0.3, 0.7, 0);
    return;
  }
  vmMat.userData.base = new THREE.Color(0x999999);
  add(0.1, 0.14, 0.1, vmMat, 0, 0, 0);
}

// ================================================================ game state
let world = null, chunkMeshes = [], dirty = new Set(), mobs = [], halluc = [], npcs = [], crows = [], postMob = [];
let targetNpc = null, talkNpc = null;
let state = 'title', ui = 'none', locked = false;
let S = null;
const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), half: 0.3, h: 1.8, onGround: false };
let yaw = 0, pitch = 0;
const keys = {}, mouse = { left: false };
let atkCd = 0, mine = { key: -1, p: 0 }, swingT = 0, swingDur = 0.3, airPeak = 0, stepAcc = 0, draw = 0, pLight = [15, 0];
function startSwing(d) { swingDur = d ?? clamp(weapon().cd * 0.85, 0.3, 1.0); swingT = swingDur; }
let shakeT = 0, gameT = 0, guarding = false, guardAt = -9, dodgeT = 0, dodgeCd = 0, quaffCd = 0, calmT = 0, regenAcc = 0, boss = null;
let target = null, targetMob = null;
let sunNow = 1, nvLevel = 0, lightHere = 1, underK = 0, prevT = 0;
let hbT = 0, whT = 8, halT = 10, panicT = 7, ambT = 20, saveT = 60, hudT = 0;
const look = new THREE.Vector3(), eye = new THREE.Vector3();

function newState(name, race, cls, stats) {
  const C = CLASSES[cls];
  const s = {
    name, race, cls, stats, level: 1, xp: 0,
    maxHp: C.hd + mod(stats.CON) + 6, hp: 0, grit: true, mainV: 4, mainStart: {}, hints: {}, points: 0, tier: 0, lv400: true,
    eq: { rh: [null, null], rhSel: 0, lh: null, head: null, chest: null, hands: null, legs: null, charm: null }, belt: [null, null, null, null], beltSel: 0, build: false,
    inv: {}, hotbar: Array(9).fill(null), sel: 0,
    time: 0.06, day: 1, dayMin: +$('dayLen').value,
    lanternOn: false, oilT: 150, nvT: 0, gogOn: false, gogT: 0,
    dread: 0, uses: {}, slots: 2, flags: { chests: 0 }, quest: 0,
    spawnPt: null, watcherTonight: false, sawNight: false, pendingASI: 0, restDay: 0, kills: 0,
    q: {}, killsBy: {}, wpnBonus: 0, postsDead: [],
  };
  s.hp = s.maxHp;
  return s;
}
function rechargeAll() {
  S.uses = { second: 1, shadow: 1, turn: 1, relentless: 1 };
  S.slots = Math.min(8, 2 + Math.floor(S.level / 6));
}
const prof = () => 2 + Math.floor(S.level / 25);
const sneakDice = () => Math.min(12, Math.ceil(S.level / 2));
// hit points follow level and CON (raising CON raises them retroactively, as in the old rules)
function calcMaxHp() { const hd = CLASSES[S.cls].hd; return hd + 6 + (S.level - 1) * (2 + Math.floor(hd / 4)) + statMod('CON') * (2 + Math.floor(S.level / 2)); }
function recalcHp() { const f = S.maxHp ? S.hp / S.maxHp : 1; S.maxHp = Math.max(1, calcMaxHp()); S.hp = Math.max(1, Math.min(S.maxHp, Math.round(S.maxHp * f))); }
function spendPoint(k) {
  if (!(S.points > 0) || S.stats[k] >= STAT_CAP) return;
  S.points--; S.stats[k]++; recalcHp(); snd.place();
}
// ---- scaling, the old way: every weapon draws on your attributes by a letter grade
const GRADE = { S: 1.25, A: 1.0, B: 0.8, C: 0.6, D: 0.4, E: 0.2 };
const SCALING = {
  fists: { STR: 'D', DEX: 'D' }, club: { STR: 'B' }, dagger: { DEX: 'A', STR: 'E' }, mace: { STR: 'B', DEX: 'E' }, greatsword: { STR: 'A', DEX: 'E' },
  sword: { STR: 'C', DEX: 'C' }, bow: { DEX: 'B' }, warbow: { DEX: 'B', STR: 'D' }, greataxe: { STR: 'S' }, kingblade: { STR: 'B', DEX: 'B', INT: 'D' },
  pick: { STR: 'D' }, mattock: { STR: 'C' }, sigil: { INT: 'A', WIS: 'D' },
  wardenaxe: { STR: 'A', DEX: 'D' }, vanesabre: { DEX: 'A', STR: 'E' }, rimeglaive: { STR: 'C', INT: 'B' },
};
// how much of a stat's worth is unlocked: steep to 20, good to 40, slow to 60, little past 80
const CURVE = [[1, -0.2], [10, 0], [20, 0.35], [40, 0.7], [60, 0.9], [80, 1.0], [99, 1.08]];
function statCurve(v) { for (let i = 1; i < CURVE.length; i++) { const [a, fa] = CURVE[i - 1], [b, fb] = CURVE[i]; if (v <= b) return fa + (fb - fa) * (Math.max(a, v) - a) / (b - a); } return 1.08; }
const scaleOf = k => SCALING[k || 'fists'] || (ITEMS[k]?.weapon ? { STR: 'D' } : {});
function scalingBonus(k) { let t = 0; for (const [st, g] of Object.entries(scaleOf(k))) t += GRADE[g] * statCurve(S.stats[st]) * 30; return t * (1 + 0.06 * (S.wup?.[k]?.lvl || 0)); }
function attackRating(k) {
  const w = k && ITEMS[k]?.weapon ? ITEMS[k].weapon : FISTS.weapon, ul = S.wup?.[k]?.lvl || 0;
  return (w.dice[0] * (w.dice[1] + 1) / 2 + upLvl(k)) * (1 + 0.08 * ul) + scalingBonus(k);
}
const gradeTxt = k => Object.entries(scaleOf(k)).map(([st, g]) => `${st} ${g}`).join(' · ') || '—';
const spellPower = () => Math.round(scalingBonus('sigil') + S.level * 0.2);
// what the next point in a stat would buy you
function statGain(k) {
  if (S.stats[k] >= STAT_CAP) return '';
  const rh = rightHand(), snap = () => [attackRating(rh), scalingBonus('sigil') + S.level * 0.2, calcMaxHp(), maxAether(), playerAC()];
  const a = snap(); S.stats[k]++; const b = snap(); S.stats[k]--;
  const out = [], d = i => b[i] - a[i];
  if (d(0) > 0.05) out.push(`⚔ +${d(0).toFixed(1)}`);
  if (S.flags.magic && d(1) > 0.05) out.push(`✦ +${d(1).toFixed(1)}`);
  if (d(2) > 0) out.push(`♥ +${d(2)}`);
  if (S.flags.magic && d(3) > 0) out.push(`Lumen +${d(3)}`);
  if (d(4) > 0) out.push(`AC +${d(4)}`);
  return out.join(' ');
}
const statMod = k => mod(S.stats[k]);
// ---- the loadout: what you fight in, kept apart from what you build with
const SLOTS = ['head', 'chest', 'hands', 'legs', 'charm'];
const eqItem = s => S.eq?.[s] && count(S.eq[s]) ? S.eq[s] : null;
const rightHand = () => { const k = S.eq?.rh?.[S.eq.rhSel]; return k && count(k) ? k : null; };
const offHand = () => eqItem('lh');
const wearing = k => SLOTS.some(s => eqItem(s) === k) || offHand() === k || (S.eq?.rh || []).includes(k);
function playerAC() {
  const chest = ITEMS[eqItem('chest')];
  const dex = Math.min(statMod('DEX'), chest?.dexCap ?? 99);
  let ac = 10 + dex;
  for (const s of SLOTS) ac += ITEMS[eqItem(s)]?.ac || 0;
  ac += ITEMS[offHand()]?.ac || 0;
  return ac;
}
function equipLoad() {
  let w = ITEMS[offHand()]?.wt || 0;
  for (const s of SLOTS) w += ITEMS[eqItem(s)]?.wt || 0;
  for (const k of S.eq.rh) if (k && count(k)) w += ITEMS[k]?.wt || 0;
  const cap = 18 + S.stats.STR * 1.2;
  return { w, cap, r: w / cap };
}
const loadClass = () => { const r = equipLoad().r; return r < 0.3 ? 'light' : r <= 0.7 ? 'medium' : 'heavy'; };
function equip(k) {
  const it = ITEMS[k]; if (!it?.slot || !count(k)) return;
  if (it.slot === 'rh') {
    const rh = S.eq.rh;
    if (rh.includes(k)) { S.eq.rhSel = rh.indexOf(k); }
    else if (!rh[0] || !count(rh[0])) { rh[0] = k; S.eq.rhSel = 0; }
    else if (!rh[1] || !count(rh[1])) { rh[1] = k; S.eq.rhSel = 1; }
    else { rh[S.eq.rhSel] = k; }
  } else S.eq[it.slot] = k;
  snd.place(); renderHotbar();
}
// gear you buy goes straight on: a new weapon takes the weaker hand (a digging tool counts as weakest)
let buying = false;
function wearBought(k) {
  const it = ITEMS[k]; if (!it?.slot || wearing(k)) return;
  if (it.slot === 'rh') {
    const rh = S.eq.rh, rate = j => (rh[j] && count(rh[j]) ? attackRating(rh[j]) - (ITEMS[rh[j]].tool ? 1000 : 0) : -1e9);
    const j = rate(0) <= rate(1) ? 0 : 1, old = rh[j];
    rh[j] = k; S.eq.rhSel = j;
    log(`You take up the <b>${it.name}</b>${old && count(old) ? ` (the ${itemName(old)} goes in your pack)` : ''}. [V] swaps weapons · [I] shows your gear.`, 'good');
  } else {
    const old = eqItem(it.slot);
    if (old && (ITEMS[old]?.ac || 0) > (it.ac || 0)) { log(`${it.name} is in your pack — [I] to wear it.`, 'good'); return; }
    S.eq[it.slot] = k;
    log(`You put on the <b>${it.name}</b>.`, 'good');
  }
  renderHotbar();
}
function unequip(slot, i) {
  if (slot === 'rh') { S.eq.rh[i] = null; if (S.eq.rh[1 - i]) S.eq.rhSel = 1 - i; } else S.eq[slot] = null;
  renderHotbar();
}
const darkvision = () => (RACES[S.race].dv || 0) + (eqItem('head') === 'knighthelm' ? 4 : 0);
// ---- the bow: draw while held, loose on release; arrows fly, drop, stick, and can be picked up again
const arrows = [];
const UPV = new THREE.Vector3(0, 1, 0);
function bowUpdate(dt) {
  const w = weapon();
  if (mouse.left && !guarding) {
    if (!ammoKey()) { if (draw === 0 && atkCd <= 0) { log('No arrows. Oswin sells them, and you can craft them from planks and iron.', 'miss'); atkCd = 1.5; } return; }
    if (draw === 0 && atkCd > 0) return;
    if (draw === 0) snd.bowDraw();
    draw = Math.min(1, draw + dt / (w.drawT || 0.8));
  } else if (draw > 0) {
    if (draw > 0.18) fireArrow(draw);
    draw = 0;
  }
}
function fireArrow(p) {
  const ammo = ammoKey(); removeItem(ammo);
  if (ammo !== 'arrows' && !count(ammo)) { S.ammo = null; log(`Out of ${itemName(ammo)}. Back to plain arrows.`, 'miss'); }
  const dir = look.clone();
  const m = new THREE.Mesh(arrowGeo, arrowMat); scene.add(m);
  const pos = eye.clone().addScaledVector(dir, 0.35); pos.y -= 0.04;
  arrows.push({ m, pos, vel: dir.multiplyScalar(14 + 36 * p), p, w: weapon(), life: 0, stuck: false, ammo });
  snd.bowShot(p); atkCd = weapon().cd;
}
function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i]; a.life += dt;
    const drop = () => { scene.remove(a.m); arrows.splice(i, 1); };
    if (a.stuck) {
      if (a.pick && Math.hypot(a.pos.x - P.pos.x, a.pos.y - (P.pos.y + 0.6), a.pos.z - P.pos.z) < 1.5) { addItem('arrows'); snd.pickup(); drop(); }
      else if (a.life > 60) drop();
      continue;
    }
    if (a.life > 6) { drop(); continue; }
    a.vel.y -= 9.8 * dt;
    const step = a.vel.length() * dt, dir = a.vel.clone().normalize();
    let hit = null, ht = step;
    for (const m of mobs) { if (m.dead || m.dist > 90) continue; const t = rayAABB(a.pos, dir, m, step); if (t >= 0 && t < ht) { ht = t; hit = m; } }
    const wh = world.raycast(a.pos, dir, step);
    if (wh && SOLID[wh.b] && wh.t <= ht) {
      a.pos.addScaledVector(dir, Math.max(0, wh.t - 0.05)); a.stuck = true; a.life = 0; a.pick = Math.random() < 0.65;
      a.m.position.copy(a.pos); a.m.quaternion.setFromUnitVectors(UPV, dir); a.m.position.addScaledVector(dir, -0.2);
      if (a.pos.distanceTo(P.pos) < 30) snd.thunk(panFor(a.pos));
      if (a.ammo === 'arrow_blast') { explode(a.pos, 3, [3, 6], 'fire'); drop(); }
      continue;
    }
    if (hit) { a.pos.addScaledVector(dir, ht); rangedHit(hit, a, a.pos.y - hit.pos.y > hit.h * 0.78); if (a.ammo === 'arrow_blast') explode(a.pos, 3, [3, 6], 'fire'); drop(); continue; }
    a.pos.addScaledVector(dir, step);
    a.m.position.copy(a.pos); a.m.quaternion.setFromUnitVectors(UPV, dir);
  }
}
function rangedHit(m, a, head) {
  const w = a.w, am = statMod('DEX');
  let adv = 0; const why = [];
  if (!m.aware || m.dormant) { adv++; why.push('unaware'); } else if (m.stagT > 0) { adv++; why.push('reeling'); }
  if (S.dread >= 80) { adv--; why.push('dread'); }
  const r1 = roll(20), r2 = roll(20), d20 = adv > 0 ? Math.max(r1, r2) : adv < 0 ? Math.min(r1, r2) : r1;
  const bonus = am + prof() + (eqItem('charm') === 'wolfcharm' ? 1 : 0), total = d20 + bonus;
  const over = m.pos.clone().add(new THREE.Vector3(0, m.h + 0.3, 0));
  m.aware = true;
  if (d20 === 1 || (d20 !== 20 && total < m.T.ac)) {
    log(`🏹 d20(${d20})${fm(bonus)} = ${total} vs AC ${m.T.ac} — the arrow glances off`, 'miss'); floater('miss', over, '#aaa'); snd.miss();
    if (m.hp >= m.maxHp && m.dormant) m.hp -= 0.01; // it felt that
    return;
  }
  const crit = d20 === 20;
  let dmg = rollDice(w.dice[0] * (crit ? 2 : 1), w.dice[1]) + Math.round(scalingBonus(rightHand()));
  if (S.cls === 'rogue' && adv > 0) dmg += rollDice(sneakDice(), 6);
  dmg += upLvl(rightHand());
  dmg = Math.max(1, Math.round(dmg * (0.4 + 0.6 * a.p) * (head ? 1.6 : 1) * (1 + 0.08 * (S.wup?.[rightHand()]?.lvl || 0))));
  if (a.ammo === 'arrow_fire') { dmg += roll(6); m.fireT = 4; }
  if (a.ammo === 'arrow_poison') m.poisonT = 7;
  if (m.hexT > 0) dmg = Math.round(dmg * 1.5);
  dmg = giantArmour(m, dmg);
  log(`🏹 d20(${d20})${fm(bonus)} = ${total} vs AC ${m.T.ac} — ${head ? '<b>HEADSHOT</b> ' : crit ? '<b>CRITICAL</b> ' : ''}hit for <b>${dmg}</b>${a.p < 0.6 ? ' <i>(weak draw)</i>' : ''}`, 'hit');
  floater((head ? '◎ ' : '') + dmg, over, head ? '#ffd24a' : '#ffb27a'); snd.hit();
  m.hp -= dmg; m.hurtT = 1;
  const kl = Math.hypot(a.vel.x, a.vel.z) || 1; m.vel.x += a.vel.x / kl * 2.5; m.vel.z += a.vel.z / kl * 2.5;
  if (!checkBroken(m) && m.hp <= 0) killMob(m);
}
// ================================================================ the Hunter's systems: magic, the forge, status, maps, notes, the colony
// ---- magic: a sigil in the left hand, three prepared workings, Lumen drawn from what you kill
const SPELLS = {
  mend: { name: 'Mend', icon: '✚', cost: 8, cd: 1.2, desc: 'Knit flesh with old light: heal 2d6 + your spell modifier, and draw out poison.' },
  fireball: { name: 'Cinder Bolt', icon: '🔥', cost: 10, cd: 1.0, desc: 'Hurl forge-fire that bursts on impact: 3d6 in a small blast, setting things alight.' },
  blast: { name: 'Force Blast', icon: '💥', cost: 9, cd: 1.6, desc: 'A wave of raw Lumen: 2d6 to everything in front of you, hurled back and left reeling.' },
  hex: { name: 'Gloam Hex', icon: '🜏', cost: 6, cd: 1.0, desc: 'Curse the thing you look at: for 15s it takes half again as much damage and moves at half speed.' },
  ward: { name: 'Ember Ward', icon: '☀', cost: 14, cd: 3, desc: 'A ring of old light around you for 20s: night-things inside it burn, and dread drains away.' },
};
const maxAether = () => 30 + S.level * 2 + Math.max(0, Math.max(statMod('INT'), statMod('WIS'))) * 6;
const spellMod = () => Math.max(statMod('INT'), statMod('WIS'));
function unlockMagic(quiet) {
  S.spells = S.spells?.length ? S.spells : ['mend', 'fireball'];
  S.spellSlots ??= ['mend', 'fireball', null]; S.spellSel ??= 0; S.aether = maxAether();
  if (!count('sigil')) addItem('sigil');
  S.eq.lh = 'sigil'; renderHotbar();
  if (!quiet) { msg('The Sigil wakes', 'Right mouse casts · [Z] chooses · Lumen refills as you slay the accursed', 6); hint('magic', 'Your <b>left hand</b> now holds the Sigil: <b>right mouse</b> casts, <b>Z</b> picks the spell. Want your shield back? Swap it in your pack <b>[E]</b>.', 14); }
}
function learnSpell(id) {
  S.spells ??= []; if (S.spells.includes(id)) return;
  S.spells.push(id); const e = S.spellSlots?.indexOf(null); if (S.spellSlots && e >= 0) S.spellSlots[e] = id;
  msg(`A working remembered: ${SPELLS[id].name}`, SPELLS[id].desc, 6); snd.levelup();
}
function cycleSpell() {
  if (!S.spellSlots) return;
  for (let i = 1; i <= 3; i++) { const j = (S.spellSel + i) % 3; if (S.spellSlots[j]) { S.spellSel = j; snd.place(); renderHotbar(); return; } }
}
let spellCd = 0;
function castSpell() {
  const id = S.spellSlots?.[S.spellSel], sp = SPELLS[id];
  if (!sp) { log('No spell prepared. Set your workings in the pack [E].', 'miss'); return; }
  if (spellCd > 0) return;
  if ((S.aether || 0) < sp.cost) { log(`Not enough Lumen for ${sp.name} (${sp.cost}). Slay the accursed to draw more.`, 'miss'); return; }
  S.aether -= sp.cost; spellCd = sp.cd; startSwing(0.4); snd.spell?.(id);
  if (id === 'mend') { const h = rollDice(2, 6) + spellPower() + Math.round(S.maxHp * 0.08); heal(h, `✚ Mend: 2d6 + ${h - 0} total`); S.poisonT = 0; }
  else if (id === 'fireball') { const d = look.clone(); const bo = makeBolt('fire', eye.clone().addScaledVector(d, 0.6), d.multiplyScalar(24), 'player'); bo.bonus = spellPower(); bolts.push(bo); }
  else if (id === 'blast') {
    let n = 0;
    for (const m of mobs) {
      if (m.dead || m.dist > 6) continue;
      const to = new THREE.Vector3(m.pos.x - P.pos.x, 0, m.pos.z - P.pos.z); const l = to.length() || 1; to.divideScalar(l);
      if (to.dot(new THREE.Vector3(look.x, 0, look.z).normalize()) < 0.4) continue;
      const dmg = rollDice(2, 6) + spellPower(); hurtMob(m, dmg, '#cfe6ff'); m.vel.x += to.x * 11; m.vel.z += to.z * 11; m.vel.y = 5; m.stagT = 1.5; m.dormant = false; n++;
    }
    blastFx(eye.clone().addScaledVector(look, 1.2), 0x9fd8ff); shakeT = 0.3; log(`💥 Force Blast strikes ${n} creature${n === 1 ? '' : 's'}.`, 'hit');
  } else if (id === 'hex') {
    let best = null, bt = 25;
    for (const m of mobs) { if (m.dead) continue; const t = rayAABB(eye, look, m, 25); if (t >= 0 && t < bt) { bt = t; best = m; } }
    if (!best) { log('The hex finds nothing to hold.', 'miss'); S.aether += sp.cost * 0.5; return; }
    best.hexT = 15; best.slowT = 15; best.aware = true; floater('HEXED', best.pos.clone().add(new THREE.Vector3(0, best.h + 0.4, 0)), '#b48aff'); log(`🜏 The ${best.T.name} is hexed.`, 'good');
  } else if (id === 'ward') { S.wardT = 20; log('☀ Old light rings you round.', 'good'); }
}
function updateMagic(dt) {
  spellCd -= dt;
  if (!S.flags.magic) return;
  if (calmT > 4) S.aether = Math.min(maxAether(), (S.aether || 0) + dt * 0.5);
  if (S.wardT > 0) {
    S.wardT -= dt; S.dread = Math.max(0, S.dread - dt * 6);
    S._wardTick = (S._wardTick || 0) + dt;
    if (S._wardTick > 1) { S._wardTick = 0; for (const m of mobs) if (!m.dead && m.dist < 5 && ACCURSED.has(m.type)) hurtMob(m, roll(4) + 1 + Math.round(spellPower() / 3), '#ffd98a'); }
  }
}
// ---- the forge: reinforce (+1..+5) and infuse (fire, poison, silver)
const upLvl = k => (k ? (S.wup?.[k]?.lvl || 0) : 0) + (S.wpnBonus || 0);
function infuse(m, inf) {
  if (inf === 'fire') { const d = roll(6); m.fireT = 4; return { dmg: d, txt: ` + ${d} fire` }; }
  if (inf === 'poison') { m.poisonT = 7; return { dmg: 0, txt: ' + venom' }; }
  if (inf === 'silver' && ACCURSED.has(m.type)) { const d = roll(8); return { dmg: d, txt: ` + ${d} silver` }; }
  return { dmg: 0, txt: '' };
}
const INFUSIONS = { fire: { name: 'Ember-tempered', need: { emberresin: 2 }, gold: 15 }, poison: { name: 'Venom-coated', need: { venomsac: 2 }, gold: 10 }, silver: { name: 'Silver-washed', need: { silverdust: 2 }, gold: 20 } };
function renderForge() {
  const cap = S.colony?.built?.beacon ? 10 : S.colony?.built?.forge ? 5 : 3;
  const ws = Object.keys(S.inv).filter(k => ITEMS[k]?.slot === 'rh');
  $('talkText').innerHTML = `“Every blade can be better. Bring iron for strength; bring what you cut out of the beasts for the rest.” <span class="dim">You carry ${count('gold')} gold, ${count('iron')} iron, ${count('shard')} shards.${cap < 5 ? ' (Build the colony Forge for +4 and +5.)' : ''}</span>`;
  const rows = ws.map(k => {
    const u = S.wup[k] || { lvl: 0 }, nl = u.lvl + 1, iron = nl * 2 + 1, gold = 20 * nl, shard = nl >= 3 ? nl - 2 : 0;
    const can = nl <= cap && count('iron') >= iron && count('gold') >= gold && count('shard') >= shard;
    const inf = Object.entries(INFUSIONS).map(([id, f]) => `<button data-inf="${k}|${id}" ${u.inf === id || !Object.entries(f.need).every(([a, n]) => count(a) >= n) || count('gold') < f.gold ? 'disabled' : ''} title="${Object.entries(f.need).map(([a, n]) => n + ' ' + itemName(a)).join(', ')}, ${f.gold} gold">${f.name}</button>`).join(' ');
    return `<div class="recipe"><div class="slot" style="width:38px;height:38px;font-size:20px">${itemIcon(k)}</div><div class="nm">${itemName(k)} <b>+${u.lvl}</b>${u.inf ? ` · ${INFUSIONS[u.inf].name}` : ''}
      <div class="need">${nl <= cap ? `Reinforce to +${nl}: ${iron} iron, ${gold} gold${shard ? `, ${shard} shard` : ''}` : 'At the forge\'s limit'}</div><div class="need">${inf}</div></div><button data-up="${k}" ${can ? '' : 'disabled'}>Reinforce</button></div>`;
  }).join('') || '<div class="dim">You carry no weapons.</div>';
  $('talkShop').innerHTML = `<div class="col">${rows}</div>`;
  talkOptions([{ label: 'Back', act: () => renderTalk('Anything else?') }]);
}
$('talkShop').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !talkNpc || b.disabled) return;
  if (b.dataset.up) { const k = b.dataset.up, u = S.wup[k] ||= { lvl: 0 }, nl = u.lvl + 1; removeItem('iron', nl * 2 + 1); removeItem('gold', 20 * nl); if (nl >= 3) removeItem('shard', nl - 2); u.lvl = nl; snd.hit(); log(`⚒ ${itemName(k)} reinforced to +${nl}.`, 'good'); renderForge(); }
  if (b.dataset.inf) { const [k, id] = b.dataset.inf.split('|'), f = INFUSIONS[id], u = S.wup[k] ||= { lvl: 0 }; for (const [a, n] of Object.entries(f.need)) removeItem(a, n); removeItem('gold', f.gold); u.inf = id; snd.craft(); log(`⚒ ${itemName(k)} is now ${f.name.toLowerCase()}.`, 'good'); renderForge(); }
});
// ---- status: burning, poison, hexes — on them and on you
// for a long time your weapons barely mark the Lantern-Taker
function giantArmour(m, dmg) {
  if (!m.T.giant) return dmg;
  {
    const k = S.level < 40 ? 0.12 : S.level < 100 ? 0.35 : S.level < 200 ? 0.7 : 1;
    dmg = Math.max(1, Math.round(dmg * k));
    if (k < 0.5 && !m.toldArmour) { m.toldArmour = true; log(`Your blow barely marks the ${m.T.name}. You cannot win this. <b>Run, and hide.</b>`, 'bad'); }
  }
  return dmg;
}
function hurtMob(m, dmg, col = '#ffb27a') {
  if (m.dead) return;
  if (m.hexT > 0) dmg = Math.round(dmg * 1.5);
  m.hp -= (dmg = giantArmour(m, dmg)); m.hurtT = 1; if (!(m.brokenT > 0)) m.aware = true;
  if (m.dist < 40) floater(String(dmg), m.pos.clone().add(new THREE.Vector3(0, m.h + 0.3, 0)), col);
  if (!checkBroken(m) && m.hp <= 0) killMob(m);
}
function tickMobStatus(m, dt) {
  if (m.hexT > 0) m.hexT -= dt;
  if (m.slowT > 0) m.slowT -= dt;
  if (!(m.fireT > 0) && !(m.poisonT > 0)) return;
  m.dotT = (m.dotT || 0) + dt;
  if (m.dotT < 1) return;
  m.dotT = 0;
  if (m.fireT > 0) { m.fireT -= 1; if (m.type !== 'cinder') hurtMob(m, roll(4), '#ff9a40'); }
  if (m.poisonT > 0 && !m.dead) { m.poisonT -= 1; hurtMob(m, roll(4), '#9fe08a'); }
}
function tickPlayerStatus(dt) {
  if (!(S.fireT > 0) && !(S.poisonT > 0)) return;
  S._dot = (S._dot || 0) + dt; if (S._dot < 1) return; S._dot = 0;
  if (S.fireT > 0) { S.fireT -= 1; hurtPlayer(roll(4), 'flames'); }
  if (S.poisonT > 0) { S.poisonT -= 1; hurtPlayer(1 + (roll(4) > 3 ? 1 : 0), 'mire venom'); }
}
// ---- bolts: cinder-fire from you, venom and fire from them
const bolts = [];
const boltMats = { fire: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6, 0.4) }), spit: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 0.3) }) };
const boltGeo = new THREE.SphereGeometry(0.14, 10, 8);
function makeBolt(kind, pos, vel, owner, dmg, effect) {
  const m = new THREE.Mesh(boltGeo, boltMats[kind] || boltMats.fire); m.position.copy(pos); scene.add(m);
  return { m, pos, vel, owner, kind, dmg, effect, life: 0 };
}
function explode(pos, R, dice, effect, bonus = 0) {
  blastFx(pos, effect === 'fire' ? 0xffa040 : 0x9fd8ff);
  if (pos.distanceTo(P.pos) < 30) { snd.boom?.(); shakeT = Math.max(shakeT, clamp(0.5 - pos.distanceTo(P.pos) / 30, 0, 0.5)); }
  for (const m of mobs) {
    if (m.dead) continue;
    const d = Math.hypot(m.pos.x - pos.x, m.pos.y + m.h / 2 - pos.y, m.pos.z - pos.z);
    if (d > R + m.half) continue;
    hurtMob(m, Math.max(1, Math.round((rollDice(dice[0], dice[1]) + bonus) * (1 - d / (R + 1) * 0.5))), '#ffb050');
    if (effect === 'fire') m.fireT = 4;
    const k = (m.pos.clone().sub(pos)).setY(0).normalize(); m.vel.x += k.x * 6; m.vel.z += k.z * 6; m.vel.y = 4; m.dormant = false;
  }
}
const fxList = [];
function blastFx(pos, col) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(3), transparent: true, opacity: 0.8, depthWrite: false });
  const m = new THREE.Mesh(boltGeo, mat); m.position.copy(pos); scene.add(m); fxList.push({ m, t: 0 });
}
function updateBolts(dt) {
  for (let i = fxList.length - 1; i >= 0; i--) { const f = fxList[i]; f.t += dt; f.m.scale.setScalar(1 + f.t * 40); f.m.material.opacity = Math.max(0, 0.8 - f.t * 2.6); if (f.t > 0.32) { scene.remove(f.m); f.m.material.dispose(); fxList.splice(i, 1); } }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i]; b.life += dt;
    const kill = () => { scene.remove(b.m); bolts.splice(i, 1); };
    if (b.life > 4) { kill(); continue; }
    if (b.kind === 'spit') b.vel.y -= 6 * dt;
    const step = b.vel.length() * dt, dir = b.vel.clone().normalize();
    const wh = world.raycast(b.pos, dir, step);
    if (b.owner === 'player') {
      let hit = null, ht = step;
      for (const m of mobs) { if (m.dead || m.dist > 60) continue; const t = rayAABB(b.pos, dir, m, step); if (t >= 0 && t < ht) { ht = t; hit = m; } }
      if (hit || (wh && SOLID[wh.b] && wh.t <= step)) { b.pos.addScaledVector(dir, hit ? ht : wh.t); explode(b.pos, 2.6, [3, 6], 'fire', b.bonus || 0); kill(); continue; }
    } else {
      // venom and fire from the accursed: dodge through it, block it with a shield, or eat it
      const pc = new THREE.Vector3(P.pos.x, P.pos.y + 0.9, P.pos.z);
      if (b.pos.distanceTo(pc) < 0.75) {
        const T = b.src?.T;
        if (dodgeT > 0) { floater('dodged', pc.clone().setY(pc.y + 1.2), '#cfe6ff'); kill(); continue; }
        const front = (-(b.vel.x) * -Math.sin(yaw) + -(b.vel.z) * -Math.cos(yaw)) / (b.vel.length() || 1) > 0.3;
        let dmg = Math.round((rollDice(b.dmg[0], b.dmg[1]) + b.dmg[2]) * (b.mul || 1));
        if (guarding && front && offHand() && offHand() !== 'sigil') { dmg = Math.max(0, Math.round(dmg * 0.25)); snd.block(); log(`🛡 You catch the ${b.kind === 'spit' ? 'venom' : 'fire'} on your shield.`, 'miss'); }
        else { if (b.effect === 'poison') S.poisonT = Math.max(S.poisonT || 0, 6); if (b.effect === 'burn') S.fireT = Math.max(S.fireT || 0, 3); }
        if (dmg) { log(`${b.kind === 'spit' ? '🤢' : '🔥'} ${T ? T.name : 'Something'}'s ${b.kind === 'spit' ? 'venom' : 'fire'} hits you for <b>${dmg}</b>${b.effect === 'poison' ? ' — poisoned' : b.effect === 'burn' ? ' — burning' : ''}`, 'bad'); hurtPlayer(dmg, `a ${T ? T.name : 'bolt'}`); }
        kill(); continue;
      }
      if (wh && SOLID[wh.b] && wh.t <= step) { blastFx(b.pos, b.kind === 'spit' ? 0x9fe060 : 0xff8030); kill(); continue; }
    }
    b.pos.addScaledVector(dir, step); b.m.position.copy(b.pos);
  }
}
function canShootFn(m) { return world.los(new THREE.Vector3(m.pos.x, m.pos.y + m.h * 0.8, m.pos.z), eye); }
function mobShootFn(m) {
  const R = m.T.ranged, from = new THREE.Vector3(m.pos.x, m.pos.y + m.h * 0.82, m.pos.z);
  const tgt = new THREE.Vector3(P.pos.x + P.vel.x * 0.3, P.pos.y + 1.0, P.pos.z + P.vel.z * 0.3);
  const d = tgt.sub(from); const dist = d.length(); d.normalize();
  if (R.kind === 'spit') d.y += dist * 0.012;
  const b = makeBolt(R.kind, from, d.multiplyScalar(R.speed), 'mob', R.dmg, R.effect); b.src = m; b.mul = m.T.dmgMul || 1; bolts.push(b);
  snd.spit?.(panFor(m.pos), R.kind);
}
// ---- which accursed things walk which lands
function regionalType(x, under, night) {
  const r = regionAt(x).id, R = Math.random();
  if (r === 'mire') return R < 0.6 ? 'mirekin' : under ? 'crawler' : 'ghoul';
  if (r === 'barrens') return R < 0.5 ? 'cinder' : R < 0.8 ? 'crawler' : 'ghoul';
  if (r === 'moor' && night && R < 0.3) return 'wendigo';
  if (r === 'wood') return R < 0.6 ? 'barkkin' : under ? 'crawler' : 'ghoul';
  if (r === 'salt') return R < 0.6 ? 'drowned' : R < 0.85 ? 'ghoul' : 'crawler';
  if (r === 'frost') return R < 0.65 ? 'rimed' : 'crawler';
  return under && R < 0.45 ? 'crawler' : 'ghoul';
}
function ammoKey() { if (S.ammo && count(S.ammo)) return S.ammo; if (count('arrows')) return 'arrows'; for (const k of ['arrow_fire', 'arrow_poison', 'arrow_blast']) if (count(k)) return k; return null; }
// ---- the map: what you've seen of the land, regions, the colony, your marks
let mapBase = null, fog = null; const FOGC = 4;
function newSystems() {
  S.wup ??= {}; S.notesRead ??= []; S.colony ??= { built: {} }; S.colony.built ??= {};
  fog = new Uint8Array(Math.ceil(W / FOGC) * Math.ceil(D / FOGC));
  if (S.fogStr) for (let i = 0; i < Math.min(fog.length, S.fogStr.length); i++) fog[i] = S.fogStr.charCodeAt(i) === 49 ? 1 : 0;
  mapBase = null;
  if (S.colony.built) for (const k of Object.keys(S.colony.built)) { /* structures already live in world.changes */ }
}
const fogToStr = () => (fog ? Array.from(fog, v => (v ? '1' : '0')).join('') : '');
let exploreAcc = 0;
function exploreTick(dt) {
  exploreAcc -= dt; if (exploreAcc > 0 || !fog) return; exploreAcc = 0.5;
  const fw = Math.ceil(W / FOGC), R = 30 / FOGC, cx = P.pos.x / FOGC, cz = P.pos.z / FOGC;
  for (let z = Math.floor(cz - R); z <= cz + R; z++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
    if (x < 0 || z < 0 || x >= fw || z * FOGC >= D) continue;
    if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= R) fog[x + z * fw] = 1;
  }
  const reg = regionAt(P.pos.x);
  if (S.lastRegion !== reg.id) { if (S.lastRegion) msg(reg.name, reg.id === 'mire' ? 'The air is warm and wet and smells of rot and flowers.' : reg.id === 'barrens' ? 'Ash falls like snow. The ground is warm underfoot.' : reg.id === 'moor' ? 'Pines, wind, and something tall between them.' : reg.id === 'wood' ? 'Black trees, and moss hanging like hair. It is dark here at noon.' : reg.id === 'salt' ? 'A sea went away here and left its bed behind. There are ships on it.' : reg.id === 'frost' ? 'Snow, and a bell somewhere above you that nobody is ringing.' : 'The vale of the old kingdom.', 4); S.lastRegion = reg.id; }
}
function buildMapBase() {
  const c = document.createElement('canvas'); c.width = W; c.height = D; const g = c.getContext('2d'), im = g.createImageData(W, D);
  const col = { [B.GRASS]: [62, 70, 40], [B.DIRT]: [80, 62, 44], [B.MUD]: [58, 50, 40], [B.STONE]: [96, 94, 90], [B.ASH]: [118, 112, 104], [B.BASALT]: [52, 50, 56], [B.BRICK]: [140, 132, 118], [B.MOSSY]: [100, 112, 80], [B.CRACKED]: [128, 120, 108], [B.COBBLE]: [110, 104, 96], [B.SLATE]: [70, 74, 84], [B.LEAVES]: [36, 52, 34], [B.MIRECAP]: [110, 70, 130], [B.STALK]: [150, 144, 126], [B.GRAVEL]: [104, 98, 90], [B.PLANKS]: [110, 82, 52], [B.LOG]: [80, 60, 40], [B.DEADWOOD]: [70, 60, 50], [B.EMBERVENT]: [220, 110, 40], [B.SAND]: [132, 124, 108], [B.SALT]: [206, 202, 194], [B.SNOW]: [210, 216, 226], [B.ICE]: [60, 86, 104], [B.BLACKBARK]: [44, 38, 34], [B.GLOOMLEAF]: [26, 40, 34] };
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const t = world.topSolid(x, z), b = world.get(x, t, z), c3 = col[b] || [90, 84, 76];
    const sh = 0.55 + (t - 20) / 60 + (x > 0 ? (t - world.topSolid(x - 1, z)) * 0.06 : 0);
    const o = (x + z * W) * 4; im.data[o] = c3[0] * sh; im.data[o + 1] = c3[1] * sh; im.data[o + 2] = c3[2] * sh; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0); return c;
}
function openMap() {
  if (ui !== 'none' && ui !== 'map') return;
  if (ui === 'map') { closeMap(); return; }
  ui = 'map'; mouse.left = false; draw = 0; guarding = false;
  if (document.pointerLockElement) document.exitPointerLock();
  if (!mapBase) mapBase = buildMapBase();
  show('mapScr'); drawMap();
}
function closeMap() { ui = 'none'; show(null); requestLock(); }
function drawMap() {
  const cv = $('mapC'), sc = Math.max(1, Math.floor(Math.min((innerWidth - 60) / W, (innerHeight - 150) / D) * 2) / 2);
  cv.width = W * sc; cv.height = D * sc; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(mapBase, 0, 0, W * sc, D * sc);
  const fw = Math.ceil(W / FOGC);
  g.fillStyle = '#0c0a08';
  for (let z = 0; z < Math.ceil(D / FOGC); z++) for (let x = 0; x < fw; x++) if (!fog[x + z * fw]) g.fillRect(x * FOGC * sc, z * FOGC * sc, FOGC * sc + 0.5, FOGC * sc + 0.5);
  g.font = `bold ${Math.max(12, 7 * sc)}px Cinzel, serif`; g.textAlign = 'center';
  for (const r of REGIONS) {
    let seen = false; for (let z = 0; z < Math.ceil(D / FOGC) && !seen; z++) for (let x = Math.floor(r.x0 / FOGC); x < Math.ceil(r.x1 / FOGC) && !seen; x++) if (fog[x + z * fw]) seen = true;
    if (!seen) continue;
    g.fillStyle = 'rgba(232,220,196,.75)'; g.fillText(r.name, (r.x0 + r.x1) / 2 * sc, 14 * sc);
  }
  const mark = (p, txt, colr, size = 16) => { if (!p) return; g.font = `${size}px serif`; g.fillStyle = colr; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText(txt, p.x * sc, p.z * sc + size * 0.35); g.fillText(txt, p.x * sc, p.z * sc + size * 0.35); };
  mark({ x: world.camp.x, z: world.camp.z }, '⌂', '#ffd98a', 22);
  for (const id of S.notesRead) mark(notePos(id), '✉', '#e8dcc4', 14);
  mark(wpTarget, '◆', '#ffd98a'); mark(wp2Target, '◇', '#b8d8ff');
  // you
  g.save(); g.translate(P.pos.x * sc, P.pos.z * sc); g.rotate(-yaw); g.fillStyle = '#ff6a4a'; g.strokeStyle = '#000'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.stroke(); g.fill(); g.restore();
  $('mapInfo').innerHTML = `${regionAt(P.pos.x).name} · ⌂ ${colonyRank()} · ✉ ${concordRead()} / ${CONCORD_NOTES.length} writings of the Concord · ☀ ${S.mercy || 0} returned · [M] or [Esc] to close`;
}
// ---- the notes of the vanished, and your journal of them
function openNote(id, fresh) {
  const n = NOTES[id]; if (!n) return;
  const text = typeof n.text === 'function' ? n.text(S) : n.text;
  if (fresh && !S.notesRead.includes(id)) { S.notesRead.push(id); gainXP(30, 'lore'); log(`✉ Journal: <b>${n.title}</b>`, 'lore'); snd.chest(); }
  ui = 'note'; mouse.left = false; if (document.pointerLockElement) document.exitPointerLock();
  $('noteBody').innerHTML = `<div class="nt">${escapeHTML(n.title)}</div><div class="nw">— ${escapeHTML(n.where)} —</div>${text.split('\n\n').map(p => `<p>${escapeHTML(p).replace(/\n/g, '<br>')}</p>`).join('')}`;
  $('noteList').innerHTML = ''; show('noteScr');
}
function openJournal() {
  if (ui !== 'none') return;
  ui = 'note'; mouse.left = false; if (document.pointerLockElement) document.exitPointerLock();
  $('noteBody').innerHTML = `<div class="nt">Journal</div><div class="nw">— ${concordRead()} of ${CONCORD_NOTES.length} writings of the Concord · ☀ ${S.mercy || 0} returned · ☠ ${S.slain || 0} slain —</div>${S.notesRead.length ? '<p>Your own entries are marked 📓. The rest are the words of the ones who were here before.</p>' : '<p>Nothing yet. The ones who were here before wrote things down; look for weathered pages in the ruins, the mire and the barrens.</p>'}`;
  $('noteList').innerHTML = (S.names?.length ? `<button data-note="names">☀ The Book of the Returned (${S.names.length})</button>` : '') + S.notesRead.filter(id => NOTES[id]).map(id => `<button data-note="${id}">${NOTES[id].mine ? '📓' : '✉'} ${escapeHTML(NOTES[id].title)}</button>`).join('');
  show('noteScr');
}
const CONCORD_NOTES = Object.keys(NOTES).filter(k => !NOTES[k].mine && !NOTES[k].company);
const concordRead = () => S.notesRead.filter(id => NOTES[id] && !NOTES[id].mine).length;
// each chapter, the hunter writes something down
function journalEntry(id) {
  if (!NOTES[id] || S.notesRead.includes(id)) return;
  S.notesRead.push(id); log(`📓 A new entry in your journal: <b>${NOTES[id].title}</b> [J]`, 'lore');
}
function closeNote() { ui = 'none'; show(null); requestLock(); }
$('noteList').addEventListener('click', e => { const b = e.target.closest('button'); if (b) openNote(b.dataset.note, false); });
$('noteClose').onclick = closeNote;
$('mapClose').onclick = closeMap;
addEventListener('keydown', e => {
  if (ui === 'note' && (e.code === 'Escape' || e.code === 'KeyJ' || e.code === 'KeyE')) closeNote();
  else if (ui === 'map' && (e.code === 'Escape')) closeMap();
});
// ---- the colony: projects that turn a landing into a home, and the nights they come for it
const camp = () => world.camp;
function colonySafe(x, z) { const c = camp(), d = Math.hypot(x - c.x, z - c.z); return d < 20 || (S.colony?.built?.lamps && d < 45) || (S.colony?.built?.beacon && d < 70); }
function colonyRank() { const n = Object.keys(S.colony?.built || {}).length; return S.colony?.built?.beacon ? 'Permanent Colony' : n >= 5 ? 'Stronghold' : n >= 3 ? 'Settlement' : n >= 1 ? 'Outpost' : 'Temporary Landing'; }
const PROJECTS = {
  palisade: { name: 'Stone Palisade', need: { b10: 40, b7: 12 }, desc: 'A ring wall of rubblestone with two gates. Raids are smaller, and they have to come through the gates.' },
  watchtower: { name: 'Watchtower', need: { b10: 20, b7: 10, iron: 2 }, desc: 'A lookout over the north road. You are warned of raids at dusk, and fewer come.' },
  lamps: { name: 'Lumen Lamps', need: { b12: 8, b13: 6, iron: 3 }, desc: 'Lamp posts out along the roads. Nothing spawns in the dark within 45 blocks of the Landing.' },
  forge: { name: 'Colony Forge', need: { iron: 8, b10: 12, coal: 10 }, desc: 'A proper forge for Tamsin. Weapons can be reinforced to +4 and +5.' },
  infirmary: { name: 'Infirmary', need: { b7: 16, herb: 6 }, desc: 'Beds and clean linen. Brother Aldric tends you for free, and every rest cures poison and dread.' },
  beacon: { name: 'The Lumen Beacon', need: { lumencore: 1, shard: 8, gold: 100 }, needs: ['palisade'], desc: 'Set the Lumen Core burning at the heart of the Landing. No raid will ever come again, and nothing accursed walks within 70 blocks. Emberfall becomes a colony.' },
};
function renderColony() {
  const tierBtn = S.flags.boss_astronomer && S.colony.built.beacon ? `<div class="recipe"><div class="nm"><b>Deepen the Gloam</b> — tier ${S.tier || 0} → ${(S.tier || 0) + 1}<div class="need">Turn the Beacon down into the dark beneath the Lumen. Every creature in the land rises by 40 levels, and pays in kind. There is no going back.</div></div><button data-tier="1">Deepen</button></div>` : '';
  setTimeout(() => { const tb = $('talkShop').querySelector('button[data-tier]'); if (tb) tb.onclick = () => { S.tier = (S.tier || 0) + 1; msg(`Gloam tier ${S.tier}`, 'The dark beneath the light stirs. Everything out there is stronger now.', 6); snd.stinger(); renderColony(); }; }, 0);
  $('talkText').innerHTML = `“Every stone we raise is a night we sleep. Bring what's needed and the colonists will build it.” <span class="dim">Emberfall: <b>${colonyRank()}</b></span>`;
  $('talkShop').innerHTML = `<div class="col">${Object.entries(PROJECTS).map(([id, p]) => {
    const built = S.colony.built[id], ok = !built && Object.entries(p.need).every(([k, n]) => count(k) >= n) && (p.needs || []).every(r => S.colony.built[r]);
    return `<div class="recipe"><div class="nm">${built ? '✔ ' : ''}<b>${p.name}</b><div class="need">${p.desc}</div><div class="need">${built ? 'Built.' : Object.entries(p.need).map(([k, n]) => `<span class="${count(k) >= n ? '' : 'lack'}">${n} ${itemName(k)} (${count(k)})</span>`).join(', ')}${p.needs && !built ? ' · needs the Palisade' : ''}</div></div><button data-proj="${id}" ${ok ? '' : 'disabled'}>Build</button></div>`;
  }).join('')}${tierBtn}</div>`;
  talkOptions([{ label: 'Back', act: () => renderTalk('The fire is the point. Keep it lit.') }]);
}
$('talkShop').addEventListener('click', e => {
  const b = e.target.closest('button[data-proj]'); if (!b || b.disabled) return;
  const id = b.dataset.proj, p = PROJECTS[id];
  for (const [k, n] of Object.entries(p.need)) removeItem(k, n);
  S.colony.built[id] = true; buildProject(id); snd.levelup(); fadeFlash(400); gainXP(80, p.name);
  msg(p.name + ' raised', id === 'beacon' ? 'Emberfall is no longer a landing. It is a colony.' : `Emberfall is now: ${colonyRank()}`, 6);
  if (id === 'beacon') { endRaid(true); setTimeout(() => openNote('home', true), 2500); }
  renderColony(); saveGame();
});
// lay out a project's stones around the camp (one relight for the lot)
function buildProject(id) {
  const c = camp(), cx = c.x, cz = c.z, y0 = c.y, list = [];
  const put = (x, y, z, b) => list.push([x, y, z, b]);
  const ground = (x, z) => { let y = world.topSolid(x, z); while (y > y0 + 3) y--; return y; };
  if (id === 'palisade') {
    for (let a = 0; a < 360; a += 1.2) {
      const x = Math.round(cx + Math.cos(a * Math.PI / 180) * 17), z = Math.round(cz + Math.sin(a * Math.PI / 180) * 17);
      if (Math.abs(x - cx) <= 2 && Math.abs(z - cz) > 10) continue; // north and south gates
      const g = Math.min(ground(x, z), y0); for (let y = g + 1; y <= y0 + 3; y++) put(x, y, z, y === y0 + 3 && (x + z) % 2 ? B.AIR : B.COBBLE);
    }
    for (const s of [-1, 1]) for (const dx of [-3, 3]) { for (let y = y0; y <= y0 + 4; y++) put(cx + dx, y, cz + s * 17, B.COBBLE); put(cx + dx, y0 + 5, cz + s * 17, B.TORCH); }
  } else if (id === 'watchtower') {
    const tx = cx + 12, tz = cz - 13, g = ground(tx, tz);
    for (let y = g + 1; y <= y0 + 9; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(tx + dx, y, tz + dz, (dx || dz) ? (y % 3 ? B.COBBLE : B.LOG) : (y < y0 + 9 ? B.AIR : B.PLANKS));
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) put(tx + dx, y0 + 10, tz + dz, B.PLANKS);
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) put(tx + dx, y0 + 11, tz + dz, B.TORCH);
  } else if (id === 'lamps') {
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, r = 30 + (k % 2) * 8, x = Math.round(cx + Math.cos(a) * r), z = Math.round(cz + Math.sin(a) * r);
      if (x < 2 || z < 2 || x >= W - 2 || z >= D - 2) continue;
      const g = world.topSolid(x, z); put(x, g + 1, z, B.COBBLE); put(x, g + 2, z, B.COBBLE); put(x, g + 3, z, B.GLOWCAP);
    }
    for (let z = cz - 60; z < cz - 18; z += 8) { const g = world.topSolid(cx + 3, z); put(cx + 3, g + 1, z, B.COBBLE); put(cx + 3, g + 2, z, B.TORCH); }
  } else if (id === 'forge') {
    const fx = cx + 9, fz = cz - 6;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 2; dx++) put(fx + dx, y0, fz + dz, B.COBBLE);
    for (const dx of [-1, 2]) for (let y = y0 + 1; y <= y0 + 3; y++) put(fx + dx, y, fz - 1, B.COBBLE);
    put(fx, y0 + 1, fz, B.CAMPFIRE); put(fx + 1, y0 + 1, fz, B.CAMPFIRE);
    for (let dx = -1; dx <= 2; dx++) put(fx + dx, y0 + 4, fz - 1, B.SLATE);
  } else if (id === 'infirmary') {
    const hx = cx - 13, hz = cz + 4;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -2; dx <= 2; dx++) for (let y = y0 + 1; y <= y0 + 4; y++) {
      const edge = Math.abs(dx) === 2 || Math.abs(dz) === 3;
      put(hx + dx, y, hz + dz, y === y0 + 4 ? B.SLATE : edge ? ((dx === 2 && dz === 0 && y < y0 + 3) ? B.AIR : B.PLANKS) : B.AIR);
    }
    put(hx, y0 + 1, hz - 2, B.CANDLES);
  } else if (id === 'beacon') {
    const bx = cx, bz = cz + 7;
    for (let y = y0 + 1; y <= y0 + 7; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!(dx && dz) || y < y0 + 3) put(bx + dx, y, bz + dz, B.BRICK);
    put(bx, y0 + 8, bz, B.CAMPFIRE); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(bx + dx, y0 + 8, bz + dz, B.GLOWCAP);
  }
  if (!list.length) return;
  let x0 = W, x1 = 0, z0 = D, z1 = 0;
  for (const [x, y, z, b] of list) {
    if (x < 1 || z < 1 || x >= W - 1 || z >= D - 1 || y < 1 || y >= H - 1) continue;
    const i = world.idx(x, y, z); world.blocks[i] = b; world.changes.set(i, b);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  world.relight(x0 - 16, z0 - 16, x1 + 16, z1 + 16);
  for (let cz2 = Math.max(0, Math.floor((z0 - 16) / 16)); cz2 <= Math.min(NCZ - 1, Math.floor((z1 + 16) / 16)); cz2++)
    for (let cx2 = Math.max(0, Math.floor((x0 - 16) / 16)); cx2 <= Math.min(NCX - 1, Math.floor((x1 + 16) / 16)); cx2++) dirty.add(cx2 + cz2 * NCX);
  mapBase = null;
}
// raids: on the colony's dark nights the accursed come for the fire
function updateRaid(dt) {
  if (S.colony?.built?.beacon || S.day < 2) return;
  const raidNight = S.day % 3 === 0 || (S.day >= 6 && S.day % 2 === 0);
  if (S.colony.built.watchtower && raidNight && prevT < 0.5 && S.time >= 0.5 && !S.raidWarned) { S.raidWarned = true; msg('The watch calls out', 'Shapes on the north road. They will come for the Landing tonight.', 5); }
  if (raidNight && !S.raid?.active && S.raid?.day !== S.day && S.time > 0.66 && S.time < 0.9) startRaid();
  if (S.raid?.active) {
    // march on the fire — through a gate, if the wall is up
    const c = camp();
    for (const m of mobs) if (m.raider && !m.dead) {
      const d = Math.hypot(m.pos.x - c.x, m.pos.z - c.z);
      if (S.colony.built.palisade && d > 18.5) {
        // skirt the wall to the nearer gate (north or south), then go in
        const a = Math.atan2(m.pos.z - c.z, m.pos.x - c.x), ga = a < 0 ? -Math.PI / 2 : Math.PI / 2;
        let da = ga - a; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < 0.18) m.goal = { x: c.x + 0.5, z: c.z + 0.5 };
        else { const na = a + Math.sign(da) * Math.min(Math.abs(da), 0.5); m.goal = { x: c.x + Math.cos(na) * 22, z: c.z + Math.sin(na) * 22 }; }
      } else m.goal = { x: c.x + 0.5, z: c.z + 0.5 };
    }
    const left = mobs.filter(m => m.raider && !m.dead).length;
    if (left === 0 && S.raid.spawned >= S.raid.total) endRaid(false);
  }
}
function startRaid() {
  const c = camp(), total = clamp(4 + Math.floor(S.day / 2) - (S.colony.built.palisade ? 2 : 0) - (S.colony.built.watchtower ? 1 : 0), 3, 11);
  S.raid = { active: true, day: S.day, total, killed: 0, spawned: 0 };
  msg('They are coming for the Landing', 'Defend the fire. Guards will fight beside you.', 5.5); snd.stinger(); S.dread = Math.min(100, S.dread + 15);
  hint('raid', 'A <b>raid</b>: the accursed march on the colony. Kill them before they reach the fire — the more you stop, the less the colony loses.', 10);
  for (let k = 0; k < total; k++) {
    for (let a = 0; a < 12; a++) {
      const ang = Math.random() * Math.PI * 2, r = 34 + Math.random() * 8, x = Math.floor(c.x + Math.cos(ang) * r), z = Math.floor(c.z + Math.sin(ang) * r);
      if (x < 2 || z < 2 || x >= W - 2 || z >= D - 2) continue;
      const y = world.topSolid(x, z) + 1;
      const t = S.day >= 6 && Math.random() < 0.25 ? 'wendigo' : Math.random() < 0.3 ? 'crawler' : 'ghoul';
      const m = spawnMob(t, x + 0.5, y, z + 0.5); m.raider = true; m.goal = { x: c.x + 0.5, z: c.z + 0.5 }; S.raid.spawned++;
      break;
    }
  }
}
function endRaid(dawn) {
  const r = S.raid; if (!r?.active) return;
  r.active = false; S.raidWarned = false;
  for (const m of mobs.slice()) if (m.raider) removeMob(m);
  if (r.killed >= Math.ceil(r.total * 0.6)) {
    const g = 10 + r.total * 4; addItem('gold', g); gainXP(40 + r.total * 15, 'defending the colony');
    msg('The Landing held', `${r.killed} of ${r.total} raiders fell. The colonists give you ${g} gold.`, 5);
  } else {
    const lost = Math.min(count('gold'), 10 + r.total * 3); if (lost) removeItem('gold', lost);
    msg('The Landing was overrun', `Only ${r.killed} of ${r.total} raiders fell. Stores were ransacked — ${lost} gold lost.`, 5);
  }
  void dawn;
}
// [Tab]: trade the shield and the Sigil between your left hand and your pack
function swapOffhand() {
  const cur = offHand(), shields = ['towershield', 'shield'].filter(k => count(k));
  let next;
  if (cur === 'sigil') next = (S.eq.lhAlt && count(S.eq.lhAlt) && S.eq.lhAlt !== 'sigil') ? S.eq.lhAlt : shields[0];
  else next = count('sigil') ? 'sigil' : null;
  if (!next) { log(cur === 'sigil' ? 'You have no shield to take up.' : 'You have no Sigil yet.', 'miss'); return; }
  if (cur) S.eq.lhAlt = cur;
  S.eq.lh = next; guarding = false; snd.place(); renderHotbar();
  log(next === 'sigil' ? 'You take up the Sigil. [RMB] casts.' : `You take up the ${itemName(next)}. [RMB] guards.`, 'miss');
}
function swapWeapon() {
  const o = 1 - S.eq.rhSel, k = S.eq.rh[o];
  if (!k || !count(k)) { log('Nothing in your other weapon slot. Set one in your pack [E].', 'miss'); return; }
  S.eq.rhSel = o; draw = 0; atkCd = Math.max(atkCd, 0.4); snd.place(); log(`You ready the ${itemName(k)}.`, 'miss'); renderHotbar();
}
const BELTABLE = k => k === 'healing' || k === 'elixir' || k === 'lumendraught' || k === 'oil' || (typeof k === 'string' && k.startsWith('arrow_'));
function useBelt() {
  const k = S.belt[S.beltSel];
  if (!k || !count(k)) { log('That belt slot is empty. Press [X] to cycle, or set items in your pack [E].', 'miss'); return; }
  if (k === 'healing') quaff();
  else if (k === 'elixir') { if (S.nvT > 0 || S.gogOn) { log('Your eyes are already open to the dark. [G] to close them.', 'miss'); return; } removeItem('elixir'); S.nvT = 120; snd.drink(); log('You drink the Nightshade Elixir. The dark peels open in shades of green. [G] ends it early.', 'good'); }
  else if (k === 'lumendraught') drinkLumen();
  else if (k.startsWith('arrow_') || k === 'arrows') { S.ammo = k === 'arrows' ? null : k; snd.place(); log(`You nock ${itemName(k)}.`, 'good'); }
  else if (k === 'oil') { if (S.cls === 'cleric') { log('Your lantern burns by prayer, not oil.', 'miss'); return; } removeItem('oil'); S.oilT += 150; snd.lantern(true); log('You top up the lantern.', 'good'); }
}
function drinkLumen() {
  if (!S.flags.magic) { log('The draught glows in the bottle, but without the Sigil you have nothing to hold its light.', 'miss'); return; }
  const mx = maxAether(), cur = S.aether || 0;
  if (cur >= mx) { log('Your Lumen is already full.', 'miss'); return; }
  const g = Math.min(mx - cur, Math.max(40, Math.round(mx / 3)));
  removeItem('lumendraught'); S.aether = cur + g; snd.drink();
  floater(`+${g} Lumen`, P.pos.clone().add(new THREE.Vector3(0, 2, 0)), '#9fd8ff', 1.1);
  log(`You drink the Lumen Draught. Cold light runs down your arms into the Sigil: <b>+${g} Lumen</b>.`, 'good');
}
function cycleBelt() {
  // anything you carry that belongs on the belt goes onto it, if there's room
  for (const k of Object.keys(S.inv)) if (BELTABLE(k) && count(k) && !S.belt.includes(k)) { const e = S.belt.findIndex(b => !b || !count(b)); if (e >= 0) S.belt[e] = k; }
  for (let i = 1; i <= 4; i++) {
    const j = (S.beltSel + i) % 4;
    if (S.belt[j] && count(S.belt[j])) { S.beltSel = j; snd.place(); renderHotbar(); log(`Belt: <b>${itemName(S.belt[j])}</b> ×${count(S.belt[j])} — [Q] to use`, 'miss'); return; }
  }
  log(S.belt.some(b => b && count(b)) ? 'That is the only thing on your belt.' : 'Your belt is empty. Potions, oil and special arrows go there.', 'miss');
}
function setBuild(on) { S.build = on; renderHotbar(); }
function migrateLoadout() {
  if (S.eq) return;
  S.eq = { rh: [null, null], rhSel: 0, lh: null, head: null, chest: null, hands: null, legs: null, charm: null };
  S.belt = [null, null, null, null]; S.beltSel = 0; S.build = false;
  const weapons = Object.keys(S.inv).filter(k => ITEMS[k]?.slot === 'rh').sort((a, b) => ITEMS[b].weapon.dice[0] * ITEMS[b].weapon.dice[1] - ITEMS[a].weapon.dice[0] * ITEMS[a].weapon.dice[1]);
  S.eq.rh = [weapons[0] || null, weapons[1] || null];
  for (const k of Object.keys(S.inv)) { const it = ITEMS[k]; if (it?.slot && it.slot !== 'rh' && !S.eq[it.slot]) S.eq[it.slot] = k; }
  for (const k of ['healing', 'elixir', 'lumendraught', 'oil']) if (count(k) && S.belt.includes(null)) S.belt[S.belt.indexOf(null)] = k;
  S.hotbar = S.hotbar.map(k => (k && isBlk(k) ? k : null));
}
const sunAt = t => t < 0.55 ? 1 : t < 0.6 ? 1 - smooth((t - 0.55) / 0.05) : t < 0.97 ? 0 : smooth((t - 0.97) / 0.03);
function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
const isWhisperNight = () => S.day % 3 === 0;
const dayLenSec = () => S.dayMin * 60;

// ================================================================ inventory
const count = k => S.inv[k] || 0;
function addItem(k, n = 1) {
  if (k.startsWith('tome_')) { learnSpell(k.slice(5)); return; }
  const had = count(k);
  S.inv[k] = had + n;
  // blocks go to the crafting hotbar, potions to the belt, gear into empty loadout slots
  if (isBlk(k) && !S.hotbar.includes(k)) { const e = S.hotbar.indexOf(null); if (e >= 0) S.hotbar[e] = k; }
  if (S.eq) {
    if (BELTABLE(k) && !S.belt.includes(k)) { const e = S.belt.findIndex(b => !b || !count(b)); if (e >= 0) S.belt[e] = k; }
    const it = ITEMS[k];
    if (!had && it?.slot) {
      const free = it.slot === 'rh' ? S.eq.rh.some(r => !r || !count(r)) : !eqItem(it.slot);
      if (free) { equip(k); if (state === 'play') log(`Equipped: <b>${it.name}</b>.`, 'good'); }
      else if (state === 'play' && it.slot === 'rh' && !buying) log(`<b>${it.name}</b> is in your pack — open [I] and click it to wield it.`, 'good');
    }
  }
  if (k === 'b5') S.flags.wood = true;
  renderHotbar();
}
function removeItem(k, n = 1) {
  S.inv[k] = Math.max(0, count(k) - n);
  if (!S.inv[k]) { delete S.inv[k]; const i = S.hotbar.indexOf(k); if (i >= 0) S.hotbar[i] = null; }
  renderHotbar();
}
const itemName = k => isBlk(k) && BLOCKS[+k.slice(1)] ? BLOCKS[+k.slice(1)].name : (ITEMS[k]?.name || k);
const itemIcon = k => isBlk(k) && tileURL[+k.slice(1)] ? `<img src="${tileURL[+k.slice(1)]}" alt="">` : `<span>${ITEMS[k]?.icon || '?'}</span>`;
const heldKey = () => (S.build ? S.hotbar[S.sel] : null);
function weapon() { const k = rightHand(); return (k && ITEMS[k]?.weapon) ? { name: ITEMS[k].name, ...ITEMS[k].weapon } : { name: 'Fists', ...FISTS.weapon }; }

// ================================================================ messages
function log(html, cls = '') {
  const el = document.createElement('div'); el.className = cls; el.innerHTML = html;
  const L = $('log'); L.appendChild(el);
  while (L.children.length > 7) L.removeChild(L.firstChild);
  setTimeout(() => { el.style.opacity = 0; }, 9000);
  setTimeout(() => el.remove(), 10600);
}
let msgTimer = 0;
function msg(big, small = '', dur = 3.5) {
  const m = $('msg'); m.innerHTML = big + (small ? `<small>${small}</small>` : '');
  m.style.opacity = 1; clearTimeout(msgTimer); msgTimer = setTimeout(() => { m.style.opacity = 0; }, dur * 1000);
}
const floaters = [];
function floater(text, pos, color = '#fff', dur = 1.3, speech = false) {
  const el = document.createElement('div'); el.textContent = text; el.style.color = color;
  if (speech) el.className = 'speech';
  $('floaters').appendChild(el);
  floaters.push({ el, pos: pos.clone(), t: 0, dur, rise: speech ? 0.08 : 0.8 });
}
function flashHurt() { const h = $('hurt'); h.style.opacity = 1; setTimeout(() => { h.style.opacity = 0; }, 140); }
function fadeFlash(ms) { const f = $('fade'); f.style.opacity = 1; setTimeout(() => { f.style.opacity = 0; }, ms); }

// ================================================================ world loading
const tick = () => new Promise(r => setTimeout(r, 0));
function setLoad(text, frac) { $('loadText').textContent = text; $('loadFill').style.width = (frac * 100) + '%'; }
async function loadWorld(seed, save) {
  show('loading'); setLoad('Shaping the land…', 0.05); await tick();
  for (const m of chunkMeshes) if (m) { scene.remove(m); m.geometry.dispose(); }
  for (const m of mobs) m.dispose(scene);
  for (const n of npcs) n.dispose(scene);
  for (const c of crows) scene.remove(c.group);
  mobs = []; npcs = []; crows = []; postMob = []; chunkMeshes = []; dirty.clear();
  world = new World(seed); hideList = null;
  world.generate();
  setLoad('Digging the deep places…', 0.3); await tick();
  if (save) { world.applyChanges(save.changes || []); world.opened = new Set(save.opened || []); }
  setLoad('Letting the light in…', 0.4); await tick();
  world.relight(0, 0, W - 1, D - 1);
  const total = NCX * NCZ; let n = 0;
  for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) {
    buildChunk(cx + cz * NCX);
    if (++n % 12 === 0) { setLoad('Raising the world…', 0.45 + 0.55 * n / total); await tick(); }
  }
  spawnLiving();
}
// the people of Emberfall and the crows of Vharrow
function spawnLiving() {
  const C = world.camp;
  for (const [id, def] of Object.entries(NPC_DEFS)) {
    const s = C.spots[def.home];
    const n = new NPC(id, def, s[0], C.y + 0.5, s[1]);
    npcs.push(n); scene.add(n.group);
  }
  const perches = [], K = world.castle;
  for (let i = 0; i < 900 && perches.length < 60; i++) {
    const x = K.x0 + Math.floor(Math.random() * (K.x1 - K.x0)), z = K.z0 + Math.floor(Math.random() * (K.z1 - K.z0));
    const t = world.topSolid(x, z);
    if (t >= K.G + 8 && world.get(x, t + 1, z) === B.AIR && world.get(x, t + 2, z) === B.AIR) perches.push([x, t + 1, z]);
  }
  if (perches.length) for (let i = 0; i < 18; i++) { const c = new Crow(perches); crows.push(c); scene.add(c.group); }
}
function buildChunk(key) {
  const cx = key % NCX, cz = Math.floor(key / NCX);
  const g = world.buildChunk(cx, cz);
  let m = chunkMeshes[key];
  if (m) { m.geometry.dispose(); m.geometry = g; }
  else { m = chunkMeshes[key] = new THREE.Mesh(g, terrainMat); m.matrixAutoUpdate = false; scene.add(m); }
}
function setBlock(x, y, z, b) {
  const keys2 = world.setBlock(x, y, z, b);
  if (!keys2) return false;
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
  buildChunk(cx + cz * NCX); // the edited chunk now; neighbours over the next frames
  for (const k of keys2) if (k !== cx + cz * NCX) dirty.add(k);
  return true;
}

// ================================================================ start / save
function show(id) {
  for (const s of ['title', 'loading', 'pause', 'panel', 'deathScr', 'asiScr', 'talk', 'mapScr', 'noteScr']) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', !(state === 'play' && (id === null || id === 'pause' || id === 'panel' || id === 'asiScr' || id === 'talk')));
}
async function startNew() {
  snd.init();
  curSlot = +($('newSlot')?.value || 1);
  const name = ($('nameInput').value || 'Wanderer').slice(0, 20);
  S = newState(name, T.race, T.cls, finalStats());
  rechargeAll(); newSystems(); recalcHp();
  const seed = (Math.random() * 1e9) | 0;
  await loadWorld(seed, null);
  S.spawnPt = { ...world.spawn };
  P.pos.set(world.spawn.x, world.spawn.y, world.spawn.z); P.vel.set(0, 0, 0);
  yaw = 0; pitch = 0.08;
  for (const [k, n] of Object.entries(CLASSES[S.cls].kit)) addItem(k, n);
  addItem('healing', 2); addItem('oil', 2); addItem('b12', 4); addItem('pick'); S.flags.gotPick = true;
  S.beltSel = 0;
  S.lanternOn = false;
  beginPlay();
  msg('The Landing', 'Forty-one days at sea. This is where the charts end.', 6);
  log('You are the Lantern Company\'s hunter. Build, slay, protect, explore, and learn what this land was.', 'lore');
  log('Night here is <b>truly dark</b>, and what walks in it hunts by light. <b>Ctrl</b> crouches. Wardrobes and brambles hide you.', 'lore');
  setTimeout(() => openNote('voyage', true), 400);
  hint('start', '<b>Follow the ◆ marker</b> to your objective (top left).<br><b>Left mouse</b> attack · <b>Right mouse</b> talk / open / hold to <b>guard</b> · <b>C</b> dodge<br><b>Q</b> use belt item · <b>X</b> next item · <b>V</b> swap weapon · <b>F</b> lantern<br><b>E</b> equipment &amp; crafting · <b>1–9</b> / <b>B</b> crafting hotbar (build mode)', 16);
}
async function continueGame(n = 1) {
  snd.init();
  const data = readSlot(n);
  if (!data) return;
  curSlot = n;
  S = data.S;
  S.q ??= {}; S.killsBy ??= {}; S.wpnBonus ??= 0; S.postsDead ??= []; S.hints ??= {};
  migrateLoadout();
  if (!S.grit) { S.grit = true; S.maxHp += 6; S.hp += 6; }
  if (S.mainV !== 4) {
    // the campaign was rebuilt: replay from the start, letting everything already done fall away on its own
    if ((S.mainV === 2 && S.quest >= 6) || (S.mainV === 3 && S.quest >= 7)) { S.flags.magic = true; unlockMagic(true); }
    S.mainV = 4; S.quest = 0; S.mainStart = { ...S.killsBy };
  }
  if (!S.lv400) { S.lv400 = true; S.xp = 0; S.points = (S.points || 0) + Math.max(0, S.level - 1); S.tier ??= 0; }
  S.points ??= 0; S.tier ??= 0;
  if (!S.flags.gotPick) { S.flags.gotPick = true; if (!count('pick')) addItem('pick'); setTimeout(() => log('Tamsin left a <b>Prospector\'s Pick</b> in your pack. Put it in a weapon slot [E] and swap to it with [V] to dig fast.', 'good'), 1500); }
  recalcHp();
  newSystems();
  if ((data.w || 256) !== W) {
    // the world grew eastward: re-address every saved block edit and opened chest
    const conv = i => { const ow = data.w || 256, y = Math.floor(i / (ow * 256)), r = i % (ow * 256); return (r % ow) + Math.floor(r / ow) * W + y * W * D; };
    data.changes = (data.changes || []).map(([i, b]) => [conv(i), b]); data.opened = (data.opened || []).map(conv);
    if (S.fogStr) {
      const ofw = Math.ceil((data.w || 256) / FOGC), nfw = Math.ceil(W / FOGC); let t = '';
      for (let z = 0; z < Math.ceil(D / FOGC); z++) t += S.fogStr.substr(z * ofw, ofw).padEnd(nfw, '0');
      S.fogStr = t; newSystems();
    }
    setTimeout(() => msg('The world is wider', 'Past the Ashen Barrens, three old roads cut through the Cinder Wall into lands no one has mapped.', 7), 2500);
  }
  await loadWorld(data.seed, data);
  P.pos.set(data.pos[0], data.pos[1], data.pos[2]); P.vel.set(0, 0, 0);
  yaw = data.yaw || 0; pitch = 0;
  beginPlay();
  msg(`Day ${S.day}`, `Welcome back, ${S.name}.`);
}
function beginPlay() {
  state = 'play'; ui = 'none';
  airPeak = P.pos.y; prevT = S.time;
  renderHotbar(); show(null); updateHUD(true);
  if (!TEST) requestLock();
}
function saveGame() {
  if (!world || !S) return false;
  try {
    S.fogStr = fogToStr();
    const data = { v: 1, w: W, seed: world.seed, changes: [...world.changes], opened: [...world.opened], S, pos: [P.pos.x, P.pos.y, P.pos.z], yaw, at: Date.now() };
    localStorage.setItem(slotKey(curSlot), JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

// ================================================================ title screen
const T = { race: 'human', cls: 'fighter', rolls: null, rerolls: 2 };
function rollStatsArr() {
  return Array.from({ length: 6 }, () => { const d = [roll(6), roll(6), roll(6), roll(6)].sort((a, b) => b - a); return { dice: d, total: d[0] + d[1] + d[2] }; }).sort((a, b) => b.total - a.total);
}
function finalStats() {
  const out = {}; const pr = CLASSES[T.cls].prio, bonus = RACES[T.race].bonus;
  pr.forEach((k, i) => { out[k] = T.rolls[i].total + (bonus[k] || 0); });
  return out;
}
function renderTitle() {
  if (!T.rolls) T.rolls = rollStatsArr();
  $('raceList').innerHTML = Object.entries(RACES).map(([k, r]) => `<button data-race="${k}" class="${k === T.race ? 'sel' : ''}">${r.name}</button>`).join('');
  $('classList').innerHTML = Object.entries(CLASSES).map(([k, c]) => `<button data-cls="${k}" class="${k === T.cls ? 'sel' : ''}">${c.name}</button>`).join('');
  $('raceDesc').textContent = RACES[T.race].desc;
  $('classDesc').textContent = CLASSES[T.cls].desc;
  const st = finalStats(); const pr = CLASSES[T.cls].prio;
  $('statRoll').innerHTML = STATS.map(k => {
    const r = T.rolls[pr.indexOf(k)];
    return `<div class="stat"><div class="lbl">${k}</div><div class="v">${st[k]}</div><div class="m">${fm(mod(st[k]))}</div><div class="dice">${r.dice.slice(0, 3).join('+')} <s>${r.dice[3]}</s></div></div>`;
  }).join('');
  const hp = CLASSES[T.cls].hd + mod(st.CON);
  $('rerollLeft').textContent = `${T.rerolls} reroll${T.rerolls === 1 ? '' : 's'} left · starting HP ${hp} · AC ${10 + mod(st.DEX) + (T.cls === 'fighter' ? 2 : 0)}`;
  $('rerollBtn').disabled = T.rerolls <= 0;
  renderSlots();
}
// the saved hunters: continue any of them, delete one (two clicks), and choose where a new one goes
function renderSlots() {
  const rows = [], prevSel = $('newSlot')?.value;
  let firstEmpty = 0;
  for (let n = 1; n <= SLOTS_N; n++) {
    const d = readSlot(n);
    if (!d?.S) { if (!firstEmpty) firstEmpty = n; rows.push(`<div class="slotRow empty"><span class="sn">${n}</span><span class="si">— empty —</span></div>`); continue; }
    const when = d.at ? new Date(d.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    rows.push(`<div class="slotRow"><span class="sn">${n}</span><span class="si"><b>${escapeHTML(d.S.name)}</b> · level ${d.S.level} ${CLASSES[d.S.cls]?.name || ''} · day ${d.S.day}${when ? ` <span class="dim">· ${when}</span>` : ''}</span><button class="big slotGo" data-load="${n}">Continue</button><button class="slotDel" data-del="${n}">Delete</button></div>`);
  }
  const sel = prevSel || String(firstEmpty || 1);
  $('continueWrap').innerHTML = `<div class="slots">${rows.join('')}</div>
    <div class="slotNew">A new wanderer goes into slot <select id="newSlot">${Array.from({ length: SLOTS_N }, (_, i) => `<option value="${i + 1}"${String(i + 1) === sel ? ' selected' : ''}>${i + 1}${readSlot(i + 1)?.S ? ' (replaces that save)' : ''}</option>`).join('')}</select></div>`;
}
$('continueWrap').addEventListener('click', e => {
  const go = e.target.closest('[data-load]'), del = e.target.closest('[data-del]');
  if (go) continueGame(+go.dataset.load);
  else if (del) {
    if (del.dataset.sure) { try { localStorage.removeItem(slotKey(+del.dataset.del)); } catch (er) { /* ignore */ } renderSlots(); }
    else { del.dataset.sure = '1'; del.textContent = 'Really delete?'; del.classList.add('sure'); setTimeout(() => { if (del.isConnected) { delete del.dataset.sure; del.textContent = 'Delete'; del.classList.remove('sure'); } }, 3000); }
  }
});
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
$('raceList').addEventListener('click', e => { const k = e.target.dataset.race; if (k) { T.race = k; renderTitle(); } });
$('classList').addEventListener('click', e => { const k = e.target.dataset.cls; if (k) { T.cls = k; renderTitle(); } });
$('rerollBtn').onclick = () => { if (T.rerolls > 0) { T.rerolls--; T.rolls = rollStatsArr(); snd.init(); snd.dice(); renderTitle(); } };
$('beginBtn').onclick = startNew;
$('autoRes').checked = SET.autoRes; $('showFps').checked = SET.showFps;
$('autoRes').onchange = e => { SET.autoRes = e.target.checked; if (!SET.autoRes) { resScale = 1; applyPixelRatio(); } saveSettings(); };
$('showFps').onchange = e => { SET.showFps = e.target.checked; saveSettings(); };
addEventListener('keydown', e => { if (e.code === 'F3') { e.preventDefault(); SET.showFps = !SET.showFps; $('showFps').checked = SET.showFps; saveSettings(); } });
for (const id of ['quality', 'quality2']) {
  $(id).value = SET.quality;
  $(id).onchange = e => { SET.quality = e.target.value; saveSettings(); applyQuality(); $('quality').value = $('quality2').value = SET.quality; };
}
renderTitle();

// ================================================================ input
// Pointer lock: ask for raw (unaccelerated) input — it avoids Chrome's spurious jumps on Windows — and fall back if unsupported.
function requestLock() {
  const plain = () => { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* unsupported */ } };
  try {
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch(plain); else if (!p) { /* old API: no promise */ }
  } catch (e) { plain(); }
}
let lockedAt = 0, avgMove = 8;
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  lockedAt = performance.now();
  if (!locked && state === 'play' && ui === 'none' && !TEST) openPause();
});
canvas.addEventListener('click', () => { if (state === 'play' && ui === 'none' && !locked) requestLock(); });
document.addEventListener('mousemove', e => {
  if (state !== 'play' || ui !== 'none' || !locked) return;
  if (performance.now() - lockedAt < 120) return; // the first events after locking carry the cursor's jump to centre
  const mx = e.movementX, my = e.movementY, mag = Math.hypot(mx, my);
  // browsers occasionally report a single bogus huge delta; drop anything wildly larger than recent motion
  if (mag > 180 && mag > avgMove * 12) return;
  avgMove = avgMove * 0.9 + Math.min(mag, 400) * 0.1;
  const s = 0.0022 * SET.sens;
  yaw -= mx * s; pitch = clamp(pitch - my * s, -1.55, 1.55);
  if (hideSpot) { let d = yaw - hideSpot.yaw0; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw = hideSpot.yaw0 + clamp(d, -0.6, 0.6); pitch = clamp(pitch, -0.45, 0.45); }
});
canvas.addEventListener('mousedown', e => {
  if (state !== 'play' || ui !== 'none') return;
  if (!locked && !TEST) return;
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) { if (hideSpot) exitHide(); else if (wantsUse()) useAction(); else if (offHand() === 'sigil') castSpell(); else { guarding = true; guardAt = gameT; } }
});
// leaving mid-hunt by accident (Ctrl+W while crouched) asks first
addEventListener('beforeunload', e => { if (state === 'play' && !TEST) { saveGame(); e.preventDefault(); e.returnValue = ''; } });
addEventListener('mouseup', e => { if (e.button === 0) mouse.left = false; if (e.button === 2) guarding = false; });
// right mouse: use whatever you're aiming at or holding — otherwise raise your guard
function wantsUse() {
  const k = heldKey();
  if (targetNpc) return true;
  if (target && (target.b === B.CHEST || target.b === B.CAMPFIRE || target.b === B.NOTE || ((target.b === B.WARDROBE || target.b === B.HOLLOWLOG) && !S.build))) return true;
  if (k === 'elixir' || k === 'healing' || k === 'lumendraught') return true;
  if (k && isBlk(k) && target && !targetMob) return true;
  return false;
}
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => {
  if (state !== 'play' || ui !== 'none') return;
  if (!S.build) return;
  S.sel = (S.sel + (e.deltaY > 0 ? 1 : 8)) % 9; renderHotbar();
});
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (state !== 'play') return;
  if (e.code === 'KeyE' || (e.code === 'Escape' && ui === 'panel')) { if (ui === 'panel') closePanel(); else if (ui === 'none' && e.code === 'KeyE') openPanel(); return; }
  if (ui !== 'none') return;
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) { if (S.build && S.sel === n - 1) setBuild(false); else { S.sel = n - 1; setBuild(true); } } }
  if (e.code === 'KeyF') toggleLantern();
  if (e.code === 'KeyG') toggleGoggles();
  if (e.code === 'KeyR') classAbility();
  if (e.code === 'KeyT') turnUndead();
  if (e.code === 'KeyC') dodge();
  if (e.code === 'KeyQ') useBelt();
  if (e.code === 'KeyX') cycleBelt();
  if (e.code === 'KeyV') swapWeapon();
  if (e.code === 'KeyB') setBuild(!S.build);
  if (e.code === 'KeyZ') cycleSpell();
  if (e.code === 'Tab') { e.preventDefault(); swapOffhand(); }
  if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat) { e.preventDefault(); setCrouch(!crouch); }
  if (e.code === 'KeyH') riteOfReturn();
  if (e.code === 'Space' && hideSpot) exitHide();
  if (e.code === 'KeyM') openMap();
  if (e.code === 'Minus' || e.code === 'Equal') { setVol(Math.round(clamp(SET.vol + (e.code === 'Equal' ? 0.1 : -0.1), 0, 1) * 100) / 100); snd.pickup(); msg(`Volume ${Math.round(SET.vol * 100)}%`, '[-] quieter · [=] louder', 1.2); }
  if (e.code === 'KeyJ') openJournal();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.left = false; guarding = false; });

// ================================================================ pause / panel / death / asi
let pauseAt = 0;
addEventListener('keydown', e => {
  if (e.code !== 'Escape' || state !== 'play') return;
  if (ui === 'none') { e.preventDefault(); if (document.pointerLockElement) document.exitPointerLock(); else openPause(); }
  else if (ui === 'pause' && performance.now() - pauseAt > 300) { e.preventDefault(); e.stopImmediatePropagation(); ui = 'none'; show(null); requestLock(); }
}, true); // capture: decide before the map, notes and panels close themselves on the same Esc
function openPause() {
  if (ui === 'pause') return;
  ui = 'pause'; mouse.left = false; pauseAt = performance.now();
  if (document.pointerLockElement) document.exitPointerLock();
  if ($('slotNote')) $('slotNote').textContent = `Saving to slot ${curSlot}`;
  $('sens').value = SET.sens; $('vol').value = SET.vol; $('dayLen2').value = String(S.dayMin); $('saveNote').textContent = '';
  show('pause');
}
$('resumeBtn').onclick = () => { ui = 'none'; show(null); requestLock(); };
$('sens').oninput = e => { SET.sens = +e.target.value; saveSettings(); };
// volume on the title screen and in the pause menu, kept in step, with a test chime that says what the browser is doing
function setVol(v) { SET.vol = v; snd.setVolume(v); saveSettings(); for (const id of ['vol', 'volT']) if ($(id)) $(id).value = v; }
$('vol').oninput = e => setVol(+e.target.value);
if ($('volT')) { $('volT').oninput = e => setVol(+e.target.value); $('volT').value = SET.vol; }
async function testSound() {
  snd.init();
  try { await snd.ctx?.resume(); } catch (e) { /* reported below */ }
  const st = snd.state;
  if (st === 'running') { snd.levelup(); snd.hit(); }
  const txt = !snd.ctx ? 'This browser has no Web Audio.' : st === 'running' ? (SET.vol < 0.05 ? 'Playing, but the volume slider is at zero.' : 'Playing a chime now. If you hear nothing, check the tab is not muted and which speakers the browser uses.') : `The browser is holding sound back (${st}). Click the page and try again.`;
  document.querySelectorAll('.sndState').forEach(el => { el.textContent = txt; });
}
for (const id of ['sndTest', 'sndTestT']) if ($(id)) $(id).onclick = testSound;
$('dayLen2').onchange = e => { S.dayMin = +e.target.value; };
$('saveBtn').onclick = () => { $('saveNote').textContent = saveGame() ? 'Saved.' : 'Could not save (storage unavailable).'; };
$('quitBtn').onclick = () => { saveGame(); state = 'title'; ui = 'none'; T.rerolls = 2; T.rolls = null; renderTitle(); show('title'); };

let pick = null;
function openPanel() {
  ui = 'panel'; mouse.left = false; guarding = false; draw = 0; pick = null;
  try { renderPanel(); } catch (e) { console.error(e); }
  show('panel'); if (document.pointerLockElement) document.exitPointerLock();
}
function closePanel() { ui = 'none'; show(null); requestLock(); }
$('closePanel').onclick = closePanel;
$('resume').onclick = () => { if (state === 'play' && ui === 'none') requestLock(); };
function renderPanel() {
  const R = RACES[S.race], C = CLASSES[S.cls];
  const abil = [];
  if (S.cls === 'fighter') abil.push(`Second Wind (1d10+${S.level}) ${S.uses.second ? '●' : '○'}`, S.level >= 5 ? 'Extra Attack' : 'Extra Attack at level 5');
  if (S.cls === 'rogue') abil.push(`Sneak Attack ${Math.ceil(S.level / 2)}d6`, `Shadowstep ${S.uses.shadow ? '●' : '○'}`);
  if (S.cls === 'cleric') abil.push(`Cure Wounds: ${S.slots} slot(s)`, `Turn Undead ${S.uses.turn ? '●' : '○'}`, 'Light cantrip (oil-free lantern)');
  if (R.dv) abil.push(`Darkvision ${R.dv} blocks`);
  if (S.race === 'halforc') abil.push(`Relentless ${S.uses.relentless ? '●' : '○'}`);
  if (S.race === 'elf') abil.push('Fey Ancestry (no panic)');
  $('sheet').innerHTML = `<table class="sheet">
    <tr><td>Name</td><td>${escapeHTML(S.name)}</td></tr>
    <tr><td>Lineage</td><td>${R.name}</td></tr><tr><td>Calling</td><td>${C.name} ${S.level}</td></tr>
    <tr><td>Level</td><td>${S.level} / ${LEVEL_CAP}${S.tier ? ` · Gloam tier ${S.tier}` : ''}</td></tr>
    <tr><td>XP</td><td>${S.level >= LEVEL_CAP ? '—' : `${S.xp} / ${xpNeed(S.level)}`}</td></tr>
    <tr><td>Points</td><td>${S.points ? `<b style="color:#9fe0a0">${S.points} to spend</b>` : '0'}</td></tr>
    <tr><td>HP</td><td>${S.hp} / ${S.maxHp}</td></tr><tr><td>AC</td><td>${playerAC()}</td></tr>
    <tr><td>Proficiency</td><td>${fm(prof())}</td></tr>
    <tr><td>Attack rating</td><td><b>${Math.round(attackRating(rightHand()))}</b> ${rightHand() ? itemName(rightHand()) : 'Fists'} <span class="dim">(${gradeTxt(rightHand())})</span></td></tr>
    ${S.flags.magic ? `<tr><td>Spell power</td><td><b>+${spellPower()}</b> <span class="dim">(Sigil: INT A · WIS D)</span></td></tr>` : ''}
    ${STATS.map(k => `<tr><td title="${STAT_HELP[k]}">${k}</td><td>${S.stats[k]} (${fm(statMod(k))})${S.points && S.stats[k] < STAT_CAP ? ` <button class="pt" data-stat="${k}" title="${STAT_HELP[k]}">+</button> <span class="dim" style="font-size:12px">${statGain(k)}</span>` : ''}</td></tr>`).join('')}
    <tr><td>Day</td><td>${S.day}</td></tr><tr><td>Slain</td><td>${S.kills}</td></tr>
  </table><div style="margin-top:8px;color:#cdbf9f;font-size:14px">${abil.join('<br>')}${S.wpnBonus ? `<br>Weapon honed +${S.wpnBonus}` : ''}</div>
  <h3>Quests <span class="dim" style="font-family:'Crimson Pro';font-size:13px">— click one to track it</span></h3><div id="taskList">
    <div class="tq main">◆ <b>${QUESTS[S.quest].text}</b><br><span class="dim">Main story — always marked in gold</span></div>
    ${Object.keys(S.q).filter(id => questActive(id)).map(id => `<div class="tq${S.tracked === id ? ' on' : ''}" data-q="${id}">${S.tracked === id ? '◇ ' : '📜 '}<b>${SIDE_QUESTS[id].name}</b> (${NPC_DEFS[SIDE_QUESTS[id].giver].name})<br><span class="dim">${questText(SIDE_QUESTS[id], SIDE_QUESTS[id].summary)} — ${questReady(id) ? 'ready to hand in' : questProgress(id)}${sideTarget(id) ? '' : ' · no fixed place'}</span>${S.tracked === id ? '<span class="trk">TRACKED</span>' : ''}</div>`).join('') || '<div class="dim">No side quests. Talk to the people of Emberfall camp.</div>'}</div>`;
  // ---- combat: the loadout, and the gear and potions you own
  const L = equipLoad(), lc = loadClass();
  const eslot = (slot, k, label, i) => `<div class="slot eqs${k ? '' : ' empty'}" data-slot="${slot}" data-i="${i ?? ''}" title="${k ? itemName(k) + ' — click to take off' : label}">${k ? itemIcon(k) : `<span class="ph">${label}</span>`}</div>`;
  $('equip').innerHTML = `
    <div class="eqrow"><div><div class="eqh">Right hand</div>${eslot('rh', S.eq.rh[0] && count(S.eq.rh[0]) ? S.eq.rh[0] : null, 'weapon 1', 0)}${eslot('rh', S.eq.rh[1] && count(S.eq.rh[1]) ? S.eq.rh[1] : null, 'weapon 2', 1)}</div>
      <div><div class="eqh">Left hand</div>${eslot('lh', offHand(), 'shield')}</div></div>
    <div class="eqrow"><div><div class="eqh">Armour</div>${eslot('head', eqItem('head'), 'head')}${eslot('chest', eqItem('chest'), 'chest')}${eslot('hands', eqItem('hands'), 'hands')}${eslot('legs', eqItem('legs'), 'legs')}</div>
      <div><div class="eqh">Charm</div>${eslot('charm', eqItem('charm'), 'charm')}</div></div>
    ${S.spells?.length ? `<div class="eqrow"><div><div class="eqh">Prepared spells — [Z] next · click a working below to prepare it</div>${[0, 1, 2].map(i => { const sp = SPELLS[S.spellSlots[i]]; return `<div class="slot eqs${sp ? '' : ' empty'}${i === S.spellSel ? ' sel' : ''}" data-sslot="${i}" title="${sp ? sp.name + ' — ' + sp.desc : 'empty'}">${sp ? `<span>${sp.icon}</span>` : '<span class="ph">—</span>'}</div>`; }).join('')}</div>
      <div><div class="eqh">Known workings</div>${S.spells.map(id => `<div class="slot eqs" data-spell="${id}" title="${SPELLS[id].name} (${SPELLS[id].cost} Lumen) — ${SPELLS[id].desc}"><span>${SPELLS[id].icon}</span></div>`).join('')}</div></div>` : ''}
    <div class="eqrow"><div><div class="eqh">Belt — [Q] use · [X] next</div>${S.belt.map((k, i) => `<div class="slot eqs${k && count(k) ? '' : ' empty'}${i === S.beltSel ? ' sel' : ''}" data-belt="${i}">${k && count(k) ? itemIcon(k) + `<span class="n">${count(k)}</span>` : '<span class="ph">—</span>'}</div>`).join('')}</div></div>
    <div class="load">AC <b>${playerAC()}</b> · Equip load <b>${L.w}</b> / ${Math.round(L.cap)} <span class="lc ${lc}">${lc} roll</span></div>`;
  const combatKeys = Object.keys(S.inv).filter(k => S.inv[k] > 0 && (ITEMS[k]?.slot || BELTABLE(k)));
  $('gearGrid').innerHTML = combatKeys.map(k => `<div class="slot${wearing(k) || S.belt.includes(k) ? ' worn' : ''}" data-k="${k}" title="${itemName(k)}">${itemIcon(k)}${S.inv[k] > 1 ? `<span class="n">${S.inv[k]}</span>` : ''}</div>`).join('') || '<div style="color:var(--dim)">Nothing.</div>';
  // ---- the pack: materials and things you build with
  const keysInv = Object.keys(S.inv).filter(k => S.inv[k] > 0 && !ITEMS[k]?.slot && !BELTABLE(k));
  $('invGrid').innerHTML = keysInv.map(k => `<div class="slot${pick === k ? ' pick' : ''}" data-k="${k}" title="${itemName(k)}">${itemIcon(k)}<span class="n">${S.inv[k]}</span></div>`).join('') || '<div style="color:var(--dim)">Empty.</div>';
  $('invHotbar').innerHTML = S.hotbar.map((k, i) => `<div class="slot" data-i="${i}" title="${k ? 'click to clear' : 'empty'}"><span class="k">${i + 1}</span>${k ? itemIcon(k) + `<span class="n">${count(k)}</span>` : ''}</div>`).join('');
  $('recipes').innerHTML = RECIPES.map((r, i) => {
    const ok = Object.entries(r.need).every(([k, n]) => count(k) >= n);
    const need = Object.entries(r.need).map(([k, n]) => `<span class="${count(k) >= n ? '' : 'lack'}">${n} ${itemName(k)} (${count(k)})</span>`).join(', ');
    return `<div class="recipe"><div class="slot" style="width:38px;height:38px;font-size:20px">${itemIcon(r.out)}</div><div class="nm">${r.n > 1 ? r.n + '× ' : ''}${itemName(r.out)}${r.alch ? ' <span style="color:var(--dim);font-size:12px">(INT check for +1)</span>' : ''}<div class="need">${need}</div></div><button data-r="${i}" ${ok ? '' : 'disabled'}>Craft</button></div>`;
  }).join('');
}
$('invGrid').addEventListener('click', e => {
  const s = e.target.closest('.slot'); if (!s) return;
  pick = s.dataset.k;
  const it = ITEMS[pick], placeable = isBlk(pick);
  $('itemInfo').innerHTML = `<b>${itemName(pick)}</b> — ${it ? it.desc : (BLOCKS[+pick.slice(1)].render === 'cross' && BLOCKS[+pick.slice(1)].light ? 'A light source. Place it to hold back the dark.' : 'A placeable block.')} <span style="color:var(--dim)">${placeable ? 'Now click a hotbar slot.' : 'A crafting material.'}</span>`;
  if (!placeable) pick = null;
  renderPanel();
});
$('invHotbar').addEventListener('click', e => {
  const s = e.target.closest('.slot'); if (!s) return;
  const i = +s.dataset.i;
  if (pick) { const j = S.hotbar.indexOf(pick); if (j >= 0) S.hotbar[j] = null; S.hotbar[i] = pick; pick = null; }
  else if (S.hotbar[i]) S.hotbar[i] = null;
  renderPanel(); renderHotbar();
});
// click gear to wear it, click a worn slot to take it off; potions go on the belt
const STAT_HELP = { STR: 'Damage with weapons that scale on STR (heavy weapons, grade A–S); to-hit with them', DEX: 'Damage with weapons that scale on DEX (daggers, bows, finesse blades); armour class', CON: 'Hit points, a lot of them', INT: 'Spell power (the Sigil scales INT A) and Lumen', WIS: 'Lumen, a little spell power (WIS D), and nerve against dread', CHA: 'Better prices in time; little else yet' };
$('sheet').addEventListener('click', e => { const b = e.target.closest('button.pt'); if (b) { spendPoint(b.dataset.stat); renderPanel(); } });
// click a quest to track it (again to stop)
$('sheet').addEventListener('click', e => {
  const t = e.target.closest('.tq'); if (!t || !t.dataset.q) return;
  S.tracked = S.tracked === t.dataset.q ? null : t.dataset.q; S.arrived = null;
  snd.place(); renderPanel();
});
$('gearGrid').addEventListener('click', e => {
  const s = e.target.closest('.slot'); if (!s) return;
  const k = s.dataset.k, it = ITEMS[k];
  if (BELTABLE(k)) { if (!S.belt.includes(k)) { const e2 = S.belt.findIndex(b => !b || !count(b)); S.belt[e2 >= 0 ? e2 : S.beltSel] = k; } }
  else if (it?.slot) equip(k);
  $('gearInfo').innerHTML = `<b>${itemName(k)}</b> — ${it?.desc || ''}${it?.weapon ? ` <span class="dim">(${it.weapon.dice[0]}d${it.weapon.dice[1]}, weight ${it.wt})</span><br>Attack rating <b>${Math.round(attackRating(k))}</b> · scaling <b>${gradeTxt(k)}</b>` : it?.wt != null ? ` <span class="dim">(weight ${it.wt})</span>` : ''}`;
  renderPanel();
});
$('equip').addEventListener('click', e => {
  const s = e.target.closest('.slot'); if (!s) return;
  if (s.dataset.sslot != null) { const i = +s.dataset.sslot; if (S.spellSel === i && S.spellSlots[i]) S.spellSlots[i] = null; else S.spellSel = i; renderPanel(); renderHotbar(); return; }
  if (s.dataset.spell) { const id = s.dataset.spell; if (!S.spellSlots.includes(id)) { const e2 = S.spellSlots.indexOf(null); S.spellSlots[e2 >= 0 ? e2 : S.spellSel] = id; } $('gearInfo').innerHTML = `<b>${SPELLS[id].name}</b> (${SPELLS[id].cost} Lumen) — ${SPELLS[id].desc}`; renderPanel(); renderHotbar(); return; }
  if (s.dataset.belt != null) { const i = +s.dataset.belt; if (S.beltSel === i && S.belt[i]) S.belt[i] = null; else S.beltSel = i; }
  else if (s.dataset.slot) unequip(s.dataset.slot, +s.dataset.i || 0);
  renderPanel();
});
$('recipes').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  craft(RECIPES[+b.dataset.r]); renderPanel();
});
function craft(r) {
  if (!Object.entries(r.need).every(([k, n]) => count(k) >= n)) return;
  for (const [k, n] of Object.entries(r.need)) removeItem(k, n);
  let n = r.n;
  if (r.alch) {
    const d20 = roll(20), tot = d20 + statMod('INT');
    if (tot >= 12) { n++; log(`🎲 Alchemy (INT): d20(${d20})${fm(statMod('INT'))} = ${tot} vs 12 — <b>success</b>, an extra dose!`, 'good'); }
    else log(`🎲 Alchemy (INT): d20(${d20})${fm(statMod('INT'))} = ${tot} vs 12 — ordinary brew.`, 'miss');
    snd.dice();
  }
  addItem(r.out, n); snd.craft();
  if (r.out === 'b12') S.flags.craftTorch = true;
  if (r.out === 'goggles') { S.flags.goggles = true; msg('Goggles of Night', 'Press G. The dark will never be total again.'); }
}
function showDeath(src) {
  state = 'dead'; ui = 'dead'; mouse.left = false;
  if (document.pointerLockElement) document.exitPointerLock();
  $('deathText').innerHTML = `${escapeHTML(S.name)}, level ${S.level} ${RACES[S.race].name} ${CLASSES[S.cls].name}, was slain by ${src} on day ${S.day}.<br><br>When you rise, half of your coal, iron, glowcaps, herbs and shards stay behind in the dark.`;
  show('deathScr');
}
$('riseBtn').onclick = () => {
  for (const k of ['coal', 'iron', 'b13', 'herb', 'shard', 'oil']) if (count(k)) removeItem(k, Math.ceil(count(k) / 2));
  S.hp = S.maxHp; S.dread = 0;
  P.pos.set(S.spawnPt.x, S.spawnPt.y, S.spawnPt.z); P.vel.set(0, 0, 0); airPeak = P.pos.y;
  for (const m of mobs.slice()) if (m.pos.distanceTo(P.pos) < 24) removeMob(m);
  state = 'play'; ui = 'none'; show(null); requestLock();
  msg('You rise', 'The dark remembers you.');
};
function showASI() {
  ui = 'asi'; mouse.left = false; if (document.pointerLockElement) document.exitPointerLock();
  $('asiBtns').innerHTML = STATS.map(k => `<button data-s="${k}" ${S.stats[k] >= 20 ? 'disabled' : ''}>${k} ${S.stats[k]} → ${Math.min(20, S.stats[k] + 2)}</button>`).join('');
  show('asiScr');
}
$('asiBtns').addEventListener('click', e => {
  const k = e.target.dataset.s; if (!k) return;
  const oldCon = statMod('CON');
  S.stats[k] = Math.min(20, S.stats[k] + 2);
  if (k === 'CON') { const gain = (statMod('CON') - oldCon) * S.level; S.maxHp += gain; S.hp += gain; }
  S.pendingASI--;
  if (S.pendingASI > 0) showASI(); else { ui = 'none'; show(null); requestLock(); }
});

// ================================================================ actions
function useAction() {
  const k = heldKey();
  if (targetNpc) { openTalk(targetNpc); return; }
  if (target) {
    const b = target.b;
    if (b === B.CHEST) { openChest(target.x, target.y, target.z); return; }
    if (b === B.CAMPFIRE) { restAtFire(target); return; }
    if ((b === B.WARDROBE || b === B.HOLLOWLOG) && !S.build) { enterHide(target); return; }
    if (b === B.NOTE) { const id = world.notes?.get(world.idx(target.x, target.y, target.z)); if (id) openNote(id, true); return; }
  }

  if (k === 'healing') { quaff(); return; }
  if (k === 'lumendraught') { drinkLumen(); return; }
  if (k === 'healing') {
    if (S.hp >= S.maxHp) { log('You are already at full health.', 'miss'); return; }
    removeItem('healing'); const h = rollDice(2, 4) + 2; heal(h, `🎲 Healing Draught: 2d4+2 = ${h}`); snd.drink(); return;
  }
  if (k && isBlk(k) && target) {
    const id = +k.slice(1);
    let x = target.x + target.nx, y = target.y + target.ny, z = target.z + target.nz;
    if (target.b === B.TALLGRASS) { x = target.x; y = target.y; z = target.z; }
    const cur = world.get(x, y, z);
    if (cur !== B.AIR && cur !== B.TALLGRASS) return;
    if (!world.inBounds(x, y, z) || y < 1) return;
    if ((id === B.GLOWCAP || id === B.CAMPFIRE) && !SOLID[world.get(x, y - 1, z)]) { log('That needs solid ground beneath it.', 'miss'); return; }
    if (SOLID[id]) {
      const hitsBody = (b, bx, by, bz) => x + 1 > bx - b.half && x < bx + b.half && z + 1 > bz - b.half && z < bz + b.half && y + 1 > by && y < by + b.h;
      if (hitsBody(P, P.pos.x, P.pos.y, P.pos.z)) return;
      if (mobs.some(m => hitsBody(m, m.pos.x, m.pos.y, m.pos.z))) return;
    }
    if (setBlock(x, y, z, id)) {
      if ((id === B.WARDROBE || id === B.THICKET || id === B.HOLLOWLOG) && hideList) hideList.push([x, y, z, id]);
      removeItem(k); snd.place(); startSwing(0.25);
      if (id === B.TORCH || id === B.CAMPFIRE) S.flags.light = true;
    }
  }
}
function rollLoot(kind) {
  const L = [], R = Math.random, dung = kind !== 'ruin';
  L.push(['gold', rollDice(dung ? 3 : 2, 6)]);
  if (R() < 0.8) L.push(['coal', 1 + roll(4)]);
  if (R() < 0.6) L.push(['iron', roll(3) + (dung ? 1 : 0)]);
  if (R() < 0.55) L.push(['b13', roll(3)]);
  if (R() < 0.5) L.push(['oil', roll(2)]);
  if (R() < 0.45) L.push(['healing', 1]);
  if (R() < (dung ? 0.6 : 0.3)) L.push(['elixir', 1]);
  if (S.flags.magic && R() < (dung ? 0.4 : 0.15)) L.push(['lumendraught', 1]);
  if (R() < (dung ? 0.55 : 0.2)) L.push(['shard', 1]);
  if (dung && R() < 0.2) L.push(['sword', 1]);
  if (dung && R() < 0.15) L.push(['armor', 1]);
  // old gear of the dead
  const GEAR = dung ? ['helm', 'gauntlets', 'greaves', 'gloves', 'boots', 'hood', 'greataxe', 'wolfcharm', 'warbow', 'bow'] : ['gloves', 'boots', 'hood', 'leather', 'bow'];
  if (R() < 0.4) L.push(['arrows', 4 + roll(8)]);
  if (R() < (dung ? 0.45 : 0.25)) { const g = GEAR[Math.floor(R() * GEAR.length)]; if (!count(g)) L.push([g, 1]); }
  return L;
}
function openChest(x, y, z) {
  const i = world.idx(x, y, z);
  if (world.opened.has(i)) { log('The chest is empty.', 'miss'); return; }
  world.opened.add(i);
  const kind = world.chestKind.get(i) || 'ruin';
  const L = rollLoot(kind);

  if (i === world.questChest?.reliquary) L.unshift(['reliquary', 1], ['tome_ward', 1]);
  const Kc = world.castle; if (!S.flags.sigilFound && x >= Kc.x0 && x <= Kc.x1 && z >= Kc.z0 && z <= Kc.z1) { S.flags.sigilFound = true; L.unshift(['sigil', 1]); }
  if (kind === 'tome_hex' || kind === 'tome_blast') L.unshift([kind, 1]);
  for (const [k, n] of L) addItem(k, n);
  snd.chest(); snd.pickup();
  log(`You pry open the old chest: ${L.map(([k, n]) => `${n} ${itemName(k)}`).join(', ')}.`, 'good');
  S.flags.chests++;
  const K = world.castle; if (x >= K.x0 && x <= K.x1 && z >= K.z0 && z <= K.z1) S.flags.castleChest = true;
  gainXP(kind === 'ruin' ? 25 : 60, 'discovery');
}
function restAtFire(t) {
  const night = sunNow < 0.35;
  S.spawnPt = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
  if (night) {
    if (mobs.some(m => m.aware && m.dist < 18)) { log('You cannot rest with enemies near.', 'bad'); return; }
    const f = $('fade'); f.style.transition = 'opacity 1s'; f.style.opacity = 1;
    ui = 'resting';
    setTimeout(() => {
      S.time = 0.985; S.hp = S.maxHp; S.dread = 0; S.sawNight = false; rechargeAll();
      for (const m of mobs.slice()) if (m.type !== 'crawler' || m.postIdx != null) removeMob(m);
      S.postsDead = [];
      log('As you rest, you hear armour shifting far off. The castle\'s dead stand at their posts again.', 'lore');
      f.style.opacity = 0; setTimeout(() => { f.style.transition = 'opacity .12s'; }, 1000);
      ui = 'none';
      msg('Long Rest', 'You wake to grey light. Hit points, spells and abilities restored.');
      saveGame();
    }, 1200);
  } else {
    if (S.restDay === S.day) { log('You have already taken a short rest today. The fire marks your return point.', 'miss'); return; }
    S.restDay = S.day;
    const h = roll(CLASSES[S.cls].hd) + statMod('CON');
    heal(Math.max(1, h), `🎲 Short rest: 1d${CLASSES[S.cls].hd}${fm(statMod('CON'))} = ${Math.max(1, h)}`);
    S.postsDead = [];
    log('You will return to this fire if you fall.', 'good');
    saveGame();
  }
}
// what a pick or mattock tears out around each stroke
const DIG = new Set([B.GRASS, B.DIRT, B.STONE, B.ASH, B.GRAVEL, B.MUD, B.BASALT, B.COAL, B.IRON, B.COBBLE, B.LEAVES, B.MIRECAP, B.THICKET]);
function breakBlock(t, chunk = 0) {
  const d = BLOCKS[t.b];
  if (t.b === B.CHEST && !world.opened.has(world.idx(t.x, t.y, t.z))) openChest(t.x, t.y, t.z);
  if (chunk && DIG.has(t.b)) {
    // a cross of earth for the pick, the full 3x3 face for the mattock; seams of much harder rock hold
    for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) {
      if ((!a && !c) || (chunk < 2 && a && c)) continue;
      let x = t.x, y = t.y, z = t.z;
      if (t.nx) { y += a; z += c; } else if (t.ny) { x += a; z += c; } else { x += a; y += c; }
      const nb = world.get(x, y, z);
      if (!DIG.has(nb) || y < 1 || BLOCKS[nb].hard > d.hard + 0.6) continue;
      const ks = world.setBlock(x, y, z, B.AIR); if (ks) for (const k of ks) dirty.add(k);
      const nd = BLOCKS[nb]; if (nd.drop) addItem(nd.drop, 1);
    }
  }
  setBlock(t.x, t.y, t.z, B.AIR);
  snd.thud();
  if (t.b === B.TALLGRASS) { if (Math.random() < 0.35) { addItem('herb'); snd.pickup(); } return; }
  if (t.b === B.LEAVES) { if (Math.random() < 0.08) { addItem('herb'); snd.pickup(); } return; }
  if (d.drop) addItem(d.drop, 1);
}
function toggleLantern() {
  if (!S.lanternOn && S.cls !== 'cleric' && S.oilT <= 0 && !count('oil')) { log('Your lantern is dry. Craft oil from coal.', 'bad'); return; }
  S.lanternOn = !S.lanternOn; snd.lantern(S.lanternOn);
}
// [G] always takes the green sight away: goggles off, or the elixir's effect shut out
function toggleGoggles() {
  if (S.gogOn) { S.gogOn = false; snd.lantern(false); log('You push the goggles up.', 'miss'); return; }
  if (S.nvT > 0) { S.nvT = 0; snd.lantern(false); log('You squeeze your eyes shut until the elixir\'s sight fades.', 'miss'); return; }
  if (!count('goggles')) { log('You have no Goggles of Night.', 'miss'); return; }
  if (!count('b13')) { log('The goggles need glowcaps to burn.', 'bad'); return; }
  S.gogOn = true; snd.lantern(true);
}
function heal(n, text) {
  const before = S.hp; S.hp = Math.min(S.maxHp, S.hp + n);
  log(`${text} — healed ${S.hp - before}.`, 'good'); floater('+' + (S.hp - before), new THREE.Vector3(P.pos.x, P.pos.y + 2.1, P.pos.z), '#9fe0a0');
}
function classAbility() {
  if (S.cls === 'fighter') {
    if (!S.uses.second) { log('Second Wind is spent until you rest or dawn comes.', 'miss'); return; }
    S.uses.second = 0; const h = roll(10) + S.level; heal(h, `🎲 Second Wind: 1d10+${S.level} = ${h}`); snd.dice();
  } else if (S.cls === 'rogue') {
    if (!S.uses.shadow) { log('Shadowstep is spent until you rest or dawn comes.', 'miss'); return; }
    S.uses.shadow = 0; S.shadowT = 8; for (const m of mobs) if (m.type !== 'watcher') m.aware = false;
    log('You fold into the shadows. Nothing can sense you for 8 seconds.', 'good');
  } else {
    if (S.slots <= 0) { log('No spell slots remain.', 'miss'); return; }
    if (S.hp >= S.maxHp) { log('You are already at full health.', 'miss'); return; }
    S.slots--; const h = roll(8) + statMod('WIS'); heal(Math.max(1, h), `✨ Cure Wounds: 1d8${fm(statMod('WIS'))} = ${Math.max(1, h)}`); snd.dice();
  }
}
function turnUndead() {
  if (S.cls !== 'cleric') return;
  if (!S.uses.turn) { log('Turn Undead is spent until you rest or dawn comes.', 'miss'); return; }
  S.uses.turn = 0;
  const dc = 8 + prof() + statMod('WIS');
  let n = 0;
  for (const m of mobs) if (m.dist < 12) {
    const sv = roll(20) + (m.type === 'watcher' ? 4 : 1);
    if (sv < dc) { m.turnedT = 12; n++; floater('TURNED', m.pos.clone().add(new THREE.Vector3(0, m.h + 0.4, 0)), '#ffe9a0'); }
  }
  log(`☀ You present your holy symbol (WIS save DC ${dc}). ${n} creature${n === 1 ? '' : 's'} flee in terror.`, 'good');
  snd.levelup(); fadeFlash(80);
}

// ================================================================ combat
function rayAABB(o, d, m, maxD) {
  const mn = [m.pos.x - m.half, m.pos.y, m.pos.z - m.half], mx = [m.pos.x + m.half, m.pos.y + m.h, m.pos.z + m.half];
  const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
  let t0 = 0, t1 = maxD;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(dd[a]) < 1e-9) { if (oo[a] < mn[a] || oo[a] > mx[a]) return -1; continue; }
    let ta = (mn[a] - oo[a]) / dd[a], tb = (mx[a] - oo[a]) / dd[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return -1;
  }
  return t0;
}
function mobVisible(m) {
  if (nvLevel > 0.5) return m.dist < 60;
  if (lanternActive() && m.dist < U.uLanternR.value * 0.95) return true;
  const dv = darkvision(); if (dv && m.dist < dv) return true;
  return m.envLight > 0.06;
}
function playerAttack(m) {
  if (m.brokenT > 0) { executeMob(m); return; }
  const w = weapon();
  const useDex = w.finesse || S.cls === 'rogue';
  const am = useDex ? Math.max(statMod('STR'), statMod('DEX')) : statMod('STR');
  let adv = 0; const why = [];
  if (!m.aware || m.turnedT > 0) { adv++; why.push(m.turnedT > 0 ? 'fleeing' : 'unaware'); }
  else if (m.stagT > 0) { adv++; why.push('reeling'); }
  if (S.dread >= 80) { adv--; why.push('dread'); }
  if (!mobVisible(m)) { adv--; why.push('unseen'); }
  const r1 = roll(20), r2 = roll(20);
  const d20 = adv > 0 ? Math.max(r1, r2) : adv < 0 ? Math.min(r1, r2) : r1;
  const up = upLvl(rightHand());
  const bonus = am + prof() + up + (eqItem('charm') === 'wolfcharm' ? 1 : 0), total = d20 + bonus;
  const advTxt = adv > 0 ? ` <i>adv (${why.join(', ')}) ${r1}/${r2}</i>` : adv < 0 ? ` <i>disadv (${why.join(', ')}) ${r1}/${r2}</i>` : '';
  atkCd = w.cd * (S.cls === 'fighter' && S.level >= 5 ? 0.6 : 1) * (eqItem('hands') === 'gloves' ? 0.88 : 1) * (loadClass() === 'heavy' ? 1.15 : 1); startSwing();
  snd.dice();
  m.aware = true;
  if (d20 === 1 || (d20 !== 20 && total < m.T.ac)) {
    log(`⚔ d20(${d20})${fm(bonus)} = ${total} vs AC ${m.T.ac} — <b>miss</b>${advTxt}`, 'miss');
    floater('miss', m.pos.clone().add(new THREE.Vector3(0, m.h + 0.3, 0)), '#aaa'); snd.miss(); return;
  }
  const crit = d20 === 20;
  const nd = w.dice[0] * (crit ? 2 : 1);
  const sc = Math.round(scalingBonus(rightHand()));
  let dmg = rollDice(nd, w.dice[1]) + sc + up;
  let txt = `${nd}d${w.dice[1]} + ${sc} scaling${up ? ` + ${up}` : ''}`;
  { const ex = infuse(m, S.wup?.[rightHand()]?.inf); dmg += ex.dmg; txt += ex.txt; }
  { const ul = S.wup?.[rightHand()]?.lvl || 0; if (ul) { dmg = Math.round(dmg * (1 + 0.08 * ul)); } }
  if (m.hexT > 0) { dmg = Math.round(dmg * 1.5); txt += ' ×1.5 hexed'; }
  if (S.cls === 'rogue' && adv > 0) { const sd = sneakDice() * (crit ? 2 : 1); const sa = rollDice(sd, 6); dmg += sa; txt += ` + sneak ${sd}d6`; }
  dmg = Math.max(1, giantArmour(m, dmg));
  log(`⚔ d20(${d20})${fm(bonus)} = ${total} vs AC ${m.T.ac} — <b>${crit ? 'CRITICAL ' : ''}hit</b>: ${txt} = <b>${dmg}</b>${advTxt}`, 'hit');
  floater((crit ? '‼ ' : '') + dmg, m.pos.clone().add(new THREE.Vector3(0, m.h + 0.3, 0)), crit ? '#ffd24a' : '#ffb27a');
  crit ? snd.crit() : snd.hit();
  m.hp -= dmg; m.hurtT = 1;
  const kx = m.pos.x - P.pos.x, kz = m.pos.z - P.pos.z, kl = Math.hypot(kx, kz) || 1;
  m.vel.x += kx / kl * 5; m.vel.z += kz / kl * 5; m.vel.y = 4;
  m.pos.x += kx / kl * 0.25; m.pos.z += kz / kl * 0.25;
  if (collides(world, m.pos.x, m.pos.y, m.pos.z, m.half, m.h)) { m.pos.x -= kx / kl * 0.25; m.pos.z -= kz / kl * 0.25; }
  if (!checkBroken(m) && m.hp <= 0) killMob(m);
}
function killMob(m, restored = false) {
  const T = m.T; S.kills++;
  S.killsBy[m.type] = (S.killsBy[m.type] || 0) + 1;
  if (m.postIdx != null) S.postsDead[m.postIdx] = true;
  if (!restored) { snd.death(); log(`☠ The ${T.name} falls.`, 'good'); if (ACCURSED.has(m.type)) S.slain = (S.slain || 0) + 1; }
  const drops = [], R = Math.random;
  if (m.raider && S.raid) S.raid.killed++;
  if (hunter === m) hunter = null;
  if (restored) { /* no light taken, no spoils: only what the story needs (below) */ }
  else if (ACCURSED.has(m.type) && S.flags.magic) { const ae = m.type === 'king' ? 40 : m.T.xp >= 120 ? 8 : 4; S.aether = Math.min(maxAether(), (S.aether || 0) + ae); floater(`+${ae} Lumen`, m.pos.clone().add(new THREE.Vector3(0, m.h + 0.7, 0)), '#9fd8ff', 1.1); }
  if (restored) { if (m.type === 'king') { if (count('emptycore')) { removeItem('emptycore'); drops.push(['lumencore', 1]); } else drops.push(['kingash', 1]); S.flags.king = true; boss = null; msg('The Lord of Vharrow is returned', 'He gives back what he swallowed, and asks to be forgiven. Not by you: by all of them.', 7); snd.levelup(); fadeFlash(300); for (const o of mobs.slice()) if (o !== m && !o.dead && o.dist < 30 && o.type !== 'watcher') G.mobVanish(o, 'kneels, and is still'); } }
  else if (m.type === 'mirekin') { if (R() < 0.65) drops.push(['venomsac', 1]); if (R() < 0.2) drops.push(['shard', 1]); }
  if (m.type === 'taker' && !restored) { drops.push(['gold', 60 + rollDice(6, 10)], ['shard', 3], ['oil', 4]); msg('The Lantern-Taker falls', 'One by one, the lanterns it carried go out. Somewhere out there, there are others.', 7); fadeFlash(250); }
  if (m.type === 'cinder') { if (R() < 0.65) drops.push(['emberresin', 1]); if (R() < 0.3) drops.push(['shard', 1]); }
  if (m.type === 'wendigo') { drops.push(['gold', rollDice(2, 8)]); if (R() < 0.4) drops.push(['shard', 1]); if (!count('hood') && R() < 0.2) drops.push(['hood', 1]); }
  const shardP = m.type === 'ghoul' ? 0.24 : 0.16;
  if (m.type === 'watcher') { drops.push(['shard', 3], ['gold', 20]); S.flags.watcher = true; msg('The Pale Watcher is slain', 'For one night, nothing watches you back.'); }
  else if (m.type === 'king') {
    // what he swallowed must go somewhere: into the empty core, if you brought one
    if (count('emptycore')) { removeItem('emptycore'); drops.push(['lumencore', 1]); } else drops.push(['kingash', 1]);
    drops.push(['gold', 120], ['shard', 4], ['kingblade', 1], ['healing', 2]); S.flags.king = true; boss = null;
    msg('The Hollow King falls', 'Vharrow\'s dead will stand at no more posts tonight.', 6); snd.levelup(); fadeFlash(300);
    for (const o of mobs.slice()) if (o !== m && !o.dead && o.dist < 30 && o.type !== 'watcher') G.mobVanish(o, 'collapses into ash');
  }
  else if (m.type === 'wolf') { if (R() < 0.7) drops.push(['pelt', 1]); }
  else if (m.type === 'bandit') { drops.push(['gold', rollDice(2, 6)], ['arrows', 2 + roll(5)]); if (R() < 0.25) drops.push(['healing', 1]); if (R() < 0.25) drops.push(['oil', 1]); if (R() < 0.15 && !count('bow')) drops.push(['bow', 1]); }
  else if (m.type === 'knight') {
    drops.push(['gold', rollDice(3, 6)]); if (R() < 0.35) drops.push(['shard', 1]); if (R() < 0.3) drops.push(['iron', 2]);
    // what the knight wore, if you don't already have it
    const kg = ['knighthelm', 'plate', 'towershield', 'gauntlets', 'greaves'].filter(k => !count(k));
    if (kg.length && R() < 0.4) drops.push([kg[Math.floor(R() * kg.length)], 1]);
  }
  else {
    if (R() < shardP * (isWhisperNight() ? 1.7 : 1) * (sunNow < 0.3 ? 1 : 0.5)) drops.push(['shard', 1]);
    if (R() < 0.3) drops.push([m.type === 'ghoul' ? 'coal' : 'herb', 1]);
    if (m.postIdx != null && R() < 0.4) drops.push(['gold', roll(6)]);
  }
  for (const [k, n] of drops) addItem(k, n);
  if (drops.length) log(`It leaves behind: ${drops.map(([k, n]) => `${n} ${itemName(k)}`).join(', ')}.`, 'good');
  removeMob(m);
  if (m.bossId) {
    const Bd = BOSSES[m.bossId]; S.flags['boss_' + m.bossId] = true;
    for (const [k, n] of Bd.drops || []) addItem(k, n);
    if (Bd.item && !count(Bd.item)) addItem(Bd.item);
    if (m.bossId !== 'king') { if (restored) msg(`${Bd.name} is returned`, 'For a moment, a person kneels where the monster stood.', 6); else msg(`${Bd.name} falls`, 'Something bright escapes it, like breath on a cold morning.', 6); snd.levelup(); fadeFlash(250); }
    if (m.bossId === 'astronomer') hint('tier', 'With the Astronomer gone, the <b>Beacon</b> can be turned down into the Gloam itself. Ask Maren about <b>Deepening the Gloam</b>: everything grows stronger — and so do you.', 14);
    boss = null; bossId = null;
  }
  gainXP(Math.round(mobXP(m) * (restored ? 1.25 : 1)), T.name, true);
}
function removeMob(m) { m.dead = true; m.dispose(scene); const i = mobs.indexOf(m); if (i >= 0) mobs.splice(i, 1); }
function hurtPlayer(n, src) {
  if (state !== 'play') return;
  S.hp -= n; flashHurt(); snd.hurt(); calmT = 0;
  if (S.hp > 0 && S.hp <= S.maxHp * 0.5 && count('healing')) hint('lowhp', 'You are badly hurt. Press <b>Q</b> to drink a Healing Draught.<br>Out of combat your wounds slowly close on their own.');
  if (S.hp <= 0) {
    if (S.race === 'halforc' && S.uses.relentless) { S.uses.relentless = 0; S.hp = 1; msg('Relentless Endurance', 'You refuse to fall.'); log('Relentless Endurance keeps you standing at 1 HP!', 'good'); return; }
    S.hp = 0; showDeath(src);
  }
}
// XP: kills pay by the creature's level; deeds (quests, notes, chests, nights) pay a share of your current level
function gainXP(n, why, kill = false) {
  if (S.level >= LEVEL_CAP) return;
  if (!kill) n = Math.max(1, Math.round(n / 100 * xpNeed(S.level) * 0.6));
  S.xp += n;
  floater(`+${n} XP`, new THREE.Vector3(P.pos.x, P.pos.y + 2.3, P.pos.z), '#d6a84a');
  let ups = 0;
  while (S.level < LEVEL_CAP && S.xp >= xpNeed(S.level)) { S.xp -= xpNeed(S.level); S.level++; S.points++; ups++; }
  if (ups) {
    const before = S.maxHp; recalcHp(); S.hp = Math.min(S.maxHp, S.hp + (S.maxHp - before));
    snd.levelup(); rechargeAll();
    msg(`Level ${S.level}`, `+${ups} attribute point${ups > 1 ? 's' : ''} — spend ${ups > 1 ? 'them' : 'it'} in your pack [E] · +${S.maxHp - before} max HP${S.cls === 'fighter' && S.level === 5 ? ' · Extra Attack' : ''}`);
    hint('points', 'You levelled up. Open your pack <b>[E]</b> and press <b>+</b> beside an attribute to spend your points. Each attribute can rise to <b>99</b>.', 12);
  }
}
const mobXP = m => Math.round((m.T.xp / 50) * (15 + 9 * Math.pow(m.lvl || 1, 1.5)));

// mob-facing context
const G = {
  world: null, ppos: P.pos, sun: 1, senseMult: 1,
  get hidden() { return !!hideSpot; },
  perceive(m) { return perceive(m); },
  onLose(m) {
    if (m.hunter && m.dist < 34 && gameT - huntMsgT > 8) { huntMsgT = gameT; log(`The ${m.T.name} has lost sight of you. It is searching.`, 'lore'); }
  },
  onTwitch(m) { if (m.dist < 11 && Math.random() < 0.6) snd.crack(panFor(m.pos), clamp(1.2 - m.dist / 11, 0.15, 1)); },
  onStomp(m) {
    if (m.dist > 40) return;
    const v = clamp(1.3 - m.dist / 34, 0.12, 1); snd.stomp(panFor(m.pos), v);
    if (m.dist < 14) shakeT = Math.max(shakeT, 0.12 + 0.25 * (1 - m.dist / 14));
  },
  onChains(m) { if (m.dist < 36) snd.chains(panFor(m.pos), clamp(1.3 - m.dist / 30, 0.15, 1)); },
  onSearch(m) { if (m.dist < 22) snd.sniff(panFor(m.pos), clamp(1.2 - m.dist / 20, 0.2, 1)); },
  onGiveUp(m) {
    if (!m.hunter || m.T.giant) return;
    m.losses = (m.losses || 0) + 1; m.scentT = sunNow < 0.35 ? 7 : 12;
    if (m.losses >= 3 || hideSpot || (inCover && crouch)) callOff(m, 'gives up the search, and turns away');
  },
  onRecover(m) { if (m.dist < 30) log(`The ${m.T.name} rises again. The moment has passed.`, 'bad'); m.hp = Math.max(m.hp, Math.ceil(m.maxHp * 0.35)); },
  mobAttack(m) {
    const T = m.T, over = m.pos.clone().add(new THREE.Vector3(0, m.h + 0.3, 0));
    if (dodgeT > 0) { floater('dodged', over, '#cfe6ff'); snd.miss(); return; }
    const tx = m.pos.x - P.pos.x, tz = m.pos.z - P.pos.z, tl = Math.hypot(tx, tz) || 1;
    const front = (tx * -Math.sin(yaw) + tz * -Math.cos(yaw)) / tl > 0.3;
    if (T.giant) {
      shakeT = Math.max(shakeT, 0.7); snd.stomp(0, 1);
      if (guarding && front && gameT - guardAt < 0.45) log(`The ${T.name} is far too heavy to parry. It smashes straight through your guard.`, 'bad');
      const floor = Math.round(S.maxHp * (S.level < 60 ? 0.55 : S.level < 150 ? 0.35 : 0.2));
      const cap = Math.ceil(S.maxHp * (S.level < 60 ? 0.6 : 0.85)); // two blows, never one: the first is your warning
      let dmg = Math.min(cap, Math.max(floor, Math.round((rollDice(T.dmg[0], T.dmg[1]) + T.dmg[2]) * (T.dmgMul || 1))));
      if (guarding && front && offHand()) dmg = Math.round(dmg * 0.7);
      log(`🩸 The ${T.name}'s arm comes down on you for <b>${dmg}</b>. <b>RUN.</b>`, 'bad');
      const kx = P.pos.x - m.pos.x, kz = P.pos.z - m.pos.z, kl = Math.hypot(kx, kz) || 1;
      P.vel.x += kx / kl * 10; P.vel.z += kz / kl * 10; P.vel.y = Math.max(P.vel.y, 5);
      hurtPlayer(dmg, `the ${T.name}`); m.cd = T.cd + 1.2;
      return;
    }
    if (guarding && front && gameT - guardAt < 0.45) {
      m.stagT = T.boss ? 1.0 : 1.7; m.cd = Math.max(m.cd, T.cd + 0.5);
      snd.parry(); floater('PARRY', over, '#ffe9a0'); fadeFlash(60);
      log(`✦ You parry the ${T.name}! It reels — strike now with advantage.`, 'good');
      S.flags.parried = (S.flags.parried || 0) + 1;
      return;
    }
    const d20 = roll(20), total = d20 + T.atk, ac = playerAC() + (guarding && front ? 2 : 0);
    if (d20 === 20 || (d20 !== 1 && total >= ac)) {
      const nd = T.dmg[0] * (d20 === 20 ? 2 : 1);
      let dmg = Math.round((rollDice(nd, T.dmg[1]) + T.dmg[2]) * (T.dmgMul || 1));
      const kx = P.pos.x - m.pos.x, kz = P.pos.z - m.pos.z, kl = Math.hypot(kx, kz) || 1;
      if (guarding && front) {
        const full = dmg; dmg = Math.max(1, Math.round(dmg * (ITEMS[offHand()]?.block ?? (offHand() ? 0.25 : 0.5))));
        log(`🛡 ${T.name}: d20(${d20})${fm(T.atk)} = ${total} vs AC ${ac} — you <b>block</b>: ${full} → <b>${dmg}</b>`, 'miss');
        snd.block(); hurtPlayer(dmg, `a ${T.name}`);
        P.vel.x += kx / kl * 2; P.vel.z += kz / kl * 2;
        return;
      }
      log(`🩸 ${T.name}: d20(${d20})${fm(T.atk)} = ${total} vs AC ${ac} — ${d20 === 20 ? 'CRIT ' : ''}hits you for <b>${dmg}</b>`, 'bad');
      hurtPlayer(dmg, `a ${T.name}`);
      P.vel.x += kx / kl * 4; P.vel.z += kz / kl * 4;
    } else {
      log(`🛡 ${T.name}: d20(${d20})${fm(T.atk)} = ${total} vs AC ${ac} — misses`, 'miss'); snd.miss();
    }
  },
  mobWindup(m) {
    // struck at from behind, unseen: the jolt
    const bx = m.pos.x - P.pos.x, bz = m.pos.z - P.pos.z, bl = Math.hypot(bx, bz) || 1;
    if (!m.jolted && m.type !== 'wolf' && (bx * -Math.sin(yaw) + bz * -Math.cos(yaw)) / bl < -0.2) {
      m.jolted = true; snd.jolt(); fadeFlash(90); shakeT = 0.5; S.dread = Math.min(100, S.dread + 12);
    }
    if (m.dist < 24) snd.windup(panFor(m.pos), !!(m.T.boss || m.T.giant));
    if (m.dist < 6) hint('windup', 'It is <b>rearing back</b> to strike!<br>Hold <b>right mouse</b> as the blow lands to <b>parry</b>, press <b>C</b> to dodge, or step back.', 9);
  },
  onRise(m) {
    // it was lying there the whole time
    const pan = panFor(m.pos);
    snd.screech(pan, 1); if (m.dist < 4) { snd.jolt(); fadeFlash(80); }
    shakeT = Math.max(shakeT, 0.45); S.dread = Math.min(100, S.dread + 12);
    hint('dormant', 'Not every body on the ground is <b>dead</b>.', 7);
  },
  mobWhiff(m) { if (m.dist < 8) floater('whiff', m.pos.clone().add(new THREE.Vector3(0, m.h + 0.3, 0)), '#9c8f78', 0.8); },
  mobFlee(m) { if (m.dist < 20) { log(`The ${m.T.name} yelps and limps away.`, 'miss'); snd.growl(panFor(m.pos), 0.4); } },
  onAware(m) {
    if (m.leaving) { m.leaving = false; m.goal = null; }
    const pan = panFor(m.pos), vol = clamp(1.4 - m.dist / 20, 0.25, 1);
    if (m.T.giant) {
      if (gameT - (m.roarAt || -99) > 12) { m.roarAt = gameT; snd.roar(pan, clamp(1.5 - m.dist / 40, 0.4, 1)); shakeT = Math.max(shakeT, 0.5); S.dread = Math.min(100, S.dread + 8); }
      return;
    }
    if (m.type === 'ghoul' || m.type === 'crawler') {
      // it has seen you: a shriek, and it comes running
      snd.screech(pan, vol); if (m.type === 'crawler') snd.skitter(pan, vol);
      S.dread = Math.min(100, S.dread + 6); if (m.dist < 12) shakeT = Math.max(shakeT, 0.25);
    } else snd.growl(pan, vol);
  },
  canShoot(m) { return canShootFn(m); },
  mobShoot(m) { return mobShootFn(m); },
  isObserved(m) {
    m._obsCheck = (m._obsCheck || 0) - 1;
    if (m._obsCheck > 0) return m._obsCache;
    m._obsCheck = 6;
    const to = new THREE.Vector3(m.pos.x - eye.x, m.pos.y + m.h * 0.6 - eye.y, m.pos.z - eye.z);
    const dist = to.length(); to.divideScalar(dist);
    let r = to.dot(look) > 0.55 && mobVisible(m) && world.los(eye, new THREE.Vector3(m.pos.x, m.pos.y + m.h * 0.6, m.pos.z));
    if (ui !== 'none') r = true; // never move while the game is paused in a menu
    m._obsCache = r; return r;
  },
  mobBurn(m) {
    const d = roll(4) + 1; m.hp -= d; m.hurtT = 1; snd.burn();
    floater('🔥' + d, m.pos.clone().add(new THREE.Vector3(0, m.h + 0.3, 0)), '#ff9a40');
    if (m.hp <= 0) { if (m.dist < 30) log(`The ${m.T.name} crumbles to ash in the sunlight.`, 'lore'); removeMob(m); }
  },
  mobVanish(m, text) { if (text && m.dist < 50) log(`The ${m.T.name} ${text}.`, 'lore'); removeMob(m); },
  onWatcherSeen(m) {
    snd.stinger(); S.dread = Math.min(100, S.dread + 22);
    msg('Something pale stands in the dark', 'It only moves when you are not looking.', 4.5);
  },
  blink(m) {
    // you blink. it is closer.
    fadeFlash(170);
    const bx = P.pos.x + Math.sin(yaw) * 2.4, bz = P.pos.z + Math.cos(yaw) * 2.4; // behind the camera
    for (const dy of [0, 1, -1, 2]) {
      const by = Math.floor(P.pos.y) + dy;
      if (!collides(world, bx, by, bz, m.half, m.h) && SOLID[world.get(Math.floor(bx), by - 1, Math.floor(bz))]) {
        m.pos.set(bx, by, bz); m._obsCheck = 0; S.dread = Math.min(100, S.dread + 10);
        snd.whisper(0, 1.4); log('You blinked.', 'lore');
        return;
      }
    }
  },
};
function panFor(p) {
  const dx = p.x - P.pos.x, dz = p.z - P.pos.z, l = Math.hypot(dx, dz) || 1;
  return clamp((dx / l) * Math.cos(yaw) - (dz / l) * Math.sin(yaw), -1, 1);
}

// ================================================================ spawning
let spawnT = 2;
function spawnMob(type, x, y, z, lvl) {
  const m = new Mob(type, x, y, z);
  applyLevel(m, lvl ?? zoneLevel(x, y, z));
  mobs.push(m); scene.add(m.group); return m;
}
// every creature has a level: harder lands, deeper places, darker hours and the Gloam tier all raise it
function zoneLevel(x, y, z) {
  const c = world.camp, K = world.castle, r = regionAt(x).id;
  let L;
  if (x > K.x0 - 6 && x < K.x1 + 6 && z > K.z0 - 6 && z < K.z1 + 6) L = y < K.G - 4 ? 16 : (x > 96 && x < 160 && z > 80 && z < 146) ? 13 : 8;
  else if (r === 'vale') L = 1 + Math.min(10, Math.hypot(x - c.x, z - c.z) / 12);
  else if (r === 'moor') L = 18 + (64 - x) / 64 * 16;
  else if (r === 'mire') L = 32 + (x - 236) / 106 * 28;
  else if (r === 'barrens') L = 60 + Math.min(1, (x - 342) / 106) * 40;
  else if (r === 'wood') L = 88 + (x - 452) / 105 * 20;
  else if (r === 'salt') L = 108 + (x - 557) / 106 * 22;
  else L = 130 + (x - 663) / 105 * 28;
  if (r !== 'vale' && y < world.topSolid(Math.floor(x), Math.floor(z)) - 6) L += 5;
  if (sunNow < 0.3) L += 3;
  L += 40 * (S.tier || 0);
  return Math.max(1, Math.min(LEVEL_CAP + 20, Math.round(L + Math.random() * 3 - 1)));
}
function applyLevel(m, lvl) {
  const base = m.T, ed = expect(lvl) - expect(1);
  m.lvl = lvl;
  m.T = { ...base, ac: base.ac + Math.round(ed * 0.85), atk: base.atk + Math.round(ed * 0.85), dmgMul: 1 + (lvl - 1) * 0.07 };
  m.hp = m.maxHp = Math.round(m.maxHp * (1 + ed * 0.45 + (lvl - 1) * 0.01));
}
function updateSpawns(dt) {
  spawnT -= dt; if (spawnT > 0) return;
  spawnT = 1.4;
  const night = sunNow < 0.3, whisper = night && isWhisperNight();
  const cap = night ? (whisper ? 12 : 8) : 4;
  const n = mobs.filter(m => m.type !== 'wolf' && m.type !== 'bandit' && m.type !== 'watcher' && m.postIdx == null && !m.raider && m.type !== 'king').length;
  if (n < cap) {
    for (let a = 0; a < 10; a++) {
      const ang = Math.random() * Math.PI * 2, r = 14 + Math.random() * 24;
      const x = Math.floor(P.pos.x + Math.cos(ang) * r), z = Math.floor(P.pos.z + Math.sin(ang) * r);
      if (x < 1 || z < 1 || x >= W - 1 || z >= D - 1) continue;
      const top = world.topSolid(x, z);
      let y = -1;
      if (night && Math.random() < 0.6) y = top + 1;
      else {
        let yy = 3 + Math.floor(Math.random() * Math.max(1, top - 6));
        for (let k = 0; k < 14 && yy > 1; k++, yy--) {
          if (!SOLID[world.get(x, yy, z)] && !SOLID[world.get(x, yy + 1, z)] && SOLID[world.get(x, yy - 1, z)]) { y = yy; break; }
        }
      }
      if (y < 1 || y >= H - 3) continue;
      if (SOLID[world.get(x, y, z)] || SOLID[world.get(x, y + 1, z)] || !SOLID[world.get(x, y - 1, z)] || world.get(x, y - 1, z) === B.LEAVES || world.get(x, y - 1, z) === B.GLOOMLEAF) continue;
      const [s, b] = world.lightAt(x, y, z);
      const wildDay = !night && ['mire', 'barrens', 'wood', 'salt', 'frost'].includes(regionAt(x).id); // these lands are dangerous in daylight too
      if (((s / 15) * (s / 15) * sunNow > 0.12 && !wildDay) || b >= 4) continue;
      if (colonySafe(x, z)) continue;
      if (Math.hypot(x - P.pos.x, y - P.pos.y, z - P.pos.z) < 12) continue;
      const under = y < top - 3;
      const sm = spawnMob(regionalType(x, under, night), x + 0.5, y, z + 0.5);
      if (sm.type === 'ghoul' && Math.random() < 0.35) sm.dormant = true;
      break;
    }
  }
  // wolf packs roam the wilds outside the walls — lone wolves early on, small packs later
  const K = world.castle, inCastle = (x, z) => x > K.x0 - 12 && x < K.x1 + 12 && z > K.z0 - 12 && z < K.z1 + 12;
  const nearCamp = Math.hypot(P.pos.x - world.camp.x, P.pos.z - world.camp.z) < 45;
  if (!inCastle(P.pos.x, P.pos.z) && !nearCamp && S.quest >= 4 && mobs.filter(m => m.type === 'wolf').length < (S.level >= 3 ? 3 : 2) && Math.random() < (night ? 0.03 : 0.04)) {
    for (let a = 0; a < 8; a++) {
      const ang = Math.random() * Math.PI * 2, r = 28 + Math.random() * 14;
      const x = Math.floor(P.pos.x + Math.cos(ang) * r), z = Math.floor(P.pos.z + Math.sin(ang) * r);
      if (x < 6 || z < 6 || x >= W - 6 || z >= D - 6 || inCastle(x, z) || Math.hypot(x - world.camp.x, z - world.camp.z) < 30) continue;
      const y = world.topSolid(x, z) + 1, gb = world.get(x, y - 1, z);
      if (gb !== B.GRASS && gb !== B.DIRT && gb !== B.MUD) continue;
      const pack = S.level >= 3 ? 1 + roll(2) : 1;
      for (let k = 0; k < pack; k++) {
        const wx = x + 0.5 + (k % 2) * 1.2, wz = z + 0.5 + Math.floor(k / 2) * 1.2;
        if (!collides(world, wx, y, wz, 0.35, 0.95)) spawnMob('wolf', wx, y, wz);
      }
      if (P.pos.distanceTo(new THREE.Vector3(x, y, z)) < 45) snd.growl(panFor({ x, z }), 0.3);
      break;
    }
  }
  // the Pale Watcher: later nights, once per night
  if (night && S.day >= 2 && S.time > 0.66 && S.time < 0.94 && !S.watcherTonight && !mobs.some(m => m.type === 'watcher') && Math.random() < 0.08) {
    for (let a = 0; a < 12; a++) {
      const ang = yaw + (Math.random() - 0.5) * 1.6, r = 20 + Math.random() * 10; // behind the player
      const x = P.pos.x + Math.sin(ang) * r, z = P.pos.z + Math.cos(ang) * r;
      const ix = Math.floor(x), iz = Math.floor(z);
      if (ix < 1 || iz < 1 || ix >= W - 1 || iz >= D - 1) continue;
      for (let dy = 6; dy >= -8; dy--) {
        const y = Math.floor(P.pos.y) + dy;
        if (SOLID[world.get(ix, y - 1, iz)] && !collides(world, x, y, z, 0.35, 2.7)) {
          spawnMob('watcher', x, y, z); S.watcherTonight = true;
          snd.whisper(panFor({ x, z }), 1.2);
          return;
        }
      }
    }
  }
}

// ================================================================ the castle garrison: placed foes that stand at their posts
let postT = 0;
function updatePosts(dt) {
  postT -= dt; if (postT > 0) return; postT = 0.5;
  const posts = world.posts || [];
  for (let i = 0; i < posts.length; i++) {
    if (S.postsDead[i]) continue;
    const pm = postMob[i];
    if (pm && !pm.dead) continue;
    const p = posts[i];
    if (Math.hypot(p.x - P.pos.x, p.y - P.pos.y, p.z - P.pos.z) > 38) continue;
    let y = -1;
    for (let dy = 2; dy >= -4; dy--) {
      const yy = Math.floor(p.y) + dy, ix = Math.floor(p.x), iz = Math.floor(p.z);
      if (!SOLID[world.get(ix, yy, iz)] && !SOLID[world.get(ix, yy + 1, iz)] && SOLID[world.get(ix, yy - 1, iz)]) { y = yy; break; }
    }
    if (y < 0) { S.postsDead[i] = true; continue; }
    const m = spawnMob(p.type, p.x, y, p.z);
    m.home = { x: p.x, z: p.z }; m.postIdx = i;
    if (m.type === 'ghoul' && Math.random() < 0.3) m.dormant = true;
    postMob[i] = m;
  }
}

// ================================================================ the living: context, guards, speech
const livingCtx = {
  strike(npc, m) {
    const d20 = roll(20), tot = d20 + 5;
    if (d20 === 20 || (d20 !== 1 && tot >= m.T.ac)) {
      const dmg = rollDice(1, 8) + 3; m.hp -= dmg; m.hurtT = 1; m.aware = true;
      if (npc.dist < 24) { floater(String(dmg), m.pos.clone().add(new THREE.Vector3(0, m.h + 0.3, 0)), '#ffcf8a'); snd.hit(); }
      if (m.hp <= 0) { if (npc.dist < 24) log(`${npc.def.name} cuts down the ${m.T.name}.`, 'good'); if (m.postIdx != null) S.postsDead[m.postIdx] = true; if (m.raider && S.raid) S.raid.killed++; removeMob(m); }
    } else if (npc.dist < 24) snd.miss();
  },
  bark(npc, line) { floater(line, npc.pos.clone().add(new THREE.Vector3(0, 2.25, 0)), '#e8dcc4', 3.2, true); },
  caw(c) { snd.caw(panFor(c.pos)); },
};

// ================================================================ dialogue, errands, trade
const compass = (dx, dz) => ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
function questText(q, s) {
  const bc = world.banditCamps?.[0];
  const dir = bc ? compass(bc.x - world.camp.x, bc.z - world.camp.z) : 'somewhere';
  return s.replaceAll('{DIR}', dir);
}
function questAvailable(id) { const q = SIDE_QUESTS[id], st = S.q[id]; if (q.requires && !q.requires(S)) return false; return !st || (st.state === 'done' && q.repeat); }
function questActive(id) { return S.q[id]?.state === 'active'; }
function questProgress(id) {
  const q = SIDE_QUESTS[id], st = S.q[id];
  if (q.need) return Object.entries(q.need).map(([k, n]) => `${itemName(k)} ${Math.min(count(k), n)}/${n}`).join(', ');
  if (q.needItem) return count(q.needItem) ? `${itemName(q.needItem)} found` : `${itemName(q.needItem)} not yet found`;
  if (q.kill) return Object.entries(q.kill).map(([t, n]) => `${MOB_TYPES[t].name} ${Math.min(n, (S.killsBy[t] || 0) - (st?.start[t] || 0))}/${n}`).join(', ');
  if (q.flag) return S.flags[q.flag] ? 'done' : 'not yet';
  return '';
}
function questReady(id) {
  const q = SIDE_QUESTS[id], st = S.q[id];
  if (!st || st.state !== 'active') return false;
  if (q.need) return Object.entries(q.need).every(([k, n]) => count(k) >= n);
  if (q.needItem) return count(q.needItem) > 0;
  if (q.kill) return Object.entries(q.kill).every(([t, n]) => (S.killsBy[t] || 0) - (st.start[t] || 0) >= n);
  if (q.flag) return !!S.flags[q.flag];
  return false;
}
function acceptQuest(id) {
  S.q[id] = { state: 'active', start: { ...S.killsBy }, times: S.q[id]?.times || 0 };
  if (!S.tracked || !questActive(S.tracked)) { S.tracked = id; S.arrived = null; }
  log(`📜 New task: <b>${SIDE_QUESTS[id].name}</b> — ${questText(SIDE_QUESTS[id], SIDE_QUESTS[id].summary)}`, 'lore');
  snd.craft();
}
function turnInQuest(id) {
  const q = SIDE_QUESTS[id];
  if (q.need) for (const [k, n] of Object.entries(q.need)) removeItem(k, n);
  if (q.needItem) removeItem(q.needItem, 1);
  const got = [];
  for (const [k, n] of Object.entries(q.reward)) {
    if (k === 'upgrade') { S.wpnBonus = Math.min(3, (S.wpnBonus || 0) + n); got.push(`weapon honed to +${S.wpnBonus}`); }
    else { addItem(k, n); got.push(`${n} ${itemName(k)}`); }
  }
  S.q[id] = { state: 'done', start: {}, times: (S.q[id]?.times || 0) + 1 };
  if (S.tracked === id) { S.tracked = Object.keys(S.q).find(k => questActive(k)) || null; S.arrived = null; }
  log(`✔ Task complete: <b>${q.name}</b>. Received ${got.join(', ')}.`, 'good');
  snd.levelup(); gainXP(q.xp, q.name);
}
let rumorI = {};
function openTalk(npc) {
  talkNpc = npc; ui = 'talk'; mouse.left = false; guarding = false;
  if (document.pointerLockElement) document.exitPointerLock();
  const g = npc.def.greet;
  const mq = QUESTS[S.quest], tk = mq?.talk;
  if (tk && tk.npc === npc.id && !S.flags[tk.flag]) {
    if (tk.need && !Object.entries(tk.need).every(([k, n]) => count(k) >= n)) renderTalk(tk.wait);
    else {
      if (tk.need && !tk.keep) for (const [k, n] of Object.entries(tk.need)) removeItem(k, n);
      const got = [];
      for (const [k, n] of Object.entries(tk.gift || {})) { addItem(k, n); got.push(`${n} ${itemName(k)}`); }
      S.flags[tk.flag] = true;
      tk.fn?.();
      if (got.length) { log(`${npc.def.name} gives you ${got.join(', ')}.`, 'good'); snd.pickup(); }
      renderTalk(typeof tk.say === 'function' ? tk.say() : tk.say);
    }
  } else renderTalk(g[roll(g.length) - 1]);
  show('talk');
}
function closeTalk() { talkNpc = null; ui = 'none'; show(null); requestLock(); }
function talkOptions(list) {
  $('talkOpts').innerHTML = list.map((o, i) => `<button class="opt" data-i="${i}"${o.disabled ? ' disabled' : ''}><span class="k">${i + 1}</span>${o.label}</button>`).join('');
  talkActs = list;
}
let talkActs = [];
function renderTalk(text) {
  const n = talkNpc, d = n.def;
  $('talkName').textContent = d.name; $('talkTitle').textContent = d.title;
  $('talkText').innerHTML = `“${escapeHTML(text)}”`;
  $('talkShop').innerHTML = '';
  const opts = [];
  opts.push({ label: 'What news?', act: () => { const r = d.rumors; rumorI[n.id] = ((rumorI[n.id] ?? -1) + 1) % r.length; renderTalk(r[rumorI[n.id]]); } });
  for (const id of d.quests || []) {
    const q = SIDE_QUESTS[id];
    if (questReady(id)) opts.push({ label: `✔ ${q.name} — it's done`, act: () => { turnInQuest(id); renderTalk(questText(q, q.done)); } });
    else if (questActive(id)) opts.push({ label: `… ${q.name} <span class="dim">(${questProgress(id)})</span>`, act: () => renderTalk(questText(q, q.progress)) });
    else if (questAvailable(id)) opts.push({ label: `📜 ${S.q[id] ? 'Another job? ' : ''}${q.name}`, act: () => renderOffer(id) });
  }
  if (d.shop) opts.push({ label: '⚖ Trade', act: () => renderShop() });
  if (d.service === 'heal') opts.push({ label: `✚ Tend my wounds (10 gold)${S.hp >= S.maxHp ? ' — you are unhurt' : ''}`, disabled: count('gold') < 10 || S.hp >= S.maxHp, act: () => { removeItem('gold', 10); S.hp = S.maxHp; S.dread = Math.max(0, S.dread - 40); snd.drink(); renderTalk('There. Breathe slowly. The dark can wait a little longer.'); } });
  if (d.service === 'hone') opts.push({ label: '⚒ Reinforce and infuse weapons', act: () => renderForge() });
  if (n.id === 'maren') opts.push({ label: `🏗 Colony projects <span class="dim">(${colonyRank()})</span>`, act: () => renderColony() });
  opts.push({ label: 'Farewell', act: closeTalk });
  talkOptions(opts);
}
function renderOffer(id) {
  const q = SIDE_QUESTS[id];
  $('talkText').innerHTML = `“${escapeHTML(questText(q, q.offer))}”<div class="reward">Reward: ${Object.entries(q.reward).map(([k, n]) => k === 'upgrade' ? 'a honed weapon' : `${n} ${itemName(k)}`).join(', ')} · ${q.xp} XP</div>`;
  talkOptions([
    { label: 'I\'ll do it.', act: () => { acceptQuest(id); renderTalk(questText(q, q.progress)); } },
    { label: 'Not now.', act: () => renderTalk('Suit yourself.') },
  ]);
}
function renderShop() {
  const sh = SHOPS[talkNpc.def.shop];
  $('talkText').innerHTML = `“Have a look.” <span class="dim">You carry ${count('gold')} gold.</span>`;
  const buy = sh.sell.map(([k, p, q = 1], i) => `<div class="recipe"><div class="slot" style="width:38px;height:38px;font-size:20px">${itemIcon(k)}</div><div class="nm">${q > 1 ? q + '× ' : ''}${itemName(k)}<div class="need">${p} gold</div></div><button data-buy="${i}" ${count('gold') >= p ? '' : 'disabled'}>Buy</button></div>`).join('');
  const sellKeys = Object.keys(sh.buys).filter(k => count(k) > 0);
  const sell = sellKeys.map(k => `<div class="recipe"><div class="slot" style="width:38px;height:38px;font-size:20px">${itemIcon(k)}</div><div class="nm">${itemName(k)} <span class="dim">×${count(k)}</span><div class="need">${sh.buys[k]} gold each</div></div><button data-sell="${k}">Sell 1</button></div>`).join('') || '<div class="dim">Nothing they want.</div>';
  $('talkShop').innerHTML = `<div class="row"><div class="col"><h3>Buy</h3>${buy}</div><div class="col"><h3>Sell</h3>${sell}</div></div>`;
  talkOptions([{ label: 'Back', act: () => renderTalk('Anything else?') }]);
}
$('talkShop').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !talkNpc) return;
  if (b.dataset.buy == null && !b.dataset.sell) return;
  const sh = SHOPS[talkNpc.def.shop];
  if (b.dataset.buy != null) { const [k, p, q = 1] = sh.sell[+b.dataset.buy]; if (count('gold') >= p) { removeItem('gold', p); buying = true; addItem(k, q); buying = false; wearBought(k); snd.pickup(); } }
  if (b.dataset.sell) { const k = b.dataset.sell; if (count(k)) { removeItem(k, 1); if (sh.buys[k]) addItem('gold', sh.buys[k]); snd.pickup(); } }
  renderShop();
});
$('talkOpts').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) talkActs[+b.dataset.i]?.act(); });
addEventListener('keydown', e => {
  if (ui !== 'talk') return;
  if (e.code === 'Escape' || e.code === 'KeyE') { closeTalk(); return; }
  if (e.code.startsWith('Digit')) { const o = talkActs[+e.code.slice(5) - 1]; if (o && !o.disabled) o.act(); }
});

// ================================================================ the hunted: crouching, cover, hiding places, the thing on your trail
let crouch = false, eyeH = 1.62, hideSpot = null, inCover = false, stillT = 0, beatT = 0, huntMsgT = 0;
const _pv = new THREE.Vector3();
function setCrouch(on) {
  if (hideSpot || state !== 'play') return;
  crouch = on; snd.rustle(0.35);
  if (on) hint('crouch', '<b>Crouched</b> [Ctrl to stand]: slow and quiet. Things notice you from half as far.<br>Crouch inside a <b>bramble thicket</b> and keep still to vanish.', 11);
}
// how loud and how visible you are
function noiseMult() {
  let k = 1; const sp = Math.hypot(P.vel.x, P.vel.z);
  if (crouch) k *= 0.5; else if (sp > 5) k *= 1.35;
  if (sp < 0.4) k *= 0.75;
  if (inCover) k *= crouch ? 0.4 : 0.75;
  if (S.cls === 'rogue') k *= 0.8;
  if (eqItem('legs') === 'boots') k *= 0.85;
  return k;
}
// what a creature notices. 1 = it has you
function perceive(m) {
  if (state !== 'play' || ui === 'resting' || S.shadowT > 0) return 0;
  if (hideSpot) return hideSpot.spotted === m && m.dist < 2.6 ? 1 : 0;
  if (inCover && crouch && stillT > 0.6 && m.dist > 1.6) return 0;
  if (m.type === 'watcher') return 1;
  const T = m.T, night = sunNow < 0.35, gloam = ACCURSED.has(m.type);
  let R = T.sense * noiseMult() * (m.hunter ? 1.35 : 1);
  if (gloam && !night) R *= 0.6;                         // daylight dazzles the Gloam-kept
  if (lightHere < 0.1 && !lanternActive()) R *= 0.8;     // a dark shape in the dark
  const torch = heldKey() === 'b12';
  if (gloam && night && (lanternActive() || torch)) {
    // any light carried through the night draws them like moths: to them it looks like the Lumen they lost
    R = Math.max(R, (lanternActive() ? 34 : 24) * (count('veillamp') ? 0.5 : 1));
  } else if (lanternActive()) R *= 1.3;
  if (m.dist > R || Math.abs(m.pos.y - P.pos.y) > 8) return 0;
  if (m.dist < Math.max(2.4, R * 0.28)) return 1;         // heard, smelled
  // eyes: an idle creature has to be facing you (unless your lantern is burning in the dark), and nothing can stand between
  if (!m.aware && !m.lastKnown) {
    const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw), tx = P.pos.x - m.pos.x, tz = P.pos.z - m.pos.z, tl = Math.hypot(tx, tz) || 1;
    if ((fx * tx + fz * tz) / tl < -0.25 && !(gloam && night && lanternActive())) return 0;
  }
  return world.los(_pv.set(m.pos.x, m.pos.y + m.h * 0.85, m.pos.z), eye) ? 1 : 0;
}

// the view from inside a thicket: drawn once, dense at the edges, a few stems across the middle
(function drawBushVeil() {
  const c = document.createElement('canvas'); c.width = 960; c.height = 600; const g = c.getContext('2d');
  let h = 1234567; const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const edge = () => { // a point, mostly near the borders
    for (;;) { const x = r(), y = r(), d = Math.max(Math.abs(x - 0.5) / 0.5, Math.abs(y - 0.5) / 0.5); if (r() < Math.pow(d, 2.2) + 0.03) return [x * 960, y * 600]; }
  };
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) { // thorny stems
    const [x0, y0] = edge(), a = Math.atan2(300 - y0, 480 - x0) + (r() - 0.5) * 1.2, L = 120 + r() * 260;
    g.strokeStyle = `rgba(${18 + r() * 14},${14 + r() * 10},${8 + r() * 6},.95)`; g.lineWidth = 3 + r() * 5;
    g.beginPath(); g.moveTo(x0, y0); const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L; g.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 80, (y0 + y1) / 2 + (r() - 0.5) * 80, x1, y1); g.stroke();
    for (let k = 0; k < 7; k++) { const t = r(), tx = x0 + (x1 - x0) * t, ty = y0 + (y1 - y0) * t, ta = a + (r() < 0.5 ? 1 : -1) * 1.1; g.lineWidth = 1.5; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.cos(ta) * 9, ty + Math.sin(ta) * 9); g.stroke(); }
  }
  for (let i = 0; i < 1400; i++) { // leaves
    const [x, y] = edge(), s = 10 + r() * 26, a = r() * Math.PI * 2, k = r();
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `rgba(${Math.round(10 + k * 26)},${Math.round(18 + k * 34)},${Math.round(10 + k * 16)},${0.82 + r() * 0.18})`;
    g.beginPath(); g.ellipse(0, 0, s, s * 0.42, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
    g.restore();
  }
  const v = g.createRadialGradient(480, 300, 160, 480, 300, 620); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = v; g.fillRect(0, 0, 960, 600);
  const el = document.getElementById('bushVeil'); if (el) el.style.backgroundImage = `url(${c.toDataURL()})`;
})();
// ---- wardrobes: step in [right mouse], keep still, step out [Space / right mouse]
function enterHide(t) {
  if (hideSpot) return;
  const isLog = world.get(t.x, t.y, t.z) === B.HOLLOWLOG;
  let y = t.y;
  if (!isLog) {
    if (world.get(t.x, y - 1, t.z) === B.WARDROBE) y--;
    if (world.get(t.x, y + 1, t.z) !== B.WARDROBE) { log('Too small to hide in. A wardrobe must stand two blocks tall.', 'miss'); return; }
  }
  let nx = t.nx, nz = t.nz;
  if (!nx && !nz) { const dx = P.pos.x - (t.x + 0.5), dz = P.pos.z - (t.z + 0.5); if (Math.abs(dx) > Math.abs(dz)) nx = Math.sign(dx); else nz = Math.sign(dz) || 1; }
  const door = { x: t.x + 0.5 + nx * 0.95, y, z: t.z + 0.5 + nz * 0.95 };
  if (collides(world, door.x, door.y, door.z, P.half, P.h)) { log(isLog ? 'There is no room to crawl in from this side.' : 'There is no room to open the door.', 'miss'); return; }
  // were you seen going in?
  const seer = mobs.filter(m => !m.dead && m.aware && m.per && m.dist < 18).sort((a, b) => a.dist - b.dist)[0] || null;
  if (seer) seer.lastKnown = { ...door };
  hideSpot = { x: t.x, y, z: t.z, door, yaw0: Math.atan2(-nx, -nz), spotted: seer, kind: isLog ? 'log' : 'wardrobe' };
  P.pos.set(t.x + 0.5, y, t.z + 0.5); P.vel.set(0, 0, 0); crouch = false;
  yaw = hideSpot.yaw0; pitch = 0; mouse.left = false; guarding = false; draw = 0;
  if (S.lanternOn) { S.lanternOn = false; snd.lantern(false); }
  if (isLog) { snd.rustle(0.8); $('logVeil').style.opacity = 1; } else { snd.creak(); $('hideVeil').style.opacity = 1; }
  if (isLog) log(seer ? `You wriggle into the log. The ${seer.T.name} saw you do it.` : 'You crawl into the hollow log, belly to the rot, and lie still.', seer ? 'bad' : 'lore');
  else log(seer ? `You pull the door shut. The ${seer.T.name} saw you go in.` : 'You pull the wardrobe door shut and hold your breath.', seer ? 'bad' : 'lore');
  hint('hide', 'You are <b>hidden</b>. Keep still: whatever is hunting you will search, and give up.<br>If it <b>saw you go in</b>, it will come and drag you out. <b>Space</b> or <b>right mouse</b> gets you out.', 11);
}
function exitHide() {
  const h = hideSpot; if (!h) return;
  hideSpot = null;
  P.pos.set(h.door.x, h.door.y, h.door.z); P.vel.set(0, 0, 0); airPeak = P.pos.y;
  $('hideVeil').style.opacity = 0; $('logVeil').style.opacity = 0;
  if (h.kind === 'log') snd.rustle(0.8); else snd.creak();
}
function updateHide(dt) {
  const fx = Math.floor(P.pos.x), fz = Math.floor(P.pos.z), fy = Math.floor(P.pos.y);
  inCover = !hideSpot && (world.get(fx, fy, fz) === B.THICKET || world.get(fx, fy + 1, fz) === B.THICKET);
  stillT = Math.hypot(P.vel.x, P.vel.z) < 0.3 ? stillT + dt : 0;
  {
    const bk = !hideSpot && inCover && crouch ? (stillT > 0.6 ? 1 : 0.5) : 0;
    if (bk !== updateHide.bk) { updateHide.bk = bk; $('bushVeil').style.opacity = bk; }
  }
  if (inCover) hint('thicket', 'You are in a <b>bramble thicket</b>. Crouch <b>[Ctrl]</b> and keep still, and nothing will see you here.', 9);
  // your heart, when something hunts close by and you are trying not to be found
  let near = 99;
  for (const m of mobs) if (!m.dead && ACCURSED.has(m.type) && (m.lastKnown || m.aware)) near = Math.min(near, m.dist);
  if ((hideSpot || (inCover && crouch) || crouch) && near < 14) {
    beatT -= dt;
    if (beatT <= 0) { const k = clamp(1 - near / 14, 0.15, 1); beatT = 1.05 - k * 0.5; snd.heartbeat(0.5 + k * 0.6); }
  }
  if (!hideSpot) return;
  const sp = hideSpot.spotted;
  if (sp && (sp.dead || !mobs.includes(sp))) hideSpot.spotted = null;
  else if (sp && Math.hypot(sp.pos.x - hideSpot.door.x, sp.pos.z - hideSpot.door.z) < 2.2) {
    // it saw you go in
    const door = hideSpot.door, h0kind = hideSpot.kind; exitHide();
    sp.aware = true; sp.lostT = 0; sp.cd = 0; sp.yaw = Math.atan2(P.pos.x - sp.pos.x, P.pos.z - sp.pos.z);
    snd.screech(panFor(sp.pos), 1); snd.jolt(); fadeFlash(120); shakeT = 0.6; S.dread = Math.min(100, S.dread + 20);
    log(h0kind === 'log' ? `The ${sp.T.name} reaches into the log and drags you out by the ankle!` : `The ${sp.T.name} tears the door open and drags you out!`, 'bad');
    G.mobAttack(sp);
  }
}

// ---- the hunt: something picks up your trail, day or night — fewer and slower by day
let hunter = null, huntT = 70, tenseK = 0, chaseK = 0;
function huntType(x, z, under, night) {
  const r = regionAt(x).id, K = world.castle;
  const inCastle = x > K.x0 - 6 && x < K.x1 + 6 && z > K.z0 - 6 && z < K.z1 + 6;
  if (r === 'moor') return 'wendigo';
  if (r === 'mire') return 'mirekin';
  if (r === 'wood') return 'barkkin';
  if (r === 'salt') return 'drowned';
  if (r === 'frost') return 'rimed';
  if (r === 'barrens') return Math.random() < 0.65 ? 'cinder' : 'crawler';
  if (inCastle && under) return 'crawler';
  return night && Math.random() < 0.5 ? 'ghoul' : 'crawler';
}
function callOff(m, txt) {
  m.leaving = true; m.aware = false; m.lastKnown = null; m.searchT = 0;
  const ax = m.pos.x - P.pos.x, az = m.pos.z - P.pos.z, al = Math.hypot(ax, az) || 1;
  m.goal = { x: clamp(m.pos.x + ax / al * 60, 2, W - 2), z: clamp(m.pos.z + az / al * 60, 2, D - 2) };
  if (txt && m.dist < 45) log(`The ${m.T.name} ${txt}.`, 'lore');
}
// are you looking right at it, and could you make it out (its eyes shine in the dark)?
function seenByPlayer(m) {
  const tx = m.pos.x - eye.x, ty = m.pos.y + m.h * 0.7 - eye.y, tz = m.pos.z - eye.z, d = Math.hypot(tx, ty, tz) || 1;
  if ((tx * look.x + ty * look.y + tz * look.z) / d < 0.6) return false;
  if (!(mobVisible(m) || (m.eyes?.length && d < 28))) return false;
  return world.los(eye, new THREE.Vector3(m.pos.x, m.pos.y + m.h * 0.7, m.pos.z));
}
function huntSpot(r0, r1) {
  for (let a = 0; a < 14; a++) {
    const ang = yaw + (Math.random() - 0.5) * 2.2, r = r0 + Math.random() * (r1 - r0); // somewhere behind you
    const x = P.pos.x + Math.sin(ang) * r, z = P.pos.z + Math.cos(ang) * r, ix = Math.floor(x), iz = Math.floor(z);
    if (ix < 2 || iz < 2 || ix >= W - 2 || iz >= D - 2 || colonySafe(ix, iz)) continue;
    const top = world.topSolid(ix, iz), under = P.pos.y < top - 4;
    let y = -1;
    if (!under) y = top + 1;
    else for (let dy = 4; dy >= -6; dy--) { const yy = Math.floor(P.pos.y) + dy; if (!SOLID[world.get(ix, yy, iz)] && !SOLID[world.get(ix, yy + 1, iz)] && SOLID[world.get(ix, yy - 1, iz)]) { y = yy; break; } }
    if (y < 2 || y >= H - 3 || SOLID[world.get(ix, y, iz)] || SOLID[world.get(ix, y + 1, iz)] || Math.abs(y - P.pos.y) > 5) continue;
    if (world.los(_pv.set(ix + 0.5, y + 1.6, iz + 0.5), eye)) continue; // never in plain view
    return { x: ix + 0.5, y, z: iz + 0.5, under };
  }
  return null;
}
function updateHunt(dt) {
  if (hunter && (hunter.dead || !mobs.includes(hunter))) { hunter = null; huntT = (sunNow < 0.35 ? 150 : 260) + Math.random() * 120; }
  const night = sunNow < 0.35, safe = colonySafe(P.pos.x, P.pos.z);
  tenseK = Math.max(0, tenseK - dt * 0.2);
  if (!hunter) {
    if (safe || !(S.flags.villageDone || S.day >= 2) || ui === 'resting' || boss || S.raid?.active || hideSpot) return;
    huntT -= dt * (night ? 1 : 0.6) * (night && isWhisperNight() ? 1.5 : 1);
    if (huntT > 0) return;
    huntT = 12; // no spot this time: try again soon
    const sp = huntSpot(24, 34); if (!sp) return;
    const m = spawnMob('taker', sp.x, sp.y, sp.z, Math.max(zoneLevel(sp.x, sp.y, sp.z) + 8, S.level + 25));
    m.patience = 20 + Math.random() * 14; m.hidT = 0;
    m.hunter = true; m.stalk = true; m.stalkT = night ? 35 + Math.random() * 35 : 55 + Math.random() * 50;
    m.scentT = 0; m.huntAge = 0; m.losses = 0; m.cueT = 2 + Math.random() * 3; m.holdT = 0; m.glimpses = 0;
    hunter = m;
    if (!S.flags.stalkedOnce) { S.flags.stalkedOnce = true; msg('Something is following you', 'Listen: lanterns clinking, far behind you. It keeps just out of sight.<br>When it comes for you, <b>do not fight it</b>. Run, break its line of sight, and <b>hide</b> until it gives up:<br>a wardrobe in an old house, a hollow log, or crouch still in a bramble thicket.', 11); }
    else log(['Somewhere behind you, something has started to follow.', 'Far back, something breathes in time with your steps.', 'You have the feeling of being counted.', 'A twig breaks behind you. Then another, closer.'][roll(4) - 1], 'bad');
    S.dread = Math.min(100, S.dread + 5);
    return;
  }
  const m = hunter; m.huntAge += dt;
  if (m.leaving) { if (m.dist > 46) removeMob(m); return; }
  if (safe) { callOff(m, 'stops at the edge of the Landing\'s light, and slinks away'); return; }
  const hidden = hideSpot || (inCover && crouch && stillT > 1);
  if (m.stalk) {
    tenseK = Math.max(tenseK, clamp(1.1 - m.dist / 34, 0.3, 0.85));
    m.stalkT -= dt * (night && lanternActive() ? 1.6 : 1);
    if (m.holdT > 0) {
      // caught looking: it stands and stares, then slips away sideways
      m.holdT -= dt; m.lastKnown = null;
      if (m.holdT <= 0) {
        const ax = m.pos.x - P.pos.x, az = m.pos.z - P.pos.z, al = Math.hypot(ax, az) || 1, sd = Math.random() < 0.5 ? 1 : -1;
        m.lastKnown = { x: m.pos.x - az / al * sd * 8 + ax / al * 5, y: m.pos.y, z: m.pos.z + ax / al * sd * 8 + az / al * 5 };
        m.goT = 0; m.scentT = 3.5; m.sprintT = 0.7; snd.skitter(panFor(m.pos), 0.5);
      }
    } else {
      m.scentT -= dt;
      if (m.scentT <= 0) {
        m.scentT = 1.2;
        // it works its way round behind you and keeps its distance
        const cur = Math.atan2(m.pos.x - P.pos.x, m.pos.z - P.pos.z);
        let da = yaw - cur; da = Math.atan2(Math.sin(da), Math.cos(da));
        const ang = cur + clamp(da, -0.7, 0.7) + (Math.random() - 0.5) * 0.3, r = 13 + Math.random() * 6;
        m.lastKnown = { x: P.pos.x + Math.sin(ang) * r, y: P.pos.y, z: P.pos.z + Math.cos(ang) * r }; m.goT = 0; m.searchT = 0;
      }
      if (m.dist < 36 && seenByPlayer(m)) {
        m.holdT = 0.9 + Math.random() * 0.9; m.glimpses++; m.stalkT -= 6;
        S.dread = Math.min(100, S.dread + 6); snd.breath(panFor(m.pos), clamp(1.3 - m.dist / 30, 0.3, 1));
        if (m.glimpses === 1) log(`Behind you, something is standing perfectly still, watching you. The ${m.T.name}.`, 'bad');
      }
      // fallen far behind: it circles round, out of sight
      // stuck in a hollow, or left far behind: it circles round, out of sight
      m.lagT = m.dist > 21 ? (m.lagT || 0) + dt : 0;
      if (m.dist > 46 || m.lagT > 10) { const sp = huntSpot(16, 26); if (sp) { m.pos.set(sp.x, sp.y, sp.z); m.vel.set(0, 0, 0); m.path = null; m.lagT = 0; } }
    }
    // it lets you hear it
    m.cueT -= dt;
    if (m.cueT <= 0) {
      m.cueT = 4 + Math.random() * 7;
      const pan = panFor(m.pos), v = clamp(1.4 - m.dist / 28, 0.25, 1), c = roll(4);
      if (c === 1) snd.twig(pan, v); else if (c === 2) snd.footfall(pan, v); else if (c === 3) snd.breath(pan, v * 0.8); else snd.sniff(pan, v);
    }
    // the pretence ends: too close, struck, or simply time
    if (m.stalkT <= 0 || m.dist < 7 || m.hp < m.maxHp) {
      m.stalk = false; m.holdT = 0; m.huntAge = 0;
      if (hidden) { m.lastKnown = { x: P.pos.x + (Math.random() - 0.5) * 6, y: P.pos.y, z: P.pos.z + (Math.random() - 0.5) * 6 }; m.goT = 0; log('The footsteps behind you stop. It is close, and it is looking for you. Keep still.', 'bad'); }
      else {
        m.aware = true; m.lostT = 0; m.lastKnown = null; m.sprintT = (m.T.charge || 1) + 1.2; G.onAware(m);
        snd.stinger(); shakeT = Math.max(shakeT, 0.3); S.dread = Math.min(100, S.dread + 10);
        log(m.T.giant ? '<b>It stops pretending. It is coming.</b> You cannot fight it. <b>Run. Break its sight. Hide.</b>' : '<b>It stops pretending. It is coming.</b> Run, fight, or find somewhere to hide.', 'bad');
      }
    }
    return;
  }
  if (m.T.giant) {
    tenseK = Math.max(tenseK, clamp(1.2 - m.dist / 40, 0.35, 1));
    if (hidden) {
      // you have vanished: it hunts the ground where it lost you, closer and closer, until its patience runs out
      m.hidT += dt; m.scentT -= dt;
      if (!m.aware && m.scentT <= 0) {
        m.scentT = 3 + Math.random() * 2.5;
        const r = 2 + Math.random() * Math.max(2, 9 - m.hidT * 0.25), a = Math.random() * 6.28;
        m.lastKnown = { x: P.pos.x + Math.sin(a) * r, y: P.pos.y, z: P.pos.z + Math.cos(a) * r }; m.goT = 0; m.searchT = 0;
      }
      if (m.hidT > 6 && !m.hidMsg && m.dist < 30) { m.hidMsg = true; log('It is right outside. Lanterns clinking, the floor shaking. Do not move.', 'bad'); }
      if (m.hidT > m.patience && !m.aware) {
        callOff(m, 'stands a long while, listening. Then the clink of its lanterns moves off into the dark');
        S.dread = Math.max(0, S.dread - 15); hint('takerGone', 'It gave up. The Lantern-Taker always does, <b>if it cannot find you</b>.', 8);
      }
    } else {
      // out in the open it always finds your trail again
      m.hidT = Math.max(0, m.hidT - dt * 3); m.hidMsg = false;
      if (!m.aware) { m.scentT -= dt; if (m.scentT <= 0) { m.scentT = night ? 1.5 : 2.5; m.lastKnown = { x: P.pos.x, y: P.pos.y, z: P.pos.z }; m.goT = 0; m.searchT = 0; } }
      // you can outrun it, but not for long: left far behind, it comes round through the dark and is close behind you again
      m.farT = m.dist > 44 && !m.aware ? (m.farT || 0) + dt : 0;
      if (m.farT > 6 || m.dist > 75) {
        const sp = huntSpot(24, 34);
        if (sp) { m.pos.set(sp.x, sp.y, sp.z); m.vel.set(0, 0, 0); m.path = null; m.farT = 0; snd.chains(panFor(m.pos), 0.8); log(['Lanterns clink somewhere behind you. Closer than they should be.', 'You did not lose it. It is behind you again.', 'The ground shakes behind you. It found your trail.'][roll(3) - 1], 'bad'); }
      }
    }
    return;
  }
  if (!m.aware && m.huntAge > (night ? 240 : 150)) { callOff(m, 'loses interest in you'); return; }
  m.scentT -= dt;
  // it follows your scent, roughly, until it sees you, unless you have vanished
  if (!m.aware && !(m.searchT > 0) && m.scentT <= 0) {
    m.scentT = night ? 5 : 9;
    if (!hidden) { const j = crouch ? 7 : 3; m.lastKnown = { x: P.pos.x + (Math.random() - 0.5) * 2 * j, y: P.pos.y, z: P.pos.z + (Math.random() - 0.5) * 2 * j }; m.goT = 0; }
  }
}

// ---- hiding places: where they are, and which is nearest when you need one
let hideList = null, hideNear = null, hideScanT = 0;
function scanHides() {
  hideList = [];
  const bl = world.blocks, WD = W * D;
  for (let i = WD; i < bl.length; i++) {
    const b = bl[i]; if (b !== B.WARDROBE && b !== B.THICKET && b !== B.HOLLOWLOG) continue;
    if (bl[i - WD] === b) continue; // one entry per stack
    const y = Math.floor(i / WD), r = i - y * WD, z = Math.floor(r / W);
    hideList.push([r - z * W, y, z, b]);
  }
}
function updateHideNear(dt) {
  hideScanT -= dt; if (hideScanT > 0) return; hideScanT = 0.8;
  if (!hideList) scanHides();
  let best = null, bd = 45;
  for (const h of hideList) {
    const d = Math.hypot(h[0] + 0.5 - P.pos.x, h[2] + 0.5 - P.pos.z);
    if (d < bd && Math.abs(h[1] - P.pos.y) < 6 && world.get(h[0], h[1], h[2]) === h[3]) { bd = d; best = h; }
  }
  hideNear = best ? { x: best[0], y: best[1], z: best[2], b: best[3], d: bd } : null;
  if (hideNear && hideNear.d < 9 && !hunter) hint('hidespot', `There's a <b>hiding place</b> close by: ${hideNear.b === B.WARDROBE ? 'an <b>old wardrobe</b> (right-click to step inside)' : hideNear.b === B.HOLLOWLOG ? 'a <b>hollow log</b> (right-click to crawl inside)' : 'a <b>bramble thicket</b> (crouch inside with Ctrl and keep still)'}.<br>When something hunts you, the nearest one is shown at the bottom of the screen.`, 12);
}
function hideArrow(h) {
  const dx = h.x + 0.5 - P.pos.x, dz = h.z + 0.5 - P.pos.z;
  const rx = dx * Math.cos(yaw) - dz * Math.sin(yaw), fy = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
  const o = Math.round(Math.atan2(rx, fy) / (Math.PI / 4));
  return ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][(o + 8) % 8];
}

// ---- the Rite of Return: what you can do instead of the killing blow, once the Sigil is yours
const riteCost = m => (m.bossId || m.T.boss ? 40 : m.T.xp >= 120 ? 18 : 10);
const RETURNED = {
  ghoul: { w: ['a weaver of the lower town', 'a lamplighter of Vharrow', 'a baker from the vale', 'a clerk of the Concord', 'a stablehand', 'a courtier of the Long Day', 'a midwife', 'a ferryman'], look: { skin: 0xc49a80, tunic: 0x6a5a48, pants: 0x4a4038, hair: 0x3a2a1c, belt: 0x3a2a1c } },
  crawler: { w: ['a chimney-sweep', 'a kitchen maid', 'a cellarman', 'a page of the court', 'a well-digger'], look: { skin: 0xb88a70, tunic: 0x58503e, pants: 0x403830, hair: 0x2a1e14, belt: 0x2e2218 } },
  knight: { w: ['a sergeant of the Bridge Guard', 'a knight of the Concord', 'a gatewarden'], look: { skin: 0xc09078, tunic: 0x4a4a52, pants: 0x3a3a40, armor: 0x7a7670, beard: 0x4a3a2a, belt: 0x2a1e14 } },
  wendigo: { w: ['a huntsman of the Western Lodge', 'a houndmaster', 'a tracker of the Lodge'], look: { skin: 0xb88a6c, tunic: 0x4a5236, pants: 0x3a3a2a, hood: 0x3a4230, beard: 0x5a4028, belt: 0x2a1e14 } },
  mirekin: { w: ['a gardener of the Glasswater', 'a glass-terrace keeper', 'a lily-diver', 'a seed-keeper'], look: { skin: 0xc49a7a, tunic: 0x4e6040, pants: 0x3a4632, hat: 0x6a5a3a, apron: 0x5a4a32, hair: 0x5a3a20 } },
  cinder: { w: ['a forge-hand of the Cinderworks', 'a bellows-boy', 'a lantern-smith', 'a furnace-singer'], look: { skin: 0xa87a60, tunic: 0x5a4232, pants: 0x3a2e26, apron: 0x3a2a1e, beard: 0x2a1e14, bald: true } },
  barkkin: { w: ['a charcoal-burner of the Weeping Wood', 'a woodwarden of the Concord', 'a resin-tapper', 'a forester\'s daughter'], look: { skin: 0xb88a6c, tunic: 0x4a4a32, pants: 0x3a3a2a, hood: 0x3a3a28, beard: 0x4a3420, belt: 0x2a1e14 } },
  drowned: { w: ['a deckhand of the First Landing', 'the ship\'s carpenter of the Constancy', 'a Lantern Company surgeon', 'a bosun of the First Landing', 'a cabin boy of the Constancy'], look: { skin: 0xc49a80, tunic: 0x3a4250, pants: 0x30343a, hat: 0x22262e, beard: 0x5a4028, belt: 0x2a1e14 } },
  rimed: { w: ['a star-monk of the Rimewatch', 'a lens-grinder of the Rimewatch', 'a novice of the Rimewatch', 'the abbey\'s bell-ringer'], look: { skin: 0xd0a890, robe: 0x5a5a6a, hair: 0x8a7a6a } },
  watcher: { w: ['an astronomer of Vharrow'], look: { skin: 0xd4b098, robe: 0x2a2a44, hair: 0xb8b0a0, beard: 0xb8b0a0 } },
  king: { w: ['the Lord of Vharrow'], look: { skin: 0xc8a088, robe: 0x4a1a1a, crown: 0x8a6a2a, beard: 0x9a948a, hair: 0x9a948a } },
};
const NAMES = ['Edric', 'Maud', 'Tobin', 'Ysolde', 'Corwin', 'Ama', 'Bertil', 'Hesk', 'Ilse', 'Jory', 'Lisbet', 'Merrow', 'Noll', 'Orla', 'Piet', 'Quenna', 'Roder', 'Sabeth', 'Teodor', 'Una', 'Wendel', 'Agathe', 'Benedek', 'Cass', 'Dorin', 'Elva', 'Falk', 'Gisla', 'Hanno', 'Imke'];
const LAST_WORDS = ['Is it morning?', 'I remember my name.', 'The light... it came back.', 'Tell my daughter I kept the lamp lit.', 'How long was I gone?', 'I was so hungry. I was so hungry for so long.', 'Thank you. Thank you.', 'Is the Festival over?', 'I can feel my hands.', 'Don\'t let them drink it. Don\'t let anyone drink it.', 'It was so dark.', 'I could hear myself the whole time.'];
const BOSS_WORDS = { wyll: 'Hobb...? Is the fire still lit?', bridgewarden: 'Two hundred years... and no one came to relieve the watch.', aldous: 'The dogs. Tell me I didn\'t... tell me the dogs got away.', matron: 'My gardens... are they still blooming?', foreman: 'Quota... met. Let the men rest.', king: 'I wanted them never to be afraid of the dark. I am so sorry.', astronomer: 'There it is. There is the moon.', warden: 'I only wanted the trees to stop leaning toward the house.', captain: 'We were ordered to drink it. Tell them that. Tell them who ordered it.', abbot: 'Is the sky clear? Then look east. Please. Look for me.' };
const returned = [];
function breakMob(m) {
  m.brokenOnce = true; m.brokenT = m.bossId || m.T.boss ? 8 : 6; m.aware = false; m.windT = 0; m.sprintT = 0;
  floater('KNEELS', m.pos.clone().add(new THREE.Vector3(0, m.h + 0.4, 0)), '#cfe6ff', 1.6);
  snd.breath(panFor(m.pos), 1);
  log(`The ${m.T.name} drops to its knees. <b>[H]</b> Rite of Return (${riteCost(m)} Lumen) — or strike it down.`, 'lore');
  hint('broken', 'It is <b>kneeling</b>. Whatever it was is close to the surface.<br><b>H</b> — the Rite of Return: spend Lumen to give it back its light.<br>Or strike, and take its light for yourself.', 12);
}
// after damage from you: at a quarter of its life, a Gloam-kept thing kneels instead of dying (once)
function checkBroken(m) {
  if (m.dead || m.brokenOnce || !S.flags.magic || !ACCURSED.has(m.type) || m.dormant) return false;
  if (m.hp > Math.ceil(m.maxHp * 0.25)) return false;
  if (m.hp <= 0) m.hp = 1;
  breakMob(m); return true;
}
function riteOfReturn() {
  if (!S.flags.magic || !count('sigil')) return;
  const m = mobs.filter(o => o.brokenT > 0 && !o.dead && o.dist < 4).sort((a, b) => a.dist - b.dist)[0];
  if (!m) { log('No one is kneeling close enough. Beat one of the Gloam-kept to its knees, then perform the Rite [H].', 'miss'); return; }
  const cost = riteCost(m);
  if ((S.aether || 0) < cost) { log(`The Rite needs ${cost} Lumen and you hold ${Math.floor(S.aether || 0)}. Lumen comes from the ones you kill. That is the cruelty of it.`, 'miss'); return; }
  S.aether -= cost;
  restoreMob(m);
}
function restoreMob(m) {
  snd.rite(); fadeFlash(220);
  const R = RETURNED[m.type] || RETURNED.ghoul;
  const work = R.w[Math.floor(Math.random() * R.w.length)];
  const name = m.bossId === 'wyll' ? 'Wyll' : m.bossId === 'aldous' ? 'Aldous' : m.type === 'king' ? 'Aurel' : NAMES[Math.floor(Math.random() * NAMES.length)];
  const words = BOSS_WORDS[m.bossId] || (m.type === 'king' ? BOSS_WORDS.king : LAST_WORDS[Math.floor(Math.random() * LAST_WORDS.length)]);
  // two hundred years arrive all at once; a few are young enough in the Gloam to survive it
  let lives = Math.random() < (S.colony?.built?.infirmary ? 0.45 : 0.25) * (m.type === 'ghoul' || m.type === 'crawler' ? 1 : 0.8);
  if (m.bossId && m.bossId !== 'wyll') lives = false;
  if (m.bossId === 'wyll') { lives = true; S.flags.wyllRestored = true; }
  if (m.type === 'king') S.flags.kingRestored = true;
  S.mercy = (S.mercy || 0) + 1; if (lives) S.saved = (S.saved || 0) + 1;
  S.names ??= []; S.names.push({ n: name, w: work, lives, day: S.day }); if (S.names.length > 300) S.names.shift();
  spawnReturned(m, R.look, lives);
  const over = m.pos.clone().add(new THREE.Vector3(0, 1.6, 0));
  setTimeout(() => floater(`“${words}”`, over, '#f2e6c8', 5, true), 700);
  log(`☀ <b>The Rite of Return.</b> The Gloam lets go. ${name}, ${work}, kneels where the ${m.T.name} was.`, 'lore');
  log(lives ? `${name} is weak, but alive. They will find their way to the Landing.` : `${name} was kept two hundred years. Freed, the years arrive all at once. They go gently, as themselves.`, lives ? 'good' : 'lore');
  if (S.mercy === 1) msg('The Rite of Return', `${name} remembers their name.`, 6);
  if (S.mercy === 6 && !count('veillamp')) { addItem('veillamp'); log('Brother Aldric sends a parcel from the Landing: a <b>Veiled Lamp</b>, stitched from the cloth of the ones you returned. Your lantern will call them from half as far.', 'good'); }
  if (S.mercy === 3 && !count('charm')) { addItem('charm'); log('One of the returned pressed something into your hand before the end: an <b>Ash-Blessed Charm</b>.', 'good'); }
  killMob(m, true);
}
function spawnReturned(m, look, lives) {
  const mat = makeMobMaterial();
  const rig = buildHuman(mat, { ...look, grime: 0.6, gore: 0, thin: 0.85, seed: Math.random() * 100 });
  const g = new THREE.Group(); g.add(rig.root); g.position.copy(m.pos); g.rotation.order = 'YXZ';
  g.rotation.y = Math.atan2(P.pos.x - m.pos.x, P.pos.z - m.pos.z);
  scene.add(g);
  returned.push({ g, rig, mat, t: 0, lives, walk: 0 });
}
function updateReturned(dt) {
  for (let i = returned.length - 1; i >= 0; i--) {
    const r = returned[i]; r.t += dt;
    const [ls, lb] = world.lightAt(Math.floor(r.g.position.x), Math.floor(r.g.position.y + 0.8), Math.floor(r.g.position.z));
    r.mat.uniforms.uLight.value.set(Math.max(ls / 15, 0.25), Math.max(lb / 15, 0.35)); // a little of the Lumen still on them
    const kneel = r.t < 4.5;
    if (kneel) { poseHuman(r.rig, 0, 0, { time: r.t, dt }); r.rig.root.position.y = -0.42; r.rig.root.rotation.x = 0.25; r.rig.head.rotation.x = r.t < 2.5 ? -0.3 : 0.2; }
    else if (r.lives) {
      // up, and away toward the fire
      r.rig.root.position.y = 0; r.rig.root.rotation.x = 0;
      const c = world.camp, dx = c.x - r.g.position.x, dz = c.z - r.g.position.z, dl = Math.hypot(dx, dz) || 1;
      r.g.rotation.y = Math.atan2(dx, dz); r.walk += dt * 3.2;
      r.g.position.x += dx / dl * 1.3 * dt; r.g.position.z += dz / dl * 1.3 * dt;
      const ty = world.topSolid(Math.floor(r.g.position.x), Math.floor(r.g.position.z)) + 1; if (Math.abs(ty - r.g.position.y) < 2) r.g.position.y += (ty - r.g.position.y) * Math.min(1, dt * 6);
      poseHuman(r.rig, r.walk, 1, { time: r.t, dt, limp: true });
    } else {
      // the years arrive: they settle into the ground like ash
      poseHuman(r.rig, 0, 0, { time: r.t, dt }); r.rig.root.position.y = -0.42 - (r.t - 4.5) * 0.35; r.rig.root.rotation.x = 0.25 + (r.t - 4.5) * 0.3;
    }
    const gone = r.lives ? (r.t > 16 || r.g.position.distanceTo(P.pos) > 50) : r.t > 8;
    if (gone) { scene.remove(r.g); r.g.traverse(o => o.geometry?.dispose()); r.mat.dispose(); returned.splice(i, 1); }
  }
}
// what it costs you to strike down one who kneels
const REMORSE = ['It looked up at you before the end. Its eyes were brown.', 'It said something as it fell. It might have been a name.', 'There was a ring on its finger, grown into the bone.', 'It didn\'t fight the blow. You tell yourself it was grateful.', 'Brannoc would call that a clean kill. It doesn\'t feel clean.', 'You wonder who waited for this one to come home.', 'It was humming. You knew the tune.', 'For a moment, kneeling, it looked like any tired traveller.'];
function executeMob(m) {
  atkCd = weapon().cd; startSwing(); snd.crit();
  S.executed = (S.executed || 0) + 1;
  const ai = Math.max(0, ACTS.findIndex(a => a.id === QUESTS[S.quest]?.act));
  log(`You bring your weapon down on the kneeling ${m.T.name}.`, 'bad');
  if (Math.random() < 0.35 + ai * 0.08) log(`<i>${REMORSE[Math.floor(Math.random() * REMORSE.length)]}</i>`, 'lore');
  S.dread = Math.min(100, S.dread + 3 + ai * 1.5);
  killMob(m);
}

// ================================================================ main update
function lanternActive() { return S.lanternOn && (S.cls === 'cleric' || S.oilT > 0); }
function update(dt) {
  gameT += dt; dodgeT -= dt; dodgeCd -= dt; quaffCd -= dt;
  // ---- time of day
  const dl = dayLenSec();
  S.time += dt / dl;
  if (S.time >= 1) newDay();
  const t = S.time;
  sunNow = sunAt(t); G.sun = sunNow;
  if (prevT < 0.5 && t >= 0.5) {
    msg('The sun is setting', isWhisperNight() ? 'Tonight is a Night of Whispers. More of them will come.' : 'Soon they come out, hungry for any light they can see.', 4.5);
    snd.whisper(-0.6, 0.6);
    hint('dusk', 'Night is falling, and it will be <b>pitch black</b>.<br><b>F</b> lights your lantern, but at night <b>any light you carry draws the Gloam-kept from far away</b>. Night vision is safer. The bonfire at Emberfall is safe: <b>right-click</b> it to rest until dawn.', 15);
  }
  if (prevT < 0.585 && t >= 0.585) { msg('Night', 'There is no moon. There is no light but yours.'); S.sawNight = true; snd.growl(0, 0.5); }
  if (prevT < 0.985 && t >= 0.985) msg('Dawn', 'The Gloam-kept flee the sun, into shade and under the earth. They still hunt from there.');
  prevT = t;

  // ---- player movement
  const sprint = (keys.ShiftLeft || keys.ShiftRight) && keys.KeyW && !guarding && !crouch;
  const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sn = Math.sin(yaw), cs = Math.cos(yaw);
  let vx = -sn * fwd + cs * str, vz = -cs * fwd - sn * str;
  const vl = Math.hypot(vx, vz); if (vl > 0) { vx /= vl; vz /= vl; }
  const fx0 = Math.floor(P.pos.x), fz0 = Math.floor(P.pos.z), fy0 = Math.floor(P.pos.y);
  const inWeb = world.get(fx0, fy0, fz0) === B.COBWEB || world.get(fx0, fy0 + 1, fz0) === B.COBWEB;
  const speed = (sprint ? 6.1 : crouch ? 2.2 : 4.3) * (inWeb ? 0.3 : 1) * (guarding ? 0.45 : 1);
  const ctrl = P.onGround ? 1 : 0.6;
  if (dodgeT <= 0) {
    P.vel.x += (vx * speed - P.vel.x) * Math.min(1, dt * 14 * ctrl);
    P.vel.z += (vz * speed - P.vel.z) * Math.min(1, dt * 14 * ctrl);
  }
  if (keys.Space && P.onGround && !hideSpot) P.vel.y = 8.2;
  P.vel.y = Math.max(-40, P.vel.y - 26 * dt);
  const ox = P.pos.x, oz = P.pos.z;
  if (hideSpot) P.vel.set(0, 0, 0);
  else {
    if (collides(world, P.pos.x, P.pos.y, P.pos.z, P.half, P.h)) P.pos.y += 1; // unstick
    moveBody(world, P, dt);
  }
  if (P.onGround) {
    const fall = airPeak - P.pos.y;
    if (fall > 4.2) { const dmg = Math.floor(fall - 3.2); log(`You fall ${fall.toFixed(0)} blocks and take ${dmg} damage.`, 'bad'); hurtPlayer(dmg, 'a fall'); }
    airPeak = P.pos.y;
    stepAcc += Math.hypot(P.pos.x - ox, P.pos.z - oz);
    if (stepAcc > (crouch ? 3.2 : 2.1)) { stepAcc = 0; if (!crouch) snd.step(underK > 0.5); else if (inCover) snd.rustle(0.25); }
  } else airPeak = Math.max(airPeak, P.pos.y);
  const cat = world.castle?.cat;
  if (cat && !S.flags.catacombs && P.pos.y < cat.y + 5 && P.pos.x > cat.x0 && P.pos.x < cat.x1 && P.pos.z > cat.z0 && P.pos.z < cat.z1) {
    S.flags.catacombs = true; msg('The Catacombs', 'The air is old here. Something breathes in the dark.', 4.5); snd.whisper(0, 1);
  }
  if (P.pos.y < -10) { P.pos.set(S.spawnPt.x, S.spawnPt.y, S.spawnPt.z); P.vel.set(0, 0, 0); }
  { const K = world.castle; if (!S.flags.inCastle && P.pos.z < K.z1 - 1 && P.pos.z > K.z0 && P.pos.x > K.x0 && P.pos.x < K.x1 && P.pos.y > K.G - 2) { S.flags.inCastle = true; msg('Vharrow', 'The castle that swallowed the moon.', 4.5); snd.whisper(0, 0.8); } }

  const bob = P.onGround ? Math.sin(performance.now() / 120) * 0.035 * Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 4) : 0;
  eyeH += ((hideSpot ? (hideSpot.kind === 'log' ? 0.42 : 1.3) : crouch ? 1.02 : 1.62) - eyeH) * Math.min(1, dt * 10);
  camera.position.set(P.pos.x, P.pos.y + eyeH + bob * (crouch ? 0.5 : 1), P.pos.z);
  shakeT = Math.max(0, shakeT - dt);
  const shk = shakeT * shakeT * 0.12;
  camera.rotation.set(pitch + (Math.random() - 0.5) * shk, yaw + (Math.random() - 0.5) * shk, (Math.random() - 0.5) * shk * 0.6);
  camera.getWorldDirection(look);
  { const f = 72 - 14 * draw; if (Math.abs(camera.fov - f) > 0.05) { camera.fov += (f - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix(); } }
  eye.copy(camera.position);

  // ---- lights carried
  if (S.lanternOn && S.cls !== 'cleric') {
    S.oilT -= dt;
    if (S.oilT <= 0) {
      if (count('oil')) { removeItem('oil'); S.oilT = 150; log('You refill the lantern from a flask.', 'good'); }
      else { S.oilT = 0; S.lanternOn = false; log('Your lantern gutters out. The dark rushes in.', 'bad'); snd.whisper(0, 1); }
    }
  }
  if (S.nvT > 0) { S.nvT -= dt; if (S.nvT <= 0) { S.nvT = 0; log('The elixir wears off. Your eyes are your own again.', 'miss'); } }
  if (S.gogOn) {
    S.gogT += dt;
    if (S.gogT >= 45) { S.gogT = 0; if (count('b13')) removeItem('b13'); else { S.gogOn = false; log('The goggles dim — no glowcaps left to burn.', 'bad'); } }
  }
  if (S.shadowT > 0) S.shadowT -= dt;
  const nvTarget = (S.nvT > 0 || S.gogOn) ? 1 : 0;
  nvLevel += (nvTarget - nvLevel) * Math.min(1, dt * 4);

  // ---- targeting, mining, attacking
  atkCd -= dt; swingT = Math.max(0, swingT - dt);
  target = world.raycast(eye, look, 5);
  targetMob = null; let best = target ? target.t : 4;
  for (const m of mobs) {
    if (m.dist > 6) continue;
    const tt = rayAABB(eye, look, m, 3.6);
    if (tt >= 0 && tt < best) { best = tt; targetMob = m; }
  }
  targetNpc = null;
  for (const n of npcs) {
    if (n.dist > 6) continue;
    const tt = rayAABB(eye, look, n, 4);
    if (tt >= 0 && tt < best) { best = tt; targetNpc = n; targetMob = null; }
  }
  if (hideSpot) { mouse.left = false; mine.p = 0; }
  else if (weapon().ranged && !S.build) { bowUpdate(dt); mine.p = 0; }
  else if (guarding && mouse.left) mine.p = 0;
  else if (mouse.left && targetNpc && atkCd <= 0) {
    atkCd = 1.5; mouse.left = false;
    floater(['Easy, friend.', 'Mind that blade.', 'Swing at the dead, not me.', 'Do that again and see.'][roll(4) - 1], targetNpc.pos.clone().add(new THREE.Vector3(0, 2.3, 0)), '#e8dcc4', 2.5, true);
  } else if (mouse.left) {
    if (targetMob) { if (atkCd <= 0) playerAttack(targetMob); mine.p = 0; }
    else if (target) {
      const key = world.idx(target.x, target.y, target.z);
      if (key !== mine.key) { mine.key = key; mine.p = 0; }
      const hard = BLOCKS[target.b].hard, tool = ITEMS[rightHand()]?.tool;
      if (hard !== Infinity) {
        const spd = tool ? tool.speed * (1 + 0.15 * (S.wup?.[rightHand()]?.lvl || 0)) : 1;
        mine.p += dt * spd / Math.max(0.05, hard * 0.7);
        if (swingT <= 0) startSwing(tool ? 0.3 : 0.35);
        if (mine.p >= 1) { breakBlock(target, tool?.chunk || 0); mine.p = 0; mine.key = -1; }
        if (!tool && hard >= 1) hint('pick', 'Digging by hand is slow. Put your <b>Prospector\'s Pick</b> in a weapon slot [E] and swap to it with <b>V</b>: it digs three times faster and breaks out a cross of earth with every stroke.', 11);
      }
    } else if (atkCd <= 0) { atkCd = weapon().cd; startSwing(); }
  } else mine.p = 0;

  // ---- light at the player, dread
  const [ls, lb] = world.lightAt(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
  pLight = [ls, lb];
  underK += ((ls < 6 ? 1 : 0) - underK) * Math.min(1, dt * 1.5);
  const held = heldKey() === 'b12';
  const env = Math.max((ls / 15) * (ls / 15) * sunNow, Math.pow(lb / 15, 1.6));
  lightHere = Math.max(env, lanternActive() ? 0.7 : 0, held ? 0.5 : 0);
  let rate = lightHere < 0.08 ? 2.4 : lightHere < 0.25 ? 0.9 : -3.5;
  if (nvLevel > 0.5 && rate > 0) rate *= 0.5;
  const near = mobs.filter(m => m.aware && m.dist < 10).length;
  rate += near * 0.8;
  if (rate > 0) rate *= RACES[S.race].dread * Math.max(0.4, 1 - 0.07 * statMod('WIS')) * (eqItem('charm') === 'charm' ? 0.7 : 1) * (eqItem('head') === 'hood' ? 0.85 : 1);
  S.dread = clamp(S.dread + rate * dt, 0, 100);
  horror(dt, near);
  // wounds close slowly once the fighting stops
  if (mobs.some(m => m.aware && m.dist < 16)) calmT = 0; else calmT += dt;
  if (calmT > 5 && S.hp < S.maxHp) { regenAcc += dt * (lightHere > 0.25 ? 1 : 0.5); if (regenAcc >= 2.5) { regenAcc = 0; S.hp++; } }
  if (near > 0) hint('fight', 'Enemies <b>glow and rear back</b> before they strike. Hold <b>right mouse</b> to guard as the blow lands — a well-timed guard <b>parries</b> and leaves them reeling. <b>C</b> dodges.', 11);
  if (S.dread > 55) hint('dread', '<b>Dread</b> rises in darkness and near monsters. Past 80 your attacks suffer; at 100 you may panic. Light, rest and the fire bring it down.', 11);

  // ---- mobs
  G.world = world;
  G.senseMult = S.shadowT > 0 ? 0 : (lanternActive() ? 1.8 : held ? 1.4 : 1) * (S.cls === 'rogue' ? 0.75 : 1) * (eqItem('legs') === 'boots' ? 0.85 : 1);
  frameNo++;
  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    if (m.dead) continue;
    // far-off idle creatures think at a third of the rate
    const lazy = m.dist > 40 && !m.aware && !m.hunter && !m.lastKnown && m.type !== 'watcher';
    if (lazy && (frameNo + i) % 3) continue;
    m.update(lazy ? Math.min(0.05, dt * 3) : dt, G);
    // they breathe. you can hear them before you see them.
    if (!m.dead && m.dist < 14 && (m.type === 'ghoul' || m.type === 'crawler' || m.type === 'watcher')) {
      m.brT = (m.brT ?? Math.random() * 3) - dt;
      if (m.brT <= 0) { m.brT = 2.4 + Math.random() * 2.5; snd.breath(panFor(m.pos), clamp(1.3 - m.dist / 12, 0.15, 1)); }
    }
    if (!m.dead && !m.raider && !(m.hunter && !m.leaving) && (m.dist > 62 || (m.postIdx != null && m.dist > 54))) removeMob(m);
    if (!m.dead) tickMobStatus(m, dt);
  }
  updateSpawns(dt);
  updatePosts(dt);
  updateBoss();
  updateArrows(dt);
  updateBolts(dt);
  updateMagic(dt);
  updateRaid(dt);
  updateHunt(dt);
  updateHide(dt);
  updateHideNear(dt);
  updateReturned(dt);
  exploreTick(dt);
  // chase music swells as the nearest hunter closes in
  let hunt = 0;
  for (const m of mobs) if (m.aware && !m.dormant && m.type !== 'wolf' && m.turnedT <= 0) hunt = Math.max(hunt, clamp(1 - (m.dist - 3) / 20, 0, 1));
  snd.chase(hunt); chaseK = hunt;
  // ---- the living (only near ones are simulated and drawn)
  const LC = livingCtx;
  LC.world = world; LC.ppos = P.pos; LC.sun = sunNow; LC.mobs = mobs; LC.camp = world.camp; LC.spots = world.camp.spots; LC.talkingTo = talkNpc;
  for (const n of npcs) {
    const far = Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z) > 90;
    n.group.visible = !far;
    if (!far || (frameNo % 10) === 0) n.update(far ? Math.min(0.05, dt * 10) : dt, LC);
  }
  for (const c of crows) {
    const far = Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z) > 80;
    if (far) { c.group.visible = false; continue; }
    c.group.visible = c.state !== 'gone';
    c.update(dt, LC);
  }
  for (const h of halluc.slice()) {
    h.t -= dt;
    const to = h.g.position.clone().sub(eye).normalize();
    if (to.dot(look) > 0.985 && h.t < h.life - 0.4) h.t = Math.min(h.t, 0.15);
    if (h.t <= 0) { scene.remove(h.g); halluc.splice(halluc.indexOf(h), 1); }
  }

  // ---- chunk rebuild queue
  let budget = 1;
  for (const k of dirty) { buildChunk(k); dirty.delete(k); if (--budget <= 0) break; }

  quests();
  tickPlayerStatus(dt);
  saveT -= dt; if (saveT <= 0) { saveT = 60; saveGame(); }
}

function newDay() {
  endRaid(true);
  S.time -= 1; S.day++; prevT = S.time;
  rechargeAll(); S.postsDead = [];
  if (S.sawNight) gainXP(100, 'surviving the night');
  S.sawNight = false; S.watcherTonight = false;
  msg(`Day ${S.day}`, S.day % 3 === 0 ? 'The wind is wrong today. Tonight they will whisper.' : 'You survived.');
  saveGame();
}

function horror(dt, near) {
  const dr = S.dread;
  // heartbeat
  hbT -= dt;
  if ((dr > 50 || near > 0) && hbT <= 0) { const k = clamp(dr / 100 + near * 0.2, 0.3, 1); snd.heartbeat(k); hbT = Math.max(0.45, 1.25 - dr / 140 - near * 0.12); }
  // whispers
  whT -= dt;
  if (dr > 40 && whT <= 0) { snd.whisper(undefined, 0.5 + dr / 150); whT = 4 + Math.random() * 10 * (1.3 - dr / 100); }
  // distant ambient terrors at night
  ambT -= dt;
  if (ambT <= 0) { ambT = 15 + Math.random() * 30; if (sunNow < 0.3 || underK > 0.5) { Math.random() < 0.5 ? snd.growl(Math.random() * 2 - 1, 0.25) : snd.skitter(Math.random() * 2 - 1, 0.3); } }
  // hallucinated eyes
  halT -= dt;
  if (dr > 60 && halT <= 0) { halT = 4 + Math.random() * 8; spawnHallucination(); }
  // panic at full dread
  if (dr >= 99.5 && S.race !== 'elf') {
    panicT -= dt;
    if (panicT <= 0) {
      panicT = 7;
      const d20 = roll(20), tot = d20 + statMod('WIS');
      if (tot >= 12) log(`🎲 WIS save vs. terror: d20(${d20})${fm(statMod('WIS'))} = ${tot} vs DC 12 — you hold your nerve.`, 'miss');
      else {
        const dmg = roll(4); log(`🎲 WIS save vs. terror: d20(${d20})${fm(statMod('WIS'))} = ${tot} vs DC 12 — <b>panic!</b> ${dmg} psychic damage.`, 'bad');
        snd.scream(); fadeFlash(250); yaw += (Math.random() - 0.5) * 1.2; hurtPlayer(dmg, 'sheer terror');
      }
    }
  } else panicT = Math.min(panicT + dt, 7);
}
function spawnHallucination() {
  for (let a = 0; a < 6; a++) {
    const ang = yaw + (Math.random() - 0.5) * 2.4, r = 8 + Math.random() * 10; // ahead / at the edge of vision
    const x = P.pos.x - Math.sin(ang) * r, z = P.pos.z - Math.cos(ang) * r, y = P.pos.y + 0.8 + Math.random() * 1.6;
    if (OPAQUE[world.get(Math.floor(x), Math.floor(y), Math.floor(z))]) continue;
    const [s, b] = world.lightAt(Math.floor(x), Math.floor(y), Math.floor(z));
    if ((s / 15) * sunNow > 0.2 || b > 3) continue;
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xd8ecff : 0xff3020 });
    for (const sx of [-0.09, 0.09]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), mat); e.position.x = sx; g.add(e); }
    g.position.set(x, y, z); g.lookAt(eye);
    scene.add(g); const life = 2 + Math.random() * 2.5; halluc.push({ g, t: life, life });
    return;
  }
}

function quests() {
  if (S.quest >= QUESTS.length - 1) return;
  if (mainDone(QUESTS[S.quest])) {
    const prevAct = QUESTS[S.quest].act;
    S.quest++; S.mainStart = { ...S.killsBy };
    snd.craft();
    const q = QUESTS[S.quest], A = ACTS.find(a => a.id === q.act), newAct = q.act !== prevAct && A;
    // XP first, so the act's title card is what stays on screen
    gainXP(newAct ? 120 : 40, newAct ? 'a chapter closed' : 'objective');
    if (newAct) { msg(A.name, A.sub, 7); snd.stinger(); log(`<b>${A.name}</b> — ${A.sub}`, 'lore'); setTimeout(() => journalEntry('hj_' + q.act), 2500); }
    else msg('Objective', q.text, 4.5);
    log(`✔ Objective complete. Next: <b>${q.text}</b>`, 'good');
  }
}
function mainDone(q) {
  if (q.alsoDone?.()) return true;
  if (q.kill) return Object.entries(q.kill).every(([t, n]) => (S.killsBy[t] || 0) - (S.mainStart?.[t] || 0) >= n);
  return q.done();
}
function mainProgress(q) {
  if (q.kill) return ' ' + Object.entries(q.kill).map(([t, n]) => `(${Math.min(n, (S.killsBy[t] || 0) - (S.mainStart?.[t] || 0))}/${n})`).join(' ');
  if (q.talk?.need) return ' ' + Object.entries(q.talk.need).map(([k, n]) => `(${Math.min(count(k), n)}/${n})`).join(' ');
  return '';
}
// one-time pointers, shown in a box under the objective
function hint(id, html, dur = 10) {
  if (!S || S.hints[id]) return;
  S.hints[id] = true;
  const h = $('hint'); h.innerHTML = html; h.style.opacity = 1;
  clearTimeout(hint.t); hint.t = setTimeout(() => { h.style.opacity = 0; }, dur * 1000);
}
function quaff() {
  if (quaffCd > 0) return;
  if (!count('healing')) { log('No healing draughts left. Oswin and Brother Aldric sell them.', 'miss'); return; }
  if (S.hp >= S.maxHp) { log('You are already at full health.', 'miss'); return; }
  removeItem('healing'); quaffCd = 0.8;
  const h = rollDice(2, 4) + 2 + Math.round(S.maxHp * 0.25); heal(h, `🎲 Healing Draught: ${h}`); snd.drink(); renderHotbar();
}
function dodge() {
  if (dodgeCd > 0 || !P.onGround) return;
  const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  let f = fwd, s = str; if (!f && !s) f = -1; // no direction held: hop back
  const sn = Math.sin(yaw), cs = Math.cos(yaw);
  let vx = -sn * f + cs * s, vz = -cs * f - sn * s; const l = Math.hypot(vx, vz) || 1; vx /= l; vz /= l;
  // how far you roll depends on what you carry
  const lc = loadClass(), sp = lc === 'light' ? 11.5 : lc === 'medium' ? 10 : 6.5;
  P.vel.x = vx * sp; P.vel.z = vz * sp; P.vel.y = lc === 'heavy' ? 1.5 : 3.2;
  dodgeT = lc === 'heavy' ? 0.25 : 0.38; dodgeCd = lc === 'light' ? 0.7 : lc === 'medium' ? 0.85 : 1.3; guarding = false; snd.whoosh();
}
// the throne room: when you come for the king, he rises
// the act bosses: when the story reaches one and you reach its place, it rises
let bossId = null;
function updateBoss() {
  if (boss && boss.dead) { boss = null; bossId = null; }
  const ids = [QUESTS[S.quest]?.boss, ...Object.keys(BOSSES).filter(k => BOSSES[k].wild)];
  for (const id of ids) {
    if (boss || !id || S.flags['boss_' + id]) continue;
    const Bd = BOSSES[id], at = Bd.at();
    if (at && (!Bd.night || sunNow < 0.35) && Math.hypot(P.pos.x - at.x, P.pos.z - at.z) < Bd.r && Math.abs(P.pos.y - at.y) < 7) spawnBoss(id, at);
  }
  if (boss) {
    if (bossId === 'king' && !boss.summoned && boss.hp < boss.maxHp * 0.5) {
      boss.summoned = true; log('The Hollow King raises his blade. The dead answer.', 'lore'); snd.stinger();
      for (const dx of [-5, 5]) spawnMob('ghoul', boss.pos.x + dx, boss.pos.y, boss.pos.z + 7, boss.lvl - 10).aware = true;
    }
    if (boss.pos.distanceTo(P.pos) > 45) { G.mobVanish(boss, 'withdraws into the dark'); boss = null; bossId = null; }
  }
  setO('bossBar', boss ? '1' : '0');
  if (boss) { setW('bossFill', (100 * Math.max(0, boss.hp) / boss.maxHp) + '%'); setT('bossName', `${boss.T.name} · Lv ${boss.lvl}`); }
}
function spawnBoss(id, at) {
  const Bd = BOSSES[id];
  if (id === 'king') {
    // his knights kneel and fade; this fight is his alone
    (world.posts || []).forEach((p, i) => { if (Math.hypot(p.x - at.x, p.z - at.z) < 8 && Math.abs(p.y - at.y) < 3) { S.postsDead[i] = true; const pm = postMob[i]; if (pm && !pm.dead) G.mobVanish(pm, 'kneels, and crumbles to dust'); } });
  }
  const m = spawnMob(Bd.type, at.x, at.y + (id === 'king' ? 1 : 0), at.z, Bd.lvl + 40 * (S.tier || 0));
  m.bossId = id; m.T = { ...m.T, name: Bd.name, boss: true, xp: m.T.xp * 6 };
  m.hp = m.maxHp = Math.round(m.maxHp * Bd.hp);
  if (Bd.scale !== 1 && m.rig) { m.rig.root.scale.multiplyScalar(Bd.scale); m.h *= Bd.scale; m.half *= Math.min(Bd.scale, 1.3); m.T.reach *= Math.sqrt(Bd.scale); }
  m.home = { x: at.x, z: at.z }; m.aware = true; m.dormant = false;
  boss = m; bossId = id;
  msg(Bd.name, Bd.sub, 5.5); snd.bossTheme(); fadeFlash(200); S.dread = Math.min(100, S.dread + 15);
  hint('boss', 'Bosses strike slowly but terribly. <b>Parry</b> (right mouse with a shield, as the blow lands) or <b>dodge</b> (C), then punish them while they reel.', 12);
}
// where the ◆ marker points
const wpV = new THREE.Vector3();
let wpTarget = null;
function updateWaypoint() {
  const q = QUESTS[S.quest];
  wpTarget = q.at ? q.at() : null;
  placeMarker($('wp'), 'wpTxt', wpTarget, '');
  // the tracked side quest: its own marker, until you reach the place it points to
  wp2Target = null;
  if (S.tracked && !questActive(S.tracked)) S.tracked = null;
  if (S.tracked) {
    const t = sideTarget(S.tracked), key = S.tracked + (questReady(S.tracked) ? ':return' : ':go');
    if (t && S.arrived !== key) {
      if (Math.hypot(t.x - P.pos.x, t.z - P.pos.z) < 5 && Math.abs(t.y - 2 - P.pos.y) < 4) {
        S.arrived = key; msg(SIDE_QUESTS[S.tracked].name, questReady(S.tracked) ? 'Speak with them to finish it.' : 'You have reached the place.', 3);
      } else wp2Target = t;
    }
  }
  placeMarker($('wp2'), 'wp2Txt', wp2Target, S.tracked ? SIDE_QUESTS[S.tracked].name : '');
}
function placeMarker(el, txtId, t, label) {
  if (!t || ui !== 'none') { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  wpV.set(t.x, t.y, t.z).project(camera);
  let x = wpV.x, y = wpV.y;
  const behind = wpV.z > 1;
  if (behind) { x = -x; y = -y; }
  const edge = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.85;
  if (edge) { const k = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.85, 1e-6); x /= k; y /= k; if (behind) y = Math.min(y, -0.6); }
  const d = Math.hypot(t.x - P.pos.x, t.z - P.pos.z);
  el.style.display = 'block';
  el.style.transform = `translate(${((x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - y) / 2 * innerHeight).toFixed(0)}px) translate(-50%, -50%)`;
  const dy = t.y - 2 - P.pos.y;
  setH(txtId, `${label ? label + '<br>' : ''}${Math.round(d)}m${dy > 6 ? ' ↑' : dy < -6 ? ' ↓' : ''}`);
  el.classList.toggle('edge', edge);
}
// where each side quest happens; once it's ready, the marker points back to whoever gave it
const idxPos = i => { const y = Math.floor(i / (W * D)), r = i % (W * D); return { x: r % W + 0.5, y: y + 1.6, z: Math.floor(r / W) + 0.5 }; };
const SIDE_AT = {
  brother: () => (!count('signet') && world.questChest?.signet != null ? idxPos(world.questChest.signet) : null),
  reliquary: () => (!count('reliquary') && world.questChest?.reliquary != null ? idxPos(world.questChest.reliquary) : null),
  hollow: () => world.castle.gate && { ...world.castle.gate, y: world.castle.gate.y + 2 },
  brigands: () => { const b = world.banditCamps?.[0]; return b ? { x: b.x + 0.5, y: world.topSolid(b.x, b.z) + 2.5, z: b.z + 0.5 } : null; },
  knights: () => ({ x: 128.5, y: world.castle.G + 3, z: 100.5 }),
  wolves: () => { const x = world.camp.x - 62, z = world.camp.z - 12; return { x: x + 0.5, y: world.topSolid(x, z) + 2.5, z: z + 0.5 }; }, // the western moor, where the packs hunt
};
function sideTarget(id) {
  if (questReady(id)) return npcAt(SIDE_QUESTS[id].giver);
  return SIDE_AT[id]?.() || null;
}
let wp2Target = null;

// ================================================================ visuals per frame
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
let visT = 0;
function updateVisuals(dt) {
  visT += dt;
  const s = sunNow, dk = s > 0 && s < 1 ? 1 - Math.abs(s - 0.5) * 2 : 0;
  // sun path: low and raking, rising in the east and setting in the west
  const a = clamp((S.time + 0.03) / 0.63, 0, 1) * Math.PI;
  U.uSunDir.value.set(Math.cos(a) * 0.85, Math.sin(a) * 0.62 + 0.1, 0.42).normalize();
  let zen = lerp3([0.0006, 0.0006, 0.001], [0.14, 0.17, 0.22], s), hor = lerp3([0.0008, 0.0008, 0.0012], [0.3, 0.31, 0.33], s), cloud = lerp3([0.002, 0.002, 0.003], [0.23, 0.235, 0.26], s);
  zen = lerp3(zen, [0.08, 0.06, 0.11], dk * 0.7); hor = lerp3(hor, [0.48, 0.24, 0.13], dk * 0.8); cloud = lerp3(cloud, [0.3, 0.15, 0.11], dk * 0.8);
  skyU.uZen.value.set(...zen); skyU.uHor.value.set(...hor); skyU.uCloud.value.set(...cloud); skyU.uTime.value = visT;
  U.uSunCol.value.set(...lerp3([1.75, 1.55, 1.25], [1.8, 0.7, 0.3], dk).map(c => c * s));
  U.uSkyCol.value.set(...lerp3([0.24, 0.27, 0.32], [0.26, 0.17, 0.17], dk).map(c => c * s));
  U.uGroundCol.value.set(0.08 * s, 0.07 * s, 0.06 * s);
  U.uCam.value.copy(eye);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  U.uLampPos.value.set(eye.x - rx * 0.35 + look.x * 0.3, eye.y - 0.3 + look.y * 0.3, eye.z - rz * 0.35 + look.z * 0.3);
  const lantern = lanternActive(), held = heldKey() === 'b12';
  const lowOil = S.lanternOn && S.cls !== 'cleric' && S.oilT < 12 && !count('oil');
  const flick = 0.9 + 0.1 * Math.sin(performance.now() / 70) * Math.sin(performance.now() / 113);
  U.uLantern.value = (lantern || held) ? (lowOil ? (Math.random() < 0.15 ? 0.2 : 0.8) : 1) * flick : 0;
  U.uLanternR.value = lantern ? 10 : 6;
  U.uFlicker.value = 0.94 + 0.06 * Math.sin(performance.now() / 90);
  // light falters when something is close in the dark
  let nearFoe = 99; for (const m of mobs) if (m.type !== 'wolf' && m.type !== 'bandit' && m.dist < nearFoe) nearFoe = m.dist;
  if (nearFoe < 9 && U.uLantern.value > 0) { const k = 1 - nearFoe / 9; if (Math.random() < 0.12 * k) U.uLantern.value *= 0.15 + Math.random() * 0.3; else U.uLantern.value *= 1 - 0.25 * k * Math.random(); }
  U.uNV.value = nvLevel;
  const dv = darkvision(); U.uDV.value = dv ? 1 : 0; U.uDVR.value = dv || 1;
  const outdoor = 1 - underK;
  U.uFog.value.set(...hor.map(c => c * outdoor * (1 - nvLevel)));
  const view = QUALITY[SET.quality].view;
  U.uFogD.value = Math.max(0.0078, 1.9 / view) + underK * 0.018 + nvLevel * 0.006;
  // don't draw terrain that the fog has already swallowed
  if ((cullT = (cullT + 1) % 12) === 0) {
    const vr = view + 20;
    for (let k = 0; k < chunkMeshes.length; k++) {
      const m = chunkMeshes[k]; if (!m) continue;
      const cx = (k % NCX) * 16 + 8, cz = Math.floor(k / NCX) * 16 + 8;
      m.visible = Math.hypot(cx - eye.x, cz - eye.z) < vr;
    }
  }
  U.uMist.value = 0.4 * s * outdoor;
  starMat.opacity = clamp((1 - s) * 0.85, 0, 0.85) * outdoor * (1 - nvLevel * 0.4);
  stars.position.copy(eye);
  // ash drifting through the air
  {
    const p = ashPos;
    for (let i = 0; i < ASH_N; i++) {
      const k = i * 3;
      p[k + 1] -= dt * (0.25 + (i % 7) * 0.05); p[k] += dt * Math.sin(visT * 0.7 + i) * 0.15;
      for (let c = 0; c < 3; c++) { const e = c === 0 ? eye.x : c === 1 ? eye.y : eye.z; if (p[k + c] < e - 25) p[k + c] += 50; else if (p[k + c] > e + 25) p[k + c] -= 50; }
    }
    ashGeo.attributes.position.needsUpdate = true;
    ashMat.opacity = clamp(lightHere, 0, 1) * 0.45;
  }
  grade.uniforms.uNV.value = nvLevel; grade.uniforms.uDread.value = clamp((S.dread - 30) / 70, 0, 1); grade.uniforms.uTime.value = visT;
  // view-model
  const hk = heldKey() || rightHand() || null;
  if (hk !== vmKey) {
    vm.traverse(o => { if (o.material?.userData.dispose) { o.material.map.dispose(); o.material.dispose(); } });
    buildViewModel(hk);
  }
  const br = clamp(lightHere, 0.03, 1) ** 2 * 1.1 + nvLevel * 0.3;
  for (const mtl of [vmMat, vmMat2]) if (mtl.userData.base) { const c = mtl.userData.base; mtl.color.setRGB(c.r ** 2.2 * br, c.g ** 2.2 * br, c.b ** 2.2 * br); }
  vm.children.forEach(c => { if (c.material?.map) c.material.color.setRGB(br * 0.5, br * 0.5, br * 0.5); });
  for (const mt of [vmMetal, vmWood, arrowMat]) mt.uniforms.uLight.value.set(pLight[0] / 15, pLight[1] / 15);
  const walkBob = P.onGround ? Math.sin(performance.now() / 120) * 0.012 * Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 4) : 0;
  if (vmInfo) poseWeapon(vm, vmInfo, swingT > 0 ? 1 - swingT / swingDur : -1, draw, guarding, walkBob);
  else {
    const sw = swingT > 0 ? Math.sin((1 - swingT / swingDur) * Math.PI) : 0;
    vm.position.set(0.36, -0.34 - sw * 0.06, -0.58 - sw * 0.1);
    vm.rotation.set((hk === 'b12' ? -0.2 : 0) - sw * 1.0, 0, 0);
    if (guarding) { vm.position.set(0.1, -0.24, -0.5); vm.rotation.x = 0.15; vm.rotation.z = 1.25; }
  }
  lanternMesh.visible = S.lanternOn || S.cls === 'cleric';
  const lv = lantern ? U.uLantern.value : 0;
  flameMat.color.setRGB(0.01 + 1.6 * lv, 0.008 + 0.85 * lv, 0.004 + 0.28 * lv);
  // overlays
  setO('nv', nvLevel.toFixed(2));
  if (changed('nvAnim', nvLevel > 0.01)) $('nvGrain').style.animationPlayState = nvLevel > 0.01 ? 'running' : 'paused';
  setO('dread', (clamp((S.dread - 20) / 80, 0, 1) * 0.9).toFixed(2));
  if (changed('dreadPulse', S.dread > 60)) $('dread').classList.toggle('pulse', S.dread > 60);
  // floaters
  const w = innerWidth, h = innerHeight;
  for (const f of floaters.slice()) {
    f.t += dt; f.pos.y += dt * f.rise;
    const p = f.pos.clone().project(camera);
    if (p.z > 1 || f.t > f.dur) { if (f.t > f.dur) { f.el.remove(); floaters.splice(floaters.indexOf(f), 1); } else f.el.style.display = 'none'; continue; }
    f.el.style.display = ''; f.el.style.left = ((p.x + 1) / 2 * w) + 'px'; f.el.style.top = ((1 - p.y) / 2 * h) + 'px';
    f.el.style.opacity = 1 - Math.max(0, f.t - (f.dur - 0.5)) / 0.5;
  }
  // mining ring
  setA('ringC', String(113.1 * (1 - clamp(Math.max(mine.p, draw), 0, 1))));
}

// ================================================================ HUD
// write to the page only when a value actually changes — each DOM write can force a style/layout pass
const domCache = new Map();
const changed = (k, v) => { if (domCache.get(k) === v) return false; domCache.set(k, v); return true; };
const setH = (id, v) => { if (changed(id + ':h', v)) $(id).innerHTML = v; };
const setT = (id, v) => { if (changed(id + ':t', v)) $(id).textContent = v; };
const setW = (id, v) => { if (changed(id + ':w', v)) $(id).style.width = v; };
const setO = (id, v) => { if (changed(id + ':o', v)) $(id).style.opacity = v; };
const setA = (id, v) => { v = (+v).toFixed(1); if (changed(id + ':a', v)) $(id).setAttribute('stroke-dashoffset', v); };
function renderHotbar() {
  if (!S) return;
  $('hotbar').classList.toggle('idle', !S.build);
  $('hotbar').innerHTML = `<div class="hbLabel">${S.build ? 'Building — [B] to put away' : 'Crafting hotbar — [1–9] or [B]'}</div>` + S.hotbar.map((k, i) => `<div class="slot${S.build && i === S.sel ? ' sel' : ''}"><span class="k">${i + 1}</span>${k ? itemIcon(k) + `<span class="n">${count(k) > 1 ? count(k) : ''}</span>` : ''}</div>`).join('');
  renderCross();
}
// the loadout at a glance: off-hand, weapon, ability, quick item
function renderCross() {
  if (!S?.eq) return;
  const cell = (k, key, label, extra = '') => `<div class="slot">${k ? itemIcon(k) : ''}<span class="k">${key}</span>${extra}<span class="lb">${label}</span></div>`;
  const rh = rightHand(), lh = offHand(), bk = S.belt[S.beltSel];
  const other = S.eq.rh[1 - S.eq.rhSel];
  const abil = S.cls === 'fighter' ? '💨' : S.cls === 'rogue' ? '🌫️' : '✨';
  $('loadout').innerHTML =
    `<div class="up">${cell(null, 'R', CLASSES[S.cls].name === 'Fighter' ? 'Second Wind' : S.cls === 'rogue' ? 'Shadowstep' : 'Cure', `<span class="ic">${abil}</span>`)}</div>` +
    (lh === 'sigil' && SPELLS[S.spellSlots?.[S.spellSel]]
      ? `<div class="lf">${cell(null, 'RMB', '', `<span class="ic">${SPELLS[S.spellSlots[S.spellSel]].icon}</span>`)}</div>`
      : `<div class="lf">${cell(lh, 'RMB', lh ? itemName(lh) : 'no shield')}</div>`) +
    `<div class="rt">${cell(rh, 'V', rh ? itemName(rh) : 'Fists', other && count(other) ? `<span class="alt">${itemIcon(other)}</span>` : '')}</div>` +
    `<div class="dn">${cell(bk && count(bk) ? bk : null, 'Q', bk && count(bk) ? itemName(bk) : 'empty', bk && count(bk) ? `<span class="n">${count(bk)}</span>` : '')}</div>` +
    `<div class="cap"><b>${rh ? itemName(rh) : 'Fists'}</b>${ITEMS[rh]?.weapon?.ranged ? ` · ${count('arrows')} arrows` : ''}${lh ? ' · ' + itemName(lh) : ''}<br>${bk && count(bk) ? `${itemName(bk)} ×${count(bk)}` : 'belt empty'}</div>`;
}
function updateHUD(force) {
  hudT -= 1; if (hudT > 0 && !force) return; hudT = 6;
  const t = S.time, dl = dayLenSec();
  const night = sunNow < 0.5;
  let phase, cd;
  if (t < 0.5) { phase = 'Day'; cd = `night falls in ${mmss((0.585 - t) * dl)}`; }
  else if (t < 0.585) { phase = 'Dusk'; cd = `full dark in ${mmss((0.585 - t) * dl)}`; }
  else if (t < 0.985) { phase = isWhisperNight() ? 'Night of Whispers' : 'Night'; cd = `dawn in ${mmss((0.985 - t) * dl)}`; }
  else { phase = 'Dawn'; cd = ''; }
  setH('clock', `${night ? '☾' : '☀'} Day ${S.day} · ${phase} <small>${cd}</small>`);
  const tasks = Object.keys(S.q).filter(id => questActive(id)).slice(0, 4)
    .map(id => `<div class="task${questReady(id) ? ' ready' : ''}${S.tracked === id ? ' tracked' : ''}">${S.tracked === id ? '◇' : '📜'} ${SIDE_QUESTS[id].name} <span>— ${questReady(id) ? 'return to ' + NPC_DEFS[SIDE_QUESTS[id].giver].name : questProgress(id)}${S.tracked === id && wp2Target ? ` · ${Math.round(Math.hypot(wp2Target.x - P.pos.x, wp2Target.z - P.pos.z))}m ${compass(wp2Target.x - P.pos.x, wp2Target.z - P.pos.z)}` : S.tracked === id && S.arrived ? ' · you are here' : ''}</span></div>`).join('');
  const mq = QUESTS[S.quest];
  const far = wpTarget ? ` <span class="dist">◆ ${Math.round(Math.hypot(wpTarget.x - P.pos.x, wpTarget.z - P.pos.z))}m ${compass(wpTarget.x - P.pos.x, wpTarget.z - P.pos.z)}</span>` : '';
  const actN = ACTS.find(a => a.id === mq.act)?.name || '';
  setH('obj', `<div class="actline">${actN}</div><b>Objective:</b> ${mq.text}${mainProgress(mq)}${far}${tasks}`);
  setW('hpFill', (100 * S.hp / S.maxHp) + '%');
  setT('hpText', `HP ${S.hp} / ${S.maxHp}`);
  setW('dreadFill', S.dread.toFixed(1) + '%');
  setT('dreadText', S.dread >= 99.5 ? 'DREAD — TERROR' : S.dread > 80 ? 'DREAD — disadvantage on attacks' : `Dread ${Math.round(S.dread)}`);
  const chips = [];
  if (S.cls === 'cleric') chips.push(`<span class="${S.lanternOn ? '' : 'off'}">🏮 Light ${S.lanternOn ? 'on' : 'off'} [F]</span>`);
  else chips.push(`<span class="${S.lanternOn ? '' : 'off'}">🏮 ${S.lanternOn ? mmss(S.oilT) : 'off'} [F] · ${count('oil')} oil</span>`);
  if (S.nvT > 0) chips.push(`<span>🧪 Night vision ${mmss(S.nvT)}</span>`);
  if (count('goggles')) chips.push(`<span class="${S.gogOn ? '' : 'off'}">🥽 ${S.gogOn ? 'on' : 'off'} [G] · ${count('b13')} glowcaps</span>`);
  if (RACES[S.race].dv) chips.push(`<span>👁 Darkvision ${RACES[S.race].dv}</span>`);
  if (S.shadowT > 0) chips.push(`<span>🌫 Shadowstep ${Math.ceil(S.shadowT)}s</span>`);
  if (S.poisonT > 0) chips.push(`<span style="color:#9fe08a">☠ Poisoned ${Math.ceil(S.poisonT)}s</span>`);
  if (S.fireT > 0) chips.push(`<span style="color:#ffa060">🔥 Burning ${Math.ceil(S.fireT)}s</span>`);
  if (S.wardT > 0) chips.push(`<span style="color:#ffe9a0">☀ Ward ${Math.ceil(S.wardT)}s</span>`);
  if (weapon().ranged) { const ak = ammoKey(); chips.push(`<span>${ak ? ITEMS[ak].icon + ' ' + itemName(ak) + ' ×' + count(ak) : '➶ no arrows'}</span>`); }
  chips.push(`<span>🛡 AC ${playerAC()}</span>`, `<span>⭐ Lv ${S.level} · ${S.level >= LEVEL_CAP ? 'max' : `${S.xp}/${xpNeed(S.level)} XP`}${S.points ? ` · <b style="color:#9fe0a0">+${S.points} pts [E]</b>` : ''}</span>`);
  if (S.tier) chips.push(`<span style="color:#b48aff">Gloam tier ${S.tier}</span>`);
  setH('chips', chips.join(''));
  const ab = [];
  ab.push(`${offHand() === 'sigil' ? '' : `<span class="${guarding ? 'on' : ''}">[RMB] Guard${guarding ? ' — raised' : ''}</span> · `}<span class="${dodgeCd > 0 ? 'used' : ''}">[C] Dodge (${loadClass()})</span>${count('sigil') ? ' · [Tab] shield/sigil' : ''}`);
  if (S.cls === 'fighter') ab.push(`<span class="${S.uses.second ? '' : 'used'}">[R] Second Wind</span>`);
  if (S.cls === 'rogue') ab.push(`<span class="${S.uses.shadow ? '' : 'used'}">[R] Shadowstep</span>`, `Sneak Attack ${Math.ceil(S.level / 2)}d6`);
  if (S.cls === 'cleric') ab.push(`<span class="${S.slots ? '' : 'used'}">[R] Cure Wounds (${S.slots})</span>`, `<span class="${S.uses.turn ? '' : 'used'}">[T] Turn Undead</span>`);
  if (offHand() === 'sigil') { const sp = SPELLS[S.spellSlots[S.spellSel]]; ab.push(sp ? `<span class="${(S.aether || 0) >= sp.cost ? 'on' : 'used'}">[RMB] ${sp.icon} ${sp.name} (${sp.cost}) · [Z] next</span>` : '<span class="used">No spell prepared — set one in your pack [E]</span>'); }
  ab.push('<span style="color:var(--dim)">[M] map · [J] journal</span>');
  if (S.flags.magic) { setW('aeFill', (100 * (S.aether || 0) / maxAether()) + '%'); setT('aeText', `Lumen ${Math.floor(S.aether || 0)} / ${maxAether()}`); setO('aeBar', '1'); } else setO('aeBar', '0');
  setH('colonyTag', `⌂ ${colonyRank()}${S.raid?.active ? ` · <b style="color:#ff8a7a">RAID ${S.raid.killed}/${S.raid.total}</b>` : ''}`);

  if (S.flags.magic) ab.push(`<span class="${mobs.some(m => m.brokenT > 0 && m.dist < 4) ? 'on' : ''}">[H] Rite of Return</span> · <span style="color:var(--dim)">☀ ${S.mercy || 0} returned · ☠ ${S.slain || 0} slain</span>`);
  setH('ability', ab.join('<br>'));
  {
    const st = [];
    if (hideSpot) st.push('◐ Hidden');
    else if (inCover && crouch && stillT > 0.6) st.push('◐ Hidden in the brambles');
    else if (crouch) st.push(inCover ? 'Crouched · in cover' : 'Crouched');
    if (hunter && !hunter.leaving) st.push(`<span class="hunted">👁 ${hunter.stalk ? 'Something is following you' : `Hunted — ${hunter.aware ? 'it sees you' : hunter.searchT > 0 ? 'it is searching' : 'it is following your scent'}`}</span>`);
    if (hunter && !hunter.leaving && !hideSpot && hideNear && !(inCover && crouch)) st.push(`<span class="dim">◐ ${hideNear.b === B.WARDROBE ? 'wardrobe' : hideNear.b === B.HOLLOWLOG ? 'hollow log' : 'brambles'} ${Math.round(hideNear.d)}m ${hideArrow(hideNear)}</span>`);
    else if (sunNow < 0.35 && lanternActive() && !hideSpot) st.push('<span class="dim">🏮 Your light can be seen from far away</span>');
    setH('stealth', st.join(' · ')); setO('stealth', st.length ? '1' : '0');
  }
  let tg = '';
  if (targetNpc) tg = `${targetNpc.def.name}, ${targetNpc.def.title} — right-click to talk${(targetNpc.def.quests || []).some(id => questReady(id)) ? ' ✔' : (targetNpc.def.quests || []).some(id => questAvailable(id)) ? ' 📜' : ''}`;
  else if (targetMob) tg = `Lv ${targetMob.lvl} ${targetMob.T.name} · AC ${targetMob.T.ac} · ${targetMob.hp > targetMob.maxHp * 0.66 ? 'unhurt' : targetMob.hp > targetMob.maxHp * 0.33 ? 'bloodied' : 'near death'}`;
  else if (target && target.b === B.WARDROBE && !hideSpot) tg = 'Old Wardrobe — right-click to hide inside';
  else if (target && target.b === B.HOLLOWLOG && !hideSpot) tg = 'Hollow Log — right-click to crawl inside and hide';
  else if (target && target.b === B.THICKET && !hideSpot) tg = 'Bramble Thicket — step inside, crouch [Ctrl] and keep still to hide';
  else if (target && (target.b === B.CHEST || target.b === B.CAMPFIRE)) tg = target.b === B.CHEST ? (world.opened.has(world.idx(target.x, target.y, target.z)) ? 'Old Chest (empty)' : 'Old Chest — right-click to open') : (sunNow < 0.35 ? 'Campfire — right-click for a long rest' : 'Campfire — right-click to rest');
  setT('target', tg);
}

// ================================================================ loop
let cullT = 0, frameNo = 0;
let last = performance.now(), ftAvg = 16.7, perfT = 0, slowT = 0, fastT = 0, fpsShown = '';
function tunePerformance(ft, dt) {
  ftAvg += (Math.min(ft, 200) - ftAvg) * 0.05;
  perfT += dt;
  if (perfT < 0.5) return;
  perfT = 0;
  if (SET.autoRes && !document.hidden) {
    if (ftAvg > 21) { slowT++; fastT = 0; } else if (ftAvg < 17.8) { fastT++; slowT = 0; } else { slowT = 0; fastT = 0; }
    if (slowT >= 2 && resScale > 0.5) { resScale = Math.max(0.5, resScale - (ftAvg > 33 ? 0.15 : 0.08)); slowT = 0; applyPixelRatio(); }
    else if (fastT >= 8 && resScale < 1) { resScale = Math.min(1, resScale + 0.05); fastT = 0; applyPixelRatio(); }
  }
  const txt = SET.showFps ? `${Math.round(1000 / ftAvg)} fps · ${Math.round(ftAvg)} ms${resScale < 1 ? ` · ${Math.round(resScale * 100)}% res` : ''}` : '';
  if (txt !== fpsShown) { fpsShown = txt; $('fps').textContent = txt; $('fps').style.display = txt ? '' : 'none'; }
}
function frame(now) {
  requestAnimationFrame(frame);
  const ft = now - last;
  const dt = Math.min(0.05, ft / 1000); last = now;
  if (state === 'play' && S && world) {
    const active = ui === 'none' && (locked || TEST);
    if (active) tunePerformance(ft, dt);
    if (active) update(dt); else snd.chase(0);
    snd.ambient(sunNow, S.dread, underK > 0.5);
    if (snd.state !== 'running' && now - (frame.mutedAt || -1e9) > 20000) { frame.mutedAt = now; log('🔇 Your browser has the game&#39;s sound switched off. Click inside the game or press any key to turn it on.', 'miss'); }
    snd.update(dt, { sun: sunNow, under: underK > 0.5, chase: active ? chaseK : 0, tense: active ? tenseK : 0, dread: S.dread });
    updateVisuals(active ? dt : 0);
    updateHUD();
    updateWaypoint();
    // if the mouse wasn't recaptured (browsers refuse right after Esc), say so instead of sitting frozen
    const rs = !locked && !TEST && ui === 'none' ? 'block' : 'none'; if ($('resume').style.display !== rs) $('resume').style.display = rs;
    renderShadows(); composer.render();
  } else if (state === 'dead') {
    composer.render();
  } else {
    renderer.setClearColor(0x000000); renderer.clear();
  }
}
applyQuality();
requestAnimationFrame(frame);

// night-vision grain texture
{
  const c = $('nvGrain'); c.width = 256; c.height = 256; const g = c.getContext('2d'); const im = g.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = v * 0.4; im.data[i + 1] = v; im.data[i + 2] = v * 0.5; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
  c.style.width = 'calc(100% + 100px)'; c.style.height = 'calc(100% + 100px)'; c.style.imageRendering = 'pixelated';
}

// debug/test hooks (used for automated playtesting)
window.__gr = {
  step(n = 1, dt = 1 / 60) { const t0 = performance.now(); for (let i = 0; i < n; i++) { update(dt); updateVisuals(dt); updateHUD(); updateWaypoint(); renderShadows(); composer.render(); } return (performance.now() - t0) / n; },
  size(w, h) { renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; },
  tp(x, y, z) { P.pos.set(x, y, z); P.vel.set(0, 0, 0); airPeak = y; if (state === 'dead') { state = 'play'; ui = 'none'; S.hp = S.maxHp; show(null); } },
  snap() { return canvas.toDataURL('image/jpeg', 0.85); },
  tunePerformance, get resScale() { return resScale; }, get pr() { return renderer.getPixelRatio(); },
  get target() { return target; }, get npcs() { return npcs; }, get crows() { return crows; }, get targetNpc() { return targetNpc; }, openTalk, get talkActs() { return talkActs; }, questReady, get targetMob() { return targetMob; }, craft: i => craft(RECIPES[i]), RECIPES, playerAttack, get dread() { return S.dread; },
  get wp2() { return wp2Target; }, acceptQuest, get bolts() { return bolts; }, castSpell, buildProject, startRaid, openMap, openNote, get look() { return look; }, get eye() { return eye; }, get S() { return S; }, get world() { return world; }, get mobs() { return mobs; }, P, setLook(y, p) { yaw = y; pitch = p; }, spawnMob, MOB_TYPES, U, keys, mouse, useAction, setTime(t) { S.time = t; prevT = t; },
  guard(on) { guarding = on; if (on) guardAt = gameT; }, dodge, quaff, addItem, equip, openPanel, swapWeapon, useBelt, QUESTS, get wp() { return wpTarget; }, get boss() { return boss; }, get yaw() { return yaw; },
  perceive, setCrouch, enterHide, exitHide, riteOfReturn, breakBlock, unlockMagic, get hunter() { return hunter; }, set huntT(v) { huntT = v; }, get hideSpot() { return hideSpot; }, get crouch() { return crouch; }, get inCover() { return inCover; }, get returned() { return returned; }, setSun(v) { sunNow = v; }, snd };
