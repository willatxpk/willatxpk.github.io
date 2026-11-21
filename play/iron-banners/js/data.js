// Iron Banners — static data: units, eras, techs, doctrines, nations, terrain, events
'use strict';

const ERAS = [
  null,
  { n: 1, name: 'Ancient', span: '3000 BC – 500 AD' },
  { n: 2, name: 'Medieval', span: '500 – 1500' },
  { n: 3, name: 'Gunpowder', span: '1500 – 1850' },
  { n: 4, name: 'Industrial', span: '1850 – 1918' },
  { n: 5, name: 'Mechanized', span: '1918 – 1945' },
];

// Unit classes. Branches mirror a vehicle tech tree: each branch has a line of units that get stronger by era.
const CLASSES = {
  inf:     { name: 'Infantry',        branch: 'Infantry', sym: 'X' },
  pike:    { name: 'Spear / Pike',    branch: 'Infantry', sym: 'P' },
  missile: { name: 'Missile',         branch: 'Ranged',   sym: 'M' },
  lcav:    { name: 'Light Cavalry',   branch: 'Mobile',   sym: 'L' },
  hcav:    { name: 'Heavy Cavalry',   branch: 'Mobile',   sym: 'H' },
  art:     { name: 'Artillery',       branch: 'Ranged',   sym: 'A' },
  armor:   { name: 'Armor',           branch: 'Mobile',   sym: 'T' },
  at:      { name: 'Anti-Tank',       branch: 'Ranged',   sym: 'K' },
  air:     { name: 'Aircraft',        branch: 'Air',      sym: 'W' },
};
const BRANCHES = ['Infantry', 'Mobile', 'Ranged', 'Air'];

// atk/def: combat values. mor: base morale. arm: effective frontal armor (mm). pen: penetration (mm).
// cost: F food, T timber, I iron, H horses, G gold, O oil.
// tags: shock (charge bonus), feint (can feign retreat), stakes (anti-charge), discipline (resists disorder),
// shieldwall (strong hold), fear (morale damage), unstable (may panic), volley (fires while holding),
// entrench (digs in), mg (machine guns), airsup (air superiority), unreliable (breakdowns)
const U = {};
function unit(id, o) { U[id] = Object.assign({ id, pen: 0, arm: 0, tags: [], cost: {}, br: 1 }, o); }

// ---- Era 1: Ancient
unit('levy',      { name: 'Levy Spearmen', cls: 'pike', era: 1, atk: 3, def: 5, mor: 40, cost: { F: 1, T: 1 }, br: 1.0, note: 'Farmers with spears. Cheap and brittle, but they keep horsemen honest.' });
unit('warband',   { name: 'Warband', cls: 'inf', era: 1, atk: 7, def: 4, mor: 55, tags: ['shock'], cost: { F: 2, I: 1 }, br: 1.3, note: 'Celtic and Germanic warriors: a ferocious first rush, little staying power.' });
unit('slinger',   { name: 'Slingers', cls: 'missile', era: 1, atk: 4, def: 2, mor: 45, cost: { F: 1, T: 1 }, br: 1.0, note: 'Balearic slingers were prized mercenaries; lead bullets out-ranged many bows.' });
unit('hoplite',   { name: 'Phalanx', cls: 'pike', era: 1, atk: 6, def: 9, mor: 70, tags: ['discipline'], cost: { F: 2, I: 2 }, br: 1.7, note: 'Macedonian sarissa phalanx: a hedge of 6 m pikes. Nearly unbreakable from the front, vulnerable on the flanks.' });
unit('archer',    { name: 'Archers', cls: 'missile', era: 1, atk: 5, def: 2, mor: 50, cost: { F: 1, T: 2 }, br: 1.2, note: 'Composite-bow archers, the backbone of Near Eastern armies.' });
unit('lightcav',  { name: 'Light Cavalry', cls: 'lcav', era: 1, atk: 5, def: 3, mor: 60, tags: ['feint'], cost: { F: 1, H: 2 }, br: 1.4, note: 'Numidian-style javelin horsemen: harass, feint, pursue.' });
unit('legion',    { name: 'Legionaries', cls: 'inf', era: 1, atk: 8, def: 8, mor: 75, tags: ['discipline', 'shock'], cost: { F: 2, I: 2, G: 1 }, br: 2.0, note: 'Manipular legion: pila volley, then the gladius. Lines relieved one another in combat.' });
unit('companion', { name: 'Companion Cavalry', cls: 'hcav', era: 1, atk: 9, def: 5, mor: 80, tags: ['shock'], cost: { F: 2, H: 2, I: 1, G: 1 }, br: 2.2, note: 'Alexander\'s heavy shock cavalry, charging in a wedge at the decisive point.' });
unit('elephant',  { name: 'War Elephants', cls: 'hcav', era: 1, atk: 10, def: 6, mor: 55, tags: ['shock', 'fear', 'unstable'], cost: { F: 3, G: 2 }, br: 2.2, note: 'Terrifying to horses and men alike, and liable to stampede back through their own lines.' });

