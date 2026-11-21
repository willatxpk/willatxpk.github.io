// Static game data: names, traits, idea cards, journals, grants, equipment.

export const WPY = 48; // weeks per academic year

export const FIRST = ['Ana','Bo','Chidi','Dara','Emeka','Farah','Gus','Hana','Ilya','Jun','Kai','Lena','Mateo','Nia','Omar','Priya','Quinn','Rosa','Sven','Tariq','Uma','Vik','Wen','Xiomara','Yusuf','Zoe','Aditi','Bruno','Cleo','Dmitri','Esme','Felix','Gita','Hugo','Ines','Jonas','Kemi','Luca','Mina','Niko','Oona','Pavel','Rhea','Saoirse','Teo','Ulla','Vera','Wiremu','Yara','Zeke','Amara','Bilal','Cosima','Dev','Elif','Finn','Grace','Hiro','Ivy','Jasper'];
export const LAST = ['Okafor','Lindqvist','Tanaka','Moreau','Haddad','Kowalski','Nguyen','Silva','Petrov','Abara','Chen','Fischer','Gupta','Ibarra','Jensen','Kim','Laurent','Mensah','Novak','Ortiz','Park','Quispe','Rossi','Sato','Takahashi','Umarov','Vargas','Weiss','Xu','Yilmaz','Zhang','Achebe','Bauer','Castillo','Dubois','Eriksen','Ferreira','Goldberg','Horvat','Iyer','Kaur','Mwangi','Nakamura','Olsen','Popescu','Reyes','Schmidt','Tran','Volkov','Walsh'];

export const ROLES = {
  // pay = stipend or salary; tuition = tuition remission paid by your grants; benefits = health insurance / fringe
  undergrad: { name: 'Undergrad', pay: 120, tuition: 0, benefits: 0, salary: 120, skill: [2, 4], term: 2 * WPY },
  grad:      { name: 'Grad Student', pay: 850, tuition: 620, benefits: 95, salary: 1565, skill: [3, 6], term: 6 * WPY },
  postdoc:   { name: 'Postdoc', pay: 1300, tuition: 0, benefits: 420, salary: 1720, skill: [5, 8], term: 3 * WPY },
  staff:     { name: 'Lab Manager', pay: 1450, tuition: 0, benefits: 465, salary: 1915, skill: [4, 7], term: 99 * WPY },
  scientist: { name: 'Research Scientist', pay: 1850, tuition: 0, benefits: 590, salary: 2440, skill: [7, 9], term: 99 * WPY },
};
// weekly research supplies for a running project, by platform
export const SUPPLIES = {
  atoms: { cost: 380, what: 'laser diodes, optics, rubidium dispensers' }, ions: { cost: 400, what: 'laser diodes, trap electrodes, ytterbium' },
  levitated: { cost: 280, what: 'nanospheres, optics, vacuum parts' }, circuits: { cost: 650, what: 'helium-3 mixture, wafers, microwave cables' },
  materials: { cost: 480, what: 'graphene, hBN crystals, liquid nitrogen' }, cryoliquid: { cost: 350, what: 'liquid helium top-ups, sensors' },
  photonic: { cost: 320, what: 'fibers, crystals, optics' }, plasma: { cost: 330, what: 'gases, electrodes, probes' },
  astro: { cost: 160, what: 'cloud storage and data transfer' }, defects: { cost: 300, what: 'diamond samples, microwave parts, optics' }, theory: { cost: 40, what: 'books and coffee, mostly' },
};
export const HIRE_COST = 4500; // recruiting, visa and relocation for a new grad student, postdoc or staff member


export const TRAITS = {
  nightowl:     { name: 'Night Owl', desc: 'Does their best work at 3am. Bad at 9am meetings.', clash: ['earlybird'] },
  earlybird:    { name: 'Early Bird', desc: 'In the lab at 6am. Judges anyone who isn\'t.', clash: ['nightowl'] },
  perfectionist:{ name: 'Perfectionist', desc: 'Slower, but results are cleaner. Stresses easily.', clash: ['chaotic'] },
  ambitious:    { name: 'Ambitious', desc: 'Wants big papers and first authorship. Loves bold ideas.', clash: ['ambitious'] },
  anxious:      { name: 'Anxious', desc: 'Stress builds fast. Responds well to reassurance.', clash: [] },
  chaotic:      { name: 'Chaotic Genius', desc: 'Sudden leaps of progress. Also breaks things.', clash: ['perfectionist', 'earlybird'] },
  theorist:     { name: 'Theorist at Heart', desc: 'Lives for equations. Avoids the optics table.', clash: ['handson'] },
  handson:      { name: 'Hands-on', desc: 'Happiest with a wrench. Suspicious of "pure" theory.', clash: ['theorist'] },
  coder:        { name: 'Coder', desc: 'Automates everything. Will rewrite your analysis in Rust.', clash: [] },
  diplomat:     { name: 'Diplomat', desc: 'Smooths conflicts. Relationships improve around them.', clash: [] },
  hothead:      { name: 'Hothead', desc: 'Picks fights. Passionate, loud, often right.', clash: ['hothead', 'diplomat'] },
  slacker:      { name: 'Laid-back', desc: 'Never stressed. Never in a hurry either.', clash: ['workaholic'] },
  workaholic:   { name: 'Workaholic', desc: 'Fast. Burns out if you let them.', clash: ['slacker'] },
  skeptic:      { name: 'Skeptic', desc: 'Catches bugs and artifacts before they become retractions.', clash: ['dreamer'] },
  dreamer:      { name: 'Dreamer', desc: 'Brings you wild ideas. Some of them are good.', clash: ['skeptic'] },
  industry:     { name: 'Industry-Curious', desc: 'LinkedIn is open in another tab. Could leave for a big salary.', clash: [] },
  caffeine:     { name: 'Caffeine-Powered', desc: 'Morale tied directly to the espresso machine.', clash: [] },
  mentor:       { name: 'Natural Mentor', desc: 'Juniors on the same project grow faster.', clash: [] },
  loner:        { name: 'Lone Wolf', desc: 'Works best alone. Group projects drain them.', clash: ['social'] },
  social:       { name: 'Social Butterfly', desc: 'Organizes lab lunches. Morale spreads around them.', clash: ['loner'] },
};

