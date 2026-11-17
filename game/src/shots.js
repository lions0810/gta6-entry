// The screenshot scenes behind ?shot=start|play|end. Each one stages a real state
// of the game and then plays the real rules forward, so the frame is what a short
// session really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { move: { x: 0, y: 0 }, actions: 0 };
const DRIVE = { move: { x: 0, y: -1 }, actions: 0 };

/** Step the world for `seconds` with a fixed input. Returns the events seen. */
function playFor(world, seconds, input, harmless) {
  let events = 0;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    events |= world.step(STEP, input, harmless);
    if (events & (EVENT_BUSTED | EVENT_WASTED)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and
 * return the screen to draw over it.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'play' && name !== 'end') {
    // Title screen over a living city: traffic and pedestrians drift by.
    playFor(world, 5, IDLE, true);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'play') {
    // A composed mid-action scene: Rook is driving north up Coral Row in the
    // stolen coupe, two stars on him, a cruiser closing in behind, traffic ahead.
    const car = state.cars[0];
    car.parked = false;
    car.x = 600;
    car.y = 900;
    car.angle = -Math.PI / 2;
    car.speed = 320;
    state.player.inCar = car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    state.player.money = 1250;
    state.player.ammo = 18;
    state.player.health = 85;
    state.wanted = 2;
    state.lastCrime = state.elapsed;
    state.missionIndex = 1;
    state.dialogue = { text: 'MARLA: "Package is stashed behind the market on Coral Row. Grab it."', t: 7 };
    state.police.push({
      x: 600, y: 1180, angle: -Math.PI / 2, speed: 380, color: 0,
      parked: false, occupied: true, isPolice: true, hp: 100, hitCd: 0,
    });
    state.police.push({
      x: 540, y: 1250, angle: -Math.PI / 2, speed: 360, color: 0,
      parked: false, occupied: true, isPolice: true, hp: 100, hitCd: 0,
    });
    playFor(world, 2, DRIVE, false);
    return { screen: SCREEN_PLAY };
  }
  // End: Rook on foot at a downtown crossing, health nearly gone, a cruiser
  // already on top of him — the real rules bust him within a second.
  state.player.x = 1400;
  state.player.y = 1400;
  state.player.angle = Math.PI / 2;
  state.player.health = 12;
  state.player.money = 1250;
  state.wanted = 3;
  state.lastCrime = state.elapsed;
  state.police.push({
    x: 1412, y: 1400, angle: Math.PI, speed: 0, color: 0,
    parked: false, occupied: true, isPolice: true, hp: 100, hitCd: 0,
  });
  playFor(world, 30, IDLE, false);
  if (!state.endKind) world.triggerEnd('busted');
  return { screen: SCREEN_OVER };
}