// ---- Era 2: Medieval
unit('fyrd',      { name: 'Fyrd Militia', cls: 'inf', era: 2, atk: 5, def: 7, mor: 50, tags: ['shieldwall'], cost: { F: 1, T: 1, I: 1 }, br: 2.0, note: 'Anglo-Saxon shire levies: solid in the shield wall, prone to chasing a fleeing enemy.' });
unit('huscarl',   { name: 'Huscarls', cls: 'inf', era: 2, atk: 10, def: 10, mor: 85, tags: ['shieldwall', 'discipline'], cost: { F: 2, I: 2, G: 2 }, br: 2.8, note: 'Household troops with the long-hafted Dane axe, the core of the English shield wall.' });
unit('maa',       { name: 'Men-at-Arms', cls: 'inf', era: 2, atk: 11, def: 11, mor: 75, cost: { F: 2, I: 3, G: 1 }, br: 3.0, note: 'Armored professional soldiers, often fighting dismounted in the later Middle Ages.' });
unit('pikemen',   { name: 'Pikemen', cls: 'pike', era: 2, atk: 7, def: 10, mor: 65, tags: ['discipline'], cost: { F: 2, T: 1, I: 1 }, br: 2.7, note: 'Swiss and Scottish pike squares that broke the power of mounted knights.' });
unit('longbow',   { name: 'Longbowmen', cls: 'missile', era: 2, atk: 9, def: 3, mor: 65, tags: ['stakes'], cost: { F: 1, T: 3 }, br: 3.0, note: 'English yew longbows, trained from boyhood; carried sharpened stakes against cavalry.' });
unit('crossbow',  { name: 'Crossbowmen', cls: 'missile', era: 2, atk: 8, def: 4, mor: 55, pen: 4, cost: { F: 1, T: 2, I: 1 }, br: 2.7, note: 'Slow to reload but easy to train; Genoese crossbowmen served all over Europe.' });
unit('horsearch', { name: 'Horse Archers', cls: 'lcav', era: 2, atk: 8, def: 4, mor: 70, tags: ['feint', 'volley'], cost: { F: 1, H: 3 }, br: 3.0, note: 'Steppe horse archers: shoot, wheel away, lure the enemy into a trap.' });
unit('milites',   { name: 'Mounted Milites', cls: 'hcav', era: 2, atk: 12, def: 9, mor: 75, tags: ['shock', 'feint'], cost: { F: 2, H: 2, I: 2 }, br: 3.0, note: 'Norman mailed horsemen, drilled to wheel and feign flight as a unit.' });
unit('knight',    { name: 'Knights', cls: 'hcav', era: 2, atk: 14, def: 11, mor: 80, tags: ['shock'], cost: { F: 2, H: 2, I: 3, G: 1 }, br: 3.3, note: 'Couched-lance heavy cavalry: irresistible on open ground, helpless in mud and against stakes.' });

// ---- Era 3: Gunpowder / Napoleonic
unit('lineinf',   { name: 'Line Infantry', cls: 'inf', era: 3, atk: 14, def: 12, mor: 65, tags: ['volley'], pen: 6, cost: { F: 2, I: 2, G: 1 }, br: 4.0, note: 'Flintlock muskets and bayonets; volley fire in line, assault in column.' });
unit('voltigeur', { name: 'Light Infantry', cls: 'missile', era: 3, atk: 10, def: 7, mor: 70, pen: 6, cost: { F: 1, I: 1, G: 1 }, br: 3.7, note: 'Voltigeurs and riflemen skirmishing ahead of the line, sniping officers.' });
unit('hussar',    { name: 'Hussars', cls: 'lcav', era: 3, atk: 11, def: 7, mor: 70, tags: ['feint'], cost: { F: 1, H: 3, G: 1 }, br: 3.7, note: 'Light cavalry for scouting, screening and the pursuit of a beaten enemy.' });
unit('cuirassier',{ name: 'Cuirassiers', cls: 'hcav', era: 3, atk: 18, def: 13, mor: 85, tags: ['shock'], cost: { F: 2, H: 3, I: 2, G: 1 }, br: 4.3, note: 'Breastplated heavy cavalry, the battle-winning reserve of the Napoleonic era.' });
unit('cannon',    { name: 'Field Artillery', cls: 'art', era: 3, atk: 16, def: 4, mor: 60, pen: 10, cost: { F: 1, T: 2, I: 3, G: 1 }, br: 4.0, note: 'Smoothbore 6- to 12-pounders firing round shot and canister. Napoleon was an artilleryman.' });
unit('guard',     { name: 'Guard Infantry', cls: 'inf', era: 3, atk: 18, def: 16, mor: 95, tags: ['discipline', 'volley'], pen: 6, cost: { F: 3, I: 3, G: 3 }, br: 4.7, note: 'Veteran elite grenadiers held back for the decisive blow.' });