// ----- Idea cards (brainstorming) -----
// Systems have a physical platform (plat) and the equipment they need.
// Techniques and goals list the platforms they make physical sense on (fits; 'any' = everywhere).
// mode = which skill the work leans on: exp / theory / code
export const PLATS = {
  atoms: 'neutral atoms', ions: 'trapped ions', circuits: 'superconducting circuits', materials: 'solid-state materials',
  levitated: 'levitated particles', cryoliquid: 'liquid helium', astro: 'astrophysical data', photonic: 'photonics',
  plasma: 'plasmas', theory: 'pure theory', defects: 'spin defects in solids',
};
export const CARDS = [
  // Systems
  { id: 'rydberg', k: 'sys', plat: 'atoms', name: 'Rydberg Atoms', feas: 6, nov: 6, fund: 7, needs: ['optics', 'vacuum'], mode: 'exp', icon: '⚛️' },
  { id: 'ions', k: 'sys', plat: 'ions', name: 'Trapped Ions', feas: 6, nov: 4, fund: 7, needs: ['optics', 'vacuum'], mode: 'exp', icon: '🔴' },
  { id: 'molecules', k: 'sys', plat: 'atoms', name: 'Ultracold Molecules', feas: 4, nov: 7, fund: 5, needs: ['optics', 'vacuum'], mode: 'exp', icon: '🧬' },
  { id: 'levitated', k: 'sys', plat: 'levitated', name: 'Levitated Nanospheres', feas: 5, nov: 7, fund: 5, needs: ['optics', 'vacuum'], mode: 'exp', icon: '🫧' },
  { id: 'scq', k: 'sys', plat: 'circuits', name: 'Superconducting Qubits', feas: 6, nov: 4, fund: 8, needs: ['fridge', 'fab'], mode: 'exp', icon: '🧊' },
  { id: 'twisted', k: 'sys', plat: 'materials', name: 'Twisted Bilayer Graphene', feas: 5, nov: 6, fund: 6, needs: ['fridge', 'fab'], mode: 'exp', icon: '🔷' },
  { id: 'magnets', k: 'sys', plat: 'materials', name: 'Frustrated Magnets', feas: 6, nov: 5, fund: 5, needs: ['cryostat'], mode: 'exp', icon: '🧲' },
  { id: 'helium', k: 'sys', plat: 'cryoliquid', name: 'Superfluid Helium', feas: 6, nov: 5, fund: 4, needs: ['cryostat'], mode: 'exp', icon: '💧' },
  { id: 'analogbh', k: 'sys', plat: 'photonic', name: 'Optical Analog Black Holes', feas: 4, nov: 8, fund: 4, needs: ['optics'], mode: 'exp', icon: '🕳️' },
  { id: 'meta', k: 'sys', plat: 'photonic', name: 'Photonic Metamaterials', feas: 6, nov: 5, fund: 6, needs: ['fab', 'optics'], mode: 'exp', icon: '🔶' },
  { id: 'plasma', k: 'sys', plat: 'plasma', name: 'Tabletop Plasmas', feas: 5, nov: 5, fund: 6, needs: ['vacuum'], mode: 'exp', icon: '⚡' },
  { id: 'nstars', k: 'sys', plat: 'astro', name: 'Neutron Star Data', feas: 7, nov: 5, fund: 5, needs: ['cluster'], mode: 'code', icon: '🌟' },
  { id: 'cmb', k: 'sys', plat: 'astro', name: 'Cosmic Microwave Background', feas: 7, nov: 3, fund: 5, needs: ['cluster'], mode: 'code', icon: '🌌' },
  { id: 'gw', k: 'sys', plat: 'astro', name: 'Gravitational-Wave Data', feas: 7, nov: 5, fund: 6, needs: ['cluster'], mode: 'code', icon: '〰️' },
  { id: 'spins', k: 'sys', plat: 'theory', name: 'Quantum Spin Chains', feas: 8, nov: 4, fund: 4, needs: [], mode: 'theory', icon: '🔗' },
  { id: 'lattice', k: 'sys', plat: 'theory', name: 'Lattice Gauge Theories', feas: 6, nov: 6, fund: 4, needs: ['cluster'], mode: 'theory', icon: '🕸️' },
  // Techniques (needs only apply to experimental systems; needsBy overrides them per platform)
  { id: 'ml', k: 'tech', name: 'Machine Learning', adj: 'Machine-Learned', feas: 1, nov: -1, fund: 3, mode: 'code', icon: '🤖', fits: 'any' },
  { id: 'bayes', k: 'tech', name: 'Bayesian Inference', adj: 'Bayesian', feas: 2, nov: -1, fund: 0, mode: 'code', icon: '🎲', fits: 'any' },
  { id: 'qec', k: 'tech', name: 'Error Correction', adj: 'Error-Corrected', feas: -2, nov: 2, fund: 3, mode: 'theory', icon: '🛡️', fits: ['atoms', 'ions', 'circuits', 'photonic', 'theory', 'defects'], needsBy: { circuits: ['jpa'], atoms: ['awg'], ions: ['awg'] } },
  { id: 'squeeze', k: 'tech', name: 'Squeezed States', adj: 'Squeezing-Enhanced', feas: -1, nov: 2, fund: 1, mode: 'exp', icon: '🍋', fits: ['atoms', 'ions', 'levitated', 'photonic', 'circuits', 'astro'], needs: ['optics'], needsBy: { circuits: [], ions: [], atoms: [] } },
  { id: 'floquet', k: 'tech', name: 'Floquet Driving', adj: 'Floquet-Engineered', feas: 0, nov: 2, fund: 0, mode: 'theory', icon: '🔁', fits: ['atoms', 'ions', 'circuits', 'materials', 'photonic', 'plasma', 'theory', 'defects'] },
  { id: 'tweezers', k: 'tech', name: 'Optical Tweezers', adj: 'Tweezer-Assembled', feas: 0, nov: 1, fund: 2, mode: 'exp', icon: '🥢', fits: ['atoms', 'levitated'], needs: ['optics', 'slm'] },
  { id: 'interf', k: 'tech', name: 'Interferometry', adj: 'Interferometric', feas: 1, nov: 0, fund: 1, mode: 'exp', icon: '🌊', fits: ['atoms', 'ions', 'levitated', 'photonic', 'cryoliquid', 'astro'] },
  { id: 'spectro', k: 'tech', name: 'Precision Spectroscopy', adj: 'Ultra-Precise', feas: 1, nov: 0, fund: 1, mode: 'exp', icon: '🌈', fits: ['atoms', 'ions', 'materials', 'plasma', 'circuits', 'astro', 'defects'] },
  { id: 'tensor', k: 'tech', name: 'Tensor Networks', adj: 'Tensor-Network', feas: 1, nov: 1, fund: 0, mode: 'code', icon: '🧮', fits: ['theory', 'materials', 'atoms', 'ions', 'circuits'] },
  { id: 'holo', k: 'tech', name: 'Holography (AdS/CFT)', adj: 'Holographic', feas: -1, nov: 3, fund: -1, mode: 'theory', icon: '🪞', fits: ['theory', 'astro'] },
  { id: 'feedback', k: 'tech', name: 'Real-Time Feedback', adj: 'Feedback-Stabilized', feas: 1, nov: 1, fund: 1, mode: 'code', icon: '🎛️', fits: ['atoms', 'ions', 'circuits', 'levitated', 'photonic', 'plasma', 'defects'], needs: ['awg'] },
  { id: 'stm', k: 'tech', name: 'Scanning Tunneling Microscopy', adj: 'Atomically-Resolved', feas: 0, nov: 1, fund: 1, mode: 'exp', icon: '🔬', fits: ['materials'], needs: ['stm'] },
  { id: 'entangle', k: 'tech', name: 'Entanglement Witnesses', adj: 'Entanglement-Certified', feas: 0, nov: 2, fund: 1, mode: 'theory', icon: '🤝', fits: ['atoms', 'ions', 'circuits', 'photonic', 'levitated', 'theory', 'defects'] },
  // Goals
  { id: 'gravity', k: 'goal', name: 'Quantum Gravity', noun: 'Tests of Quantum Gravity', feas: -3, nov: 3, fund: 1, icon: '🍎', fits: ['levitated', 'atoms', 'astro', 'theory'] },
  { id: 'dm', k: 'goal', name: 'Dark Matter', noun: 'Hunting Dark Matter', feas: -2, nov: 2, fund: 2, icon: '👻', fits: ['atoms', 'ions', 'circuits', 'levitated', 'cryoliquid', 'astro', 'theory'] },
  { id: 'advantage', k: 'goal', name: 'Quantum Advantage', noun: 'Quantum Advantage', feas: -1, nov: 1, fund: 3, icon: '🏁', fits: ['atoms', 'ions', 'circuits', 'photonic', 'theory'] },
  { id: 'phase', k: 'goal', name: 'Exotic Phases', noun: 'An Exotic Phase of Matter', feas: 0, nov: 2, fund: 0, icon: '🦄', fits: ['atoms', 'ions', 'circuits', 'materials', 'cryoliquid', 'photonic', 'plasma', 'theory', 'defects'] },
  { id: 'rtsc', k: 'goal', name: 'Room-Temp Superconductors', noun: 'Room-Temperature Superconductivity', feas: -5, nov: 4, fund: 4, hype: true, icon: '🔥', fits: ['materials', 'theory'] },
  { id: 'clocks', k: 'goal', name: 'Better Clocks', noun: 'Better Atomic Clocks', feas: 1, nov: 0, fund: 2, icon: '⏱️', fits: ['atoms', 'ions'], needs: ['cavity'] },
  { id: 'ft', k: 'goal', name: 'Fault Tolerance', noun: 'Fault-Tolerant Logic', feas: -2, nov: 1, fund: 3, icon: '🧱', fits: ['atoms', 'ions', 'circuits', 'photonic', 'theory'] },
  { id: 'timecrystal', k: 'goal', name: 'Time Crystals', noun: 'Discrete Time Crystals', feas: 0, nov: 2, fund: -1, icon: '💎', fits: ['atoms', 'ions', 'circuits', 'materials', 'theory', 'defects'] },
  { id: 'sensing', k: 'goal', name: 'Quantum Sensing', noun: 'Quantum-Limited Sensing', feas: 1, nov: 0, fund: 2, icon: '📡', fits: ['atoms', 'ions', 'circuits', 'levitated', 'cryoliquid', 'materials', 'photonic', 'astro', 'defects'] },
  { id: 'arrow', k: 'goal', name: 'Arrow of Time', noun: 'Probing the Arrow of Time', feas: -1, nov: 3, fund: -2, icon: '🏹', fits: 'any' },
  { id: 'fifth', k: 'goal', name: 'A Fifth Force', noun: 'Constraining a Fifth Force', feas: -1, nov: 2, fund: 0, icon: '🖐️', fits: ['atoms', 'ions', 'levitated', 'astro', 'theory'] },
  { id: 'hawking', k: 'goal', name: 'Hawking Radiation', noun: 'Hawking Radiation in the Lab', feas: -2, nov: 3, fund: 0, icon: '♨️', fits: ['photonic', 'cryoliquid', 'atoms', 'astro', 'theory'] },
  { id: 'thermo', k: 'goal', name: 'Quantum Thermodynamics', noun: 'Quantum Heat Engines', feas: 0, nov: 1, fund: 0, icon: '🌡️', fits: ['atoms', 'ions', 'circuits', 'levitated', 'materials', 'theory', 'defects'] },
  { id: 'fusion', k: 'goal', name: 'Fusion Diagnostics', noun: 'Diagnostics for Fusion Plasmas', feas: 0, nov: 1, fund: 3, icon: '☀️', fits: ['plasma', 'theory'] },
  { id: 'cosmo', k: 'goal', name: 'Early Universe', noun: 'Mapping the Early Universe', feas: 0, nov: 1, fund: 1, icon: '🔭', fits: ['astro', 'theory'] },
  // ---- more systems ----
  { id: 'nv', k: 'sys', plat: 'defects', name: 'NV Centers in Diamond', feas: 7, nov: 5, fund: 7, needs: ['optics', 'confocal'], mode: 'exp', icon: '✴️' },
  { id: 'qdots', k: 'sys', plat: 'circuits', name: 'Semiconductor Quantum Dots', feas: 5, nov: 5, fund: 7, needs: ['fridge', 'fab'], mode: 'exp', icon: '🔘' },
  { id: 'saw', k: 'sys', plat: 'circuits', name: 'Surface Acoustic Waves', feas: 5, nov: 6, fund: 4, needs: ['fridge', 'fab'], mode: 'exp', icon: '🔊' },
  { id: 'bec', k: 'sys', plat: 'atoms', name: 'Bose–Einstein Condensates', feas: 7, nov: 3, fund: 5, needs: ['optics', 'vacuum'], mode: 'exp', icon: '🌀' },
  { id: 'fermi', k: 'sys', plat: 'atoms', name: 'Ultracold Fermi Gases', feas: 5, nov: 6, fund: 5, needs: ['optics', 'vacuum'], mode: 'exp', icon: '🌫️' },
  { id: 'optomech', k: 'sys', plat: 'levitated', name: 'Optomechanical Membranes', feas: 6, nov: 5, fund: 5, needs: ['optics', 'vacuum'], mode: 'exp', icon: '🥁' },
  { id: 'polaritons', k: 'sys', plat: 'photonic', name: 'Exciton-Polaritons', feas: 5, nov: 6, fund: 4, needs: ['optics', 'cryostat'], mode: 'exp', icon: '🔆' },
  { id: 'photonchip', k: 'sys', plat: 'photonic', name: 'Integrated Photonic Chips', feas: 6, nov: 5, fund: 8, needs: ['fab', 'optics'], mode: 'exp', icon: '💠' },
  { id: 'topoins', k: 'sys', plat: 'materials', name: 'Topological Insulators', feas: 6, nov: 5, fund: 5, needs: ['cryostat', 'fab'], mode: 'exp', icon: '🧭' },
  { id: 'cuprates', k: 'sys', plat: 'materials', name: 'High-Tc Cuprate Superconductors', feas: 5, nov: 4, fund: 5, needs: ['cryostat'], mode: 'exp', icon: '🟫' },
  { id: 'skyrmions', k: 'sys', plat: 'materials', name: 'Magnetic Skyrmions', feas: 5, nov: 7, fund: 5, needs: ['cryostat'], mode: 'exp', icon: '🌪️' },
  { id: 'perovskites', k: 'sys', plat: 'materials', name: 'Halide Perovskites', feas: 7, nov: 4, fund: 7, needs: ['fab', 'optics'], mode: 'exp', icon: '🟧' },
  { id: 'wakefield', k: 'sys', plat: 'plasma', name: 'Laser-Plasma Wakefields', feas: 4, nov: 7, fund: 6, needs: ['vacuum', 'femtolaser'], mode: 'exp', icon: '🚀' },
  { id: 'neutrinos', k: 'sys', plat: 'astro', name: 'Neutrino Detector Data', feas: 6, nov: 6, fund: 5, needs: ['cluster'], mode: 'code', icon: '🌠' },
  { id: 'pulsars', k: 'sys', plat: 'astro', name: 'Pulsar Timing Arrays', feas: 6, nov: 5, fund: 5, needs: ['cluster'], mode: 'code', icon: '📻' },
  { id: 'frb', k: 'sys', plat: 'astro', name: 'Fast Radio Bursts', feas: 6, nov: 7, fund: 4, needs: ['cluster'], mode: 'code', icon: '💥' },
  { id: 'mbl', k: 'sys', plat: 'theory', name: 'Many-Body Localization', feas: 7, nov: 5, fund: 3, needs: [], mode: 'theory', icon: '🔒' },
  { id: 'qftcurved', k: 'sys', plat: 'theory', name: 'Quantum Fields in Curved Spacetime', feas: 6, nov: 6, fund: 3, needs: [], mode: 'theory', icon: '🌐' },
  { id: 'qinfo', k: 'sys', plat: 'theory', name: 'Quantum Information Theory', feas: 8, nov: 4, fund: 5, needs: [], mode: 'theory', icon: '📐' },
  // ---- more techniques ----
  { id: 'olattice', k: 'tech', name: 'Optical Lattices', adj: 'Lattice-Trapped', feas: 1, nov: 1, fund: 1, mode: 'exp', icon: '🔳', fits: ['atoms'] },
  { id: 'cqed', k: 'tech', name: 'Cavity QED', adj: 'Cavity-Enhanced', feas: 0, nov: 2, fund: 2, mode: 'exp', icon: '🪩', fits: ['atoms', 'ions', 'circuits', 'photonic', 'defects'], needsBy: { atoms: ['cavity'], ions: ['cavity'] } },
  { id: 'qsim', k: 'tech', name: 'Analog Quantum Simulation', adj: 'Quantum-Simulated', feas: 0, nov: 2, fund: 2, mode: 'theory', icon: '🎮', fits: ['atoms', 'ions', 'circuits', 'photonic'] },
  { id: 'pumpprobe', k: 'tech', name: 'Ultrafast Pump-Probe', adj: 'Ultrafast', feas: 0, nov: 2, fund: 1, mode: 'exp', icon: '⏩', fits: ['materials', 'photonic', 'plasma', 'defects'], needs: ['femtolaser'] },
  { id: 'strain', k: 'tech', name: 'Strain Engineering', adj: 'Strain-Tuned', feas: 1, nov: 1, fund: 0, mode: 'exp', icon: '🗜️', fits: ['materials', 'defects', 'photonic'] },
  { id: 'neutron', k: 'tech', name: 'Neutron Scattering', adj: 'Neutron-Probed', feas: 0, nov: 1, fund: 1, mode: 'exp', icon: '⚪', fits: ['materials', 'cryoliquid'] },
  { id: 'xray', k: 'tech', name: 'Synchrotron X-rays', adj: 'X-ray-Resolved', feas: 0, nov: 1, fund: 1, mode: 'exp', icon: '☢️', fits: ['materials', 'plasma', 'photonic'] },
  { id: 'montecarlo', k: 'tech', name: 'Monte Carlo Simulation', adj: 'Monte-Carlo', feas: 2, nov: -1, fund: 0, mode: 'code', icon: '🎰', fits: 'any' },
  { id: 'odmr', k: 'tech', name: 'Optically Detected Magnetic Resonance', adj: 'Spin-Resolved', feas: 1, nov: 1, fund: 1, mode: 'exp', icon: '📍', fits: ['defects', 'atoms'], needs: ['awg'] },
  { id: 'microwave', k: 'tech', name: 'Microwave Photonics', adj: 'Microwave-Coupled', feas: 0, nov: 1, fund: 1, mode: 'exp', icon: '〽️', fits: ['circuits', 'atoms', 'defects'] },
  { id: 'braiding', k: 'tech', name: 'Anyon Braiding', adj: 'Topologically-Protected', feas: -2, nov: 3, fund: 2, mode: 'theory', icon: '🪢', fits: ['theory', 'circuits', 'atoms', 'materials'] },
  { id: 'decoupling', k: 'tech', name: 'Dynamical Decoupling', adj: 'Coherence-Protected', feas: 1, nov: 0, fund: 1, mode: 'theory', icon: '♾️', fits: ['defects', 'ions', 'atoms', 'circuits'] },
  // ---- more goals ----
  { id: 'topoqc', k: 'goal', name: 'Topological Qubits', noun: 'Topological Quantum Computing', feas: -3, nov: 3, fund: 3, icon: '🍩', fits: ['circuits', 'materials', 'atoms', 'theory'] },
  { id: 'network', k: 'goal', name: 'Quantum Networks', noun: 'A Quantum Internet', feas: -1, nov: 2, fund: 3, icon: '🛰️', fits: ['atoms', 'ions', 'photonic', 'defects', 'theory'] },
  { id: 'bio', k: 'goal', name: 'Quantum Biology', noun: 'Imaging Living Cells', feas: -1, nov: 3, fund: 2, icon: '🦠', fits: ['defects', 'photonic'] },
  { id: 'solar', k: 'goal', name: 'Better Solar Cells', noun: 'Next-Generation Solar Cells', feas: 1, nov: 0, fund: 3, icon: '🌞', fits: ['materials', 'photonic'] },
  { id: 'accel', k: 'goal', name: 'Tabletop Accelerators', noun: 'A Tabletop Particle Accelerator', feas: -2, nov: 3, fund: 3, icon: '☄️', fits: ['plasma', 'theory'] },
  { id: 'numass', k: 'goal', name: 'Neutrino Mass', noun: 'Weighing the Neutrino', feas: -1, nov: 2, fund: 1, icon: '⚖️', fits: ['astro', 'theory'] },
  { id: 'bhorigin', k: 'goal', name: 'Black Hole Origins', noun: 'Where Merging Black Holes Come From', feas: 0, nov: 2, fund: 1, icon: '⚫', fits: ['astro', 'theory'] },
  { id: 'qchem', k: 'goal', name: 'Quantum Chemistry', noun: 'Simulating Molecules', feas: -1, nov: 1, fund: 3, icon: '⚗️', fits: ['atoms', 'ions', 'circuits', 'photonic', 'theory'] },
  { id: 'qmemory', k: 'goal', name: 'Quantum Memories', noun: 'Long-Lived Quantum Memories', feas: 0, nov: 1, fund: 2, icon: '🗄️', fits: ['atoms', 'ions', 'photonic', 'defects'] },
  { id: 'gravimetry', k: 'goal', name: 'Precision Gravimetry', noun: 'Measuring Gravity Precisely', feas: 1, nov: 0, fund: 2, icon: '⛰️', fits: ['atoms', 'levitated'] },
  { id: 'brain', k: 'goal', name: 'Medical Magnetometry', noun: 'Sensing Brain Signals', feas: 0, nov: 2, fund: 3, icon: '🩺', fits: ['atoms', 'defects'] },
];

