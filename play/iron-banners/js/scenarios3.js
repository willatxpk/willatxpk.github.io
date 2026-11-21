// Iron Banners — more historical battles: Alesia (52 BC). Uses units defined in conquests3.js.
'use strict';

SCENARIOS.push(
{
  id: 'alesia', name: 'Alesia', year: '52 BC', date: 'September 52 BC', place: 'Alise-Sainte-Reine, Burgundy, France', era: 1,
  war: 'Gallic Wars', histWinner: 0, defender: 0, maxRounds: 10,
  sectors: [
    { name: 'The western plain (Les Laumes)', terrain: ['fort'], owner: 0, note: 'Three miles of open plain in front of the outer lines, where the relief army\'s cavalry attacks — and where Caesar\'s Germans ride out.' },
    { name: 'Mont Réa camp', terrain: ['fort'], owner: 0, note: 'The weak point. The hill was too big to take inside the lines, so the camp of Reginus and Rebilus lies on its lower slope, overlooked by the enemy.' },
    { name: 'The inner lines facing Alesia', terrain: ['fort', 'river'], owner: 0, note: 'A 20-foot trench, two more ditches (one flooded from the rivers), a rampart with towers every 80 feet, and fields of hidden pits and iron spikes.' },
  ],
  sides: [
    { name: 'Rome', commander: 'Gaius Julius Caesar', color: '#b8322a', men: 60000, doctrine: 'triplex', doctrines: ['triplex', 'none'],
      general: { name: 'Caesar', sector: 'R' },
      units: [
        ['legion', 0, { name: 'Legions of Antony & Trebonius' }], ['rom_scorpio', 0, { name: 'Scorpions on the towers' }], ['germ_cav', 0, { name: 'Germanic Cavalry' }],
        ['legion', 1, { name: 'Two legions of Reginus & Rebilus', str: 80 }], ['rom_aux', 1, { name: 'Archers & Slingers' }],
        ['rom_veteran', 2, { name: 'Legio X' }], ['legion', 2, { name: 'Legions of the inner lines' }], ['rom_scorpio', 2, { name: 'Ballistae' }],
        ['legion', 'R', { name: 'Labienus: six cohorts' }], ['rom_veteran', 'R', { name: 'Caesar\'s reserve (the scarlet cloak)' }], ['germ_cav', 'R', { name: 'Cavalry sent round outside the lines' }],
      ],
      script: [ { round: 1, orders: ['HOLD', 'HOLD', 'HOLD'] }, { round: 2, orders: ['HOLD', 'HOLD', 'BOMBARD'] }, { round: 3, orders: ['CHARGE', 'HOLD', 'HOLD'] }, { round: 4, orders: ['HOLD', 'HOLD', 'HOLD'] }, { round: 6, orders: ['HOLD', 'HOLD', 'HOLD'], commit: 1 }, { round: 7, orders: ['ADVANCE', 'HOLD', 'HOLD'] } ] },
    { name: 'Gallic Confederation', commander: 'Vercingetorix (inside) & Vercassivellaunus (relief army)', color: '#3f7d4e', men: 200000, doctrine: 'none', doctrines: ['none'],
      general: { name: 'Vercingetorix', sector: 2 },
      units: [
        ['gaul_noblecav', 0, { name: 'Gallic horsemen outside the lines', str: 60 }],
        ['levy', 1, { name: 'Gallic scouts on Mont Réa', str: 50 }],
        ['gaul_warrior', 2, { name: 'Arverni (Vercingetorix)', str: 85 }], ['gaul_warrior', 2, { name: 'Gauls with hurdles and grappling hooks', str: 85 }], ['gaul_warrior', 2, { name: 'Mandubii & allies', str: 75 }], ['archer', 2, { name: 'Gallic Archers' }],
        ['gaul_warrior', 'R', { name: 'Picked men of Vercingetorix', str: 85 }],
      ],
      reinforce: [
        { round: 2, sector: 0, units: [ ['gaul_noblecav', { name: 'Relief army cavalry' }], ['gaul_noblecav', { name: 'Relief army cavalry' }], ['archer', { name: 'Archers among the horsemen' }] ], text: 'The relief army appears on the hills to the west — 8,000 horse and 250,000 foot, by Caesar\'s count. Its cavalry floods onto the plain.' },
        { round: 4, sector: 0, units: [ ['gaul_warrior', { name: 'Relief army (night attack)' }], ['gaul_warrior', { name: 'Relief army with ladders and hurdles' }], ['slinger', { name: 'Gallic Slingers' }] ], text: 'At midnight, with a great shout, the relief army attacks the plain lines with hurdles, ladders and grappling hooks.' },
        { round: 6, sector: 1, units: [ ['gaul_belgae', { name: 'Vercassivellaunus: picked men' }], ['gaul_warrior', { name: 'Vercassivellaunus: picked men' }], ['gaul_warrior', { name: 'Vercassivellaunus: picked men' }] ], text: 'Vercassivellaunus, cousin of Vercingetorix, has marched round the hill in the night. At noon 60,000 picked men pour down Mont Réa onto the weak camp.' },
        { round: 6, sector: 2, units: [ ['gaul_warrior', { name: 'Vercingetorix\'s sortie' }] ], text: 'Seeing the attack on Mont Réa, Vercingetorix throws everything he has against the inner lines.' },
      ],
      script: [ { round: 1, orders: [null, null, 'ADVANCE'] }, { round: 2, orders: ['ADVANCE', null, 'HOLD'] }, { round: 4, orders: ['ADVANCE', null, 'ADVANCE'] }, { round: 6, orders: ['ADVANCE', 'CHARGE', 'ADVANCE'] }, { round: 7, orders: ['ADVANCE', 'ADVANCE', 'ADVANCE'] } ] },
  ],
  briefing: [
    'After the Roman defeat at Gergovia, almost all Gaul has risen behind Vercingetorix. Now he has shut himself up with some 80,000 men in Alesia, a hill town of the Mandubii, and sent his cavalry out to call every tribe to his rescue.',
    'Caesar will not storm the hill: he will starve it. In about five weeks his legions dig 11 Roman miles of works facing the town — and then 14 more facing outward, against the relief army he knows is coming. When it comes, the besiegers are besieged.',
  ],
  plan: 'Romans: Hold behind the works everywhere and let the traps and towers bleed the attackers. The crisis comes on round 6, when Vercassivellaunus falls on the weak Mont Réa camp while Vercingetorix sorties from the town. Commit your reserve — Labienus and Caesar himself — to Mont Réa, and when a sector is clear, send cavalry round outside the lines (Envelop) into the attackers\' rear. Gauls: you outnumber the Romans hugely. Strike from inside and outside at once, and pile everything onto Mont Réa.',
  history: 'On the first day the relief army\'s cavalry attacked on the plain; after hours of fighting, Caesar\'s Germanic horsemen charged in a mass and drove it off. A night attack on the plain lines was beaten back by Antony and Trebonius, the Gauls impaled on the hidden pits and stakes. On the third day Vercassivellaunus struck the Mont Réa camp with 60,000 picked men while Vercingetorix attacked the inner lines. Caesar sent Labienus with six cohorts, then came himself; the soldiers recognized him by the scarlet cloak he wore in battle and raised a great shout. Caesar\'s cavalry rode out round the outer lines and fell on the attackers from behind. The Gauls broke; Vercassivellaunus was captured and 74 standards were brought to Caesar. The relief army melted away, and the next day Vercingetorix surrendered. He was kept prisoner for six years, led in Caesar\'s triumph in 46 BC, and strangled.',
  lesson: 'Fortifications multiply a small army — but only if a reserve can reach the point of crisis in time.',
},
);

SCENARIO_YEAR.alesia = -52;
SCENARIOS.sort((a, b) => (SCENARIO_YEAR[a.id] ?? 0) - (SCENARIO_YEAR[b.id] ?? 0));