// ---- Era 4: Industrial (American Civil War to the Great War)
unit('riflemen',  { name: 'Rifle Infantry', cls: 'inf', era: 4, atk: 20, def: 18, mor: 70, tags: ['volley', 'entrench'], pen: 8, cost: { F: 2, I: 2, G: 1 }, br: 5.0, note: 'Rifled muskets with Minié balls quadrupled effective range and made frontal assaults murderous.' });
unit('dragoon',   { name: 'Mounted Rifles', cls: 'lcav', era: 4, atk: 14, def: 11, mor: 70, tags: ['feint'], pen: 8, cost: { F: 1, H: 3, G: 1 }, br: 4.7, note: 'Cavalry that rides to the fight and dismounts to shoot.' });
unit('rifledart', { name: 'Rifled Artillery', cls: 'art', era: 4, atk: 24, def: 6, mor: 65, pen: 20, cost: { F: 1, T: 2, I: 4, G: 1 }, br: 5.3, note: 'Parrott rifles and Napoleons; later quick-firing guns like the French 75.' });
unit('mg',        { name: 'Machine Gun Company', cls: 'inf', era: 4, atk: 22, def: 16, mor: 75, tags: ['mg', 'entrench'], pen: 8, cost: { F: 1, I: 3, G: 2 }, br: 5.3, note: 'Maxim and Vickers guns: a handful of men could stop a battalion in the open.' });
unit('landship',  { name: 'Mark IV Tank', cls: 'armor', era: 4, atk: 20, def: 18, mor: 70, arm: 12, pen: 25, tags: ['shock', 'unreliable'], cost: { F: 1, I: 5, O: 2 }, br: 5.7, note: 'British rhomboid tank (1917). 12 mm plate stopped rifle bullets; 6-pdr guns and Lewis guns. Broke down constantly.' });
unit('biplane',   { name: 'Biplane Squadron', cls: 'air', era: 4, atk: 10, def: 6, mor: 70, pen: 5, tags: ['airsup'], cost: { F: 1, T: 2, I: 2, O: 1 }, br: 5.3, note: 'Scouts and light bombers over the trenches.' });

// ---- Era 5: Mechanized (1939–45). Armor = approximate effective frontal armor, pen = AP penetration near 500 m.
unit('ww2inf',    { name: 'Infantry Division', cls: 'inf', era: 5, atk: 26, def: 22, mor: 70, pen: 30, tags: ['entrench'], cost: { F: 2, I: 2 }, br: 6.0, note: 'Rifles, MGs, mortars and a few AT rifles or bazookas. Digs in fast.' });
unit('pzgren',    { name: 'Panzergrenadiers', cls: 'inf', era: 5, atk: 32, def: 26, mor: 80, pen: 45, tags: ['shock'], cost: { F: 2, I: 3, O: 1, G: 1 }, br: 6.7, note: 'Motorized infantry riding half-tracks alongside the tanks.' });
unit('pak',       { name: 'Anti-Tank Guns', cls: 'at', era: 5, atk: 28, def: 18, mor: 70, pen: 110, tags: ['entrench'], cost: { F: 1, I: 4, G: 1 }, br: 6.3, note: 'Towed 75–88 mm guns (Pak 40: ~100 mm at 500 m). Deadly from a camouflaged ambush.' });
unit('howitzer',  { name: 'Howitzers', cls: 'art', era: 5, atk: 34, def: 8, mor: 65, pen: 40, cost: { F: 1, I: 5, G: 1 }, br: 6.3, note: '105–152 mm field guns, the greatest killers of the war.' });
unit('pz3',       { name: 'Panzer III', cls: 'armor', era: 5, atk: 28, def: 24, mor: 75, arm: 50, pen: 60, tags: ['shock'], cost: { F: 1, I: 4, O: 2 }, br: 6.3, note: '1940–42 workhorse; 3-man turret and radio in every tank mattered more than its 37–50 mm gun.' });
unit('pz4',       { name: 'Panzer IV H', cls: 'armor', era: 5, atk: 36, def: 30, mor: 75, arm: 80, pen: 100, tags: ['shock'], cost: { F: 1, I: 5, O: 2 }, br: 7.0, note: 'Long 75 mm KwK 40: ~100 mm penetration. 80 mm flat front plate.' });
unit('t34',       { name: 'T-34/76', cls: 'armor', era: 5, atk: 33, def: 30, mor: 70, arm: 90, pen: 70, tags: ['shock'], cost: { F: 1, I: 4, O: 2 }, br: 6.7, note: '45 mm sloped at 60° ≈ 90 mm effective; wide tracks, cheap to build in vast numbers.' });
unit('sherman',   { name: 'M4 Sherman', cls: 'armor', era: 5, atk: 33, def: 30, mor: 80, arm: 90, pen: 75, tags: ['shock'], cost: { F: 1, I: 4, O: 2, G: 1 }, br: 6.7, note: '51 mm sloped glacis; reliable, easy to crew and repair. 75 mm M3 gun.' });
unit('panther',   { name: 'Panther', cls: 'armor', era: 5, atk: 44, def: 36, mor: 75, arm: 140, pen: 150, tags: ['shock', 'unreliable'], cost: { F: 1, I: 6, O: 3, G: 1 }, br: 7.7, note: '80 mm glacis at 55° and the 75 mm L/70. Debuted at Kursk, where many broke down on the march.' });
unit('tiger',     { name: 'Tiger I', cls: 'armor', era: 5, atk: 46, def: 40, mor: 85, arm: 100, pen: 120, tags: ['shock'], cost: { F: 1, I: 7, O: 3, G: 2 }, br: 8.0, note: '100 mm front, 8.8 cm KwK 36. Formidable and very expensive; fielded in small heavy battalions.' });
unit('stuka',     { name: 'Ju 87 Stuka', cls: 'air', era: 5, atk: 30, def: 10, mor: 75, pen: 60, tags: ['fear'], cost: { F: 1, I: 3, O: 2 }, br: 6.7, note: 'Dive bomber with a terrifying siren; flying artillery for the panzers. Easy prey for fighters.' });
unit('fighter',   { name: 'Fighter Wing', cls: 'air', era: 5, atk: 16, def: 18, mor: 80, pen: 20, tags: ['airsup'], cost: { F: 1, I: 3, O: 2, G: 1 }, br: 7.0, note: 'Bf 109, Spitfire, Yak-9: sweeps the skies of enemy bombers.' });
unit('il2',       { name: 'Il-2 Sturmovik', cls: 'air', era: 5, atk: 28, def: 16, mor: 75, pen: 50, cost: { F: 1, I: 4, O: 2 }, br: 7.0, note: 'Armored ground-attack aircraft built in greater numbers than any other warplane.' });

