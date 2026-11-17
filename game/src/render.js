// Drawing only: the world's state and the current screen in, pixels out. A camera follows
// the player across the 3200x2400 city; the 1280x720 view is scaled to fit the window.
// Flat canvas shapes and text: roads, blocks, buildings, cars, pedestrians, police, HUD
// (health, money, wanted stars, objective) and a live minimap.
import { CAR, FONT, MISSIONS, PALETTE, PLAYER, ROAD_W, ROAD_X, ROAD_Y, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

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

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawCar(x, y, angle, color, isPolice, isPlayerCar) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
    context.fill();
    // cabin + windshield
    context.fillStyle = '#1c2733';
    context.beginPath();
    context.roundRect(-8, -CAR.width / 2 + 4, 18, CAR.width - 8, 4);
    context.fill();
    context.fillStyle = '#cfe8ff';
    context.fillRect(6, -CAR.width / 2 + 5, 4, CAR.width - 10);
    // headlights / taillights
    context.fillStyle = '#fff8c4';
    context.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 2, 3, 5);
    context.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 7, 3, 5);
    context.fillStyle = '#ff3b30';
    context.fillRect(-CAR.length / 2, -CAR.width / 2 + 2, 3, 5);
    context.fillRect(-CAR.length / 2, CAR.width / 2 - 7, 3, 5);
    if (isPolice) {
      context.fillStyle = '#ffffff';
      context.font = 'bold 9px sans-serif';
      context.textAlign = 'center';
      context.fillText('POLICE', 0, 3);
      context.fillStyle = '#ff3b30';
      context.beginPath(); context.arc(-4, -CAR.width / 2 + 2, 3, 0, TAU); context.fill();
      context.fillStyle = '#2f6fd0';
      context.beginPath(); context.arc(4, -CAR.width / 2 + 2, 3, 0, TAU); context.fill();
    }
    if (isPlayerCar) {
      context.strokeStyle = '#f2c94c';
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(-CAR.length / 2 - 3, -CAR.width / 2 - 3, CAR.length + 6, CAR.width + 6, 9);
      context.stroke();
    }
    context.restore();
  }

  function drawPerson(x, y, angle, shirt, isPlayer, isRival, isCop) {
    context.save();
    context.translate(x, y);
    if (isPlayer && Math.floor(performance.now() / 120) % 2 === 0) {
      // subtle walk bob handled by caller time; keep the player readable
    }
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath(); context.ellipse(2, 3, 13, 11, 0, 0, TAU); context.fill();
    context.fillStyle = shirt;
    context.beginPath(); context.arc(0, 0, 12, 0, TAU); context.fill();
    context.fillStyle = '#f2c9a0';
    context.beginPath(); context.arc(Math.cos(angle) * 4, Math.sin(angle) * 4, 6, 0, TAU); context.fill();
    // facing tick
    context.strokeStyle = '#1a1a1a';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
    context.lineTo(Math.cos(angle) * 16, Math.sin(angle) * 16);
    context.stroke();
    if (isPlayer) {
      context.strokeStyle = '#f2c94c';
      context.lineWidth = 2.5;
      context.beginPath(); context.arc(0, 0, 16, 0, TAU); context.stroke();
    }
    if (isRival) {
      context.fillStyle = '#e5534b';
      context.font = 'bold 11px sans-serif';
      context.textAlign = 'center';
      context.fillText('!', 0, -18);
    }
    if (isCop) {
      context.fillStyle = '#dfe9ff';
      context.font = 'bold 9px sans-serif';
      context.textAlign = 'center';
      context.fillText('PD', 0, -16);
    }
    context.restore();
  }

  function drawCity(state) {
    const camX = state.camX; const camY = state.camY;
    const x0 = Math.max(0, camX - 60); const y0 = Math.max(0, camY - 60);
    const x1 = Math.min(WORLD.width, camX + VIEW.width + 60);
    const y1 = Math.min(WORLD.height, camY + VIEW.height + 60);

    // ground
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);
    // blocks
    context.fillStyle = PALETTE.block;
    for (let ix = 0; ix < ROAD_X.length - 1; ix += 1) {
      for (let iy = 0; iy < ROAD_Y.length - 1; iy += 1) {
        context.fillRect(ROAD_X[ix] + ROAD_W / 2, ROAD_Y[iy] + ROAD_W / 2,
          ROAD_X[ix + 1] - ROAD_X[ix] - ROAD_W, ROAD_Y[iy + 1] - ROAD_Y[iy] - ROAD_W);
      }
    }
    // sidewalks + roads
    for (const rx of ROAD_X) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(rx - ROAD_W / 2 - 14, y0, ROAD_W + 28, y1 - y0);
      context.fillStyle = PALETTE.road;
      context.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    }
    for (const ry of ROAD_Y) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(x0, ry - ROAD_W / 2 - 14, x1 - x0, ROAD_W + 28);
      context.fillStyle = PALETTE.road;
      context.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
    }
    // road centre dashes
    context.fillStyle = PALETTE.roadLine;
    for (const rx of ROAD_X) {
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) context.fillRect(rx - 2, y, 4, 22);
    }
    for (const ry of ROAD_Y) {
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) context.fillRect(x, ry - 2, 22, 4);
    }
    // water: the bay along the south edge
    context.fillStyle = PALETTE.water;
    context.fillRect(x0, WORLD.height - 90, x1 - x0, 90);
    context.fillStyle = '#2a6a8f';
    context.fillRect(x0, WORLD.height - 90, x1 - x0, 4);

    // trees
    for (const t of state.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      context.fillStyle = '#6b4a2f';
      context.fillRect(t.x - 2, t.y - 2, 4, 8);
      context.fillStyle = PALETTE.tree;
      context.beginPath(); context.arc(t.x, t.y - 4, 10, 0, TAU); context.fill();
    }
    // lamps
    context.fillStyle = '#d8dee9';
    for (const l of state.lamps) {
      if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
      context.beginPath(); context.arc(l.x, l.y, 3, 0, TAU); context.fill();
    }
    // buildings with roofs + lit windows
    for (const b of state.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.roof;
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      context.fillStyle = PALETTE.window;
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 46));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 3 + b.windows) % 3 === 0) continue;
          context.fillRect(b.x + 14 + c * 46, b.y + 14 + r * 46, 16, 12);
        }
      }
    }
    // mission marker beacon
    const m = MISSIONS[state.missionIndex];
    if (m && !state.storyDone) {
      const mx = state.missionStage === 1 && m.hideout ? m.hideout.x : m.marker.x;
      const my = state.missionStage === 1 && m.hideout ? m.hideout.y : m.marker.y;
      const pulse = 1 + Math.sin(state.elapsed * 4) * 0.15;
      context.strokeStyle = '#f2c94c';
      context.lineWidth = 3;
      context.beginPath(); context.arc(mx, my, 34 * pulse, 0, TAU); context.stroke();
      context.fillStyle = '#f2c94c';
      context.save();
      context.translate(mx, my);
      context.rotate(Math.PI / 4);
      context.fillRect(-9, -9, 18, 18);
      context.restore();
      context.strokeStyle = 'rgba(242,201,76,0.35)';
      context.lineWidth = 10;
      context.beginPath(); context.moveTo(mx, my); context.lineTo(mx, my - 130); context.stroke();
    }
    // pickups
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const bob = Math.sin(pk.bob) * 3;
      if (pk.kind === 'cash' || pk.kind === 'cash-big') {
        context.fillStyle = '#2f9e44';
        context.fillRect(pk.x - 12, pk.y - 8 + bob, 24, 16);
        context.fillStyle = '#ffffff';
        context.font = 'bold 12px sans-serif';
        context.textAlign = 'center';
        context.fillText('$', pk.x, pk.y + 4 + bob);
      } else if (pk.kind === 'health') {
        context.fillStyle = '#ffffff';
        context.fillRect(pk.x - 11, pk.y - 11 + bob, 22, 22);
        context.fillStyle = '#e5534b';
        context.fillRect(pk.x - 3, pk.y - 8 + bob, 6, 16);
        context.fillRect(pk.x - 8, pk.y - 3 + bob, 16, 6);
      } else if (pk.kind === 'ammo') {
        context.fillStyle = '#f2c94c';
        context.fillRect(pk.x - 4, pk.y - 10 + bob, 8, 20);
        context.fillRect(pk.x - 7, pk.y + 6 + bob, 14, 5);
      }
    }
    // parked / player cars
    for (const car of state.cars) {
      if (car.x < x0 - 80 || car.x > x1 + 80 || car.y < y0 - 80 || car.y > y1 + 80) continue;
      drawCar(car.x, car.y, car.angle, car.color, car.isPolice, state.player.inCar === car);
    }
    // traffic
    for (const t of state.traffic) {
      if (t.x < x0 - 80 || t.x > x1 + 80 || t.y < y0 - 80 || t.y > y1 + 80) continue;
      drawCar(t.x, t.y, t.angle, t.color, false, false);
    }
    // police are in state.cars already; draw their pursuit ring
    for (const p of state.police) {
      context.strokeStyle = 'rgba(47,111,208,0.5)';
      context.lineWidth = 2;
      context.beginPath(); context.arc(p.car.x, p.car.y, 34, 0, TAU); context.stroke();
    }
    // pedestrians
    for (const ped of state.peds) {
      if (ped.dead || ped.x < x0 || ped.x > x1 || ped.y < y0 || ped.y > y1) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, false, false, false);
    }
    // rivals
    for (const r of state.rivals) {
      if (!r.alive) continue;
      drawPerson(r.x, r.y, r.angle, '#3a3a3a', false, true, false);
      context.fillStyle = '#e5534b';
      context.fillRect(r.x - 16, r.y - 26, 32, 5);
      context.fillStyle = '#58c96b';
      context.fillRect(r.x - 16, r.y - 26, 32 * Math.max(0, r.health / 60), 5);
    }
    // bullets
    context.fillStyle = '#ffe66d';
    for (const b of state.bullets) {
      context.beginPath(); context.arc(b.x, b.y, 3.5, 0, TAU); context.fill();
    }
    // player on foot
    const pl = state.player;
    if (!pl.inCar) {
      const blink = pl.invulnerable > 0 && Math.floor(pl.invulnerable * 10) % 2 === 0;
      if (!blink) drawPerson(pl.x, pl.y, pl.angle, PALETTE.player, true, false, false);
    }
  }

  function drawHud(state) {
    const pl = state.player;
    const m = MISSIONS[state.missionIndex];
    // top-left panel: health, money, ammo, wanted
    context.fillStyle = PALETTE.hud;
    context.fillRect(12, 12, 300, 96);
    text('ROOK', 24, 36, 18, PALETTE.text, 'left');
    context.fillStyle = '#333a44';
    context.fillRect(24, 46, 180, 12);
    context.fillStyle = pl.health > 40 ? PALETTE.green : PALETTE.red;
    context.fillRect(24, 46, 180 * Math.max(0, pl.health / 100), 12);
    text(`$${pl.money.toLocaleString('en-US')}`, 24, 82, 20, PALETTE.gold, 'left');
    text(`AMMO ${pl.ammo}`, 170, 82, 16, PALETTE.text, 'left');
    text(pl.inCar ? 'IN CAR — E to exit' : 'ON FOOT — E to enter car', 24, 100, 13, PALETTE.muted, 'left');
    // wanted stars
    for (let i = 0; i < 5; i += 1) {
      context.fillStyle = i < state.wanted ? PALETTE.gold : 'rgba(255,255,255,0.18)';
      context.font = '28px sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.fillText('★', 330 + i * 30, 14);
    }
    // objective bar
    context.fillStyle = PALETTE.hud;
    context.fillRect(12, 116, 560, 34);
    const obj = state.storyDone ? 'STORY COMPLETE — you own Sunset Bay!' :
      m ? `MISSION ${m.id + 1}/5 — ${m.title}: ${m.objective}` : '';
    text(obj, 24, 139, 15, PALETTE.text, 'left');
    // message line
    if (state.messageTimer > 0 && state.message) {
      context.fillStyle = 'rgba(10,14,20,0.8)';
      const w = Math.min(900, context.measureText(state.message).width + 32);
      context.fillRect((VIEW.width - w) / 2, VIEW.height - 86, w, 34);
      text(state.message, VIEW.width / 2, VIEW.height - 62, 15, PALETTE.gold, 'center');
    }
    // controls hint
    context.fillStyle = 'rgba(10,14,20,0.65)';
    context.fillRect(12, VIEW.height - 30, 560, 22);
    text('WASD move/drive · E enter car · F punch · SPACE shoot · P pause · M mute', 24, VIEW.height - 16, 13, PALETTE.muted, 'left');
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const mw = 200; const mh = 150;
    const mx = VIEW.width - mw - 12; const my = 12;
    const sx = mw / WORLD.width; const sy = mh / WORLD.height;
    context.fillStyle = PALETTE.minimap;
    context.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    context.fillStyle = '#1d2733';
    context.fillRect(mx, my, mw, mh);
    context.strokeStyle = '#3a4757';
    context.lineWidth = 1;
    for (const rx of ROAD_X) { context.beginPath(); context.moveTo(mx + rx * sx, my); context.lineTo(mx + rx * sx, my + mh); context.stroke(); }
    for (const ry of ROAD_Y) { context.beginPath(); context.moveTo(mx, my + ry * sy); context.lineTo(mx + mw, my + ry * sy); context.stroke(); }
    const m = MISSIONS[state.missionIndex];
    if (m && !state.storyDone) {
      const tx = state.missionStage === 1 && m.hideout ? m.hideout.x : m.marker.x;
      const ty = state.missionStage === 1 && m.hideout ? m.hideout.y : m.marker.y;
      context.fillStyle = PALETTE.gold;
      context.beginPath(); context.arc(mx + tx * sx, my + ty * sy, 5, 0, TAU); context.fill();
    }
    context.fillStyle = '#2f6fd0';
    for (const p of state.police) {
      context.beginPath(); context.arc(mx + p.car.x * sx, my + p.car.y * sy, 3.5, 0, TAU); context.fill();
    }
    context.fillStyle = '#f2c94c';
    context.beginPath(); context.arc(mx + state.player.x * sx, my + state.player.y * sy, 4.5, 0, TAU); context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1.5;
    context.beginPath(); context.arc(mx + state.player.x * sx, my + state.player.y * sy, 6.5, 0, TAU); context.stroke();
    text('SUNSET BAY', mx, my + mh + 16, 11, PALETTE.muted, 'left');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 680;
    const lineH = 30;
    const height = 150 + lines.length * lineH + 70;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(8, 10, 16, 0.88)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 72, 46, accent || PALETTE.gold, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 130 + i * lineH, 19, PALETTE.text, 'center');
    }
    if (prompt) text(prompt, VIEW.width / 2, y + height - 34, 20, PALETTE.gold, 'center');
  }

  function drawTitle(state, hasSave) {
    // live city backdrop, dimmed
    drawWorldFrame(state);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.fillStyle = 'rgba(6, 8, 14, 0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('SUNSET BAY', VIEW.width / 2, 150, 84, PALETTE.gold, 'center');
    text('A top-down open-world crime story — an original game, no Rockstar IP', VIEW.width / 2, 196, 20, PALETTE.text, 'center');
    const lines = [
      'Steal cars. Outrun the police. Run five missions for Marla.',
      'WASD / arrows — move & drive · E — enter / steal car · F — punch',
      'SPACE — shoot pistol · P — pause · M — mute',
      '',
      hasSave ? 'A saved game was found — press C to CONTINUE your story.' : 'New story: Rook arrives in Sunset Bay with $0 and a debt to pay.',
    ];
    drawPanelLines(lines, hasSave);
  }

  function drawPanelLines(lines, hasSave) {
    const width = 720;
    const height = 120 + lines.length * 30 + 84;
    const x = (VIEW.width - width) / 2;
    const y = 250;
    context.fillStyle = 'rgba(8, 10, 16, 0.85)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 44 + i * 30, 18, i === 4 && hasSave ? PALETTE.gold : PALETTE.text, 'center');
    }
    text('Press ENTER or click to start', VIEW.width / 2, y + height - 26, 20, PALETTE.gold, 'center');
  }

  function drawWorldFrame(state) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = view.scale;
    context.setTransform(scale, 0, 0, scale, view.x - state.camX * scale, view.y - state.camY * scale);
    drawCity(state);
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, info) {
    info = info || {};
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = view.scale;
    if (screen === SCREEN_TITLE) {
      drawTitle(state, !!info.hasSave);
      return;
    }
    context.setTransform(scale, 0, 0, scale, view.x - state.camX * scale, view.y - state.camY * scale);
    drawCity(state);
    // back to view space for HUD / panels
    context.setTransform(scale, 0, 0, scale, view.x, view.y);
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(6,8,14,0.5)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('PAUSED', ['The city waits for you, Rook.', `Mission ${state.missionIndex + 1}/5 — ${MISSIONS[state.missionIndex] ? MISSIONS[state.missionIndex].title : 'done'}`], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const kind = state.endKind || 'busted';
      const title = kind === 'wasted' ? 'WASTED' : 'BUSTED';
      const lines = [
        kind === 'wasted' ? 'Rook went down in the streets of Sunset Bay.' : 'The Sunset Bay PD caught up with Rook.',
        `Money kept: $${state.player.money.toLocaleString('en-US')} · Missions done: ${state.missionIndex}/5 · Cars stolen: ${state.carsStolen}`,
        state.storyDone ? 'You finished the story — this run still counts.' : 'Your story is saved. Press C on the title screen to continue it.',
      ];
      drawPanel(title, lines, 'Press ENTER to play again', PALETTE.red);
    } else if (screen === SCREEN_WIN) {
      const lines = [
        'All five missions done. Marla pays out the last envelope.',
        `Total cash earned: $${state.cashEarned.toLocaleString('en-US')} · Cars stolen: ${state.carsStolen} · KOs: ${state.kills}`,
        'Sunset Bay is yours now, Rook.',
      ];
      drawPanel('STORY COMPLETE', lines, 'Press ENTER to keep playing the city', PALETTE.green);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
