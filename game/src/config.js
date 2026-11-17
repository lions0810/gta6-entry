// Sunset Bay — an original top-down 2D open-world crime game.
// All tuning numbers, colours and the story in one place. The world is a fixed-size
// city (3200x2400); the camera follows the player and the renderer scales to the window.
export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

// Road grid: roads are centred on these lines, ROAD_W wide. Blocks sit between them.
// The bay runs along the south edge, below BAY_Y.
export const ROAD_W = 96;
export const ROAD_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROAD_Y = [200, 600, 1000, 1400, 1800, 2200];
export const BAY_Y = 2320;
export const SIDEWALK = 22;

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  health: 100,
  punchDamage: 25,
  punchRange: 36,
  punchCooldown: 0.35,
  enterRange: 78,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 720,
  maxSpeed: 460,
  reverseMax: 160,
  steer: 2.7,
  drag: 0.55,
  policeMaxSpeed: 500,
  trafficSpeed: 150,
};

export const PISTOL = { damage: 34, bulletSpeed: 720, cooldown: 0.22, range: 560 };
export const RIVAL = { health: 100, damage: 8, shootCooldown: 1.3, sightRange: 430 };

export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 25;
export const BUST_TIME = 0.6;

export const SAVE_KEY = 'sunset-bay.save.v1';

// Story: five missions, each a waypoint objective with dialogue and a cash payout.
export const MISSIONS = [
  {
    id: 0, title: 'Wheels Up', payout: 500,
    briefing: 'MARLA: "Rook, you need wheels. Jack any car on the street — press E next to one — then bring it to the docks."',
    objective: 'Steal a car, then drive to the docks marker',
    marker: { x: 3000, y: 2200 },
    kind: 'drive-to',
  },
  {
    id: 1, title: 'The Drop', payout: 800,
    briefing: 'MARLA: "Package is stashed behind the market on Coral Row. Grab it and don\'t get cute."',
    objective: 'Pick up the package at the marker (press E)',
    marker: { x: 1000, y: 1400 },
    kind: 'pickup',
  },
  {
    id: 2, title: 'Hot Pursuit', payout: 1200,
    briefing: 'MARLA: "Cops made the drop. Lose the heat, then lay low at the hideout on Pier Street."',
    objective: 'Lose the wanted level, then reach the hideout',
    marker: { x: 600, y: 2200 },
    kind: 'lose-heat',
    wantedOnStart: 2,
  },
  {
    id: 3, title: 'Settle the Score', payout: 2000,
    briefing: 'MARLA: "Vic\'s crew jumped our courier. They\'re waiting at the old depot — send them a message."',
    objective: 'Take out all 3 of Vic\'s crew at the depot',
    marker: { x: 2200, y: 600 },
    kind: 'eliminate',
    enemies: 3,
  },
  {
    id: 4, title: 'The Big Score', payout: 5000,
    briefing: 'MARLA: "Last job, Rook. The bank courier van is parked by the plaza. Grab the cash and vanish at the hideout."',
    objective: 'Grab the cash at the plaza, then reach the hideout',
    marker: { x: 1800, y: 1000 },
    kind: 'grab-and-go',
    hideout: { x: 600, y: 2200 },
  },
];

export const PALETTE = {
  backdrop: '#0d0f14',
  ground: '#2e3238',
  block: '#34383f',
  road: '#1d2026',
  roadLine: '#8a8f3c',
  sidewalk: '#454a52',
  bay: '#16324a',
  bayDeep: '#0f2436',
  building: ['#4a4f58', '#5a5148', '#47525c', '#54444a', '#3f4a3a'],
  buildingRoof: ['#5d636e', '#6b6156', '#57646f', '#65545b', '#4d5a48'],
  tree: '#2f6b3a',
  treeDark: '#255430',
  lamp: '#d8c56a',
  player: '#e8b13c',
  playerDark: '#8a6a1d',
  ped: ['#c96a5a', '#5a8ac9', '#7ac96a', '#c9a45a', '#9a6ac9'],
  rival: '#d43a2e',
  police: '#e8e8e8',
  policeDark: '#20242c',
  car: ['#b8442e', '#2e6db8', '#c9a13a', '#3a9e6a', '#7a4fb8', '#c96a2e', '#4fa8b8'],
  pickupHealth: '#3ec95a',
  pickupAmmo: '#e8c93a',
  pickupCash: '#4fd66a',
  marker: '#ffd94a',
  text: '#eef1f5',
  muted: '#9aa1ad',
  panel: 'rgba(12, 14, 18, 0.82)',
  health: '#3ec95a',
  healthLow: '#e84a3a',
  star: '#ffd94a',
  starEmpty: '#5a5f6a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