// Scenario-only variants (not recruitable)
unit('roman_cav', { name: 'Roman Cavalry', cls: 'hcav', era: 1, atk: 5, def: 4, mor: 60, tags: [], br: 1.5, hidden: true, note: 'Citizen horsemen, few and poorly suited to shock combat.' });
unit('libyan',    { name: 'Libyan Infantry', cls: 'inf', era: 1, atk: 9, def: 8, mor: 85, tags: ['discipline'], br: 2.1, hidden: true, note: 'Hannibal\'s African veterans, re-armed with captured Roman equipment.' });
unit('gaulspan',  { name: 'Gauls & Spaniards', cls: 'inf', era: 1, atk: 6, def: 6, mor: 70, tags: ['shock'], br: 1.6, hidden: true, note: 'Celtic and Iberian infantry, deployed in a crescent bowing toward the Romans.' });
unit('scythed',   { name: 'Scythed Chariots', cls: 'hcav', era: 1, atk: 8, def: 3, mor: 45, tags: ['shock', 'fear'], br: 1.4, hidden: true, note: 'Persian chariots with blades on the wheels. Alexander\'s men simply opened lanes and let them through.' });
unit('immortal',  { name: 'Persian Infantry', cls: 'inf', era: 1, atk: 5, def: 5, mor: 55, tags: [], br: 1.3, hidden: true, note: 'A huge, mixed force of levies from across the empire, around a core of Royal guards.' });
unit('pcav',      { name: 'Persian Cavalry', cls: 'hcav', era: 1, atk: 8, def: 6, mor: 65, tags: ['shock'], br: 1.9, hidden: true, note: 'Bactrian, Scythian and Persian horse: the empire\'s real striking arm.' });
unit('fknight',   { name: 'French Men-at-Arms', cls: 'inf', era: 2, atk: 12, def: 12, mor: 80, tags: [], br: 3.0, hidden: true, note: 'Dismounted nobility in heavy plate, advancing on foot across a sodden plowed field.' });
unit('reb',       { name: 'Confederate Brigade', cls: 'inf', era: 4, atk: 19, def: 16, mor: 85, tags: ['volley'], pen: 8, br: 5.0, hidden: true, note: 'Veterans of the Army of Northern Virginia, at the height of their confidence.' });
unit('napoleon12',{ name: '12-pdr Napoleons', cls: 'art', era: 4, atk: 22, def: 6, mor: 70, pen: 15, br: 5.0, hidden: true, note: 'Smoothbore bronze guns: at close range, canister was devastating.' });
unit('charb1',    { name: 'Char B1 bis', cls: 'armor', era: 5, atk: 26, def: 30, mor: 60, arm: 60, pen: 40, tags: [], br: 5.7, hidden: true, note: 'Thick 60 mm armor and two guns, but a one-man turret, few radios and a thirst for fuel.' });
unit('frinf',     { name: 'Series B Reservists', cls: 'inf', era: 5, atk: 18, def: 18, mor: 45, pen: 20, tags: ['entrench'], br: 4.7, hidden: true, note: 'The French 55th Division: older reservists, under-trained, in unfinished bunkers.' });
unit('pz38',      { name: 'Panzer 38(t) / II', cls: 'armor', era: 5, atk: 22, def: 20, mor: 80, arm: 30, pen: 40, tags: ['shock'], br: 5.7, hidden: true, note: 'Light tanks that made up most of the 1940 panzer force. Radio coordination was their edge.' });
unit('elefant',   { name: 'Ferdinand', cls: 'armor', era: 5, atk: 42, def: 42, mor: 70, arm: 200, pen: 165, tags: ['unreliable', 'nomg'], br: 7.7, hidden: true, note: '200 mm of frontal armor and the 8.8 cm L/71, but no machine gun; Soviet infantry could close in.' });
unit('su122',     { name: 'SU-122 / SU-152', cls: 'armor', era: 5, atk: 38, def: 28, mor: 70, arm: 60, pen: 130, tags: [], br: 7.0, hidden: true, note: 'Assault guns; the 152 mm earned the nickname "Zveroboy" (beast killer).' });
unit('spartan',   { name: 'Spartiates', cls: 'pike', era: 1, atk: 9, def: 12, mor: 100, tags: ['discipline', 'shieldwall'], br: 2.6, hidden: true, note: 'Full Spartan citizens, trained for war from the age of seven. They did not retreat.' });
unit('immortals', { name: 'Immortals', cls: 'inf', era: 1, atk: 7, def: 6, mor: 80, tags: ['discipline'], br: 1.8, hidden: true, note: 'The 10,000 elite Persian guard, armed with short spears, bows and wicker shields. Their number was kept constant.' });
unit('romanian',  { name: 'Romanian Infantry', cls: 'inf', era: 5, atk: 18, def: 18, mor: 45, pen: 25, tags: ['entrench'], br: 5.0, hidden: true, note: 'Brave but badly equipped: a handful of 37 mm anti-tank guns that could not stop a T-34.' });
unit('sovrifle',  { name: 'Rifle Division (dug in)', cls: 'inf', era: 5, atk: 24, def: 24, mor: 75, pen: 35, tags: ['entrench'], br: 6.0, hidden: true, note: 'Soviet infantry in deep trench lines behind dense minefields.' });

