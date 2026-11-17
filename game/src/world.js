// The game's rules and state, with no drawing and no browser in it: the city, the
// player on foot and in cars, traffic, pedestrians, police, combat, pickups and the
// five-mission story. step() advances one fixed step and returns what happened as
// bit flags, so the caller can react without the world knowing about screens or sound.
// All randomness comes from a seeded generator, so the same seed plays the same city.
import {
  BAY_Y, CAR, MISSIONS, PISTOL, PLAYER, RIVAL, ROAD_W, ROAD_X, ROAD_Y,
  SAVE_KEY, SIDEWALK, STEP, WANTED_DECAY_SECONDS, WANTED_MAX, WORLD,
} from './config.js';
import { createRandom } from './random.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_MISSION = 4;
export const EVENT_PICKUP = 8;
export const EVENT_SHOT = 16;
export const EVENT_CRIME = 32;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function turnToward(angle, target, maxTurn) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= TAU;
  while (diff < -Math.PI) diff += TAU;
  return angle + clamp(diff, -maxTurn, maxTurn);
}
// Push a circle (x, y, radius) out of an axis-aligned box; returns true on contact.
function resolveCircleBox(pos, radius, box) {
  const cx = clamp(pos.x, box.x, box.x + box.w);
  const cy = clamp(pos.y, box.y, box.y + box.h);
  const dx = pos.x - cx;
  const dy = pos.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * radius;
    pos.y = cy + (dy / d) * radius;
  } else {
    pos.y = box.y - radius;
  }
  return true;
}