// Pair synergies: [a, b, feasΔ, novΔ, fundΔ, note]
export const SYNERGY = [
  ['rydberg', 'tweezers', 2, 1, 1, 'Tweezer arrays are the natural home for Rydberg atoms.'],
  ['rydberg', 'qec', 1, 2, 2, 'Neutral-atom error correction is very hot right now.'],
  ['scq', 'qec', 2, 0, 2, 'Everyone is doing this. Feasible, but crowded.'],
  ['scq', 'ft', 1, 1, 2, ''],
  ['scq', 'dm', 1, 2, 1, 'Qubit-based photon counting for axion searches is a real thing.'],
  ['levitated', 'gravity', 1, 3, 2, 'Gravitationally entangling nanospheres: a legit moonshot.'],
  ['levitated', 'fifth', 2, 1, 1, ''],
  ['twisted', 'rtsc', 1, 1, 0, 'Magic angles and wishful thinking.'],
  ['twisted', 'stm', 2, 1, 1, 'Imaging moiré patterns atom by atom.'],
  ['twisted', 'phase', 2, 1, 0, 'Correlated insulators at the magic angle.'],
  ['analogbh', 'hawking', 3, 2, 1, 'Fiber-optical horizons were made for this.'],
  ['ions', 'clocks', 2, 0, 2, 'Optical ion clocks: reliable funding magnet.'],
  ['ions', 'spectro', 2, 0, 1, ''],
  ['molecules', 'fifth', 1, 2, 1, 'Molecular spectroscopy constrains new physics.'],
  ['molecules', 'spectro', 2, 1, 1, ''],
  ['helium', 'dm', 2, 2, 1, 'Superfluid helium dark-matter detectors are a real idea.'],
  ['helium', 'hawking', 1, 2, 0, 'Superfluid analog horizons: a classic proposal.'],
  ['nstars', 'ml', 2, 0, 1, ''],
  ['gw', 'ml', 2, 0, 1, ''],
  ['gw', 'bayes', 2, 1, 1, 'Bayesian inference is the bread and butter of GW astronomy.'],
  ['gw', 'squeeze', 1, 1, 1, 'Squeezed light is already inside LIGO. Analyzing it is useful.'],
  ['cmb', 'bayes', 2, 0, 1, ''],
  ['cmb', 'cosmo', 2, 0, 1, ''],
  ['spins', 'tensor', 2, 1, 0, 'Tensor networks were born for spin chains.'],
  ['spins', 'timecrystal', 1, 2, 0, ''],
  ['lattice', 'tensor', 1, 2, 1, ''],
  ['floquet', 'timecrystal', 2, 1, 0, 'Driven systems are the textbook way to make a time crystal.'],
  ['squeeze', 'sensing', 2, 0, 2, 'Squeezing beats the standard quantum limit.'],
  ['holo', 'hawking', 0, 2, 0, ''],
  ['holo', 'gravity', -1, 2, -1, 'Elegant. Possibly untestable.'],
  ['meta', 'analogbh', 1, 2, 0, ''],
  ['magnets', 'phase', 2, 1, 0, 'Spin liquids, anyone?'],
  ['plasma', 'fusion', 2, 0, 2, 'Fusion money is flowing right now.'],
  ['plasma', 'ml', 1, 1, 2, ''],
  ['feedback', 'levitated', 2, 1, 1, 'Feedback cooling to the ground state.'],
  ['entangle', 'thermo', 1, 2, 0, ''],
  ['ml', 'qec', 0, -1, 2, 'Buzzword bingo. Program officers will love it, referees less so.'],
  ['nv', 'odmr', 2, 0, 1, 'ODMR is exactly how NV centers are read out.'],
  ['nv', 'sensing', 2, 1, 2, 'Diamond magnetometers work at room temperature.'],
  ['nv', 'bio', 1, 3, 2, 'Nanoscale MRI inside a living cell. Biologists would line up.'],
  ['nv', 'brain', 1, 2, 3, 'Wearable brain scanners from diamond. Medical funding loves this.'],
  ['nv', 'decoupling', 2, 0, 1, ''],
  ['nv', 'network', 0, 2, 2, 'Diamond quantum-network nodes are a real contender.'],
  ['bec', 'olattice', 2, 0, 1, 'The classic workhorse of atomic physics.'],
  ['bec', 'gravimetry', 2, 1, 2, 'Atom-interferometer gravimeters: field-ready and fundable.'],
  ['bec', 'interf', 2, 0, 1, ''],
  ['fermi', 'olattice', 2, 2, 1, 'The Fermi-Hubbard model in a lattice: maybe the key to high-Tc superconductivity.'],
  ['fermi', 'phase', 1, 2, 0, ''],
  ['optomech', 'squeeze', 1, 1, 1, ''],
  ['optomech', 'gravity', 0, 3, 1, 'Massive objects in superposition. Bold.'],
  ['polaritons', 'phase', 1, 2, 0, 'Polariton condensates at (almost) room temperature.'],
  ['photonchip', 'network', 2, 1, 2, 'Chip-scale photonic interconnects.'],
  ['photonchip', 'advantage', 1, 1, 2, 'Boson sampling on a chip.'],
  ['topoins', 'pumpprobe', 1, 2, 1, ''],
  ['topoins', 'topoqc', 0, 2, 2, 'The Majorana dream. Careful: many have tried.'],
  ['cuprates', 'neutron', 2, 1, 1, 'Neutron scattering is how cuprate magnetism was understood.'],
  ['cuprates', 'rtsc', 1, 0, 0, ''],
  ['skyrmions', 'xray', 1, 2, 1, ''],
  ['skyrmions', 'stm', 1, 2, 1, ''],
  ['perovskites', 'solar', 2, 0, 3, 'Perovskite solar cells: hot, practical, very fundable.'],
  ['perovskites', 'pumpprobe', 1, 1, 1, ''],
  ['wakefield', 'accel', 2, 2, 2, 'GeV electrons in a few centimeters.'],
  ['saw', 'microwave', 2, 1, 0, ''],
  ['qdots', 'qec', 1, 1, 2, ''],
  ['qdots', 'microwave', 2, 0, 1, ''],
  ['neutrinos', 'numass', 2, 1, 1, ''],
  ['neutrinos', 'ml', 1, 0, 1, ''],
  ['pulsars', 'bhorigin', 2, 1, 1, 'The nanohertz gravitational-wave background.'],
  ['pulsars', 'bayes', 2, 0, 1, ''],
  ['frb', 'ml', 2, 1, 1, ''],
  ['mbl', 'tensor', 2, 1, 0, ''],
  ['qftcurved', 'hawking', 1, 2, 0, ''],
  ['qinfo', 'qec', 2, 1, 2, ''],
  ['qinfo', 'entangle', 2, 1, 1, ''],
  ['ions', 'network', 1, 1, 2, 'Trapped-ion network nodes are leading the field.'],
  ['ions', 'qchem', 1, 1, 2, ''],
  ['scq', 'qchem', 0, 1, 2, ''],
  ['qsim', 'phase', 2, 1, 1, ''],
  ['cqed', 'network', 1, 2, 2, ''],
  ['braiding', 'topoqc', 1, 2, 1, ''],
  ['decoupling', 'qmemory', 2, 0, 1, ''],
  ['rydberg', 'qsim', 2, 1, 2, 'Programmable Rydberg simulators are booming.'],
];

