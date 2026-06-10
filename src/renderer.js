// Draws the simulation grid to a <canvas>. Knows nothing about the rules.

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
    const { ctx, cellSize, width } = this;
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
