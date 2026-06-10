// Wa-Tor predator-prey rules engine. Pure logic, no DOM.
// Grid is a flat array of length width*height. Each cell is either null (empty)
// or a creature object:
//   Fish:  { type: 'fish',  breed }
//   Shark: { type: 'shark', breed, energy }
// `breed` counts ticks survived since last breeding.

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
    this._shuffle(empties);
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

  _stepShark(i, shark, acted) {
    const { sharkBreed, sharkEnergyGain, sharkStartEnergy } = this.config;
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
      return; // boxed in; stays, energy decremented, breed ticked
    }

    this.grid[dest] = shark;
    acted[dest] = true;
    if (shark.breed >= sharkBreed) {
      shark.breed = 0;
      this.grid[i] = { type: 'shark', breed: 0, energy: sharkStartEnergy };
      acted[i] = true;
    } else {
      this.grid[i] = null;
    }
  }
}