export const JOURNALS = [
  { id: 'arxiv', name: 'arXiv only (no journal)', bar: 0, rep: 2, weeks: 0, color: '#b31b1b', short: 'arXiv' },
  { id: 'pra', name: 'Physical Review A/B', bar: 59, rep: 6, weeks: 7, color: '#3a6ea5', short: 'PR A/B' , apc: 1500 },
  { id: 'njp', name: 'New Journal of Physics', bar: 55, rep: 5, weeks: 6, color: '#2a8a6a', short: 'NJP' , apc: 3200 },
  { id: 'prxq', name: 'PRX Quantum', bar: 78, rep: 10, weeks: 9, color: '#5b4aa5', short: 'PRX Q' , apc: 3600 },
  { id: 'prl', name: 'Physical Review Letters', bar: 85, rep: 14, weeks: 9, color: '#1f3f7a', short: 'PRL' , apc: 1200 },
  { id: 'natphys', name: 'Nature Physics', bar: 100, rep: 20, weeks: 11, color: '#7a2a2a', short: 'Nat. Phys.' , apc: 1100 },
  { id: 'science', name: 'Science', bar: 117, rep: 26, weeks: 12, color: '#8a1414', short: 'Science' , apc: 1600 },
  { id: 'nature', name: 'Nature', bar: 121, rep: 28, weeks: 12, color: '#c0392b', short: 'Nature' , apc: 1600 },
];

