// The game's rules and state, with no drawing and no browser in it: the city, the player
// on foot and in cars, traffic, pedestrians, police, wanted level, combat, pickups and the
// five-mission story chain. step() advances one fixed step and returns what happened as
// bit flags, so the caller can react (sound, announcements) without the world knowing
// about screens. All positions are world coordinates.
import { CAR, MISSIONS, PISTOL, PLAYER, ROAD_W, ROAD_X, ROAD_Y, WORLD } from './config.js';
import { ACTION_INTERACT, ACTION_MELEE, ACTION_SHOOT } from './input.js';

export const EVENT_SHOOT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_CASH = 4;
export const EVENT_MISSION = 8;
export const EVENT_BUSTED = 16;
export const EVENT_WASTED = 32;
export const EVENT_CRASH = 64;
export const EVENT_PUNCH = 128;
export const EVENT_STORY_DONE = 256;

const TAU = Math.PI * 2;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx; const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function resolveCircleRect(p, r, rect) {
  // Push circle p out of rect (axis of least penetration). Returns true on contact.
  const nx = clamp(p.x, rect.x, rect.x + rect.w);
  const ny = clamp(p.y, rect.y, rect.y + rect.h);
  let dx = p.x - nx; let dy = p.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    p.x = nx + (dx / d) * r;
    p.y = ny + (dy / d) * r;
  } else {
    // Centre inside the rect: push out along the smallest axis.
    const left = p.x - rect.x; const right = rect.x + rect.w - p.x;
    const top = p.y - rect.y; const bottom = rect.y + rect.h - p.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = rect.x - r;
    else if (m === right) p.x = rect.x + rect.w + r;
    else if (m === top) p.y = rect.y - r;
    else p.y = rect.y + rect.h + r;
  }
  return true;
}

export function isOnRoad(x, y) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

