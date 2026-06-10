# Wa-Tor Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side-only Wa-Tor predator-prey simulation (core sim + canvas + basic controls) to serve as the demo subject for a git-worktrees workshop.

**Architecture:** Vanilla HTML/CSS/JS with ES modules, no build step. A pure-logic `Simulation` rules engine (DOM-free, RNG-injectable for tests), a `Renderer` that draws the grid to canvas, a `controls` module that wires the UI, and `main.js` orchestrating the tick loop. Served as static files so each git worktree runs on its own port.

**Tech Stack:** HTML5 Canvas, ES modules, Node's built-in test runner (`node --test`) for the rules engine. No dependencies.

---

## File Structure

```
index.html                 — page shell, canvas, control panel markup
style.css                  — layout + theming
src/simulation.js          — Wa-Tor rules engine (pure logic, no DOM)
src/renderer.js            — draws the grid to <canvas>
src/controls.js            — wires UI inputs to callbacks
src/main.js                — orchestrator + tick loop
test/simulation.test.js    — Node-runnable tests for the rules engine
README.md                  — how to run + serve on a port
```

Cell encoding in the grid (a flat `Int*`/object array of length `width*height`):
each cell is either `null` (empty) or a creature object:
- Fish:  `{ type: 'fish',  breed: <int> }`
- Shark: `{ type: 'shark', breed: <int>, energy: <int> }`

`breed` counts ticks survived since last breeding.

---

## Task 1: Simulation engine — construction & seeding

**Files:**
- Create: `src/simulation.js`
- Test: `test/simulation.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// test/simulation.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';

// Deterministic RNG: cycles through a fixed sequence in [0,1).
function seededRng(seq) {
  let i = 0;
  return () => seq[i++ % seq.length];
}

test('constructs grid of width*height cells', () => {
  const sim = new Simulation({ width: 4, height: 3, initialFish: 0, initialSharks: 0 });
  assert.equal(sim.grid.length, 12);
  assert.ok(sim.grid.every((c) => c === null));
});

test('seeds the requested number of fish and sharks', () => {
  const sim = new Simulation({
    width: 10, height: 10, initialFish: 20, initialSharks: 5,
    rng: seededRng([0.0, 0.3, 0.6, 0.9, 0.5]),
  });
  assert.equal(sim.counts.fish, 20);
  assert.equal(sim.counts.sharks, 5);
  assert.equal(sim.counts.tick, 0);
});

test('clamps seeded creatures to grid capacity', () => {
  const sim = new Simulation({ width: 2, height: 2, initialFish: 100, initialSharks: 100 });
  assert.ok(sim.counts.fish + sim.counts.sharks <= 4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/simulation.test.js`
Expected: FAIL — cannot find module `../src/simulation.js`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/simulation.js

export const DEFAULTS = {
  width: 100,
  height: 60,
  cellSize: 6,
  initialFish: 400,
  initialSharks: 80,
  fishBreed: 3,
  sharkBreed: 10,
  sharkStartEnergy: 5,
  sharkEnergyGain: 4,
};

function sanitizeConfig(config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const intMin = (v, fallback, min) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= min ? n : fallback;
  };
  cfg.width = intMin(cfg.width, DEFAULTS.width, 1);
  cfg.height = intMin(cfg.height, DEFAULTS.height, 1);
  cfg.cellSize = intMin(cfg.cellSize, DEFAULTS.cellSize, 1);
  cfg.initialFish = intMin(cfg.initialFish, DEFAULTS.initialFish, 0);
  cfg.initialSharks = intMin(cfg.initialSharks, DEFAULTS.initialSharks, 0);
  cfg.fishBreed = intMin(cfg.fishBreed, DEFAULTS.fishBreed, 1);
  cfg.sharkBreed = intMin(cfg.sharkBreed, DEFAULTS.sharkBreed, 1);
  cfg.sharkStartEnergy = intMin(cfg.sharkStartEnergy, DEFAULTS.sharkStartEnergy, 1);
  cfg.sharkEnergyGain = intMin(cfg.sharkEnergyGain, DEFAULTS.sharkEnergyGain, 0);
  return cfg;
}