export const GRANTS = [
  { id: 'nsf', name: 'NSF Standard Grant', amount: 450000, years: 3, base: 0.14, likes: 'feas', desc: 'Solid, peer-reviewed. Reviewers like feasible plans.' },
  { id: 'career', name: 'NSF CAREER Award', amount: 650000, years: 5, base: 0.2, likes: 'feas', asstOnly: true, once: true, desc: 'Once-in-a-career award for junior faculty. Wants an outreach plan.' },
  { id: 'doe', name: 'DOE Office of Science', amount: 750000, years: 3, base: 0.12, likes: 'feas', desc: 'Big, steady money for serious physics.' },
  { id: 'darpa', name: 'DARPA Moonshot Program', amount: 1100000, years: 2, base: 0.08, likes: 'nov', reports: true, desc: 'Wants revolutionary ideas. Quarterly reports drain your energy.' },
  { id: 'onr', name: 'Office of Naval Research', amount: 520000, years: 3, base: 0.13, likes: 'fund', desc: 'Likes sensing, clocks and anything that could go on a submarine.' },
  { id: 'found', name: 'Halvorsen Foundation Investigator', amount: 2200000, years: 5, base: 0.05, likes: 'nov', minRep: 45, desc: 'The big one. Funds people, not projects.' },
  { id: 'industry', name: 'QuantaCorp Industry Partnership', amount: 320000, years: 2, base: 0.45, likes: 'fund', strings: true, desc: 'Easy money. They will want a say in what your students work on.' },
  // smaller, faster, always-open money
  { id: 'seed', name: 'University Seed Grant', amount: 60000, years: 1, base: 0.5, likes: 'feas', rolling: true, fast: true, desc: 'Internal money for getting a new idea off the ground. Short form, quick decision.' },
  { id: 'gift', name: 'Alumni Discretionary Gift', amount: 40000, years: 0, base: 0.45, likes: 'fund', rolling: true, fast: true, lump: true, desc: 'A one-time gift from the alumni fund. Paid all at once, no strings.' },
  { id: 'reu', name: 'NSF REU Supplement', amount: 30000, years: 1, base: 0.6, likes: 'feas', rolling: true, fast: true, req: ['nsf', 'career'], desc: 'Extra money to pay undergraduates. Only for labs with an active NSF award.' },
  { id: 'eager', name: 'NSF EAGER (High-Risk Pilot)', amount: 300000, years: 2, base: 0.16, likes: 'nov', fast: true, desc: 'For untested, potentially transformative ideas. The program officer decides quickly.' },
  // agencies
  { id: 'nasa', name: 'NASA Fundamental Physics', amount: 400000, years: 3, base: 0.12, likes: 'fund', desc: 'Clocks, sensors and anything that might one day fly on a satellite.' },
  { id: 'nist', name: 'NIST Precision Measurement Grant', amount: 200000, years: 2, base: 0.2, likes: 'feas', desc: 'Small, prestigious and all about measuring things very, very well.' },
  { id: 'aro', name: 'Army Research Office', amount: 480000, years: 3, base: 0.13, likes: 'fund', desc: 'Quantum information and sensing. Reviewers want a path to applications.' },
  { id: 'qtest', name: 'DOE Quantum Testbed Program', amount: 1800000, years: 4, base: 0.07, likes: 'fund', minRep: 35, reports: true, desc: 'Large collaborative program. Big money, heavy reporting.' },
  { id: 'mri', name: 'NSF Major Research Instrumentation', amount: 700000, years: 0, base: 0.15, likes: 'fund', lump: true, desc: 'Pays for equipment, all at once and with no overhead taken. Buy that fridge.' },
  // early-career awards
  { id: 'afosr', name: 'AFOSR Young Investigator Award', amount: 450000, years: 3, base: 0.15, likes: 'fund', asstOnly: true, once: true, desc: 'For junior faculty. The Air Force likes clocks, lasers and navigation.' },
  { id: 'doeec', name: 'DOE Early Career Award', amount: 875000, years: 5, base: 0.1, likes: 'feas', asstOnly: true, once: true, desc: 'Five years of support for an untenured PI. Very competitive.' },
  { id: 'sloan', name: 'Sloan Research Fellowship', amount: 75000, years: 2, base: 0.18, likes: 'nov', asstOnly: true, once: true, minRep: 10, desc: 'Small money, big prestige. Tenure committees notice it.' },
  { id: 'packard', name: 'Packard Fellowship', amount: 875000, years: 5, base: 0.07, likes: 'nov', asstOnly: true, once: true, minRep: 30, desc: 'Flexible money for the most creative young scientists.' },
  // foundations
  { id: 'keck', name: 'W. M. Keck Foundation', amount: 1000000, years: 3, base: 0.08, likes: 'nov', minRep: 25, desc: 'Funds risky science that federal agencies will not touch.' },
  { id: 'moore', name: 'Moore Foundation Experimental Investigator', amount: 1500000, years: 5, base: 0.06, likes: 'nov', minRep: 40, desc: 'For experimental physicists with bold ideas about quantum materials and precision measurement.' },
  { id: 'simons', name: 'Simons Foundation Collaboration', amount: 2000000, years: 4, base: 0.05, likes: 'nov', minRep: 60, desc: 'Multi-institution collaborations on deep questions. Extremely competitive.' },
  { id: 'techgift', name: 'Tech Company Research Gift', amount: 150000, years: 0, base: 0.3, likes: 'fund', minRep: 20, lump: true, desc: 'An unrestricted gift from a tech company research lab. Paid at once.' },
];