// Battle orders a commander can issue to each sector
const ORDERS = {
  HOLD:     { name: 'Hold', icon: '■', desc: 'Stand firm. Strong defense, uses the ground, fires on anything that comes on. Never baited.' },
  ADVANCE:  { name: 'Advance', icon: '▶', desc: 'Close and fight. Pushes the line forward if you win the exchange.' },
  CHARGE:   { name: 'Charge', icon: '⏩', desc: 'All-out shock attack. Huge for cavalry and armor on good ground; ruinous against pikes, stakes, mud or uphill.' },
  BOMBARD:  { name: 'Bombard', icon: '✸', desc: 'Missiles and guns fire; melee troops stay back. Wears down an enemy who will not come on.' },
  FALLBACK: { name: 'Give Ground', icon: '◀', desc: 'Withdraw in order, taking half the losses. An enemy who follows is drawn in — exposed to flank attacks.' },
  FEINT:    { name: 'Feign Retreat', icon: '↺', desc: 'Needs cavalry or drilled troops. If the enemy pursues, they are disordered for the next round. Wasted against a steady enemy.' },
  ENVELOP:  { name: 'Envelop', icon: '↷', desc: 'Only when this sector is clear of enemies: swing into an adjacent sector and hit the enemy\'s flank.' },
};