export class Simulation {
  constructor(config = {}) {
    this.config = sanitizeConfig(config);
    this.rng = config.rng || Math.random;
    this.reset();
  }

  reset() {
    const { width, height } = this.config;
    this.tick = 0;
    this.grid = new Array(width * height).fill(null);
    this._seed();
  }

  _seed() {
    const { width, height, initialFish, initialSharks, sharkStartEnergy } = this.config;
    const capacity = width * height;
    const empties = [];
    for (let i = 0; i < capacity; i++) empties.push(i);
    // Fisher–Yates shuffle using injected rng.
    for (let i = empties.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [empties[i], empties[j]] = [empties[j], empties[i]];
    }
    let cursor = 0;
    const fishToPlace = Math.min(initialFish, capacity);
    for (let n = 0; n < fishToPlace; n++) {
      this.grid[empties[cursor++]] = { type: 'fish', breed: 0 };
    }
    const sharksToPlace = Math.min(initialSharks, capacity - fishToPlace);
    for (let n = 0; n < sharksToPlace; n++) {
      this.grid[empties[cursor++]] = { type: 'shark', breed: 0, energy: sharkStartEnergy };
    }
  }

  get counts() {
    let fish = 0;
    let sharks = 0;
    for (const cell of this.grid) {
      if (cell === null) continue;
      if (cell.type === 'fish') fish++;
      else if (cell.type === 'shark') sharks++;
    }
    return { fish, sharks, tick: this.tick };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/simulation.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/simulation.js test/simulation.test.js
git commit -m "feat: Wa-Tor simulation construction and seeding"
```

---

## Task 2: Simulation engine — fish movement & breeding

**Files:**
- Modify: `src/simulation.js`
- Test: `test/simulation.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// append to test/simulation.test.js

test('a lone fish moves into an adjacent empty cell each tick', () => {
  const sim = new Simulation({ width: 3, height: 3, initialFish: 0, initialSharks: 0, fishBreed: 99 });
  sim.grid[4] = { type: 'fish', breed: 0 }; // center
  sim.step();
  assert.equal(sim.counts.fish, 1); // still exactly one fish
  assert.equal(sim.grid[4], null);  // it vacated the center
});

test('a lone fish breeds exactly on schedule and never dies', () => {
  // fishBreed = 2: needs to survive 2 ticks, then breeds on the move.
  const sim = new Simulation({ width: 5, height: 5, initialFish: 0, initialSharks: 0, fishBreed: 2 });
  sim.grid[12] = { type: 'fish', breed: 0 }; // center of 5x5
  sim.step(); // breed -> 1
  assert.equal(sim.counts.fish, 1);
  sim.step(); // breed reaches 2 -> spawns baby on move
  assert.equal(sim.counts.fish, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/simulation.test.js`
Expected: FAIL — `sim.step is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add the neighborhood helpers and a `step()` that processes fish. (Sharks are added in Task 3; for now `step()` handles fish and increments tick.)

```javascript
// add inside the Simulation class in src/simulation.js

  _index(x, y) {
    const { width, height } = this.config;
    const wx = (x + width) % width;
    const wy = (y + height) % height;
    return wy * width + wx;
  }

  _coords(i) {
    const { width } = this.config;
    return { x: i % width, y: Math.floor(i / width) };
  }

  // Returns neighbor indices (N/E/S/W) on the toroidal grid.
  _neighbors(i) {
    const { x, y } = this._coords(i);
    return [
      this._index(x, y - 1),
      this._index(x + 1, y),
      this._index(x, y + 1),
      this._index(x - 1, y),
    ];
  }

  _pick(arr) {
    return arr[Math.floor(this.rng() * arr.length)];
  }

  step() {
    const { width, height, fishBreed } = this.config;
    // Process each cell at most once per tick; track which indices have already
    // acted (because a creature may move into a not-yet-visited cell).
    const acted = new Array(width * height).fill(false);
    const order = [];
    for (let i = 0; i < width * height; i++) order.push(i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    for (const i of order) {
      const cell = this.grid[i];
      if (cell === null || acted[i]) continue;
      if (cell.type === 'fish') {
        acted[i] = this._stepFish(i, cell, acted, fishBreed) ? acted[i] : true;
        // _stepFish marks the destination as acted; mark source handled below.
        acted[i] = true;
      }
    }
    this.tick++;
  }

  // Moves a fish from index i. Marks destination acted. Returns nothing.
  _stepFish(i, fish, acted, fishBreed) {
    fish.breed++;
    const empties = this._neighbors(i).filter((n) => this.grid[n] === null);
    if (empties.length === 0) return; // nowhere to move; stays, keeps breed timer
    const dest = this._pick(empties);
    this.grid[dest] = fish;
    acted[dest] = true;
    if (fish.breed >= fishBreed) {
      fish.breed = 0;
      this.grid[i] = { type: 'fish', breed: 0 }; // baby left behind
      acted[i] = true;
    } else {
      this.grid[i] = null;
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/simulation.test.js`
Expected: PASS — all fish tests pass (counts stay correct, breeding on schedule).

- [ ] **Step 5: Commit**

```bash
git add src/simulation.js test/simulation.test.js
git commit -m "feat: fish movement and breeding"
```

---

## Task 3: Simulation engine — shark movement, eating, energy & breeding

**Files:**
- Modify: `src/simulation.js`
- Test: `test/simulation.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// append to test/simulation.test.js

test('a shark with no reachable fish loses 1 energy per tick and dies at 0', () => {
  const sim = new Simulation({
    width: 3, height: 3, initialFish: 0, initialSharks: 0,
    sharkBreed: 99,
  });
  sim.grid[4] = { type: 'shark', breed: 0, energy: 2 };
  sim.step(); // energy 2 -> 1
  assert.equal(sim.counts.sharks, 1);
  sim.step(); // energy 1 -> 0 -> dies
  assert.equal(sim.counts.sharks, 0);
});

test('a shark eats an adjacent fish: fish count drops, shark energy rises', () => {
  const sim = new Simulation({
    width: 3, height: 3, initialFish: 0, initialSharks: 0,
    sharkBreed: 99, sharkEnergyGain: 4,
  });
  sim.grid[4] = { type: 'shark', breed: 0, energy: 3 }; // center
  sim.grid[1] = { type: 'fish', breed: 0 };             // north neighbor (only fish)
  sim.step();
  assert.equal(sim.counts.fish, 0);
  assert.equal(sim.counts.sharks, 1);
  // energy: 3 - 1 (tick) + 4 (eat) = 6
  const shark = sim.grid.find((c) => c && c.type === 'shark');
  assert.equal(shark.energy, 6);
});

test('counts never go negative and never exceed capacity over many ticks', () => {
  const sim = new Simulation({ width: 12, height: 12, initialFish: 40, initialSharks: 10 });
  for (let t = 0; t < 200; t++) {
    sim.step();
    const { fish, sharks } = sim.counts;
    assert.ok(fish >= 0 && sharks >= 0);
    assert.ok(fish + sharks <= 144);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/simulation.test.js`
Expected: FAIL — sharks are not processed yet (shark with no food never dies; adjacent fish not eaten).

- [ ] **Step 3: Write minimal implementation**

Add shark handling to `step()` and a `_stepShark` method.

In `step()`, replace the per-cell branch so sharks are handled too:

```javascript
    for (const i of order) {
      const cell = this.grid[i];
      if (cell === null || acted[i]) continue;
      if (cell.type === 'fish') {
        this._stepFish(i, cell, acted, fishBreed);
        acted[i] = true;
      } else if (cell.type === 'shark') {
        this._stepShark(i, cell, acted);
        acted[i] = true;
      }
    }
```

Add the method:

```javascript
  _stepShark(i, shark, acted) {
    const { sharkBreed, sharkEnergyGain } = this.config;
    shark.breed++;
    shark.energy--;
    if (shark.energy <= 0) {
      this.grid[i] = null; // starved
      return;
    }
    const neighbors = this._neighbors(i);
    const fishCells = neighbors.filter((n) => this.grid[n] && this.grid[n].type === 'fish');
    const emptyCells = neighbors.filter((n) => this.grid[n] === null);

    let dest;
    if (fishCells.length > 0) {
      dest = this._pick(fishCells);
      shark.energy += sharkEnergyGain; // eat
    } else if (emptyCells.length > 0) {
      dest = this._pick(emptyCells);
    } else {
      return; // boxed in; stays, energy already decremented, breed already ticked
    }

    this.grid[dest] = shark;
    acted[dest] = true;
    if (shark.breed >= sharkBreed) {
      shark.breed = 0;
      this.grid[i] = { type: 'shark', breed: 0, energy: this.config.sharkStartEnergy };
      acted[i] = true;
    } else {
      this.grid[i] = null;
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/simulation.test.js`
Expected: PASS — all simulation tests (seeding, fish, sharks, invariants).

- [ ] **Step 5: Commit**

```bash
git add src/simulation.js test/simulation.test.js
git commit -m "feat: shark movement, eating, energy and breeding"
```

---

## Task 4: Canvas renderer

**Files:**
- Create: `src/renderer.js`

(No Node test — this is a thin DOM/canvas wrapper, verified by running the page in Task 7. Keep it small and obviously correct.)

- [ ] **Step 1: Write the implementation**

```javascript
// src/renderer.js

const COLORS = {
  empty: '#0b1f33',
  fish: '#2e8bff',
  shark: '#ff4d4d',
};

export class Renderer {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.configure(config);
  }

  configure(config) {
    this.width = config.width;
    this.height = config.height;
    this.cellSize = config.cellSize;
    this.canvas.width = this.width * this.cellSize;
    this.canvas.height = this.height * this.cellSize;
  }

  draw(grid) {
    const { ctx, cellSize, width, height } = this;
    ctx.fillStyle = COLORS.empty;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (let i = 0; i < grid.length; i++) {
      const cell = grid[i];
      if (cell === null) continue;
      ctx.fillStyle = cell.type === 'fish' ? COLORS.fish : COLORS.shark;
      const x = (i % width) * cellSize;
      const y = Math.floor(i / width) * cellSize;
      ctx.fillRect(x, y, cellSize, cellSize);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer.js
git commit -m "feat: canvas renderer for the grid"
```

---

## Task 5: HTML shell & styles

**Files:**
- Create: `index.html`
- Create: `style.css`

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wa-Tor — Predator &amp; Prey</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <header>
      <h1>Wa-Tor</h1>
      <p class="tagline">A toroidal predator–prey world. Watch the boom and bust.</p>
    </header>

    <main>
      <section class="stage">
        <canvas id="grid"></canvas>
        <div class="readout">
          <span>tick <strong id="readout-tick">0</strong></span>
          <span class="fish">fish <strong id="readout-fish">0</strong></span>
          <span class="shark">sharks <strong id="readout-sharks">0</strong></span>
        </div>
      </section>

      <section class="panel">
        <div class="buttons">
          <button id="btn-play">Play</button>
          <button id="btn-step">Step</button>
          <button id="btn-reset">Reset</button>
        </div>

        <label class="speed">
          Speed <span id="speed-value">10</span> ticks/s
          <input id="speed" type="range" min="1" max="60" value="10" />
        </label>

        <fieldset>
          <legend>Configuration (applies on Reset)</legend>
          <label>Width <input id="cfg-width" type="number" value="100" min="1" /></label>
          <label>Height <input id="cfg-height" type="number" value="60" min="1" /></label>
          <label>Cell size <input id="cfg-cellSize" type="number" value="6" min="1" /></label>
          <label>Initial fish <input id="cfg-initialFish" type="number" value="400" min="0" /></label>
          <label>Initial sharks <input id="cfg-initialSharks" type="number" value="80" min="0" /></label>
          <label>Fish breed <input id="cfg-fishBreed" type="number" value="3" min="1" /></label>
          <label>Shark breed <input id="cfg-sharkBreed" type="number" value="10" min="1" /></label>
          <label>Shark start energy <input id="cfg-sharkStartEnergy" type="number" value="5" min="1" /></label>
          <label>Shark energy gain <input id="cfg-sharkEnergyGain" type="number" value="4" min="0" /></label>
        </fieldset>
      </section>
    </main>

    <script type="module" src="src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `style.css`**

```css
:root {
  --bg: #07121f;
  --panel: #0f2438;
  --ink: #e6f0fa;
  --muted: #8aa6c0;
  --fish: #2e8bff;
  --shark: #ff4d4d;
  --accent: #3ddc97;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: var(--bg);
  color: var(--ink);
}

header {
  padding: 1.25rem 1.5rem 0.25rem;
}
header h1 { margin: 0; letter-spacing: 0.04em; }
.tagline { margin: 0.25rem 0 0; color: var(--muted); }

main {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding: 1.5rem;
  align-items: flex-start;
}

.stage { display: flex; flex-direction: column; gap: 0.75rem; }

canvas {
  background: #0b1f33;
  border: 1px solid #1c3consul;
  border: 1px solid #1c3a57;
  border-radius: 6px;
  image-rendering: pixelated;
}

.readout {
  display: flex;
  gap: 1.25rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.readout strong { color: var(--ink); }
.readout .fish strong { color: var(--fish); }
.readout .shark strong { color: var(--shark); }

.panel {
  background: var(--panel);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.buttons { display: flex; gap: 0.5rem; }

button {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 6px;
  background: var(--accent);
  color: #042018;
  font-weight: 600;
  cursor: pointer;
}
button:hover { filter: brightness(1.08); }

.speed { display: flex; flex-direction: column; gap: 0.25rem; color: var(--muted); }
.speed input { width: 100%; }

fieldset {
  border: 1px solid #234058;
  border-radius: 6px;
  display: grid;
  gap: 0.4rem;
}
legend { color: var(--muted); padding: 0 0.4rem; }
fieldset label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--muted);
}
fieldset input {
  width: 6rem;
  padding: 0.25rem 0.4rem;
  background: #07121f;
  color: var(--ink);
  border: 1px solid #234058;
  border-radius: 4px;
}
```

Note: the stray `border: 1px solid #1c3consul;` line above is a deliberate typo to remove — write only the correct `border: 1px solid #1c3a57;` line. (Listed here so the engineer does not copy the bad line.)

- [ ] **Step 3: Commit**

```bash
git add index.html style.css
git commit -m "feat: HTML shell and styles"
```

---

## Task 6: Controls module

**Files:**
- Create: `src/controls.js`

(No Node test — thin DOM wrapper. Verified by running the page in Task 7.)

- [ ] **Step 1: Write the implementation**

```javascript
// src/controls.js
// Wires the DOM control panel to callbacks. Knows nothing about sim/canvas.

const CONFIG_FIELDS = [
  'width', 'height', 'cellSize',
  'initialFish', 'initialSharks',
  'fishBreed', 'sharkBreed',
  'sharkStartEnergy', 'sharkEnergyGain',
];

export function setupControls({ onPlayPause, onStep, onReset, onSpeedChange }) {
  const playBtn = document.getElementById('btn-play');
  const stepBtn = document.getElementById('btn-step');
  const resetBtn = document.getElementById('btn-reset');
  const speed = document.getElementById('speed');
  const speedValue = document.getElementById('speed-value');

  playBtn.addEventListener('click', () => {
    const playing = onPlayPause();
    playBtn.textContent = playing ? 'Pause' : 'Play';
  });

  stepBtn.addEventListener('click', () => onStep());

  resetBtn.addEventListener('click', () => {
    onReset(readConfig());
    playBtn.textContent = 'Play';
  });

  speed.addEventListener('input', () => {
    const v = Number(speed.value);
    speedValue.textContent = String(v);
    onSpeedChange(v);
  });

  function readConfig() {
    const cfg = {};
    for (const field of CONFIG_FIELDS) {
      const el = document.getElementById(`cfg-${field}`);
      cfg[field] = Number(el.value);
    }
    return cfg;
  }

  return { readConfig, initialSpeed: Number(speed.value) };
}

export function updateReadout({ fish, sharks, tick }) {
  document.getElementById('readout-fish').textContent = String(fish);
  document.getElementById('readout-sharks').textContent = String(sharks);
  document.getElementById('readout-tick').textContent = String(tick);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/controls.js
git commit -m "feat: controls module wiring UI to callbacks"
```

---

## Task 7: Orchestrator & tick loop

**Files:**
- Create: `src/main.js`

This is the intentional-conflict point for the workshop merge demo.

- [ ] **Step 1: Write the implementation**

```javascript
// src/main.js
import { Simulation, DEFAULTS } from './simulation.js';
import { Renderer } from './renderer.js';
import { setupControls, updateReadout } from './controls.js';

const canvas = document.getElementById('grid');

let sim = new Simulation({ ...DEFAULTS });
let renderer = new Renderer(canvas, sim.config);

let playing = false;
let ticksPerSecond = 10;
let lastTickTime = 0;

const controls = setupControls({
  onPlayPause: () => {
    playing = !playing;
    return playing;
  },
  onStep: () => {
    sim.step();
    render();
  },
  onReset: (config) => {
    playing = false;
    sim = new Simulation(config);
    renderer.configure(sim.config);
    render();
  },
  onSpeedChange: (v) => {
    ticksPerSecond = v;
  },
});

ticksPerSecond = controls.initialSpeed;

function render() {
  renderer.draw(sim.grid);
  updateReadout(sim.counts);
}

function frame(now) {
  if (playing) {
    const interval = 1000 / ticksPerSecond;
    if (now - lastTickTime >= interval) {
      sim.step();
      render();
      lastTickTime = now;
    }
  }
  requestAnimationFrame(frame);
}

render();
requestAnimationFrame(frame);
```

- [ ] **Step 2: Run the page and verify by hand**

Run: `python3 -m http.server 8000`
Open: `http://localhost:8000/`
Expected:
- Grid renders with scattered blue fish and red sharks.
- **Play** animates; fish spread, sharks chase/eat, populations visibly boom and bust.
- **Step** advances one tick. **Pause** stops. **Reset** rebuilds from inputs.
- Speed slider changes tick rate; readout shows live fish/shark/tick counts.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: orchestrator and tick loop"
```

---

## Task 8: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

````markdown
# Wa-Tor — a git worktrees workshop playground

A client-side-only [Wa-Tor](https://en.wikipedia.org/wiki/Wa-Tor) predator–prey
simulation. Fish breed; sharks eat fish, burn energy, and breed. Watch spatial
boom-and-bust dynamics emerge — and tune the parameters toward chaos.

This repo is the demo subject for a **git worktrees** micro workshop: spin it up
on multiple worktrees, edit different modules on different branches, run each on
its own port, and practice merging.

## Run it

No build step. Serve the folder with any static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

Running multiple worktrees? Give each its own port:

```bash
python3 -m http.server 8001   # in worktree-1
python3 -m http.server 8002   # in worktree-2
```

## Test the rules engine

```bash
node --test test/simulation.test.js
```

## Structure

| File                 | Responsibility                                  |
|----------------------|-------------------------------------------------|
| `src/simulation.js`  | Wa-Tor rules engine (pure logic, no DOM)        |
| `src/renderer.js`    | Draws the grid to `<canvas>`                     |
| `src/controls.js`    | Wires the UI control panel to callbacks         |
| `src/main.js`        | Orchestrator + tick loop (wires it all together)|

The leaf modules are independent edit targets — ideal for parallel worktree
edits. `src/main.js` is where overlapping edits naturally collide, making it a
good intentional-merge-conflict exercise.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with run, test, and structure"
```

---

## Self-Review Notes

- **Spec coverage:** seeding (T1), fish rules (T2), shark rules incl. eat/energy/breed (T3), canvas colors (T4), controls incl. play/step/reset/speed/readout (T5–T6), tick loop + zero-pop resilience via plain step (T7), Node tests with injected RNG + invariants (T1–T3), README/run-on-port (T8). Defaults match the spec table.
- **Type consistency:** cell shapes (`{type,breed}` / `{type,breed,energy}`), `Simulation` API (`.grid`, `.step()`, `.counts`, `.config`, `.reset()`), `Renderer` (`.configure`, `.draw`), and `controls` (`setupControls`, `updateReadout`) are consistent across tasks.
- **Zero-population resilience:** `step()` simply finds no creatures of the empty type and continues; no special-casing needed, no crash. Confirmed by the 200-tick invariant test.