// Equipment and upgrades. `slot` tells the 3D world where to draw it.
export const EQUIP = {
  // core research equipment
  optics:     { cat: 'research', name: 'Laser System & Optical Table', cost: 70000, upkeep: 150, desc: 'Floating optical table, stabilized diode lasers, a forest of mirrors.', icon: '🔴' },
  vacuum:     { cat: 'research', name: 'UHV Vacuum Chamber', cost: 55000, upkeep: 80, desc: 'Ultra-high vacuum with ion pumps. Where cold atoms, ions and plasmas live.', icon: '⚙️' },
  fridge:     { cat: 'research', name: 'Dilution Refrigerator', cost: 420000, upkeep: 450, desc: 'Dry dilution fridge: the golden chandelier, 10 millikelvin. For qubits and quantum materials.', icon: '🧊' },
  cryostat:   { cat: 'research', name: 'Helium Cryostat + 9 T Magnet', cost: 120000, upkeep: 600, desc: 'Wet liquid-helium cryostat with a superconducting magnet. Down to 1.5 K. Drinks liquid helium.', icon: '🧲' },
  fab:        { cat: 'research', name: 'Cleanroom Fab Bay', cost: 160000, upkeep: 400, desc: 'Yellow light, bunny suits, e-beam lithography. For making chips and devices.', icon: '🟨' },
  stm:        { cat: 'research', name: 'Scanning Tunneling Microscope', cost: 180000, upkeep: 100, desc: 'Sees single atoms on a surface. Hates vibrations, footsteps and loud music.', icon: '🔬' },
  confocal:   { cat: 'research', name: 'Confocal Microscope + Microwave Setup', cost: 90000, upkeep: 60, desc: 'A scanning confocal microscope with microwave drive. How you find and read single defects in diamond.', icon: '🔍' },
  femtolaser: { cat: 'research', name: 'Femtosecond Laser Amplifier', cost: 240000, upkeep: 300, desc: 'Terawatt pulses lasting 30 femtoseconds. Drives plasma accelerators and ultrafast experiments.', icon: '🎆' },
  cluster:    { cat: 'research', name: 'GPU Cluster', cost: 85000, upkeep: 250, desc: 'Racks of GPUs. Theory, simulations and data analysis go faster.', icon: '🖥️' },
  // add-ons that specific techniques or goals require
  slm:        { cat: 'addon', name: 'Spatial Light Modulator + AOD Optics', cost: 45000, upkeep: 30, desc: 'Holographic beam shaping and acousto-optic deflectors. You can\'t build tweezer arrays without it.', icon: '🔲', req: 'optics' },
  cavity:     { cat: 'addon', name: 'Ultra-Stable Reference Cavity', cost: 95000, upkeep: 60, desc: 'A vacuum-sealed glass cavity that keeps your laser frequency stable to one part in 10¹⁶. Clocks need it.', icon: '🥚', req: 'optics' },
  jpa:        { cat: 'addon', name: 'Quantum-Limited Amplifiers (JPA/TWPA)', cost: 60000, upkeep: 40, desc: 'Fast, low-noise qubit readout. Error correction on superconducting qubits is impossible without it.', icon: '📶', req: 'fridge' },
  awg:        { cat: 'addon', name: 'AWG & FPGA Control System', cost: 40000, upkeep: 50, desc: 'Arbitrary waveform generators and FPGAs for microsecond-fast feedback and control.', icon: '🎚️' },
  // optional upgrades: faster work or better results on matching platforms
  narrowlaser:{ cat: 'booster', name: 'Narrow-Linewidth Laser Upgrade', cost: 55000, upkeep: 40, desc: 'Hertz-level linewidth lasers. Cleaner data for atoms, ions, molecules and photonics.', icon: '✨', req: 'optics', boost: { plats: ['atoms', 'ions', 'levitated', 'photonic'], q: 6 } },
  snspd:      { cat: 'booster', name: 'Superconducting Single-Photon Detectors', cost: 150000, upkeep: 120, desc: '98% efficient photon counters with their own small cryocooler.', icon: '🎯', boost: { plats: ['photonic', 'levitated', 'atoms'], q: 5, speed: 1.1 } },
  glovebox:   { cat: 'booster', name: '2D-Materials Glovebox & Transfer Stage', cost: 70000, upkeep: 50, desc: 'Stack graphene and hBN in argon, at the right twist angle, first try (sometimes).', icon: '🧤', boost: { plats: ['materials'], speed: 1.3, q: 4 } },
  machineshop:{ cat: 'booster', name: 'Machine Shop Membership', cost: 5000, upkeep: 150, desc: 'Custom parts in days instead of months. Every experiment goes a little faster.', icon: '🛠️', boost: { modes: ['exp'], speed: 1.1 } },
  storage:    { cat: 'booster', name: 'Data Storage Server', cost: 25000, upkeep: 60, desc: 'Petabytes of disk and a proper backup. Data and theory projects go faster.', icon: '💾', boost: { modes: ['code', 'theory'], speed: 1.12 } },
  printer:    { cat: 'booster', name: '3D Printer', cost: 4000, upkeep: 15, desc: 'Brackets, mounts, cable holders and one very detailed Schrödinger figurine.', icon: '🖨️', boost: { modes: ['exp'], speed: 1.04 } },
  // infrastructure
  service:    { cat: 'infra', name: 'Equipment Service Contracts', cost: 0, upkeep: 700, desc: 'Vendors fix things fast. Repairs take half as long and express repairs are cheap. Fewer hidden failures.', icon: '📋' },
  ups:        { cat: 'infra', name: 'Backup Power (UPS + Generator)', cost: 35000, upkeep: 40, desc: 'When campus power fails, your pumps, compressors and lasers keep running.', icon: '🔋' },
  fumehood:   { cat: 'infra', name: 'Fume Hood & Chemical Storage', cost: 28000, upkeep: 30, desc: 'Proper ventilation and flammables cabinets. Safety inspectors smile.', icon: '🧪' },
  vibration:  { cat: 'infra', name: 'Vibration-Isolated Floor Slab', cost: 90000, upkeep: 0, desc: 'A separate concrete slab. The STM goes faster and stops complaining about pumps and footsteps.', icon: '🧱', boost: { needs: 'stm', speed: 1.3 } },
  interlock:  { cat: 'infra', name: 'Laser Safety Interlocks', cost: 18000, upkeep: 0, desc: 'Required for a safe laser lab. Safety inspectors love it.', icon: '🚨', req: 'optics' },
  herecovery: { cat: 'infra', name: 'Helium Recovery System', cost: 130000, upkeep: -450, desc: 'Captures boil-off from the wet cryostat. Lowers upkeep and protects you from helium shortages.', icon: '🛢️', req: 'cryostat' },
  expansion:  { cat: 'infra', name: 'Lab Expansion (+4 benches)', cost: 240000, upkeep: 300, desc: 'More space, more people. Needs the chair\'s blessing (goodwill 55+).', icon: '🏗️', goodwill: 55 },
  // comfort and people
  espresso:   { cat: 'comfort', name: 'Espresso Machine', cost: 3500, upkeep: 20, desc: 'Morale up for everyone. Huge for caffeine-powered people.', icon: '☕' },
  kitchen:    { cat: 'comfort', name: 'Lab Kitchenette', cost: 6000, upkeep: 25, desc: 'A fridge for food (not samples), a microwave and a table. People eat together.', icon: '🍲' },
  plants:     { cat: 'comfort', name: 'Lab Plants', cost: 600, upkeep: 0, desc: 'Monsteras and a cactus called Heisenberg. Small morale boost.', icon: '🪴' },
  chairs:     { cat: 'comfort', name: 'Ergonomic Chairs', cost: 9000, upkeep: 0, desc: 'Less back pain, less stress.', icon: '🪑' },
  nappod:     { cat: 'comfort', name: 'Nap Pod', cost: 12000, upkeep: 0, desc: 'A futuristic napping chair. Stress goes down a little every week.', icon: '😴' },
  library:    { cat: 'comfort', name: 'Journal Subscriptions & Book Wall', cost: 2000, upkeep: 40, desc: 'Every textbook and journal your students need. Faster skill growth.', icon: '📚' },
  whiteboards:{ cat: 'comfort', name: 'Whiteboard Wall', cost: 2500, upkeep: 0, desc: 'Better brainstorms: more idea cards to choose from.', icon: '📝' },
  cat:        { cat: 'comfort', name: 'Adopt a Lab Cat', cost: 300, upkeep: 15, desc: 'Named Schrödinger. Big morale boost. Sometimes chaos.', icon: '🐈' },
  couch:      { cat: 'comfort', name: 'Office Couch', cost: 1800, upkeep: 0, desc: 'Visitors relax a bit more. Conflicts calm down faster.', icon: '🛋️' },
};
export const EQUIP_CATS = [['research', 'Research equipment'], ['addon', 'Add-ons required by specific techniques'], ['booster', 'Upgrades (faster work, better results)'], ['infra', 'Infrastructure'], ['comfort', 'People and comfort']];
export const RESEARCH_EQUIP = ['optics', 'vacuum', 'fridge', 'cryostat', 'fab', 'stm', 'confocal', 'femtolaser', 'cluster'];

