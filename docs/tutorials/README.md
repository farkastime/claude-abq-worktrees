# Workshop Tutorials

Follow these in order during the worktrees workshop:

1. [Git Worktrees (the basics)](01-git-worktrees.md) — worktrees without Claude.
2. [Claude Code Worktrees](02-claude-worktrees.md) — `claude --worktree`.
3. [Worktree Hooks](03-worktree-hooks.md) — `WorktreeCreate` / `WorktreeRemove`.

Workflow tooling: [`scripts/launch-worktree.sh`](../../scripts/launch-worktree.sh)
opens a Kitty window (nvim/claude/server) + browser on a fresh Niri workspace for
a worktree. Run it standalone:

```bash
scripts/launch-worktree.sh feature2            # create + launch
scripts/launch-worktree.sh --dry-run feature2  # print what it would do
```
