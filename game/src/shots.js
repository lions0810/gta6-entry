// The screenshot scenes behind ?shot=start|play|end. Each one stages a deterministic
// frame from the real game (same seed = same frame): start shows the title over the live
// city, play shows a composed mid-action scene, end shows the busted screen.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE_INPUT = { move() { return { x: 0, y: 0 }; } };

function idle(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, IDLE_INPUT, 0);
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * play: Rook stands beside a stolen car at a busy intersection, traffic rolling past,
 * two police cruisers closing in, wanted 3 stars, mission 2 in progress.
 * end: the same city, but Rook is busted — the BUSTED panel over the scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    const s = world.state;
    const p = s.player;
    // put Rook on foot beside a car at the 1400/1000 intersection
    p.x = 1420; p.y = 955; p.angle = Math.PI / 2;
    p.money = 1250; p.ammo = 24; p.health = 78;
    s.missionIndex = 1;
    s.missionStage = 0;
    s.wanted = 3; s.wantedTimer = 0;
    // park a car right next to him and make it his (stolen, gold-outlined)
    const car = s.cars[0];
    car.x = 1480; car.y = 1000; car.angle = 0; car.color = '#e67e22';
    // two police cruisers closing in from the roads
    const cop1 = s.cars[s.cars.length - 1];
    cop1.x = 1400; cop1.y = 820; cop1.angle = Math.PI / 2; cop1.color = '#2f6fd0'; cop1.isPolice = true;
    const cop2 = s.cars[s.cars.length - 2];
    cop2.x = 1180; cop2.y = 1000; cop2.angle = 0; cop2.color = '#2f6fd0'; cop2.isPolice = true;
    s.police = [{ car: cop1, ramTimer: 0 }, { car: cop2, ramTimer: 0 }];
    // traffic rolling through the intersection
    s.traffic[0].x = 1400; s.traffic[0].y = 1180; s.traffic[0].angle = -Math.PI / 2; s.traffic[0].vertical = true; s.traffic[0].dir = -1;
    s.traffic[1].x = 1620; s.traffic[1].y = 1000; s.traffic[1].angle = Math.PI; s.traffic[1].vertical = false; s.traffic[1].dir = -1;
    s.traffic[2].x = 1400; s.traffic[2].y = 900; s.traffic[2].angle = Math.PI / 2; s.traffic[2].vertical = true; s.traffic[2].dir = 1;
    s.traffic[3].x = 1300; s.traffic[3].y = 1000; s.traffic[3].angle = 0; s.traffic[3].vertical = false; s.traffic[3].dir = 1;
    // pedestrians fleeing on the sidewalk
    s.peds[0].x = 1470; s.peds[0].y = 930; s.peds[0].flee = 3;
    s.peds[1].x = 1330; s.peds[1].y = 1060; s.peds[1].flee = 3;
    world.say('MARLA: "Package is stashed behind the market on Coral Row. Grab it and don\'t get cute."', 6);
    idle(world, 0.5);
    // re-assert the staged positions after the idle steps (traffic moved a little)
    p.x = 1420; p.y = 955; p.angle = Math.PI / 2;
    s.camX = Math.max(0, Math.min(3200 - 1280, p.x - 640));
    s.camY = Math.max(0, Math.min(2400 - 720, p.y - 360));
    return { screen: SCREEN_PLAY, hasSave: false };
  }
  if (name === 'end') {
    const s = world.state;
    s.player.x = 1400; s.player.y = 1000; s.player.angle = 0;
    s.player.money = 1250;
    s.missionIndex = 2;
    s.wanted = 3;
    const cop = s.cars[0];
    cop.x = 1450; cop.y = 1000; cop.angle = Math.PI; cop.color = '#2f6fd0'; cop.isPolice = true;
    s.police = [{ car: cop, ramTimer: 0 }];
    s.endKind = 'busted';
    s.message = ''; s.messageTimer = 0;
    s.camX = Math.max(0, Math.min(3200 - 1280, s.player.x - 640));
    s.camY = Math.max(0, Math.min(2400 - 720, s.player.y - 360));
    return { screen: SCREEN_OVER, hasSave: false };
  }
  // start: title over a live city backdrop
  idle(world, 2);
  return { screen: SCREEN_TITLE, hasSave: false };
}