// Doctrines: the historical battle plans. Each changes how the engine treats certain orders.
const DOCTRINES = {
  none:        { name: 'Conventional', hist: '', desc: 'No special plan.' },
  envelopment: { name: 'Double Envelopment', hist: 'Hannibal at Cannae, 216 BC', desc: 'Giving ground costs ⅓ less; flank attacks hit 30% harder; enemies hit from both flanks are surrounded and destroyed rather than routed.' },
  hammer:      { name: 'Hammer and Anvil', hist: 'Alexander at Gaugamela, 331 BC', desc: 'Heavy cavalry +30% when charging or enveloping; spears/pikes +20% defense while holding. Pin with the phalanx, strike with the horse.' },
  shieldwall:  { name: 'Shield Wall', hist: 'Harold at Hastings, 1066', desc: 'Infantry holding gain +30% defense and recover morale each round. Pursuing a fleeing enemy breaks the wall.' },
  feigned:     { name: 'Feigned Retreat', hist: 'William at Hastings; the Mongols at the Kalka', desc: 'Feints take less loss and leave pursuers disordered for two rounds instead of one.' },
  longbow:     { name: 'Stakes and Longbows', hist: 'Henry V at Agincourt, 1415', desc: 'Missile troops +35%. Any charge into a sector with your archers loses half its force.' },
  central:     { name: 'Bait and Central Position', hist: 'Napoleon at Austerlitz, 1805', desc: 'Reserves strike +40% the round they are committed. Giving ground costs no morale.' },
  battery:     { name: 'Grand Battery', hist: 'Napoleon at Wagram, 1809', desc: 'Artillery +40% when bombarding.' },
  entrenched:  { name: 'Entrenched Defense', hist: 'Meade on Cemetery Ridge, 1863', desc: 'Entrenching infantry +40% defense while holding; machine guns and rifles shred advancing infantry.' },
  assault:     { name: 'Grand Assault', hist: 'Lee at Gettysburg, 1863', desc: 'Infantry +15% when advancing and +10 morale. Effective against a weak line, deadly to the attacker against a strong one.' },
  blitz:       { name: 'Blitzkrieg (Schwerpunkt)', hist: 'Guderian at Sedan, 1940', desc: 'Armor and aircraft +40% in the sector where you concentrate the most armor, −10% elsewhere. Breaking through demoralizes the whole enemy army.' },
  depth:       { name: 'Defense in Depth', hist: 'Rokossovsky and Vatutin at Kursk, 1943', desc: 'Giving ground costs only a third of the losses and no morale. Anti-tank guns +30%. Counterattacks into a drawn-in enemy +30%.' },
  triplex:     { name: 'Triplex Acies', hist: 'The Roman manipular legion', desc: 'Committing reserves restores 20 morale to the whole sector as fresh lines relieve tired ones.' },
  oblique:     { name: 'Oblique Order', hist: 'Epaminondas at Leuctra, 371 BC; Frederick at Leuthen, 1757', desc: 'Your most heavily manned sector strikes +35%. Your other sectors gain +25% defense while holding or giving ground: refuse the weak wing, crush with the strong one.' },
  schiltron:   { name: 'Schiltron', hist: 'Robert the Bruce at Bannockburn, 1314', desc: 'Spear and pike formations attack +30% and stay bristling on the move: charging horsemen lose 40% against them even when they advance.' },
  reverseslope:{ name: 'Reverse Slope', hist: 'Wellington at Waterloo, 1815', desc: 'Troops holding behind a ridge take 40% less from artillery and missiles, and infantry holding form squares that blunt cavalry charges.' },
  combined:    { name: 'Combined Arms', hist: 'Modern doctrine', desc: '+15% in any sector where you fight with three or more troop types.' },
};

// Nations for the campaign. Each has a signature doctrine and a perk.
const NATIONS = [
  { id: 'rome',     name: 'Rome',     color: '#b8322a', doctrine: 'triplex',     perk: 'Infantry +10% defense. Roads of iron: recruits cost 1 less Iron (min 1).',            unique: { legion: 1 } },
  { id: 'carthage', name: 'Carthage', color: '#7b3fa0', doctrine: 'envelopment', perk: 'Merchant republic: trade with the bank at 3:1 everywhere.',                          unique: {} },
  { id: 'macedon',  name: 'Macedon',  color: '#d9a21b', doctrine: 'hammer',      perk: 'Heavy cavalry +15% attack. Start with Horseback Riding.',                             unique: {} },
  { id: 'mongols',  name: 'Mongols',  color: '#3f8a52', doctrine: 'feigned',     perk: 'Pastures yield 2 Horses. Armies with only mounted units move 2 hexes.',               unique: {} },
  { id: 'england',  name: 'England',  color: '#cfcfd6', doctrine: 'longbow',     perk: 'Missile units +15% attack. Forests yield +1 Timber when rolled.',                    unique: {} },
  { id: 'france',   name: 'France',   color: '#2f5fb8', doctrine: 'central',     perk: 'Artillery +20% attack. Each city adds +1 Science.',                                  unique: {} },
  { id: 'germany',  name: 'Germany',  color: '#5d6168', doctrine: 'blitz',       perk: 'Armor +10% attack. Iron hills yield +1 Iron when rolled.',                           unique: {} },
  { id: 'russia',   name: 'Russia',   color: '#2f8f9a', doctrine: 'depth',       perk: 'Recruits cost 1 less Food (min 1). Units in your own territory heal twice as fast.',  unique: {} },
];

