# Wa-Tor Predator-Prey Simulation — Design

**Date:** 2026-06-10
**Status:** Approved

## Purpose

A client-side-only Wa-Tor predator-prey simulation that serves as the demo
subject for a git-worktrees micro workshop. Students spin it up on multiple
worktrees, edit different parts on different branches, and merge. To be good
"worktree fodder" the site must:

- Run with **zero build step** — just serve the folder (`python -m http.server`),
  so each worktree runs on its own port.
- Make changes **instantly visible** so a student sees their worktree differs
  from main.
- Be **cleanly modular** so two worktrees can edit different modules without
  conflict, with one orchestrator file as a natural intentional-conflict point.
- Be **more than Hello World** — genuinely interesting to watch and tune, in the
  user's simulation/dynamics wheelhouse (watch boom-bust and chaos emerge).

This first pass is the "just get it running" version: core sim + canvas +
basic controls. Population charts, presets, themes, and an ODE view are left as
future worktree features.

## Architecture

Vanilla HTML/CSS/JS with **ES modules** — no dependencies, no build. Served via
any static file server.

```
index.html        — page shell, canvas, control panel markup
style.css         — layout + theming
src/
  simulation.js   — Wa-Tor rules engine (pure logic, no DOM)
  renderer.js     — draws the grid to <canvas>
  controls.js     — reads UI inputs, emits config + play/pause/reset events
  main.js         — wires sim + renderer + controls, runs the tick loop
test/
  simulation.test.js — Node-runnable tests for the rules engine
```

### Module boundaries (the key workshop property)

- **`simulation.js`** — owns the grid and rules. Exports a `Simulation` class:
  - `new Simulation(config)` — builds and seeds the grid.
  - `.step()` — advances exactly one tick.
  - `.grid` — the current grid state (for the renderer to read).
  - `.counts` — `{ fish, sharks, tick }` readout.
  - Zero DOM knowledge → unit-testable in isolation in Node.
- **`renderer.js`** — owns the canvas. Exports a `Renderer` class with
  `.draw(grid)`. Knows nothing about rules.
- **`controls.js`** — owns the DOM input panel. Exports a setup function that
  wires inputs and invokes callbacks: `onConfigChange`, `onPlayPause`,
  `onReset`, `onSpeedChange`, `onStep`. Knows nothing about rules or canvas.
- **`main.js`** — the orchestrator. Creates the sim/renderer, wires control
  callbacks, runs the tick loop. **Natural intentional-conflict point** for the
  merge demo.

Each leaf module is an isolated edit target: two worktrees can edit
`simulation.js` and `renderer.js` with no conflict. Overlapping edits to
`main.js` collide on purpose.

## The Model (Wa-Tor rules)

Toroidal grid (edges wrap on all four sides). Each tick, every creature acts
once, in shuffled order to avoid directional bias.

- **Fish**: move to a random adjacent empty cell (von Neumann neighborhood: N/E/S/W).
  If no empty neighbor, stay put. After surviving `fishBreed` ticks, when it
  moves it spawns a baby in the vacated cell and its breed timer resets.
- **Shark**: prefer moving onto a random adjacent cell containing a fish — eat it
  and gain `sharkEnergyGain` energy. Otherwise move to a random adjacent empty
  cell. Lose 1 energy each tick; if energy reaches 0, the shark dies and the cell
  becomes empty. After surviving `sharkBreed` ticks, when it moves it spawns a
  baby in the vacated cell and its breed timer resets.

### Tunable config (with defaults)

| Param              | Default | Meaning                                  |
|--------------------|---------|------------------------------------------|
| `width`            | 100     | grid columns                             |
| `height`           | 60      | grid rows                                |
| `cellSize`         | 6       | pixels per cell (canvas = 600×360)       |
| `initialFish`      | 400     | seeded fish count                        |
| `initialSharks`    | 80      | seeded shark count                       |
| `fishBreed`        | 3       | ticks a fish must survive to breed       |
| `sharkBreed`       | 10      | ticks a shark must survive to breed      |
| `sharkStartEnergy` | 5       | energy a new shark / seed shark starts with |
| `sharkEnergyGain`  | 4       | energy gained per fish eaten             |

These are exactly the knobs students tune toward boom-bust/chaos.

## Rendering

Canvas grid, one filled rect per cell:

- empty = dark background
- fish = blue
- shark = red

Canvas sized `width*cellSize × height*cellSize` (default 600×360). Full redraw
each tick (cheap at this size).

## Controls (first-pass UI)

- **Play/Pause** toggle
- **Step** — advance exactly one tick
- **Reset** — rebuild the sim from current config inputs
- **Speed** slider — target ticks per second
- **Number inputs** for the config params above; changes apply on the next
  **Reset** (the sim is not resized live).
- **Live readout** — current fish count, shark count, and tick number.

## Tick Loop & Error Handling

`main.js` runs the loop with `requestAnimationFrame`, advancing the sim when
enough wall-clock time has elapsed for the target speed, gated by play state.
`Step` calls `.step()` once directly.

Defensive behavior:

- If a population hits zero, the sim keeps running — the other population may
  recover or flatline. No crash; this *is* the dynamics to observe.
- Bad/empty/out-of-range input values fall back to sane defaults on Reset
  (e.g. non-positive grid dimensions, NaN).
- Seeding never places more creatures than there are cells; counts are clamped
  to grid capacity.

## Testing

`simulation.js` is pure logic and gets **Node-runnable tests**
(`test/simulation.test.js`, ES module imports, run via `node`). Invariants:

- Counts never go negative; fish + sharks ≤ grid capacity at all times.
- A lone fish on an otherwise empty grid breeds exactly on schedule
  (`fishBreed` ticks) and never dies.
- A shark with no reachable fish loses 1 energy/tick and dies when energy
  reaches 0.
- A shark adjacent to a fish eats it (fish count drops, shark energy rises).
- `.step()` is deterministic given a seeded RNG (the sim takes an injectable
  RNG so tests are reproducible).

Renderer and controls are thin DOM wrappers, verified by running the page.

### RNG note

`Simulation` accepts an optional `rng` (defaults to `Math.random`) so tests can
inject a seeded generator for deterministic assertions.

## Out of Scope (future worktree features)

- Live population time-series chart
- Parameter presets (stable / oscillating / chaotic)
- Color themes
- ODE / Lotka-Volterra alternate view
- Agent inspection / click-to-place

## Workshop Fit Summary

- **No build** → `python -m http.server <port>` per worktree.
- **Visible diffs** → recolor sharks, change rules, retune defaults — all
  obvious on screen.
- **Parallel-friendly** → leaf modules edited independently.
- **Intentional conflicts** → `main.js` and `style.css` as collision points.
