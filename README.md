# claude-abq-worktrees

A micro-workshop on using git worktrees to support parallel development with Claude Code.

The demo subject is a client-side-only [Wa-Tor](https://en.wikipedia.org/wiki/Wa-Tor)
predator–prey simulation. Fish breed; sharks eat fish, burn energy, and breed.
Watch spatial boom-and-bust dynamics emerge — and tune the parameters toward chaos.

Spin it up on multiple worktrees, edit different modules on different branches,
run each on its own port, and practice merging.

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

| File                 | Responsibility                                   |
|----------------------|--------------------------------------------------|
| `src/simulation.js`  | Wa-Tor rules engine (pure logic, no DOM)         |
| `src/renderer.js`    | Draws the grid to `<canvas>`                      |
| `src/controls.js`    | Wires the UI control panel to callbacks          |
| `src/main.js`        | Orchestrator + tick loop (wires it all together) |

The leaf modules are independent edit targets — ideal for parallel worktree
edits. `src/main.js` is where overlapping edits naturally collide, making it a
good intentional-merge-conflict exercise.