function nearestRoadX(x) {
  let best = ROAD_X[0];
  for (const rx of ROAD_X) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
function nearestRoadY(y) {
  let best = ROAD_Y[0];
  for (const ry of ROAD_Y) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

export function createWorld(random) {
  // ---- static city: buildings, trees, lamps --------------------------------
  const buildings = [];
  const trees = [];
  const lamps = [];
  const palette = ['#7a6a58', '#5b6b7a', '#6e5a6e', '#4f6152', '#8a7a5a', '#5a6a7a'];
  for (let ix = 0; ix < ROAD_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROAD_Y.length - 1; iy += 1) {
      const x0 = ROAD_X[ix] + ROAD_W / 2 + 26;
      const x1 = ROAD_X[ix + 1] - ROAD_W / 2 - 26;
      const y0 = ROAD_Y[iy] + ROAD_W / 2 + 26;
      const y1 = ROAD_Y[iy + 1] - ROAD_W / 2 - 26;
      const w = x1 - x0; const h = y1 - y0;
      const n = 1 + Math.floor(random() * 2);
      for (let b = 0; b < n; b += 1) {
        const bw = w * (n === 1 ? 0.62 : 0.42);
        const bh = h * (n === 1 ? 0.55 : 0.42);
        const bx = x0 + (n === 1 ? (w - bw) / 2 : b * (w - bw) + random() * 20);
        const by = y0 + (n === 1 ? (h - bh) / 2 : random() * (h - bh));
        buildings.push({ x: bx, y: by, w: bw, h: bh, color: palette[Math.floor(random() * palette.length)], windows: 2 + Math.floor(random() * 3) });
      }
      for (let t = 0; t < 3; t += 1) {
        trees.push({ x: x0 + random() * w, y: y0 + random() * h });
      }
    }
  }
  for (const rx of ROAD_X) for (const ry of ROAD_Y) lamps.push({ x: rx + ROAD_W / 2 + 6, y: ry - ROAD_W / 2 - 6 });

  // ---- dynamic state -------------------------------------------------------
  const player = {
    x: 600, y: 600, angle: 0, health: PLAYER.health, money: 0, ammo: 12,
    inCar: null, punchTimer: 0, shootTimer: 0, bustedTimer: 0, invulnerable: 0,
  };
  const state = {
    player, buildings, trees, lamps,
    cars: [], traffic: [], peds: [], police: [], bullets: [], pickups: [], rivals: [],
    wanted: 0, wantedTimer: 0, missionIndex: 0, missionStage: 0, missionDone: false,
    storyDone: false, elapsed: 0, endKind: null, // 'busted' | 'wasted'
    message: '', messageTimer: 0, kills: 0, carsStolen: 0, cashEarned: 0,
    camX: 600, camY: 600,
  };

  function say(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 4;
  }

  function spawnCar(x, y, angle, opts) {
    const o = opts || {};
    const car = {
      x, y, angle, speed: 0, color: o.color || '#c0392b', kind: o.kind || 'civilian',
      driver: o.driver !== undefined ? o.driver : true, occupied: o.occupied || false,
      health: 100, isPolice: !!o.police, id: state.cars.length + Math.floor(random() * 1000),
    };
    state.cars.push(car);
    return car;
  }

  function spawnTraffic() {
    for (let i = 0; i < 14; i += 1) {
      const vertical = random() < 0.5;
      const road = vertical ? ROAD_X[Math.floor(random() * ROAD_X.length)] : ROAD_Y[Math.floor(random() * ROAD_Y.length)];
      const along = 100 + random() * (WORLD.width - 200);
      const dir = random() < 0.5 ? 1 : -1;
      const palette2 = ['#c0392b', '#7f8c8d', '#d4d4d4', '#8e44ad', '#16a085', '#e67e22'];
      state.traffic.push({
        x: vertical ? road + (dir > 0 ? 22 : -22) : along,
        y: vertical ? along : road + (dir > 0 ? 22 : -22),
        angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        vertical, dir, speed: 110 + random() * 70, color: palette2[Math.floor(random() * palette2.length)],
        turnCooldown: 0,
      });
    }
  }

  function spawnPeds() {
    const shirts = ['#e5534b', '#4fc3f7', '#9b7ede', '#f28c4b', '#7ee081'];
    for (let i = 0; i < 26; i += 1) {
      const vertical = random() < 0.5;
      const road = vertical ? ROAD_X[Math.floor(random() * ROAD_X.length)] : ROAD_Y[Math.floor(random() * ROAD_Y.length)];
      const along = 100 + random() * (WORLD.height - 200);
      const off = (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 14);
      state.peds.push({
        x: vertical ? road + off : along,
        y: vertical ? along : road + off,
        angle: random() * TAU, speed: 34 + random() * 26, shirt: shirts[Math.floor(random() * shirts.length)],
        flee: 0, health: 30, dead: false, dir: random() < 0.5 ? 1 : -1, vertical,
      });
    }
  }

  function spawnParkedCars() {
    const spots = [
      [600, 168, 0], [1000, 232, Math.PI], [1400, 168, 0], [2200, 232, Math.PI],
      [1800, 568, 0], [2600, 632, Math.PI], [1000, 968, 0], [3000, 1032, Math.PI],
      [600, 1368, 0], [2200, 1432, Math.PI], [1400, 1768, 0], [2600, 1832, Math.PI],
      [1800, 2168, 0], [1000, 2232, Math.PI], [3000, 568, 0], [600, 1032, Math.PI],
    ];
    const palette2 = ['#c0392b', '#7f8c8d', '#d4d4d4', '#8e44ad', '#16a085', '#e67e22'];
    for (const [x, y, a] of spots) {
      spawnCar(x, y, a, { color: palette2[Math.floor(random() * palette2.length)], occupied: random() < 0.35 });
    }
  }

  function spawnPickups() {
    const defs = [
      { kind: 'cash', x: 620, y: 980 }, { kind: 'cash', x: 1420, y: 620 }, { kind: 'cash', x: 2620, y: 1420 },
      { kind: 'health', x: 1020, y: 1820 }, { kind: 'health', x: 2220, y: 1020 }, { kind: 'health', x: 620, y: 2200 },
      { kind: 'ammo', x: 1820, y: 620 }, { kind: 'ammo', x: 2620, y: 2200 }, { kind: 'ammo', x: 1020, y: 2200 },
      { kind: 'cash', x: 2220, y: 1820 }, { kind: 'cash', x: 1820, y: 2200 }, { kind: 'health', x: 3020, y: 620 },
    ];
    for (const d of defs) state.pickups.push({ ...d, active: true, bob: random() * TAU });
  }

  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.wantedTimer = 0;
  }

  function spawnPolice() {
    const want = Math.min(1 + state.wanted, 4);
    while (state.police.length < want) {
      const ang = random() * TAU;
      const rx = clamp(player.x + Math.cos(ang) * 700, 120, WORLD.width - 120);
      const ry = clamp(player.y + Math.sin(ang) * 700, 120, WORLD.height - 120);
      const car = spawnCar(nearestRoadX(rx), nearestRoadY(ry), angleTo(rx, ry, player.x, player.y), { color: '#2f6fd0', police: true, kind: 'police' });
      state.police.push({ car, ramTimer: 0 });
    }
  }

  function startMission(index) {
    const m = MISSIONS[index];
    state.missionIndex = index;
    state.missionStage = 0;
    say(m.briefing, 6);
    if (m.wantedOnStart) addWanted(m.wantedOnStart);
    if (m.kind === 'eliminate') {
      state.rivals = [];
      for (let i = 0; i < m.enemies; i += 1) {
        state.rivals.push({
          x: m.marker.x + (random() - 0.5) * 160, y: m.marker.y + (random() - 0.5) * 160,
          health: 60, shootTimer: 1 + random(), alive: true, angle: 0,
        });
      }
    }
    if (m.kind === 'grab-and-go') {
      state.pickups.push({ kind: 'cash-big', x: m.marker.x, y: m.marker.y, active: true, bob: 0 });
    }
  }

  function completeMission() {
    const m = MISSIONS[state.missionIndex];
    player.money += m.payout;
    state.cashEarned += m.payout;
    say(`MISSION COMPLETE: ${m.title} — +$${m.payout}`, 5);
    state.missionIndex += 1;
    if (state.missionIndex >= MISSIONS.length) {
      state.storyDone = true;
      say('STORY COMPLETE — You own Sunset Bay. Final score banked.', 8);
      return EVENT_MISSION | EVENT_STORY_DONE;
    }
    startMission(state.missionIndex);
    return EVENT_MISSION;
  }

  function reset() {
    player.x = 600; player.y = 600; player.angle = -Math.PI / 2;
    player.health = PLAYER.health; player.money = 0; player.ammo = 12;
    player.inCar = null; player.punchTimer = 0; player.shootTimer = 0; player.bustedTimer = 0; player.invulnerable = 0;
    state.cars = []; state.traffic = []; state.peds = []; state.police = [];
    state.bullets = []; state.pickups = []; state.rivals = [];
    state.wanted = 0; state.wantedTimer = 0; state.missionIndex = 0; state.missionStage = 0;
    state.missionDone = false; state.storyDone = false; state.elapsed = 0; state.endKind = null;
    state.message = ''; state.messageTimer = 0; state.kills = 0; state.carsStolen = 0; state.cashEarned = 0;
    state.camX = 600; state.camY = 600;
    spawnParkedCars();
    spawnTraffic();
    spawnPeds();
    spawnPickups();
    startMission(0);
  }

  function applySave(save) {
    if (!save) return;
    player.money = save.money || 0;
    if (typeof save.missionIndex === 'number' && save.missionIndex > 0 && save.missionIndex < MISSIONS.length) {
      state.missionIndex = save.missionIndex;
      startMission(save.missionIndex);
      say(`Welcome back, Rook. Mission ${save.missionIndex + 1}: ${MISSIONS[save.missionIndex].title}`, 5);
    }
  }

  function carCollidesBuildings(car) {
    for (const b of buildings) {
      if (circleHitsRect(car.x, car.y, CAR.length / 2, b)) return b;
    }
    return null;
  }

  function moveCircle(p, r, dx, dy) {
    p.x += dx;
    for (const b of buildings) resolveCircleRect(p, r, b);
    p.y += dy;
    for (const b of buildings) resolveCircleRect(p, r, b);
    p.x = clamp(p.x, 20, WORLD.width - 20);
    p.y = clamp(p.y, 20, WORLD.height - 20);
  }

  function nearestCar(maxDist) {
    let best = null; let bestD = maxDist;
    for (const car of state.cars) {
      if (player.inCar === car) continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function step(dt, input, actions) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (player.shootTimer > 0) player.shootTimer -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;

    // ---- wanted decay: no crime for a while and the heat cools off ----------
    if (state.wanted > 0) {
      state.wantedTimer += dt;
      if (state.wantedTimer > 14) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        if (state.wanted === 0) {
          state.police = [];
          say('You lost the cops.', 3);
        }
      }
      spawnPolice();
    }

    // ---- player ------------------------------------------------------------
    const mv = input.move();
    const mag = Math.hypot(mv.x, mv.y) || 1;
    if (player.inCar) {
      const car = player.inCar;
      const steer = mv.x;
      const throttle = -mv.y; // up = forward
      if (throttle > 0) car.speed += CAR.accel * dt;
      else if (throttle < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.5) * dt;
      else car.speed -= car.speed * CAR.drag * dt * 2;
      car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
      if (Math.abs(car.speed) > 5) car.angle += steer * CAR.steer * dt * (car.speed / CAR.maxSpeed) * (car.speed < 0 ? -1 : 1) * 1.6;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const hit = circleHitsRect(nx, ny, CAR.length / 2 - 4, { x: 0, y: 0, w: 0, h: 0 });
      void hit;
      let blocked = false;
      for (const b of buildings) {
        if (circleHitsRect(nx, ny, CAR.length / 2 - 4, b)) { blocked = true; break; }
      }
      if (blocked) {
        if (Math.abs(car.speed) > 200) events |= EVENT_CRASH;
        car.speed *= -0.25;
      } else {
        car.x = clamp(nx, 30, WORLD.width - 30);
        car.y = clamp(ny, 30, WORLD.height - 30);
      }
      player.x = car.x; player.y = car.y; player.angle = car.angle;
      // running over pedestrians is a crime
      for (const ped of state.peds) {
        if (!ped.dead && dist(car.x, car.y, ped.x, ped.y) < 34 && Math.abs(car.speed) > 60) {
          ped.dead = true; state.kills += 1; addWanted(1);
          say('You ran someone over! Wanted level up.', 3);
        }
      }
      if (actions & ACTION_INTERACT) {
        player.inCar = null;
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
        player.angle = car.angle;
      }
    } else {
      if (mv.x !== 0 || mv.y !== 0) {
        const nx = (mv.x / mag) * PLAYER.walkSpeed * dt;
        const ny = (mv.y / mag) * PLAYER.walkSpeed * dt;
        player.angle = Math.atan2(mv.y, mv.x);
        moveCircle(player, PLAYER.radius, nx, ny);
      }
      if (actions & ACTION_INTERACT) {
        const car = nearestCar(64);
        if (car) {
          if (car.occupied) {
            car.occupied = false;
            addWanted(1);
            state.carsStolen += 1;
            say('You dragged the driver out! Wanted level up.', 3);
          } else if (car.isPolice) {
            addWanted(1);
            say('You stole a police cruiser! Wanted level up.', 3);
          } else {
            state.carsStolen += 1;
            say('Car stolen. Drive safe, Rook.', 2);
          }
          player.inCar = car;
          car.speed = 0;
          events |= EVENT_PICKUP;
        } else {
          // mission interact (pickup / grab)
          const m = MISSIONS[state.missionIndex];
          if (m && (m.kind === 'pickup' || m.kind === 'grab-and-go') && state.missionStage === 0 &&
              dist(player.x, player.y, m.marker.x, m.marker.y) < 90) {
            if (m.kind === 'pickup') {
              state.missionStage = 1;
              events |= completeMission();
            }
          }
        }
      }
      if ((actions & ACTION_MELEE) && player.punchTimer <= 0) {
        player.punchTimer = PLAYER.punchCooldown;
        events |= EVENT_PUNCH;
        const px = player.x + Math.cos(player.angle) * 30;
        const py = player.y + Math.sin(player.angle) * 30;
        for (const ped of state.peds) {
          if (!ped.dead && dist(px, py, ped.x, ped.y) < PLAYER.punchRange) {
            ped.health -= PLAYER.punchDamage;
            if (ped.health <= 0) { ped.dead = true; state.kills += 1; addWanted(1); say('That was assault. Wanted level up.', 3); }
          }
        }
        for (const r of state.rivals) {
          if (r.alive && dist(px, py, r.x, r.y) < PLAYER.punchRange + 10) {
            r.health -= PLAYER.punchDamage;
            if (r.health <= 0) { r.alive = false; state.kills += 1; }
          }
        }
      }
      if ((actions & ACTION_SHOOT) && player.shootTimer <= 0 && player.ammo > 0) {
        player.shootTimer = PISTOL.cooldown;
        player.ammo -= 1;
        addWanted(0); // shooting in public draws heat below
        state.bullets.push({
          x: player.x + Math.cos(player.angle) * 20, y: player.y + Math.sin(player.angle) * 20,
          vx: Math.cos(player.angle) * PISTOL.bulletSpeed, vy: Math.sin(player.angle) * PISTOL.bulletSpeed,
          life: PISTOL.range / PISTOL.bulletSpeed, fromPlayer: true,
        });
        events |= EVENT_SHOOT;
        if (state.wanted < 1) addWanted(1);
        for (const ped of state.peds) {
          if (!ped.dead && dist(player.x, player.y, ped.x, ped.y) < 260) ped.flee = 3;
        }
      }
    }

    // ---- bullets ------------------------------------------------------------
    for (const b of state.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) continue;
      for (const bb of buildings) if (circleHitsRect(b.x, b.y, 2, bb)) { b.life = 0; break; }
      if (b.life <= 0) continue;
      if (b.fromPlayer) {
        for (const ped of state.peds) {
          if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 14) {
            ped.health -= PISTOL.damage; b.life = 0;
            if (ped.health <= 0) { ped.dead = true; state.kills += 1; addWanted(1); }
            break;
          }
        }
        if (b.life > 0) for (const r of state.rivals) {
          if (r.alive && dist(b.x, b.y, r.x, r.y) < 16) {
            r.health -= PISTOL.damage; b.life = 0;
            if (r.health <= 0) { r.alive = false; state.kills += 1; }
            break;
          }
        }
        if (b.life > 0) for (const p of state.police) {
          if (dist(b.x, b.y, p.car.x, p.car.y) < 26) {
            p.car.health -= PISTOL.damage; b.life = 0;
            if (p.car.health <= 0) {
              p.car.health = 0;
              state.police = state.police.filter((q) => q !== p);
              state.cars = state.cars.filter((c) => c !== p.car);
              addWanted(1);
            }
            break;
          }
        }
      } else {
        // rival bullet vs player (on foot or in car)
        if (dist(b.x, b.y, player.x, player.y) < (player.inCar ? 26 : 14)) {
          b.life = 0;
          if (player.invulnerable <= 0) {
            player.health -= 12;
            player.invulnerable = 0.4;
            if (player.health <= 0) { player.health = 0; state.endKind = 'wasted'; return events | EVENT_WASTED; }
          }
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);

    // ---- traffic ------------------------------------------------------------
    for (const t of state.traffic) {
      t.turnCooldown -= dt;
      // stop for the car ahead
      let blockedBy = false;
      for (const o of state.traffic) {
        if (o === t) continue;
        const ahead = (o.x - t.x) * Math.cos(t.angle) + (o.y - t.y) * Math.sin(t.angle);
        const side = Math.abs((o.x - t.x) * Math.sin(t.angle) - (o.y - t.y) * Math.cos(t.angle));
        if (ahead > 0 && ahead < 70 && side < 30) { blockedBy = true; break; }
      }
      const pc = player.inCar;
      if (pc) {
        const ahead = (pc.x - t.x) * Math.cos(t.angle) + (pc.y - t.y) * Math.sin(t.angle);
        const side = Math.abs((pc.x - t.x) * Math.sin(t.angle) - (pc.y - t.y) * Math.cos(t.angle));
        if (ahead > 0 && ahead < 80 && side < 34) blockedBy = true;
      }
      const speed = blockedBy ? 0 : t.speed;
      t.x += Math.cos(t.angle) * speed * dt;
      t.y += Math.sin(t.angle) * speed * dt;
      // turn at intersections sometimes
      const nearX = nearestRoadX(t.x); const nearY = nearestRoadY(t.y);
      if (t.turnCooldown <= 0 && Math.abs(t.x - nearX) < 6 && Math.abs(t.y - nearY) < 6 && random() < 0.3) {
        t.vertical = !t.vertical;
        t.dir = random() < 0.5 ? 1 : -1;
        t.angle = t.vertical ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
        t.turnCooldown = 4;
      }
      // wrap around the city edge
      if (t.x < 60) t.x = WORLD.width - 60;
      if (t.x > WORLD.width - 60) t.x = 60;
      if (t.y < 60) t.y = WORLD.height - 60;
      if (t.y > WORLD.height - 60) t.y = 60;
      // snap back onto a road lane if drifted
      if (t.vertical) t.x += (nearestRoadX(t.x) + (t.dir > 0 ? 22 : -22) - t.x) * dt * 2;
      else t.y += (nearestRoadY(t.y) + (t.dir > 0 ? 22 : -22) - t.y) * dt * 2;
    }

    // ---- pedestrians --------------------------------------------------------
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = angleTo(player.x, player.y, ped.x, ped.y);
        ped.x += Math.cos(a) * ped.speed * 2.2 * dt;
        ped.y += Math.sin(a) * ped.speed * 2.2 * dt;
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt * ped.dir;
        ped.y += Math.sin(ped.angle) * ped.speed * dt * ped.dir;
        // keep peds near sidewalks: steer along the nearest road
        const rx = nearestRoadX(ped.x); const ry = nearestRoadY(ped.y);
        if (Math.abs(ped.x - rx) < Math.abs(ped.y - ry)) {
          ped.vertical = true;
          ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          ped.vertical = false;
          ped.angle = ped.dir > 0 ? 0 : Math.PI;
        }
        if (random() < dt * 0.05) ped.dir *= -1;
      }
      ped.x = clamp(ped.x, 40, WORLD.width - 40);
      ped.y = clamp(ped.y, 40, WORLD.height - 40);
      for (const b of buildings) resolveCircleRect(ped, 10, b);
    }

    // ---- rivals (mission 3) ---------------------------------------------------
    for (const r of state.rivals) {
      if (!r.alive) continue;
      r.shootTimer -= dt;
      const d = dist(r.x, r.y, player.x, player.y);
      r.angle = angleTo(r.x, r.y, player.x, player.y);
      if (d < 420 && r.shootTimer <= 0) {
        r.shootTimer = 1.1 + random() * 0.6;
        state.bullets.push({
          x: r.x + Math.cos(r.angle) * 20, y: r.y + Math.sin(r.angle) * 20,
          vx: Math.cos(r.angle) * 480, vy: Math.sin(r.angle) * 480,
          life: 0.9, fromPlayer: false,
        });
      }
      if (d > 60 && d < 500) {
        r.x += Math.cos(r.angle) * 60 * dt;
        r.y += Math.sin(r.angle) * 60 * dt;
      }
    }

    // ---- police pursuit -----------------------------------------------------
    for (const p of state.police) {
      const car = p.car;
      const targetAngle = angleTo(car.x, car.y, player.x, player.y);
      const diff = angDiff(targetAngle, car.angle);
      car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      const d = dist(car.x, car.y, player.x, player.y);
      car.speed = clamp(d > 120 ? car.speed + 500 * dt : car.speed - 300 * dt, 0, 380 + state.wanted * 20);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      let blocked = false;
      for (const b of buildings) if (circleHitsRect(nx, ny, CAR.length / 2 - 4, b)) { blocked = true; break; }
      if (!blocked) { car.x = nx; car.y = ny; }
      else { car.angle += 1.2 * dt; car.speed *= 0.6; }
      // ramming the player
      if (d < 44) {
        if (player.inCar) {
          player.inCar.speed *= 0.7;
          if (Math.abs(player.inCar.speed) > 150) events |= EVENT_CRASH;
        } else if (player.invulnerable <= 0) {
          player.health -= 18;
          player.invulnerable = 0.8;
          player.bustedTimer += dt * 2;
          if (player.health <= 0) { player.health = 0; state.endKind = 'wasted'; return events | EVENT_WASTED; }
        }
        if (!player.inCar) player.bustedTimer += dt;
      }
      if (player.bustedTimer > 2.2 && !player.inCar && state.wanted >= 1) {
        state.endKind = 'busted';
        return events | EVENT_BUSTED;
      }
    }
    if (player.inCar) player.bustedTimer = Math.max(0, player.bustedTimer - dt);

    // ---- pickups ------------------------------------------------------------
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      pk.bob += dt * 3;
      if (dist(player.x, player.y, pk.x, pk.y) < 36) {
        pk.active = false;
        if (pk.kind === 'cash') { player.money += 50; state.cashEarned += 50; events |= EVENT_CASH; }
        else if (pk.kind === 'cash-big') {
          player.money += 1000; state.cashEarned += 1000; events |= EVENT_CASH;
          if (state.missionIndex === 4 && state.missionStage === 0) {
            state.missionStage = 1;
            say('Cash grabbed! Get to the hideout — no cops on your tail yet.', 4);
          }
        } else if (pk.kind === 'health') { player.health = Math.min(PLAYER.health, player.health + 40); events |= EVENT_PICKUP; }
        else if (pk.kind === 'ammo') { player.ammo += 12; events |= EVENT_PICKUP; }
      }
    }

    // ---- mission progress -----------------------------------------------------
    const m = MISSIONS[state.missionIndex];
    if (m && !state.storyDone) {
      if (m.kind === 'drive-to') {
        if (player.inCar && dist(player.x, player.y, m.marker.x, m.marker.y) < 110) events |= completeMission();
      } else if (m.kind === 'lose-heat') {
        if (state.missionStage === 0 && state.wanted === 0) {
          state.missionStage = 1;
          say('Heat is off. Now get to the hideout.', 4);
        } else if (state.missionStage === 1 && dist(player.x, player.y, m.marker.x, m.marker.y) < 110) {
          events |= completeMission();
        }
      } else if (m.kind === 'eliminate') {
        if (state.rivals.length > 0 && state.rivals.every((r) => !r.alive)) events |= completeMission();
      } else if (m.kind === 'grab-and-go') {
        if (state.missionStage === 1 && dist(player.x, player.y, m.hideout.x, m.hideout.y) < 110) events |= completeMission();
      }
    }

    // ---- camera ---------------------------------------------------------------
    state.camX = clamp(player.x - 640, 0, WORLD.width - 1280);
    state.camY = clamp(player.y - 360, 0, WORLD.height - 720);

    return events;
  }

  reset();
  return { state, reset, step, applySave, nearestCar, addWanted, say };
}