export const FIELDS = {
  amo:    { name: 'Atomic & Quantum Optics', desc: 'Lasers, cold atoms, ions and tweezers. Start with a laser table and a vacuum chamber.', equip: ['optics', 'vacuum'], cards: ['rydberg', 'ions', 'tweezers', 'spectro', 'clocks', 'sensing', 'qec', 'advantage'] },
  cmp:    { name: 'Quantum Materials & Devices', desc: 'Strange metals and superconducting chips. Start with a dilution fridge and a fab bay, but less cash.', equip: ['fridge', 'fab'], cards: ['twisted', 'scq', 'magnets', 'stm', 'phase', 'ft', 'floquet', 'thermo'], moneyAdj: -330000 },
  astro:  { name: 'Astro-Particle Data', desc: 'Dark matter, neutron stars and gravitational waves, all from data. Start with a GPU cluster.', equip: ['cluster'], cards: ['gw', 'nstars', 'cmb', 'dm', 'bayes', 'ml', 'gravity', 'cosmo'], moneyAdj: -150000 },
  spins:  { name: 'Quantum Sensing (Diamond Spins)', desc: 'Tiny magnetometers made of diamond defects, for physics and medicine. Start with lasers and a confocal microscope.', equip: ['optics', 'confocal'], cards: ['nv', 'odmr', 'decoupling', 'sensing', 'bio', 'brain', 'network', 'qmemory'], moneyAdj: -80000 },
  ultrafast: { name: 'Plasma & Ultrafast Lasers', desc: 'Femtosecond lasers, plasma accelerators and solar materials. Start with a femtosecond laser and a vacuum chamber, but less cash.', equip: ['femtolaser', 'vacuum'], cards: ['wakefield', 'plasma', 'pumpprobe', 'xray', 'accel', 'fusion', 'perovskites', 'solar'], moneyAdj: -280000 },
  theory: { name: 'Theory', desc: 'Chalk and code. Start with a GPU cluster and a whiteboard wall. Cheapest lab.', equip: ['cluster', 'whiteboards'], cards: ['spins', 'lattice', 'tensor', 'holo', 'entangle', 'timecrystal', 'arrow', 'hawking'], moneyAdj: -250000 },
};