// Terrain of the campaign board. res: resource produced when the hex's number is rolled.
const TERRAIN = {
  sea:      { name: 'Sea',       res: null, color: '#2f6b8f', pass: false },
  plains:   { name: 'Farmland',  res: 'F', color: '#d8c56a', def: 0,    battle: [] },
  forest:   { name: 'Forest',    res: 'T', color: '#4f7d3c', def: 0.15, battle: ['woods'] },
  hills:    { name: 'Iron Hills',res: 'I', color: '#9a7a58', def: 0.25, battle: ['hill'] },
  pasture:  { name: 'Steppe',    res: 'H', color: '#a8c46a', def: 0,    battle: [] },
  gold:     { name: 'River Delta', res: 'G', color: '#c9b07a', def: 0.1, battle: ['river'] },
  desert:   { name: 'Desert',    res: 'O', color: '#e3cf98', def: 0,    battle: [], oilEra: 4 },
  mountain: { name: 'Mountains', res: null, color: '#7a7470', pass: false },
};
const RES = {
  F: { name: 'Food',   icon: '🌾', color: '#e7c94a' },
  T: { name: 'Timber', icon: '🪵', color: '#7a5230' },
  I: { name: 'Iron',   icon: '⛏', color: '#8a8f99' },
  H: { name: 'Horses', icon: '🐎', color: '#b07a45' },
  G: { name: 'Gold',   icon: '🪙', color: '#f0c040' },
  O: { name: 'Oil',    icon: '🛢', color: '#3a3a3a' },
};
const RES_KEYS = ['F', 'T', 'I', 'H', 'G', 'O'];

// Campaign tech tree. Each era needs 3 of its techs researched to advance (Civ-style ages).
const TECHS = [
  // Era 1
  { id: 'bronze',    era: 1, name: 'Bronze Working',     units: ['hoplite'],              doctrines: ['oblique'] },
  { id: 'archery',   era: 1, name: 'Archery',            units: ['archer'],               doctrines: [] },
  { id: 'riding',    era: 1, name: 'Horseback Riding',   units: ['lightcav', 'companion'],doctrines: ['hammer'] },
  { id: 'iron',      era: 1, name: 'Iron Working',       units: ['legion'],               doctrines: ['triplex'] },
  { id: 'elephants', era: 1, name: 'Elephantry',         units: ['elephant'],             doctrines: [] },
  // Era 2
  { id: 'feudal',    era: 2, name: 'Feudalism',          units: ['knight', 'maa'],        doctrines: [] },
  { id: 'housecarl', era: 2, name: 'Household Troops',   units: ['huscarl', 'fyrd', 'milites'], doctrines: ['shieldwall', 'feigned'] },
  { id: 'longbow',   era: 2, name: 'Yeoman Archery',     units: ['longbow'],              doctrines: ['longbow'] },
  { id: 'pike',      era: 2, name: 'Pike and Crossbow',  units: ['pikemen', 'crossbow'],  doctrines: ['schiltron'] },
  { id: 'steppe',    era: 2, name: 'Steppe Warfare',     units: ['horsearch'],            doctrines: ['feigned'] },
  // Era 3
  { id: 'gunpowder', era: 3, name: 'Gunpowder',          units: ['lineinf', 'voltigeur'], doctrines: ['reverseslope'] },
  { id: 'artillery', era: 3, name: 'Field Artillery',    units: ['cannon'],               doctrines: ['battery'] },
  { id: 'lightdrill',era: 3, name: 'Light Cavalry Drill',units: ['hussar'],               doctrines: [] },
  { id: 'cuirass',   era: 3, name: 'Heavy Cavalry',      units: ['cuirassier'],           doctrines: [] },
  { id: 'corps',     era: 3, name: 'Corps System',       units: ['guard'],                doctrines: ['central'] },
  // Era 4
  { id: 'rifling',   era: 4, name: 'Rifling',            units: ['riflemen', 'rifledart'],doctrines: ['entrenched', 'assault'] },
  { id: 'maxim',     era: 4, name: 'Machine Guns',       units: ['mg'],                   doctrines: [] },
  { id: 'combustion',era: 4, name: 'Combustion',         units: ['landship'],             doctrines: [], oil: true },
  { id: 'flight',    era: 4, name: 'Flight',             units: ['biplane'],              doctrines: [] },
  { id: 'mounted',   era: 4, name: 'Mounted Rifles',     units: ['dragoon'],              doctrines: [] },
  // Era 5
  { id: 'mech',      era: 5, name: 'Mechanized Warfare', units: ['pz3', 'pzgren', 'sherman'], doctrines: ['combined'] },
  { id: 'heavyarm',  era: 5, name: 'Heavy Armor',        units: ['pz4', 't34', 'panther', 'tiger'], doctrines: [] },
  { id: 'atdoc',     era: 5, name: 'Anti-Tank Doctrine', units: ['pak', 'ww2inf'],        doctrines: ['depth'] },
  { id: 'airpower',  era: 5, name: 'Air Power',          units: ['stuka', 'fighter', 'il2'], doctrines: [] },
  { id: 'radio',     era: 5, name: 'Radio & Howitzers',  units: ['howitzer'],             doctrines: ['blitz'] },
];
const TECH_COST = [0, 16, 45, 95, 150, 230];
const START_UNITS = ['levy', 'warband', 'slinger'];

