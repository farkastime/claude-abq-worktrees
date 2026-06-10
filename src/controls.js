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
