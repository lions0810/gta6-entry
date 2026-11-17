# Sunset Bay — a top-down 2D open-world crime game

An original open-world crime game for the make.fun bounty gta6-01. No Rockstar IP:
the city, characters, vehicles, story, art and sound are all original. Plain static
files (ES modules + canvas), no network requests, no external assets — all art is
drawn in code and all sound is synthesized with WebAudio.

## The story

You are **Rook**, fresh in **Sunset Bay** with $0 and a debt to pay. Your fixer
**Marla** runs you through five missions:

1. **Wheels Up** — steal any car and drive it to the docks ($500)
2. **The Drop** — pick up a package on Coral Row ($800)
3. **Hot Pursuit** — lose a 2-star wanted level, then lay low at the hideout ($1,200)
4. **Settle the Score** — take out all three of Vic's crew at the old depot ($2,000)
5. **The Big Score** — grab the bank courier cash at the plaza and vanish ($5,000)

Finish all five and the story completes — but the city stays open to drive in.

## Systems

- **City** — a 3200×2400 road grid with blocks, buildings (collision), sidewalks,
  trees, lamps and a bay along the south edge.
- **On foot & by car** — walk up to any car, press E to enter (drag the driver out
  of occupied ones), driving physics with acceleration, braking and steering; E
  again to exit.
- **Traffic** — AI cars drive the road network, turn at intersections and stop for
  the car ahead.
- **Pedestrians** — walk the sidewalks and flee from gunfire and danger.
- **Wanted level** — crimes (car theft, assault, shooting, running people over)
  raise up to 5 stars; it decays when you lay low. Police cruisers spawn, pursue
  and ram; get caught on foot and you are **BUSTED**, go down and you are **WASTED**.
- **Combat** — melee punch (F) plus a pistol (SPACE) with ammo, health and cash
  pickups scattered around the city.
- **HUD & minimap** — health, money, ammo, wanted stars, current objective, and a
  live minimap showing you, the mission marker and police.
- **Screens & save** — title screen, pause, busted/wasted, story-complete and
  restart. Money and mission progress autosave to localStorage; press **C** on the
  title screen to continue a saved story.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive (W/S = gas/brake, A/D = steer) |
| E | Enter / steal car, exit car, interact with mission pickups |
| F | Punch |
| SPACE | Shoot pistol |
| P / Esc | Pause |
| M | Mute |
| C | Continue saved story (title screen) |
| ENTER / click | Start / restart |

## Screenshots

`?shot=start&seed=1`, `?shot=play&seed=1` and `?shot=end&seed=1` stage the title,
a mid-action scene and the busted screen deterministically (same seed, same frame).

## Run it

```
node serve.ts            # http://localhost:8080
MAKEFUN_OUTPUT_DIR=out node main.ts   # build the submission dossier
```

## Files

- `game/index.html` + `game/src/` — the game: `config.js` (tuning, missions),
  `world.js` (city, traffic, police, combat, missions), `render.js` (canvas, HUD,
  minimap), `main.js` (loop, screens, save), `input.js`, `audio.js`, `random.js`,
  `shots.js` (screenshot staging).
- `shots.json` — the three judge screenshots and their queries.
