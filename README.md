# ShiftCube

A fast, neon-arcade **3D browser survival game**. You stand on a giant floating
Rubik's-cube arena that keeps twisting itself apart. Tiles glow **yellow → red**
to warn you a layer is about to rotate — step off, or get carried over the edge.
Neon cannons fire homing-aimed cannonballs to knock you off. Survive as long as
you can.

Built for the MVP scope in `../shiftcube_game_prompt.md`.

## Stack

- **TypeScript + Three.js + Vite**
- Custom kinematic physics (chosen over Rapier for the MVP so the
  "player carried by a rotating cube layer" mechanic stays deterministic and
  rock-solid — see *Notes* below for where Rapier slots in).
- Zero art/audio assets: cube + player are procedural neon meshes, all sound is
  a tiny WebAudio synth.

## Run it

```bash
cd shiftcube
npm install
npm run dev      # open the printed http://localhost:5173 URL
```

Production build / preview:

```bash
npm run build    # typechecks (tsc) then bundles to dist/
npm run preview
```

The build is fully static (`base: "./"`) — drop `dist/` on GitHub Pages,
Netlify, or Vercel.

## Controls

| Key | Action |
|---|---|
| **WASD** | Move (camera-relative) |
| **Mouse** | Orbit camera — **click the arena once to lock the pointer** |
| **Space** | Jump (with coyote-time + jump-buffering) |
| **Shift** | Dash (cooldown, leaves a neon trail) |
| **R** | Restart |
| **Esc / P** | Pause (or use the ❙❙ button) |

## What's implemented (MVP)

- 3D neon scene: starfield, fog, colored point lights, camera shake.
- 3×3×3 cubelet arena that scrambles Rubik-style.
- 9 surface "danger tiles" with the green/yellow/red warning language.
- Layer-rotation cube event with full warning telegraph + **player gets carried
  off if they're standing on a shifting tile**.
- Player movement: acceleration/friction, air control, jump buffering, coyote
  time, dash + cooldown + trail, knockback.
- Third-person orbit camera that follows, smooths, shakes on hit, and zooms out
  during big rotations.
- Floating cannons that lead-aim and fire trailed cannonballs; hits knock you
  back, near-misses score points.
- Difficulty ramp over ~75s (shorter warnings, faster rotations, faster/more
  frequent shots).
- Full UI flow: main menu, how-to, `3·2·1·GO!` countdown, in-game HUD (timer,
  score, best, dash meter, warning banner), pause menu, game-over screen.
- Scoring per the prompt's formula, best score saved to `localStorage`.
- Arcade WebAudio SFX for every game event.

## Project layout

```
src/
  main.ts              # entry
  style.css            # neon arcade UI
  game/
    Game.ts            # orchestrator: states, loop, scoring, difficulty
    config.ts          # geometry + tuning constants
    Input.ts           # keyboard + pointer-lock mouse
    CubeArena.ts       # cubelets, danger tiles, rotation events
    Player.ts          # kinematic movement, jump/dash, carry, trail
    CameraController.ts # third-person orbit + shake + zoom
    Hazards.ts         # cannons + projectiles + knockback
    Audio.ts           # WebAudio synth
    UI.ts              # DOM screens + HUD + localStorage best
```

## Notes / next steps

- **Rapier swap-in:** the prompt recommends Rapier.js. The clean integration
  point is `Player.update()` (replace the kinematic integrator with a Rapier
  kinematic character controller) and `CubeArena` (drive cubelet colliders as
  kinematic bodies during a slice rotation). The current code keeps physics in
  one place precisely so this is a contained change.
- Not yet in this MVP (all listed in the prompt as future work): ice/conveyor/
  lava/crumble tiles, homing orbs, lasers, meteors, blades, power-ups, extra
  game modes, music. The systems are structured to extend — e.g. `TileState`
  and `HazardManager` are the hooks.
