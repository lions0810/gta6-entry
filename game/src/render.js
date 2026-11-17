// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 view follows the camera and scales to fit the window, the margin filled
// with the backdrop colour. Flat shapes and canvas text; the city, cars, people,
// HUD, minimap and the title/pause/end panels are all drawn here.
import {
  BAY_Y, CAR, FONT, MISSIONS, PALETTE, ROAD_W, ROAD_X, ROAD_Y, VIEW, WORLD,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MINIMAP = { width: 220, height: 164, margin: 16 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const moneyLabel = cachedLabel('$');
  const ammoLabel = cachedLabel('Ammo ');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function text(value, x, y, size, color, align = 'left') {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }
  function plainText(value, x, y, size, color, align = 'left') {
    if (!fonts.has(-size)) fonts.set(-size, `${size}px ${FONT}`);
    context.font = fonts.get(-size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawCity(state) {
    const cam = state.camera;
    context.setTransform(view.scale, 0, 0, view.scale, view.x - cam.x * view.scale, view.y - cam.y * view.scale);
    // Ground and bay.
    context.fillStyle = PALETTE.ground;
    context.fillRect(cam.x - 40, cam.y - 40, VIEW.width + 80, VIEW.height + 80);
    context.fillStyle = PALETTE.block;
    for (let ix = 0; ix < ROAD_X.length - 1; ix += 1) {
      for (let iy = 0; iy < ROAD_Y.length - 1; iy += 1) {
        context.fillRect(
          ROAD_X[ix] + ROAD_W / 2, ROAD_Y[iy] + ROAD_W / 2,
          ROAD_X[ix + 1] - ROAD_X[ix] - ROAD_W, ROAD_Y[iy + 1] - ROAD_Y[iy] - ROAD_W,
        );
      }
    }
    context.fillStyle = PALETTE.bayDeep;
    context.fillRect(cam.x - 40, BAY_Y, VIEW.width + 80, WORLD.height - BAY_Y + 40);
    context.fillStyle = PALETTE.bay;
    context.fillRect(cam.x - 40, BAY_Y, VIEW.width + 80, 26);
    // Sidewalks and roads.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of ROAD_X) context.fillRect(rx - ROAD_W / 2 - 22, 0, ROAD_W + 44, BAY_Y);
    for (const ry of ROAD_Y) context.fillRect(0, ry - ROAD_W / 2 - 22, WORLD.width, ROAD_W + 44);
    context.fillStyle = PALETTE.road;
    for (const rx of ROAD_X) context.fillRect(rx - ROAD_W / 2, 0, ROAD_W, BAY_Y);
    for (const ry of ROAD_Y) context.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    // Centre dashes.
    context.fillStyle = PALETTE.roadLine;
    for (const rx of ROAD_X) {
      for (let y = 0; y < BAY_Y; y += 64) context.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROAD_Y) {
      for (let x = 0; x < WORLD.width; x += 64) context.fillRect(x, ry - 2, 30, 4);
    }
    // Buildings.
    for (const b of state.buildings) {
      context.fillStyle = PALETTE.building[b.color % PALETTE.building.length];
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.buildingRoof[b.color % PALETTE.buildingRoof.length];
      context.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      context.fillStyle = 'rgba(220, 230, 255, 0.35)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          context.fillRect(b.x + 12 + cx * 26, b.y + 12 + cy * 26, 10, 8);
        }
      }
    }
    // Props: trees and lamps.
    for (const prop of state.props) {
      if (prop.kind === 'tree') {
        context.fillStyle = PALETTE.treeDark;
        context.beginPath();
        context.arc(prop.x, prop.y, 13, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.tree;
        context.beginPath();
        context.arc(prop.x - 2, prop.y - 2, 10, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = PALETTE.lamp;
        context.beginPath();
        context.arc(prop.x, prop.y, 4, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Mission marker: a pulsing gold diamond with a beam.
    const marker = currentMarker(state);
    if (marker) {
      const pulse = 1 + 0.18 * Math.sin(state.elapsed * 4);
      context.fillStyle = 'rgba(255, 217, 74, 0.18)';
      context.beginPath();
      context.arc(marker.x, marker.y, 46 * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.marker;
      context.save();
      context.translate(marker.x, marker.y);
      context.rotate(Math.PI / 4);
      const s = 15 * pulse;
      context.fillRect(-s, -s, s * 2, s * 2);
      context.restore();
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(marker.x, marker.y, 26 * pulse, 0, Math.PI * 2);
      context.stroke();
    }
    // Pickups.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const color = pickup.kind === 'health' ? PALETTE.pickupHealth
        : pickup.kind === 'ammo' ? PALETTE.pickupAmmo : PALETTE.pickupCash;
      context.fillStyle = color;
      context.beginPath();
      context.arc(pickup.x, pickup.y, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#10131a';
      context.font = 'bold 15px ' + FONT;
      context.textAlign = 'center';
      context.fillText(pickup.kind === 'health' ? '+' : pickup.kind === 'ammo' ? 'A' : '$', pickup.x, pickup.y + 5);
    }
    // Pedestrians and rivals.
    for (const ped of state.peds) {
      if (ped.dead) {
        context.fillStyle = 'rgba(212, 58, 46, 0.7)';
        context.beginPath();
        context.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.fillStyle = PALETTE.ped[ped.color % PALETTE.ped.length];
      context.beginPath();
      context.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#e8c9a0';
      context.beginPath();
      context.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 4.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const rival of state.rivals) {
      if (!rival.alive) continue;
      context.fillStyle = PALETTE.rival;
      context.beginPath();
      context.arc(rival.x, rival.y, 11, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#1a1a1a';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(rival.x, rival.y);
      context.lineTo(rival.x + Math.cos(rival.angle) * 22, rival.y + Math.sin(rival.angle) * 22);
      context.stroke();
    }
    // Traffic, parked cars and police.
    for (const car of state.traffic) drawCar(car, false, state);
    for (const car of state.cars) drawCar(car, car === state.player.inCar, state);
    for (const cop of state.police) drawCar(cop, false, state, true);
    // Player on foot.
    const p = state.player;
    if (!p.inCar) {
      context.fillStyle = PALETTE.playerDark;
      context.beginPath();
      context.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#20242c';
      context.beginPath();
      context.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 5, 0, Math.PI * 2);
      context.fill();
    }
    // Bullets and particles.
    context.strokeStyle = '#ffe9a8';
    context.lineWidth = 3;
    for (const b of state.bullets) {
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    for (const pt of state.particles) {
      context.fillStyle = pt.color;
      context.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawCar(car, isPlayerCar, state, isPolice = false) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const body = isPolice ? PALETTE.police : PALETTE.car[car.color % PALETTE.car.length];
    context.fillStyle = isPolice ? PALETTE.policeDark : 'rgba(0, 0, 0, 0.35)';
    roundRect(-CAR.length / 2 - 2, -CAR.width / 2 - 2, CAR.length + 4, CAR.width + 4, 8);
    context.fill();
    context.fillStyle = body;
    roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    context.fill();
    if (isPolice) {
      context.fillStyle = '#20242c';
      context.fillRect(-6, -CAR.width / 2, 12, CAR.width);
    }
    context.fillStyle = '#9fc4d8';
    context.fillRect(CAR.length / 2 - 16, -CAR.width / 2 + 4, 10, CAR.width - 8);
    context.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 + 4, 8, CAR.width - 8);
    if (isPlayerCar) {
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 3;
      roundRect(-CAR.length / 2 - 4, -CAR.width / 2 - 4, CAR.length + 8, CAR.width + 8, 10);
      context.stroke();
    }
    if (isPolice) {
      const flash = Math.floor(state.elapsed * 6) % 2 === 0;
      context.fillStyle = flash ? '#ff3b30' : '#2f7bff';
      context.beginPath();
      context.arc(-4, -CAR.width / 2 + 2, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = flash ? '#2f7bff' : '#ff3b30';
      context.beginPath();
      context.arc(-4, CAR.width / 2 - 2, 5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function currentMarker(state) {
    if (state.missionIndex >= MISSIONS.length) return null;
    const mission = MISSIONS[state.missionIndex];
    if (mission.kind === 'grab-and-go' && state.missionPhase === 'escape') return mission.hideout;
    return mission.marker;
  }

  function drawHud(state) {
    const p = state.player;
    // Top-left: health, money, ammo.
    context.fillStyle = PALETTE.panel;
    roundRect(16, 14, 260, 92, 10);
    context.fill();
    context.fillStyle = '#22262e';
    context.fillRect(30, 30, 180, 16);
    const hpRatio = Math.max(0, p.health / 100);
    context.fillStyle = hpRatio > 0.3 ? PALETTE.health : PALETTE.healthLow;
    context.fillRect(30, 30, 180 * hpRatio, 16);
    text(`HP ${Math.ceil(p.health)}`, 218, 43, 15, PALETTE.text);
    text(moneyLabel(p.money), 30, 74, 22, PALETTE.text);
    text(ammoLabel(p.ammo), 30, 98, 15, PALETTE.muted);
    // Top-right: wanted stars.
    context.fillStyle = PALETTE.panel;
    roundRect(VIEW.width - 216, 14, 200, 46, 10);
    context.fill();
    for (let i = 0; i < 5; i += 1) {
      text('★', VIEW.width - 196 + i * 36, 46, 28, i < state.wanted ? PALETTE.star : PALETTE.starEmpty, 'left');
    }
    // Top-centre: current objective.
    if (state.missionIndex < MISSIONS.length) {
      const mission = MISSIONS[state.missionIndex];
      context.fillStyle = PALETTE.panel;
      const label = `${mission.id + 1}. ${mission.title} — ${mission.objective}`;
      context.font = `16px ${FONT}`;
      const w = Math.min(780, 28 + context.measureText(label).width);
      roundRect((VIEW.width - w) / 2, 14, w, 40, 10);
      context.fill();
      plainText(label, VIEW.width / 2, 41, 16, PALETTE.text, 'center');
    } else if (state.storyDone) {
      context.fillStyle = 'rgba(20, 26, 16, 0.85)';
      roundRect(440, 14, 400, 40, 10);
      context.fill();
      plainText('★ STORY COMPLETE — Sunset Bay is yours ★', VIEW.width / 2, 41, 16, PALETTE.marker, 'center');
    }
    // Dialogue box.
    if (state.dialogue) {
      context.fillStyle = PALETTE.panel;
      roundRect(240, VIEW.height - 108, 800, 56, 10);
      context.fill();
      plainText(state.dialogue.text, VIEW.width / 2, VIEW.height - 72, 16, PALETTE.text, 'center');
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const mx = VIEW.width - MINIMAP.width - MINIMAP.margin;
    const my = VIEW.height - MINIMAP.height - MINIMAP.margin;
    const sx = MINIMAP.width / WORLD.width;
    const sy = MINIMAP.height / 2400;
    context.fillStyle = PALETTE.panel;
    roundRect(mx - 6, my - 6, MINIMAP.width + 12, MINIMAP.height + 12, 8);
    context.fill();
    context.fillStyle = '#14171d';
    context.fillRect(mx, my, MINIMAP.width, MINIMAP.height);
    context.fillStyle = PALETTE.bay;
    context.fillRect(mx, my + 2320 * sy, MINIMAP.width, MINIMAP.height - 2320 * sy);
    context.strokeStyle = '#3a3f47';
    context.lineWidth = 1;
    for (const rx of ROAD_X) {
      context.beginPath();
      context.moveTo(mx + rx * sx, my);
      context.lineTo(mx + rx * sx, my + MINIMAP.height);
      context.stroke();
    }
    for (const ry of ROAD_Y) {
      context.beginPath();
      context.moveTo(mx, my + ry * sy);
      context.lineTo(mx + MINIMAP.width, my + ry * sy);
      context.stroke();
    }
    const marker = currentMarker(state);
    if (marker) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(mx + marker.x * sx, my + marker.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const cop of state.police) {
      context.fillStyle = '#2f7bff';
      context.beginPath();
      context.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const rival of state.rivals) {
      if (!rival.alive) continue;
      context.fillStyle = PALETTE.rival;
      context.beginPath();
      context.arc(mx + rival.x * sx, my + rival.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#20242c';
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawPanel(title, lines, prompt) {
    context.fillStyle = 'rgba(8, 10, 14, 0.72)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const width = 640;
    const height = 150 + lines.length * 34 + (prompt ? 56 : 0);
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = '#3a3f47';
    context.lineWidth = 2;
    roundRect(x, y, width, height, 14);
    context.stroke();
    text(title, VIEW.width / 2, y + 62, 44, PALETTE.text, 'center');
    lines.forEach((line, i) => {
      plainText(line, VIEW.width / 2, y + 116 + i * 34, 17, PALETTE.muted, 'center');
    });
    if (prompt) plainText(prompt, VIEW.width / 2, y + height - 30, 18, PALETTE.marker, 'center');
  }

  function draw(state, screen, saveInfo) {
    resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // The world pass sets its own camera transform and resets to identity.
    drawCity(state);
    // The HUD and panels draw in logical 1280x720 space.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'An original open-world crime story — no Rockstar IP.',
        'WASD move & drive   ·   E enter / steal a car   ·   F punch   ·   SPACE shoot',
        'P pause   ·   M mute   ·   E also grabs mission pickups',
      ];
      if (saveInfo?.hasSave) {
        lines.push(`Saved story: $${saveInfo.money} — mission ${Math.min(saveInfo.missionIndex + 1, 5)} of 5${saveInfo.storyDone ? ' (story complete)' : ''}`);
      }
      const prompt = saveInfo?.hasSave ? 'ENTER start new story  ·  C continue saved story' : 'Press ENTER or click to start';
      drawPanel('SUNSET BAY', lines, prompt);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits for you.'], 'P / ENTER resume');
    } else if (screen === SCREEN_OVER) {
      const busted = state.endKind === 'busted';
      drawPanel(
        busted ? 'BUSTED' : 'WASTED',
        busted
          ? ['The Sunset Bay PD caught up with you on foot.', `You keep your $${state.player.money} — the story continues.`]
          : ['Rook went down in the streets of Sunset Bay.', `You keep your $${state.player.money} — the story continues.`],
        'Press ENTER to get back out there',
      );
    }
  }

  return { draw, resize };
}
