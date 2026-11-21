// Iron Banners — battles of Viking-Age Britain: Edington 878, Maldon 991, Fulford and Stamford Bridge 1066.
// Uses the Viking and Saxon units defined in conquests4.js (vk_*, sax_*).
'use strict';

SCENARIOS.push(
{
  id: 'edington', name: 'Edington', year: '878', date: 'May 878', place: 'Ethandun, Wiltshire', era: 2,
  war: 'Viking invasions of England', histWinner: 0, defender: null, maxRounds: 10,
  sectors: [
    { name: 'The edge of the escarpment', terrain: ['hill'], owner: 0, note: 'The chalk scarp of Salisbury Plain falls steeply away to the north.' },
    { name: 'Center: the shield walls meet', terrain: [], note: 'Open downland. Two dense shield walls push and hack at each other.' },
    { name: 'The road to the Danish fort', terrain: ['fort'], owner: 1, note: 'Behind the Danes, the road runs back to their fortress — probably Chippenham.' },
  ],
  sides: [
    { name: 'Wessex', commander: 'King Alfred', color: '#3a6fb0', men: 5000, doctrine: 'shieldwall', doctrines: ['shieldwall', 'assault', 'none'],
      general: { name: 'King Alfred', sector: 1 },
      units: [
        ['fyrd', 0, { name: 'Somerset Fyrd' }], ['sax_thegn', 0, { name: 'Ealdorman Æthelnoth\'s Men' }],
        ['sax_gesith', 1, { name: 'Alfred\'s Household' }], ['sax_thegn', 1, { name: 'West Saxon Thegns' }], ['fyrd', 1, { name: 'Wiltshire Fyrd' }], ['archer', 1, { name: 'Bowmen' }],
        ['fyrd', 2, { name: 'Hampshire Fyrd' }], ['sax_thegn', 2, { name: 'Hampshire Thegns' }],
        ['sax_gesith', 'R', { name: 'Thegns of Athelney' }],
      ],
      script: [ { round: 1, orders: ['HOLD', 'BOMBARD', 'HOLD'] }, { round: 2, orders: ['ADVANCE', 'ADVANCE', 'ADVANCE'] }, { round: 3, orders: ['ADVANCE', 'ADVANCE', 'ADVANCE'] }, { round: 4, orders: [null, 'ADVANCE', null], commit: 1 } ] },
    { name: 'The Danes', commander: 'Guthrum', color: '#8c2f2f', men: 4500, doctrine: 'shieldwall', doctrines: ['shieldwall', 'feigned', 'none'],
      general: { name: 'King Guthrum', sector: 1 },
      units: [
        ['vk_warband', 0, { name: 'Danish Warband' }], ['vk_warband', 0, { name: 'Danish Warband' }],
        ['vk_hird', 1, { name: 'Guthrum\'s Hird' }], ['vk_warband', 1, { name: 'Oscetel\'s Crews' }], ['vk_archer', 1, { name: 'Bowmen' }],
        ['vk_warband', 2, { name: 'Anwend\'s Crews' }], ['vk_warband', 2, { name: 'Danish Warband' }],
        ['vk_raider', 'R', { name: 'Mounted Raiders' }],
      ],
      script: [ { round: 1, orders: ['HOLD', 'HOLD', 'HOLD'] }, { round: 2, orders: ['HOLD', 'HOLD', 'HOLD'] }, { round: 3, orders: ['HOLD', 'ADVANCE', 'HOLD'] } ] },
  ],
  briefing: [
    'January 878. Guthrum\'s Danes fell on Chippenham on Twelfth Night and overran Wessex. King Alfred escaped into the Somerset marshes with a handful of men and spent the spring raiding from a fort on the island of Athelney. Most of his kingdom submitted to the Danes.',
    'Now, in the seventh week after Easter, Alfred has ridden out to Egbert\'s Stone, where the men of Somerset, Wiltshire and Hampshire came to him "and were glad of him". He has marched on the Danish host camped at Ethandun. This is the last army Wessex can raise: if it breaks, there is no England.',
  ],
  plan: 'Wessex: fight as one dense shield wall. Soften the Danes with your few bowmen, then Advance everywhere at once and keep pressing; commit the Athelney thegns where the Danish line bends. Do not let the fyrd chase a feigned flight. Danes: Hold and let the English exhaust themselves; a Feign Retreat may draw the fyrd off the escarpment.',
  history: 'Asser says Alfred fought "against the whole army of the pagans with a dense shield wall", for a long time and fiercely, and won. He cut down the fleeing Danes all the way to their fortress, seized their horses and cattle, and besieged them for fourteen days until, hungry, cold and afraid, they begged for peace. Guthrum gave hostages and swore to leave Wessex. Three weeks later he and thirty of his chief men were baptised at Aller, with Alfred as godfather; Guthrum took the name Æthelstan and ruled East Anglia until 890. Alfred went on to build the burhs that kept the Danes out of Wessex for good.',
  lesson: 'A king who keeps an army in being, however small, can come back. Hold the line together and the enemy breaks before you do.',
},
{
  id: 'maldon', name: 'Maldon', year: '991', date: '10 or 11 August 991', place: 'The Blackwater estuary, Essex', era: 2,
  war: 'Viking raids on England', histWinner: 0, defender: null, maxRounds: 9,
  sectors: [
    { name: 'The causeway from Northey Island', terrain: ['narrow', 'river'], owner: 1, note: 'At low tide a narrow causeway joins the island to the mainland. Three English warriors could hold it against an army.' },
    { name: 'The shield wall on the mainland', terrain: [], note: 'Open fields above the mudflats of the Blackwater.' },
    { name: 'The horse lines', terrain: [], note: 'Behind the English line stand the horses the English rode to battle.' },
  ],
  sides: [
    { name: 'The Vikings', commander: 'Olaf (perhaps Olaf Tryggvason)', color: '#8c2f2f', men: 3000, doctrine: 'shieldwall', doctrines: ['shieldwall', 'feigned', 'none'],
      general: { name: 'Olaf', sector: 1 },
      units: [
        ['vk_hird', 0, { name: 'Olaf\'s Hird' }], ['vk_warband', 0, { name: 'Ship-crews' }],
        ['vk_warband', 1, { name: 'Ship-crews' }], ['vk_warband', 1, { name: 'Ship-crews' }], ['vk_archer', 1, { name: 'Bowmen' }],
        ['vk_warband', 2, { name: 'Ship-crews' }], ['vk_archer', 2, { name: 'Bowmen' }],
        ['vk_hird', 'R', { name: 'Hird of the Ninety-Three Ships' }],
      ],
      script: [ { round: 1, orders: ['BOMBARD', 'BOMBARD', 'BOMBARD'] }, { round: 2, orders: ['ADVANCE', 'ADVANCE', 'ADVANCE'] }, { round: 3, orders: ['ADVANCE', 'ADVANCE', 'ADVANCE'] } ] },
    { name: 'Essex', commander: 'Ealdorman Byrhtnoth', color: '#3a6fb0', men: 3000, doctrine: 'shieldwall', doctrines: ['shieldwall', 'none'],
      general: { name: 'Byrhtnoth', sector: 1 },
      units: [
        ['sax_thegn', 0, { name: 'Wulfstan, Ælfhere & Maccus' }], ['fyrd', 0, { name: 'Essex Fyrd' }],
        ['sax_gesith', 1, { name: 'Byrhtnoth\'s Household' }], ['fyrd', 1, { name: 'Essex Fyrd' }], ['fyrd', 1, { name: 'Essex Fyrd' }], ['archer', 1, { name: 'Bowmen' }],
        ['fyrd', 2, { name: 'Essex Fyrd' }], ['sax_thegn', 2, { name: 'Godric and his brothers', mor: 35 }],
      ],
      ai: { pursue: 0.5 },
      script: [ { round: 1, orders: ['FALLBACK', 'HOLD', 'HOLD'] }, { round: 2, orders: ['HOLD', 'HOLD', 'HOLD'] }, { round: 3, orders: ['HOLD', 'HOLD', 'HOLD'] } ] },
  ],
  briefing: [
    'A fleet of 93 ships has raided Folkestone, Sandwich and Ipswich and is now camped on Northey Island in the Blackwater, two miles below the town of Maldon. Ealdorman Byrhtnoth of Essex — an old warrior, very tall, white-haired — has brought the men of the shire to stop them.',
    'The tide is in and the island is cut off; only a narrow causeway reaches the mainland at low water, and three of Byrhtnoth\'s men can hold it. The Viking leaders shout across the water: pay us, and we go. Byrhtnoth answers that he will pay them in spears. Then they ask to be let across, to fight fairly on open ground.',
  ],
  plan: 'Vikings: shoot across the causeway, then Advance everywhere once you are over. Kill Byrhtnoth and the English line will waver; Godric\'s men by the horses are the weak point. Essex: you could hold the causeway forever — but the poem says Byrhtnoth let them cross. Hold the shield wall, keep your lord alive, and do not run.',
  history: 'The Old English poem The Battle of Maldon says Byrhtnoth, "because of his overconfidence" (for his ofermode), let the Vikings cross the causeway to fight on the mainland. In the battle he was cut down. Godric fled on his lord\'s own horse, and many English, thinking it was Byrhtnoth fleeing, ran with him. Byrhtnoth\'s household fought on around his body to the last man: "Mind must be the firmer, heart the bolder, courage the greater, as our strength grows less." Afterward King Æthelred paid the first great Danegeld, 10,000 pounds of silver. One version of the Chronicle names the Viking leader as Olaf — probably the future king of Norway, Olaf Tryggvason.',
  lesson: 'Never give away a position the enemy cannot take — and a leader who falls can take his army with him.',
},
{
  id: 'fulford', name: 'Fulford', year: '1066', date: '20 September 1066', place: 'Gate Fulford, south of York', era: 2,
  war: 'Norwegian invasion of England', histWinner: 0, defender: null, maxRounds: 9,
  sectors: [
    { name: 'The Ouse bank (Hardrada)', terrain: [], note: 'Firm ground along the river, where Hardrada stands with his best men.' },
    { name: 'Germany Beck', terrain: ['river', 'mud'], owner: 1, note: 'A boggy stream in front of the English line.' },
    { name: 'The marsh (Tostig)', terrain: ['mud', 'narrow'], note: 'Wet, low ground at the eastern end of the line, where Tostig holds the weaker wing.' },
  ],
  sides: [
    { name: 'Norway', commander: 'Harald Hardrada', color: '#8c2f2f', men: 7000, doctrine: 'oblique', doctrines: ['oblique', 'shieldwall', 'none'],
      general: { name: 'King Harald', sector: 0 },
      units: [
        ['vk_hird', 0, { name: 'Hardrada\'s Hird' }], ['vk_hird', 0, { name: 'Norwegian Hird' }], ['vk_warband', 0, { name: 'Norwegian Warband' }], ['vk_warband', 0, { name: 'Norwegian Warband' }],
        ['vk_warband', 1, { name: 'Norwegian Warband' }], ['vk_archer', 1, { name: 'Bowmen' }],
        ['vk_warband', 2, { name: 'Tostig\'s Men' }], ['vk_warband', 2, { name: 'Flemish & Scottish Mercenaries' }],
        ['vk_warband', 'R', { name: 'Orkney Men' }],
      ],
      script: [ { round: 1, orders: ['HOLD', 'HOLD', 'FALLBACK'] }, { round: 2, orders: ['ADVANCE', 'HOLD', 'FALLBACK'] }, { round: 3, orders: ['ADVANCE', 'ADVANCE', 'HOLD'], commit: 0 }, { round: 4, orders: ['ADVANCE', 'ADVANCE', 'ADVANCE'] } ] },
    { name: 'England', commander: 'Earls Edwin and Morcar', color: '#3a6fb0', men: 5000, doctrine: 'shieldwall', doctrines: ['shieldwall', 'none'],
      general: { name: 'Earl Morcar', sector: 2 },
      units: [
        ['huscarl', 0, { name: 'Edwin\'s Housecarls' }], ['fyrd', 0, { name: 'Mercian Fyrd' }],
        ['fyrd', 1, { name: 'Yorkshire Fyrd' }], ['fyrd', 1, { name: 'Yorkshire Fyrd' }],
        ['huscarl', 2, { name: 'Morcar\'s Housecarls' }], ['fyrd', 2, { name: 'Northumbrian Fyrd' }], ['fyrd', 2, { name: 'Northumbrian Fyrd' }],
        ['fyrd', 'R', { name: 'York Levies' }],
      ],
      ai: { pursue: 0.7 },
      script: [ { round: 1, orders: ['HOLD', 'HOLD', 'ADVANCE'] }, { round: 2, orders: ['HOLD', 'HOLD', 'ADVANCE'] }, { round: 3, orders: ['HOLD', 'HOLD', 'ADVANCE'], commit: 2 } ] },
  ],
  briefing: [
    'Harald Hardrada, King of Norway, the most famous warrior in the north, has sailed up the Ouse with some 300 ships to claim the English crown. With him is Tostig Godwinson, the exiled earl of Northumbria and King Harold\'s own brother. They have left the fleet at Riccall and are marching on York.',
    'The northern earls, the brothers Edwin and Morcar, have not waited for King Harold, who is far away in the south watching for the Normans. They have drawn up their men across the road two miles south of York, with the Ouse on one flank and the marshes on the other and a boggy beck in front.',
  ],
  plan: 'Norway: put your best men by the river (Oblique Order) and let Tostig\'s weak wing in the marsh Give Ground. When the English push after Tostig, crush their other flank along the river and swing in. England: you must win quickly, before the Norwegian strong wing comes on — but beware of chasing Tostig too far into the bog.',
  history: 'Morcar attacked first on the marshy flank and drove Tostig\'s men back. But Hardrada had his best troops by the river. He led them forward and broke Edwin\'s wing, then turned on the English who had pushed into the marsh. Snorri Sturluson says the dead lay so thick in the bog that the Norwegians crossed it dry-shod on the bodies. Edwin and Morcar escaped; York surrendered and gave hostages. Five days later King Harold arrived.',
  lesson: 'Oblique order: refuse your weak wing, crush with your strong one. An enemy who wins on the wrong flank can still lose the battle.',
},
{
  id: 'stamford', name: 'Stamford Bridge', year: '1066', date: '25 September 1066', place: 'The River Derwent, east of York', era: 2,
  war: 'Norwegian invasion of England', histWinner: 0, defender: 1, maxRounds: 9,
  sectors: [
    { name: 'West bank: the Norse outpost', terrain: [], note: 'A few Norwegians were caught on the near bank of the Derwent.' },
    { name: 'The bridge over the Derwent', terrain: ['narrow', 'river'], owner: 1, note: 'A narrow wooden bridge. The sagas say a single giant Norseman held it with an axe.' },
    { name: 'Battle Flats: the Norse shield ring', terrain: ['hill'], owner: 1, note: 'Rising ground on the far bank, where Hardrada forms a ring of shields round his banner, Land-waster.' },
  ],
  sides: [
    { name: 'England', commander: 'King Harold II Godwinson', color: '#3a6fb0', men: 12000, doctrine: 'shieldwall', doctrines: ['shieldwall', 'assault', 'none'],
      general: { name: 'King Harold', sector: 1 },
      units: [
        ['huscarl', 0, { name: 'Huscarls' }], ['fyrd', 0, { name: 'Fyrd' }], ['fyrd', 0, { name: 'Fyrd' }],
        ['huscarl', 1, { name: 'Huscarls of the Royal Household' }], ['huscarl', 1, { name: 'Gyrth\'s Huscarls' }], ['archer', 1, { name: 'Bowmen' }],
        ['huscarl', 2, { name: 'Leofwine\'s Huscarls' }], ['fyrd', 2, { name: 'Fyrd' }], ['fyrd', 2, { name: 'Fyrd' }],
        ['fyrd', 'R', { name: 'Thegns of the Shires' }],
      ],
      script: [ { round: 1, orders: ['ADVANCE', 'BOMBARD', 'HOLD'] }, { round: 2, orders: ['ADVANCE', 'ADVANCE', 'HOLD'] }, { round: 3, orders: [null, 'ADVANCE', 'ADVANCE'] }, { round: 4, orders: [null, 'ADVANCE', 'ADVANCE'], commit: 2 } ] },
    { name: 'Norway', commander: 'Harald Hardrada', color: '#8c2f2f', men: 6000, doctrine: 'shieldwall', doctrines: ['shieldwall', 'none'], startDisorder: 1,
      general: { name: 'King Harald', sector: 2 },
      units: [
        ['vk_nomail', 0, { name: 'Norse outpost' }],
        ['vk_hird', 1, { name: 'The lone Norseman on the bridge', str: 20, mor: 100 }], ['vk_nomail', 1, { name: 'Norsemen at the bridge' }],
        ['vk_nomail', 2, { name: 'Hardrada\'s Hird (without mail)', mor: 90 }], ['vk_nomail', 2, { name: 'Tostig\'s Men' }], ['vk_nomail', 2, { name: 'Norsemen without Mail' }], ['vk_nomail', 2, { name: 'Norsemen without Mail' }], ['vk_archer', 2, { name: 'Bowmen' }],
        ['vk_nomail', 'R', { name: 'Orkney Men' }],
      ],
      reinforce: [ { round: 5, sector: 2, units: [ ['vk_hird', { name: 'Eystein Orri\'s men (from Riccall)', str: 70 }], ['vk_hird', { name: 'Eystein Orri\'s men (from Riccall)', str: 70 }] ], text: 'Eystein Orri arrives from the ships at Riccall in full mail, after a run of twelve miles in the heat. "Orri\'s storm" crashes into the English.' } ],
      script: [ { round: 1, orders: ['FALLBACK', 'HOLD', 'HOLD'] }, { round: 2, orders: ['FALLBACK', 'HOLD', 'HOLD'] }, { round: 3, orders: [null, 'HOLD', 'HOLD'] }, { round: 5, orders: [null, 'HOLD', 'CHARGE'] } ] },
  ],
  briefing: [
    'Five days after Fulford, Hardrada and Tostig are waiting at Stamford Bridge for hostages from the shire. It is a hot day; most of the Norwegians have left their mail shirts at the ships at Riccall, twelve miles away, with a third of the army under Eystein Orri, the king\'s prospective son-in-law.',
    'They do not know that King Harold Godwinson has marched from London to York in four days, gathering men as he came. When a cloud of dust and the glitter of weapons appear on the York road, Hardrada sends riders to Riccall and forms a shield ring on the far side of the Derwent. Between the two armies is a narrow bridge.',
  ],
  plan: 'England: you have caught the Norwegians unready. Sweep away the outpost on the west bank, force the bridge, then throw everything at the shield ring before Eystein Orri arrives from the ships. Norway: hold the bridge as long as you can, keep the ring tight and save your strength for Orri\'s counterattack.',
  history: 'The English overran the Norwegians on the west bank. A later addition to the Chronicle tells of a single Norseman who held the bridge against the whole English army until an Englishman floated under it — in a swill-tub, says a still later legend — and speared him from below. The English crossed and attacked the shield ring. Hardrada, fighting furiously in the front rank, was struck in the throat by an arrow. Tostig refused Harold\'s offer of quarter and was killed. Eystein Orri\'s men, exhausted from running in mail, counterattacked — "Orri\'s storm" — and were cut down too. Of some 300 ships, the survivors needed only 24 to go home. It was the end of the Viking Age in England; but three days later William of Normandy landed at Pevensey.',
  lesson: 'Speed and surprise: an army caught without its armor and split in two can be beaten before it ever forms.',
},
);

Object.assign(SCENARIO_YEAR, { edington: 878, maldon: 991, fulford: 1065.7, stamford: 1065.8 });
SCENARIOS.sort((a, b) => (SCENARIO_YEAR[a.id] ?? 0) - (SCENARIO_YEAR[b.id] ?? 0));