// ----- home life -----
export const HOBBIES = {
  climbing: { name: 'Rock climbing', icon: '🧗', line: 'the climbing gym' },
  running:  { name: 'Running', icon: '🏃', line: 'your running club' },
  piano:    { name: 'Piano', icon: '🎹', line: 'the piano' },
  band:     { name: 'Playing in a band', icon: '🎸', line: 'your band, The Uncertainty Principles' },
  painting: { name: 'Painting', icon: '🎨', line: 'your easel' },
  cooking:  { name: 'Cooking', icon: '🍳', line: 'your kitchen experiments' },
  hiking:   { name: 'Hiking', icon: '🥾', line: 'the trails' },
};
export const HOME = {
  single:  { name: 'Single', desc: 'Friends, dates and a very quiet apartment.' },
  partner: { name: 'Partner', desc: 'A partner with a career of their own.' },
  family:  { name: 'Partner and two kids', desc: 'School plays, sick days, bedtime stories. Hardest to balance.' },
};

// ----- other professors in the department -----
// persona drives what they come to talk about
export const COLLEAGUES = [
  { first: 'Imani', last: 'Clarke', persona: 'theorist', field: 'Theory', equip: ['cluster'], cards: ['qinfo', 'mbl', 'qftcurved', 'braiding', 'tensor', 'holo', 'topoqc'], blurb: 'A brilliant, chatty theorist who always has a calculation for your experiment.', look: { skin: '#6b4128', hair: '#1b1410', style: 'afro', shirt: '#7a3a8a', pants: '#2a2a2a', glasses: true, height: 1.0 } },
  { first: 'Walter', last: 'Graves', persona: 'oldguard', field: 'Nuclear physics', equip: ['vacuum'], cards: ['neutrinos', 'numass', 'plasma', 'xray', 'fusion', 'montecarlo'], blurb: 'Senior, old-school, powerful in the department. Remembers every slight.', look: { skin: '#f0d0b8', hair: '#e8e0d0', style: 'bald', shirt: '#5a4a3a', pants: '#3a3a3a', glasses: true, height: 1.02, beard: true, suit: true } },
  { first: 'Kenji', last: 'Arai', persona: 'neighbor', field: 'Quantum materials', equip: ['fridge', 'stm', 'cryostat'], cards: ['topoins', 'cuprates', 'skyrmions', 'neutron', 'stm', 'strain', 'twisted'], blurb: 'Runs the lab next door. Owns a dilution fridge, an STM and a cryostat. Competes with you for space.', look: { skin: '#e8c4a0', hair: '#1b1410', style: 'short', shirt: '#2a6a8a', pants: '#2a2a3a', coat: true, glasses: false, height: 1.0 } },
  { first: 'Lena', last: 'Ortiz', persona: 'junior', field: 'Biophysics', equip: ['optics'], cards: ['nv', 'odmr', 'bio', 'brain', 'pumpprobe', 'microwave'], blurb: 'Just hired. Brilliant and slightly overwhelmed. Looks up to you.', look: { skin: '#d49a6a', hair: '#3a2418', style: 'ponytail', shirt: '#e67e22', pants: '#2c3e50', glasses: false, height: 0.96 } },
  { first: 'Ruth', last: 'Abernathy', persona: 'mentor', field: 'Atomic physics (emerita-ish)', equip: ['optics', 'vacuum', 'fab'], cards: ['bec', 'fermi', 'olattice', 'gravimetry', 'cqed', 'qsim', 'molecules'], blurb: 'Senior and generous. Has seen every way a career can go wrong. Owns a cleanroom she barely uses.', look: { skin: '#f3d2b5', hair: '#d8d8d8', style: 'bun', shirt: '#2a5a4a', pants: '#3a3a3a', glasses: true, height: 0.95 } },
];

export const TITLES = ['Assistant Professor', 'Associate Professor', 'Full Professor', 'Endowed Chair'];

export const RIVALS = [
  { name: 'Prof. Renata Voss', inst: 'the Institute across the river' },
];

export const ARXIV_JOKES = [
  'On the Impossibility of Finishing a Thesis in Finite Time',
  'A No-Go Theorem for Group Meetings Under One Hour',
  'Dark Matter Is Probably in the Lab Fridge: Constraints from Unlabeled Tupperware',
  'Emergent Spacetime from a Very Confusing Whiteboard',
  'Quantum Supremacy of the Department Coffee Machine Over Its Users',
  'Observation of Spontaneous Symmetry Breaking in Seminar Seating Charts',
  'Reviewer 2 as a Topological Defect: Stability and Persistence',
  'Hawking Radiation from Overdue Grant Reports',
  'Precision Measurement of the Time Between "Almost Done" and Done',
  'Entanglement Between Graduate Students and Their Office Chairs',
  'A Machine-Learned Proof That This Abstract Is Too Long',
  'Negative Absolute Temperature of the Lab Thermostat',
];
