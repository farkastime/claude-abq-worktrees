// Wa-Tor predator-prey rules engine. Pure logic, no DOM.
// Grid is a flat array of length width*height. Each cell is either null (empty)
// or a creature object:
//   Fish:  { type: 'fish',  breed }
//   Shark: { type: 'shark', breed, energy }
// `breed` counts ticks survived since last breeding.

// Defaults tuned for a watchable boom-bust arc: fish bloom, sharks swarm, then
// the population collapses over ~100 ticks. Basic Wa-Tor is structurally
// extinction-prone; coaxing it toward lasting coexistence is a good worktree
// exercise (try tuning these, or change the movement rules in simulation.js).
export const DEFAULTS = {
  width: 100,
  height: 60,
  cellSize: 6,
  initialFish: 300,
  initialSharks: 60,
  fishBreed: 6,
  sharkBreed: 20,
  sharkStartEnergy: 12,
  sharkEnergyGain: 6,
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
    const { width, height, initialFish, initialSharks, fishBreed, sharkBreed, sharkStartEnergy } = this.config;
    const capacity = width * height;
    const empties = [];
    for (let i = 0; i < capacity; i++) empties.push(i);
    this._shuffle(empties);
    let cursor = 0;
    const fishToPlace = Math.min(initialFish, capacity);
    for (let n = 0; n < fishToPlace; n++) {
      // Randomize the initial breed timer so seeded creatures don't all breed on
      // the same tick — synchronized cohorts cause boom/extinction collapse.
      this.grid[empties[cursor++]] = {
        type: 'fish',
        breed: this._randInt(fishBreed),
        dir: this._randInt(4),
      };
    }
    const sharksToPlace = Math.min(initialSharks, capacity - fishToPlace);
    for (let n = 0; n < sharksToPlace; n++) {
      this.grid[empties[cursor++]] = {
        type: 'shark',
        breed: this._randInt(sharkBreed),
        energy: sharkStartEnergy,
        dir: this._randInt(4),
      };
    }
  }

  // Random integer in [0, n).
  _randInt(n) {
    return Math.floor(this.rng() * n);
  }

  // Fisher–Yates shuffle in place using the injected rng.
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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

  // Returns neighbor indices indexed by direction: [N, E, S, W].
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

  // Chooses a destination direction from `candidates` (array of {dir, index}),
  // biased toward continuing the creature's current heading `dir`. Persistence
  // creates coherent moving fronts and spatial refugia, which lets predator and
  // prey populations coexist instead of mixing into one global boom/bust.
  _chooseHeaded(candidates, dir) {
    const PERSIST = 0.7; // probability of keeping heading when it's available
    const straight = candidates.find((c) => c.dir === dir);
    if (straight && this.rng() < PERSIST) return straight;
    return this._pick(candidates);
  }

  step() {
    const { width, height, fishBreed } = this.config;
    // Process each cell at most once per tick; a creature may move into a
    // not-yet-visited cell, so track which indices have already acted.
    const acted = new Array(width * height).fill(false);
    const order = [];
    for (let i = 0; i < width * height; i++) order.push(i);
    this._shuffle(order);

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
    this.tick++;
  }

  _stepFish(i, fish, acted, fishBreed) {
    fish.breed++;
    const neighbors = this._neighbors(i);
    const empties = [];
    for (let dir = 0; dir < 4; dir++) {
      if (this.grid[neighbors[dir]] === null) empties.push({ dir, index: neighbors[dir] });
    }
    if (empties.length === 0) return; // nowhere to move; stays, keeps breed timer
    const choice = this._chooseHeaded(empties, fish.dir);
    fish.dir = choice.dir;
    const dest = choice.index;
    this.grid[dest] = fish;
    acted[dest] = true;
    if (fish.breed >= fishBreed) {
      fish.breed = 0;
      // Baby left behind inherits a fresh random heading.
      this.grid[i] = { type: 'fish', breed: 0, dir: this._randInt(4) };
      acted[i] = true;
    } else {
      this.grid[i] = null;
    }
  }

  _stepShark(i, shark, acted) {
    const { sharkBreed, sharkEnergyGain, sharkStartEnergy } = this.config;
    shark.breed++;
    shark.energy--;
    if (shark.energy <= 0) {
      this.grid[i] = null; // starved
      return;
    }
    const neighbors = this._neighbors(i);
    const fishCells = [];
    const emptyCells = [];
    for (let dir = 0; dir < 4; dir++) {
      const cell = this.grid[neighbors[dir]];
      if (cell && cell.type === 'fish') fishCells.push({ dir, index: neighbors[dir] });
      else if (cell === null) emptyCells.push({ dir, index: neighbors[dir] });
    }

    let choice;
    if (fishCells.length > 0) {
      choice = this._chooseHeaded(fishCells, shark.dir); // hunt: nearest-heading fish
      shark.energy += sharkEnergyGain; // eat
    } else if (emptyCells.length > 0) {
      choice = this._chooseHeaded(emptyCells, shark.dir);
    } else {
      return; // boxed in; stays, energy decremented, breed ticked
    }

    shark.dir = choice.dir;
    const dest = choice.index;
    this.grid[dest] = shark;
    acted[dest] = true;
    if (shark.breed >= sharkBreed) {
      shark.breed = 0;
      this.grid[i] = { type: 'shark', breed: 0, energy: sharkStartEnergy, dir: this._randInt(4) };
      acted[i] = true;
    } else {
      this.grid[i] = null;
    }
  }
}
