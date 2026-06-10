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
  // On a 2x1 toroidal grid the shark's only neighbor (in both wrap directions)
  // is the fish, so processing order can't let the fish escape — it has no empty
  // cell to flee to. This isolates the eat behavior deterministically.
  const sim = new Simulation({
    width: 2, height: 1, initialFish: 0, initialSharks: 0,
    sharkBreed: 99, sharkEnergyGain: 4,
  });
  sim.grid[0] = { type: 'shark', breed: 0, energy: 3 };
  sim.grid[1] = { type: 'fish', breed: 0 };
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