// Buildings on campaign hexes
const BUILD = {
  settlement: { name: 'Settlement', cost: { F: 1, T: 1, H: 1 }, desc: 'Lets this hex and your neighbouring hexes produce.' },
  city:       { name: 'City',       cost: { F: 2, I: 3, G: 1 }, desc: 'Upgrade a settlement. Production here and next door doubles. +1 Science (capital +2) and +1 Gold per turn. Recruits here.' },
  fort:       { name: 'Fortress',   cost: { T: 2, I: 2 },       desc: 'Defenders here hold the high ground: fortified terrain in battle.' },
  market:     { name: 'Market',     cost: { T: 2, G: 2 },       desc: 'City only. Trade with the bank at 3:1 (2:1 for that hex\'s resource).' },
  academy:    { name: 'Academy',    cost: { T: 2, I: 1, G: 2 }, desc: 'City only. +2 Science per turn.' },
};

// Events drawn when the player rolls a 7. Each is a decision.
const EVENTS = [
  { id: 'bandits', title: 'Raiders in the Hills', text: 'Bandits are raiding farms and caravans near {hex}. Every turn they sit there, that hex produces nothing.',
    choices: [
      { label: 'Pay them off', cost: { G: 2 }, effect: 'clear', out: 'The chieftain takes the gold and rides off. For now.' },
      { label: 'Send the nearest army', effect: 'fight', out: 'Your troops ride out to clear the hills.' },
      { label: 'Ignore them', effect: 'bandit', out: 'The raiders settle in. {hex} produces nothing until you deal with them.' } ] },
  { id: 'plague', title: 'Plague in {city}', text: 'Fever is spreading through {city}. The physicians want the gates closed and the granaries opened.',
    choices: [
      { label: 'Quarantine and feed the city', cost: { F: 3 }, effect: 'none', out: 'The plague burns out within the walls. Hungry but alive.' },
      { label: 'Keep the gates open', effect: 'plague', out: 'Trade continues, but the sickness reaches the barracks. Armies in {city} lose strength.' } ] },
  { id: 'merc', title: 'A Free Company Offers Its Swords', text: 'Veteran mercenaries are camped outside {city}, looking for a paymaster.',
    choices: [
      { label: 'Hire them', cost: { G: 3 }, effect: 'merc', out: 'They swear on their banner. A veteran unit joins your army in {city}.' },
      { label: 'Send them to a rival', cost: { G: 1 }, effect: 'mercRival', out: 'A small bribe sends them marauding across your rival\'s border.' },
      { label: 'Decline', effect: 'none', out: 'They march off to find another war.' } ] },
  { id: 'scholar', title: 'A Wandering Scholar', text: 'A scholar from a distant land asks for patronage. He claims knowledge of new military arts.',
    choices: [
      { label: 'Fund his work', cost: { G: 2 }, effect: 'science', amt: 8, out: 'His treatises are translated. +8 Science.' },
      { label: 'Put him to work as an engineer', cost: { T: 1 }, effect: 'fortFree', out: 'He designs a fortress for {city}, free of charge.' },
      { label: 'Turn him away', effect: 'none', out: 'He takes his scrolls to your rivals.' } ] },
  { id: 'harvest', title: 'Bumper Harvest', text: 'The granaries of {city} are overflowing.',
    choices: [
      { label: 'Store it', effect: 'gain', gain: { F: 4 }, out: '+4 Food.' },
      { label: 'Sell it abroad', effect: 'gain', gain: { G: 2 }, out: '+2 Gold.' },
      { label: 'Feast for the troops', effect: 'morale', out: 'Every army is healed to full strength.' } ] },
  { id: 'defector', title: 'An Enemy Officer Defects', text: 'A staff officer from {rival} has crossed the border with maps of their defenses.',
    choices: [
      { label: 'Use his maps', effect: 'intel', out: 'Your next attack on {rival} starts with their army disordered.' },
      { label: 'Ransom him back', effect: 'gain', gain: { G: 3 }, out: '{rival} pays handsomely to get him back. +3 Gold.' } ] },
  { id: 'revolt', title: 'Unrest in {city}', text: 'Taxes and conscription have the people of {city} in the streets.',
    choices: [
      { label: 'Lower taxes', cost: { G: 2 }, effect: 'none', out: 'Calm returns.' },
      { label: 'Send in the garrison', effect: 'revolt', out: 'Order is restored, but the garrison takes losses.' },
      { label: 'Grant a charter', cost: { F: 1, T: 1 }, effect: 'science', amt: 3, out: 'The guilds organize. +3 Science.' } ] },
  { id: 'storm', title: 'Storm at Sea', text: 'A great storm wrecks the coastal warehouses.',
    choices: [
      { label: 'Rebuild quickly', cost: { T: 2 }, effect: 'none', out: 'The warehouses are rebuilt before the next caravan.' },
      { label: 'Accept the losses', effect: 'lose', out: 'You lose half of your largest stockpile.' } ] },
];
