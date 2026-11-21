// Iron Banners — additional historical battles, then all battles sorted chronologically
'use strict';

SCENARIOS.push(
{
  id: 'thermopylae', name: 'Thermopylae', year: '480 BC', date: 'August 480 BC', place: 'The pass of Thermopylae, central Greece', era: 1,
  war: 'Greco-Persian Wars', histWinner: 1, defender: 0, maxRounds: 9,
  sectors: [
    { name: 'Shore of the Malian Gulf', terrain: ['narrow'], note: 'Cliffs on one side, sea on the other: barely room for a few files.' },
    { name: 'The Phocian Wall', terrain: ['narrow', 'fort'], owner: 0, note: 'The Greeks have rebuilt an old wall across the narrowest point (the Middle Gate).' },
    { name: 'The Anopaea path', terrain: ['hill', 'woods'], owner: 0, note: 'A goat track over the mountain that leads behind the Greek position.' },
  ],
  sides: [
    { name: 'Greek Alliance', commander: 'King Leonidas I of Sparta', color: '#b8322a', men: 7000, doctrine: 'shieldwall', doctrines: ['shieldwall', 'oblique', 'none'],
      general: { name: 'Leonidas', sector: 1 },
      units: [
        ['hoplite', 0, { name: 'Arcadian Hoplites' }], ['hoplite', 0, { name: 'Corinthian & Peloponnesian Hoplites' }],
        ['spartan', 1, { name: 'The 300 Spartiates' }], ['hoplite', 1, { name: 'Thespians' }], ['hoplite', 1, { name: 'Thebans' }],
        ['hoplite', 2, { name: 'Phocians (guarding the path)', str: 50 }],
        ['hoplite', 'R', { name: 'Mantineans & Tegeans' }],
      ],
      script: [ { round: 1, orders: ['HOLD', 'HOLD', 'HOLD'] } ] },
    { name: 'Persian Empire', commander: 'Xerxes I', color: '#c8743a', men: 120000, doctrine: 'none', doctrines: ['none'],
      general: { name: 'Xerxes', sector: 'R' },
      units: [
        ['immortal', 0, { name: 'Median Infantry' }], ['immortal', 0, { name: 'Cissian Infantry' }], ['immortal', 0, { name: 'Saka Infantry' }], ['archer', 0, { name: 'Persian Archers' }],
        ['immortal', 1, { name: 'Median Infantry' }], ['immortal', 1, { name: 'Cissian Infantry' }], ['immortal', 1, { name: 'Levies' }], ['immortal', 1, { name: 'Levies under the whip' }], ['archer', 1, { name: 'Persian Archers' }],
        ['immortals', 'R', { name: 'The Immortals' }], ['immortal', 'R', { name: 'Levies' }],
      ],
      reinforce: [ { round: 5, sector: 2, units: [ ['immortals', { name: 'Immortals under Hydarnes' }], ['immortals', { name: 'Immortals under Hydarnes' }], ['immortals', { name: 'Immortals under Hydarnes' }] ], text: 'Guided by Ephialtes, Hydarnes and the Immortals emerge on the Anopaea path at dawn.' } ],
      script: [ { round: 1, orders: ['ADVANCE', 'ADVANCE', null] }, { round: 2, orders: ['ADVANCE', 'ADVANCE', null], commit: 1 }, { round: 3, orders: ['BOMBARD', 'ADVANCE', null] }, { round: 5, orders: ['ADVANCE', 'ADVANCE', 'ADVANCE'] } ] },
  ],
  briefing: [
    'Xerxes has crossed the Hellespont with the largest army the world has seen — perhaps 100,000 to 150,000 men, not the millions Herodotus claims. A small Greek force under Leonidas of Sparta has blocked the coastal pass where it narrows to a cart track.',
    'In the pass, numbers count for little. But a local man named Ephialtes knows a path over the mountain — and he is for sale.',
  ],
  plan: 'Greeks: hold the wall and the shore; only a few Persians can fight at once and the rest crowd behind. The danger comes on round 5, when the Immortals appear on the mountain path. Reinforce the path from your reserve — or be surrounded. Persians: wear them down, then strike when the path opens.',
  history: 'For two days the Greeks threw back every assault, including the Immortals, rotating fresh contingents into the line. Then Ephialtes led Hydarnes over the Anopaea path by night; the Phocians guarding it withdrew to a hilltop and let them pass. Warned, Leonidas sent most of the army away and stayed with his 300 Spartans, about 700 Thespians and 400 Thebans. They were surrounded and killed almost to the last man; most of the Thebans surrendered. Weeks later the Greek fleet won at Salamis.',
  lesson: 'Terrain multiplies a small force — but every position has a way around it.',
},
{
  id: 'leuctra', name: 'Leuctra', year: '371 BC', date: 'July 371 BC', place: 'Boeotia, central Greece', era: 1,
  war: 'Boeotian War', histWinner: 0, defender: null, maxRounds: 8,
  sectors: [
    { name: 'Theban left / Spartan right', terrain: [], note: 'Where King Cleombrotus and the Spartiates stand.' },
    { name: 'Center', terrain: [], note: 'Open plain between the camps.' },
    { name: 'Theban right / Spartan left', terrain: [], note: 'Spartan allies, many of them unwilling.' },
  ],
  sides: [
    { name: 'Thebes', commander: 'Epaminondas', color: '#2f5fb8', men: 7000, doctrine: 'oblique', doctrines: ['oblique', 'none'],
      general: { name: 'Epaminondas', sector: 0 },
      units: [
        ['hoplite', 0, { name: 'Theban Column (50 deep)' }], ['hoplite', 0, { name: 'Theban Column' }], ['spartan', 0, { name: 'The Sacred Band (Pelopidas)' }], ['companion', 0, { name: 'Theban Cavalry' }],
        ['hoplite', 1, { name: 'Boeotian Hoplites', str: 80 }],
        ['hoplite', 2, { name: 'Boeotian Allies', str: 80 }],
      ],
      script: [ { round: 1, orders: ['CHARGE', 'FALLBACK', 'FALLBACK'] }, { round: 2, orders: ['ADVANCE', 'HOLD', 'FALLBACK'] } ] },
    { name: 'Sparta', commander: 'King Cleombrotus I', color: '#b8322a', men: 11000, doctrine: 'none', doctrines: ['none', 'shieldwall'],
      general: { name: 'Cleombrotus', sector: 0 },
      units: [
        ['spartan', 0, { name: 'Spartiates & the King\'s guard' }], ['hoplite', 0, { name: 'Lacedaemonian Hoplites' }], ['lightcav', 0, { name: 'Spartan Cavalry' }],
        ['hoplite', 1, { name: 'Peloponnesian Allies' }], ['hoplite', 1, { name: 'Peloponnesian Allies' }],
        ['hoplite', 2, { name: 'Phocian & Heraclean Allies' }], ['hoplite', 2, { name: 'Allied Hoplites' }],
      ],
      script: [ { round: 1, orders: ['ADVANCE', 'ADVANCE', 'ADVANCE'] }, { round: 2, orders: ['HOLD', 'ADVANCE', 'ADVANCE'] } ] },
  ],
  briefing: [
    'For generations no Spartan army had lost a pitched battle on anything like equal terms. Custom put the best troops on the right wing, where they would roll up the enemy\'s weakest men.',
    'Epaminondas breaks the custom. He stacks his Thebans 50 shields deep on the left — straight at the Spartan king — and holds back his weaker center and right, angled away from the enemy.',
  ],
  plan: 'Charge with the deep column and the Sacred Band on the left, where your cavalry will scatter the poor Spartan horse. Keep your weak wings back (Give Ground or Hold) so they are not caught. Kill or rout the Spartan right, and the rest of the alliance will lose heart.',
  history: 'The Theban cavalry drove the Spartan horse back into their own infantry. The massive Theban column, led by the Sacred Band, smashed into the Spartan right before the rest of the lines met. Cleombrotus was mortally wounded; about 400 of the 700 Spartiates present fell. The Spartan allies, barely engaged, withdrew. Spartan military supremacy ended in an afternoon.',
  lesson: 'Oblique order: concentrate overwhelming force on one wing and refuse the other.',
},
{
  id: 'bannockburn', name: 'Bannockburn', year: '1314', date: '24 June 1314', place: 'Near Stirling, Scotland', era: 2,
  war: 'First War of Scottish Independence', histWinner: 0, defender: null, maxRounds: 8,
  sectors: [
    { name: 'Pelstream flank', terrain: ['narrow', 'mud'], note: 'The boggy carse, hemmed in by the Pelstream burn.' },
    { name: 'The Carse', terrain: ['narrow', 'mud'], note: 'Wet, cramped ground where the English camped overnight.' },
    { name: 'Bannock Burn flank', terrain: ['narrow', 'mud'], note: 'Steep banks and deep water behind the English.' },
  ],
  sides: [
    { name: 'Scotland', commander: 'Robert the Bruce', color: '#2f5fb8', men: 6500, doctrine: 'schiltron', doctrines: ['schiltron', 'none'],
      general: { name: 'Robert the Bruce', sector: 'R' },
      units: [
        ['pikemen', 0, { name: 'Schiltron (Moray)', mor: 85 }], ['pikemen', 0, { name: 'Schiltron (Moray, rear ranks)', mor: 85 }],
        ['pikemen', 1, { name: 'Schiltron (Edward Bruce)', mor: 85 }], ['pikemen', 1, { name: 'Schiltron (Douglas)', mor: 85 }],
        ['pikemen', 2, { name: 'Schiltron (Bruce)', mor: 90 }], ['pikemen', 2, { name: 'Schiltron (Bruce, rear ranks)', mor: 90 }],
        ['lightcav', 'R', { name: 'Keith\'s Light Horse' }], ['pikemen', 'R', { name: 'Highland & Island Men' }],
      ],
      reinforce: [ { round: 4, sector: 1, units: [ ['levy', { name: 'The Small Folk (Gillies\' Hill)', mor: 70 }], ['levy', { name: 'Camp Followers with banners', mor: 70 }] ], text: 'The "small folk" — Scottish camp followers — pour down Gillies\' Hill. The English take them for a fresh army.' } ],
      script: [ { round: 1, orders: ['ADVANCE', 'ADVANCE', 'ADVANCE'] } ] },
    { name: 'England', commander: 'King Edward II', color: '#cfcfd6', men: 17000, doctrine: 'none', doctrines: ['none'], startDisorder: 1,
      general: { name: 'Earl of Gloucester', sector: 1 },
      units: [
        ['knight', 0, { name: 'Mounted Knights' }], ['fyrd', 0, { name: 'English Foot' }],
        ['knight', 1, { name: 'Vanguard (Gloucester & Hereford)' }], ['knight', 1, { name: 'Mounted Knights' }], ['fyrd', 1, { name: 'English Foot' }],
        ['knight', 2, { name: 'Mounted Knights' }], ['fyrd', 2, { name: 'English Foot' }],
        ['longbow', 'R', { name: 'English & Welsh Archers' }], ['longbow', 'R', { name: 'Archers' }], ['fyrd', 'R', { name: 'Infantry (rear)' }],
      ],
      script: [ { round: 1, orders: ['CHARGE', 'CHARGE', 'CHARGE'] }, { round: 2, orders: ['ADVANCE', 'CHARGE', 'ADVANCE'] }, { round: 3, orders: [null, null, null], commit: 0 } ] },
  ],
  briefing: [
    'Edward II has come to relieve Stirling Castle with the largest English army sent into Scotland in years. Yesterday Bruce killed Sir Henry de Bohun with an axe in single combat in front of both armies, and the English vanguard was repulsed.',
    'The English spent the night on the carse — wet, cramped ground between two streams. At dawn the Scots do the unthinkable: their spear formations, the schiltrons, advance to attack heavy cavalry.',
  ],
  plan: 'Advance with the schiltrons and pin the English knights in the bog where they cannot charge properly. When the English archers come forward from their reserve, commit Keith\'s light horse to scatter them. Keep pressing; the burn is at their backs.',
  history: 'The English knights charged the advancing schiltrons and impaled themselves on the spears; the Earl of Gloucester was killed. With the cavalry jammed in the narrow ground, the archers could not shoot without hitting their own men. A body of archers that worked round to the flank was ridden down by Keith\'s horse. The English broke; many drowned trying to cross the Bannock Burn. Edward II escaped to Dunbar and took ship for England.',
  lesson: 'Disciplined spearmen can attack cavalry — if the ground takes away the horse\'s room to charge.',
},
{
  id: 'waterloo', name: 'Waterloo', year: '1815', date: '18 June 1815', place: 'Mont-Saint-Jean, Belgium', era: 3,
  war: 'Hundred Days (War of the Seventh Coalition)', histWinner: 0, defender: 0, maxRounds: 10,
  sectors: [
    { name: 'West: Hougoumont', terrain: ['hill', 'fort'], owner: 0, note: 'A walled château and farm, held by the Guards.' },
    { name: 'Center: La Haye Sainte & the ridge', terrain: ['hill'], owner: 0, note: 'Wellington\'s line sits behind the crest of the Mont-Saint-Jean ridge.' },
    { name: 'East: Papelotte & Plancenoit', terrain: [], note: 'Open ground on the road from Wavre, where the Prussians are coming.' },
  ],
  sides: [
    { name: 'Anglo-Allied Army', commander: 'Duke of Wellington', color: '#b8322a', men: 68000, doctrine: 'reverseslope', doctrines: ['reverseslope', 'none'],
      general: { name: 'Wellington', sector: 1 },
      units: [
        ['guard', 0, { name: 'Coldstream & Scots Guards (Hougoumont)' }], ['lineinf', 0, { name: 'Brunswick & Nassau Troops' }],
        ['lineinf', 1, { name: 'Picton\'s Division' }], ['lineinf', 1, { name: 'Alten\'s Division' }], ['guard', 1, { name: 'Maitland\'s Foot Guards' }], ['cannon', 1, { name: 'Royal Horse Artillery' }],
        ['lineinf', 2, { name: 'Saxe-Weimar\'s Nassauers (Papelotte)' }], ['hussar', 2, { name: 'Vivian & Vandeleur\'s Light Cavalry' }],
        ['cuirassier', 'R', { name: 'Household & Union Brigades' }], ['lineinf', 'R', { name: 'Chassé\'s Dutch-Belgians' }],
      ],
      reinforce: [
        { round: 5, sector: 2, units: [ ['lineinf', { name: 'Prussian IV Corps (Bülow)' }], ['lineinf', { name: 'Prussian IV Corps (Bülow)' }] ], text: 'Bülow\'s Prussian IV Corps bursts out of the Bois de Paris toward Plancenoit.' },
        { round: 7, sector: 2, units: [ ['lineinf', { name: 'Prussian I Corps (Zieten)' }], ['hussar', { name: 'Prussian Cavalry' }] ], text: 'Zieten\'s Prussian I Corps links up with Wellington\'s left.' },
      ],
      script: [ { round: 1, orders: ['HOLD', 'HOLD', 'HOLD'] }, { round: 3, orders: ['HOLD', 'HOLD', 'HOLD'], commit: 1 } ] },
    { name: 'France', commander: 'Napoleon I', color: '#2f5fb8', men: 73000, doctrine: 'battery', doctrines: ['battery', 'central', 'none'],
      general: { name: 'Napoleon', sector: 1 },
      units: [
        ['lineinf', 0, { name: 'II Corps (Reille, Jérôme)' }], ['lineinf', 0, { name: 'II Corps (Reille)' }],
        ['lineinf', 1, { name: 'I Corps (d\'Erlon)' }], ['lineinf', 1, { name: 'I Corps (d\'Erlon)' }], ['cannon', 1, { name: 'Grand Battery (80 guns)' }], ['cannon', 1, { name: 'Grand Battery' }], ['cuirassier', 1, { name: 'Milhaud\'s Cuirassiers (Ney)' }], ['cuirassier', 1, { name: 'Kellermann\'s Cuirassiers' }],
        ['lineinf', 2, { name: 'VI Corps (Lobau)' }],
        ['guard', 'R', { name: 'Imperial Guard (Middle Guard)' }], ['guard', 'R', { name: 'Imperial Guard (Old Guard)' }],
      ],
      script: [ { round: 1, orders: ['ADVANCE', 'BOMBARD', 'HOLD'] }, { round: 2, orders: ['ADVANCE', 'ADVANCE', 'HOLD'] }, { round: 3, orders: ['ADVANCE', 'BOMBARD', 'HOLD'] }, { round: 4, orders: ['ADVANCE', 'CHARGE', 'HOLD'] }, { round: 5, orders: ['ADVANCE', 'CHARGE', 'HOLD'] }, { round: 7, orders: [null, 'ADVANCE', null], commit: 1 } ] },
  ],
  briefing: [
    'Napoleon has escaped from Elba and retaken his throne. Two days ago he beat the Prussians at Ligny and sent them reeling — but not destroyed. Now he faces Wellington\'s multinational army on a ridge south of Brussels.',
    'Rain all night has soaked the ground, and Napoleon delays his attack until it dries. Wellington has placed most of his men behind the crest, out of sight of the French guns. Blücher has promised to come.',
  ],
  plan: 'Allies: Hold the ridge and the farms. Behind the slope your men shelter from the Grand Battery; in square they defy the cuirassiers. The Prussians arrive in the east on rounds 5 and 7 — then go over to the attack. France: you must break Wellington before the Prussians arrive. Do not waste your cavalry on unbroken squares.',
  history: 'A diversion against Hougoumont swallowed most of a French corps. D\'Erlon\'s grand assault was thrown back, and the British heavy cavalry charge that routed it galloped on into the Grand Battery and was cut to pieces. Ney then led massed, unsupported cavalry charges against Allied squares for two hours. La Haye Sainte fell at about 6:30 p.m., but the Prussians were already storming Plancenoit. Napoleon\'s last throw — the Imperial Guard — was broken by volleys from the Guards on the ridge, and the cry "La Garde recule!" shattered the army. Wellington lost about 17,000 men and Blücher about 7,000; French losses were perhaps 25,000 killed and wounded, plus thousands captured. Napoleon abdicated four days later.',
  lesson: 'Reverse slope and allies: shelter from fire, buy time, and let the second army decide it.',
},
{
  id: 'cambrai', name: 'Cambrai', year: '1917', date: '20 November 1917', place: 'Cambrai, northern France', era: 4,
  war: 'First World War — Western Front', histWinner: 0, defender: 1, maxRounds: 7,
  sectors: [
    { name: 'Havrincourt', terrain: ['fort'], owner: 1, note: 'Wide belts of wire and deep trenches of the Hindenburg Line.' },
    { name: 'Flesquières ridge', terrain: ['fort', 'hill'], owner: 1, note: 'German field batteries on the reverse slope, trained to fire at tanks.' },
    { name: 'Masnières & the canal', terrain: ['fort', 'river'], owner: 1, note: 'The St Quentin canal: the bridges are the prize.' },
  ],
  sides: [
    { name: 'Britain', commander: 'Sir Julian Byng (Third Army)', color: '#b8322a', men: 100000, doctrine: 'combined', doctrines: ['combined', 'none'],
      general: { name: 'Byng', sector: 'R' },
      units: [
        ['landship', 0, { name: 'Tank Corps (C & D Bns)' }], ['landship', 0, { name: 'Tank Corps' }], ['riflemen', 0, { name: '62nd (West Riding) Division' }],
        ['landship', 1, { name: 'Tank Corps (E Bn)' }], ['landship', 1, { name: 'Tank Corps (G Bn)' }], ['riflemen', 1, { name: '51st Highland Division' }], ['rifledart', 1, { name: 'Predicted-fire Batteries' }],
        ['landship', 2, { name: 'Tank Corps (F Bn)' }], ['landship', 2, { name: 'Tank Corps (H Bn)' }], ['riflemen', 2, { name: '29th Division' }], ['biplane', 2, { name: 'Royal Flying Corps' }],
        ['dragoon', 'R', { name: 'Cavalry Corps' }], ['riflemen', 'R', { name: 'Reserve Divisions' }],
      ],
      script: [ { round: 1, orders: ['ADVANCE', 'ADVANCE', 'ADVANCE'] } ] },
    { name: 'Germany', commander: 'Georg von der Marwitz (2nd Army)', color: '#5d6168', men: 35000, doctrine: 'entrenched', doctrines: ['entrenched', 'none'], startDisorder: 1,
      general: { name: 'Marwitz', sector: 'R' },
      units: [
        ['riflemen', 0, { name: '20th Landwehr Division' }], ['mg', 0, { name: 'Machine Gun Nests' }],
        ['riflemen', 1, { name: '54th Division' }], ['rifledart', 1, { name: 'Field Guns at Flesquières' }], ['mg', 1, { name: 'Machine Gun Nests' }],
        ['riflemen', 2, { name: '9th Reserve Division' }], ['mg', 2, { name: 'Canal Defenses' }],
      ],
      reinforce: [ { round: 5, sector: 'R', units: [ ['riflemen', { name: '107th Division (from Russia)' }], ['riflemen', { name: 'Stoßtruppen' }] ], text: 'German reserve divisions arrive by rail and form up to counterattack.' } ],
      script: [ { round: 1, orders: ['HOLD', 'HOLD', 'HOLD'] }, { round: 2, orders: ['HOLD', 'HOLD', 'HOLD'] } ] },
  ],
  briefing: [
    'Three years of trench war have taught one lesson: a long bombardment cuts the wire but warns the enemy and churns the ground into swamp. At Cambrai the British will try something new.',
    'Several hundred fighting tanks will lead the attack on firm chalk, crushing the wire for the infantry. There will be no preliminary bombardment — the guns will open fire at zero hour using maps and calculation alone. The surprised defenders start the battle disordered.',
  ],
  plan: 'Britain: advance with tanks and infantry together in every sector at once. Tanks crush wire and shrug off rifles; infantry must deal with the field guns that kill tanks. Break through before the German reserves arrive on round 5, then send in the cavalry. Germany: hold, and let your field guns at Flesquières do their work.',
  history: 'The surprise was complete. The British advanced up to six kilometres in a day — ground that had cost months at Passchendaele — and church bells rang in Britain to celebrate. At Flesquières, German field guns knocked out dozens of tanks advancing ahead of their infantry, and at Masnières a tank broke the canal bridge. By nightfall 179 tanks were out of action — destroyed, broken down or ditched — and the cavalry could not exploit. On 30 November a German counterattack with storm troops retook most of the ground.',
  lesson: 'Combined arms: tanks, infantry, artillery and aircraft each cover the others\' weaknesses — and surprise beats a long bombardment.',
},
{
  id: 'uranus', name: 'Stalingrad: Operation Uranus', year: '1942', date: '19–23 November 1942', place: 'Don and Volga steppe, USSR', era: 5,
  war: 'Second World War — Eastern Front', histWinner: 0, defender: null, maxRounds: 9,
  sectors: [
    { name: 'Serafimovich (Romanian 3rd Army)', terrain: [], note: 'Open steppe. The Romanians hold a long front with almost no effective anti-tank guns.' },
    { name: 'Stalingrad (German 6th Army)', terrain: ['fort', 'narrow'], owner: 1, note: 'The ruined city. The 6th Army is locked in street fighting.' },
    { name: 'South of the city (Romanian 4th Army)', terrain: [], note: 'Salt lakes and steppe, thinly held.' },
  ],
  sides: [
    { name: 'Soviet Union', commander: 'Georgy Zhukov & Aleksandr Vasilevsky', color: '#b8322a', men: 1000000, doctrine: 'envelopment', doctrines: ['envelopment', 'depth', 'none'],
      general: { name: 'Vatutin', sector: 0 },
      units: [
        ['t34', 0, { name: '5th Tank Army' }], ['t34', 0, { name: '26th Tank Corps' }], ['ww2inf', 0, { name: '21st Army' }], ['howitzer', 0, { name: 'Breakthrough Artillery' }],
        ['sovrifle', 1, { name: '62nd Army (Chuikov)', str: 70 }], ['sovrifle', 1, { name: '64th Army', str: 80 }],
        ['t34', 2, { name: '4th Mechanized Corps' }], ['ww2inf', 2, { name: '51st & 57th Armies' }], ['howitzer', 2, { name: 'Stalingrad Front Artillery' }],
        ['t34', 'R', { name: '8th Cavalry & 4th Tank Corps' }], ['il2', 'R', { name: 'Sturmoviks' }],
      ],
      script: [ { round: 1, orders: ['BOMBARD', 'HOLD', 'HOLD'] }, { round: 2, orders: ['CHARGE', 'HOLD', 'BOMBARD'] }, { round: 3, orders: [null, 'HOLD', 'CHARGE'] } ] },
    { name: 'Axis', commander: 'Friedrich Paulus (6th Army)', color: '#5d6168', men: 330000, doctrine: 'none', doctrines: ['none', 'entrenched'],
      general: { name: 'Paulus', sector: 1 },
      units: [
        ['romanian', 0, { name: 'Romanian 3rd Army' }], ['romanian', 0, { name: 'Romanian 3rd Army' }],
        ['ww2inf', 1, { name: '6th Army', str: 75 }], ['ww2inf', 1, { name: '6th Army', str: 75 }], ['pzgren', 1, { name: 'XIV Panzer Corps', str: 70 }], ['stuka', 1, { name: 'VIII Fliegerkorps' }],
        ['romanian', 2, { name: 'Romanian 4th Army' }], ['romanian', 2, { name: 'Romanian 4th Army' }],
        ['pz3', 'R', { name: '22nd Panzer Division', str: 60 }], ['pz38', 'R', { name: '1st Romanian Armored Division' }], ['pz4', 'R', { name: '14th Panzer Division', str: 70 }],
      ],
      script: [ { round: 1, orders: ['HOLD', 'HOLD', 'HOLD'] }, { round: 2, orders: ['HOLD', 'HOLD', 'HOLD'] }, { round: 3, orders: ['HOLD', 'HOLD', 'HOLD'], commit: 0 } ] },
  ],
  briefing: [
    'Three months of savage street fighting have drawn the German 6th Army deep into Stalingrad. To free its divisions for the city, its long flanks along the Don and in the steppe have been handed to Romanian armies with few effective anti-tank guns.',
    'In secrecy the Red Army has massed over a million men, about a thousand tanks and thousands of guns opposite those flanks. The German reserve behind them is a single weak panzer corps; by German accounts, mice nesting in the straw had chewed through the wiring of many of 22nd Panzer Division\'s tanks.',
  ],
  plan: 'Soviets: leave the city to the 62nd Army — just Hold. Smash both Romanian flanks with massed armor, then swing both pincers into the center (Envelop) to close the ring around the 6th Army. Axis: your reserve is too weak to save both flanks. Choose one, or pull out of the city before the jaws close.',
  history: 'On 19 November the Southwestern Front broke through the Romanian 3rd Army after a barrage in fog and snow; the Stalingrad Front struck the Romanian 4th Army the next day. The weak German counterattack failed. On 23 November the two pincers met near Kalach on the Don, trapping roughly 250,000–300,000 Axis troops. Hitler forbade a breakout; the airlift failed; a relief attempt in December was stopped short. The remains of the 6th Army surrendered on 2 February 1943 — about 91,000 men went into captivity, and few came home.',
  lesson: 'Strike the weak flanks, not the strong center — and close the ring.',
},
);

const SCENARIO_YEAR = { thermopylae: -480, leuctra: -371, gaugamela: -331, cannae: -216, hastings: 1066, bannockburn: 1314, agincourt: 1415, austerlitz: 1805, waterloo: 1815, gettysburg: 1863, cambrai: 1917, sedan: 1940, uranus: 1942, kursk: 1943 };
SCENARIOS.sort((a, b) => (SCENARIO_YEAR[a.id] ?? 0) - (SCENARIO_YEAR[b.id] ?? 0));
