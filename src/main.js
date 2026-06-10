// Orchestrator: wires the simulation, renderer, and controls; runs the tick loop.
// This is the natural intentional-conflict point for the worktrees merge demo.
import { Simulation, DEFAULTS } from './simulation.js';
import { Renderer } from './renderer.js';
import { setupControls, updateReadout } from './controls.js';

const canvas = document.getElementById('grid');

let sim = new Simulation({ ...DEFAULTS });
const renderer = new Renderer(canvas, sim.config);

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
