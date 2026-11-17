// Sunset Bay — an original top-down 2D open-world crime game.
// All tuning numbers and colours in one place. The world is a fixed-size city
// (3200x2400); the camera follows the player and the renderer scales to the window.

export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

// Road grid: roads are centred on these lines, ROAD_W wide. Blocks sit between them.
export const ROAD_W = 96;
export const ROAD_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROAD_Y = [200, 600, 1000, 1400, 1800, 2200];

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.35,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  maxSpeed: 460,
  reverseMax: 160,
  steer: 2.6,
  drag: 0.6,
};

export const PISTOL = { damage: 34, bulletSpeed: 720, cooldown: 0.22, range: 520 };

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
  backdrop: '#0d1117',
  grass: '#2e4d2a',
  block: '#3a3f46',
  sidewalk: '#6b7280',
  road: '#23262b',
  roadLine: '#c9a227',
  buildingA: '#7a6a58',
  buildingB: '#5b6b7a',
  buildingC: '#6e5a6e',
  buildingD: '#4f6152',
  roof: '#2b2f36',
  window: '#ffd866',
  tree: '#2f7a33',
  water: '#1d4e6b',
  player: '#f2c94c',
  playerDark: '#8a6d1a',
  pedShirt: ['#e5534b', '#4fc3f7', '#9b7ede', '#f28c4b', '#7ee081'],
  cop: '#2f6fd0',
  copCar: '#2f6fd0',
  trafficCar: ['#c0392b', '#7f8c8d', '#d4d4d4', '#8e44ad', '#16a085', '#e67e22'],
  text: '#eef1f5',
  muted: '#9aa3b2',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#58c96b',
  hud: 'rgba(10, 14, 20, 0.72)',
  minimap: 'rgba(10, 14, 20, 0.78)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