export function createWorld(seed) {
  let random = createRandom(seed);
  const state = {
    player: null, cars: [], traffic: [], police: [], peds: [], rivals: [],
    buildings: [], props: [], pickups: [], bullets: [], particles: [],
    wanted: 0, missionIndex: 0, missionPhase: 'go', storyDone: false,
    endKind: null, elapsed: 0, camera: { x: 0, y: 0 },
    dialogue: null, lastCrime: -999, decayTimer: 0, policeTimer: 0,
    bustedTimer: 0, spawnCount: 0,
  };

  function reset() {
    random = createRandom(seed);
    state.player = {
      x: 600, y: 580, angle: -Math.PI / 2, health: PLAYER.health,
      money: 0, ammo: 24, inCar: null, punchCd: 0, shootCd: 0, invuln: 0,
      radius: PLAYER.radius,
    };
    state.cars = [];
    state.traffic = [];
    state.police = [];
    state.peds = [];
    state.rivals = [];
    state.buildings = [];
    state.props = [];
    state.pickups = [];
    state.bullets = [];
    state.particles = [];
    state.wanted = 0;
    state.missionIndex = 0;
    state.missionPhase = 'go';
    state.storyDone = false;
    state.endKind = null;
    state.elapsed = 0;
    state.dialogue = null;
    state.lastCrime = -999;
    state.decayTimer = 0;
    state.policeTimer = 0;
    state.bustedTimer = 0;
    buildCity();
    spawnParkedCars();
    spawnTraffic();
    spawnPeds();
    spawnPickups();
    startMission(0);
    updateCamera();
  }

  function buildCity() {
    // One or two buildings per block, with trees and lamps along the sidewalks.
    for (let ix = 0; ix < ROAD_X.length - 1; ix += 1) {
      for (let iy = 0; iy < ROAD_Y.length - 1; iy += 1) {
        const bx0 = ROAD_X[ix] + ROAD_W / 2 + 26;
        const bx1 = ROAD_X[ix + 1] - ROAD_W / 2 - 26;
        const by0 = ROAD_Y[iy] + ROAD_W / 2 + 26;
        const by1 = ROAD_Y[iy + 1] - ROAD_W / 2 - 26;
        const count = 1 + Math.floor(random() * 2);
        for (let b = 0; b < count; b += 1) {
          const w = 90 + random() * 130;
          const h = 70 + random() * 110;
          const x = bx0 + random() * Math.max(1, (bx1 - bx0) - w);
          const y = by0 + random() * Math.max(1, (by1 - by0) - h);
          state.buildings.push({
            x, y, w, h,
            color: Math.floor(random() * 5),
            windows: 2 + Math.floor(random() * 3),
          });
        }
        for (let t = 0; t < 3; t += 1) {
          state.props.push({
            kind: 'tree',
            x: bx0 + random() * (bx1 - bx0),
            y: by0 + random() * (by1 - by0),
          });
        }
      }
    }
    // Lamps at every intersection corner.
    for (const rx of ROAD_X) {
      for (const ry of ROAD_Y) {
        state.props.push({ kind: 'lamp', x: rx + ROAD_W / 2 + 8, y: ry + ROAD_W / 2 + 8 });
      }
    }
  }

  function spawnParkedCars() {
    const colors = [0, 1, 2, 3, 4, 5, 6];
    // cars[0] is the car the player walks to first: a red coupe on Coral Row.
    state.cars.push({
      x: 600, y: 168, angle: -Math.PI / 2, speed: 0, color: 0,
      parked: true, occupied: false, isPolice: false, hp: 100, hitCd: 0,
    });
    const spots = [
      [200, 420, 0], [1000, 760, Math.PI / 2], [1400, 320, -Math.PI / 2],
      [1800, 1560, 0], [2200, 860, Math.PI], [2600, 1240, Math.PI / 2],
      [3000, 420, -Math.PI / 2], [1000, 1960, 0], [1400, 2060, Math.PI],
      [2200, 1960, Math.PI / 2], [2600, 320, 0], [3000, 1560, -Math.PI / 2],
      [1800, 420, Math.PI], [200, 1560, Math.PI / 2],
    ];
    for (let i = 0; i < spots.length; i += 1) {
      const [x, y, angle] = spots[i];
      state.cars.push({
        x, y, angle, speed: 0,
        color: colors[Math.floor(random() * colors.length)],
        parked: true, occupied: random() < 0.45, isPolice: false, hp: 100, hitCd: 0,
      });
    }
  }

  function spawnTraffic() {
    for (let i = 0; i < 10; i += 1) {
      const vertical = random() < 0.5;
      const line = vertical
        ? ROAD_X[Math.floor(random() * ROAD_X.length)]
        : ROAD_Y[Math.floor(random() * ROAD_Y.length)];
      const dir = random() < 0.5 ? 1 : -1;
      const along = 240 + random() * 1900;
      state.traffic.push({
        x: vertical ? line + dir * 22 : along,
        y: vertical ? along : line + dir * 22,
        angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        speed: CAR.trafficSpeed * (0.85 + random() * 0.3),
        color: Math.floor(random() * 7),
        road: vertical ? 'x' : 'y', line, dir,
      });
    }
  }

  function spawnPeds() {
    for (let i = 0; i < 24; i += 1) {
      const vertical = random() < 0.5;
      const line = vertical
        ? ROAD_X[Math.floor(random() * ROAD_X.length)]
        : ROAD_Y[Math.floor(random() * ROAD_Y.length)];
      const dir = random() < 0.5 ? 1 : -1;
      const side = random() < 0.5 ? 1 : -1;
      const along = 220 + random() * 1960;
      state.peds.push({
        x: vertical ? line + side * (ROAD_W / 2 + 12) : along,
        y: vertical ? along : line + side * (ROAD_W / 2 + 12),
        angle: 0, speed: 42 + random() * 30,
        color: Math.floor(random() * 5),
        road: vertical ? 'x' : 'y', line, dir, side,
        flee: 0, fleeX: 0, fleeY: 0, dead: false, deadTimer: 0,
      });
    }
  }

  function spawnPickups() {
    const spots = [
      ['health', 340, 340], ['health', 1560, 340], ['health', 2760, 1560],
      ['health', 760, 2060], ['health', 2060, 760], ['health', 1240, 1240],
      ['ammo', 460, 760], ['ammo', 1240, 460], ['ammo', 2360, 1240],
      ['ammo', 760, 1560], ['ammo', 2060, 1960], ['ammo', 2760, 460],
      ['cash', 860, 340], ['cash', 1560, 860], ['cash', 2360, 460],
      ['cash', 460, 1240], ['cash', 1240, 1960], ['cash', 2060, 340],
      ['cash', 2760, 2060], ['cash', 860, 1960],
    ];
    for (const [kind, x, y] of spots) {
      state.pickups.push({ kind, x, y, taken: false, respawnAt: 0 });
    }
  }

  function addWanted(n) {
    state.wanted = Math.min(WANTED_MAX, state.wanted + n);
    state.lastCrime = state.elapsed;
  }

  function startMission(index) {
    if (index >= MISSIONS.length) return;
    const mission = MISSIONS[index];
    // grab-and-go missions start in the "grab" phase; everything else in "go".
    // (This phase matters: without it the final mission would complete the moment
    // it started, because the hideout check would run before the grab.)
    state.missionPhase = mission.kind === 'grab-and-go' ? 'grab' : 'go';
    state.dialogue = { text: mission.briefing, t: 7 };
    if (mission.wantedOnStart) {
      state.wanted = Math.max(state.wanted, mission.wantedOnStart);
      state.lastCrime = state.elapsed;
    }
    if (mission.kind === 'eliminate') {
      state.rivals = [];
      const spots = [
        { x: mission.marker.x - 60, y: mission.marker.y - 40 },
        { x: mission.marker.x + 70, y: mission.marker.y + 30 },
        { x: mission.marker.x - 10, y: mission.marker.y + 80 },
      ];
      for (const spot of spots) {
        state.rivals.push({
          x: spot.x, y: spot.y, angle: 0, health: RIVAL.health,
          alive: true, shootCd: 1 + random(),
        });
      }
    }
  }

  function completeMission() {
    const mission = MISSIONS[state.missionIndex];
    state.player.money += mission.payout;
    state.missionIndex += 1;
    state.dialogue = { text: `MARLA: "Job done. $${mission.payout} is yours."`, t: 5 };
    if (state.missionIndex >= MISSIONS.length) {
      state.storyDone = true;
      state.dialogue = { text: 'MARLA: "That\'s the whole story, Rook. Sunset Bay is yours now."', t: 8 };
    } else {
      startMission(state.missionIndex);
    }
    return EVENT_MISSION;
  }

  function missionMarker() {
    if (state.missionIndex >= MISSIONS.length) return null;
    const mission = MISSIONS[state.missionIndex];
    if (mission.kind === 'grab-and-go' && state.missionPhase === 'escape') return mission.hideout;
    return mission.marker;
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of state.cars) {
      const d = dist(state.player.x, state.player.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function collideBuildings(pos, radius) {
    for (const b of state.buildings) resolveCircleBox(pos, radius, b);
  }

  function updateCamera() {
    const cam = state.camera;
    cam.x = clamp(state.player.x - 640, 0, WORLD.width - 1280);
    cam.y = clamp(state.player.y - 360, 0, WORLD.height - 720);
  }

  function spawnPoliceCar() {
    // Appear on a road a little way from the player.
    const p = state.player;
    let best = null;
    let bestScore = -1;
    for (const rx of ROAD_X) {
      for (const ry of ROAD_Y) {
        const d = dist(p.x, p.y, rx, ry);
        const score = d > 500 && d < 1100 ? d : -1;
        if (score > bestScore) {
          bestScore = score;
          best = { x: rx, y: ry };
        }
      }
    }
    const spot = best || { x: 200, y: 200 };
    state.police.push({
      x: spot.x, y: spot.y, angle: angleTo(spot.x, spot.y, p.x, p.y),
      speed: 0, color: 0, parked: false, occupied: true, isPolice: true,
      hp: 100, hitCd: 0,
    });
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.invuln > 0 || state.endKind) return;
    p.health -= amount;
    p.invuln = 0.25;
    if (p.health <= 0) {
      p.health = 0;
      state.endKind = 'wasted';
    }
  }

  function killPed(ped) {
    if (ped.dead) return;
    ped.dead = true;
    ped.deadTimer = 4;
    addWanted(1);
    for (let i = 0; i < 8; i += 1) {
      state.particles.push({
        x: ped.x, y: ped.y,
        vx: (random() - 0.5) * 160, vy: (random() - 0.5) * 160,
        life: 0.5, color: '#d43a2e', size: 3,
      });
    }
  }

  function stepTraffic(dt) {
    for (const car of state.traffic) {
      // Stop for the car ahead on the same lane.
      let ahead = false;
      for (const other of state.traffic) {
        if (other === car || other.road !== car.road || other.line !== car.line || other.dir !== car.dir) continue;
        const gap = car.road === 'x' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
        if (gap > 0 && gap < 78) { ahead = true; break; }
      }
      for (const other of state.cars) {
        if (other.parked && other.x === car.x && other.y === car.y) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const forward = car.road === 'x' ? dy * car.dir : dx * car.dir;
        const side = car.road === 'x' ? Math.abs(dx) : Math.abs(dy);
        if (forward > 0 && forward < 70 && side < 30) { ahead = true; break; }
      }
      const speed = ahead ? 0 : car.speed;
      if (car.road === 'x') car.y += car.dir * speed * dt;
      else car.x += car.dir * speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const lines = car.road === 'x' ? ROAD_Y : ROAD_X;
      const along = car.road === 'x' ? car.y : car.x;
      for (const line of lines) {
        if (Math.abs(along - line) < 26 && random() < 0.004) {
          const newDir = random() < 0.5 ? 1 : -1;
          if (car.road === 'x') {
            car.road = 'y';
            car.line = line;
            car.dir = newDir;
            car.y = line + newDir * 22;
            car.angle = newDir > 0 ? 0 : Math.PI;
          } else {
            car.road = 'x';
            car.line = line;
            car.dir = newDir;
            car.x = line + newDir * 22;
            car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
          break;
        }
      }
      // Wrap around the far end of a road.
      if (car.road === 'x' && (car.y < 160 || car.y > 2240)) car.dir *= -1;
      if (car.road === 'y' && (car.x < 160 || car.x > 3040)) car.dir *= -1;
    }
  }

  function stepPeds(dt) {
    for (const ped of state.peds) {
      if (ped.dead) {
        ped.deadTimer -= dt;
        continue;
      }
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
        ped.angle = a;
        ped.x += Math.cos(a) * 150 * dt;
        ped.y += Math.sin(a) * 150 * dt;
        ped.x = clamp(ped.x, 60, WORLD.width - 60);
        ped.y = clamp(ped.y, 60, BAY_Y - 20);
        continue;
      }
      const speed = ped.speed;
      if (ped.road === 'x') {
        ped.y += ped.dir * speed * dt;
        ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (ped.y < 200 || ped.y > 2220) ped.dir *= -1;
      } else {
        ped.x += ped.dir * speed * dt;
        ped.angle = ped.dir > 0 ? 0 : Math.PI;
        if (ped.x < 200 || ped.x > 3020) ped.dir *= -1;
      }
    }
    state.peds = state.peds.filter((p) => !p.dead || p.deadTimer > 0);
  }

  function stepPolice(dt) {
    const p = state.player;
    const desired = state.wanted > 0 ? Math.min(state.wanted, 3) : 0;
    state.policeTimer -= dt;
    if (state.police.length < desired && state.policeTimer <= 0) {
      spawnPoliceCar();
      state.policeTimer = 4;
    }
    if (state.wanted === 0 && state.police.length > 0) {
      state.police.length = 0;
      state.bustedTimer = 0;
    }
    for (const cop of state.police) {
      const target = angleTo(cop.x, cop.y, p.x, p.y);
      cop.angle = turnToward(cop.angle, target, 3.4 * dt);
      cop.speed = Math.min(CAR.policeMaxSpeed, cop.speed + 420 * dt);
      // A cruiser closing in on a player on foot brakes to a crawl: at full speed
      // it would blast through the bust radius in a frame or two and orbit forever
      // without ever catching anyone. At 90 it stays inside the radius long enough
      // for the bust timer to fill. (Ramming a car is unaffected.)
      if (!p.inCar && dist(cop.x, cop.y, p.x, p.y) < 140) {
        cop.speed = Math.min(cop.speed, 90);
      }
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      cop.x = clamp(cop.x, 60, WORLD.width - 60);
      cop.y = clamp(cop.y, 60, BAY_Y - 20);
      cop.hitCd -= dt;
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (p.inCar) {
        if (d < 52 && cop.hitCd <= 0) {
          cop.hitCd = 0.7;
          damagePlayer(10);
          p.inCar.speed *= 0.6;
          for (let i = 0; i < 6; i += 1) {
            state.particles.push({
              x: p.x, y: p.y, vx: (random() - 0.5) * 200, vy: (random() - 0.5) * 200,
              life: 0.4, color: '#ffd94a', size: 3,
            });
          }
        }
      } else if (d < 36) {
        state.bustedTimer += dt;
        if (state.bustedTimer >= 0.6) {
          state.endKind = 'busted';
          return EVENT_BUSTED;
        }
      } else {
        state.bustedTimer = Math.max(0, state.bustedTimer - dt);
      }
    }
    return 0;
  }

  function stepRivals(dt) {
    const p = state.player;
    for (const rival of state.rivals) {
      if (!rival.alive) continue;
      rival.shootCd -= dt;
      const d = dist(rival.x, rival.y, p.x, p.y);
      rival.angle = angleTo(rival.x, rival.y, p.x, p.y);
      if (d < RIVAL.sightRange && rival.shootCd <= 0 && !state.endKind) {
        rival.shootCd = RIVAL.shootCooldown;
        state.bullets.push({
          x: rival.x + Math.cos(rival.angle) * 20,
          y: rival.y + Math.sin(rival.angle) * 20,
          vx: Math.cos(rival.angle) * 520, vy: Math.sin(rival.angle) * 520,
          damage: RIVAL.damage, fromRival: true, travelled: 0,
        });
      }
    }
  }

  function stepBullets(dt) {
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.travelled += Math.hypot(b.vx, b.vy) * dt;
      let dead = b.travelled > PISTOL.range;
      if (!dead) {
        for (const building of state.buildings) {
          if (b.x > building.x && b.x < building.x + building.w && b.y > building.y && b.y < building.y + building.h) {
            dead = true;
            break;
          }
        }
      }
      if (!dead && !b.fromRival) {
        for (const ped of state.peds) {
          if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 16) {
            ped.health = (ped.health ?? 100) - PISTOL.damage;
            if (ped.health <= 0) killPed(ped);
            else {
              ped.flee = 3;
              ped.fleeX = b.x - b.vx;
              ped.fleeY = b.y - b.vy;
              addWanted(1);
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead && !b.fromRival) {
        for (const rival of state.rivals) {
          if (rival.alive && dist(b.x, b.y, rival.x, rival.y) < 18) {
            rival.health -= PISTOL.damage;
            if (rival.health <= 0) rival.alive = false;
            dead = true;
            break;
          }
        }
      }
      if (!dead && b.fromRival) {
        const p = state.player;
        if (dist(b.x, b.y, p.x, p.y) < (p.inCar ? 30 : 16)) {
          damagePlayer(b.damage);
          dead = true;
        }
      }
      b.dead = dead;
    }
    state.bullets = state.bullets.filter((b) => !b.dead);
  }

  function stepPickups(dt) {
    const p = state.player;
    let events = 0;
    for (const pickup of state.pickups) {
      if (pickup.taken) {
        if (state.elapsed >= pickup.respawnAt) pickup.taken = false;
        continue;
      }
      if (dist(p.x, p.y, pickup.x, pickup.y) < 34) {
        pickup.taken = true;
        pickup.respawnAt = state.elapsed + 40;
        if (pickup.kind === 'health') p.health = Math.min(PLAYER.health, p.health + 50);
        else if (pickup.kind === 'ammo') p.ammo += 12;
        else p.money += 50 + Math.floor(random() * 100);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function stepMissions(actions) {
    if (state.missionIndex >= MISSIONS.length || state.endKind) return 0;
    const mission = MISSIONS[state.missionIndex];
    const p = state.player;
    if (mission.kind === 'drive-to') {
      if (p.inCar && dist(p.x, p.y, mission.marker.x, mission.marker.y) < 120) return completeMission();
    } else if (mission.kind === 'pickup') {
      if ((actions & 4) !== 0 && dist(p.x, p.y, mission.marker.x, mission.marker.y) < 70) return completeMission();
    } else if (mission.kind === 'lose-heat') {
      if (state.wanted === 0 && dist(p.x, p.y, mission.marker.x, mission.marker.y) < 120) return completeMission();
    } else if (mission.kind === 'eliminate') {
      if (state.rivals.length > 0 && state.rivals.every((r) => !r.alive)) return completeMission();
    } else if (mission.kind === 'grab-and-go') {
      if (state.missionPhase === 'grab') {
        // Reaching the courier van grabs the cash — no key press needed.
        if (dist(p.x, p.y, mission.marker.x, mission.marker.y) < 70) {
          state.missionPhase = 'escape';
          state.dialogue = { text: 'MARLA: "Cash in hand. Now vanish at the hideout — don\'t get caught."', t: 6 };
        }
      } else if (dist(p.x, p.y, mission.hideout.x, mission.hideout.y) < 120) {
        return completeMission();
      }
    }
    return 0;
  }

  /**
   * One fixed step. `input` is { move: {x, y}, actions: bit flags } — actions use the
   * same bits as input.js (ENTER is 4). With `harmless` set (the title screen's
   * backdrop) the city lives but nothing touches the player and nothing scores.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    const p = state.player;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.shootCd = Math.max(0, p.shootCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    if (state.dialogue) {
      state.dialogue.t -= dt;
      if (state.dialogue.t <= 0) state.dialogue = null;
    }

    stepTraffic(dt);
    stepPeds(dt);

    if (!harmless && !state.endKind) {
      // Wanted decays when the player lays low.
      if (state.wanted > 0 && state.elapsed - state.lastCrime > WANTED_DECAY_SECONDS) {
        state.wanted -= 1;
        state.lastCrime = state.elapsed;
      }
      events |= stepPolice(dt);
      if (state.endKind) return events;
      stepRivals(dt);
      stepBullets(dt);
      events |= stepPickups(dt);

      const move = input?.move ?? { x: 0, y: 0 };
      const actions = input?.actions ?? 0;

      if (p.inCar) {
        const car = p.inCar;
        const throttle = -move.y;
        if (throttle > 0) car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * dt);
        else if (throttle < 0) {
          if (car.speed > 0) car.speed = Math.max(0, car.speed - CAR.brake * dt);
          else car.speed = Math.max(-CAR.reverseMax, car.speed - CAR.accel * 0.5 * dt);
        } else {
          car.speed *= Math.max(0, 1 - CAR.drag * dt);
          if (Math.abs(car.speed) < 4) car.speed = 0;
        }
        const steerAmount = move.x * CAR.steer * clamp(Math.abs(car.speed) / 220, 0, 1);
        car.angle += steerAmount * Math.sign(car.speed || 1) * dt;
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        car.x = clamp(car.x, 40, WORLD.width - 40);
        car.y = clamp(car.y, 40, BAY_Y - 30);
        const before = { x: car.x, y: car.y };
        collideBuildings(car, 24);
        if (car.x !== before.x || car.y !== before.y) car.speed *= 0.45;
        // Bumping other cars and running over pedestrians.
        for (const other of state.cars) {
          if (other === car) continue;
          const d = dist(car.x, car.y, other.x, other.y);
          if (d < 48 && d > 0.01) {
            const push = (48 - d) / 2;
            const nx = (other.x - car.x) / d;
            const ny = (other.y - car.y) / d;
            other.x += nx * push;
            other.y += ny * push;
            car.speed *= 0.7;
          }
        }
        for (const ped of state.peds) {
          if (!ped.dead && Math.abs(car.speed) > 60 && dist(car.x, car.y, ped.x, ped.y) < 30) {
            killPed(ped);
            events |= EVENT_CRIME;
          }
        }
        p.x = car.x;
        p.y = car.y;
        p.angle = car.angle;
        if ((actions & 4) !== 0) {
          // Exit the car at its side.
          const side = car.angle + Math.PI / 2;
          p.x = car.x + Math.cos(side) * 40;
          p.y = car.y + Math.sin(side) * 40;
          p.inCar = null;
          car.speed = 0;
        }
      } else {
        // On foot.
        const len = Math.hypot(move.x, move.y);
        if (len > 0) {
          p.x += (move.x / len) * PLAYER.walkSpeed * dt;
          p.y += (move.y / len) * PLAYER.walkSpeed * dt;
          p.angle = Math.atan2(move.y, move.x);
        }
        p.x = clamp(p.x, 30, WORLD.width - 30);
        p.y = clamp(p.y, 30, BAY_Y - 20);
        collideBuildings(p, p.radius);
        if ((actions & 4) !== 0) {
          const car = nearestCar(PLAYER.enterRange);
          if (car && Math.abs(car.speed) < 50) {
            if (car.occupied) {
              car.occupied = false;
              addWanted(1);
              events |= EVENT_CRIME;
              state.peds.push({
                x: car.x + 40, y: car.y + 40, angle: 0, speed: 120,
                color: Math.floor(random() * 5), road: 'x', line: car.x, dir: 1, side: 1,
                flee: 4, fleeX: car.x, fleeY: car.y, dead: false, deadTimer: 0,
              });
              state.dialogue = { text: 'You dragged the driver out of the car. The cops noticed.', t: 4 };
            }
            p.inCar = car;
            car.parked = false;
            p.x = car.x;
            p.y = car.y;
            p.angle = car.angle;
          }
        }
        if ((actions & 8) !== 0 && p.punchCd <= 0) {
          p.punchCd = PLAYER.punchCooldown;
          const reach = PLAYER.punchRange + p.radius;
          const px = p.x + Math.cos(p.angle) * reach;
          const py = p.y + Math.sin(p.angle) * reach;
          for (const ped of state.peds) {
            if (!ped.dead && dist(px, py, ped.x, ped.y) < 26) {
              ped.health = (ped.health ?? 100) - PLAYER.punchDamage;
              if (ped.health <= 0) killPed(ped);
              else {
                ped.flee = 3;
                ped.fleeX = p.x;
                ped.fleeY = p.y;
                addWanted(1);
              }
              events |= EVENT_CRIME;
              break;
            }
          }
          for (const rival of state.rivals) {
            if (rival.alive && dist(px, py, rival.x, rival.y) < 26) {
              rival.health -= PLAYER.punchDamage;
              if (rival.health <= 0) rival.alive = false;
              break;
            }
          }
        }
      }

      // Shooting works on foot and from the car.
      if ((actions & 16) !== 0 && p.shootCd <= 0 && p.ammo > 0) {
        p.shootCd = PISTOL.cooldown;
        p.ammo -= 1;
        const gx = p.x + Math.cos(p.angle) * 22;
        const gy = p.y + Math.sin(p.angle) * 22;
        state.bullets.push({
          x: gx, y: gy,
          vx: Math.cos(p.angle) * PISTOL.bulletSpeed,
          vy: Math.sin(p.angle) * PISTOL.bulletSpeed,
          damage: PISTOL.damage, fromRival: false, travelled: 0,
        });
        events |= EVENT_SHOT;
        let witness = false;
        for (const cop of state.police) if (dist(p.x, p.y, cop.x, cop.y) < 600) witness = true;
        for (const ped of state.peds) if (!ped.dead && dist(p.x, p.y, ped.x, ped.y) < 300) witness = true;
        if (witness) addWanted(1);
        for (const ped of state.peds) {
          if (!ped.dead && dist(p.x, p.y, ped.x, ped.y) < 320) {
            ped.flee = 3;
            ped.fleeX = p.x;
            ped.fleeY = p.y;
          }
        }
      }

      events |= stepMissions(actions);
      if (state.endKind === 'wasted') events |= EVENT_WASTED;
    }

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    updateCamera();
    return events;
  }

  /** Directly end the run (used only by the screenshot staging). */
  function triggerEnd(kind) {
    state.endKind = kind;
  }

  function applySave(save) {
    state.player.money = save.money ?? 0;
    const index = save.missionIndex ?? 0;
    state.missionIndex = Math.min(index, MISSIONS.length - 1);
    state.storyDone = save.storyDone ?? false;
    if (state.missionIndex >= MISSIONS.length) state.storyDone = true;
    startMission(state.missionIndex);
  }

  function snapshotSave() {
    return {
      money: state.player.money,
      missionIndex: state.missionIndex,
      storyDone: state.storyDone,
      savedAt: Date.now(),
    };
  }

  reset();

  return {
    state,
    reset,
    step,
    triggerEnd,
    applySave,
    snapshotSave,
    missionMarker,
    saveKey: SAVE_KEY,
    stepSeconds: STEP,
  };
}
