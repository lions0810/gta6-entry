// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between title, play, paused, busted/wasted and story-complete screens.
//
// ?seed=N fixes the city layout. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
// Progress (money + mission) autosaves to localStorage; the title screen offers Continue (C).
import { MISSIONS, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_MISSION, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOOT, EVENT_STORY_DONE, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
// Test/debug hook: the live world state, for automated playtests.
window.__sunset = world;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: world.state.player.money,
      missionIndex: world.state.missionIndex,
      cashEarned: world.state.cashEarned,
      carsStolen: world.state.carsStolen,
      kills: world.state.kills,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { hasSave: scene.hasSave });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let hasSave = !!(save && save.missionIndex > 0);
  let accumulator = 0;
  let last = performance.now();
  let muted = false;
  let saveTimer = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(continueSave) {
    world.reset();
    if (continueSave && save) {
      world.applySave(save);
      announce(`Continuing. Mission ${save.missionIndex + 1} of 5.`);
    } else {
      announce('Playing. Steal a car and head for the docks.');
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
  }

  function endGame() {
    screen = SCREEN_OVER;
    writeSave();
    audio.busted();
    announce(world.state.endKind === 'wasted' ? 'Wasted.' : 'Busted.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_MISSION) { audio.mission(); writeSave(); }
    if (events & EVENT_STORY_DONE) screen = SCREEN_WIN;
    if (events & (EVENT_BUSTED | EVENT_WASTED)) endGame();
  }

  function step() {
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return;
    }
    if (screen === SCREEN_TITLE) {
      // C continues a saved story; Enter/click starts fresh.
      if (actions & ACTION_CONFIRM) startGame(false);
      world.step(STEP, { move() { return { x: 0, y: 0 }; } }, 0);
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame(false);
      return;
    }
    const events = world.step(STEP, input, actions);
    if (world.state.wanted > 0) audio.siren(STEP);
    saveTimer += STEP;
    if (saveTimer > 10) { saveTimer = 0; writeSave(); }
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // M toggles mute, C continues from the title screen — checked outside the action queue.
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      // (keys are handled in step() via the action queue; M/C are polled here)
    }
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen === SCREEN_PAUSED || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      // still let pause/confirm keys through on non-playing screens
      const actions = input.takeActions();
      if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if ((screen === SCREEN_OVER || screen === SCREEN_WIN) && (actions & ACTION_CONFIRM)) {
        startGame(false);
      }
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { hasSave });
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && !event.repeat) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (event.code === 'KeyC' && !event.repeat && screen === SCREEN_TITLE && hasSave) {
      audio.unlock();
      startGame(true);
    }
    if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat) audio.unlock();
  });
  canvas.addEventListener('pointerdown', () => audio.unlock());

  // Leaving the tab pauses a running game rather than letting the cops close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sunset Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
