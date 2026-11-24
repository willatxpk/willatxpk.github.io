// The written remains of the Concord of Vharrow: who they were, what the Lumen gave them, how they reached beneath it for the
// Gloam, and what the Gloam made of them: not dead, but kept, changed, and starving for the light they lost.
// Entries marked `mine` are the hunter's own journal, written as the story goes; their text can change with what you have done.

const n = (S, k) => S?.[k] || 0;

export const NOTES = {
  voyage: {
    title: 'The Voyage of the Lantern Company', mine: true,
    where: 'your own journal, the first page',
    text: `At home the winters lengthen every year. The lamps of the old country burn longer and give less; there are towns now where the sun does not clear the hills from autumn to spring.

The Lantern Company was founded on a legend sold by a drowned man's widow: that beyond the Grey Sea lies a land where light rises out of the ground like water from a spring. Two hundred souls bought passage on it. I was hired to be their hunter.

Forty-one days at sea. We came ashore where the charts end and found roads already there — old roads, good stone — and towers, and in the north a castle. All of them dark.

Our charge is simple to say. Make a landing. Make it a colony. Kill whatever comes for it. And keep the fire lit.`,
  },
  landing: {
    title: 'Log of the Lantern Company, last page',
    where: 'nailed to the first post of the Landing',
    text: `Forty-one days on the Grey Sea and we have come ashore where the charts end. The captain calls it rich land: black loam, iron in the cliffs, timber to the horizon. He does not say what the men say — that there were roads here before us, and towers, and that the towers are dark.

The first night we lit every lamp we had, for courage. By midnight there were shapes at the edge of the light. They did not attack. They stood and looked at the lamps the way a starving man looks at bread. Then they came.

We keep one fire now, inside the logs, and we do not carry lamps past the fence after dark. Whatever happens, we keep the fire lit.`,
  },
  village: {
    title: 'A letter, in a child\'s hand',
    where: 'in a cupboard of a fallen house',
    text: `Dear Grandmother, the Lumen came up through the well again this morning and Father let me hold the cup. It does not burn. It is like holding a little sun that is thinking about you. Mother says when I am older I may learn a working with it, maybe even a healing one like yours.

Everyone in the village is going up to the castle for the Festival of the Long Day. There will be a thousand lanterns and no one will be allowed to sleep. I will bring you a ribbon.`,
  },
  gate: {
    title: 'Proclamation of the Concord',
    where: 'carved into a plaque beside the gate',
    text: `BE IT KNOWN that the wells of this valley give up the LUMEN freely to all who keep the Concord, and that by its light the fields of Vharrow bear thrice, the sick are mended, the forges of the east never cool, and the gardens of the Glasswater bloom in winter.

BE IT KNOWN that no subject of the Concord shall want for light, nor fear the night, for the night has been made small.

— By the hand of the Lord of Vharrow, in the two hundredth year of the Long Day`,
  },
  keep: {
    title: 'Decree of the Lord of Vharrow, unsent',
    where: 'on the floor of the great hall',
    text: `The wells are failing. The scholars say the Lumen was never ours — that it rose because something beneath was pushing it up, and that something is turning over in its sleep.

I will not let the light end in my reign. Beneath the Lumen there is another current. The scholars call it the Gloam. It does not heal. It KEEPS. A thing steeped in the Gloam does not age, does not sicken, does not die.

They say it changes the body. Let it. A changed people is still a people. Let the court drink first, then the city. No one in Vharrow will ever die again. We will be the Concord forever.`,
  },
  chapel: {
    title: 'Hymn to the Lumen (defaced)',
    where: 'pinned to the chapel altar',
    text: `Light that rises, light that stays,
Keep us through the shortest days,
Hold the dark beneath the stone,
Never leave us here alone—

Beneath it, scratched in another hand: IT DID NOT LEAVE. IT WENT DOWN INTO US. I can feel it in my teeth when the candles gutter. Brother Osric has stopped speaking. He stands at the window all night, staring at the town's last lamps, and he is so hungry. We are all so hungry, and nothing we eat is what we are hungry for.`,
  },
  catacombs: {
    title: 'The gravedigger\'s last entry',
    where: 'beside a burial niche',
    text: `They will not die. I lay them in the niches when they stop moving, as is proper, and by morning they are standing in the corridor, facing the stair, as though someone above might still call them to their posts.

They are not dead. That is what no one will say aloud. The Gloam keeps them, as the Lord promised it would. No age, no sickness, no death. He did not promise there would be anything left inside to keep.

If someone reads this: they hunger for light. Douse your candle and they will pass you by. Light it, and they will come, all of them, the way we all used to go up to the castle for the Festival.`,
  },
  moor: {
    title: 'Huntsman\'s log, the Western Lodge',
    where: 'under a cairn on the moor',
    text: `Day 9 of the dark. The lodge drank the Gloam with the rest of the court; we were proud to be asked. Since then I am faster than I have ever been and I have not slept.

Day 14. Aldous grew antlers in the night. He laughed about it, then he stopped laughing. He goes on all fours now when he thinks we are not looking, and he looks at the dogs in a way I do not like.

Day 20. There are no more dogs. Aldous still knows the old calls; I heard him sounding the hunt at midnight, the way he did for forty years. There are tall shapes between the pines that watch the lodge, and they have our faces. I think I will go out and join them. I think I will be very good at it.`,
  },
  wood1: {
    title: 'Tally-board of a charcoal-burner',
    where: 'nailed to a black tree',
    text: `Burned forty stacks for the Concord forges this season. The wood here burns slow and blue and gives off a smell like a church.

The woodwarden says the trees have started to grow toward the huts. I laughed. This morning there was a root across my door that was not there last night, and it was warm.

We drank our share of the Gloam at the Festival, same as everyone. Since then I do not need to eat, and I do not feel the cold, and when I stand still for long enough my feet do not want to move again. It is restful. I think I will stand here a while.`,
  },
  wood2: {
    title: 'The Woodwarden\'s last order',
    where: 'cut into the bark of a great tree',
    text: `TO ALL WHO KEEP THIS WOOD. Do not cut. Do not burn. Do not carry a light under the trees after dark.

The ones who stood still too long are in the trees now. You can see their faces in the bark if you look, and they can see you. They are not dead. They are waiting for the light to come back, the way trees wait for spring.

I have tried to wake them. A lantern held to the bark and they stir and reach for it, and they do not stop reaching. Put out your lamp and walk softly. They are still our people. I will keep the wood until somebody comes who can bring them home.`,
  },
  salt1: {
    title: 'Log of the Constancy (last pages)',
    where: 'in a tin box in the wreck of a ship',
    company: true,
    text: `Thirty-first year of the Landing. Same as ever. The sea did not come back. The ships lie where it left them.

For the record, since no one in the Company will ever write it down: we did not come here to trade. We came because the Directors had a bottle of the Concord's Gloam from an old sailor and wanted more. The orders were to find the wells and send it home. The orders were to test it first.

We tested it. It works exactly as promised. Not one of us has died in thirty-one years. I have not seen my own face in eleven; the salt has grown over it. If the Company sends another landing, God help them, they will be told it is uncharted land.`,
  },
  salt2: {
    title: 'A letter, never sent',
    where: 'weighted under a stone among the dunes',
    company: true,
    text: `My dear Ada,

They tell us the next ship is coming in the spring. They told us that last spring, and the one before. I have stopped counting.

The others are changing. Their skin is white and hard as a rind, and they spit brine when they are angry. I am changing too. I find I want the lamps very badly. All of us do; we stand at the edge of the light at night and look at it. The captain has forbidden fires.

If you ever read this, it means someone came after all. Tell them not to drink anything they are given. Tell them the Company knew.`,
  },
  frost1: {
    title: 'Vigil-book of the Rimewatch',
    where: 'frozen into a cairn of stones',
    text: `Night 7,301 of the vigil. Sky clear. No moon.

We came up to the Rimewatch to keep the calendar of the stars for the Concord, and to watch for the moon, which our fathers said would come back if the Lumen was kept pure. Then the Lumen failed, and the Lord sent the Gloam up the mountain in a cart, and the Abbot blessed it, and we drank.

We do not sleep now. We do not need the fires. The cold has gone into us and stayed, and it does not hurt. Still we watch the east. Still no moon. The Abbot says one more night.`,
  },
  frost2: {
    title: 'The Abbot\'s confession',
    where: 'on the lectern of the abbey',
    text: `I told them it was a sacrament. I believed it. The Lord's own physician came up the mountain and swore it would keep us young enough to see the moon return.

It has kept us. I have watched my brothers freeze where they stood in the cloister, eyes on the east, and still breathing, frost in their beards like lace. Some of them walk at night, looking for a candle to stand beside.

If someone comes with the old light, the true light that the physician wrote of, let them kneel my brothers first and me last. I have earned the wait.`,
  },
  mire1: {
    title: 'Diary of a gardener of the Glasswater',
    where: 'tucked into the gills of a great fungus',
    text: `Our gardens were the wonder of the Concord: glass terraces over still water, flowers that opened at night and gave off their own light. We fed them the Lumen and they grew to the height of houses.

When the wells failed we fed them the Gloam instead. The flowers became these. Pale stalks, caps that glow without warmth. The water went thick and warm.

My hands are webbed now. It is easier to swim than to walk. The others have stopped talking in words, but they still hum the old planting songs while they work. I think I am the last one who still writes, and my letters are getting larger.`,
  },
  mire2: {
    title: 'Physician\'s notes, on the Change',
    where: 'in a sealed jar in the mire',
    text: `Every patient changes toward the work they did. The gardeners took to the water. The huntsmen to the woods, and to antlers. The forge-hands of the east to fire — they burn now and do not mind. The court, who did nothing, became nothing: the Hollowed.

They are not dead and they are not gone. I have sat with them. Somewhere under it they remember. They hum. They go to their old posts. They come to any light like children to a window.

The Lumen can loosen it. I have done it once: a cup from the last living well, poured into a kept one, and for an hour my patient knew me. Then two hundred years — no, it was only two — arrived all at once, and she died as herself, holding my hand. If anyone comes after us: the brightness that escapes them when they die is their own light. It can be given back. Mind whose hand holds it, and what you do with it.`,
  },
  barrens1: {
    title: 'Ledger of the Cinderworks',
    where: 'in a strongbox among the mesas',
    text: `Quota for the month: three hundred blades, sixty lanterns, one Beacon-core for the capital. The furnaces run on the Lumen and never cool; the men work naked to the waist and sing.

Later entry: The Lumen feed has stopped. The foreman has ordered us to the Gloam-taps. The furnaces burn hotter than ever but the light is wrong — it is black at the centre.

Last entry: we burn. All of us. We do not die of it. The foreman says the quota stands. Ash falls on the ledger as I write, and the ash is warm, and we are still singing.`,
  },
  barrens2: {
    title: 'The last astronomer of Vharrow',
    where: 'on a mesa top, weighed down with a stone',
    text: `I watched the sky for the Concord for forty years. On the night the Lord drank the Gloam I watched the moon go out. Not set. Go out. As though something swallowed it from below.

I have been looking for it ever since. I find it difficult to stop looking. I find that when I am looked at I cannot move, and when no one looks I can go anywhere.

If you see me walking in the late hours, tall and pale, do not take your eyes off me. I am only looking for the moon. I am only looking at you.`,
  },
  beacon: {
    title: 'Plans for a Beacon, Cinderworks drafting room',
    where: 'among the drafting tables',
    text: `A Beacon stores Lumen as a lantern stores flame. Set one burning at the heart of a town and no Gloam-thing will cross its light in anger; the old capital had seven. When a kept one wandered into a Beacon's glow, it would kneel, and stay kneeling until dawn, as if it were remembering something.

To build one: a Beacon-core, forged in the east and filled at a living well. The wells are dead. But the Lord of Vharrow drank more of the Lumen than any man before he turned to the Gloam. If the Lord is ever unmade — or ever gives it back — what he swallowed must go somewhere.

A core held to him might fill. A Beacon might burn again. A land might be made safe, and the ones who kneel in its light might be made whole.`,
  },
  home: {
    title: 'A letter, to be carried home', mine: true,
    where: 'written by the light of the Beacon',
    text: S => `To the Lantern Company's patrons, and to anyone in the old country still waiting —

The legend was true. There was a land where the light rose out of the ground, and a kingdom that lived by it, and when the light began to fail they reached beneath it for something darker. It did not kill them. It kept them, and it changed them into what I was hired to hunt.

${n(S, 'mercy') > n(S, 'slain') ? `I stopped hunting them, mostly. I returned ${n(S, 'mercy')} of them with the Rite, and ${n(S, 'saved')} of those lived; they sit at our fire now, and the children ask them for stories of the Festival of the Long Day. I killed ${n(S, 'slain')}. I know the names of the ones I returned. I do not know the names of the others, and I think about that.` : n(S, 'mercy') ? `I killed ${n(S, 'slain')} of them. I returned ${n(S, 'mercy')} with the Rite, when I had the light to spare, and ${n(S, 'saved')} of those lived to sit at our fire. I wish the second number were larger. Out there, in the dark, with the thing coming at you, it is very hard to make it larger.` : `I killed ${n(S, 'slain')} of them. Brother Aldric tells me there was another way, a rite to give them back their light, and I never used it. I tell myself there was never time. Tonight, by the Beacon, I find it hard to believe that.`}

Tonight the Beacon burns at the heart of Emberfall, and nothing that walks in the Gloam will cross it in anger. The Landing is a colony. We are staying.

Send ships. Send lamps. Send hunters, too — but tell them what they are hunting. The dark beneath this land goes deeper than any of us has walked, and something down there has begun to notice us.`,
  },

  // ---- the hunter's own journal, one entry per chapter
  hj_vale: {
    title: 'Hunter\'s journal: the second day', mine: true, where: 'your own journal',
    text: S => `The Company calls them Hollowed, so I call them Hollowed. They are slow, and they come for the light like moths come for a candle. I watched one walk straight into the bonfire's glow last night until Edda put a spear in it. It never looked at Edda. It only looked at the fire.

I have killed ${n(S, 'slain')} of them now. Brannoc pays by the head. It is honest work, and it keeps two hundred people alive.

I keep thinking about the child's letter in the village. A thousand lanterns, and no one allowed to sleep. I have decided not to think about it.`,
  },
  hj_vharrow: {
    title: 'Hunter\'s journal: under the gate', mine: true, where: 'your own journal',
    text: `Vharrow. Their castle. There is a proclamation on the gate promising that no one would ever fear the night again. I stood under it a long time.

The Bridgewarden was still at his post when I came for him. Two hundred years on a broken bridge, waiting for someone to relieve the watch. Something bright came out of him when he fell, like breath on a cold morning.

The things out here hunt in daylight too, now that they know my scent. Slower, half-blind, keeping to the shade. I have learned to crouch in the brambles and keep still. I have learned that they search, and that they give up. I am not proud of how often I hide. I am alive.`,
  },
  hj_moors: {
    title: 'Hunter\'s journal: Wyll', mine: true, where: 'your own journal',
    text: S => S?.flags?.wyllRestored
      ? `Wyll is alive. He sleeps by the fire with Hobb's coat over him and wakes screaming, but he wakes as Wyll. Forty days.

I keep counting backwards through every kill I have made since we landed. ${n(S, 'slain')} of them. How many were forty days, or forty years, from being somebody's brother?

Brannoc says I'm going soft. Brannoc did not see Wyll's face when the Gloam let go of it.`
      : `I put Wyll down in the tomb. It was a mercy, I told Hobb, and I think it was. Forty days in the dark and he was one of them.

If I had understood the Rite then the way I do now, I might have tried. I count my kills differently since. ${n(S, 'slain')} slain. ${n(S, 'mercy')} returned. The first number is the one Brannoc pays for.

Hobb filled the grave himself. He would not let anyone help.`,
  },
  hj_mire: {
    title: 'Hunter\'s journal: the Lodge', mine: true, where: 'your own journal',
    text: S => `The huntsmen of the Lodge drank because they were proud to be asked. They were hunters, like me: they went into the woods because that was their work, and the Gloam made them the best hunters there have ever been. Aldous was still sounding the old calls at midnight.

I keep the Rite ready in my left hand when I fight now. Sometimes I have the Lumen to spend and sometimes I do not, and when I do not I have to decide, with the thing kneeling in front of me. That is the part of the job nobody told me about.

${n(S, 'mercy')} returned. ${n(S, 'slain')} slain. I hated them, at the start. I am trying to remember why.`,
  },
  hj_barrens: {
    title: 'Hunter\'s journal: the gardeners', mine: true, where: 'your own journal',
    text: S => `The gardeners remember. One of them hummed as it came at me, the same tune Aldric's hymnal fragments are written to. The physician's notes say every patient changes toward the work they did. So every time I raise the blade, I am looking at a lifetime's work.

${n(S, 'mercy') >= n(S, 'slain') ? 'Brannoc and I do not speak much now. He says every one I return is a mouth to feed and a risk at the fence. He is not wrong. He is not right, either.' : 'Brannoc is pleased with me. The bounty board is nearly bare. I find I do not want to collect.'}

The Infirmary is full of the returned who lived. They do not sleep much. They sit by the fire and stare at it as if it were the most beautiful thing they had ever seen.`,
  },
  hj_king: {
    title: 'Hunter\'s journal: the Beacon plans', mine: true, where: 'your own journal',
    text: `The Cinderworks drew plans for a Beacon, a light the Gloam-kept cannot cross in anger, and in whose glow they kneel. Aldric thinks a Beacon could do what my Sigil does, for everyone inside its light, a little at a time.

It needs the light the Lord of Vharrow swallowed. He is the one who ordered them all to drink the dark: his court, his city, the children with their ribbons. I have hated him for weeks.

Climbing to his throne, I find I mostly feel tired. He wanted them never to be afraid of the dark. So did I. So did the Company.`,
  },
  hj_beacon: {
    title: 'Hunter\'s journal: the throne', mine: true, where: 'your own journal',
    text: S => S?.flags?.kingRestored
      ? `He knelt. I gave him back his light, and he gave back everything he had swallowed, and for a moment there was an old man on the throne of Vharrow who said he was sorry. Not to me. To all of them.

The core in my pack is warm. I am taking it home.`
      : `He fell, and what he had swallowed spilled out of him. I did not give him the Rite. I do not know if he deserved it. I no longer think deserving has much to do with it.

The core in my pack is warm. I am taking it home.`,
  },
  hj_gloam: {
    title: 'Hunter’s journal: a light in the far Barrens', mine: true, where: 'your own journal',
    text: `The Beacon is lit, and the Landing sleeps through the night for the first time since we came ashore. I should sleep too.

But Wen swears that from the top of the watchtower she saw a light far out in the Barrens, past the furnaces. Not fire. Pale, and moving slowly, the way a man walks when he is looking up. Whoever is out there has been looking up for a long time.`,
  },
  hj_wood: {
    title: 'Hunter’s journal: through the Cinder Wall', mine: true, where: 'your own journal',
    text: `The old roads through the Cinder Wall are real. Past it the land goes on: a wood, and beyond it the sea-smell of salt, and beyond that mountains with snow on them.

The Concord did not stop at Vharrow. Neither did the Gloam. The trees here are black, and when the wind moves them they make a sound like weeping. I have stopped carrying a light under them.`,
  },
  hj_salt: {
    title: 'Hunter’s journal: the First Landing', mine: true, where: 'your own journal',
    text: `There were ships in the Saltgrave. Company ships, with our lantern on the bows. The Constancy, and two more.

We were told we were the first. Somebody in the Company knew better, and sent us anyway. I will ask Maren whether she knew. I think I already know what her face will do.`,
  },
  hj_frost: {
    title: 'Hunter’s journal: the mountain', mine: true, where: 'your own journal',
    text: `The Captain's log ends with a line about an abbey on the mountain, where "they still keep a light". So up I go, into the cold.

Every land the Gloam has kept is its own grief. The gardeners still garden, the sailors still wait for a sea, and up there, I am told, the monks are still waiting for the moon.`,
  },
  hj_deep: {
    title: 'Hunter\'s journal: the Beacon burns', mine: true, where: 'your own journal',
    text: S => `The Beacon burns. ${n(S, 'saved') ? `${n(S, 'saved')} of the returned live at the Landing now, among the Company. Wyll${S?.flags?.wyllRestored ? ' teaches the children to set snares' : '\'s grave has flowers on it'}.` : 'None of the returned lived to see it. I said what names I knew into the fire.'}

But the astronomer's note is wrong about one thing. The moon did not go out. Something below swallowed it, and on clear nights now, when I stand at the edge of the Beacon's light, I can feel it turning over in its sleep.

The Gloam goes deeper than the Concord ever dug. I am a hunter. I will go and look.`,
  },
  names: {
    title: 'The Book of the Returned', mine: true, where: 'kept at the back of your journal',
    text: S => (S?.names?.length
      ? `Everyone you gave back their light. They were kept for two hundred years; most had only moments left. You wrote their names down anyway.\n\n` + S.names.map(e => `${e.n}, ${e.w}${e.lives ? ' (lives at the Landing)' : ''}, on day ${e.day}`).join('\n')
      : 'No one yet.'),
  },
};

// where each note lies: [id, x, z, y hint (null = the surface)]
export function notePlaces(world) {
  const K = world.castle, G = K.G, CF = K.cat?.y ?? G - 12;
  return [
    ['landing', 124, 221, null], ['village', 116, 198, null],
    ['gate', 125, K.z1 - 3, G + 1], ['keep', 117, 104, G + 1], ['chapel', 172, 108, G + 1], ['catacombs', 124, 114, CF + 1],
    ['moor', 34, 118, null], ['mire1', 276, 150, null], ['mire2', 312, 62, null],
    ['barrens1', 378, 126, null], ['barrens2', 420, 196, null], ['beacon', 396, 60, null],
    ['wood1', 486, 98, null], ['wood2', 528, 172, null],
    ['salt1', (world.wrecks?.[0]?.x ?? 580) + 4, (world.wrecks?.[0]?.z ?? 70) + 3, null], ['salt2', 634, 200, null],
    ['frost1', 690, 160, null], ['frost2', (world.monastery?.x ?? 712) - 6, (world.monastery?.z ?? 120) - 3, world.monastery?.y ?? null],
  ];
}
